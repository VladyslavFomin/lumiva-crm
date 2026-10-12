import type { DataSource } from 'typeorm';
import type { AuraWidgetResult } from './aura-data.service';
import { AURA_DATASET_BY_KEY, isTableDataset, type AuraCustomWidget, type AuraFieldKind } from './aura-custom';

/** Контекст расчёта, который даёт AuraDataService (период, курс, права). */
export type CustomCalcCtx = {
  db: DataSource;
  tenantId: string;
  role: string;
  staffId: string | null;
  staffName: string | null;
  /** разделы/модули, к которым есть право: leads, deals, calls, booking, stock, marketing, contacts, companies, custom_objects */
  can: Set<string>;
  leadFilter: ((l: any) => boolean) | null;
  ownOnly: boolean;
  maskAmounts: boolean;
  period: { start: number; end: number; prevStart: number; prevEnd: number; buckets: Array<{ s: number; e: number }>; prevBuckets: Array<{ s: number; e: number }>; hourly: boolean };
  conv: (amount: unknown, from?: string | null) => number;
  staffNames: () => Promise<Map<string, string>>;
};

type Row = { d: number; cur: string | null; f: Record<string, unknown> };
type FieldInfo = { kind: AuraFieldKind; ai?: string };
const MAX_ROWS = 20000;

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Список таблиц рабочей области, доступных пользователю (для ИИ и проверки доступа). */
export async function listWorkspaceTables(ctx: Pick<CustomCalcCtx, 'db' | 'tenantId' | 'role' | 'staffId' | 'can'>) {
  if (!ctx.can.has('custom_objects')) return [];
  const objs: Array<{ id: string; name: string; areaId: string | null }> = await ctx.db.query(
    `SELECT o.id, o.name, o."workspaceAreaId" AS "areaId" FROM custom_objects o WHERE o."tenantId" = $1 AND o."isActive" = true ORDER BY o."updatedAt" DESC LIMIT 60`,
    [ctx.tenantId],
  );
  let areas = new Set<string>();
  if (ctx.role !== 'owner' && ctx.staffId) {
    const rows: Array<{ a: string }> = await ctx.db.query(`SELECT "workspaceAreaId" AS a FROM workspace_area_members WHERE "tenantId" = $1 AND "staffUserId" = $2`, [ctx.tenantId, ctx.staffId]);
    areas = new Set(rows.map((r) => r.a));
  }
  const visible = objs.filter((o) => ctx.role === 'owner' || !o.areaId || areas.has(o.areaId));
  if (!visible.length) return [];
  const fields: Array<{ objectId: string; key: string; label: string; type: string }> = await ctx.db.query(
    `SELECT "objectId", key, label, type FROM custom_object_fields WHERE "tenantId" = $1 AND "isActive" = true AND "objectId" = ANY($2::uuid[]) ORDER BY "order"`,
    [ctx.tenantId, visible.map((o) => o.id)],
  );
  return visible.map((o) => ({ id: o.id, name: o.name, fields: fields.filter((f) => f.objectId === o.id).map((f) => ({ key: f.key, label: f.label, type: f.type })) }));
}

const tableKind = (type: string): AuraFieldKind => (/number|currency|money|percent|rating|int|decimal/.test(type) ? 'number' : /bool|check/.test(type) ? 'bool' : 'enum');

