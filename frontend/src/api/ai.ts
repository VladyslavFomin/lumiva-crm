import { api } from './client';

export interface AiQuotaSnapshot {
  periodYm: string | null;
  includedMonthlyCents: number;
  includedRemainingCents: number;
  spentIncludedCents: number;
  prepaidCents: number;
  totalAvailableCents: number;
  storageUsedBytes: string;
  storageQuotaBytes: string;
}

export interface AiStatusResponse {
  configured: boolean;
  quota: AiQuotaSnapshot;
}

export interface AiChatResponse {
  sessionId: string;
  reply: string;
  toolRounds: number;
  usage: { prompt_tokens: number; completion_tokens: number; costCents: number };
  imageUrl?: string | null;
  imageRevisedPrompt?: string | null;
}

export interface AiChatSessionDto {
  id: string;
  tenantId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatMessageDto {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  toolName: string | null;
  toolCallId: string | null;
  toolCalls: unknown[] | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export async function fetchAiStatus(): Promise<AiStatusResponse> {
  return api.get<AiStatusResponse>('/ai/status');
}

export async function fetchAiQuota(): Promise<AiQuotaSnapshot> {
  return api.get<AiQuotaSnapshot>('/ai/quota');
}

export type AiChatSalesImportContext = {
  importId: string;
  suggestedMapping?: Record<string, string | null>;
  fileName?: string;
  totalRows?: number;
};

export type AiChatWorkspaceCsvContext = {
  fileName?: string;
  tableNameHint?: string;
  headers: string[];
  fieldKeys: string[];
  rows: Record<string, string>[];
};

export type AiChatImageFollowUpContext = {
  lastUserPrompt?: string;
  lastRevisedPrompt?: string;
  lastUrl?: string;
};

export async function postAiChat(body: {
  sessionId?: string | null;
  message: string;
  salesImportContext?: AiChatSalesImportContext;
  workspaceCsvContext?: AiChatWorkspaceCsvContext;
  imageFollowUpContext?: AiChatImageFollowUpContext;
}): Promise<AiChatResponse> {
  return api.post<AiChatResponse>('/ai/chat', body);
}

export async function fetchAiSessions(limit?: number): Promise<AiChatSessionDto[]> {
  const q = limit != null ? `?limit=${limit}` : '';
  return api.get<AiChatSessionDto[]>(`/ai/sessions${q}`);
}

export async function createAiSession(body?: {
  title?: string | null;
}): Promise<AiChatSessionDto> {
  return api.post<AiChatSessionDto>('/ai/sessions', body ?? {});
}

export async function fetchAiSessionMessages(sessionId: string): Promise<{
  session: AiChatSessionDto;
  messages: AiChatMessageDto[];
}> {
  return api.get(`/ai/sessions/${encodeURIComponent(sessionId)}/messages`);
}

export async function deleteAiSession(sessionId: string): Promise<{ ok: boolean }> {
  return api.delete(`/ai/sessions/${encodeURIComponent(sessionId)}`);
}

export async function postAiImage(body: {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  sessionId?: string | null;
}): Promise<{
  ok: boolean;
  url?: string;
  revised_prompt?: string;
  message?: string;
  sessionId?: string;
}> {
  return api.post('/ai/image', body);
}

export interface AiMemoryChunkDto {
  id: string;
  tenantId: string;
  userId: string | null;
  title: string | null;
  content: string;
  createdAt: string;
}

export async function fetchAiMemory(limit?: number): Promise<AiMemoryChunkDto[]> {
  const q = limit != null ? `?limit=${limit}` : '';
  return api.get<AiMemoryChunkDto[]>(`/ai/memory${q}`);
}

export async function addAiMemory(body: {
  title?: string;
  content: string;
}): Promise<{ ok: boolean; id?: string }> {
  return api.post('/ai/memory', body);
}

export async function deleteAiMemory(id: string): Promise<{ ok: boolean }> {
  return api.delete(`/ai/memory/${encodeURIComponent(id)}`);
}
