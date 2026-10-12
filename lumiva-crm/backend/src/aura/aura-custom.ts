import type { AuraSourceKey } from './aura-catalog';

/**
 * Aura: пользовательские виджеты — ИИ собирает их из любых данных CRM (и таблиц рабочей области).
 * Запрос описывается декларативно (набор данных + мера + фильтры + разрез + вид) и выполняется
 * только по полям из этого реестра: имена колонок/выражения — константы, а не ввод пользователя.
 */

export type AuraFieldKind = 'text' | 'enum' | 'number' | 'money' | 'person' | 'bool';
export type AuraFieldDef = { key: string; ai: string; kind: AuraFieldKind; sql: string; values?: string[] };
export type AuraDatasetDef = {
  key: string;
  ai: string;
  /** Раздел Aura, чьё право нужно (null — своё правило, см. сервис). */
  source: AuraSourceKey | 'contacts' | 'companies';
  table: string;
  /** Колонка даты (для периода, сравнения и графика по времени). */
  date: string;
  where?: string;
  /** Колонка валюты для полей money. */
  currency?: string;
  /** Колонка «чей это» для правила «чужие записи скрыты». */
  own?: string[];
  /** Текущее состояние, а не события: период не фильтрует (склад). */
  noPeriod?: boolean;
  fields: AuraFieldDef[];
};

const q = (c: string) => `t."${c}"`;

