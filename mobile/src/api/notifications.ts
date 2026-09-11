import { api } from './client';

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  isRead: boolean;
  type: string | null;
  createdAt: string;
  linkType: string | null;
  linkId: string | null;
}

export async function fetchNotifications(params?: {
  unread?: boolean;
  limit?: number;
}): Promise<AppNotification[]> {
  const search = new URLSearchParams();
  if (params?.unread) search.set('unread', 'true');
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const res = await api.get<AppNotification[]>(`/notifications${qs ? `?${qs}` : ''}`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchUnreadCount(): Promise<number> {
  try {
    const items = await fetchNotifications({ unread: true, limit: 50 });
    return items.filter((n) => !n.isRead).length;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}
