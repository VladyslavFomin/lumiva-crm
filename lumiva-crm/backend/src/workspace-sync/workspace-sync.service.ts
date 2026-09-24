import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CustomObjectsService } from '../custom-objects/custom-objects.service';
import type { CustomObjectFieldType } from '../custom-objects/custom-object-field.entity';
import { MarketingService } from '../marketing/marketing.service';
import { resolveMarketQuery } from '../marketing/marketing-market-catalog';
import { IntegrationsService } from '../integrations/integrations.service';

/**
 * Источники синхронизации таблицы рабочей области. Хранятся в custom_objects.meta.syncSources
 * (без отдельной таблицы: БД с synchronize:false). Одна таблица может сводить несколько
 * источников; каждая строка, записанная источником, помечена record.meta.syncSourceId, поэтому
 * пересборка одного источника не трогает строки других и ручные строки.
 */
export type SyncSourceKind = 'marketing_monthly' | 'marketing_rows' | 'integration_import';

export type SyncSchedule = { type: 'nightly' } | { type: 'interval'; everyMinutes: number };

export interface SyncSource {
  id: string;
  kind: SyncSourceKind;
  label?: string;
  params: Record<string, any>;
  autoRefresh: boolean;
  schedule: SyncSchedule;
  lastRefreshAt?: string;
  lastRefreshStatus?: 'ok' | 'error' | 'running';
  lastRefreshError?: string | null;
  lastRecordCount?: number;
  runningSince?: string;
}

type RefreshOutcome = { ok: true; recordCount: number; extra?: Record<string, unknown> } | { ok: false; error: string; payload?: Record<string, unknown> };

const NIGHTLY_HOUR = 4;
const NIGHTLY_MINUTE = 30;
const STUCK_RUNNING_MS = 30 * 60_000;
const ERROR_RETRY_MS = 60 * 60_000;
const DEFAULT_ROWS_LIMIT = 20_000;

const PROVIDER_LABELS: Array<[string, string]> = [
  ['google_ads', 'Google Ads'],
  ['meta_ads', 'Meta Ads'],
  ['yandex_direct', 'Яндекс.Директ'],
  ['vk_ads', 'VK Ads'],
  ['yandex_metrika', 'Яндекс.Метрика'],
  ['ga4', 'GA4'],
];

export function providerLabel(dataSource: string): string {
  const ds = (dataSource || '').trim();
  for (const [prefix, label] of PROVIDER_LABELS) {
    if (ds === prefix) return label;
    if (ds.startsWith(`${prefix}_`)) return `${label} · ${ds.slice(prefix.length + 1)}`;
  }
  return ds || '—';
}

/** Источники из меты; старый meta.marketingSource виртуально превращается в marketing_monthly. */
export function getSyncSources(meta: Record<string, any> | null | undefined): SyncSource[] {
  const m = meta && typeof meta === 'object' ? meta : {};
  if (Array.isArray(m.syncSources)) return m.syncSources as SyncSource[];
  const legacy = m.marketingSource as Record<string, any> | undefined;
  if (legacy?.params) {
    return [
      {
        id: 'legacy-monthly',
        kind: 'marketing_monthly',
        params: legacy.params,
        autoRefresh: legacy.autoRefresh === true,
        schedule: { type: 'nightly' },
        lastRefreshAt: legacy.lastRefreshAt,
        lastRefreshStatus: legacy.lastRefreshStatus,
        lastRefreshError: legacy.lastRefreshError ?? null,
        lastRecordCount: legacy.lastRecordCount,
      },
    ];
  }
  return [];
}

function metaWithSources(meta: Record<string, any> | null | undefined, sources: SyncSource[]) {
  const { marketingSource: _legacy, ...rest } = (meta && typeof meta === 'object' ? meta : {}) as Record<string, any>;
  return { ...rest, syncSources: sources };
}

@Injectable()
export class WorkspaceSyncService {
  private readonly log = new Logger(WorkspaceSyncService.name);
  private readonly metaChains = new Map<string, Promise<unknown>>();
  private readonly running = new Set<string>();

  constructor(
    private readonly customObjects: CustomObjectsService,
    private readonly marketing: MarketingService,
    private readonly integrations: IntegrationsService,
  ) {}

  /* ───────────────────────── мета: чтение/запись источников ───────────────────────── */

