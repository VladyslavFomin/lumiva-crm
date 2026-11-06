// src/api/project-statuses.ts
import { api } from './client';

export interface ProjectStatusDefinition {
  id: string;
  tenantId: string;
  value: string;
  color: string;
  order: number;
  isBuiltIn: boolean;
  /** 'project' | 'deal' */
  kind?: string;
  /** 'won' | 'lost' | null — смысл статуса */
  outcome?: 'won' | 'lost' | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectStatusDto {
  value: string;
  color?: string;
  outcome?: 'won' | 'lost' | '';
}

export interface UpdateProjectStatusDto {
  value?: string;
  color?: string;
  order?: number;
  outcome?: 'won' | 'lost' | '';
}

export type StatusKind = 'project' | 'deal';
const kq = (kind?: StatusKind) => (kind === 'deal' ? '?kind=deal' : '');

export async function fetchProjectStatuses(kind?: StatusKind): Promise<ProjectStatusDefinition[]> {
  return api.get<ProjectStatusDefinition[]>(`/project-statuses${kq(kind)}`);
}

export async function createProjectStatus(dto: CreateProjectStatusDto, kind?: StatusKind): Promise<ProjectStatusDefinition> {
  return api.post<ProjectStatusDefinition>(`/project-statuses${kq(kind)}`, dto);
}

export async function updateProjectStatus(id: string, dto: UpdateProjectStatusDto): Promise<ProjectStatusDefinition> {
  return api.patch<ProjectStatusDefinition>(`/project-statuses/${id}`, dto);
}

export async function deleteProjectStatus(id: string): Promise<void> {
  await api.delete(`/project-statuses/${id}`);
}

export async function reorderProjectStatuses(orderedIds: string[], kind?: StatusKind): Promise<ProjectStatusDefinition[]> {
  return api.patch<ProjectStatusDefinition[]>(`/project-statuses/reorder${kq(kind)}`, { orderedIds });
}
