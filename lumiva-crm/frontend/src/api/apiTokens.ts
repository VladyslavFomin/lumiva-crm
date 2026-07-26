// src/api/apiTokens.ts
// Generic per-tenant API tokens (backend: src/api-tokens/). Minimal client — only what
// the Bookings "Коннектор" tab needs (list/create/delete), not a full management UI.
import { api } from './client';

export interface ApiTokenRecord {
  id: string;
  tenantId: string;
  token: string;
  name: string;
  description: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const fetchApiTokens = () => api.get<ApiTokenRecord[]>('/api-tokens');

export const createApiToken = (dto: { name: string; description?: string | null }) =>
  api.post<ApiTokenRecord>('/api-tokens', {
    ...dto,
    token: `tok_${crypto.randomUUID().replace(/-/g, '')}`,
  });

export const deleteApiToken = (id: string) => api.delete<void>(`/api-tokens/${id}`);
