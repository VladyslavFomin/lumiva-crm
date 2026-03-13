// src/api/departments.ts
import { api } from './client';

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parent?: Department | null;
  children?: Department[];
  managerId: string | null;
  manager?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  staff?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
  }>;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentDto {
  name: string;
  description?: string | null;
  parentId?: string | null;
  managerId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateDepartmentDto {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  managerId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export const fetchDepartmentsTree = async (): Promise<Department[]> => {
  return api.get<Department[]>('/departments/tree');
};

export const fetchDepartments = async (): Promise<Department[]> => {
  return api.get<Department[]>('/departments');
};

export const fetchDepartment = async (id: string): Promise<Department> => {
  return api.get<Department>(`/departments/${id}`);
};

export const fetchDepartmentStaff = async (id: string): Promise<any[]> => {
  return api.get<any[]>(`/departments/${id}/staff`);
};

export const createDepartment = async (
  data: CreateDepartmentDto,
): Promise<Department> => {
  return api.post<Department>('/departments', data);
};

export const updateDepartment = async (
  id: string,
  data: UpdateDepartmentDto,
): Promise<Department> => {
  return api.patch<Department>(`/departments/${id}`, data);
};

export const deleteDepartment = async (id: string): Promise<void> => {
  return api.del(`/departments/${id}`);
};

