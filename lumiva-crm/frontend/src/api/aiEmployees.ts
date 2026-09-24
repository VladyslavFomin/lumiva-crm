import { api } from './client';

export type AiEmployeeRoleKey =
  | 'lead_manager'
  | 'sales_manager'
  | 'marketing_manager'
  | 'marketing_analyst'
  | 'support_manager'
  | 'project_manager'
  | 'smm_manager'
  | 'email_assistant'
  | 'crm_analyst'
  | 'reservation_assistant';

export type AiAgentStatus = 'active' | 'paused' | 'disabled' | 'setup_required';
export type AiAgentAutonomyMode = 'suggest' | 'assisted' | 'auto';
export type AiAgentActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

export interface AiEmployeeRole {
  key: AiEmployeeRoleKey;
  title: string;
  shortTitle: string;
  defaultName: string;
  department: string;
  jobTitle: string;
  minPlan: string;
  accent: string;
  description: string;
  functions: string[];
  defaultPermissions: string[];
  defaultApprovalRules: string[];
  available: boolean;
  locked: boolean;
  badge: string;
  defaultTriggers?: Array<{ event: string; scope: AiTriggerScope }>;
  assignableEntityTypes?: AiAssignableEntityType[];
}

export interface AiAgent {
  id: string;
  tenantId: string;
  role: AiEmployeeRoleKey;
  roleTitle?: string;
  roleShortTitle?: string;
  roleDescription?: string;
  roleAccent?: string;
  roleFunctions?: string[];
  roleAssignableEntityTypes?: AiAssignableEntityType[];
  name: string;
  avatarUrl: string | null;
  department: string | null;
  jobTitle: string | null;
  language: string;
  tone: string;
  status: AiAgentStatus;
  autonomyMode: AiAgentAutonomyMode;
  provider: string;
  model: string | null;
  dailyReportTime: string;
  scheduleMode: 'always' | 'business_hours' | 'custom' | 'manual';
  createdBy: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  stats?: AiAgentStats;
  /** Только в списке (`GET /ai-agents`) — батч-реальные permissions/approvalRules для отпечатка
   * доступа в ростере. В детальном ответе (`GET /ai-agents/:id`) они приходят отдельными полями
   * верхнего уровня (`AiAgentDetailResponse.permissions`/`.approvalRules`), не здесь. */
  permissions?: Record<string, boolean>;
  approvalRules?: Record<string, boolean>;
}

export interface AiAgentStats {
  actionsToday?: number;
  executedToday?: number;
  failedToday?: number;
  blockedToday?: number;
  autoPausedReason?: string | null;
  pendingApprovals?: number;
  reportsGenerated?: number;
  errors?: number;
  lastActivityAt?: string | null;
  lastActivity?: string | null;
}

export interface AiPlanSnapshot {
  plan: string;
  rawPlan: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
  allowedRoles?: AiEmployeeRoleKey[];
  roles?: AiEmployeeRole[];
}

export interface AiAgentAction {
  id: string;
  tenantId: string;
  agentId: string;
  actionType: string;
  targetType: string | null;
  targetId: string | null;
  title: string;
  reason: string | null;
  payload: Record<string, unknown> | null;
  status: AiAgentActionStatus;
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
  agent?: AiAgent | null;
}

export interface AiAgentLog {
  id: string;
  tenantId: string;
  agentId: string | null;
  actionId: string | null;
  userId: string | null;
  eventType: string;
  targetType: string | null;
  targetId: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  status: string;
  errorMessage: string | null;
  model: string | null;
  tokensUsed: number;
  createdAt: string;
  agent?: AiAgent | null;
}

export interface AiAgentReport {
  id: string;
  tenantId: string;
  agentId: string;
  reportType: string;
  title: string;
  contentMd: string;
  contentJson: Record<string, unknown> | null;
  periodStart: string | null;
  periodEnd: string | null;
  sentTo: string[] | null;
  status: 'draft' | 'generated' | 'sent' | 'failed';
  createdAt: string;
  agent?: AiAgent | null;
}

export interface AiAgentsListResponse {
  items: AiAgent[];
  plan: AiPlanSnapshot;
  roles: AiEmployeeRole[];
  kpis: {
    activeAiEmployees: number;
    tasksCompletedToday: number;
    pendingApprovals: number;
    reportsGenerated: number;
    leadsAnalyzed: number;
    messagesDrafted: number;
    issuesDetected: number;
  };
  recentLogs: AiAgentLog[];
}

