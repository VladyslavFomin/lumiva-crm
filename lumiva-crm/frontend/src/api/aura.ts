import { API_BASE, api } from './client';

/** Aura — приложения-дашборды на живых данных CRM. Типы зеркалят backend/src/aura. */

export type AuraSourceKey = 'leads' | 'deals' | 'team' | 'calls' | 'booking' | 'stock' | 'finance' | 'marketing';
export type AuraPeriod = 'today' | '7d' | '30d' | 'quarter' | 'year';
export type AuraFilterKey = 'manager' | 'channel' | 'branch' | 'product';
export type AuraTheme = 'lumiva' | 'bento' | 'graphite' | 'swiss' | 'industry';
export type AuraDensity = 'normal' | 'compact' | 'large';
export type AuraViewer = 'me' | 'leaders' | 'team' | 'tv';
export type AuraAccess = 'private' | 'department' | 'company';
export type AuraFilters = Partial<Record<AuraFilterKey, string>>;

export type AuraCustomWidget = {
  id: string;
  title: string;
  viz: 'kpi' | 'line' | 'bar' | 'donut' | 'table';
  dataset: string;
  measure: { agg: 'count' | 'sum' | 'avg' | 'min' | 'max'; field?: string };
  filters?: Array<{ field: string; op: string; value?: unknown }>;
  groupBy?: string | null;
  limit?: number;
  lowerIsBetter?: boolean;
  dateField?: string | null;
};
export type AuraStyle = { bg?: string; surface?: string; ink?: string; accent?: string; accent2?: string; radius?: number; font?: string };
export type AuraAiError = 'provider_quota' | 'tenant_quota' | 'unavailable' | null;

export type AuraConfig = {
  prompt?: string;
  sources: AuraSourceKey[];
  widgets: string[];
  period: AuraPeriod;
  breakdown: AuraFilterKey[];
  goals?: { team_goal?: number | null };
  viewer?: AuraViewer | null;
  custom?: AuraCustomWidget[];
  style?: AuraStyle | null;
};

export type AuraFormat = 'int' | 'money' | 'pct' | 'num';
export type AuraDelta = { kind: 'pct' | 'pp'; value: number } | null;
export type AuraWidgetData =
  | { type: 'kpi'; value: number | null; format: AuraFormat; unit?: 'pcs'; delta: AuraDelta; good: boolean | null; spark: number[] | null }
  | { type: 'line'; format: AuraFormat; current: number[]; previous: number[]; total: number; prevTotal: number }
  | { type: 'donut'; format: AuraFormat; items: Array<{ key?: string; name: string; value: number }> }
  | { type: 'funnel'; steps: Array<{ key: string; value: number }> }
  | { type: 'table'; cols: Array<{ key: string; kind: 'text' | 'person' | 'chip' | 'money' | 'int' | 'pct' | 'days' }>; rows: Array<Record<string, string | number | null>> }
  | { type: 'bar'; format: AuraFormat; unit?: 'pcs'; people?: boolean; items: Array<{ name: string; value: number }> }
  | { type: 'col'; labels: number[]; data: number[] }
  | { type: 'col2'; format: AuraFormat; labels: string[]; a: number[]; b: number[] }
  | { type: 'heat'; hours: number[]; values: number[][] }
  | { type: 'list'; items: Array<{ kind: string; n?: number; pct?: number; name?: string }> }
  | { type: 'goal'; target: number | null; done: number; pct: number | null; daysLeft: number };
export type AuraWidgetResult = AuraWidgetData | { error: 'denied' | 'amounts_hidden' | 'failed' };

export type AuraData = {
  period: { key: AuraPeriod; from: string; to: string; granularity: 'hour' | 'day' | 'week' | 'month'; labels: string[] };
  currency: string;
  generatedAt: string;
  own: boolean;
  widgets: Record<string, AuraWidgetResult>;
  filterOptions: Partial<Record<AuraFilterKey, Array<{ id: string; name: string }>>>;
};

export type AuraShare = { enabled: boolean; hasPassword: boolean; expiresAt: string | null; shareKey: string };

export type AuraApp = {
  id: string;
  name: string;
  theme: AuraTheme;
  density: AuraDensity;
  kiosk: boolean;
  config: AuraConfig;
  access: AuraAccess;
  showInMenu: boolean;
  refreshSec: number;
  ownerName: string | null;
  isMine: boolean;
  canEdit: boolean;
  share: AuraShare;
  createdAt: string;
  updatedAt: string;
};

