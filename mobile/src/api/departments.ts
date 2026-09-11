import { api } from './client';
import type { Staff } from './staff';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchDepartments(): Promise<Department[]> {
  const res = await api.get<Department[] | { items?: Department[] }>('/departments');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data;
}

export async function fetchDepartment(id: string): Promise<Department> {
  const res = await api.get<Department>(`/departments/${id}`);
  return res.data;
}

export interface CreateDepartmentDto {
  name: string;
  description?: string | null;
  managerId?: string | null;
  parentId?: string | null;
}

export async function createDepartment(payload: CreateDepartmentDto): Promise<Department> {
  const res = await api.post<Department>('/departments', payload);
  return res.data;
}

export interface UpdateDepartmentDto {
  id: string;
  name?: string | null;
  description?: string | null;
  managerId?: string | null;
  parentId?: string | null;
}

export async function updateDepartment(payload: UpdateDepartmentDto): Promise<Department> {
  const { id, ...body } = payload;
  const res = await api.patch<Department>(`/departments/${id}`, body);
  return res.data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`/departments/${id}`);
}

export interface DepartmentNode extends Department {
  children?: DepartmentNode[];
}

/** GET /departments/tree — parent/child nesting built server-side (same rows as fetchDepartments,
 * just already grouped instead of a flat list keyed by parentId). */
export async function fetchDepartmentsTree(): Promise<DepartmentNode[]> {
  const res = await api.get<DepartmentNode[]>('/departments/tree');
  return res.data;
}

export interface DepartmentsSummary {
  departmentsCount: number;
  staffInDepartments: number;
  totalActiveStaff: number;
  departmentsWithoutManager: number;
  unassignedStaffCount: number;
}
export async function fetchDepartmentsSummary(): Promise<DepartmentsSummary> {
  const res = await api.get<DepartmentsSummary>('/departments/summary');
  return res.data;
}

export interface DepartmentStats {
  staffCount: number;
  staffCountRecursive: number;
  leadsInProgress: number;
  salesClosed30d: number;
  salesClosed30dAmount: number;
  conversionPct: number | null;
}
/** Real Lead/Sale-derived stats for a department (including its sub-departments) — no invented
 * "load %"/"avg response time" metrics, the backend has nothing to compute those from. */
export async function fetchDepartmentStats(id: string): Promise<DepartmentStats> {
  const res = await api.get<DepartmentStats>(`/departments/${id}/stats`);
  return res.data;
}

/** Staff of this department AND every sub-department, recursively — GET /departments/:id/staff. */
export async function fetchDepartmentStaffRecursive(id: string): Promise<Staff[]> {
  const res = await api.get<Staff[]>(`/departments/${id}/staff`);
  return res.data;
}




