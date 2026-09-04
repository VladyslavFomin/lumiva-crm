// src/api/telegram-crm.ts
import { api } from './client';

export type FlowNodeType = 'msg' | 'buttons' | 'ask' | 'ai' | 'cond' | 'crm' | 'human' | 'delay' | 'hook' | 'pay';

export interface FlowButtonOption {
  id: string;
  label: string;
  nextNodeId?: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  name: string;
  text: string;
  nextNodeId?: string;
  options?: FlowButtonOption[];
  source?: 'static' | 'booking_services' | 'booking_staff' | 'booking_slots';
  fieldTarget?: string;
  validation?: 'none' | 'phone' | 'text';
  aiNextNodeId?: string;
  condField?: string;
  condOp?: 'eq' | 'exists' | 'gte';
  condValue?: string;
  trueNodeId?: string;
  falseNodeId?: string;
  crmAction?: 'create_lead' | 'create_reservation' | 'update_lead_stage';
  department?: string;
  pauseMinutes?: number;
  afterMinutes?: number;
  targetFlowId?: string;
  childIds?: string[];
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  startNodeId: string;
  nodes: Record<string, FlowNode>;
}

export type FlowsMap = Record<string, Flow>;

export interface TelegramAiFunctionToggles {
  'booking.availability'?: boolean;
  'sale.read'?: boolean;
  'helpdesk.ticket.read'?: boolean;
  'file.send'?: boolean;
}

export interface TelegramKnowledgeEntry {
  id: string;
  name: string;
  kind?: 'text' | 'file';
  content: string;
  updatedAt?: string;
}

export interface TelegramAiConnectorConfig {
  model?: string;
  temperature?: number;
  language?: string;
  systemPrompt?: string;
  knowledgeBase?: TelegramKnowledgeEntry[];
  functions?: TelegramAiFunctionToggles;
  escalation?: {
    stopWords?: string[];
    repeatThreshold?: number;
    department?: string;
    pauseMinutes?: number;
  };
}

export interface TelegramCapabilities {
  aiAutoReply?: boolean;
  humanHandoff?: boolean;
  leadCreation?: boolean;
  bookingIntegration?: boolean;
  payments?: boolean;
  files?: boolean;
  broadcast?: boolean;
  staffNotifications?: boolean;
  offHours?: boolean;
  dailyDigest?: boolean;
}

export interface TelegramCrmLinkConfig {
  stage?: string;
  source?: string;
  distributionUserIds?: string[];
}

export interface TelegramBotCommand {
  command: string;
  description: string;
  targetNodeId?: string;
}

