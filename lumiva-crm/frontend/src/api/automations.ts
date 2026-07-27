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
  | 'custom_object.status_changed'
  | 'shopify.payment_received'
  | 'booking.reservation_created'
  | 'booking.reservation_status_changed'
  | 'booking.reservation_rescheduled'
  | 'booking.waitlist_entry_created'
  | 'hotel.reservation_created'
  | 'hotel.reservation_status_changed'
  | 'hotel.price_changed'
  | 'hotel.stop_sale_set'
  | 'hotel.low_availability';

export type ActionType =
  | 'create_task'
  | 'assign_task'
  | 'send_email'
  | 'send_telegram'
  | 'send_slack'
  | 'send_teams'
  | 'send_mailchimp'
  | 'send_mailchimp_campaign'
  | 'send_zapier'
  | 'send_whatsapp'
  | 'send_google_calendar'
  | 'send_outlook_calendar'
  | 'send_bitrix'
  | 'send_amocrm'
  | 'send_hubspot'
  | 'send_google_ads'
  | 'send_meta_ads'
  | 'send_notification'
  | 'update_field'
  | 'add_tag'
  | 'remove_tag'
  | 'change_status'
  | 'assign_user'
  | 'trigger_webhook'
  | 'create_note'
  | 'send_report'
  | 'send_data_export'
  | 'create_custom_object_record'
  | 'create_jira_issue';

export interface Condition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'greater_or_equal'
    | 'less_or_equal'
    | 'is_empty'
    | 'is_not_empty'
    | 'starts_with'
    | 'ends_with';
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
  automation?: Pick<Automation, 'id' | 'name'>;
}

export interface AutomationUsageStats {
  periodDays: number;
  since: string;
  executions: {
    total: number;
    success: number;
    error: number;
    pending: number;
    skipped: number;
  };
  byTrigger: Array<{ triggerEvent: string; count: number }>;
  topAutomations: Array<{ automationId: string; name: string; runs: number }>;
  automations: { total: number; active: number };
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
  const res = await api.get<Automation[]>('/automations', {
    params: isActive !== undefined ? { isActive } : {},
  });
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

export async function updateAutomation(
  id: string,
  dto: UpdateAutomationDto,
): Promise<Automation> {
  const res = await api.patch<Automation>(`/automations/${id}`, dto);
  return res;
}

export async function deleteAutomation(id: string): Promise<void> {
  await api.delete(`/automations/${id}`);
}

export interface RunAutomationNowResult {
  success: boolean;
  errorMessage?: string | null;
}

export type RunAutomationNowBody = {
  rangePreset?: 'last_7_days' | 'last_30_days' | 'this_month' | 'yesterday' | 'custom';
  dateFrom?: string;
  dateTo?: string;
};

export async function runAutomationNow(
  id: string,
  body?: RunAutomationNowBody,
): Promise<RunAutomationNowResult> {
  return api.post<RunAutomationNowResult>(`/automations/${id}/run-now`, body ?? {});
}

export async function fetchAutomationExecutions(
  automationId?: string,
  limit?: number,
  status?: string,
): Promise<AutomationExecution[]> {
  if (automationId) {
    return api.get<AutomationExecution[]>(`/automations/${automationId}/executions`, {
      params: { limit, status },
    });
  }
  return api.get<AutomationExecution[]>('/automations/executions', {
    params: { limit, status },
  });
}

export async function fetchAutomationUsageStats(
  days?: number,
): Promise<AutomationUsageStats> {
  return api.get<AutomationUsageStats>('/automations/usage', {
    params: days !== undefined ? { days } : {},
  });
}
