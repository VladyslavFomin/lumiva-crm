import { api } from './client';

export interface ProjectStatusDef {
  id: string;
  value: string;
  color: string;
  order: number;
  isBuiltIn: boolean;
}

export async function fetchProjectStatusDefs(): Promise<ProjectStatusDef[]> {
  const res = await api.get<ProjectStatusDef[]>('/project-statuses');
  return res.data;
}
export async function createProjectStatusDef(value: string, color?: string): Promise<ProjectStatusDef> {
  const res = await api.post<ProjectStatusDef>('/project-statuses', { value, color });
  return res.data;
}
export async function updateProjectStatusDef(id: string, patch: Partial<Pick<ProjectStatusDef, 'value' | 'color' | 'order'>>): Promise<ProjectStatusDef> {
  const res = await api.patch<ProjectStatusDef>(`/project-statuses/${id}`, patch);
  return res.data;
}
export async function deleteProjectStatusDef(id: string): Promise<void> {
  await api.delete(`/project-statuses/${id}`);
}
export async function reorderProjectStatusDefs(orderedIds: string[]): Promise<void> {
  await api.patch('/project-statuses/reorder', { orderedIds });
}

export interface ProjectCurrencyDef {
  id: string;
  code: string;
  label: string | null;
  isDefault: boolean;
  order: number;
}

export async function fetchProjectCurrencyDefs(): Promise<ProjectCurrencyDef[]> {
  const res = await api.get<ProjectCurrencyDef[]>('/project-currencies');
  return res.data;
}
export async function createProjectCurrencyDef(code: string, label?: string): Promise<ProjectCurrencyDef> {
  const res = await api.post<ProjectCurrencyDef>('/project-currencies', { code: code.toUpperCase(), label });
  return res.data;
}
export async function updateProjectCurrencyDef(id: string, patch: Partial<Pick<ProjectCurrencyDef, 'code' | 'label' | 'isDefault' | 'order'>>): Promise<ProjectCurrencyDef> {
  const res = await api.patch<ProjectCurrencyDef>(`/project-currencies/${id}`, patch);
  return res.data;
}
export async function deleteProjectCurrencyDef(id: string): Promise<void> {
  await api.delete(`/project-currencies/${id}`);
}
export async function reorderProjectCurrencyDefs(orderedIds: string[]): Promise<void> {
  await api.patch('/project-currencies/reorder', { orderedIds });
}

export interface ProjectTagDef {
  id: string;
  value: string;
  color: string;
  order: number;
}

/** Tenant-defined project tags (`GET /project-tags`) — the same list the website offers when tagging a project. */
export async function fetchProjectTagDefs(): Promise<ProjectTagDef[]> {
  const res = await api.get<ProjectTagDef[]>('/project-tags');
  return res.data;
}
