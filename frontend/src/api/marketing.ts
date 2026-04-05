import { api } from './client';

export type MarketingTrafficProviderBreakdown = {
  dataSource: string;
  rowCount: number;
  sessions: number;
  clicks: number;
  leads: number;
  revenue: number;
  impressions: number;
  cost: number;
  currency: string;
};

export type MarketingTrafficStats = {
  from: string | null;
  to: string | null;
  currency: string;
  totalSessions: number;
  totalLeads: number;
  totalRevenue: number;
  totalClicks: number;
  totalImpressions: number;
  totalCost: number;
  totalRows: number;
  dataSources: string[];
  providerBreakdown: MarketingTrafficProviderBreakdown[];
  items: Array<{
    dataSource: string | null;
    source: string | null;
    medium: string | null;
    campaign: string | null;
    sessions: number;
    clicks: number;
    leads: number;
    revenue: number;
    impressions: number;
    cost: number;
  }>;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function aggregateItemsToProviderBreakdown(
  items: MarketingTrafficStats['items'],
  currency: string,
): MarketingTrafficProviderBreakdown[] {
  if (!items.length) return [];
  const m = new Map<string, MarketingTrafficProviderBreakdown>();
  for (const it of items) {
    const dsRaw = it.dataSource?.trim();
    const ds = dsRaw && dsRaw !== '' ? dsRaw : 'unknown';
    const p =
      m.get(ds) ??
      ({
        dataSource: ds,
        rowCount: 0,
        sessions: 0,
        clicks: 0,
        leads: 0,
        revenue: 0,
        impressions: 0,
        cost: 0,
        currency,
      } satisfies MarketingTrafficProviderBreakdown);
    p.rowCount += 1;
    p.sessions += it.sessions || 0;
    p.clicks += it.clicks || 0;
    p.leads += it.leads || 0;
    p.revenue += it.revenue || 0;
    p.impressions += it.impressions || 0;
    p.cost += it.cost || 0;
    m.set(ds, p);
  }
  return [...m.values()].sort((a, b) => a.dataSource.localeCompare(b.dataSource));
}

/**
 * Шлюзы часто отдают цепочки вроде `{ data: { data: { items, providerBreakdown } } }`
 * или `{ body: { result: { ... } } }` — проходим по известным полям, пока не найдём полезную форму.
 */
function parseJsonIfString(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    const once = JSON.parse(raw) as unknown;
    if (typeof once === 'string') {
      try {
        return JSON.parse(once) as unknown;
      } catch {
        return once;
      }
    }
    return once;
  } catch {
    return raw;
  }
}

/** Следующий слой обёртки (data/payload/…); строки пробуем как JSON. */
function pickNestedEnvelope(o: Record<string, unknown>): unknown {
  for (const key of [
    'data',
    'payload',
    'result',
    'body',
    'response',
    'json',
    'value',
  ]) {
    const v = parseJsonIfString(o[key]);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  }
  return undefined;
}

/** GET /marketing/integrations может прийти как массив или как { data: [...] } (прокси). */
function deepUnwrapToArray(raw: unknown): unknown[] {
  let cur: unknown = parseJsonIfString(raw);
  for (let depth = 0; depth < 14; depth++) {
    cur = parseJsonIfString(cur);
    if (Array.isArray(cur)) return cur;
    if (!cur || typeof cur !== 'object') return [];
    const o = cur as Record<string, unknown>;
    const asList = o.items ?? o.integrations ?? o.rows ?? o.results ?? o.list;
    if (Array.isArray(asList)) return asList;
    const nested = pickNestedEnvelope(o);
    if (nested === undefined) return [];
    cur = nested;
  }
  return [];
}

function unwrapTrafficPayload(raw: unknown): Record<string, unknown> {
  let cur: unknown = parseJsonIfString(raw);
  for (let depth = 0; depth < 14; depth++) {
    cur = parseJsonIfString(cur);
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return {};
    const o = cur as Record<string, unknown>;
    const looksLikeTraffic =
      Array.isArray(o.items) ||
      Array.isArray(o.providerBreakdown) ||
      Array.isArray(o.provider_breakdown) ||
      o.totalRows != null ||
      o.total_rows != null ||
      o.totalSessions != null ||
      o.total_sessions != null;
    if (looksLikeTraffic) return o;
    const named = o.traffic ?? o.stats ?? o.report ?? o.channelStats ?? o.channelsStats;
    if (named && typeof named === 'object' && !Array.isArray(named)) {
      cur = named;
      continue;
    }
    const nested = pickNestedEnvelope(o);
    if (nested === undefined) return o;
    cur = nested;
  }
  return cur && typeof cur === 'object' && !Array.isArray(cur)
    ? (cur as Record<string, unknown>)
    : {};
}

