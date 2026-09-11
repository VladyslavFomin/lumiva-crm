import { api } from './client';

export interface AiAgentStats {
  actionsToday?: number;
  pendingApprovals?: number;
  reportsGenerated?: number;
  errors?: number;
  lastActivityAt?: string | null;
  lastActivity?: string | null;
}

export interface AiAgent {
  id: string;
  name: string;
  role: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  // The rest are present on every real GET /ai-agents(/:id) response (agentBaseDto on the
  // backend spreads the AiAgent entity plus role-catalog labels) but kept optional here so this
  // type stays backward compatible with any narrower usage from the Approvals slice.
  tenantId?: string;
  department?: string | null;
  language?: string;
  tone?: string;
  status?: 'active' | 'paused' | 'disabled' | 'setup_required';
  autonomyMode?: 'read_only' | 'suggest' | 'assisted' | 'auto';
  provider?: string;
  model?: string | null;
  dailyReportTime?: string;
  scheduleMode?: 'always' | 'business_hours' | 'custom' | 'manual';
  createdAt?: string;
  updatedAt?: string;
  roleTitle?: string;
  roleShortTitle?: string;
  roleDescription?: string;
  roleAccent?: string;
  roleFunctions?: string[];
  stats?: AiAgentStats;
}

export interface AiAgentAction {
  id: string;
  agentId: string;
  actionType: string;
  targetType: string | null;
  targetId: string | null;
  title: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  createdAt: string;
}

export async function fetchAiAgents(): Promise<AiAgent[]> {
  const res = await api.get<AiAgent[] | { items?: AiAgent[] }>('/ai-agents');
  return Array.isArray(res.data) ? res.data : res.data?.items || [];
}

export async function fetchPendingAiActions(): Promise<AiAgentAction[]> {
  const res = await api.get<AiAgentAction[] | { items?: AiAgentAction[] }>('/ai-actions/pending');
  return Array.isArray(res.data) ? res.data : res.data?.items || [];
}

export async function approveAiAction(id: string): Promise<void> {
  await api.post(`/ai-actions/${id}/approve`);
}

export async function executeAiAction(id: string): Promise<void> {
  await api.post(`/ai-actions/${id}/execute`);
}

export async function rejectAiAction(id: string): Promise<void> {
  await api.post(`/ai-actions/${id}/reject`, {});
}