  async listSources(tenantId: string, objectId: string): Promise<SyncSource[] | null> {
    try {
      const obj = await this.customObjects.getObject(tenantId, objectId);
      return getSyncSources(obj.meta);
    } catch {
      return null;
    }
  }

  /** Читает свежую мету, применяет fn и сохраняет; вызовы по одной таблице выстраиваются в очередь. */
  private async mutateSources<T>(
    tenantId: string,
    objectId: string,
    fn: (sources: SyncSource[]) => { sources: SyncSource[]; result: T },
  ): Promise<T> {
    const key = `${tenantId}:${objectId}`;
    const prev = this.metaChains.get(key) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(async () => {
      const obj = await this.customObjects.getObject(tenantId, objectId);
      const { sources, result } = fn(getSyncSources(obj.meta));
      await this.customObjects.updateObject(tenantId, objectId, {
        meta: metaWithSources(obj.meta, sources),
      } as any);
      return result;
    });
    this.metaChains.set(key, run);
    try {
      return await run;
    } finally {
      if (this.metaChains.get(key) === run) this.metaChains.delete(key);
    }
  }

  private async patchSource(tenantId: string, objectId: string, sourceId: string, patch: Partial<SyncSource>) {
    await this.mutateSources(tenantId, objectId, (sources) => ({
      sources: sources.map((s) => (s.id === sourceId ? { ...s, ...patch } : s)),
      result: undefined,
    }));
  }

  /* ───────────────────────── операции над источниками ───────────────────────── */

  private defaultSchedule(kind: SyncSourceKind, params: Record<string, any>): SyncSchedule {
    if (kind !== 'integration_import') return { type: 'nightly' };
    const via = String(params.via || '');
    return { type: 'interval', everyMinutes: via === 'hub_woo' ? 180 : 1440 };
  }

  async addSource(
    tenantId: string,
    objectId: string,
    input: {
      kind: SyncSourceKind;
      params: Record<string, any>;
      label?: string;
      autoRefresh?: boolean;
      schedule?: SyncSchedule;
      /** Первая загрузка уже выполнена вызывающим (ручной импорт) — повторно не гоняем. */
      skipInitialRefresh?: boolean;
    },
  ): Promise<Record<string, unknown>> {
    let obj;
    try {
      obj = await this.customObjects.getObject(tenantId, objectId);
    } catch {
      return { ok: false, error: 'table_not_found' };
    }
    const existing = getSyncSources(obj.meta);
    const kind = input.kind;
    if (!['marketing_monthly', 'marketing_rows', 'integration_import'].includes(kind)) {
      return { ok: false, error: 'invalid_kind' };
    }
    if (kind === 'marketing_monthly' && existing.length) {
      return { ok: false, error: 'monthly_is_exclusive', hint: 'Таблица «расходы по месяцам» (строка × колонка-месяц) занимает всю таблицу — её нельзя смешивать с другими источниками. Создай для неё отдельную таблицу.' };
    }
    if (existing.some((s) => s.kind === 'marketing_monthly')) {
      return { ok: false, error: 'table_has_monthly_source', hint: 'В этой таблице уже есть источник «расходы по месяцам» — он занимает всю таблицу и не сочетается с другими источниками.' };
    }
    const params = { ...(input.params || {}) };
    if (kind === 'marketing_rows') {
      const providers = Array.isArray(params.providers) ? params.providers.map((p: unknown) => String(p).trim()).filter(Boolean) : [];
      if (!providers.length) return { ok: false, error: 'providers_required', hint: 'Укажи providers: google_ads, meta_ads, yandex_direct, vk_ads, ga4, yandex_metrika (можно несколько).' };
      params.providers = providers;
      params.grain = ['daily', 'campaign', 'channel'].includes(params.grain) ? params.grain : 'daily';
    }
    if (kind === 'integration_import') {
      if (!params.connectionId || !params.mapping || !['hub_woo', 'hub_meta_ads', 'marketing_meta_ads', 'marketing_ga4'].includes(String(params.via))) {
        return { ok: false, error: 'invalid_import_params', hint: 'Нужны via (hub_woo|hub_meta_ads|marketing_meta_ads|marketing_ga4), connectionId и mapping.' };
      }
    }

    const source: SyncSource = {
      id: randomUUID().replace(/-/g, '').slice(0, 12),
      kind,
      label: input.label?.trim() || undefined,
      params,
      autoRefresh: input.autoRefresh !== false,
      schedule: input.schedule ?? this.defaultSchedule(kind, params),
      ...(input.skipInitialRefresh ? { lastRefreshAt: new Date().toISOString(), lastRefreshStatus: 'ok' as const } : {}),
    };
    await this.mutateSources(tenantId, objectId, (sources) => ({ sources: [...sources, source], result: undefined }));

    if (input.skipInitialRefresh) return { ok: true, sourceId: source.id, autoRefresh: source.autoRefresh };

    // Первая загрузка сразу: если не удалась — источник не остаётся «висеть» включённым.
    const res = await this.refreshSource(tenantId, objectId, source.id);
    if (!res.ok) {
      await this.patchSource(tenantId, objectId, source.id, { autoRefresh: false });
      return { ...res, sourceId: source.id, autoRefresh: false };
    }
    // Стал источник вторым — у первого нужна колонка «Источник данных»: пересобираем строчные источники.
    const total = existing.length + 1;
    if (total > 1) {
      for (const s of existing) {
        if (s.kind === 'marketing_rows') await this.refreshSource(tenantId, objectId, s.id);
      }
    }
    return { ...res, sourceId: source.id, autoRefresh: source.autoRefresh };
  }

