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
  totalSalesCount: number;
  totalSalesAmount: number;
  currency: string;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastError: string | null;
  apiKeyTail?: string | null;
}

export async function fetchSalesChannels(): Promise<SalesChannel[]> {
  const res = await api.get<SalesChannel[]>('/sales-channels');
  return res.data;
}

export async function toggleSalesChannel(id: string, isEnabled: boolean): Promise<SalesChannel> {
  const res = await api.patch<SalesChannel>(`/sales-channels/${id}/enabled`, { isEnabled });
  return res.data;
}

export async function deleteSalesChannel(id: string): Promise<void> {
  await api.delete(`/sales-channels/${id}`);
}
