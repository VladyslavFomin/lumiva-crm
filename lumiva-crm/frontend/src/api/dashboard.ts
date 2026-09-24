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
