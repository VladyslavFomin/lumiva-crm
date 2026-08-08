import { api } from './client';

export type SmsProvider = 'twilio' | 'smsc' | 'smsru';
export type SmsDirection = 'outbound' | 'inbound';
export type SmsStatus = 'pending' | 'sent' | 'delivered' | 'failed';
export type SmsEntityType = 'contact' | 'lead' | 'company';

export interface SmsConfigDto {
  id: string;
  provider: SmsProvider;
  senderName: string | null;
  isEnabled: boolean;
  hasCredentials: boolean;
  inboundWebhookUrl: string | null;
}

export interface SaveSmsConfigDto {
  provider: SmsProvider;
  credentials: Record<string, string>;
  senderName?: string;
  isEnabled?: boolean;
}

export interface SmsMessage {
  id: string;
  tenantId: string;
  direction: SmsDirection;
  fromPhone: string | null;
  toPhone: string;
  body: string;
  status: SmsStatus;
  provider: string | null;
  externalId: string | null;
  entityType: SmsEntityType | null;
  entityId: string | null;
  sentByUserId: string | null;
  cost: number | null;
  costUnit: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendSmsDto {
  to: string;
  body: string;
  entityType?: SmsEntityType;
  entityId?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export function fetchSmsConfig(): Promise<SmsConfigDto | null> {
  return api.get<SmsConfigDto | null>('/sms/config');
}

export function saveSmsConfig(dto: SaveSmsConfigDto): Promise<SmsConfigDto> {
  return api.patch<SmsConfigDto>('/sms/config', dto);
}

export function deleteSmsConfig(): Promise<void> {
  return api.delete('/sms/config');
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export function sendSms(dto: SendSmsDto): Promise<SmsMessage> {
  return api.post<SmsMessage>('/sms/send', dto);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function fetchSmsMessages(params?: {
  entityType?: SmsEntityType;
  entityId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: SmsMessage[]; total: number }> {
  return api.get('/sms/messages', { params });
}
