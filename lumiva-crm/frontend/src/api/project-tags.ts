// src/api/project-tags.ts
import { api } from './client';

export interface ProjectTagDefinition {
  id: string;
  tenantId: string;
  value: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectTagDto {
  value: string;
  color?: string;
}

export interface UpdateProjectTagDto {
  value?: string;
  color?: string;
  order?: number;
}

export async function fetchProjectTagDefinitions(): Promise<ProjectTagDefinition[]> {
  return api.get<ProjectTagDefinition[]>('/project-tags');
}

export async function createProjectTagDefinition(dto: CreateProjectTagDto): Promise<ProjectTagDefinition> {
  return api.post<ProjectTagDefinition>('/project-tags', dto);
}

export async function updateProjectTagDefinition(
  id: string,
  dto: UpdateProjectTagDto,
): Promise<ProjectTagDefinition> {
  return api.patch<ProjectTagDefinition>(`/project-tags/${id}`, dto);
}

export async function deleteProjectTagDefinition(id: string): Promise<void> {
  await api.delete(`/project-tags/${id}`);
}

export async function reorderProjectTagDefinitions(orderedIds: string[]): Promise<ProjectTagDefinition[]> {
  return api.patch<ProjectTagDefinition[]>('/project-tags/reorder', { orderedIds });
}