/** Шлюз / старые клиенты могут отдавать snake_case — приводим к одному виду. */
export function normalizeMarketingTrafficStats(raw: unknown): MarketingTrafficStats {
  const r = unwrapTrafficPayload(raw);
  const pick = <T>(camel: string, snake: string): T | undefined =>
    (r[camel] ?? r[snake]) as T | undefined;

  let currency = String(r.currency ?? 'EUR').slice(0, 8) || 'EUR';

  const itemsRaw = pick<unknown[]>('items', 'items');
  const items: MarketingTrafficStats['items'] = [];
  if (Array.isArray(itemsRaw)) {
    for (const x of itemsRaw) {
      const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
      const dsRaw = o.dataSource ?? o.data_source;
      items.push({
        dataSource: dsRaw != null && String(dsRaw).trim() !== '' ? String(dsRaw) : null,
        source: o.source != null ? String(o.source) : null,
        medium: o.medium != null ? String(o.medium) : null,
        campaign: o.campaign != null ? String(o.campaign) : null,
        sessions: num(o.sessions),
        clicks: num(o.clicks),
        leads: num(o.leads),
        revenue: num(o.revenue),
        impressions: num(o.impressions),
        cost: num(o.cost),
      });
    }
  }

  const dsRaw = pick<unknown[]>('dataSources', 'data_sources');
  const dataSources = Array.isArray(dsRaw) ? dsRaw.map((x) => String(x)) : [];

  const pbRaw = pick<unknown[]>('providerBreakdown', 'provider_breakdown');
  let providerBreakdown: MarketingTrafficProviderBreakdown[] = [];
  if (Array.isArray(pbRaw)) {
    providerBreakdown = pbRaw.map((x) => {
      const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
      const ds = String(o.dataSource ?? o.data_source ?? 'unknown');
      const rowCurrency = String(o.currency ?? currency).slice(0, 8) || currency;
      return {
        dataSource: ds,
        rowCount: num(o.rowCount ?? o.row_count),
        sessions: num(o.sessions),
        clicks: num(o.clicks),
        leads: num(o.leads),
        revenue: num(o.revenue),
        impressions: num(o.impressions),
        cost: num(o.cost),
        currency: rowCurrency,
      };
    });
  }

  if (!providerBreakdown.length) {
    providerBreakdown = aggregateItemsToProviderBreakdown(items, currency);
  }

  let totalRows = num(pick('totalRows', 'total_rows'));
  if (!totalRows && providerBreakdown.length) {
    totalRows = providerBreakdown.reduce((s, p) => s + p.rowCount, 0);
  }

  return {
    from: (pick('from', 'from') as string | null | undefined) ?? null,
    to: (pick('to', 'to') as string | null | undefined) ?? null,
    currency,
    totalSessions: num(pick('totalSessions', 'total_sessions')),
    totalLeads: num(pick('totalLeads', 'total_leads')),
    totalRevenue: num(pick('totalRevenue', 'total_revenue')),
    totalClicks: num(pick('totalClicks', 'total_clicks')),
    totalImpressions: num(pick('totalImpressions', 'total_impressions')),
    totalCost: num(pick('totalCost', 'total_cost')),
    totalRows,
    dataSources,
    providerBreakdown,
    items,
  };
}

export async function fetchMarketingTraffic(params?: {
  from?: string;
  to?: string;
  dataSource?: string;
}): Promise<MarketingTrafficStats> {
  const qs = params
    ? `?${new URLSearchParams({
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
        ...(params.dataSource ? { dataSource: params.dataSource } : {}),
      }).toString()}`
    : '';
  const raw = await api.get<unknown>(`/marketing/traffic${qs}`);
  return normalizeMarketingTrafficStats(raw);
}

export interface MarketingUtmTemplate {
  id: string;
  tenantId: string;
  name: string;
  baseUrl: string | null;
  channelType: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  meta: unknown;
  createdAt: string;
  updatedAt: string;
}

export async function fetchUtmTemplates(): Promise<MarketingUtmTemplate[]> {
  return api.get<MarketingUtmTemplate[]>('/marketing/utm-templates');
}

export async function createUtmTemplate(payload: {
  name: string;
  baseUrl?: string;
  channelType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}): Promise<MarketingUtmTemplate> {
  return api.post<MarketingUtmTemplate>('/marketing/utm-templates', payload);
}