export interface AiAgentDetailResponse {
  agent: AiAgent;
  permissions: Record<string, boolean>;
  approvalRules: Record<string, boolean>;
  permissionKeys: string[];
  approvalActionTypes: string[];
  stats: AiAgentStats;
  recentActions: AiAgentAction[];
  recentLogs: AiAgentLog[];
  reports: AiAgentReport[];
  latestReport: AiAgentReport | null;
  /** Кому "закреплён" агент для контактной подсказки в профиле — чисто информационное, не гейт
   * доступа (доступ к разделу решает RBAC 'ai_employees' на бэкенде). */
  responsible: { staffId: string; name: string; role: string; via: string } | null;
  role: AiEmployeeRole;
}

export interface CreateAiAgentBody {
  role: AiEmployeeRoleKey;
  name?: string;
  avatarUrl?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  language?: string;
  tone?: string;
  autonomyMode?: AiAgentAutonomyMode;
  status?: AiAgentStatus;
  provider?: string;
  model?: string | null;
  dailyReportTime?: string;
  scheduleMode?: 'always' | 'business_hours' | 'custom' | 'manual';
  permissions?: Record<string, boolean> | string[];
  approvalRules?: Record<string, boolean> | string[];
  settings?: Record<string, unknown> | null;
}

export async function fetchAiEmployees(): Promise<AiAgentsListResponse> {
  return api.get<AiAgentsListResponse>('/ai-agents');
}

export interface AiAssignableRosterItem {
  id: string;
  name: string;
  status: AiAgentStatus;
  role: AiEmployeeRoleKey;
  roleShortTitle: string;
  roleAssignableEntityTypes: AiAssignableEntityType[];
}

/** Минимальный список нанятых ИИ-сотрудников — доступен всем (не за 'ai_employees'), для виджета
 * назначения ИИ на свою запись (AiAssigneeGroup). Полный fetchAiEmployees() теперь ограничен
 * руководителями отделов/владельцем (см. round 14). */
/** objectId — сузить до сотрудников, у которых реально есть доступ (право + грант) именно к
 * этой таблице рабочей области; без него — прежний общий список для назначения на лид/проект/etc. */
export async function fetchAiAssignableRoster(
  objectId?: string,
  access?: 'read' | 'write',
): Promise<AiAssignableRosterItem[]> {
  const params: Record<string, string> = {};
  if (objectId) params.objectId = objectId;
  if (access) params.access = access;
  return api.get<AiAssignableRosterItem[]>('/ai-assignments/roster', Object.keys(params).length ? { params } : undefined);
}

export async function fetchAiEmployee(id: string): Promise<AiAgentDetailResponse> {
  return api.get<AiAgentDetailResponse>(`/ai-agents/${encodeURIComponent(id)}`);
}

export async function createAiEmployee(body: CreateAiAgentBody): Promise<AiAgentDetailResponse> {
  return api.post<AiAgentDetailResponse>('/ai-agents', body);
}

export async function updateAiEmployee(
  id: string,
  body: Partial<CreateAiAgentBody>,
): Promise<AiAgentDetailResponse> {
  return api.patch<AiAgentDetailResponse>(`/ai-agents/${encodeURIComponent(id)}`, body);
}

export async function deleteAiEmployee(id: string): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>(`/ai-agents/${encodeURIComponent(id)}`);
}

export async function pauseAiEmployee(id: string): Promise<AiAgentDetailResponse> {
  return api.post<AiAgentDetailResponse>(`/ai-agents/${encodeURIComponent(id)}/pause`, {});
}

export async function resumeAiEmployee(id: string): Promise<AiAgentDetailResponse> {
  return api.post<AiAgentDetailResponse>(`/ai-agents/${encodeURIComponent(id)}/resume`, {});
}

export async function runAiEmployeeNow(id: string): Promise<{
  ok: boolean;
  summary: string;
  risks: string[];
  reportPreview: string;
  createdActions: AiAgentAction[];
  usedFallback: boolean;
}> {
  return api.post(`/ai-agents/${encodeURIComponent(id)}/run-now`, {});
}

export async function generateAiEmployeeReport(id: string): Promise<{
  ok: boolean;
  report: AiAgentReport;
  usedFallback: boolean;
}> {
  return api.post(`/ai-agents/${encodeURIComponent(id)}/generate-report`, {
    reportType: 'daily',
  });
}

export async function fetchAiRoles(): Promise<AiEmployeeRole[]> {
  return api.get<AiEmployeeRole[]>('/ai-roles');
}

export async function fetchAiPlanLimits(): Promise<AiPlanSnapshot> {
  return api.get<AiPlanSnapshot>('/ai-plan-limits');
}

export async function updateAiEmployeePermissions(
  id: string,
  permissions: Record<string, boolean>,
): Promise<{ permissions: Record<string, boolean>; permissionKeys: string[] }> {
  return api.patch(`/ai-agents/${encodeURIComponent(id)}/permissions`, { permissions });
}