  async updateSource(
    tenantId: string,
    objectId: string,
    sourceId: string,
    patch: { autoRefresh?: boolean; label?: string; params?: Record<string, any>; schedule?: SyncSchedule },
  ): Promise<Record<string, unknown>> {
    const sources = await this.listSources(tenantId, objectId);
    if (!sources) return { ok: false, error: 'table_not_found' };
    const cur = sources.find((s) => s.id === sourceId);
    if (!cur) return { ok: false, error: 'source_not_found' };
    const next: Partial<SyncSource> = {};
    if (patch.autoRefresh !== undefined) next.autoRefresh = !!patch.autoRefresh;
    if (patch.label !== undefined) next.label = patch.label.trim() || undefined;
    if (patch.schedule) next.schedule = patch.schedule;
    if (patch.params) next.params = { ...cur.params, ...patch.params };
    await this.patchSource(tenantId, objectId, sourceId, next);
    if (patch.params) return { ...(await this.refreshSource(tenantId, objectId, sourceId)), sourceId };
    return { ok: true, sourceId, autoRefresh: next.autoRefresh ?? cur.autoRefresh };
  }

  async removeSource(
    tenantId: string,
    objectId: string,
    sourceId: string,
    opts?: { deleteRows?: boolean },
  ): Promise<Record<string, unknown>> {
    const sources = await this.listSources(tenantId, objectId);
    if (!sources) return { ok: false, error: 'table_not_found' };
    if (!sources.some((s) => s.id === sourceId)) return { ok: false, error: 'source_not_found' };
    let deleted = 0;
    if (opts?.deleteRows) {
      const res = await this.customObjects.replaceSyncedRecords(tenantId, objectId, sourceId, [], {
        deleteAll: sources.length === 1,
      });
      deleted = res.deleted;
    }
    await this.mutateSources(tenantId, objectId, (list) => ({ sources: list.filter((s) => s.id !== sourceId), result: undefined }));
    return { ok: true, removedSourceId: sourceId, deletedRows: deleted };
  }

  /* ───────────────────────── обновление ───────────────────────── */

  async refreshSource(tenantId: string, objectId: string, sourceId: string): Promise<{ ok: boolean; [k: string]: unknown }> {
    const sources = await this.listSources(tenantId, objectId);
    if (!sources) return { ok: false, error: 'table_not_found' };
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return { ok: false, error: 'source_not_found' };

    const lockKey = `${tenantId}:${objectId}:${sourceId}`;
    if (this.running.has(lockKey)) return { ok: false, error: 'already_running' };
    this.running.add(lockKey);
    try {
      await this.patchSource(tenantId, objectId, sourceId, {
        lastRefreshStatus: 'running',
        runningSince: new Date().toISOString(),
      });
      let outcome: RefreshOutcome;
      try {
        outcome = await this.runAdapter(tenantId, objectId, source, sources.length > 1);
      } catch (e: any) {
        outcome = { ok: false, error: 'refresh_failed', payload: { message: e?.message || String(e) } };
      }
      const now = new Date().toISOString();
      if (outcome.ok) {
        await this.patchSource(tenantId, objectId, sourceId, {
          lastRefreshAt: now,
          lastRefreshStatus: 'ok',
          lastRefreshError: null,
          lastRecordCount: outcome.recordCount,
          runningSince: undefined,
        });
        return { ok: true, sourceId, recordCount: outcome.recordCount, ...(outcome.extra || {}) };
      }
      const msg = String(outcome.payload?.message || outcome.payload?.hint || outcome.error).slice(0, 300);
      await this.patchSource(tenantId, objectId, sourceId, {
        lastRefreshAt: now,
        lastRefreshStatus: 'error',
        lastRefreshError: msg,
        runningSince: undefined,
      });
      this.log.warn(`sync ${objectId}/${sourceId} (${source.kind}) failed: ${msg}`);
      return { ok: false, error: outcome.error, ...(outcome.payload || {}) };
    } finally {
      this.running.delete(lockKey);
    }
  }

