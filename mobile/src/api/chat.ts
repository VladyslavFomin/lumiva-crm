import { api } from './client';

export type ChatSessionStatus = 'open' | 'closed';

export interface ChatSession {
  id: string;
  siteHost: string;
  visitorName: string | null;
  visitorEmail: string | null;
  status: ChatSessionStatus;
  lastMessageAt: string | null;
  createdAt: string;
  lastSender?: 'visitor' | 'staff' | 'assistant' | null;
  unread?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'visitor' | 'staff' | 'assistant';
  text: string;
  createdAt: string;
  isInternal: boolean;
  file_url?: string | null;
  fileName?: string | null;
  file_name?: string | null;
}

export async function fetchChatSessions(params?: { status?: 'open' | 'closed'; search?: string }) {
  const res = await api.get<ChatSession[]>('/online-chat/sessions', { params });
  return res.data;
}

export async function fetchChatMessages(sessionId: string) {
  const res = await api.get<ChatMessage[]>(`/online-chat/sessions/${sessionId}/messages`);
  return res.data;
}

export async function sendChatMessage(sessionId: string, text: string) {
  const res = await api.post<ChatMessage>(`/online-chat/sessions/${sessionId}/messages`, { text });
  return res.data;
}

export async function deleteChatSession(sessionId: string) {
  await api.del(`/online-chat/sessions/${sessionId}`);
}
