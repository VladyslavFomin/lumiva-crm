import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api } from './client';

export interface TelegramAttachment {
  type: string; // 'photo' | 'document' | 'voice' | 'video'
  fileId: string;
  fileUniqueId: string;
  fileName?: string;
  fileSize?: number;
}

export interface TelegramContact {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  telegramPhone: string | null;
  botId: string | null;
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  lastMessage: TelegramMessage | null;
  unreadCount: number;
}

export interface TelegramMessage {
  id: string;
  contactId: string;
  direction: 'incoming' | 'outgoing';
  text: string | null;
  messageType: string | null;
  attachments: TelegramAttachment[] | null;
  date: string;
}

export function telegramContactName(c: TelegramContact): string {
  const full = [c.telegramFirstName, c.telegramLastName].filter(Boolean).join(' ').trim();
  return full || (c.telegramUsername ? `@${c.telegramUsername}` : c.telegramPhone || 'Без имени');
}

export async function fetchTelegramContacts(search?: string): Promise<TelegramContact[]> {
  const res = await api.get<TelegramContact[]>('/telegram-crm/contacts', { params: { search } });
  return res.data;
}

export async function fetchTelegramMessages(contactId: string): Promise<TelegramMessage[]> {
  const res = await api.get<{ items: TelegramMessage[]; total: number }>('/telegram-crm/messages', { params: { contactId } });
  return res.data.items;
}

export async function sendTelegramMessage(botId: string, telegramUserId: string, text: string): Promise<TelegramMessage> {
  const res = await api.post<TelegramMessage>('/telegram-crm/send', { botId, telegramUserId, text });
  return res.data;
}

export async function markTelegramContactRead(contactId: string): Promise<void> {
  await api.post(`/telegram-crm/contacts/${contactId}/read`);
}

/** Telegram file_ids have no public URL — the server proxies the actual bytes through the
 * owning bot's token (`GET /telegram-crm/messages/:id/attachment`), so any client fetch of it
 * (RN `<Image>` or `expo-file-system`, neither of which goes through the shared axios instance)
 * needs the same bearer/tenant headers built by hand. Same pattern as
 * `getCallRecordingDownloadInfo` in api/telephony.ts. */
export async function getTelegramAttachmentDownloadInfo(messageId: string, index = 0): Promise<{ url: string; headers: Record<string, string> }> {
  const host = Constants.expoConfig?.extra?.apiHost || 'https://crm.lumiva.agency';
  const base = Constants.expoConfig?.extra?.apiBase || '/v1';
  const [token, tenantId, clientKey] = await Promise.all([
    AsyncStorage.getItem('auth_token'),
    AsyncStorage.getItem('tenant_id'),
    AsyncStorage.getItem('client_key'),
  ]);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  if (clientKey) headers['X-Client-Key'] = clientKey;
  return { url: `${host}${base}/telegram-crm/messages/${messageId}/attachment${index ? `?index=${index}` : ''}`, headers };
}
