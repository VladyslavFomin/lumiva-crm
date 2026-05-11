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

export interface AiLeadScoreResult {
  ok: boolean;
  score?: number;
  priority?: 'high' | 'medium' | 'low';
  label?: string;
  reasons?: string[];
  leadId?: string;
  updatedAt?: string;
  error?: string;
}

export async function postAiLeadScore(leadId: string): Promise<AiLeadScoreResult> {
  return api.post<AiLeadScoreResult>(`/ai/lead-score/${encodeURIComponent(leadId)}`, {});
}

export interface AiEnrichSuggestion {
  field: string;
  label: string;
  currentValue: string | null;
  suggestedValue: string;
  confidence: 'high' | 'medium';
  reasoning: string;
}

export interface AiEnrichResult {
  ok: boolean;
  insight?: string;
  suggestions?: AiEnrichSuggestion[];
  entityType?: string;
  entityId?: string;
  updatedAt?: string;
  error?: string;
}

export async function postAiEnrich(
  entityType: 'lead' | 'company',
  entityId: string,
): Promise<AiEnrichResult> {
  return api.post<AiEnrichResult>(
    `/ai/enrich/${entityType}/${encodeURIComponent(entityId)}`,
    {},
  );
}

export interface AiEmailReplyResult {
  ok: boolean;
  suggestions?: string[];
  error?: string;
}

export async function postAiEmailReplySuggest(body: {
  subject?: string;
  body?: string;
  senderName?: string;
}): Promise<AiEmailReplyResult> {
  return api.post<AiEmailReplyResult>('/ai/email-reply-suggest', body);
}

// ── NEXT BEST ACTION ─────────────────────────────────────────────────────────
export interface AiNextActionResult {
  ok: boolean;
  action?: string;
  channel?: 'phone' | 'email' | 'meeting' | 'message';
  urgency?: 'hot' | 'warm' | 'cold';
  reason?: string;
  steps?: string[];
  leadId?: string;
  updatedAt?: string;
  error?: string;
}

export async function postAiNextAction(leadId: string): Promise<AiNextActionResult> {
  return api.post<AiNextActionResult>(`/ai/next-action/${encodeURIComponent(leadId)}`, {});
}

// ── OUTREACH EMAIL ────────────────────────────────────────────────────────────
export interface AiOutreachEmailResult {
  ok: boolean;
  subject?: string;
  body?: string;
  tone?: string;
  leadId?: string;
  leadEmail?: string | null;
  leadName?: string | null;
  error?: string;
}

export async function postAiOutreachEmail(leadId: string): Promise<AiOutreachEmailResult> {
  return api.post<AiOutreachEmailResult>(`/ai/outreach-email/${encodeURIComponent(leadId)}`, {});
}

// ── FIND DUPLICATES ───────────────────────────────────────────────────────────
export interface AiDuplicateLead {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface AiDuplicateGroup {
  leads: AiDuplicateLead[];
  reason: string;
  confidence: 'high' | 'medium';
}

export interface AiFindDuplicatesResult {
  ok: boolean;
  groups?: AiDuplicateGroup[];
  scanned?: number;
  error?: string;
}

export async function postAiFindDuplicates(): Promise<AiFindDuplicatesResult> {
  return api.post<AiFindDuplicatesResult>('/ai/find-duplicates', {});
}

// ── SMART SEARCH ──────────────────────────────────────────────────────────────
export interface AiSmartSearchFilters {
  status?: string;
  source?: string;
  channel?: string;
  country?: string;
  search?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  createdAfter?: string;
  createdBefore?: string;
}

export interface AiSmartSearchResult {
  ok: boolean;
  filters?: AiSmartSearchFilters;
  description?: string;
  error?: string;
}

export async function postAiSmartSearch(query: string): Promise<AiSmartSearchResult> {
  return api.post<AiSmartSearchResult>('/ai/smart-search', { query });
}
