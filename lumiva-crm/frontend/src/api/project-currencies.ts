// src/api/project-currencies.ts
import { api } from './client';

export interface ProjectCurrencyDefinition {
  id: string;
  tenantId: string;
  code: string;
  label: string | null;
  isDefault: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectCurrencyDto {
  code: string;
  label?: string;
  isDefault?: boolean;
}

export interface UpdateProjectCurrencyDto {
  code?: string;
  label?: string;
  isDefault?: boolean;
  order?: number;
}

export async function fetchProjectCurrencyDefinitions(): Promise<ProjectCurrencyDefinition[]> {
  return api.get<ProjectCurrencyDefinition[]>('/project-currencies');
}

export async function createProjectCurrencyDefinition(
  dto: CreateProjectCurrencyDto,
): Promise<ProjectCurrencyDefinition> {
  return api.post<ProjectCurrencyDefinition>('/project-currencies', dto);
}

export async function updateProjectCurrencyDefinition(
  id: string,
  dto: UpdateProjectCurrencyDto,
): Promise<ProjectCurrencyDefinition> {
  return api.patch<ProjectCurrencyDefinition>(`/project-currencies/${id}`, dto);
}

export async function deleteProjectCurrencyDefinition(id: string): Promise<void> {
  await api.delete(`/project-currencies/${id}`);
}

export async function reorderProjectCurrencyDefinitions(
  orderedIds: string[],
): Promise<ProjectCurrencyDefinition[]> {
  return api.patch<ProjectCurrencyDefinition[]>('/project-currencies/reorder', { orderedIds });
}
