// src/api/instagram-crm.ts
import { api } from './client';

export interface InstagramAccountSettings {
  dmToLead?: boolean;
  commentsToLead?: boolean;
  commentKeywords?: string[];
}

export interface InstagramAccount {
  id: string;
  igUserId: string;
  igUsername: string | null;
  profilePictureUrl: string | null;
  pageId: string;
  pageName: string | null;
  status: 'active' | 'error' | 'disconnected' | string;
  lastError: string | null;
  lastEventAt: string | null;
  settings: InstagramAccountSettings;
  createdAt: string;
}

export interface InstagramMessage {
  id: string;
  contactId: string;
  accountId: string;
  kind: 'dm' | 'comment' | string;
  externalId: string | null;
  direction: 'incoming' | 'outgoing';
  text: string | null;
  attachments: Array<{ type: string; url?: string }> | null;
  mediaId: string | null;
  mediaPermalink: string | null;
  date: string;
  isRead: boolean;
  rawData?: { privateReplyTo?: string } | null;
}

export interface InstagramContactWithPreview {
  id: string;
  accountId: string;
  igsid: string | null;
  username: string | null;
  name: string | null;
  profilePic: string | null;
  leadId: string | null;
  createdAt: string;
  lastMessage: InstagramMessage | null;
  unreadCount: number;
  lead?: { id: string; name: string | null; status: string | null; ownerName: string | null } | null;
  crmContact?: { id: string; name: string | null } | null;
  crmCompany?: { id: string; name: string | null } | null;
  messageCount?: number;
  firstMessageAt?: string | null;
}

export const fetchInstagramAccounts = () => api.get<InstagramAccount[]>('/instagram-crm/accounts');

export const startInstagramOAuth = () => api.get<{ url: string }>('/instagram-crm/oauth/start');

export const updateInstagramAccount = (id: string, patch: InstagramAccountSettings) =>
  api.patch<InstagramAccount>(`/instagram-crm/accounts/${id}`, patch);

export const disconnectInstagramAccount = (id: string) => api.delete<{ ok: true }>(`/instagram-crm/accounts/${id}`);

export function fetchInstagramContacts(params: { search?: string; accountId?: string; leadId?: string } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.accountId) q.set('accountId', params.accountId);
  if (params.leadId) q.set('leadId', params.leadId);
  const s = q.toString();
  return api.get<InstagramContactWithPreview[]>(`/instagram-crm/contacts${s ? `?${s}` : ''}`);
}

export const fetchInstagramMessages = (contactId: string, limit = 200) =>
  api.get<InstagramMessage[]>(`/instagram-crm/messages?contactId=${encodeURIComponent(contactId)}&limit=${limit}`);

export const markInstagramContactRead = (contactId: string) => api.post(`/instagram-crm/contacts/${contactId}/read`, {});

export const sendInstagramMessage = (contactId: string, text: string) =>
  api.post<InstagramMessage>('/instagram-crm/send', { contactId, text });

export const createLeadFromInstagramContact = (contactId: string) =>
  api.post<{ leadId: string }>(`/instagram-crm/contacts/${contactId}/create-lead`, {});
