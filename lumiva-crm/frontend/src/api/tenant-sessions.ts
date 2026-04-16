import { api } from './client';

export interface TenantSessionRow {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export async function fetchTenantSessions(): Promise<TenantSessionRow[]> {
  return api.get<TenantSessionRow[]>('/tenants/sessions');
}

export async function revokeTenantSession(sessionId: string): Promise<void> {
  await api.delete(`/tenants/sessions/${sessionId}`);
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await api.delete(`/tenants/users/${userId}/sessions`);
}
