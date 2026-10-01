// src/api/whatsapp-crm.ts
import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

export interface WhatsappConnection {
  id: string;
  name: string;
  phoneNumberId: string | null;
}

export interface WhatsappContact {
  id: string;
  tenantId: string;
  connectionId: string | null;
  waPhoneDigits: string;
  waProfileName: string | null;
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappMessage {
  id: string;
  tenantId: string;
  contactId: string;
  connectionId: string | null;
  waMessageId: string | null;
  direction: 'incoming' | 'outgoing';
  text: string | null;
  messageType: string | null;
  attachments?: Array<{ type: string; id?: string; mimeType?: string; caption?: string; fileName?: string; fileSize?: number }> | null;
  /** source: 'ai' — ответ ИИ-консультанта или ИИ-сотрудника */
  rawData?: { source?: string } | null;
  date: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappContactWithPreview extends WhatsappContact {
  lastMessage: WhatsappMessage | null;
  unreadCount: number;
  /** Данные карточки диалога (бэкенд: common/chat-contact-enrich.util.ts) */
  lead?: { id: string; name: string | null; status: string | null; ownerName: string | null } | null;
  crmContact?: { id: string; name: string | null } | null;
  crmCompany?: { id: string; name: string | null } | null;
  messageCount?: number;
  firstMessageAt?: string | null;
}

export async function fetchWhatsappConnections(): Promise<WhatsappConnection[]> {
  return api.get<WhatsappConnection[]>('/whatsapp-crm/connections');
}

export async function fetchWhatsappContacts(query?: { search?: string; connectionId?: string; leadId?: string }): Promise<WhatsappContactWithPreview[]> {
  return api.get<WhatsappContactWithPreview[]>('/whatsapp-crm/contacts', { params: query });
}

export async function markWhatsappContactRead(contactId: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>(`/whatsapp-crm/contacts/${contactId}/read`);
}

export async function fetchWhatsappMessages(query: { contactId: string; limit?: number; offset?: number }): Promise<{ items: WhatsappMessage[]; total: number }> {
  return api.get<{ items: WhatsappMessage[]; total: number }>('/whatsapp-crm/messages', { params: query });
}

export async function sendWhatsappMessage(dto: { connectionId: string; contactId: string; text: string }): Promise<WhatsappMessage> {
  return api.post<WhatsappMessage>('/whatsapp-crm/send', dto);
}

/** Отправить клиенту файл (PDF/Word/Excel/JPEG/PNG, до 50 МБ) в WhatsApp-диалог. */
export async function sendWhatsappFile(dto: { connectionId: string; contactId: string; file: File; caption?: string }): Promise<WhatsappMessage> {
  const form = new FormData();
  form.append('connectionId', dto.connectionId);
  form.append('contactId', dto.contactId);
  if (dto.caption) form.append('caption', dto.caption);
  form.append('file', dto.file);
  return api.postForm<WhatsappMessage>('/whatsapp-crm/send-file', form);
}

/** Файл сообщения как blob-URL (через API с токеном — у Meta нет публичных ссылок). Вызывающий освобождает URL. */
export async function fetchWhatsappAttachmentUrl(messageId: string, index = 0): Promise<string> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/whatsapp-crm/messages/${messageId}/attachment?index=${index}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

/** Создать лид из диалога (или вернуть уже привязанный). */
export async function createLeadFromWhatsappContact(contactId: string): Promise<{ leadId: string }> {
  return api.post<{ leadId: string }>(`/whatsapp-crm/contacts/${contactId}/create-lead`);
}
