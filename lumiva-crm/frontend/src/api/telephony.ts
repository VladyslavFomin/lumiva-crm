// src/api/telephony.ts
import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

export interface TelephonyConfigDto {
  id: string;
  accountSid: string | null;
  authToken: string | null; // masked ("••••••••") when already set, never the real value
  voiceNumber: string | null;
  forwardToNumbers: string[];
  isEnabled: boolean;
  inboundWebhookUrl: string | null;
}

export interface SaveTelephonyConfigDto {
  accountSid?: string;
  authToken?: string;
  voiceNumber?: string;
  forwardToNumbers?: string[];
  isEnabled?: boolean;
}

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'queued' | 'ringing' | 'in-progress' | 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled';
export type CallSentiment = 'positive' | 'neutral' | 'negative';
export type CallTopic = 'pricing' | 'scheduling' | 'service_quality' | 'technical_issue' | 'wait_time' | 'other';

export interface Call {
  id: string;
  tenantId: string;
  direction: CallDirection;
  fromNumber: string | null;
  toNumber: string | null;
  status: CallStatus;
  durationSeconds: number | null;
  twilioCallSid: string | null;
  recordingSid: string | null;
  recordingUrl: string | null;
  transcript: string | null;
  transcriptStatus: 'pending' | 'done' | 'failed' | null;
  sentiment: CallSentiment | null;
  sentimentTopic: CallTopic | null;
  sentimentStatus: 'pending' | 'done' | 'failed' | null;
  tags: string[];
  linkedLeadId: string | null;
  staffUserId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface TelephonyStats {
  totalCalls: number;
  avgDurationSeconds: number;
  pickupRate: number;
  missedCalls: number;
  recordedCalls: number;
}

export interface TelephonyAnalytics {
  telephonyEnabled: boolean;
  kpis: {
    totalCalls: number;
    totalSms: number;
    pickupRate: number;
    smsDeliveryRate: number;
    avgCallDurationSeconds: number;
  };
  dailySeries: Array<{ date: string; calls: number; sms: number }>;
  hourlyLoad: Array<{ hour: number; count: number }>;
  byManager: Array<{ staffUserId: string | null; name: string; calls: number; sms: number }>;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    analyzed: number;
    topNegativeTopics: Array<{ topic: CallTopic; count: number }>;
  };
}

export function fetchTelephonyStatus(): Promise<{ enabled: boolean; includedInPlan: boolean }> {
  return api.get<{ enabled: boolean; includedInPlan: boolean }>('/telephony/status');
}

export function fetchTelephonyConfig(): Promise<TelephonyConfigDto | null> {
  return api.get<TelephonyConfigDto | null>('/telephony/config');
}

export function saveTelephonyConfig(dto: SaveTelephonyConfigDto): Promise<TelephonyConfigDto> {
  return api.patch<TelephonyConfigDto>('/telephony/config', dto);
}

export function deleteTelephonyConfig(): Promise<{ success: boolean }> {
  return api.delete('/telephony/config');
}

export function initiateCall(to: string, leadId?: string): Promise<Call> {
  return api.post<Call>('/telephony/calls', { to, leadId });
}

export function fetchCalls(params?: { search?: string; tag?: string; leadId?: string; direction?: 'inbound' | 'outbound' | 'missed'; limit?: number; offset?: number }): Promise<{ items: Call[]; total: number }> {
  return api.get<{ items: Call[]; total: number }>('/telephony/calls', { params });
}

export function updateCallTags(id: string, tags: string[]): Promise<Call> {
  return api.patch<Call>(`/telephony/calls/${id}/tags`, { tags });
}

export function fetchTelephonyStats(days?: number): Promise<TelephonyStats> {
  return api.get<TelephonyStats>('/telephony/stats', { params: { days } });
}

export function fetchTelephonyAnalytics(days?: number): Promise<TelephonyAnalytics> {
  return api.get<TelephonyAnalytics>('/telephony/analytics', { params: { days } });
}

/** The recording endpoint needs a Bearer token, so a plain <audio src="..."> tag can't play it
 * directly — fetch it as a blob and hand back an object URL the caller must revoke when done. */
export async function fetchRecordingBlobUrl(callId: string): Promise<string> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/telephony/calls/${callId}/recording`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Failed to load recording (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
