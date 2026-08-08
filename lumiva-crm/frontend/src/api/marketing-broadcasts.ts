// src/api/marketing-broadcasts.ts
import { api } from './client';

export type BroadcastChannel = 'email' | 'sms';
export type BroadcastStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled';

export interface BroadcastStep {
  order: number;
  delayDays: number;
  subject?: string;
  body: string;
}

export interface BroadcastStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  unsubscribed: number;
}

export interface MarketingBroadcast {
  id: string;
  tenantId: string;
  name: string;
  channel: BroadcastChannel;
  status: BroadcastStatus;
  segmentId: string | null;
  steps: BroadcastStep[];
  fromEmailAccountId: string | null;
  trackOpens: boolean;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: BroadcastStats;
}

export interface CreateBroadcastDto {
  name: string;
  channel: BroadcastChannel;
  segmentId?: string | null;
  steps?: BroadcastStep[];
  fromEmailAccountId?: string | null;
  trackOpens?: boolean;
}

export function fetchBroadcasts(): Promise<MarketingBroadcast[]> {
  return api.get<MarketingBroadcast[]>('/marketing/broadcasts');
}

export function fetchBroadcast(id: string): Promise<MarketingBroadcast> {
  return api.get<MarketingBroadcast>(`/marketing/broadcasts/${id}`);
}

export function createBroadcast(dto: CreateBroadcastDto): Promise<MarketingBroadcast> {
  return api.post<MarketingBroadcast>('/marketing/broadcasts', dto);
}

export function updateBroadcast(id: string, dto: Partial<CreateBroadcastDto>): Promise<MarketingBroadcast> {
  return api.patch<MarketingBroadcast>(`/marketing/broadcasts/${id}`, dto);
}

export function deleteBroadcast(id: string): Promise<void> {
  return api.delete(`/marketing/broadcasts/${id}`);
}

export function scheduleBroadcast(id: string, scheduledAt?: string | null): Promise<MarketingBroadcast> {
  return api.post<MarketingBroadcast>(`/marketing/broadcasts/${id}/schedule`, { scheduledAt: scheduledAt ?? null });
}

export function cancelBroadcast(id: string): Promise<MarketingBroadcast> {
  return api.post<MarketingBroadcast>(`/marketing/broadcasts/${id}/cancel`);
}
