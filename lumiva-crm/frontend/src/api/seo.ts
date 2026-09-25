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

// ---------------------------------------------------------------- ИИ-SEO-ассистент

export interface SeoAiAgent {
  enabled: boolean;
  siteUrl: string | null;
  pages: string[];
  keywords: string[];
  recipients: string[];
  /** 0 = воскресенье … 6 = суббота */
  weekday: number;
  hour: number;
  timezone: string;
  language: 'ru' | 'en' | 'tr' | string;
  focus: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  /** Задачи из рекомендаций (действия ИИ SEO-менеджера). */
  tasksEnabled: boolean;
  /** Проект для задач; null — создаётся «SEO · сайт» при первой задаче. */
  taskProjectId: string | null;
  /** Ответственный (id сотрудника из раздела «Сотрудники»). */
  taskAssigneeId: string | null;
  /** Сигналы о проблемах: уведомление + письмо + срочная задача. */
  alertsEnabled: boolean;
  /** Ключи сигналов, о которых сообщено и которые ещё не решены. */
  activeAlerts: string[];
  lastCheckAt: string | null;
}

export type SeoAiStage = 'queued' | 'sync' | 'gsc' | 'crawl' | 'psi' | 'ai';

export interface SeoAiReportSummary {
  id: string;
  siteUrl: string;
  trigger: 'manual' | 'schedule' | string;
  status: 'running' | 'done' | 'failed';
  stage: SeoAiStage | null;
  score: number | null;
  error: string | null;
  emailedTo: string[];
  finishedAt: string | null;
  createdAt: string;
}

export interface SeoAiIssue {
  code: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SeoAiPageAudit {
  url: string;
  finalUrl: string | null;
  source: 'home' | 'custom' | 'gsc' | 'sitemap';
  status: number | null;
  ms: number | null;
  error: string | null;
  title: string | null;
  description: string | null;
  h1: string[];
  wordCount: number;
  images: number;
  imagesNoAlt: number;
  jsonLdTypes: string[];
  issues: SeoAiIssue[];
}

export interface SeoAiQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevPosition?: number;
  change?: number;
}

export interface SeoAiTotals {
  clicks: number;
  impressions: number;
  /** в процентах */
  ctr: number;
  position: number;
}

export interface SeoAiFacts {
  siteUrl: string;
  host: string;
  generatedAt: string;
  techScore: number;
  site: {
    origin: string;
    https: boolean;
    robotsTxt: { found: boolean; disallowAll: boolean; sitemaps: string[] };
    sitemap: { found: boolean; url: string | null; urlCount: number };
    issues: SeoAiIssue[];
  };
  pages: SeoAiPageAudit[];
  gsc: {
    property: string;
    week: SeoAiTotals;
    prevWeek: SeoAiTotals;
    month: SeoAiTotals;
    prevMonth: SeoAiTotals;
    topQueries: SeoAiQueryRow[];
    strikingDistance: SeoAiQueryRow[];
    lowCtr: SeoAiQueryRow[];
    movers: SeoAiQueryRow[];
    newQueries: SeoAiQueryRow[];
    topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
    trackedKeywords: Array<{
      keyword: string;
      matchedQuery: string | null;
      position: number | null;
      prevPosition: number | null;
      clicks: number;
      impressions: number;
    }>;
  } | null;
  gscNote: 'otherProperty' | 'notConnected' | null;
  psi: {
    mobile: SeoPsi | null;
    desktop: SeoPsi | null;
    audits: Array<{ id: string; category: string; title: string; displayValue: string | null; score: number; savingsMs: number | null }>;
  };
}

export interface SeoAiRecommendation {
  priority: 'high' | 'medium' | 'low';
  area: 'technical' | 'content' | 'keywords' | 'performance' | 'links' | 'ux';
  title: string;
  why: string;
  how: string;
  page: string | null;
  effort: 'low' | 'medium' | 'high';
}

export interface SeoAiReportBody {
  score: number;
  summary: string;
  wins: string[];
  risks: string[];
  recommendations: SeoAiRecommendation[];
  keywordOpportunities: Array<{ query: string; position: number | null; impressions: number | null; action: string }>;
  contentIdeas: Array<{ title: string; targetQuery: string; why: string }>;
  pageNotes: Array<{ url: string; score: number; notes: string[] }>;
  nextWeekFocus: string[];
  /** Модель, которой подготовлен отчёт (нет у старых отчётов). */
  model?: string | null;
  /** Задачи, созданные по рекомендациям этого отчёта. */
  tasks?: Array<{ title: string; status: 'executed' | 'pending' | 'failed' | 'skipped' | string; reason?: string; actionId?: string; projectId?: string | null }>;
  /** Сигналы, поднятые по этому отчёту. */
  alerts?: Array<{ key: string; code: string; severity: string; url?: string; keyword?: string; from?: number | null; to?: number | null; pct?: number }>;
}

export interface SeoAiReport extends SeoAiReportSummary {
  facts: SeoAiFacts | null;
  report: SeoAiReportBody | null;
}

/** site — ресурс, выбранный на странице SEO: у каждого сайта свой ассистент и своя история. */
const siteQs = (site?: string | null) => (site ? `?site=${encodeURIComponent(site)}` : '');
export const fetchSeoAiAgent = (site?: string | null) => api.get<SeoAiAgent>(`/marketing/seo/ai/agent${siteQs(site)}`);
export const updateSeoAiAgent = (site: string | null | undefined, patch: Partial<SeoAiAgent>) =>
  api.patch<SeoAiAgent>(`/marketing/seo/ai/agent${siteQs(site)}`, patch);
export const fetchSeoAiReports = (site?: string | null) => api.get<SeoAiReportSummary[]>(`/marketing/seo/ai/reports${siteQs(site)}`);
export const fetchSeoAiReport = (id: string) => api.get<SeoAiReport>(`/marketing/seo/ai/reports/${id}`);
export const deleteSeoAiReport = (id: string) => api.delete<{ ok: boolean }>(`/marketing/seo/ai/reports/${id}`);
export const runSeoAi = (site: string | null | undefined, email = false) =>
  api.post<SeoAiReportSummary>(`/marketing/seo/ai/run${siteQs(site)}`, { email });
export const emailSeoAiReport = (id: string) =>
  api.post<{ ok: boolean; emailedTo: string[] }>(`/marketing/seo/ai/reports/${id}/email`, {});

/** ИИ-SEO доступен только при активном ИИ-сотруднике «SEO-менеджер» (занимает слот лимита ИИ-сотрудников). */
export interface SeoAiAccess {
  allowed: boolean;
  employee: {
    id: string;
    name: string;
    status: 'active' | 'paused' | 'disabled' | 'setup_required' | string;
    avatarUrl: string | null;
    /** suggest — «Режим предложений»: задачи не создаются. */
    autonomyMode?: 'suggest' | 'assisted' | 'auto' | string;
  } | null;
  planAllowed: boolean;
  limit: number | null;
  used: number;
  canHire: boolean;
}
export const fetchSeoAiAccess = () => api.get<SeoAiAccess>('/marketing/seo/ai/access');
