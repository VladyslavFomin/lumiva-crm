import { api } from './client';

export interface WhatsappContact {
  id: string;
  waPhoneDigits: string;
  waProfileName: string | null;
  connectionId: string | null;
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  status: string;
  lastMessage: WhatsappMessage | null;
  unreadCount: number;
}

export interface WhatsappMessage {
  id: string;
  contactId: string;
  direction: 'incoming' | 'outgoing';
  text: string | null;
  messageType: string | null;
  date: string;
}

export function whatsappContactName(c: WhatsappContact): string {
  return c.waProfileName || `+${c.waPhoneDigits}`;
}

export async function fetchWhatsappContacts(search?: string): Promise<WhatsappContact[]> {
  const res = await api.get<WhatsappContact[]>('/whatsapp-crm/contacts', { params: { search } });
  return res.data;
}

export async function fetchWhatsappMessages(contactId: string): Promise<WhatsappMessage[]> {
  const res = await api.get<{ items: WhatsappMessage[]; total: number }>('/whatsapp-crm/messages', { params: { contactId } });
  return res.data.items;
}

export async function sendWhatsappMessage(connectionId: string, contactId: string, text: string): Promise<WhatsappMessage> {
  const res = await api.post<WhatsappMessage>('/whatsapp-crm/send', { connectionId, contactId, text });
  return res.data;
}

export async function markWhatsappContactRead(contactId: string): Promise<void> {
  await api.post(`/whatsapp-crm/contacts/${contactId}/read`);
}