export const AURA_DATASETS: AuraDatasetDef[] = [
  {
    key: 'leads',
    ai: 'Leads (requests). Date = created',
    source: 'leads',
    table: 'leads',
    date: q('createdAt'),
    where: `t.deleted_at IS NULL AND NOT (COALESCE(t.meta::jsonb,'{}'::jsonb) @> '{"deleted":true}'::jsonb)`,
    currency: q('currency'),
    fields: [
      { key: 'status', ai: 'lead status', kind: 'enum', sql: q('status'), values: ['new', 'in_progress', 'waiting', 'won', 'lost'] },
      { key: 'source', ai: 'lead source (web, telegram, whatsapp, chat, crm, api, csv_import, embed_form…)', kind: 'enum', sql: q('source') },
      { key: 'utm_source', ai: 'UTM source', kind: 'text', sql: q('utmSource') },
      { key: 'utm_medium', ai: 'UTM medium', kind: 'text', sql: q('utmMedium') },
      { key: 'utm_campaign', ai: 'UTM campaign', kind: 'text', sql: q('utmCampaign') },
      { key: 'country', ai: 'country', kind: 'text', sql: q('country') },
      { key: 'amount', ai: 'expected deal amount', kind: 'money', sql: q('amount') },
      { key: 'manager', ai: 'responsible manager', kind: 'person', sql: q('assignedUserId') },
    ],
  },
  {
    key: 'sales',
    ai: 'Sales / deals / orders. Date = sale date',
    source: 'deals',
    table: 'sales',
    date: `COALESCE(t."saleDate", t."createdAt")`,
    currency: q('currency'),
    fields: [
      { key: 'status', ai: 'sale status', kind: 'enum', sql: q('status'), values: ['new', 'pending', 'confirmed', 'cancelled', 'refunded', 'other'] },
      { key: 'amount', ai: 'sale amount', kind: 'money', sql: q('amount') },
      {
        key: 'manager',
        ai: 'manager (responsible for the linked lead, else manager name on the sale)',
        kind: 'text',
        sql: `COALESCE((SELECT su.full_name FROM leads l JOIN staff_users su ON su.id = l."assignedUserId" WHERE l.id = t.lead_id), NULLIF(t."managerName", ''))`,
      },
      { key: 'market', ai: 'market / country', kind: 'text', sql: q('market') },
      { key: 'hotel', ai: 'hotel / brand / product line', kind: 'text', sql: q('hotel') },
      { key: 'agent', ai: 'agent / partner', kind: 'text', sql: q('agentName') },
      { key: 'lead_source', ai: 'source of the linked lead', kind: 'enum', sql: `(SELECT l.source FROM leads l WHERE l.id = t.lead_id)` },
    ],
  },
  {
    key: 'calls',
    ai: 'Phone calls. Date = call start',
    source: 'calls',
    table: 'calls',
    date: `COALESCE(t."startedAt", t."createdAt")`,
    own: ['staffUserId'],
    fields: [
      { key: 'direction', ai: 'inbound/outbound', kind: 'enum', sql: q('direction'), values: ['inbound', 'outbound'] },
      { key: 'status', ai: 'call status', kind: 'enum', sql: q('status'), values: ['completed', 'no-answer', 'busy', 'failed', 'canceled', 'in-progress', 'ringing', 'queued'] },
      { key: 'duration', ai: 'duration in seconds', kind: 'number', sql: q('durationSeconds') },
      { key: 'sentiment', ai: 'AI sentiment', kind: 'enum', sql: q('sentiment'), values: ['positive', 'neutral', 'negative'] },
      { key: 'manager', ai: 'employee', kind: 'person', sql: q('staffUserId') },
    ],
  },
  {
    key: 'bookings',
    ai: 'Service bookings / appointments. Date = visit start',
    source: 'booking',
    table: 'reservations',
    date: q('startAt'),
    currency: q('currency'),
    own: ['staffUserId', 'assignedUserId'],
    fields: [
      { key: 'status', ai: 'booking status', kind: 'enum', sql: q('status'), values: ['draft', 'pending', 'confirmed', 'completed', 'no_show', 'cancelled_by_customer', 'cancelled_by_business', 'rejected'] },
      { key: 'price', ai: 'price', kind: 'money', sql: q('price') },
      { key: 'source', ai: 'booking source', kind: 'enum', sql: q('source') },
      { key: 'location', ai: 'branch / location', kind: 'text', sql: `(SELECT bl.name FROM booking_locations bl WHERE bl.id = t."locationId")` },
      { key: 'service', ai: 'service', kind: 'text', sql: `(SELECT bs.name FROM booking_services bs WHERE bs.id = t."serviceId")` },
      { key: 'participants', ai: 'participants', kind: 'number', sql: q('participants') },
      { key: 'staff', ai: 'specialist', kind: 'person', sql: q('staffUserId') },
    ],
  },
  {
    key: 'hotel_bookings',
    ai: 'Hotel reservations. Date = created',
    source: 'booking',
    table: 'hotel_reservations',
    date: q('createdAt'),
    currency: `(SELECT h.currency FROM hotels h WHERE h.id = t."hotelId")`,
    fields: [
      { key: 'status', ai: 'reservation status', kind: 'enum', sql: q('status') },
      { key: 'paid_status', ai: 'payment status', kind: 'enum', sql: q('paidStatus') },
      { key: 'source', ai: 'channel / source', kind: 'enum', sql: q('source') },
      { key: 'market', ai: 'market', kind: 'text', sql: q('market') },
      { key: 'hotel', ai: 'hotel', kind: 'text', sql: `(SELECT h.name FROM hotels h WHERE h.id = t."hotelId")` },
      { key: 'pax', ai: 'guests', kind: 'number', sql: q('pax') },
      { key: 'total', ai: 'reservation total', kind: 'money', sql: q('total') },
    ],
  },
  {
    key: 'products',
    ai: 'Products / inventory (current state). Date = created',
    source: 'stock',
    table: 'products',
    date: q('createdAt'),
    noPeriod: true,
    where: `COALESCE(t."isDeleted", false) = false`,
    currency: q('currency'),
    fields: [
      { key: 'name', ai: 'product name', kind: 'text', sql: q('name') },
      { key: 'sku', ai: 'SKU', kind: 'text', sql: q('sku') },
      { key: 'status', ai: 'status', kind: 'enum', sql: q('status'), values: ['active', 'draft', 'archived'] },
      { key: 'category', ai: 'category', kind: 'text', sql: `(SELECT pc.name FROM product_categories pc WHERE pc.id = t."categoryId")` },
      { key: 'quantity', ai: 'units in stock', kind: 'number', sql: q('quantity') },
      { key: 'price', ai: 'price', kind: 'money', sql: q('price') },
      { key: 'cost_price', ai: 'cost price', kind: 'money', sql: q('costPrice') },
    ],
  },
  {
    key: 'contacts',
    ai: 'Contacts (people / clients). Date = created',
    source: 'contacts',
    table: 'contacts',
    date: q('createdAt'),
    where: 't.deleted_at IS NULL',
    own: ['assignedUserId'],
    fields: [
      { key: 'status', ai: 'status', kind: 'enum', sql: q('status') },
      { key: 'country', ai: 'country', kind: 'text', sql: q('country') },
      { key: 'city', ai: 'city', kind: 'text', sql: q('city') },
      { key: 'language', ai: 'language', kind: 'text', sql: q('language') },
      { key: 'position', ai: 'job position', kind: 'text', sql: q('position') },
      { key: 'company', ai: 'company', kind: 'text', sql: `(SELECT c.name FROM companies c WHERE c.id = t."companyId")` },
      { key: 'manager', ai: 'responsible', kind: 'person', sql: q('assignedUserId') },
    ],
  },
  {
    key: 'companies',
    ai: 'Companies (B2B clients). Date = created',
    source: 'companies',
    table: 'companies',
    date: q('createdAt'),
    where: 't.deleted_at IS NULL',
    own: ['assignedUserId'],
    fields: [
      { key: 'status', ai: 'status', kind: 'enum', sql: q('status') },
      { key: 'industry', ai: 'industry', kind: 'text', sql: q('industry') },
      { key: 'size', ai: 'size', kind: 'text', sql: q('size') },
      { key: 'type', ai: 'type', kind: 'text', sql: q('type') },
      { key: 'country', ai: 'country', kind: 'text', sql: q('country') },
      { key: 'city', ai: 'city', kind: 'text', sql: q('city') },
      { key: 'manager', ai: 'responsible', kind: 'person', sql: q('assignedUserId') },
    ],
  },
  {
    key: 'ads',
    ai: 'Advertising stats from Google Ads / Meta / Yandex / VK. Date = day',
    source: 'marketing',
    table: 'marketing_traffic',
    date: `t."date"::timestamptz`,
    where: `(t."dataSource" LIKE 'google\\_ads%' OR t."dataSource" LIKE 'meta\\_ads%' OR t."dataSource" LIKE 'yandex\\_direct%' OR t."dataSource" LIKE 'vk\\_ads%')`,
    currency: q('currency'),
    fields: [
      {
        key: 'channel',
        ai: 'ad platform',
        kind: 'enum',
        sql: `CASE WHEN t."dataSource" LIKE 'google\\_ads%' THEN 'Google Ads' WHEN t."dataSource" LIKE 'meta\\_ads%' THEN 'Meta Ads' WHEN t."dataSource" LIKE 'yandex\\_direct%' THEN 'Yandex Direct' ELSE 'VK Ads' END`,
        values: ['Google Ads', 'Meta Ads', 'Yandex Direct', 'VK Ads'],
      },
      { key: 'campaign', ai: 'campaign', kind: 'text', sql: q('campaign') },
      { key: 'country', ai: 'country', kind: 'text', sql: q('country') },
      { key: 'cost', ai: 'ad spend', kind: 'money', sql: q('cost') },
      { key: 'clicks', ai: 'clicks', kind: 'number', sql: q('clicks') },
      { key: 'impressions', ai: 'impressions', kind: 'number', sql: q('impressions') },
      { key: 'conversions', ai: 'platform conversions (actions, not clients)', kind: 'number', sql: q('conversions') },
    ],
  },
];

