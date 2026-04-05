// src/api/automations.ts
import { api } from './client';

export type TriggerEvent =
  | 'contact.created'
  | 'contact.updated'
  | 'contact.tag_added'
  | 'company.created'
  | 'company.updated'
  | 'lead.created'
  | 'lead.updated'
  | 'lead.status_changed'
  | 'lead.assigned'
  | 'sale.created'
  | 'sale.updated'
  | 'sale.status_changed'
  | 'project.created'
  | 'project.status_changed'
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'report.scheduled'
  | 'scheduled'
  | 'email.received'
  | 'email.sent'
  | 'telegram.message_received'
  | 'note.created'
  | 'custom_object.record_created'
  | 'custom_object.record_updated'
  | 'custom_object.status_changed';

export type ActionType =
  | 'create_task'
  | 'assign_task'
  | 'send_email'
  | 'send_telegram'
  | 'send_notification'
  | 'update_field'
  | 'add_tag'
  | 'remove_tag'
  | 'change_status'
  | 'assign_user'
  | 'trigger_webhook'
  | 'create_note'
  | 'send_report';

export interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'is_empty' | 'is_not_empty' | 'starts_with' | 'ends_with';
  value?: any;
}

export interface Action {
  type: ActionType;
  config: Record<string, any>;
}

export interface Automation {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  triggerEvent: TriggerEvent;
  conditions: Condition[] | null;
  actions: Action[];
  isActive: boolean;
  executionCount: number;
  errorCount: number;
  lastExecutedAt: string | null;
  lastError: string | null;
  maxExecutions: number | null;
  cooldownSeconds: number | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecution {
  id: string;
  tenantId: string;
  automationId: string;
  triggerEvent: TriggerEvent;
  triggerData: any;
  entityType: string | null;
  entityId: string | null;
  status: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage: string | null;
  executionResult: any | null;
  actionsExecuted: number;
  createdAt: string;
}

export interface CreateAutomationDto {
  name: string;
  description?: string;
  triggerEvent: TriggerEvent;
  conditions?: Condition[];
  actions: Action[];
  isActive?: boolean;
  maxExecutions?: number;
  cooldownSeconds?: number;
  meta?: Record<string, unknown>;
}

export interface UpdateAutomationDto extends Partial<CreateAutomationDto> {}

export async function fetchAutomations(isActive?: boolean): Promise<Automation[]> {
  const res = await api.get<Automation[]>('/automations', { params: isActive !== undefined ? { isActive } : {} });
  return res;
}

export async function fetchAutomation(id: string): Promise<Automation> {
  const res = await api.get<Automation>(`/automations/${id}`);
  return res;
}

export async function createAutomation(dto: CreateAutomationDto): Promise<Automation> {
  const res = await api.post<Automation>('/automations', dto);
  return res;
}

export async function updateAutomation(id: string, dto: UpdateAutomationDto): Promise<Automation> {
  const res = await api.patch<Automation>(`/automations/${id}`, dto);
  return res;
}

export async function deleteAutomation(id: string): Promise<void> {
  await api.delete(`/automations/${id}`);
}

export async function fetchAutomationExecutions(automationId?: string, limit?: number): Promise<AutomationExecution[]> {
  const res = await api.get<AutomationExecution[]>(`/automations${automationId ? `/${automationId}` : ''}/executions`, {
    params: { limit },
  });
  return res;
}











