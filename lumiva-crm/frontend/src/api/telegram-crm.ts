// src/api/telegram-crm.ts
import { api } from './client';

export interface TelegramBot {
  id: string;
  tenantId: string;
  botToken: string;
  botUsername: string | null;
  botName: string | null;
  webhookUrl: string | null;
  status: string;
  lastError: string | null;
  autoReply: boolean;
  welcomeMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramContact {
  id: string;
  tenantId: string;
  telegramUserId: string;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  contactId: string | null;
  companyId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramMessage {
  id: string;
  tenantId: string;
  contactId: string;
  messageId: string;
  chatId: string | null;
  direction: 'incoming' | 'outgoing';
  text: string | null;
  messageType: string | null;
  date: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTelegramBotDto {
  botToken: string;
  webhookUrl?: string;
}

export interface SendTelegramMessageDto {
  botId: string;
  telegramUserId: string;
  text: string;
  contactId?: string;
  companyId?: string;
  leadId?: string;
  saleId?: string;
}

export interface ListTelegramMessagesQuery {
  contactId?: string;
  telegramUserId?: string;
  direction?: 'incoming' | 'outgoing';
  limit?: number;
  offset?: number;
}

export async function fetchTelegramBots(): Promise<TelegramBot[]> {
  const res = await api.get<TelegramBot[]>('/telegram-crm/bots');
  return res;
}

export async function fetchTelegramBot(id: string): Promise<TelegramBot> {
  const res = await api.get<TelegramBot>(`/telegram-crm/bots/${id}`);
  return res;
}

export async function createTelegramBot(dto: CreateTelegramBotDto): Promise<TelegramBot> {
  const res = await api.post<TelegramBot>('/telegram-crm/bots', dto);
  return res;
}

export async function updateTelegramBot(id: string, dto: Partial<CreateTelegramBotDto> & { botName?: string; botUsername?: string; welcomeMessage?: string; isActive?: boolean }): Promise<TelegramBot> {
  const res = await api.patch<TelegramBot>(`/telegram-crm/bots/${id}`, dto);
  return res;
}

export async function setWebhook(botId: string, webhookUrl: string): Promise<{ success: boolean }> {
  const res = await api.post<{ success: boolean }>(`/telegram-crm/bots/${botId}/webhook`, { webhookUrl });
  return res;
}

export async function deleteTelegramBot(id: string): Promise<void> {
  await api.delete(`/telegram-crm/bots/${id}`);
}

export async function fetchTelegramMessages(query?: ListTelegramMessagesQuery): Promise<{ items: TelegramMessage[]; total: number }> {
  const res = await api.get<{ items: TelegramMessage[]; total: number }>('/telegram-crm/messages', { params: query });
  return res;
}

export async function sendTelegramMessage(dto: SendTelegramMessageDto): Promise<TelegramMessage> {
  const res = await api.post<TelegramMessage>('/telegram-crm/send', dto);
  return res;
}

