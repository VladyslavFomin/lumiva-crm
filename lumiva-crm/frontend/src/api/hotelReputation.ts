// src/api/hotelReputation.ts — Отели → Отзывы (репутация)
import { api } from './client';

export type RepPlatform = 'google' | 'holidaycheck' | 'tripadvisor' | 'yandex' | 'expedia' | 'check24' | 'otelpuan' | 'booking';
export const REP_PLATFORMS: RepPlatform[] = ['google', 'holidaycheck', 'tripadvisor', 'yandex', 'expedia', 'check24', 'otelpuan', 'booking'];
export type ReplyMode = 'api' | 'external' | 'none';
export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface RepTopicTag { topic: string; label: string | null; sentiment: Sentiment; quote?: string | null }

export interface RepReviewRow {
  id: string;
  hotelId: string;
  platform: RepPlatform;
  author: string | null;
  authorPhoto: string | null;
  lang: string | null;
  title: string | null;
  text: string | null;
  textTranslated: string | null;
  ratingRaw: number | null;
  ratingScale: number | null;
  rating10: number | null;
  publishedAt: string | null;
  travelDate: string | null;
  status: 'active' | 'edited' | 'deleted';
  sentiment: Sentiment | null;
  hasReply: boolean;
  repliedAt: string | null;
  replyMode: ReplyMode;
  urgent: boolean;
  draftReady: boolean;
  draftByAgent: boolean;
  topics: RepTopicTag[];
  reviewUrl: string | null;
}

export interface RepReviewCard extends RepReviewRow {
  translatedLang: string | null;
  translateTo?: 'ru' | 'en';
  subRatings: Record<string, number> | null;
  replyText: string | null;
  replyMarkedManually: boolean;
  aiDraft: string | null;
  aiDraftBy: { id: string; name: string; avatarUrl: string | null } | null;
  reviewsAgent: { id: string; name: string; avatarUrl: string | null } | null;
  analysisError: string | null;
  deletedAt: string | null;
  hotel: { id: string; name: string; city: string | null; brandId: string | null } | null;
  sourceUrl: string | null;
  replyHome: string | null;
  replyApiReady: boolean;
  versions: Array<{ rating10: number | null; ratingRaw: number | null; text: string | null; capturedAt: string }>;
  replies: Array<{ id: string; text: string; source: 'crm' | 'platform' | 'manual'; status: string; error: string | null; postedAt: string | null; createdAt: string; author: string | null }>;
}

export interface RepAiStatus { pending: number; failed: number; lastError: string | null }
export interface RepFeed { total: number; offset: number; limit: number; unansweredNegative: number; ai?: RepAiStatus; items: RepReviewRow[] }
export const fetchRepAiStatus = () => api.get<RepAiStatus>('/hotel-reputation/ai-status');

export interface RepFeedQuery {
  brandId?: string; hotelId?: string; platform?: string; from?: string; to?: string; ratingMin?: string; ratingMax?: string;
  lang?: string; topic?: string; reply?: string; sentiment?: string; status?: string; q?: string; sort?: string; offset?: number; limit?: number;
}

const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const fetchRepFeed = (q: RepFeedQuery) => api.get<RepFeed>(`/hotel-reputation/reviews${qs(q as any)}`);
export const fetchRepLanguages = () => api.get<Array<{ lang: string; n: number }>>('/hotel-reputation/reviews-languages');
export const fetchRepReview = (id: string) => api.get<RepReviewCard>(`/hotel-reputation/reviews/${id}`);
export const draftRepReply = (id: string, tone?: string) => api.post<{ aiDraft: string }>(`/hotel-reputation/reviews/${id}/draft`, { tone });
export const sendRepReply = (id: string, text: string) => api.post<RepReviewCard>(`/hotel-reputation/reviews/${id}/reply`, { text });
export const markRepReplied = (id: string, replied: boolean, text?: string) => api.post<RepReviewCard>(`/hotel-reputation/reviews/${id}/mark-replied`, { replied, text });
export const reanalyzeRepReview = (id: string) => api.post<RepReviewCard>(`/hotel-reputation/reviews/${id}/reanalyze`, {});
export const translateRepReview = (id: string) => api.post<RepReviewCard>(`/hotel-reputation/reviews/${id}/translate`, {});
export const retryRepReply = (id: string) => api.post<RepReviewCard>(`/hotel-reputation/replies/${id}/retry`, {});

// ---------------------------------------------------------------- аналитика

