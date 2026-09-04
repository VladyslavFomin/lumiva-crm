import { api } from './client';
import type { ProjectTableMember, ProjectTableRole } from '../pages/projects/projectTableRole';

export type { ProjectTableMember, ProjectTableRole } from '../pages/projects/projectTableRole';

export interface ProjectTable {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  createdByStaffId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Таблицы, видимые текущему сотруднику: основная ("Таблица") + те, к которым его явно
 * добавили как участника. */
export async function fetchProjectTables() {
  return api.get<ProjectTable[]>('/project-tables');
}

export async function fetchProjectTable(id: string) {
  return api.get<ProjectTable>(`/project-tables/${id}`);
}

export async function createProjectTable(payload: { name: string }) {
  return api.post<ProjectTable>('/project-tables', payload);
}

export async function updateProjectTable(
  id: string,
  payload: Partial<{ name: string; sortOrder: number }>,
) {
  return api.patch<ProjectTable>(`/project-tables/${id}`, payload);
}

export async function deleteProjectTable(id: string) {
  return api.delete<{ ok: boolean }>(`/project-tables/${id}`);
}

export async function fetchProjectTableMembers(tableId: string) {
  return api.get<ProjectTableMember[]>(`/project-tables/${tableId}/members`);
}

export async function addProjectTableMember(
  tableId: string,
  payload: { staffUserId?: string; email?: string; role: ProjectTableRole },
) {
  return api.post<ProjectTableMember>(`/project-tables/${tableId}/members`, payload);
}

export async function updateProjectTableMemberRole(
  tableId: string,
  memberId: string,
  role: ProjectTableRole,
) {
  return api.patch<ProjectTableMember>(`/project-tables/${tableId}/members/${memberId}`, { role });
}

export async function removeProjectTableMember(tableId: string, memberId: string) {
  return api.delete<{ ok: boolean }>(`/project-tables/${tableId}/members/${memberId}`);
}
