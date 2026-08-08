// src/api/portal.ts
import { API_BASE } from './client';
import { getPortalSession } from '../portal/portalSession';

async function portalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getPortalSession();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface PortalMe {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
}

export interface PortalBooking {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  participants: number;
  price: string | null;
  currency: string | null;
}

export interface PortalOrder {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  externalOrderNo: string | null;
}

export function requestPortalMagicLink(clientKey: string, email: string): Promise<{ ok: true }> {
  return portalFetch('/portal/auth/request-link', { method: 'POST', body: JSON.stringify({ clientKey, email }) });
}

export function verifyPortalMagicLink(token: string): Promise<{ sessionToken: string }> {
  return portalFetch('/portal/auth/verify', { method: 'POST', body: JSON.stringify({ token }) });
}

export function fetchPortalMe(): Promise<PortalMe> {
  return portalFetch('/portal/me');
}

export function fetchPortalBookings(): Promise<PortalBooking[]> {
  return portalFetch('/portal/bookings');
}

export function fetchPortalOrders(): Promise<PortalOrder[]> {
  return portalFetch('/portal/orders');
}

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface PortalTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  direction: 'incoming' | 'outgoing';
  authorName: string | null;
  text: string;
  createdAt: string;
}

export function fetchPortalTickets(): Promise<PortalTicket[]> {
  return portalFetch('/portal/tickets');
}

export function fetchPortalTicket(id: string): Promise<{ ticket: PortalTicket; messages: TicketMessage[] }> {
  return portalFetch(`/portal/tickets/${id}`);
}

export function createPortalTicket(subject: string, message: string): Promise<PortalTicket> {
  return portalFetch('/portal/tickets', { method: 'POST', body: JSON.stringify({ subject, message }) });
}

export function replyToPortalTicket(id: string, text: string): Promise<TicketMessage> {
  return portalFetch(`/portal/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ text }) });
}