export interface RepKpis {
  count: number; avg10: number | null; negativeShare: number | null; responseRate: number | null; medianReplyHours: number | null; reputationIndex: number | null;
  delta?: { avg10: number | null; count: number; negativeShare: number | null; responseRate: number | null; medianReplyHours: number | null; reputationIndex: number | null };
}
export interface RepTopicStat { topic: string; label: string; isOther: boolean; negative: number; positive: number; neutral: number; prevNegative: number; negQuotes: string[]; posQuotes: string[] }
export interface RepHotelStat {
  hotelId: string; name: string; brandId: string | null; brand: string | null; count: number; avg10: number | null; prevAvg10: number | null; delta: number | null;
  reputationIndex: number | null; negativeShare: number | null; responseRate: number | null; medianReplyHours: number | null; openNegative: number;
  topComplaint: { topic: string; label: string; count: number } | null;
}
export interface RepDashboard {
  period: { from: string; to: string };
  kpis: RepKpis;
  byPlatform: Array<{ platform: RepPlatform; count: number; avg10: number | null; negativeShare: number | null; responseRate: number | null; platformCount: number | null; platformRating: number | null }>;
  sources: Array<{ platform: RepPlatform; platformCount: number | null; inCrm: number; lastSuccessAt: string | null; failing: number }>;
  byHotel: RepHotelStat[];
  series: { granularity: 'day' | 'week' | 'month'; points: RepSeriesPoint[] };
  distribution: Array<{ bucket: number; n: number }>;
  complaints: RepTopicStat[];
  praises: RepTopicStat[];
  otherTopics: RepTopicStat[];
  managers: Array<{ userId: string; name: string | null; replies: number; medianReplyHours: number | null }>;
}
export interface RepSeriesPoint { bucket: string; count: number; avg10: number | null; negativeShare: number | null }
export interface RepAnalyticsQuery { brandId?: string; hotelId?: string; platform?: string; from?: string; to?: string; all?: string }
export const fetchRepDashboard = (q: RepAnalyticsQuery) => api.get<RepDashboard>(`/hotel-reputation/analytics/dashboard${qs(q as any)}`);
export const fetchRepTopicMatrix = (q: RepAnalyticsQuery) =>
  api.get<{ topics: Array<{ topic: string; label: string }>; hotels: Array<{ hotelId: string; name: string; cells: Array<{ topic: string; negative: number; positive: number; negativePct: number }> }> }>(
    `/hotel-reputation/analytics/topic-matrix${qs(q as any)}`,
  );
export interface RepMonthlyReport {
  month: string; brand: { id: string; name: string } | null; brandHotels: number | null; kpis: RepKpis; prev: RepKpis; topComplaints: RepTopicStat[];
  hotels: Array<RepHotelStat & { prevIndex: number | null; indexDelta: number | null }>; droppedHotels: RepHotelStat[]; series: RepDashboard['series']; summary: string | null;
}
export const fetchRepMonthlyReport = (brandId: string | null, month: string) =>
  api.get<RepMonthlyReport>(`/hotel-reputation/analytics/monthly-report${qs({ brandId, month })}`);

// ---------------------------------------------------------------- настройки

export interface RepRecipients { emails: string[]; telegram: string[]; userIds: string[] }
export type RepAlertKind = 'negative' | 'no_reply' | 'rating_lowered' | 'avg_drop' | 'topic_spike' | 'sync_problem';
export interface RepConfig {
  thresholds: { negativeBelow: number; noReplyHours: number; ratingDropPoints: number; topicRepeatCount: number; topicRepeatDays: number; staleDays: number; countDriftPct: number };
  alerts: Record<RepAlertKind, boolean>;
  schedule: { holidaycheckMinutes: number; apifyHours: number; otelpuanHours: number; offSeason: boolean; maxPerRun: number; firstLoadMax: number; maxConcurrentRuns: number };
  translateTo: 'ru' | 'en';
  telegramBotId: string | null;
  recipients: { developer: RepRecipients; brands: Record<string, RepRecipients>; hotels: Record<string, RepRecipients> };
  signatures: Record<string, string>;
  apifyActors: Record<string, { primary: string; fallback: string; input: string; everyHours: number; firstLoadMax: number; maxPerRun: number }>;
  google: { accountName: string | null; accountEmail: string | null; pubsubTopic: string | null; notificationsOk: boolean; notificationsError: string | null; connectedAt: string | null };
  holidaycheck: { replyUrlTemplate: string; method: 'POST' | 'PUT'; authHeader: string; authPrefix: string; bodyField: string };
  topicsExtra: Array<{ key: string; label: string }>;
  monthlyReport: { enabled: boolean };
  apifyPause: { reason: string | null; at: string | null };
  historyFrom: string | null;
}
export interface RepSettings {
  config: RepConfig;
  apifyToken: string | null;
  googleConnected: boolean;
  pushEndpoint: string | null;
  telegramBots: Array<{ id: string; name: string; recipients: Array<{ id: string; name: string }> }>;
  telegramBotOk: boolean;
}
export const fetchRepSettings = () => api.get<RepSettings>('/hotel-reputation/settings');
export const updateRepSettings = (body: Partial<RepConfig> & { apifyToken?: string | null }) => api.patch<RepSettings>('/hotel-reputation/settings', body);

