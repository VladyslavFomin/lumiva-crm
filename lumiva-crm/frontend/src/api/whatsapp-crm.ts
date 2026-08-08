// src/api/whatsapp-crm.ts
import { api } from './client';

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
  date: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappContactWithPreview extends WhatsappContact {
  lastMessage: WhatsappMessage | null;
  unreadCount: number;
}

export async function fetchWhatsappConnections(): Promise<WhatsappConnection[]> {
  return api.get<WhatsappConnection[]>('/whatsapp-crm/connections');
}

export async function fetchWhatsappContacts(query?: { search?: string; connectionId?: string }): Promise<WhatsappContactWithPreview[]> {
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
