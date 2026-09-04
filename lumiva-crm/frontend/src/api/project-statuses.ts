// src/api/project-statuses.ts
import { api } from './client';

export interface ProjectStatusDefinition {
  id: string;
  tenantId: string;
  value: string;
  color: string;
  order: number;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectStatusDto {
  value: string;
  color?: string;
}

export interface UpdateProjectStatusDto {
  value?: string;
  color?: string;
  order?: number;
}

export async function fetchProjectStatuses(): Promise<ProjectStatusDefinition[]> {
  return api.get<ProjectStatusDefinition[]>('/project-statuses');
}

export async function createProjectStatus(dto: CreateProjectStatusDto): Promise<ProjectStatusDefinition> {
  return api.post<ProjectStatusDefinition>('/project-statuses', dto);
}

export async function updateProjectStatus(id: string, dto: UpdateProjectStatusDto): Promise<ProjectStatusDefinition> {
  return api.patch<ProjectStatusDefinition>(`/project-statuses/${id}`, dto);
}

export async function deleteProjectStatus(id: string): Promise<void> {
  await api.delete(`/project-statuses/${id}`);
}

export async function reorderProjectStatuses(orderedIds: string[]): Promise<ProjectStatusDefinition[]> {
  return api.patch<ProjectStatusDefinition[]>('/project-statuses/reorder', { orderedIds });
}
