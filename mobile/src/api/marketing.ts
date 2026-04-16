import { api } from './client';

export interface TrafficData {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  source: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  startDate: string;
  endDate: string | null;
}

export interface Utm {
  id: string;
  source: string;
  medium: string;
  campaign: string;
  term: string | null;
  content: string | null;
  clicks: number;
  conversions: number;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  conditions: any;
  contactsCount: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchTraffic(params?: { startDate?: string; endDate?: string }): Promise<TrafficData[]> {
  const search = new URLSearchParams();
  if (params?.startDate) search.set('startDate', params.startDate);
  if (params?.endDate) search.set('endDate', params.endDate);
  const res = await api.get<TrafficData[]>(`/marketing/traffic${search.toString() ? `?${search}` : ''}`);
  return res.data;
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await api.get<Campaign[] | { items?: Campaign[] }>('/marketing/campaigns');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchUtms(): Promise<Utm[]> {
  const res = await api.get<Utm[] | { items?: Utm[] }>('/marketing/utms');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchSegments(): Promise<Segment[]> {
  const res = await api.get<Segment[] | { items?: Segment[] }>('/marketing/segments');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const res = await api.get<EmailTemplate[] | { items?: EmailTemplate[] }>('/marketing/email-templates');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchEmailTemplate(id: string): Promise<EmailTemplate> {
  const res = await api.get<EmailTemplate>(`/marketing/email-templates/${id}`);
  return res.data;
}

export interface CreateEmailTemplateDto {
  name: string;
  subject: string;
  body: string;
  type: string;
}

export async function createEmailTemplate(payload: CreateEmailTemplateDto): Promise<EmailTemplate> {
  const res = await api.post<EmailTemplate>('/marketing/email-templates', payload);
  return res.data;
}

export interface UpdateEmailTemplateDto {
  id: string;
  name?: string;
  subject?: string;
  body?: string;
  type?: string;
}

export async function updateEmailTemplate(payload: UpdateEmailTemplateDto): Promise<EmailTemplate> {
  const { id, ...body } = payload;
  const res = await api.patch<EmailTemplate>(`/marketing/email-templates/${id}`, body);
  return res.data;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await api.delete(`/marketing/email-templates/${id}`);
}




