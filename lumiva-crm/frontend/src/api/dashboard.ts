import { api } from './client';

export type ProfileCompletionStepId =
  | 'display_name'
  | 'phone'
  | 'avatar'
  | 'first_lead'
  | 'team_invited';

export interface DashboardHomeDto {
  profileCompletion: {
    percent: number;
    steps: { id: ProfileCompletionStepId; done: boolean }[];
  };
  leadActivityStream: {
    id: string;
    createdAt: string;
    type: string;
    leadId: string;
    leadName: string | null;
    summary: string | null;
  }[];
  learnSlugs: string[];
  todayMeetingsCount?: number;
}

export async function fetchDashboardHome(): Promise<DashboardHomeDto> {
  return api.get<DashboardHomeDto>('/dashboard/home');
}

export interface DashboardServerLayout {
  layout: unknown | null;
  updatedAt: string | null;
}

/** Серверная копия личного layout (см. dashboardLayout.ts) — источник, из которого ИИ-ассистент
 * (crm_dashboard_configure) реально меняет структуру дашборда, и зеркало ручных правок из браузера. */
export async function fetchDashboardServerLayout(): Promise<DashboardServerLayout> {
  return api.get<DashboardServerLayout>('/dashboard/layout');
}

export async function pushDashboardServerLayout(
  layout: unknown,
  updatedAt: string,
): Promise<{ ok: true; updatedAt: string }> {
  return api.patch<{ ok: true; updatedAt: string }>('/dashboard/layout', { layout, updatedAt });
}

/* ───────── Главная v3 (GET /dashboard/overview) ───────── */

export type DashFormat = 'int' | 'money' | 'pct' | 'num';
export type DashError = { error: 'denied' | 'locked' | 'failed' | 'amounts_hidden' };
export type DashMetric =
  | { value: number | null; format: DashFormat; unit?: string; delta: { kind: 'pct' | 'pp'; value: number } | null; good: boolean | null }
  | DashError;
export type DashSeries = { format: DashFormat; labels: string[]; current: number[]; previous: number[] } | DashError;

export interface DashTimelineItem {
  id: string;
  kind: 'meeting' | 'booking' | 'task';
  title: string;
  sub: string | null;
  at: string;
  end: string | null;
  who: string | null;
  link: string;
  overdue?: boolean;
  priority?: string | null;
}

export interface DashFeedItem {
  id: string;
  kind: 'lead' | 'sale' | 'booking' | 'call' | 'activity' | 'media' | 'review';
  at: string;
  title: string | null;
  sub: string | null;
  status: string | null;
  value: number | null;
  format: 'money' | 'num' | null;
  link: string;
}

export interface DashOverview {
  currency: string;
  generatedAt: string;
  me: {
    name: string | null;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    role: string;
    position: string | null;
    company: string | null;
    since: string;
  };
  online: Array<{ userId: string; name: string; avatarUrl: string | null; me: boolean }>;
  kpiPeriod: 'today' | '7d' | '30d';
  /** Ключи показателей/рядов, доступные пользователю (права + тариф). */
  available: string[];
  kpis: Record<string, DashMetric>;
  stats: Record<string, DashMetric>;
  series: Record<string, DashSeries>;
  timeline: { today: DashTimelineItem[]; past: DashTimelineItem[]; tasks: DashTimelineItem[] };
  feed: DashFeedItem[];
  folders: null | {
    total: number;
    items: Array<{ id: string; name: string; hotel: string | null; files: number; downloads: number; lastAt: string | null; shareUrl: string | null }>;
  };
  notes: { text: string; updatedAt: string | null };
}

export async function fetchDashboardOverview(q: {
  currency?: string;
  tz?: string;
  kpis: string[];
  stats: string[];
  series: string[];
  period: 'today' | '7d' | '30d';
}): Promise<DashOverview> {
  const p = new URLSearchParams({
    kpis: q.kpis.join(','),
    stats: q.stats.join(','),
    series: q.series.join(','),
    period: q.period,
  });
  if (q.currency) p.set('currency', q.currency);
  if (q.tz) p.set('tz', q.tz);
  return api.get<DashOverview>(`/dashboard/overview?${p}`);
}

export async function saveDashboardNotes(text: string): Promise<{ ok: true; updatedAt: string }> {
  return api.patch<{ ok: true; updatedAt: string }>('/dashboard/notes', { text });
}