export const AURA_DATASET_BY_KEY = new Map(AURA_DATASETS.map((d) => [d.key, d]));

export type AuraCustomViz = 'kpi' | 'line' | 'bar' | 'donut' | 'table';
export type AuraCustomFilter = { field: string; op: 'eq' | 'neq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'notempty'; value?: string | number | Array<string | number> };
export type AuraCustomWidget = {
  id: string;
  title: string;
  viz: AuraCustomViz;
  /** ключ из AURA_DATASETS или table:<uuid таблицы рабочей области> */
  dataset: string;
  measure: { agg: 'count' | 'sum' | 'avg' | 'min' | 'max'; field?: string };
  filters?: AuraCustomFilter[];
  groupBy?: string | null;
  limit?: number;
  lowerIsBetter?: boolean;
  /** Для таблиц рабочей области: поле-дата, по которому считать период (иначе — все записи). */
  dateField?: string | null;
};

const VIZ: AuraCustomViz[] = ['kpi', 'line', 'bar', 'donut', 'table'];
const AGG = ['count', 'sum', 'avg', 'min', 'max'];
const OPS = ['eq', 'neq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte', 'empty', 'notempty'];

export const isCustomKey = (k: string) => /^c_[a-z0-9]{4,12}$/.test(k);
export const isTableDataset = (d: string) => /^table:[0-9a-f-]{36}$/i.test(d);

/** Структурная проверка (поля таблиц рабочей области проверяются при расчёте — их список динамический). */
export function sanitizeCustom(raw: unknown): AuraCustomWidget | null {
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, any> | null;
  if (!r) return null;
  const dataset = String(r.dataset || '');
  const def = AURA_DATASET_BY_KEY.get(dataset);
  if (!def && !isTableDataset(dataset)) return null;
  const fieldOk = (f: unknown) => typeof f === 'string' && f.length <= 80 && (!def || def.fields.some((x) => x.key === f));
  const m = r.measure && typeof r.measure === 'object' ? r.measure : { agg: 'count' };
  const agg = AGG.includes(m.agg) ? m.agg : 'count';
  if (agg !== 'count' && !fieldOk(m.field)) return null;
  if (agg !== 'count' && def) {
    const k = def.fields.find((x) => x.key === m.field)!.kind;
    if (k !== 'number' && k !== 'money') return null;
  }
  const filters: AuraCustomFilter[] = (Array.isArray(r.filters) ? r.filters : [])
    .filter((f: any) => f && fieldOk(f.field) && OPS.includes(f.op))
    .slice(0, 8)
    .map((f: any) => ({
      field: String(f.field),
      op: f.op,
      value: Array.isArray(f.value) ? f.value.slice(0, 30).map((v: unknown) => (typeof v === 'number' ? v : String(v).slice(0, 200))) : typeof f.value === 'number' ? f.value : f.value == null ? undefined : String(f.value).slice(0, 200),
    }));
  const groupBy = r.groupBy == null || r.groupBy === '' ? null : String(r.groupBy);
  if (groupBy && groupBy !== 'date' && !fieldOk(groupBy)) return null;
  const viz: AuraCustomViz = VIZ.includes(r.viz) ? r.viz : groupBy && groupBy !== 'date' ? 'bar' : 'kpi';
  const id = isCustomKey(String(r.id || '')) ? String(r.id) : `c_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    title: String(r.title || '').trim().slice(0, 120) || 'Custom',
    viz,
    dataset,
    measure: agg === 'count' ? { agg } : { agg, field: String(m.field) },
    filters,
    groupBy: viz === 'line' ? 'date' : groupBy,
    limit: Math.max(3, Math.min(20, Number(r.limit) || 8)),
    lowerIsBetter: !!r.lowerIsBetter,
    dateField: isTableDataset(dataset) && typeof r.dateField === 'string' && r.dateField.length <= 80 ? r.dateField : null,
  };
}

/* ---------- стиль ---------- */

export type AuraStyle = { bg?: string; surface?: string; ink?: string; accent?: string; accent2?: string; radius?: number; font?: string };
export const AURA_FONTS = ['inter', 'geist', 'dm', 'bricolage', 'barlow', 'mono', 'serif'];
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,20})$/i;

export function sanitizeStyle(raw: unknown): AuraStyle | null {
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!r) return null;
  const out: AuraStyle = {};
  for (const k of ['bg', 'surface', 'ink', 'accent', 'accent2'] as const) {
    const v = typeof r[k] === 'string' ? (r[k] as string).trim() : '';
    if (v && COLOR_RE.test(v)) out[k] = v;
  }
  const rad = Number(r.radius);
  if (Number.isFinite(rad) && rad >= 0 && rad <= 40) out.radius = Math.round(rad);
  if (typeof r.font === 'string' && AURA_FONTS.includes(r.font)) out.font = r.font;
  return Object.keys(out).length ? out : null;
}
