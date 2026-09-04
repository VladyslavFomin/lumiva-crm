// src/api/email.ts
import { api } from './client';

export interface EmailAccount {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  smtpUsername?: string | null;
  imapUsername?: string | null;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  status: string;
  lastError: string | null;
  lastSyncAt?: string | null;
  syncIncoming: boolean;
  syncOutgoing: boolean;
  syncFolder?: string | null;
  oauthProvider?: string | null;
  oauthExpiresAt?: string | null;
  hasOAuthTokens?: boolean;
  meta?: {
    leadIngestion?: { autoCreateFromUnknown?: boolean; skipDomains?: string[] };
    signatureHtml?: string | null;
    signatureText?: string | null;
    [key: string]: unknown;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailFolder {
  id: string;
  tenantId: string;
  accountId: string;
  parentId: string | null;
  name: string;
  systemKey: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  tenantId: string;
  accountId: string;
  crmFolderId?: string | null;
  messageId: string;
  direction: 'incoming' | 'outgoing';
  from: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  attachments?: Array<{ filename: string; contentType: string; size: number; url?: string }> | null;
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  saleId: string | null;
  date: string;
  isRead: boolean;
  isStarred?: boolean;
  meta?: {
    hasCalendarAttachment?: boolean;
    calendarInvite?: EmailCalendarInviteMeta;
    calendarInviteImportError?: string;
    [key: string]: unknown;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCalendarInviteMeta {
  title?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  location?: string | null;
  timezone?: string | null;
  organizerEmail?: string | null;
  organizerName?: string | null;
  attendees?: string[];
  attendeesCount?: number | null;
  status?: 'requested' | 'confirmed' | 'tentative' | 'cancelled' | string | null;
  method?: string | null;
  uid?: string | null;
  sequence?: number | null;
  sourceFilename?: string | null;
  workspaceObjectId?: string;
  workspaceRecordId?: string;
  workspaceCalendarPath?: string;
  workspaceTablePath?: string;
}

export interface CreateEmailAccountDto {
  email: string;
  name?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUsername?: string;
  imapPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  syncIncoming?: boolean;
  syncOutgoing?: boolean;
  syncFolder?: string;
}

export interface SendEmailDto {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  templateId?: string;
  contactId?: string;
  companyId?: string;
  leadId?: string;
  saleId?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64?: string;
  }>;
}

export interface ListEmailMessagesQuery {
  accountId?: string;
  folderId?: string;
  direction?: 'incoming' | 'outgoing';
  contactId?: string;
  companyId?: string;
  leadId?: string;
  saleId?: string;
  search?: string;
  read?: boolean;
  starred?: boolean;
  hasCalendarInvite?: boolean;
  hasLead?: boolean;
  from?: string;
  to?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export async function fetchEmailAccounts(): Promise<EmailAccount[]> {
  const res = await api.get<EmailAccount[]>('/email/accounts');
  return res;
}

export async function fetchEmailAccount(id: string): Promise<EmailAccount> {
  const res = await api.get<EmailAccount>(`/email/accounts/${id}`);
  return res;
}

export async function createEmailAccount(dto: CreateEmailAccountDto): Promise<EmailAccount> {
  const res = await api.post<EmailAccount>('/email/accounts', dto);
  return res;
}

export async function updateEmailAccount(id: string, dto: Partial<CreateEmailAccountDto>): Promise<EmailAccount> {
  const res = await api.patch<EmailAccount>(`/email/accounts/${id}`, dto);
  return res;
}

export async function deleteEmailAccount(id: string): Promise<void> {
  await api.delete(`/email/accounts/${id}`);
}

export async function testSmtpConnection(id: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const res = await api.post<{ success: boolean; error?: string; message?: string }>(`/email/accounts/${id}/test-smtp`, {}, {
      timeout: 15000, // 15 секунд таймаут на клиенте
    });
    return res;
  } catch (error: any) {
    // Обрабатываем 504 и другие таймауты
    if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
      return { 
        success: false, 
        error: 'Таймаут подключения. Проверьте настройки SMTP (хост, порт) и попробуйте снова.',
        message: 'Таймаут подключения',
      };
    }
    throw error;
  }
}

export async function fetchEmailMessages(query?: ListEmailMessagesQuery): Promise<{ items: EmailMessage[]; total: number }> {
  const res = await api.get<{ items: EmailMessage[]; total: number }>('/email/messages', { params: query });
  return res;
}

export async function fetchEmailMessage(id: string): Promise<EmailMessage> {
  return api.get<EmailMessage>(`/email/messages/${id}`);
}

export async function patchEmailMessage(
  id: string,
  body: {
    isRead?: boolean;
    isStarred?: boolean;
    leadId?: string | null;
    crmFolderId?: string | null;
  },
): Promise<EmailMessage> {
  return api.patch<EmailMessage>(`/email/messages/${id}`, body);
}

export async function deleteEmailMessage(id: string): Promise<void> {
  await api.delete(`/email/messages/${id}`);
}

export async function fetchEmailFolders(accountId: string): Promise<EmailFolder[]> {
  return api.get<EmailFolder[]>('/email/folders', { params: { accountId } });
}

export async function createEmailFolder(body: {
  accountId: string;
  name: string;
  parentId?: string | null;
}): Promise<EmailFolder> {
  const payload: { accountId: string; name: string; parentId?: string } = {
    accountId: body.accountId,
    name: body.name,
  };
  if (body.parentId && typeof body.parentId === 'string' && body.parentId.trim().length > 0) {
    payload.parentId = body.parentId.trim();
  }
  return api.post<EmailFolder>('/email/folders', payload);
}

export async function patchEmailFolder(
  id: string,
  body: { name?: string; parentId?: string | null; sortOrder?: number },
): Promise<EmailFolder> {
  return api.patch<EmailFolder>(`/email/folders/${id}`, body);
}

export async function deleteEmailFolder(id: string): Promise<void> {
  await api.delete(`/email/folders/${id}`);
}

export async function reorderEmailFolders(body: {
  accountId: string;
  items: Array<{ id: string; sortOrder: number; parentId?: string | null }>;
}): Promise<void> {
  await api.post('/email/folders/reorder', body);
}

export async function patchEmailAccountSignature(
  accountId: string,
  body: { signatureHtml?: string | null; signatureText?: string | null },
): Promise<EmailAccount> {
  return api.patch<EmailAccount>(`/email/accounts/${accountId}/signature`, body);
}

export async function startEmailOAuthGoogle(redirectPath?: string): Promise<{ url: string }> {
  return api.post<{ url: string }>('/email/oauth/google/start', {
    redirect: redirectPath || '/app/email',
  });
}

export async function startEmailOAuthMicrosoft(redirectPath?: string): Promise<{ url: string }> {
  return api.post<{ url: string }>('/email/oauth/microsoft/start', {
    redirect: redirectPath || '/app/email',
  });
}

export async function syncEmailMailboxNow(
  accountId: string,
  mode: 'oauth' | 'imap' = 'oauth',
): Promise<{ imported: number; scanned?: number }> {
  const path =
    mode === 'imap'
      ? `/email/accounts/${accountId}/sync-imap`
      : `/email/oauth/sync/${accountId}`;
  return api.post<{ imported: number; scanned?: number }>(path, {}, {
    skipUnauthorizedRedirect: true,
  });
}

export async function importEmailCalendarInvite(messageId: string): Promise<EmailMessage> {
  return api.post<EmailMessage>(`/email/messages/${messageId}/calendar-invite/import`, {});
}

export async function backfillEmailCalendarInvites(body?: {
  accountId?: string;
  limit?: number;
}): Promise<{
  processed: number;
  imported: number;
  failed: number;
  skipped: number;
}> {
  return api.post('/email/calendar-invites/backfill', body || {});
}

export async function patchEmailAccountIngestion(
  accountId: string,
  body: { autoCreateFromUnknown?: boolean; skipDomains?: string[] },
): Promise<EmailAccount> {
  return api.patch<EmailAccount>(`/email/oauth/accounts/${accountId}/ingestion`, body);
}

export async function sendEmail(dto: SendEmailDto): Promise<EmailMessage> {
  const res = await api.post<EmailMessage>('/email/send', dto);
  return res;
}

export interface PreviewStyledMailDto {
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  headline?: string;
  contactId?: string;
  leadId?: string;
  companyId?: string;
  saleId?: string;
  variables?: Record<string, unknown>;
}

export async function previewStyledMail(
  dto: PreviewStyledMailDto,
): Promise<{ subject: string; htmlBody: string; textBody: string }> {
  return api.post<{ subject: string; htmlBody: string; textBody: string }>(
    '/email/preview-styled',
    dto,
  );
}

export interface SendStyledEmailDto extends PreviewStyledMailDto {
  accountId: string;
  to: string[];
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBase64?: string;
  }>;
}

export async function sendStyledMail(dto: SendStyledEmailDto): Promise<EmailMessage> {
  return api.post<EmailMessage>('/email/send-styled', dto);
}

// ========== EMAIL TEMPLATES ==========

export interface EmailTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  subject: string | null;
  htmlBody: string | null;
  textBody: string | null;
  meta: {
    variables?: string[];
    category?: string;
    tags?: string[];
    previewImage?: string;
    [key: string]: any;
  } | null;
  isActive: boolean;
  useWrapper: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailTemplateDto {
  name: string;
  description?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  meta?: {
    variables?: string[];
    category?: string;
    tags?: string[];
    previewImage?: string;
    [key: string]: any;
  };
  isActive?: boolean;
  useWrapper?: boolean;
}

export interface UpdateEmailTemplateDto extends Partial<CreateEmailTemplateDto> {}

export async function fetchEmailTemplates(isActive?: boolean): Promise<EmailTemplate[]> {
  const res = await api.get<EmailTemplate[]>('/email/templates', {
    params: isActive !== undefined ? { isActive } : {},
  });
  return res;
}

export async function fetchEmailTemplate(id: string): Promise<EmailTemplate> {
  const res = await api.get<EmailTemplate>(`/email/templates/${id}`);
  return res;
}

export async function createEmailTemplate(dto: CreateEmailTemplateDto): Promise<EmailTemplate> {
  const res = await api.post<EmailTemplate>('/email/templates', dto);
  return res;
}

export async function updateEmailTemplate(id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplate> {
  const res = await api.patch<EmailTemplate>(`/email/templates/${id}`, dto);
  return res;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await api.delete(`/email/templates/${id}`);
}

export async function previewEmailTemplate(id: string, data: Record<string, any>): Promise<{ subject: string; htmlBody: string; textBody: string }> {
  const res = await api.post<{ subject: string; htmlBody: string; textBody: string }>(`/email/templates/${id}/preview`, data);
  return res;
}

// ========== BULK SEND ==========

export interface BulkSendDto {
  templateId?: string;
  subject: string;
  html: string;
  leadFilters?: { source?: string; status?: string };
  recipientEmails?: string[];
  fromAccountId: string;
  trackOpens?: boolean;
}

export interface BulkSendResult {
  sent: number;
  failed: number;
  jobId: string;
}

export async function sendBulkEmail(dto: BulkSendDto): Promise<BulkSendResult> {
  return api.post<BulkSendResult>('/email/bulk-send', dto);
}