export interface RepSource {
  id: string; hotelId: string; platform: RepPlatform; externalId: string | null; url: string | null; apiKey: string | null; active: boolean;
  lastSyncAt: string | null; lastSuccessAt: string | null; lastNewAt: string | null; lastError: string | null; platformRating: number | null; platformCount: number | null;
  useFallback: boolean; replyMode: ReplyMode; backfillMax: number | null;
}
export interface RepBrand { id: string; name: string; color: string | null }
export interface RepSetup { brands: RepBrand[]; hotels: Array<{ id: string; name: string; city: string | null; brandId: string | null; sources: RepSource[] }> }
export const fetchRepSetup = () => api.get<RepSetup>('/hotel-reputation/setup');
export const createRepBrand = (name: string, color?: string | null) => api.post<RepBrand>('/hotel-reputation/brands', { name, color });
export const updateRepBrand = (id: string, name: string, color?: string | null) => api.patch<RepBrand>(`/hotel-reputation/brands/${id}`, { name, color });
export const deleteRepBrand = (id: string) => api.delete<{ ok: boolean }>(`/hotel-reputation/brands/${id}`);
export const setRepHotelBrand = (hotelId: string, brandId: string | null) => api.patch<{ ok: boolean }>(`/hotel-reputation/hotels/${hotelId}/brand`, { brandId });
export const upsertRepSource = (hotelId: string, platform: RepPlatform, body: { url?: string | null; externalId?: string | null; apiKey?: string | null; active?: boolean }) =>
  api.put<RepSource>(`/hotel-reputation/hotels/${hotelId}/sources/${platform}`, body);
export const deleteRepSource = (id: string) => api.delete<{ ok: boolean }>(`/hotel-reputation/sources/${id}`);
export const syncRepSource = (id: string) => api.post<any>(`/hotel-reputation/sources/${id}/sync`, {});
export const testRepSource = (id: string, max = 20) => api.post<{ runId: string }>(`/hotel-reputation/sources/${id}/test`, { max });
export const requestRepBackfill = (body: { sourceIds?: string[]; platform?: string; max: number }) =>
  api.post<{ queued: number; max: number }>('/hotel-reputation/backfill', body);
/** Ориентировочная цена Apify-скрейпера за 1000 отзывов — для оценки перед дозагрузкой. */
export const APIFY_PRICE_PER_1000: Record<RepPlatform, number> = {
  google: 0.6, booking: 1.5, tripadvisor: 0.9, expedia: 2, yandex: 2.9, holidaycheck: 4.9, check24: 19, otelpuan: 29,
};
export const fetchRepOlderCount = (before: string) => api.get<{ count: number }>(`/hotel-reputation/older-count?before=${encodeURIComponent(before)}`);
export const purgeRepOlder = (before: string) => api.post<{ deleted: number }>('/hotel-reputation/purge-older', { before });
export const restoreRepPrimary = (id: string) => api.post<{ ok: boolean }>(`/hotel-reputation/sources/${id}/use-primary`, {});

export interface RepRun {
  id: string; platform: RepPlatform; hotelId: string | null; sourceId: string | null; trigger: string; status: 'running' | 'ok' | 'error'; actorId: string | null;
  startedAt: string; finishedAt: string | null; fetched: number; new: number; updated: number; errors: number; errorText: string | null;
}
export const fetchRepRuns = (q: { platform?: string; hotelId?: string; status?: string } = {}) => api.get<RepRun[]>(`/hotel-reputation/runs${qs(q)}`);
export const previewRepRun = (id: string) => api.get<{ run: RepRun; status?: string; costUsd?: number | null; items: Array<{ raw: any; parsed: any }> }>(`/hotel-reputation/runs/${id}/preview`);
export const fetchRepAlerts = () =>
  api.get<Array<{ id: string; kind: RepAlertKind; title: string | null; body: string | null; hotelId: string | null; reviewId: string | null; channels: Record<string, number> | null; sentAt: string }>>('/hotel-reputation/alerts');

