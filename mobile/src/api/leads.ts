import { api } from './client';

export type LeadStatusCode = 'new' | 'in_progress' | 'waiting' | 'won' | 'lost';

export interface LeadDto {
  id: string;
  tenantId: string;
  siteId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  status: LeadStatusCode;
  source: string | null;
  assignedTo: string | null;
  assignedUserId: string | null;
  meta: any;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  country: string;
  status: LeadStatusCode;
  channel: string;
  assignedTo?: string | null;
  assignedUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  meta?: any;
}

const STATUS_MAP: Record<LeadStatusCode, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  waiting: 'Ожидает',
  won: 'Успех',
  lost: 'Проигран',
};

export interface LeadStats {
  total: number;
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
  byManager: { manager: string; total: number; won: number; lost: number }[];
}

function mapLeadDto(dto: LeadDto): Lead {
  const meta = dto.meta || {};
  const channel =
    dto.source ||
    meta.channel ||
    meta.form_name ||
    meta.utm_source ||
    meta.page ||
    'unknown';

  return {
    id: dto.id,
    name: dto.name ?? '',
    phone: dto.phone ?? '',
    email: dto.email ?? '',
    country: dto.country ?? '',
    status: dto.status,
    channel,
    assignedTo: dto.assignedTo,
    assignedUserId: dto.assignedUserId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    meta,
  };
}

export async function fetchLeads(): Promise<Lead[]> {
  const res = await api.get<LeadDto[]>('/leads');
  return res.data.map(mapLeadDto);
}

export async function fetchLead(id: string): Promise<Lead> {
  const res = await api.get<LeadDto>(`/leads/${id}`);
  return mapLeadDto(res.data);
}

export async function fetchLeadStats(): Promise<LeadStats> {
  const res = await api.get<LeadStats>('/leads/stats');
  return res.data;
}

export interface CreateLeadDto {
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: LeadStatusCode;
  meta?: any;
}

export async function createLead(payload: CreateLeadDto) {
  const res = await api.post<LeadDto>('/leads', payload);
  return mapLeadDto(res.data);
}

export interface UpdateLeadDto {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: LeadStatusCode;
  meta?: any;
  assignedTo?: string | null;
  country?: string | null;
}

export async function updateLead(payload: UpdateLeadDto) {
  const { id, ...body } = payload;
  const res = await api.patch<LeadDto>(`/leads/${id}`, body);
  return mapLeadDto(res.data);
}

export async function deleteLead(id: string) {
  await api.delete(`/leads/${id}`);
}
