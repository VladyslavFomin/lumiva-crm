// src/api/companies.ts
import { api } from './client';
import type { LegalRequisiteItem } from '../legal/legalRequisites';

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  size: string | null;
  description: string | null;
  tags: string[];
  assignedUserId: string | null;
  assignedTo: string | null;
  status: string;
  customFields: Record<string, any> | null;
  legalRequisites: LegalRequisiteItem[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyDto {
  name: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  city?: string;
  address?: string;
  industry?: string;
  size?: string;
  description?: string;
  tags?: string[];
  assignedUserId?: string;
  assignedTo?: string;
  status?: string;
  customFields?: Record<string, any>;
  legalRequisites?: LegalRequisiteItem[];
}

export interface UpdateCompanyDto extends Partial<CreateCompanyDto> {}

export interface ListCompaniesQuery {
  search?: string;
  status?: string;
  assignedUserId?: string;
  industry?: string;
  tags?: string[];
  country?: string;
  limit?: number;
  offset?: number;
}

export async function fetchCompanies(query?: ListCompaniesQuery): Promise<{ items: Company[]; total: number }> {
  const res = await api.get<{ items: Company[]; total: number }>('/companies', { params: query });
  return res;
}

export async function fetchCompany(id: string): Promise<Company> {
  const res = await api.get<Company>(`/companies/${id}`);
  return res;
}

export async function createCompany(dto: CreateCompanyDto): Promise<Company> {
  const res = await api.post<Company>('/companies', dto);
  return res;
}

export async function updateCompany(id: string, dto: UpdateCompanyDto): Promise<Company> {
  const res = await api.patch<Company>(`/companies/${id}`, dto);
  return res;
}

export async function deleteCompany(id: string): Promise<void> {
  await api.delete(`/companies/${id}`);
}

// ========== ANALYTICS ==========

export interface CompanyAnalytics {
  company: {
    id: string;
    name: string;
  };
  contacts: {
    total: number;
  };
  leads: {
    total: number;
    byStatus: {
      new: number;
      in_progress: number;
      waiting: number;
      won: number;
      lost: number;
    };
  };
  projects: {
    total: number;
    byStatus: {
      Новый: number;
      'В работе': number;
      'На проверке': number;
      Заморожен: number;
      Закрыт: number;
    };
    totalAmount: number;
    closedAmount: number;
  };
  metrics: {
    conversionRate: number;
    avgProjectValue: number;
    totalRevenue: number;
    potentialRevenue: number;
  };
}

export interface AllCompaniesAnalytics {
  summary: {
    totalCompanies: number;
    totalLeads: number;
    totalProjects: number;
    totalRevenue: number;
    totalPotentialRevenue: number;
    avgConversionRate: number;
  };
  topByRevenue: Array<{
    companyId: string;
    companyName: string;
    revenue: number;
    projects: number;
    leads: number;
  }>;
  topByProjects: Array<{
    companyId: string;
    companyName: string;
    projects: number;
    revenue: number;
    leads: number;
  }>;
}

export async function fetchCompanyAnalytics(id: string): Promise<CompanyAnalytics> {
  const res = await api.get<CompanyAnalytics>(`/companies/${id}/analytics`);
  return res;
}

export async function fetchAllCompaniesAnalytics(): Promise<AllCompaniesAnalytics> {
  const res = await api.get<AllCompaniesAnalytics>('/companies/analytics/all');
  return res;
}

// ========== COMPANY TASKS ==========

export type CompanyTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

export interface CompanyTask {
  id: string;
  tenantId: string;
  companyId: string;
  title: string;
  description: string | null;
  status: CompanyTaskStatus;
  priority: string | null;
  dueDate: string | null;
  completedAt: string | null;
  assignedUserId: string | null;
  assignedTo: string | null;
  tags: string[];
  meta: Record<string, any> | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyTaskDto {
  companyId: string;
  title: string;
  description?: string;
  status?: CompanyTaskStatus;
  priority?: string;
  dueDate?: string;
  assignedUserId?: string;
  assignedTo?: string;
  tags?: string[];
  meta?: Record<string, any>;
  order?: number;
}

export interface UpdateCompanyTaskDto extends Partial<CreateCompanyTaskDto> {}

export async function fetchCompanyTasks(
  companyId: string,
  status?: CompanyTaskStatus,
): Promise<CompanyTask[]> {
  const res = await api.get<CompanyTask[]>(`/companies/${companyId}/tasks`, {
    params: status ? { status } : {},
  });
  return res;
}

export async function fetchCompanyTask(taskId: string): Promise<CompanyTask> {
  const res = await api.get<CompanyTask>(`/companies/tasks/${taskId}`);
  return res;
}

export async function createCompanyTask(dto: CreateCompanyTaskDto): Promise<CompanyTask> {
  const res = await api.post<CompanyTask>('/companies/tasks', dto);
  return res;
}

export async function updateCompanyTask(
  taskId: string,
  dto: UpdateCompanyTaskDto,
): Promise<CompanyTask> {
  const res = await api.patch<CompanyTask>(`/companies/tasks/${taskId}`, dto);
  return res;
}

export async function changeCompanyTaskStatus(
  taskId: string,
  status: CompanyTaskStatus,
  order?: number,
): Promise<CompanyTask> {
  const res = await api.patch<CompanyTask>(`/companies/tasks/${taskId}/status`, {
    status,
    order,
  });
  return res;
}

export async function deleteCompanyTask(taskId: string): Promise<void> {
  await api.delete(`/companies/tasks/${taskId}`);
}

// ========== BULK OPERATIONS ==========

export interface BulkUpdateCompaniesDto {
  companyIds: string[];
  assignedUserId?: string | null;
  assignedTo?: string | null;
  status?: string;
  tagsToAdd?: string[];
  tagsToRemove?: string[];
}

export interface BulkUpdateResult {
  success: boolean;
  updated: number;
}

export async function bulkUpdateCompanies(
  dto: BulkUpdateCompaniesDto,
): Promise<BulkUpdateResult> {
  const res = await api.post<BulkUpdateResult>('/companies/bulk-update', dto);
  return res;
}



