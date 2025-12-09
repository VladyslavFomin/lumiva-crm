// src/api/salesChannels.ts

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

  // на будущее, если захочешь показывать хвост API-ключа
  apiKeyTail?: string | null;
}

interface UpdateSalesChannelPayload {
  isEnabled: boolean;
}

/** Общий helper для запросов */
async function request<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.message === 'string') {
        msg = data.message;
      }
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Получить список каналов продаж */
export async function fetchSalesChannels(): Promise<SalesChannel[]> {
  return request<SalesChannel[]>('/api/sales-channels');
}

/** Включить/выключить канал продаж */
export async function updateSalesChannel(
  id: string,
  payload: UpdateSalesChannelPayload,
): Promise<SalesChannel> {
  return request<SalesChannel>(`/api/sales-channels/${id}/enabled`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Пометить канал как удалённый */
export async function deleteSalesChannel(id: string): Promise<void> {
  await request<void>(`/api/sales-channels/${id}`, {
    method: 'DELETE',
  });
}