export interface TelegramBotMeta {
  recipients?: unknown[];
  flows?: FlowsMap;
  activeFlowId?: string | null;
  aiConnector?: TelegramAiConnectorConfig;
  capabilities?: TelegramCapabilities;
  commands?: TelegramBotCommand[];
  crmLink?: TelegramCrmLinkConfig;
  eventLog?: Array<{ t: string; k: 'ok' | 'er' | 'wr'; m: string }>;
}

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
  meta?: TelegramBotMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramContact {
  id: string;
  tenantId: string;
  botId: string | null;
  telegramUserId: string;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  contactId: string | null;
  companyId: string | null;
  leadId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramMessage {
  id: string;
  tenantId: string;
  contactId: string;
  botId: string | null;
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

export interface TelegramContactWithPreview extends TelegramContact {
  lastMessage: TelegramMessage | null;
  unreadCount: number;
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

export interface UpdateTelegramBotDto extends Partial<CreateTelegramBotDto> {
  botName?: string;
  botUsername?: string;
  welcomeMessage?: string;
  isActive?: boolean;
  autoReply?: boolean;
  meta?: {
    aiConnector?: Partial<TelegramAiConnectorConfig>;
    capabilities?: Partial<TelegramCapabilities>;
    crmLink?: Partial<TelegramCrmLinkConfig>;
  };
}

export async function updateTelegramBot(id: string, dto: UpdateTelegramBotDto): Promise<TelegramBot> {
  const res = await api.patch<TelegramBot>(`/telegram-crm/bots/${id}`, dto);
  return res;
}

export async function previewTelegramBotToken(botToken: string): Promise<{ id: number; username: string; first_name: string }> {
  return api.post(`/telegram-crm/bots/preview`, { botToken });
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

export async function fetchTelegramContacts(query?: { search?: string; botId?: string }): Promise<TelegramContactWithPreview[]> {
  const res = await api.get<TelegramContactWithPreview[]>('/telegram-crm/contacts', { params: query });
  return res;
}

export async function markTelegramContactRead(contactId: string): Promise<{ success: boolean }> {
  const res = await api.post<{ success: boolean }>(`/telegram-crm/contacts/${contactId}/read`);
  return res;
}

// ── Bot staff recipients ──────────────────────────────────────────────────────

export interface TelegramStaffRecipient {
  id: string;
  botId: string;
  staffUserId: string;
  staffUserName: string;
  telegramChatId: string;
  telegramUsername?: string | null;
  createdAt: string;
}

export interface CreateTelegramStaffRecipientDto {
  staffUserId: string;
  staffUserName: string;
  telegramChatId: string;
  telegramUsername?: string;
}

export async function fetchTelegramBotRecipients(botId: string): Promise<TelegramStaffRecipient[]> {
  try {
    return await api.get<TelegramStaffRecipient[]>(`/telegram-crm/bots/${botId}/recipients`);
  } catch {
    return [];
  }
}

export async function createTelegramBotRecipient(
  botId: string,
  dto: CreateTelegramStaffRecipientDto,
): Promise<TelegramStaffRecipient> {
  return api.post<TelegramStaffRecipient>(`/telegram-crm/bots/${botId}/recipients`, dto);
}

export async function deleteTelegramBotRecipient(botId: string, recipientId: string): Promise<void> {
  await api.delete(`/telegram-crm/bots/${botId}/recipients/${recipientId}`);
}

// ── Flow builder ────────────────────────────────────────────────────────────

export async function fetchTelegramFlows(botId: string): Promise<{ flows: FlowsMap; activeFlowId: string | null }> {
  return api.get(`/telegram-crm/bots/${botId}/flows`);
}

export async function saveTelegramFlow(botId: string, flow: Flow): Promise<{ flows: FlowsMap }> {
  return api.post(`/telegram-crm/bots/${botId}/flows`, flow);
}

export async function deleteTelegramFlow(botId: string, flowId: string): Promise<{ flows: FlowsMap }> {
  return api.delete(`/telegram-crm/bots/${botId}/flows/${flowId}`);
}

export async function activateTelegramFlow(botId: string, flowId: string): Promise<TelegramBot> {
  return api.post(`/telegram-crm/bots/${botId}/flows/${flowId}/activate`);
}

export async function deactivateTelegramFlow(botId: string): Promise<TelegramBot> {
  return api.post(`/telegram-crm/bots/${botId}/flows/deactivate`);
}

export async function fetchTelegramFlowStats(botId: string, flowId: string): Promise<Record<string, number>> {
  return api.get(`/telegram-crm/bots/${botId}/flow-stats`, { params: { flowId } });
}

export async function fetchTelegramFunnel(botId: string): Promise<Array<{ nm: string; cnt: number }>> {
  return api.get(`/telegram-crm/bots/${botId}/funnel`);
}

// ── AI connector ────────────────────────────────────────────────────────────

export async function sendTelegramTestChat(
  botId: string,
  body: { history: Array<{ role: 'user' | 'assistant'; text: string }>; message: string },
): Promise<{ reply: string; trace: Array<{ step: string; detail: string; ms: number }> }> {
  return api.post(`/telegram-crm/bots/${botId}/ai/test-chat`, body);
}

// ── Settings: webhook diagnostics, commands, event log ──────────────────────

export async function fetchTelegramWebhookInfo(botId: string): Promise<any> {
  return api.get(`/telegram-crm/bots/${botId}/webhook-info`);
}

export async function saveTelegramCommands(botId: string, commands: TelegramBotCommand[]): Promise<TelegramBotCommand[]> {
  return api.post(`/telegram-crm/bots/${botId}/commands`, { commands });
}

export async function fetchTelegramLog(botId: string, kind?: string): Promise<Array<{ t: string; k: string; m: string }>> {
  return api.get(`/telegram-crm/bots/${botId}/log`, { params: kind ? { kind } : undefined });
}