async function loadRows(ctx: CustomCalcCtx, c: AuraCustomWidget): Promise<{ rows: Row[]; fields: Map<string, FieldInfo>; noPeriod: boolean } | { error: 'denied' | 'failed' }> {
  const from = new Date(ctx.period.prevStart);
  const to = new Date(ctx.period.end);
  if (isTableDataset(c.dataset)) {
    const objectId = c.dataset.slice(6);
    const tables = await listWorkspaceTables(ctx);
    const t = tables.find((x) => x.id === objectId);
    if (!t) return { error: 'denied' };
    const fields = new Map<string, FieldInfo>(t.fields.map((f) => [f.key, { kind: tableKind(f.type), ai: f.label }]));
    const dateField = c.dateField && t.fields.some((f) => f.key === c.dateField) ? c.dateField : null;
    const recs: Array<{ d: Date; v: Record<string, unknown> }> = await ctx.db.query(
      `SELECT r."createdAt" AS d, r.values AS v FROM custom_object_records r WHERE r."tenantId" = $1 AND r."objectId" = $2 ORDER BY r."createdAt" DESC LIMIT ${MAX_ROWS}`,
      [ctx.tenantId, objectId],
    );
    const rows: Row[] = recs.map((r) => {
      const dv = dateField ? Date.parse(String(r.v?.[dateField] ?? '')) : NaN;
      return { d: Number.isFinite(dv) ? dv : new Date(r.d).getTime(), cur: null, f: r.v || {} };
    });
    return { rows, fields, noPeriod: !dateField };
  }
  const def = AURA_DATASET_BY_KEY.get(c.dataset);
  if (!def) return { error: 'failed' };
  if (!ctx.can.has(def.source)) return { error: 'denied' };
  const params: unknown[] = [ctx.tenantId];
  const where: string[] = [`t."tenantId" = $1`];
  if (!def.noPeriod) {
    params.push(from, to);
    where.push(`${def.date} >= $2 AND ${def.date} <= $3`);
  }
  if (def.where) where.push(`(${def.where})`);
  if (ctx.ownOnly) {
    if (def.own) {
      if (!ctx.staffId) where.push('1 = 0');
      else {
        params.push(ctx.staffId);
        where.push('(' + def.own.map((col) => `t."${col}" = $${params.length}`).join(' OR ') + ')');
      }
    } else if (def.key === 'sales') {
      if (!ctx.staffId) where.push('1 = 0');
      else {
        params.push(ctx.staffId);
        const p = `$${params.length}`;
        where.push(`(EXISTS (SELECT 1 FROM leads l WHERE l.id = t.lead_id AND l."assignedUserId" = ${p}) OR EXISTS (SELECT 1 FROM contacts ct WHERE ct.id = t.contact_id AND ct."assignedUserId" = ${p}))`);
      }
    }
  }
  const cols = [`${def.date} AS "__d"`, `${def.currency || 'NULL'} AS "__cur"`, ...def.fields.map((f) => `${f.sql} AS "f_${f.key}"`)];
  if (def.key === 'leads') cols.push(`t."assignedUserId" AS "__au"`, `t."assignedUserIds" AS "__aus"`, `t."assignedTo" AS "__at"`, `t."assignedToList" AS "__atl"`, `t.source AS "__src"`);
  const raw: Array<Record<string, any>> = await ctx.db.query(`SELECT ${cols.join(', ')} FROM ${def.table} t WHERE ${where.join(' AND ')} LIMIT ${MAX_ROWS}`, params);
  let list = raw;
  if (def.key === 'leads' && ctx.leadFilter) {
    list = raw.filter((r) => ctx.leadFilter!({ assignedUserId: r.__au, assignedUserIds: r.__aus, assignedTo: r.__at, assignedToList: r.__atl, source: r.__src }));
  }
  const rows: Row[] = list.map((r) => {
    const f: Record<string, unknown> = {};
    for (const fd of def.fields) f[fd.key] = r[`f_${fd.key}`];
    return { d: r.__d ? new Date(r.__d).getTime() : 0, cur: r.__cur || null, f };
  });
  return { rows, fields: new Map(def.fields.map((fd) => [fd.key, { kind: fd.kind, ai: fd.ai }])), noPeriod: !!def.noPeriod };
}

function matches(v: unknown, op: string, val: unknown): boolean {
  const s = v == null ? '' : String(v).toLowerCase();
  const list = (Array.isArray(val) ? val : [val]).map((x) => String(x ?? '').toLowerCase());
  switch (op) {
    case 'eq':
      return s === list[0];
    case 'neq':
      return s !== list[0];
    case 'in':
      return list.includes(s);
    case 'contains':
      return !!list[0] && s.includes(list[0]);
    case 'empty':
      return s === '';
    case 'notempty':
      return s !== '';
  }
  const a = num(v);
  const b = num(Array.isArray(val) ? val[0] : val);
  if (a == null || b == null) return false;
  return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
}

