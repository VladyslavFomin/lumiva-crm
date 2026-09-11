import { api } from './client';

export type ProfileCompletionStepId = 'display_name' | 'phone' | 'avatar' | 'first_lead' | 'team_invited';

export const PROFILE_STEP_LABEL: Record<ProfileCompletionStepId, string> = {
  display_name: 'Имя',
  phone: 'Телефон',
  avatar: 'Фото',
  first_lead: 'Первый лид',
  team_invited: 'Команда',
};

export type LeadActivityType = 'created' | 'status_changed' | 'assignee_changed' | 'comment';

export interface DashboardLeadActivity {
  id: string;
  createdAt: string;
  type: LeadActivityType;
  leadId: string;
  leadName: string | null;
  summary: string | null;
}

export interface DashboardHome {
  profileCompletion: { percent: number; steps: { id: ProfileCompletionStepId; done: boolean }[] };
  leadActivityStream: DashboardLeadActivity[];
  learnSlugs: string[];
  todayMeetingsCount: number;
}

export async function fetchDashboardHome(): Promise<DashboardHome> {
  const res = await api.get<DashboardHome>('/dashboard/home');
  return res.data;
}