  async refreshTable(tenantId: string, objectId: string): Promise<Record<string, unknown>> {
    const sources = await this.listSources(tenantId, objectId);
    if (!sources) return { ok: false, error: 'table_not_found' };
    if (!sources.length) return { ok: false, error: 'no_sources', hint: 'У таблицы нет источников синхронизации.' };
    const results: Array<Record<string, unknown>> = [];
    for (const s of sources) results.push(await this.refreshSource(tenantId, objectId, s.id));
    return { ok: results.every((r) => r.ok), results };
  }

  private isDue(s: SyncSource, now: Date): boolean {
    if (!s.autoRefresh) return false;
    if (s.lastRefreshStatus === 'running' && s.runningSince && now.getTime() - new Date(s.runningSince).getTime() < STUCK_RUNNING_MS) {
      return false;
    }
    const last = s.lastRefreshAt ? new Date(s.lastRefreshAt).getTime() : 0;
    if (s.lastRefreshStatus === 'error' && now.getTime() - last >= ERROR_RETRY_MS) return true;
    if (s.schedule.type === 'interval') return now.getTime() - last >= s.schedule.everyMinutes * 60_000;
    // nightly: один раз в сутки, начиная с 04:30 — после ночной синхронизации рекламных кабинетов
    const boundary = new Date(now);
    boundary.setHours(NIGHTLY_HOUR, NIGHTLY_MINUTE, 0, 0);
    return now.getTime() >= boundary.getTime() && last < boundary.getTime();
  }

  /** Тик планировщика: обновляет все источники, которым пора. */
  async refreshAllDue(): Promise<{ checked: number; ok: number; failed: number }> {
    const objects = await this.customObjects.findTablesWithSyncSources();
    const now = new Date();
    let checked = 0;
    let ok = 0;
    let failed = 0;
    for (const o of objects) {
      for (const s of getSyncSources(o.meta)) {
        if (!this.isDue(s, now)) continue;
        checked += 1;
        const res = await this.refreshSource(o.tenantId, o.id, s.id);
        if (res.ok) ok += 1;
        else failed += 1;
      }
    }
    return { checked, ok, failed };
  }

  /* ───────────────────────── адаптеры ───────────────────────── */

  private async runAdapter(tenantId: string, objectId: string, source: SyncSource, multi: boolean): Promise<RefreshOutcome> {
    switch (source.kind) {
      case 'marketing_monthly':
        return this.runMonthly(tenantId, objectId, source);
      case 'marketing_rows':
        return this.runMarketingRows(tenantId, objectId, source, multi);
      case 'integration_import':
        return this.runIntegrationImport(tenantId, objectId, source);
      default:
        return { ok: false, error: 'unknown_kind' };
    }
  }

  private async ensureFields(
    tenantId: string,
    objectId: string,
    columns: Array<{ key: string; label: string; type: CustomObjectFieldType }>,
  ) {
    const existing = await this.customObjects.listFields(tenantId, objectId);
    const have = new Set(existing.map((f) => f.key));
    let order = existing.length;
    for (const c of columns) {
      if (have.has(c.key)) continue;
      await this.customObjects.createField(tenantId, objectId, {
        key: c.key,
        label: c.label,
        type: c.type,
        required: false,
        order: order++,
      } as any);
    }
  }

  /* --- marketing_rows: строки marketing_traffic (несколько провайдеров) --- */

