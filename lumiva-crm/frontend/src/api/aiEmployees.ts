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
export type AiAgentAutonomyMode = 'read_only' | 'suggest' | 'assisted' | 'auto';
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
}

export interface AiAgentStats {
  actionsToday?: number;
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
