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
  unread?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'visitor' | 'staff' | 'assistant';
  text: string;
  createdAt: string;
  isInternal: boolean;
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
}

export async function fetchChatMessages(sessionId: string) {
  return api.get<ChatMessagesPayload>(
    `/online-chat/sessions/${sessionId}/messages`,
  );
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await api.del(`/online-chat/sessions/${sessionId}`);
}

export async function sendChatMessage(sessionId: string, text: string) {
  return api.post<ChatMessage>(
    `/online-chat/sessions/${sessionId}/messages`,
    { text },
  );
}