  marketingRowsColumns(grain: 'daily' | 'campaign' | 'channel', withSourceLabel: boolean) {
    const cols: Array<{ key: string; label: string; type: CustomObjectFieldType }> = [];
    if (grain === 'daily') cols.push({ key: 'date', label: 'Дата', type: 'date' });
    cols.push(
      { key: 'provider', label: 'Провайдер', type: 'text' },
      { key: 'source', label: 'Источник', type: 'text' },
      { key: 'medium', label: 'Канал', type: 'text' },
    );
    if (grain !== 'channel') cols.push({ key: 'campaign', label: 'Кампания', type: 'text' });
    if (grain === 'daily') cols.push({ key: 'country', label: 'Страна', type: 'text' });
    cols.push(
      { key: 'sessions', label: 'Сессии', type: 'number' },
      { key: 'clicks', label: 'Клики', type: 'number' },
      { key: 'impressions', label: 'Показы', type: 'number' },
      { key: 'leads', label: 'Лиды', type: 'number' },
      { key: 'revenue', label: 'Выручка', type: 'number' },
      { key: 'cost', label: 'Расход', type: 'number' },
      { key: 'currency', label: 'Валюта', type: 'text' },
    );
    if (withSourceLabel) cols.push({ key: 'sync_source', label: 'Источник данных', type: 'text' });
    return cols;
  }

  private describeRowsSource(source: SyncSource): string {
    if (source.label) return source.label;
    const p: string[] = (source.params.providers || []).map((x: string) => providerLabel(x));
    const g = source.params.grain === 'daily' ? 'по дням' : source.params.grain === 'campaign' ? 'по кампаниям' : 'по каналам';
    return `${p.join(' + ')} (${g})`;
  }

  private async runMarketingRows(tenantId: string, objectId: string, source: SyncSource, multi: boolean): Promise<RefreshOutcome> {
    const p = source.params;
    const market = p.market ? resolveMarketQuery(String(p.market)) || undefined : undefined;
    const { rows, truncated } = await this.marketing.getTrafficRows(tenantId, {
      from: p.from ? String(p.from) : undefined,
      to: p.to ? String(p.to) : undefined,
      dataSources: p.providers,
      market,
      grain: p.grain,
      limit: Number(p.maxRows) || DEFAULT_ROWS_LIMIT,
    });
    if (!rows.length) {
      return { ok: false, error: 'no_rows', payload: { hint: 'Нет данных marketing_traffic за период/по выбранным провайдерам — таблица не изменена.' } };
    }

    const display = p.displayCurrency ? String(p.displayCurrency).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : '';
    let mult: Record<string, number> | null = null;
    if (/^[A-Z]{3}$/.test(display)) {
      try {
        mult = (await this.marketing.getMarketingFxRates(display)).multiplyToDisplay;
      } catch {
        mult = null; // курсов нет — оставляем исходные валюты, а не подставляем «на глаз»
      }
    }

    const columns = this.marketingRowsColumns(p.grain, multi);
    await this.ensureFields(tenantId, objectId, columns);
    const label = this.describeRowsSource(source);
    const records = rows.map((r) => {
      const code = (r.currency || 'EUR').toUpperCase().slice(0, 3);
      const m = mult && display && code !== display ? mult[code] : undefined;
      const conv = (v: number) => (m != null && Number.isFinite(m) ? Math.round(v * m * 100) / 100 : v);
      const values: Record<string, unknown> = {
        provider: providerLabel(r.dataSource),
        source: r.source,
        medium: r.medium,
        sessions: r.sessions,
        clicks: r.clicks,
        impressions: r.impressions,
        leads: r.leads,
        revenue: conv(r.revenue),
        cost: conv(r.cost),
        currency: m != null && Number.isFinite(m) ? display : mult && code === display ? display : r.currency,
      };
      if (p.grain === 'daily') {
        values.date = r.date;
        values.country = r.country;
      }
      if (p.grain !== 'channel') values.campaign = r.campaign;
      if (multi) values.sync_source = label;
      return { values };
    });
    const res = await this.customObjects.replaceSyncedRecords(tenantId, objectId, source.id, records);
    return {
      ok: true,
      recordCount: res.created,
      extra: { skippedRows: res.skipped || undefined, truncated: truncated || undefined },
    };
  }

  /* --- integration_import: повтор сохранённого ручного импорта (Woo / Meta Ads / GA4) --- */