export async function deleteUtmTemplate(id: string): Promise<void> {
  await api.delete(`/marketing/utm-templates/${id}`);
}

export type LeadSegmentFilters = {
  statuses?: string[];
  sources?: string[];
  countries?: string[];
  managers?: string[];
  createdFrom?: string;
  createdTo?: string;
};

export interface MarketingSegment {
  id: string;
  entityType: string;
  name: string;
  description: string | null;
  leadStatuses: string[] | null;
  source: string | null;
  country: string | null;
  manager: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  lastMatchedCount: number;
  lastRunAt: string | null;
  createdAt: string;
}

export async function fetchSegments(): Promise<MarketingSegment[]> {
  return api.get<MarketingSegment[]>('/marketing/segments');
}

export async function createSegment(payload: {
  entityType: string;
  name: string;
  description?: string;
  filters?: LeadSegmentFilters;
}): Promise<MarketingSegment> {
  return api.post<MarketingSegment>('/marketing/segments', payload);
}

export async function runSegment(id: string): Promise<unknown[]> {
  return api.post<unknown[]>(`/marketing/segments/${id}/run`, {});
}

export type MarketingIntegrationRow = {
  id: string;
  tenantId: string;
  provider: string;
  kind: string;
  name: string;
  isActive: boolean;
  primaryId: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchMarketingIntegrations(): Promise<
  MarketingIntegrationRow[]
> {
  const raw = await api.get<unknown>('/marketing/integrations');
  const rows = deepUnwrapToArray(raw);
  return rows as MarketingIntegrationRow[];
}

export type MarketingIntegrationSyncResult = {
  ok: boolean;
  /** Сколько строк записано в marketing_traffic за этот прогон (0 = API без строк или пустой период). */
  rowsSaved: number;
};

function readRowsSavedFromObject(o: Record<string, unknown>): number | undefined {
  const candidates = [
    o.rowsSaved,
    o.rows_saved,
    o.syncedRows,
    o.synced_rows,
    o.saved,
    o.inserted,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (c != null && c !== '' && Number.isFinite(Number(c))) return Number(c);
  }
  const text = [o.message, o.syncSummary].find((x) => typeof x === 'string') as
    | string
    | undefined;
  if (text) {
    const m =
      text.match(/строк[а-яё]*\s*:\s*(\d+)/i) ||
      text.match(/rows?\s*:\s*(\d+)/i) ||
      text.match(/:\s*(\d+)\s*$/);
    if (m?.[1] && Number.isFinite(Number(m[1]))) return Number(m[1]);
  }
  return undefined;
}

function unwrapIntegrationSyncPayload(raw: unknown): Record<string, unknown> {
  let cur: unknown = parseJsonIfString(raw);
  for (let depth = 0; depth < 14; depth++) {
    cur = parseJsonIfString(cur);
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return {};
    const o = cur as Record<string, unknown>;
    const found = readRowsSavedFromObject(o);
    if (found !== undefined) {
      return { ...o, rowsSaved: found };
    }
    const nested = pickNestedEnvelope(o);
    if (nested === undefined) return o;
    cur = nested;
  }
  return {};
}

export async function syncMarketingIntegration(
  id: string,
): Promise<MarketingIntegrationSyncResult> {
  const raw = await api.post<unknown>(`/marketing/integrations/${id}/sync`, {});
  const o = unwrapIntegrationSyncPayload(raw);
  const parsed = readRowsSavedFromObject(o);
  const n = parsed !== undefined && Number.isFinite(parsed) ? parsed : 0;
  return { ok: o.ok !== false, rowsSaved: n };
}

export type CreateMarketingIntegrationBody = {
  provider: string;
  kind?: string;
  name: string;
  isActive?: boolean;
  primaryId?: string;
  ga4ServiceAccountJson?: string;
  settings?: Record<string, unknown>;
};

export async function createMarketingIntegration(
  body: CreateMarketingIntegrationBody,
): Promise<MarketingIntegrationRow> {
  return api.post<MarketingIntegrationRow>('/marketing/integrations', body);
}

export async function deleteMarketingIntegration(id: string): Promise<void> {
  await api.delete(`/marketing/integrations/${id}`);
}

export async function fetchMarketingApiToken(): Promise<string> {
  const res = await api.get<{ token: string }>('/api-tokens/marketing');
  return res.token;
}

export async function regenerateMarketingApiToken(): Promise<string> {
  const res = await api.post<{ token: string }>(
    '/api-tokens/marketing/regenerate',
    {},
  );
  return res.token;
}
