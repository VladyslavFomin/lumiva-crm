import { api } from './client';

export interface EmailTemplateDto {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  htmlBody: string | null;
  textBody: string | null;
  meta: { category?: string; tags?: string[]; variables?: string[] } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapEmailTemplate(dto: EmailTemplateDto): EmailTemplate {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? '',
    subject: dto.subject ?? '',
    htmlBody: dto.htmlBody ?? '',
    textBody: dto.textBody ?? '',
    category: dto.meta?.category ?? '',
    isActive: dto.isActive,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const res = await api.get<EmailTemplateDto[]>('/email/templates');
  return res.data.map(mapEmailTemplate);
}

export async function fetchEmailTemplate(id: string): Promise<EmailTemplate> {
  const res = await api.get<EmailTemplateDto>(`/email/templates/${id}`);
  return mapEmailTemplate(res.data);
}

export interface CreateEmailTemplateDto {
  name: string;
  subject?: string;
  htmlBody?: string;
  description?: string;
  category?: string;
}

export async function createEmailTemplate(payload: CreateEmailTemplateDto): Promise<EmailTemplate> {
  const { category, ...rest } = payload;
  const res = await api.post<EmailTemplateDto>('/email/templates', { ...rest, meta: category ? { category } : undefined });
  return mapEmailTemplate(res.data);
}

export interface UpdateEmailTemplateDto {
  id: string;
  name?: string;
  subject?: string;
  htmlBody?: string;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export async function updateEmailTemplate(payload: UpdateEmailTemplateDto): Promise<EmailTemplate> {
  const { id, category, ...rest } = payload;
  const res = await api.patch<EmailTemplateDto>(`/email/templates/${id}`, { ...rest, ...(category !== undefined ? { meta: { category } } : {}) });
  return mapEmailTemplate(res.data);
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await api.delete(`/email/templates/${id}`);
}

export interface EmailAccount {
  id: string;
  email: string;
  name: string | null;
  status: string;
}

export async function fetchEmailAccounts(): Promise<EmailAccount[]> {
  const res = await api.get<EmailAccount[] | { items?: EmailAccount[] }>('/email/accounts');
  return Array.isArray(res.data) ? res.data : res.data?.items || [];
}

export interface SendTemplateEmailPayload {
  accountId: string;
  to: string[];
  templateId: string;
}

export async function sendTemplateEmail(payload: SendTemplateEmailPayload): Promise<void> {
  await api.post('/email/send', payload);
}
