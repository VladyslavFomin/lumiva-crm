// src/api/onlineChat.ts
import { api } from './client';

export interface ChatSession {
  id: string;
  siteHost: string;
  visitorName: string | null;
  visitorEmail: string | null;
  status: 'open' | 'closed';
  lastMessageAt: string | null;
  createdAt: string;
  leadId?: string | null;
  lastSender?: 'visitor' | 'staff' | 'assistant' | null;
  /** ИИ-консультант молчит в этом диалоге (оператор ответил сам или выключил ИИ). */
  aiPaused?: boolean;
  unread?: boolean;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  /** Последнее видимое посетителю сообщение (без внутренних заметок и черновиков ИИ). */
  lastMessage?: { text: string; sender: 'visitor' | 'staff' | 'assistant'; createdAt: string; hasFile: boolean } | null;
}

export interface ChatMessage {
  id: string;
  sender: 'visitor' | 'staff' | 'assistant';
  text: string;
  createdAt: string;
  isInternal: boolean;
  senderName?: string | null;
  attachments?: { id: string; name: string; url: string }[];
}

export async function fetchChatSessions(params?: {
  status?: 'open' | 'closed';
  search?: string;
}) {
  return api.get<ChatSession[]>('/online-chat/sessions', { params });
}

export interface ChatMessagesPayload {
  messages: ChatMessage[];
  leadId: string | null;
  siteHost: string;
  visitorName: string | null;
  visitorEmail: string | null;
  status?: 'open' | 'closed';
  aiPaused?: boolean;
  createdAt?: string;
  utm?: Record<'source' | 'medium' | 'campaign' | 'content' | 'term', string | null>;
}

export async function fetchChatMessages(sessionId: string) {
  return api.get<ChatMessagesPayload>(
    `/online-chat/sessions/${sessionId}/messages`,
  );
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await api.del(`/online-chat/sessions/${sessionId}`);
}

export const setChatSessionStatus = (sessionId: string, status: 'open' | 'closed') =>
  api.patch<{ id: string; status: 'open' | 'closed' }>(`/online-chat/sessions/${sessionId}/status`, { status });

export async function sendChatMessage(sessionId: string, text: string) {
  return api.post<ChatMessage>(
    `/online-chat/sessions/${sessionId}/messages`,
    { text },
  );
}

export interface ChatAiStatus {
  active: boolean;
  /** auto — отвечает сам; draft — пишет черновики для оператора; off — не отвечает (режим предложений). */
  mode: 'auto' | 'draft' | 'off';
  hasBrief: boolean;
  employee: { id: string; name: string; status: string; avatarUrl?: string | null; autonomyMode: string } | null;
  planAllowed: boolean;
  canHire: boolean;
}

export const fetchChatAiStatus = () => api.get<ChatAiStatus>('/online-chat/ai/status');

export const setChatSessionAiPaused = (sessionId: string, paused: boolean) =>
  api.patch<{ id: string; aiPaused: boolean }>(`/online-chat/sessions/${sessionId}/ai`, { paused });

/* Консультант мессенджеров в диалоге: молчит N часов после ручного ответа сотрудника, «Вернуть ИИ» снимает паузу. */
export type MessengerAiChannel = 'whatsapp' | 'telegram';
export interface MessengerAiPause {
  handles: boolean;
  agentName: string | null;
  pausedUntil: string | null;
}
export const fetchMessengerAiPause = (channel: MessengerAiChannel, contactId: string) =>
  api.get<MessengerAiPause>(`/messenger-ai/${channel}/${encodeURIComponent(contactId)}`);
export const resumeMessengerAi = (channel: MessengerAiChannel, contactId: string) =>
  api.post<MessengerAiPause>(`/messenger-ai/${channel}/${encodeURIComponent(contactId)}/resume`, {});
