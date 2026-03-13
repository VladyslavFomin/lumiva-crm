// src/api/email.ts
import { api } from './client';

export interface EmailAccount {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  status: string;
  lastError: string | null;
  syncIncoming: boolean;
  syncOutgoing: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  tenantId: string;
  accountId: string;
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
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  saleId: string | null;
  date: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
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
}

export interface SendEmailDto {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  contactId?: string;
  companyId?: string;
  leadId?: string;
  saleId?: string;
}

export interface ListEmailMessagesQuery {
  accountId?: string;
  direction?: 'incoming' | 'outgoing';
  contactId?: string;
  companyId?: string;
  leadId?: string;
  saleId?: string;
  search?: string;
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

export async function sendEmail(dto: SendEmailDto): Promise<EmailMessage> {
  const res = await api.post<EmailMessage>('/email/send', dto);
  return res;
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

