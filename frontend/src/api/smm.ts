import { api } from './client';

export type SmmPlatform = 'instagram' | 'facebook' | 'telegram' | 'vk' | 'tiktok' | 'other';

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
  meta?: Record<string, any> | null;
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

export async function getMetaAuthUrl(redirect?: string): Promise<{ url: string }> {
  const qs = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
  return api.get<{ url: string }>(`/smm/meta/auth-url${qs}`);
}

export async function fetchMetaAssets(): Promise<{
  pages: Array<{
    id: string;
    name: string;
    username: string | null;
    link: string | null;
    instagramBusinessId: string | null;
    instagramUsername: string | null;
  }>;
}> {
  return api.get('/smm/meta/assets');
}

export async function connectMetaProfile(payload: {
  platform: 'facebook' | 'instagram';
  pageId?: string;
  igUserId?: string;
}): Promise<SmmProfile> {
  return api.post<SmmProfile>('/smm/meta/connect', payload);
}

export async function syncMetaNow(params?: {
  days?: number;
}): Promise<{
  date?: string;
  days?: number;
  synced: number;
  skipped: number;
  errors: number;
}> {
  const qs = params?.days ? `?days=${params.days}` : '';
  return api.post(`/smm/meta/sync${qs}`);
}

export async function getVkAuthUrl(redirect?: string): Promise<{ url: string }> {
  const qs = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
  return api.get<{ url: string }>(`/smm/vk/auth-url${qs}`);
}

export async function fetchVkAssets(): Promise<{
  groups: Array<{
    id: number;
    name: string;
    screenName: string | null;
    type: string | null;
    isClosed: number | null;
    membersCount: number | null;
    photo: string | null;
  }>;
}> {
  return api.get('/smm/vk/assets');
}

export async function connectVkGroup(payload: {
  groupId?: number;
  screenName?: string;
}): Promise<SmmProfile> {
  return api.post<SmmProfile>('/smm/vk/connect', payload);
}

export async function syncVkNow(params?: {
  days?: number;
}): Promise<{
  date?: string;
  days?: number;
  synced: number;
  skipped: number;
  errors: number;
}> {
  const qs = params?.days ? `?days=${params.days}` : '';
  return api.post(`/smm/vk/sync${qs}`);
}
