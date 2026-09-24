import { api } from './client';

export interface SeoSettings {
  gscPropertyUrl: string | null;
  gscConnected: boolean;
  /** Ключ приходит замаскированным («AIzaSy••••»); реальное значение наружу не отдаётся. */
  pageSpeedApiKey: string | null;
  pageSpeedApiKeySet?: boolean;
  /** На сервере задан общий ключ платформы — клиенту свой ключ не обязателен. */
  pageSpeedPlatformKey?: boolean;
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
  psi: SeoPsi | null;
  /** Замеры по обеим стратегиям — переключатель «Мобильный / Десктоп» работает без повторного замера. */
  psiByStrategy?: { mobile: SeoPsi | null; desktop: SeoPsi | null };
}

/** LCP / FCP / Speed Index — в секундах, TBT — в миллисекундах. */
export interface SeoPsi {
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
}

export interface SeoSyncResult {
  ok: boolean;
  gsc: boolean;
  psi: boolean;
  gscReauthRequired: boolean;
  /** Токен рабочий, но у аккаунта нет прав на выбранный ресурс, и подходящего в списке аккаунта нет. */
  gscForbidden?: boolean;
  /** Ресурсы Search Console, доступные подключённому аккаунту. */
  gscSites?: string[];
  /** Ресурс, который реально использован (мог быть подобран автоматически). */
  gscProperty?: string | null;
  /** Замер скорости шёл через Google-аккаунт, но у токена нет разрешения openid — аккаунт нужно переподключить. */
  psiNeedsReconnect?: boolean;
  /** PageSpeed Insights API выключен в Google Cloud проекте — его должен включить владелец проекта. */
  psiApiDisabled?: boolean;
  psiActivationUrl?: string;
}

export async function fetchSeoSettings(): Promise<SeoSettings> {
  return api.get<SeoSettings>('/marketing/seo/settings');
}

export async function updateSeoSettings(payload: Partial<SeoSettings>): Promise<SeoSettings> {
  return api.patch<SeoSettings>('/marketing/seo/settings', payload);
}

export interface SeoSiteOption {
  /** Ресурс GSC в том виде, в каком его надо сохранить (sc-domain:x или https://x/). */
  property: string;
  host: string;
  updatedAt: string | null;
  /** По сайту уже есть сохранённые метрики. */
  synced: boolean;
  current: boolean;
}

export async function fetchSeoSites(): Promise<{ current: string | null; sites: SeoSiteOption[] }> {
  return api.get('/marketing/seo/sites');
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
}): Promise<SeoSyncResult> {
  const qs = params
    ? `?${new URLSearchParams({
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
        ...(params.compare ? { compare: '1' } : {}),
      }).toString()}`
    : '';
  return api.post<SeoSyncResult>(
    `/marketing/seo/sync${qs}`,
    {},
  );
}