export const verifyRepApify = (token?: string) => api.post<{ ok: boolean; username: string | null }>('/hotel-reputation/apify/verify', { token });
export const fetchRepGoogleAuthUrl = () => api.get<{ url: string }>('/hotel-reputation/google/auth-url');
export const disconnectRepGoogle = () => api.post<{ ok: boolean }>('/hotel-reputation/google/disconnect', {});
export const fetchRepGoogleAccounts = () => api.get<Array<{ name: string; accountName: string; type: string }>>('/hotel-reputation/google/accounts');
export const fetchRepGoogleLocations = (account?: string) =>
  api.get<Array<{ path: string; title: string; address: string | null; mapsUri: string | null }>>(`/hotel-reputation/google/locations${qs({ account })}`);
export const setupRepGoogleNotifications = () => api.post<{ ok: boolean }>('/hotel-reputation/google/notifications', {});

// ---------------------------------------------------------------- ИИ-менеджер отзывов

export interface RepReviewsWork {
  digest: { enabled: boolean; time: string; weekdays: number[]; recipients: string[]; telegram: string[]; inApp: boolean; lastSentDate: string | null };
  reminders: { enabled: boolean; firstHours: number; escalateHours: number; negativeOnly: boolean };
  drafts: { mode: 'off' | 'negative' | 'all' };
  insights: { enabled: boolean; weekday: number; time: string; createTasks: boolean; lastSentDate: string | null };
  scope: { brandIds: string[]; hotelIds: string[] };
}
export interface RepAgentState {
  agent: { id: string; name: string; status: string; avatarUrl: string | null; autonomyMode: string; timezone: string } | null;
  work: RepReviewsWork;
  reports: Array<{ id: string; type: string; title: string; createdAt: string; sentTo: string[] | null }>;
}
export const fetchRepAgent = () => api.get<RepAgentState>('/hotel-reputation/agent');
export const updateRepAgent = (body: Partial<RepReviewsWork>) => api.patch<RepAgentState>('/hotel-reputation/agent', body);
export const runRepAgentDigest = (deliver: boolean) => api.post<{ ok: boolean; day: string; sentTo: string[]; contentMd: string }>('/hotel-reputation/agent/digest', { deliver });
export const runRepAgentInsights = (deliver: boolean) =>
  api.post<{ ok: boolean; items: number; recommendations: number; tasks: number; contentMd: string }>('/hotel-reputation/agent/insights', { deliver });
export const runRepAgentReminders = () => api.post<{ reminded: number; escalated: number }>('/hotel-reputation/agent/reminders', {});

export interface RepHotelsSummary {
  negBelow: number;
  totals: { n7: number; openNeg: number; openAll: number; n90: number; avg90: number | null };
  hotels: Array<{ hotelId: string; n90: number; avg90: number | null; avg30: number | null; avgPrev30: number | null; n7: number; unansweredNegative: number; unanswered: number }>;
}
export const fetchRepHotelsSummary = () => api.get<RepHotelsSummary>('/hotel-reputation/hotels-summary');
export interface RepHotelSummary {
  negBelow: number;
  kpis: RepKpis;
  series: RepDashboard['series'];
  complaints: RepTopicStat[];
  praises: RepTopicStat[];
  platforms: Array<{ platform: RepPlatform; url: string | null; platformRating: number | null; platformCount: number | null; lastSuccessAt: string | null; failing: boolean; total: number; n90: number; avg90: number | null; unansweredNegative: number }>;
}
export type RepHotelTasks = {
  projectId: string | null;
  open: { id: string; title: string; status: string; priority: string | null; deadline: string | null; byAi: boolean }[];
  done: number;
  total: number;
  pending: { id: string; title: string; createdAt: string }[];
  agentId: string | null;
};
export const fetchRepHotelTasks = (hotelId: string) => api.get<RepHotelTasks>(`/hotel-reputation/hotels/${hotelId}/tasks`);
export const fetchRepHotelSummary = (hotelId: string) => api.get<RepHotelSummary>(`/hotel-reputation/hotels/${hotelId}/summary`);
