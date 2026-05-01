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
