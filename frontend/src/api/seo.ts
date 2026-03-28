import { api } from './client';

export interface SeoSettings {
  gscPropertyUrl: string | null;
  gscConnected: boolean;
  pageSpeedApiKey: string | null;
  pageSpeedUrl: string | null;
  pageSpeedStrategy: string;
  updatedAt?: string | null;
}

export interface SeoMetricsResponse {
  gsc: {
    propertyUrl: string;
    dateFrom: string;
    dateTo: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    updatedAt: string;
  } | null;
  gscDaily?: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  gscCompare?: {
    propertyUrl: string;
    dateFrom: string;
    dateTo: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null;
  gscCompareDaily?: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  psi: {
    pageUrl: string;
    strategy: string;
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    lcp: number;
    cls: number;
    fcp: number;
    tbt: number;
    speedIndex: number;
    updatedAt: string;
  } | null;
}

export async function fetchSeoSettings(): Promise<SeoSettings> {
  return api.get<SeoSettings>('/marketing/seo/settings');
}

export async function updateSeoSettings(payload: Partial<SeoSettings>): Promise<SeoSettings> {
  return api.patch<SeoSettings>('/marketing/seo/settings', payload);
}

export async function getGoogleAuthUrl(redirect?: string): Promise<{ url: string }> {
  const qs = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
  return api.get<{ url: string }>(`/marketing/seo/google/auth-url${qs}`);
}

export async function fetchSeoMetrics(params?: {
  dateFrom?: string;
  dateTo?: string;
  compare?: boolean;
}): Promise<SeoMetricsResponse> {
  const qs = params
    ? `?${new URLSearchParams({
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
        ...(params.compare ? { compare: '1' } : {}),
      }).toString()}`
    : '';
  return api.get<SeoMetricsResponse>(`/marketing/seo/metrics${qs}`);
}

export async function syncSeo(params?: {
  dateFrom?: string;
  dateTo?: string;
  compare?: boolean;
}): Promise<{ ok: boolean; gsc: boolean; psi: boolean; gscReauthRequired: boolean }> {
  const qs = params
    ? `?${new URLSearchParams({
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
        ...(params.compare ? { compare: '1' } : {}),
      }).toString()}`
    : '';
  return api.post<{ ok: boolean; gsc: boolean; psi: boolean; gscReauthRequired: boolean }>(
    `/marketing/seo/sync${qs}`,
    {},
  );
}
