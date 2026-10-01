import { api, API_BASE } from './client';
import type { MarketingFxRatesResponse } from './marketing';

/** Публичная ссылка «только аналитика» на таблицу рабочей области. */
export type WorkspaceShareSettings = {
  enabled: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  clientKey: string;
  updatedAt: string | null;
};

export function fetchWorkspaceShare(objectId: string) {
  return api.get<WorkspaceShareSettings>(`/custom-objects/${objectId}/share`);
}

export function saveWorkspaceShare(
  objectId: string,
  body: { enabled?: boolean; password?: string | null; expiresAt?: string | null },
) {
  return api.put<WorkspaceShareSettings>(`/custom-objects/${objectId}/share`, body);
}

export function workspaceShareUrl(clientKey: string, objectId: string) {
  return `${window.location.origin}/workspace/${encodeURIComponent(clientKey)}/${objectId}/analytics`;
}

// ---------- публичная сторона (без авторизации, без токена CRM) ----------

export class PublicShareError extends Error {
  constructor(message: string, public status: number) {
    super(message);
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
  if (!res.ok) throw new PublicShareError(data?.message || `HTTP ${res.status}`, res.status);
  return data as T;
}

export type PublicShareInfo = {
  name: string;
  companyName: string;
  requiresPassword: boolean;
  expiresAt: string | null;
};

export type PublicShareData = {
  object: { id: string; name: string };
  companyName: string;
  primaryCurrency: string | null;
  storageNamespace: string;
  layouts: Record<string, unknown>;
  fields: Array<{ key: string; label: string; type: string; options: any; order: number }>;
  records: Array<{ id: string; values: Record<string, any>; createdAt: string; updatedAt: string }>;
};

const base = (clientKey: string, objectId: string) =>
  `/public/workspace-share/${encodeURIComponent(clientKey)}/${encodeURIComponent(objectId)}`;

export function fetchPublicShareInfo(clientKey: string, objectId: string) {
  return publicRequest<PublicShareInfo>(base(clientKey, objectId));
}

export function unlockPublicShare(clientKey: string, objectId: string, password: string) {
  return publicRequest<{ token: string | null }>(`${base(clientKey, objectId)}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function fetchPublicShareData(clientKey: string, objectId: string, token: string | null) {
  return publicRequest<PublicShareData>(`${base(clientKey, objectId)}/data`, {
    headers: token ? { 'X-Share-Token': token } : {},
  });
}

export type GeocodeResponse = {
  results: Record<string, { lat: number; lon: number; name: string; countryCode: string | null } | null>;
  pending: string[];
};

/** Координаты городов/адресов для блока «Карта» (CRM, с авторизацией). */
export function geocodeWorkspaceValues(objectId: string, queries: string[], country?: string) {
  return api.post<GeocodeResponse>(`/custom-objects/${objectId}/geocode`, { queries, country });
}

export function geocodePublicShare(
  clientKey: string,
  objectId: string,
  token: string | null,
  queries: string[],
  country?: string,
) {
  return publicRequest<GeocodeResponse>(`${base(clientKey, objectId)}/geocode`, {
    method: 'POST',
    headers: token ? { 'X-Share-Token': token } : {},
    body: JSON.stringify({ queries, country }),
  });
}

/** «Отчёт на почту»: снимки блоков + ИИ-анализ + комментарий. */
export function sendAnalyticsReportEmail(
  objectId: string,
  body: {
    to: string[];
    subject?: string;
    comment?: string;
    includeAi?: boolean;
    tabName?: string;
    periodLabel?: string;
    currency?: string;
    link?: string;
    blocks: Array<{ title: string; image: string }>;
  },
) {
  return api.post<{ ok: boolean; blocks: number; results: Array<{ to: string; ok: boolean; error?: string }> }>(
    `/custom-objects/${objectId}/analytics-report-email`,
    body,
  );
}

export function fetchPublicFxRates(display: string) {
  const d = (display || 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'EUR';
  return publicRequest<MarketingFxRatesResponse>(`/marketing/public-fx-rates?display=${d}`);
}