export type AuraAppInput = Partial<Pick<AuraApp, 'name' | 'theme' | 'density' | 'kiosk' | 'config' | 'access' | 'showInMenu' | 'refreshSec'>>;

export type AuraEditOp = { op: string; widget?: string | { id: string; title: string }; value?: unknown; index?: number };

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** Пункты меню Aura в сайдбаре нужно перечитать (сохранили/удалили приложение). */
export const AURA_MENU_CHANGED_EVENT = 'lumiva-aura-menu-changed';

export const auraApi = {
  list: () => api.get<AuraApp[]>('/aura/apps'),
  menu: () => api.get<Array<{ id: string; name: string; kiosk: boolean }>>('/aura/apps/menu'),
  get: (id: string) => api.get<AuraApp>(`/aura/apps/${id}`),
  create: (body: AuraAppInput) => api.post<AuraApp>('/aura/apps', body),
  update: (id: string, body: AuraAppInput) => api.patch<AuraApp>(`/aura/apps/${id}`, body),
  remove: (id: string) => api.delete<{ ok: true }>(`/aura/apps/${id}`),
  duplicate: (id: string, name?: string) => api.post<AuraApp>(`/aura/apps/${id}/duplicate`, { name }),
  appData: (id: string, period?: AuraPeriod, filters?: AuraFilters) =>
    api.get<AuraData>(`/aura/apps/${id}/data`, {
      params: { ...(period ? { period } : {}), ...(filters && Object.keys(filters).length ? { filters: JSON.stringify(filters) } : {}), tz: tz() },
    }),
  previewData: (config: Partial<AuraConfig>, period?: AuraPeriod, filters?: AuraFilters) =>
    api.post<AuraData>('/aura/data', { config, period, filters, tz: tz() }),
  getShare: (id: string) => api.get<AuraShare>(`/aura/apps/${id}/share`),
  saveShare: (id: string, body: { enabled?: boolean; password?: string | null; expiresAt?: string | null; regenerate?: boolean }) =>
    api.put<AuraShare>(`/aura/apps/${id}/share`, body),
  brief: (prompt: string, lang: string) =>
    api.post<{ sources: AuraSourceKey[]; widgets: string[]; period: AuraPeriod; breakdown: AuraFilterKey[]; viewer: AuraViewer | null; title: string; custom: AuraCustomWidget[]; ai: boolean; aiError: AuraAiError }>(
      '/aura/ai/brief',
      { prompt, lang },
      { timeout: 60_000 },
    ),
  answer: (questionId: string, text: string, options: string[]) =>
    api.post<{ values: string[]; ai: boolean; aiError: AuraAiError }>('/aura/ai/answer', { questionId, text, options }, { timeout: 60_000 }),
  edit: (body: { config: AuraConfig; theme: AuraTheme; density: AuraDensity; title: string; message: string; lang: string }) =>
    api.post<{ config: AuraConfig; theme: AuraTheme; density: AuraDensity; title: string; applied: AuraEditOp[]; fresh: string | null; reply: string | null; ai: boolean; aiError: AuraAiError }>(
      '/aura/ai/edit',
      body,
      { timeout: 60_000 },
    ),
};

export function auraShareUrl(shareKey: string) {
  return `${window.location.origin}/aura/tv/${encodeURIComponent(shareKey)}`;
}

/* ---------- публичная сторона (без токена CRM) ---------- */

export class AuraPublicError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new AuraPublicError(data?.message || `HTTP ${res.status}`, res.status);
  return data as T;
}

export type AuraPublicInfo = { name: string; companyName: string; requiresPassword: boolean; theme: AuraTheme };
export type AuraPublicData = {
  app: { name: string; theme: AuraTheme; density: AuraDensity; refreshSec: number; config: AuraConfig; companyName: string };
  data: AuraData;
};

export const auraPublicApi = {
  info: (key: string) => publicRequest<AuraPublicInfo>(`/public/aura/${encodeURIComponent(key)}`),
  unlock: (key: string, password: string) =>
    publicRequest<{ token: string | null }>(`/public/aura/${encodeURIComponent(key)}/unlock`, { method: 'POST', body: JSON.stringify({ password }) }),
  data: (key: string, token: string | null, period?: AuraPeriod, filters?: AuraFilters) => {
    const qs = new URLSearchParams({ tz: tz() });
    if (period) qs.set('period', period);
    if (filters && Object.keys(filters).length) qs.set('filters', JSON.stringify(filters));
    return publicRequest<AuraPublicData>(`/public/aura/${encodeURIComponent(key)}/data?${qs}`, {
      headers: token ? { 'X-Share-Token': token } : {},
    });
  },
};
