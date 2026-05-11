import { api } from './client';

export interface InAppNotification {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  body: string;
  isRead: boolean;
  meta: any | null;
  createdAt: string;
}

export async function fetchNotifications(opts?: {
  unread?: boolean;
  limit?: number;
}): Promise<{ items: InAppNotification[]; unread: number }> {
  const params: Record<string, string> = {};
  if (opts?.unread) params.unread = 'true';
  if (opts?.limit) params.limit = String(opts.limit);
  return api.get('/notifications', { params });
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all', {});
}