export async function updateAiEmployeeApprovalRules(
  id: string,
  approvalRules: Record<string, boolean>,
): Promise<{ approvalRules: Record<string, boolean>; approvalActionTypes: string[] }> {
  return api.patch(`/ai-agents/${encodeURIComponent(id)}/approval-rules`, { approvalRules });
}

export async function fetchAiActions(params?: {
  agentId?: string;
  status?: string;
  actionType?: string;
  limit?: number;
}): Promise<{ items: AiAgentAction[] }> {
  return api.get('/ai-actions', { params });
}

export async function fetchPendingAiActions(): Promise<{ items: AiAgentAction[] }> {
  return api.get('/ai-actions/pending');
}

export async function approveAiAction(id: string): Promise<{ ok: boolean; action: AiAgentAction }> {
  return api.post(`/ai-actions/${encodeURIComponent(id)}/approve`, {});
}

export async function rejectAiAction(
  id: string,
  reason?: string,
): Promise<{ ok: boolean; action: AiAgentAction }> {
  return api.post(`/ai-actions/${encodeURIComponent(id)}/reject`, { reason });
}

export async function executeAiAction(id: string): Promise<{ ok: boolean; action: AiAgentAction }> {
  return api.post(`/ai-actions/${encodeURIComponent(id)}/execute`, {});
}

export async function fetchAiLogs(params?: {
  agentId?: string;
  status?: string;
  eventType?: string;
  limit?: number;
}): Promise<{ items: AiAgentLog[] }> {
  return api.get('/ai-logs', { params });
}

export async function fetchAiReports(params?: {
  agentId?: string;
  limit?: number;
}): Promise<{ items: AiAgentReport[] }> {
  return api.get('/ai-reports', { params });
}

export async function sendAiReport(
  id: string,
  sentTo?: string[],
): Promise<{ ok: boolean; report: AiAgentReport }> {
  return api.post(`/ai-reports/${encodeURIComponent(id)}/send`, { sentTo });
}

/* ------------------------------------------------------------------ config: instructions / triggers / tables */

export type AiTriggerScope = 'all' | 'mine';

export interface AiTriggerConfig {
  event: string;
  enabled: boolean;
  scope: AiTriggerScope;
  prompt: string;
}

export interface AiTableGrant {
  objectId: string;
  access: 'read' | 'write';
}

export interface AiTableAccess {
  mode: 'all' | 'selected';
  tables: AiTableGrant[];
}

export type AiClientDialogue = 'approval' | 'auto';

export interface AiSlaConfig {
  enabled: boolean;
  minutes: number;
}

export interface AiDailyPlanConfig {
  enabled: boolean;
  time: string;
}

export interface AiEmailInboxAccess {
  accountIds: string[];
}

export interface AiAgentConfig {
  instructions: string;
  triggers: AiTriggerConfig[];
  tableAccess: AiTableAccess;
  clientDialogue: AiClientDialogue;
  sla: AiSlaConfig;
  dailyPlan: AiDailyPlanConfig;
  emailInboxAccess: AiEmailInboxAccess;
  timezone: string;
}

export async function fetchAiAgentConfig(id: string): Promise<{ config: AiAgentConfig }> {
  return api.get(`/ai-agents/${encodeURIComponent(id)}/config`);
}

export async function updateAiAgentConfig(
  id: string,
  patch: Partial<AiAgentConfig>,
): Promise<{ config: AiAgentConfig }> {
  return api.patch(`/ai-agents/${encodeURIComponent(id)}/config`, patch);
}

/* ------------------------------------------------------------------ one-off tasks */

export async function assignAiTask(
  id: string,
  input: { task: string; entityType?: string; entityId?: string; priority?: string; runNow?: boolean },
): Promise<{ ok: boolean; action: AiAgentAction }> {
  return api.post(`/ai-agents/${encodeURIComponent(id)}/tasks`, input);
}

export async function fetchAiAgentTasks(id: string): Promise<{ items: AiAgentAction[] }> {
  return api.get(`/ai-agents/${encodeURIComponent(id)}/tasks`);
}

/* ------------------------------------------------------------------ AI as responsible */

export type AiAssignableEntityType = 'lead' | 'project' | 'company_task' | 'company' | 'contact' | 'custom_object_record';

export interface AiAssignee {
  agentId: string;
  name: string;
  role: AiEmployeeRoleKey;
  status: AiAgentStatus;
  avatarAccent: string | null;
  avatarStyle: string | null;
}

export async function fetchAiAssignments(
  entityType: AiAssignableEntityType,
  entityId: string,
): Promise<{ items: AiAssignee[] }> {
  return api.get('/ai-assignments', { params: { entityType, entityId } });
}

