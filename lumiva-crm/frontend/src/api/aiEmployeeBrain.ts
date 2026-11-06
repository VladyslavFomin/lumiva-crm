import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';
import type { BrainFile } from './aiOffice';

/** «Мозг» ИИ-сотрудника: личные файлы + связка с «Мозгом» ИИ-офиса. */
export type EmployeeBrainSettings = {
  aiWrites: boolean;
  departmentIds: string[];
  includeShared: boolean;
  writeToDepartments: boolean;
};

export type EmployeeBrainDept = { id: string; name: string; color: string | null; curated: boolean; linked: boolean };

export type EmployeeBrainOverview = {
  files: BrainFile[];
  settings: EmployeeBrainSettings;
  officeAvailable: boolean;
  departments: EmployeeBrainDept[];
};

const B = (agentId: string) => `/ai-agents/${agentId}/brain`;

export const employeeBrainApi = {
  overview: (agentId: string) => api.get<EmployeeBrainOverview>(B(agentId)),
  saveSettings: (agentId: string, body: Partial<EmployeeBrainSettings>) => api.put<EmployeeBrainOverview>(`${B(agentId)}/settings`, body),
  preview: (agentId: string, q: string) =>
    api.get<{ block: string; fileIds: string[]; writeTargets: Array<{ id: string; name: string }>; canWrite: boolean }>(
      `${B(agentId)}/preview?q=${encodeURIComponent(q)}`,
    ),
  file: (agentId: string, id: string) => api.get<BrainFile>(`${B(agentId)}/files/${id}`),
  createDoc: (agentId: string, body: { name: string; bodyMd: string }) => api.post<BrainFile>(`${B(agentId)}/docs`, body),
  upload: (agentId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.postForm<BrainFile>(`${B(agentId)}/files`, form);
  },
  update: (agentId: string, id: string, body: { name?: string; bodyMd?: string }) => api.patch<BrainFile>(`${B(agentId)}/files/${id}`, body),
  remove: (agentId: string, id: string) => api.delete<{ ok: boolean }>(`${B(agentId)}/files/${id}`),
};

export async function downloadEmployeeBrainFile(agentId: string, id: string, name: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${B(agentId)}/files/${id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const url = window.URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