  private async runIntegrationImport(tenantId: string, objectId: string, source: SyncSource): Promise<RefreshOutcome> {
    const { via, connectionId, mapping } = source.params;
    let r: { ok: boolean; created?: number; updated?: number; workspaceCreated?: number; workspaceUpdated?: number; message?: string };
    if (via === 'hub_woo') {
      r = await this.integrations.syncForTenant(tenantId, connectionId, { customObjectId: objectId, wooWorkspaceImport: mapping });
    } else if (via === 'hub_meta_ads') {
      r = await this.integrations.syncForTenant(tenantId, connectionId, { customObjectId: objectId, metaAdsWorkspaceImport: mapping });
    } else if (via === 'marketing_meta_ads') {
      r = await this.integrations.syncMetaAdsWorkspaceImportFromMarketing(tenantId, connectionId, objectId, mapping);
    } else if (via === 'marketing_ga4') {
      r = await this.integrations.syncGa4WorkspaceImportFromMarketing(tenantId, connectionId, objectId, mapping);
    } else {
      return { ok: false, error: 'unknown_via' };
    }
    if (!r.ok) return { ok: false, error: 'import_failed', payload: { message: r.message || 'Импорт вернул ошибку' } };
    const count = (r.workspaceCreated ?? r.created ?? 0) + (r.workspaceUpdated ?? r.updated ?? 0);
    return { ok: true, recordCount: count };
  }

  /* --- marketing_monthly: «расходы по месяцам» (строка × колонка-на-месяц) --- */

  monthFieldKey(mo: string): string {
    return `m_${mo.replace('-', '_')}`;
  }

  monthLabelRu(mo: string): string {
    const [y, m] = mo.split('-');
    const names = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return `${names[Number(m) - 1] || m} ${y}`;
  }

  monthlyBreakdownColumns(months: string[], groupBy: 'dataSource' | 'market') {
    return [
      { key: 'account', label: groupBy === 'market' ? 'Страна / рынок' : 'Источник / аккаунт', type: 'text' as CustomObjectFieldType, order: 0 },
      ...months.map((mo, i) => ({ key: this.monthFieldKey(mo), label: this.monthLabelRu(mo), type: 'number' as CustomObjectFieldType, order: i + 1 })),
      { key: 'total_cost', label: 'Итого', type: 'number' as CustomObjectFieldType, order: months.length + 1 },
      { key: 'currency', label: 'Валюта', type: 'text' as CustomObjectFieldType, order: months.length + 2 },
    ];
  }

