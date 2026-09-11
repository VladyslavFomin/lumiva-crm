import { api } from './client';
import { EntityComment } from './comments';

export type LeadStatusCode = 'new' | 'in_progress' | 'waiting' | 'won' | 'lost';

export interface LeadTask {
  id: string;
  title: string;
  done: boolean;
  deadline: string | null;
}

export interface LeadProjectRef {
  id: string;
  name: string | null;
  status?: string | null;
}

export interface LeadDto {
  id: string;
  tenantId: string;
  siteId: string | null;
  contactId: string | null;
  companyId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  status: LeadStatusCode;
  source: string | null;
  assignedTo: string | null;
  assignedUserId: string | null;
  assignedUserIds: string[] | null;
  assignedToList: string[] | null;
  amount: string | number | null;
  currency: string | null;
  tasks: LeadTask[] | null;
  projects: LeadProjectRef[] | null;
  customFields: Record<string, any> | null;
  comments: EntityComment[] | null;
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
  contactId: string | null;
  companyId: string | null;
  assignedTo?: string | null;
  assignedUserId?: string | null;
  assignedToList: string[];
  amount: number;
  currency: string;
  tasks: LeadTask[];
  projects: LeadProjectRef[];
  customFields: Record<string, any> | null;
  comments: EntityComment[];
  createdAt: string;
  updatedAt: string;
  meta?: any;
}

export type LeadActivityType = 'created' | 'status_changed' | 'assignee_changed' | 'comment';

export interface LeadActivityEntry {
  id: string;
  type: LeadActivityType;
  comment: string | null;
  fromValue: string | null;
  toValue: string | null;
  userId: string | null;
  createdAt: string;
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
  byCountry: { country: string; count: number }[];
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
    contactId: dto.contactId ?? null,
    companyId: dto.companyId ?? null,
    assignedTo: dto.assignedTo,
    assignedUserId: dto.assignedUserId,
    assignedToList: dto.assignedToList && dto.assignedToList.length > 0 ? dto.assignedToList : (dto.assignedTo ? [dto.assignedTo] : []),
    amount: dto.amount ? parseFloat(String(dto.amount)) : 0,
    currency: dto.currency || 'EUR',
    tasks: dto.tasks || [],
    projects: dto.projects || [],
    customFields: dto.customFields || null,
    comments: dto.comments || [],
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

/** Same shape as /leads/stats but scoped to a date range (used for weekly widgets). */
export async function fetchLeadAnalyticsRange(from: string, to: string): Promise<LeadStats> {
  const res = await api.get<LeadStats>('/leads/analytics', { params: { from, to } });
  return res.data;
}

export interface LeadRoiRow {
  leadId: string;
  leadName: string | null;
  status: string | null;
  manager: string | null;
  channel: string | null;
  totalRevenue: number;
  dealsCount: number;
  currency: string;
}

export interface LeadsRoiStats {
  currency: string;
  totalRevenue: number;
  leadsWithRevenue: number;
  dealsCount: number;
  avgCheck: number;
  items: LeadRoiRow[];
}

export async function fetchLeadRoi(params?: { from?: string; to?: string; source?: 'sales' | 'projects' }): Promise<LeadsRoiStats> {
  const res = await api.get<LeadsRoiStats>('/leads/roi', { params });
  return res.data;
}

export async function fetchLeadHistory(id: string): Promise<LeadActivityEntry[]> {
  const res = await api.get<LeadActivityEntry[]>(`/leads/${id}/history`);
  return res.data;
}

export interface CreateLeadDto {
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: LeadStatusCode;
  meta?: any;
  amount?: string;
  currency?: string;
  companyId?: string | null;
  assignedToList?: string[];
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
  tasks?: LeadTask[];
  customFields?: Record<string, any>;
  comments?: EntityComment[];
}

export async function updateLead(payload: UpdateLeadDto) {
  const { id, ...body } = payload;
  const res = await api.patch<LeadDto>(`/leads/${id}`, body);
  return mapLeadDto(res.data);
}

export async function deleteLead(id: string) {
  await api.delete(`/leads/${id}`);
}

export interface ConvertLeadDto {
  companyName?: string;
  markWon?: boolean;
}

interface ConvertLeadResponse {
  lead: LeadDto;
  contact: { id: string; firstName: string | null; lastName: string | null };
  company: { id: string; name: string } | null;
  contactCreated: boolean;
  companyCreated: boolean;
}

export interface ConvertLeadResult {
  lead: Lead;
  contact: { id: string; firstName: string | null; lastName: string | null };
  company: { id: string; name: string } | null;
  contactCreated: boolean;
  companyCreated: boolean;
}

/** POST /leads/:id/convert — finds-or-creates a Contact (matched by phone/email) and, when
 * `companyName` is given, a Company too, then links both to the lead. Real backend capability
 * (`leads.controller.ts`) that had no mobile surface at all. */
export async function convertLead(id: string, payload: ConvertLeadDto): Promise<ConvertLeadResult> {
  const res = await api.post<ConvertLeadResponse>(`/leads/${id}/convert`, payload);
  return { ...res.data, lead: mapLeadDto(res.data.lead) };
}
