// src/api/salesChannels.ts
import { api } from './client';

export type SalesChannelType = 'b2b' | 'ota' | 'direct' | 'gds' | 'other';

export interface SalesChannel {
  id: string;
  name: string;
  type: SalesChannelType;

  integrationId: string | null;
  integrationName: string | null;

  connectedAt: string;
  isEnabled: boolean;
  isDeleted: boolean;

  currency: string;
  totalSalesCount: number;
  totalSalesAmount: number;

  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastError: string | null;

  apiKeyTail?: string | null;
}

export async function fetchSalesChannels(): Promise<SalesChannel[]> {
  return api.get<SalesChannel[]>('/sales-channels');
}

export async function updateSalesChannel(
  id: string,
  payload: { isEnabled: boolean },
): Promise<SalesChannel> {
  return api.patch<SalesChannel>(`/sales-channels/${id}/enabled`, payload);
}

export async function deleteSalesChannel(id: string): Promise<void> {
  await api.delete<void>(`/sales-channels/${id}`);
}