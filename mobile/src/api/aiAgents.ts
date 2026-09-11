import { api } from './client';
import { AiAgent } from './aiApprovals';

export type { AiAgent, AiAgentStats } from './aiApprovals';

export type AiAgentPermissionMap = Record<string, boolean>;
export type AiAgentApprovalRuleMap = Record<string, boolean>;

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

export interface AiAgentDetail {
  agent: AiAgent;
  permissions: AiAgentPermissionMap;
  approvalRules: AiAgentApprovalRuleMap;
  permissionKeys: string[];
  approvalActionTypes: string[];
  stats: Record<string, unknown>;
  recentActions: unknown[];
  recentLogs: AiAgentLog[];
  reports: AiAgentReport[];
  latestReport: AiAgentReport | null;
  role: { key: string; title: string; shortTitle: string; description: string; functions: string[]; accent: string };
}

export interface AiAgentRunResult {
  ok: boolean;
  summary: string;
  risks: string[];
  reportPreview: string;
  createdActions: unknown[];
  usedFallback: boolean;
}

export async function fetchAiAgentDetail(id: string): Promise<AiAgentDetail> {
  const res = await api.get<AiAgentDetail>(`/ai-agents/${id}`);
  return res.data;
}

export async function pauseAiAgent(id: string): Promise<AiAgentDetail> {
  const res = await api.post<AiAgentDetail>(`/ai-agents/${id}/pause`);
  return res.data;
}

export async function resumeAiAgent(id: string): Promise<AiAgentDetail> {
  const res = await api.post<AiAgentDetail>(`/ai-agents/${id}/resume`);
  return res.data;
}

export async function runAiAgentNow(id: string): Promise<AiAgentRunResult> {
  const res = await api.post<AiAgentRunResult>(`/ai-agents/${id}/run-now`);
  return res.data;
}

export async function fetchAiAgentPermissions(
  id: string,
): Promise<{ permissions: AiAgentPermissionMap; permissionKeys: string[] }> {
  const res = await api.get<{ permissions: AiAgentPermissionMap; permissionKeys: string[] }>(
    `/ai-agents/${id}/permissions`,
  );
  return res.data;
}

export async function updateAiAgentPermissions(
  id: string,
  patch: AiAgentPermissionMap,
): Promise<{ permissions: AiAgentPermissionMap; permissionKeys: string[] }> {
  const res = await api.patch<{ permissions: AiAgentPermissionMap; permissionKeys: string[] }>(
    `/ai-agents/${id}/permissions`,
    { permissions: patch },
  );
  return res.data;
}

export async function fetchAiAgentLogs(
  id: string,
  params?: { status?: string; eventType?: string; limit?: number },
): Promise<AiAgentLog[]> {
  const res = await api.get<AiAgentLog[] | { items?: AiAgentLog[] }>(`/ai-agents/${id}/logs`, {
    params,
  });
  return Array.isArray(res.data) ? res.data : res.data?.items || [];
}

export async function fetchAiAgentReports(
  id: string,
  params?: { limit?: number },
): Promise<AiAgentReport[]> {
  const res = await api.get<AiAgentReport[] | { items?: AiAgentReport[] }>(`/ai-agents/${id}/reports`, {
    params,
  });
  return Array.isArray(res.data) ? res.data : res.data?.items || [];
}

export async function generateAiAgentReport(
  id: string,
  body?: { reportType?: string; periodStart?: string; periodEnd?: string },
): Promise<{ ok: boolean; report: AiAgentReport; usedFallback: boolean }> {
  const res = await api.post<{ ok: boolean; report: AiAgentReport; usedFallback: boolean }>(
    `/ai-agents/${id}/generate-report`,
    body || {},
  );
  return res.data;
}
