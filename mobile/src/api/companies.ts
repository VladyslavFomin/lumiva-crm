import { api } from './client';
import { EntityComment } from './comments';

export interface CompanyLegalRequisite {
  id: string;
  type: string;
  value: string;
}

export interface CompanyDto {
  id: string;
  tenantId: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  legalRequisites: CompanyLegalRequisite[] | null;
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  industry: string | null;
  size: string | null;
  status: string | null;
  assignedTo: string | null;
  tags: string[] | null;
  customFields: Record<string, any> | null;
  comments: EntityComment[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  legalRequisites: CompanyLegalRequisite[];
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  industry: string | null;
  size: string | null;
  status: string | null;
  assignedTo: string | null;
  tags: string[];
  customFields: Record<string, any> | null;
  comments: EntityComment[];
  createdAt: string;
  updatedAt: string;
}

function mapCompany(dto: CompanyDto): Company {
  return {
    id: dto.id,
    name: dto.name,
    legalName: dto.legalName,
    taxId: dto.taxId,
    legalRequisites: dto.legalRequisites || [],
    description: dto.description,
    website: dto.website,
    email: dto.email,
    phone: dto.phone,
    address: dto.address,
    city: dto.city,
    industry: dto.industry,
    size: dto.size,
    status: dto.status,
    assignedTo: dto.assignedTo,
    tags: dto.tags || [],
    customFields: dto.customFields || null,
    comments: dto.comments || [],
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export async function fetchCompanies(): Promise<Company[]> {
  const res = await api.get<CompanyDto[] | { items?: CompanyDto[] }>('/companies');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data.map(mapCompany);
}

export interface CompanyAnalytics {
  contacts: { total: number };
  leads: { total: number };
  projects: { total: number };
  metrics: {
    currency: string;
    totalRevenueConverted: number;
    potentialRevenueConverted: number;
  };
}

export interface AllCompaniesAnalytics {
  summary: {
    totalCompanies: number;
    totalLeads: number;
    totalProjects: number;
    totalRevenue: number;
    totalPotentialRevenue: number;
    currency: string;
    avgConversionRate: number;
    avgWonConversionRate: number;
  };
  topByRevenue: { companyId: string; companyName: string; revenue: number; projects: number; leads: number }[];
  topByProjects: { companyId: string; companyName: string; projects: number; revenue: number; leads: number }[];
}

export async function fetchAllCompaniesAnalytics(): Promise<AllCompaniesAnalytics> {
  const res = await api.get<AllCompaniesAnalytics>('/companies/analytics/all');
  return res.data;
}

export async function fetchCompanyAnalytics(id: string): Promise<CompanyAnalytics> {
  const res = await api.get<CompanyAnalytics>(`/companies/${id}/analytics`);
  return res.data;
}

export async function fetchCompany(id: string): Promise<Company> {
  const res = await api.get<CompanyDto>(`/companies/${id}`);
  return mapCompany(res.data);
}

/** Lightweight projection of a company task as embedded in `?withRelations=true` — see the fuller
 * `CompanyTask` (with companyId/description/tags/order/etc.) further down, used by the dedicated
 * `/companies/:id/tasks` endpoints. */
export interface CompanyTaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  assignedTo: string | null;
}

export interface CompanyRelatedContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
}

export interface CompanyRelatedLead {
  id: string;
  name: string;
  status: string;
  amount: number;
  currency: string;
}

export interface CompanyRelatedProject {
  id: string;
  name: string;
  status: string;
  amount: number;
  currency: string;
  tasksCount: number;
}

export interface CompanyRelations {
  contacts: CompanyRelatedContact[];
  leads: CompanyRelatedLead[];
  projects: CompanyRelatedProject[];
  tasks: CompanyTaskSummary[];
}

export async function fetchCompanyRelations(id: string): Promise<CompanyRelations> {
  const res = await api.get<{ contacts: any[]; leads: any[]; projects: any[]; tasks: any[] }>(`/companies/${id}`, { params: { withRelations: 'true' } });
  return {
    contacts: (res.data.contacts || []).map((c: any) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, position: c.position })),
    leads: (res.data.leads || []).map((l: any) => ({ id: l.id, name: l.name, status: l.status, amount: Number(l.amount || 0), currency: l.currency || 'EUR' })),
    projects: (res.data.projects || []).map((p: any) => ({ id: p.id, name: p.name, status: p.status, amount: Number(p.amount || 0), currency: p.currency || 'EUR', tasksCount: (p.tasks || []).length })),
    tasks: (res.data.tasks || []).map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, assignedTo: t.assignedTo })),
  };
}

