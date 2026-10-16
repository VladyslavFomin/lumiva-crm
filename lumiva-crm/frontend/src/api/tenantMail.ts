import { api } from './client';

/** С какого ящика CRM отправляет уведомления, отчёты и письма клиентам (или почему не отправляет). */
export interface NotificationSender {
  account: { id: string; email: string; name: string | null; personal: boolean; provider: string } | null;
  reason: 'ok' | 'none' | 'choose' | 'personal_only';
}

let cached: Promise<NotificationSender> | null = null;
export const fetchNotificationSender = (fresh = false) => {
  if (!cached || fresh) cached = api.get<NotificationSender>('/email/notification-sender').catch((e) => { cached = null; throw e; });
  return cached;
};
export const chooseNotificationSender = async (accountId: string | null) => {
  const r = await api.put<NotificationSender>('/email/notification-sender', { accountId });
  cached = Promise.resolve(r);
  return r;
};
