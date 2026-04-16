import { api } from './client';

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