export interface CreateCompanyDto {
  name: string;
  description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  industry?: string | null;
  size?: string | null;
  status?: string | null;
  assignedTo?: string | null;
  tags?: string[] | null;
}

export async function createCompany(payload: CreateCompanyDto) {
  const res = await api.post<CompanyDto>('/companies', payload);
  return mapCompany(res.data);
}

export interface UpdateCompanyDto {
  id: string;
  name?: string | null;
  description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  industry?: string | null;
  size?: string | null;
  tags?: string[] | null;
  customFields?: Record<string, any>;
  comments?: EntityComment[];
}

export async function updateCompany(payload: UpdateCompanyDto) {
  const { id, ...body } = payload;
  const res = await api.patch<CompanyDto>(`/companies/${id}`, body);
  return mapCompany(res.data);
}

export async function deleteCompany(id: string) {
  await api.delete(`/companies/${id}`);
}

export type CompanyTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

export interface CompanyTask {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  status: CompanyTaskStatus;
  priority: string | null;
  dueDate: string | null;
  completedAt: string | null;
  assignedTo: string | null;
  tags: string[];
  order: number;
  createdAt: string;
}

export async function fetchCompanyTasks(companyId: string, status?: CompanyTaskStatus): Promise<CompanyTask[]> {
  const res = await api.get<CompanyTask[]>(`/companies/${companyId}/tasks`, { params: { status } });
  return res.data;
}

/** No tenant-wide "all company tasks" endpoint exists on the backend — company tasks are only
 * listable per company. Fetches every company's tasks in parallel and merges them client-side,
 * tagging each with the company name for display (real data, no fabrication — just an aggregation
 * the backend doesn't offer as a single call). */
export async function fetchAllCompanyTasks(companies: { id: string; name: string }[]): Promise<(CompanyTask & { companyName: string })[]> {
  const lists = await Promise.all(
    companies.map((c) => fetchCompanyTasks(c.id).then((tasks) => tasks.map((t) => ({ ...t, companyName: c.name }))).catch(() => [])),
  );
  return lists.flat();
}

export interface CreateCompanyTaskDto {
  companyId: string;
  title: string;
  description?: string | null;
  status?: CompanyTaskStatus;
  priority?: string | null;
  dueDate?: string | null;
  assignedTo?: string | null;
  tags?: string[];
}

export async function createCompanyTask(dto: CreateCompanyTaskDto): Promise<CompanyTask> {
  const res = await api.post<CompanyTask>('/companies/tasks', dto);
  return res.data;
}

export async function updateCompanyTask(taskId: string, patch: Partial<CreateCompanyTaskDto>): Promise<CompanyTask> {
  const res = await api.patch<CompanyTask>(`/companies/tasks/${taskId}`, patch);
  return res.data;
}

export async function changeCompanyTaskStatus(taskId: string, status: CompanyTaskStatus, order?: number): Promise<CompanyTask> {
  const res = await api.patch<CompanyTask>(`/companies/tasks/${taskId}/status`, { status, order });
  return res.data;
}

export async function deleteCompanyTask(taskId: string): Promise<void> {
  await api.delete(`/companies/tasks/${taskId}`);
}








