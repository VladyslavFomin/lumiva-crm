import { api } from './client';

export interface AiChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  createdAt: string;
}

export interface AiQuota {
  periodYm: string;
  includedMonthlyCents: number;
  includedRemainingCents: number;
  spentIncludedCents: number;
  prepaidCents: number;
  totalAvailableCents: number;
}

export interface AiStatus {
  configured: boolean;
  quota: AiQuota;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const res = await api.get<AiStatus>('/ai/status');
  return res.data;
}

export async function fetchAiSessions(limit = 30): Promise<AiChatSession[]> {
  const res = await api.get<AiChatSession[]>('/ai/sessions', { params: { limit } });
  return res.data;
}

export async function fetchAiSessionMessages(id: string): Promise<{ session: AiChatSession | null; messages: AiChatMessage[] }> {
  const res = await api.get<{ session?: AiChatSession; messages: AiChatMessage[] }>(`/ai/sessions/${id}/messages`);
  return { session: res.data.session || null, messages: res.data.messages };
}

export async function deleteAiSession(id: string): Promise<void> {
  await api.delete(`/ai/sessions/${id}`);
}

export interface AiChatReply {
  sessionId: string;
  reply: string;
  usingOwnKey: boolean;
}

export async function sendAiChatMessage(sessionId: string | null, message: string): Promise<AiChatReply> {
  const res = await api.post<AiChatReply>('/ai/chat', { sessionId, message });
  return res.data;
}