  private round2(n: number): number {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  monthlyBreakdownRecordValues(
    r: { label?: string; dataSource?: string; totalCost: number; currency?: string | null; monthly: Record<string, number> },
    months: string[],
  ): Record<string, unknown> {
    const values: Record<string, unknown> = {
      account: r.label || r.dataSource,
      total_cost: this.round2(r.totalCost),
      currency: r.currency ?? '',
    };
    for (const mo of months) values[this.monthFieldKey(mo)] = this.round2(r.monthly[mo] ?? 0);
    return values;
  }

  /** Данные таблицы «расходы по месяцам» из marketing_traffic (+ пересчёт в displayCurrency). */
  async buildMonthlyBreakdownData(tenantId: string, args: Record<string, unknown>) {
    const from = args.from ? String(args.from) : undefined;
    const to = args.to ? String(args.to) : undefined;
    const dataSourceFilter = args.dataSource ? String(args.dataSource).trim() : undefined;
    const marketRaw = args.market ? String(args.market).trim() : '';
    const marketCode = marketRaw ? resolveMarketQuery(marketRaw) || undefined : undefined;
    const unknownMarket = marketRaw && !marketCode ? marketRaw : undefined;

    if (unknownMarket) {
      const { markets } = await this.marketing.getMarketingMarketsBreakdown(tenantId, from, to, dataSourceFilter);
      return {
        ok: false as const,
        payload: {
          ok: false,
          error: 'unknown_market',
          requestedMarket: unknownMarket,
          hint: 'Этот рынок не распознан справочником. НЕ создавай таблицу с нефильтрованными данными под этим названием — уточни у пользователя или используй один из availableMarkets.',
          availableMarkets: markets.map((m) => ({ code: m.code, label: m.label, cost: m.cost })),
        } as Record<string, unknown>,
      };
    }

    const groupBy: 'dataSource' | 'market' = String(args.groupBy || '').trim().toLowerCase() === 'market' ? 'market' : 'dataSource';
    const { months, rows } = await this.marketing.getTrafficMonthlyBreakdown(tenantId, from, to, dataSourceFilter, marketCode, groupBy);

    const dRaw = args.displayCurrency ? String(args.displayCurrency).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : '';
    const displayOpt = /^[A-Z]{3}$/.test(dRaw) ? dRaw : null;
    let fx: { multiplyToDisplay: Record<string, number>; display: string; asOf: string; source: string } | null = null;
    let fxError: string | null = null;
    if (displayOpt) {
      try {
        const loaded = await this.marketing.getMarketingFxRates(displayOpt);
        fx = { multiplyToDisplay: loaded.multiplyToDisplay, display: loaded.display, asOf: loaded.asOf, source: loaded.source };
      } catch (e: unknown) {
        fxError = e instanceof Error ? e.message : String(e);
      }
    }
    const convertedRows = rows.map((r) => {
      if (!fx) return r;
      const code = (r.currency || 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'EUR';
      const m = fx.multiplyToDisplay[code];
      if (m == null || !Number.isFinite(m)) return r;
      const monthly: Record<string, number> = {};
      for (const [mo, v] of Object.entries(r.monthly)) monthly[mo] = v * m;
      return { ...r, monthly, totalCost: r.totalCost * m, currency: fx.display };
    });

    // Строки с нулевым расходом за весь период (например страны, у которых есть только трафик GA4)
    // в таблицу расходов не кладём — они лишь раздувают список и легенды виджетов.
    const paidRows = convertedRows.filter((r) => Math.abs(r.totalCost) > 0);
    if (!months.length || !paidRows.length) {
      return {
        ok: false as const,
        payload: {
          ok: false,
          error: marketCode ? 'no_rows_for_market' : 'no_marketing_traffic_rows',
          hint: 'За выбранный период/фильтр нет данных marketing_traffic. Проверь период, dataSource, market.',
          period: { from: from ?? null, to: to ?? null },
        } as Record<string, unknown>,
      };
    }
    return { ok: true as const, from, to, dataSourceFilter, marketCode, groupBy, months, convertedRows: paidRows, fx, fxError, displayOpt };
  }

  private async runMonthly(tenantId: string, objectId: string, source: SyncSource): Promise<RefreshOutcome> {
    const built = await this.buildMonthlyBreakdownData(tenantId, source.params);
    if (!built.ok) return { ok: false, error: String(built.payload.error || 'no_data'), payload: built.payload };
    const { months, convertedRows, groupBy } = built;
    const columns = this.monthlyBreakdownColumns(months, groupBy);

    const existing = await this.customObjects.listFields(tenantId, objectId);
    const byKey = new Map(existing.map((f) => [f.key, f]));
    if (!byKey.has('account') || !byKey.has('total_cost')) {
      return { ok: false, error: 'table_not_compatible', payload: { hint: 'В таблице нет колонок account/total_cost — она не создана инструментом выгрузки из маркетинга.' } };
    }
    for (const c of columns) {
      if (!byKey.has(c.key)) {
        await this.customObjects.createField(tenantId, objectId, { key: c.key, label: c.label, type: c.type, required: false, order: c.order } as any);
      }
    }
    const after = await this.customObjects.listFields(tenantId, objectId);
    const monthKeysAsc = after.filter((f) => /^m_\d{4}_\d{1,2}$/.test(f.key)).map((f) => f.key).sort();
    const desired = ['account', ...monthKeysAsc, 'total_cost', 'currency'];
    for (let i = 0; i < desired.length; i++) {
      const f = after.find((x) => x.key === desired[i]);
      if (f && f.order !== i) await this.customObjects.updateField(tenantId, objectId, f.id, { order: i } as any);
    }

    // Атомарно: старые строки заменяются новыми в одной транзакции (сбой не опустошает таблицу).
    const res = await this.customObjects.replaceSyncedRecords(
      tenantId,
      objectId,
      source.id,
      convertedRows.map((r) => ({ values: this.monthlyBreakdownRecordValues(r, months) })),
      { deleteAll: true },
    );
    return { ok: true, recordCount: res.created, extra: { months, recordsAvailable: convertedRows.length } };
  }
}
