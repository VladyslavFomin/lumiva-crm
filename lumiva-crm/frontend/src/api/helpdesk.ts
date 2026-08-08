// src/api/helpdesk.ts
import { api } from './client';

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type HelpdeskChannel = 'portal' | 'email' | 'telegram' | 'whatsapp' | 'sms' | 'internal';
export type HelpdeskLinkType = 'lead' | 'company' | 'project';

export interface HelpdeskTicketRow {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: HelpdeskChannel;
  category: string | null;
  assignedUserId: string | null;
  assigneeName: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  requesterStaffId: string | null;
  requesterName: string | null;
  requesterDepartment: string | null;
  entityType: HelpdeskLinkType | null;
  entityId: string | null;
  entityLabel: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  slaTargetMinutes: number;
  overdue: boolean;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HelpdeskMessage {
  id: string;
  direction: 'incoming' | 'outgoing';
  authorName: string | null;
  text: string;
  createdAt: string;
}

export interface HelpdeskTicketDetail {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: HelpdeskChannel;
  category: string | null;
  assignedUserId: string | null;
  assigneeName: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  requesterStaffId: string | null;
  requesterName: string | null;
  requesterDepartment: string | null;
  entityType: HelpdeskLinkType | null;
  entityId: string | null;
  entityLabel: string | null;
  slaTargetMinutes: number;
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HelpdeskLinkOption {
  id: string;
  name: string;
}

export function fetchHelpdeskTickets(params?: { status?: TicketStatus }): Promise<HelpdeskTicketRow[]> {
  return api.get<HelpdeskTicketRow[]>('/helpdesk/tickets', { params: params as any });
}

export function fetchHelpdeskTicket(id: string): Promise<{ ticket: HelpdeskTicketDetail; messages: HelpdeskMessage[] }> {
  return api.get(`/helpdesk/tickets/${id}`);
}

export function createHelpdeskTicket(payload: {
  contactId?: string;
  subject: string;
  message: string;
  category?: string;
  priority?: TicketPriority;
  channel?: HelpdeskChannel;
  entityType?: HelpdeskLinkType;
  entityId?: string;
  assignedUserId?: string;
}): Promise<HelpdeskTicketRow> {
  return api.post('/helpdesk/tickets', payload);
}

export function updateHelpdeskTicket(
  id: string,
  patch: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedUserId?: string | null;
    category?: string | null;
    entityType?: HelpdeskLinkType | null;
    entityId?: string | null;
  },
): Promise<HelpdeskTicketRow> {
  return api.patch(`/helpdesk/tickets/${id}`, patch);
}

export function replyToHelpdeskTicket(id: string, text: string): Promise<HelpdeskMessage> {
  return api.post(`/helpdesk/tickets/${id}/messages`, { text });
}

export function searchHelpdeskLinkOptions(type: HelpdeskLinkType, search?: string): Promise<HelpdeskLinkOption[]> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return api.get(`/helpdesk/link-options/${type}${q}`);
}

/** Any authenticated staff member can call this — no helpdesk permission required. Used by
 * the "Создать заявку" button in the notifications panel (any department → support). */
export function createInternalHelpdeskRequest(payload: {
  subject: string;
  message: string;
  category?: string;
  priority?: TicketPriority;
}): Promise<HelpdeskTicketRow> {
  return api.post('/helpdesk/internal-requests', payload);
}
