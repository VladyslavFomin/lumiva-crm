import { api } from './client';

export interface AutomationAction {
  type: string;
  config: Record<string, any>;
}

export interface AutomationCondition {
  field: string;
  operator: string;
  value?: any;
}

export interface AutomationDto {
  id: string;
  name: string;
  description: string | null;
  triggerEvent: string;
  conditions: AutomationCondition[] | null;
  actions: AutomationAction[];
  isActive: boolean;
  executionCount: number;
  errorCount: number;
  lastExecutedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export type Automation = AutomationDto;

export async function fetchAutomations(): Promise<Automation[]> {
  const res = await api.get<Automation[] | { items?: Automation[] }>('/automations');
  return Array.isArray(res.data) ? res.data : res.data?.items || [];
}

export async function fetchAutomation(id: string): Promise<Automation> {
  const res = await api.get<Automation>(`/automations/${id}`);
  return res.data;
}

export async function setAutomationActive(id: string, isActive: boolean): Promise<Automation> {
  const res = await api.patch<Automation>(`/automations/${id}`, { isActive });
  return res.data;
}

export async function deleteAutomation(id: string): Promise<void> {
  await api.delete(`/automations/${id}`);
}

export async function runAutomationNow(id: string): Promise<void> {
  await api.post(`/automations/${id}/run-now`);
}