export async function computeCustom(ctx: CustomCalcCtx, c: AuraCustomWidget): Promise<AuraWidgetResult> {
  const loaded = await loadRows(ctx, c);
  if ('error' in loaded) return { error: loaded.error };
  const { fields, noPeriod } = loaded;
  const mField = c.measure.field ? fields.get(c.measure.field) : null;
  if (c.measure.agg !== 'count' && (!mField || (mField.kind !== 'number' && mField.kind !== 'money'))) return { error: 'failed' };
  const isMoney = mField?.kind === 'money';
  if (isMoney && ctx.maskAmounts) return { error: 'amounts_hidden' };
  for (const f of c.filters || []) if (!fields.has(f.field)) return { error: 'failed' };
  if (c.groupBy && c.groupBy !== 'date' && !fields.has(c.groupBy)) return { error: 'failed' };

  const rows = loaded.rows.filter((r) => (c.filters || []).every((f) => matches(r.f[f.field], f.op, f.value)));
  const valueOf = (r: Row) => {
    if (c.measure.agg === 'count') return 1;
    const n = num(r.f[c.measure.field!]);
    if (n == null) return null;
    return isMoney ? ctx.conv(n, r.cur) : n;
  };
  const agg = (list: Row[]): number | null => {
    const vals = list.map(valueOf).filter((v): v is number => v != null);
    if (c.measure.agg === 'count') return list.length;
    if (!vals.length) return null;
    if (c.measure.agg === 'sum') return vals.reduce((a, b) => a + b, 0);
    if (c.measure.agg === 'avg') return vals.reduce((a, b) => a + b, 0) / vals.length;
    if (c.measure.agg === 'min') return Math.min(...vals);
    return Math.max(...vals);
  };
  const P = ctx.period;
  const inCur = (r: Row) => noPeriod || (r.d >= P.start && r.d <= P.end);
  const inPrev = (r: Row) => !noPeriod && r.d >= P.prevStart && r.d <= P.prevEnd;
  const cur = rows.filter(inCur);
  const format: 'int' | 'money' | 'num' = isMoney ? 'money' : c.measure.agg === 'avg' ? 'num' : 'int';
  const bucketSeries = (buckets: Array<{ s: number; e: number }>, limit: number) =>
    buckets.map((b) => {
      const v = agg(rows.filter((r) => r.d >= b.s && r.d < b.e && r.d <= limit));
      return v == null ? 0 : round(v);
    });

  if (c.viz === 'kpi') {
    const v = agg(cur);
    const pv = noPeriod ? null : agg(rows.filter(inPrev));
    const delta = v != null && pv && !P.hourly ? { kind: 'pct' as const, value: round(((v - pv) / pv) * 100, 1) } : null;
    const good = !delta || delta.value === 0 ? null : c.lowerIsBetter ? delta.value < 0 : delta.value > 0;
    return { type: 'kpi', value: v == null ? null : round(v), format: format as any, delta, good, spark: noPeriod ? null : bucketSeries(P.buckets, P.end) };
  }
  if (c.viz === 'line') {
    const current = bucketSeries(P.buckets, P.end);
    const previous = noPeriod ? current.map(() => 0) : bucketSeries(P.prevBuckets, P.prevEnd);
    return { type: 'line', format: format as any, current, previous, total: round(agg(cur) ?? 0), prevTotal: round(noPeriod ? 0 : agg(rows.filter(inPrev)) ?? 0) };
  }
  // разрезы
  const gField = c.groupBy && c.groupBy !== 'date' ? c.groupBy : null;
  if (!gField) return { error: 'failed' };
  const names = fields.get(gField)?.kind === 'person' ? await ctx.staffNames() : null;
  const groups = new Map<string, Row[]>();
  for (const r of cur) {
    let k = r.f[gField];
    let key = k == null || k === '' ? '—' : Array.isArray(k) ? k.join(', ') : String(k);
    if (names && k) key = names.get(String(k)) || '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const items = [...groups.entries()]
    .map(([name, list]) => ({ name, value: round(agg(list) ?? 0) }))
    .sort((a, b) => (c.lowerIsBetter ? a.value - b.value : b.value - a.value));
  const limit = c.limit || 8;
  if (c.viz === 'donut') {
    const top = items.slice(0, Math.min(limit, 6)).map((x) => ({ key: x.name, name: x.name, value: x.value }));
    const rest = items.slice(top.length).reduce((a, x) => a + x.value, 0);
    if (rest > 0 && c.measure.agg !== 'avg') top.push({ key: 'other', name: 'other', value: round(rest) });
    return { type: 'donut', format: format as any, items: top.filter((x) => x.value > 0) };
  }
  if (c.viz === 'table') {
    return {
      type: 'table',
      cols: [
        { key: 'group', kind: 'text' },
        { key: 'count', kind: 'int' },
        { key: 'value', kind: isMoney ? 'money' : 'int' },
      ],
      rows: items.slice(0, limit).map((x) => ({ group: x.name, count: groups.get(x.name)!.length, value: x.value })),
    };
  }
  return { type: 'bar', format: format as any, people: !!names, items: items.slice(0, limit) };
}
