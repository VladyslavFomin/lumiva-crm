import { api } from './client';
import { fetchEmailAccounts } from './email';

export interface EmailFolder {
  id: string;
  accountId: string;
  parentId: string | null;
  name: string;
  systemKey: 'inbox' | 'sent' | 'trash' | null;
  sortOrder: number;
}

export async function fetchEmailFolders(accountId: string): Promise<EmailFolder[]> {
  const res = await api.get<EmailFolder[]>('/email/folders', { params: { accountId } });
  return res.data;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  url?: string;
}

export interface EmailMessage {
  id: string;
  accountId: string;
  crmFolderId: string | null;
  threadId: string | null;
  direction: 'incoming' | 'outgoing';
  from: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  attachments: EmailAttachment[] | null;
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  saleId: string | null;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
}

export interface FetchEmailMessagesParams {
  accountId: string;
  folderId?: string;
  starred?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchEmailMessages(params: FetchEmailMessagesParams): Promise<{ items: EmailMessage[]; total: number }> {
  const res = await api.get<{ items: EmailMessage[]; total: number }>('/email/messages', { params });
  return res.data;
}

export async function fetchEmailMessage(id: string): Promise<EmailMessage> {
  const res = await api.get<EmailMessage>(`/email/messages/${id}`);
  return res.data;
}

export async function patchEmailMessage(id: string, patch: { isRead?: boolean; isStarred?: boolean }): Promise<EmailMessage> {
  const res = await api.patch<EmailMessage>(`/email/messages/${id}`, patch);
  return res.data;
}

export async function deleteEmailMessage(id: string): Promise<void> {
  await api.delete(`/email/messages/${id}`);
}

export interface SendNewEmailPayload {
  accountId: string;
  to: string[];
  cc?: string[];
  subject?: string;
  textBody?: string;
  htmlBody?: string;
}

export async function sendNewEmail(payload: SendNewEmailPayload): Promise<EmailMessage> {
  const res = await api.post<EmailMessage>('/email/send', payload);
  return res.data;
}

export interface EmailDialogItem {
  accountId: string;
  counterpartEmail: string;
  counterpartName: string | null;
  lastMessage: string;
  lastDate: string;
  unreadCount: number;
}

/** Groups the primary account's inbox by counterpart address so it can sit alongside Telegram/WhatsApp threads in the unified dialogs feed. */
export async function fetchEmailDialogs(): Promise<EmailDialogItem[]> {
  const accounts = await fetchEmailAccounts();
  const account = accounts.find((a) => a.status === 'active') ?? accounts[0];
  if (!account) return [];

  const folders = await fetchEmailFolders(account.id);
  const inbox = folders.find((f) => f.systemKey === 'inbox');
  if (!inbox) return [];

  const { items } = await fetchEmailMessages({ accountId: account.id, folderId: inbox.id, limit: 100 });

  const byCounterpart = new Map<string, EmailDialogItem>();
  for (const m of items) {
    const counterpartEmail = m.direction === 'incoming' ? m.from : (m.to[0] || m.from);
    const key = counterpartEmail.toLowerCase();
    const existing = byCounterpart.get(key);
    if (!existing) {
      byCounterpart.set(key, {
        accountId: account.id,
        counterpartEmail,
        counterpartName: m.direction === 'incoming' ? m.fromName : null,
        lastMessage: m.subject || m.textBody?.slice(0, 140) || '',
        lastDate: m.date,
        unreadCount: m.direction === 'incoming' && !m.isRead ? 1 : 0,
      });
    } else if (m.direction === 'incoming' && !m.isRead) {
      existing.unreadCount += 1;
    }
  }
  return Array.from(byCounterpart.values());
}

/** No HTML renderer is wired into the app yet — collapse markup to readable plain text. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
