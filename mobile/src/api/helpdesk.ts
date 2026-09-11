import { api } from './client';

export type HelpdeskTicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type HelpdeskTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type HelpdeskChannel = 'portal' | 'email' | 'telegram' | 'whatsapp' | 'sms' | 'internal';

export interface HelpdeskTicketListItem {
  id: string;
  subject: string;
  status: HelpdeskTicketStatus;
  priority: HelpdeskTicketPriority;
  channel: HelpdeskChannel;
  contactName: string | null;
  requesterName: string | null;
  assigneeName: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  overdue: boolean;
  createdAt: string;
}

export interface HelpdeskTicketDetail extends HelpdeskTicketListItem {
  contactEmail: string | null;
  contactPhone: string | null;
  entityLabel: string | null;
}

export interface HelpdeskMessage {
  id: string;
  ticketId: string;
  direction: 'incoming' | 'outgoing';
  authorName: string | null;
  text: string;
  isRead: boolean;
  createdAt: string;
}

export async function fetchHelpdeskTickets(params?: { status?: HelpdeskTicketStatus }) {
  const res = await api.get<HelpdeskTicketListItem[]>('/helpdesk/tickets', { params });
  return res.data;
}

export async function fetchHelpdeskTicket(id: string) {
  const res = await api.get<{ ticket: HelpdeskTicketDetail; messages: HelpdeskMessage[] }>(`/helpdesk/tickets/${id}`);
  return res.data;
}

export async function replyToHelpdeskTicket(id: string, text: string) {
  const res = await api.post<HelpdeskMessage>(`/helpdesk/tickets/${id}/messages`, { text });
  return res.data;
}

export async function updateHelpdeskTicket(id: string, patch: { status?: HelpdeskTicketStatus; priority?: HelpdeskTicketPriority }) {
  const res = await api.patch<HelpdeskTicketDetail>(`/helpdesk/tickets/${id}`, patch);
  return res.data;
}