export async function setAiAssignment(input: {
  agentId: string;
  entityType: AiAssignableEntityType;
  entityId: string;
  assigned: boolean;
}): Promise<{ ok: boolean; assigned: boolean }> {
  return api.put('/ai-assignments', input);
}

export interface AiAgentAssignmentItem {
  id: string;
  entityType: AiAssignableEntityType;
  entityId: string;
  name: string | null;
  status: string | null;
  createdAt: string;
}

export async function fetchAiAgentAssignments(id: string): Promise<{ items: AiAgentAssignmentItem[] }> {
  return api.get(`/ai-agents/${encodeURIComponent(id)}/assignments`);
}

/* ------------------------------------------------------------------ activity feed */

export interface AiActivityItem {
  id: string;
  type: string;
  status: string;
  title: string | null;
  detail: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  agent: AiAgent | null;
}

export async function fetchAiActivity(params?: {
  limit?: number;
  since?: string;
}): Promise<{ serverTime: string; pendingApprovals: number; agentsCount: number; items: AiActivityItem[] }> {
  return api.get('/ai-activity', { params });
}

export async function fetchAiAssignmentsBatch(
  entityType: AiAssignableEntityType,
  ids: string[],
): Promise<{ items: Record<string, AiAssignee[]> }> {
  return api.post('/ai-assignments/batch', { entityType, ids });
}

export async function checkAiSlaNow(id: string): Promise<{ breaches: number; escalated: number }> {
  return api.post(`/ai-agents/${encodeURIComponent(id)}/sla-check`, {});
}

export async function runAiDailyPlanNow(id: string): Promise<{ staff: number }> {
  return api.post(`/ai-agents/${encodeURIComponent(id)}/daily-plan`, {});
}

/* ------------------------------------------------------------------ knowledge base */

export interface AiKnowledgeItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  alwaysOn: boolean;
  enabled: boolean;
  updatedAt: string;
}

export async function fetchAiKnowledge(): Promise<{ items: AiKnowledgeItem[] }> {
  return api.get('/ai-knowledge');
}

export async function saveAiKnowledge(
  input: Partial<Pick<AiKnowledgeItem, 'id' | 'title' | 'content' | 'tags' | 'alwaysOn' | 'enabled'>>,
): Promise<{ item: AiKnowledgeItem }> {
  return api.post('/ai-knowledge', input);
}

export async function deleteAiKnowledge(id: string): Promise<{ ok: boolean }> {
  return api.delete(`/ai-knowledge/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ benefit report */

export interface AiInsightsAgent {
  agentId: string;
  name: string;
  role: AiEmployeeRoleKey;
  status: AiAgentStatus;
  settings: Record<string, unknown> | null;
  eventRuns: number;
  actionsExecuted: number;
  actionsFailed: number;
  actionsPending: number;
  actionsRejected: number;
  approvalRate: number | null;
  clientMessages: number;
  escalations: number;
  slaBreaches: number;
  recordsHandled: number;
  actionsByType: Record<string, number>;
  minutesSaved: number;
}

export interface AiInsights {
  days: number;
  totals: {
    eventRuns: number;
    actionsExecuted: number;
    clientMessages: number;
    escalations: number;
    recordsHandled: number;
    minutesSaved: number;
    actionsRejected: number;
  };
  agents: AiInsightsAgent[];
  lessons: Array<{ agentName: string; actionType: string; title: string; reason: string | null; createdAt: string }>;
}

export async function fetchAiInsights(days = 30): Promise<AiInsights> {
  return api.get('/ai-insights', { params: { days } });
}

/* ------------------------------------------------------------------ expand instructions with AI */

export interface ExpandInstructionsInput {
  role: AiEmployeeRoleKey;
  agentId?: string;
  name?: string;
  department?: string;
  jobTitle?: string;
  language?: string;
  tone?: string;
  draft?: string;
}

export async function expandAiInstructions(input: ExpandInstructionsInput): Promise<{ text: string }> {
  return api.post('/ai-agents/expand-instructions', input);
}

export interface AiLesson {
  id: string;
  text: string;
  at: string;
}

export async function fetchAiLessons(id: string): Promise<{ lessons: AiLesson[] }> {
  return api.get(`/ai-agents/${encodeURIComponent(id)}/lessons`);
}

export async function deleteAiLesson(id: string, lessonId: string): Promise<{ ok: boolean }> {
  return api.delete(`/ai-agents/${encodeURIComponent(id)}/lessons/${encodeURIComponent(lessonId)}`);
}

export async function askAiEmployee(
  id: string,
  input: {
    message: string;
    entityType: string;
    entityId: string;
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  },
): Promise<{ ok: boolean; answer: string }> {
  return api.post(`/ai-agents/${encodeURIComponent(id)}/ask`, input);
}
