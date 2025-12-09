import { api } from './client';

export type SmmPlatform = 'instagram' | 'facebook' | 'vk' | 'tiktok' | 'other';

export interface SmmProfileLastStat {
  date: string;
  followers: number;
  impressions: number;
  reach: number;
  profileViews: number;
  likes: number;
  comments: number;
  videoViews: number;
}

export interface SmmProfile {
  id: string;
  tenantId: string;
  platform: SmmPlatform;
  handle: string;
  url: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastStat?: SmmProfileLastStat | null;
}

export interface SmmProfilePayload {
  platform: SmmPlatform;
  handle: string;
  url?: string;
  note?: string;
}

export interface SmmStatRow {
  date: string;
  platform: SmmPlatform;
  profileId: string;
  followers: number;
  impressions: number;
  reach: number;
  profileViews: number;
  likes: number;
  comments: number;
  videoViews: number;
}

export interface SmmStatsResponse {
  from?: string | null;
  to?: string | null;
  items: SmmStatRow[];
}

export async function fetchSmmProfiles(): Promise<SmmProfile[]> {
  return api.get<SmmProfile[]>('/smm/profiles');
}

export async function createSmmProfile(
  payload: SmmProfilePayload,
): Promise<SmmProfile> {
  return api.post<SmmProfile>('/smm/profiles', payload);
}

export async function deleteSmmProfile(id: string): Promise<void> {
  await api.del(`/smm/profiles/${id}`);
}

export async function fetchSmmStats(params?: {
  from?: string;
  to?: string;
}): Promise<SmmStatsResponse> {
  const search = new URLSearchParams();
  if (params?.from) search.append('from', params.from);
  if (params?.to) search.append('to', params.to);

  const qs = search.toString();
  const url = `/smm/stats${qs ? `?${qs}` : ''}`;

  return api.get<SmmStatsResponse>(url);
}