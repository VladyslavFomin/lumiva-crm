import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './client';

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'queued' | 'ringing' | 'in-progress' | 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled';

export interface Call {
  id: string;
  direction: CallDirection;
  fromNumber: string | null;
  toNumber: string | null;
  status: CallStatus;
  durationSeconds: number | null;
  recordingUrl: string | null;
  transcript: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  tags: string[];
  linkedLeadId: string | null;
  createdAt: string;
}

export interface TelephonyStats {
  totalCalls: number;
  avgDurationSeconds: number;
  pickupRate: number;
  missedCalls: number;
  recordedCalls: number;
}

export interface CallFilters {
  search?: string;
  tag?: string;
  leadId?: string;
  direction?: 'inbound' | 'outbound' | 'missed';
  limit?: number;
  offset?: number;
}

export async function fetchCalls(filters: CallFilters = {}): Promise<{ items: Call[]; total: number }> {
  const res = await api.get<{ items: Call[]; total: number }>('/telephony/calls', { params: filters });
  return res.data;
}

export async function fetchTelephonyStats(days?: number): Promise<TelephonyStats> {
  const res = await api.get<TelephonyStats>('/telephony/stats', { params: days ? { days } : undefined });
  return res.data;
}

/** True when the backend responded 403 "not enabled for this tenant" (paid add-on) — distinct from a real network/error state. */
export function isTelephonyDisabledError(e: any): boolean {
  return e?.response?.status === 403;
}

export async function updateCallTags(id: string, tags: string[]): Promise<Call> {
  const res = await api.patch<Call>(`/telephony/calls/${id}/tags`, { tags });
  return res.data;
}

/** The recording is served through an authenticated backend proxy (it holds the Twilio
 * credentials, not the mobile app), not a plain public URL — so playing/downloading it needs
 * the same bearer/tenant headers as any other API call, built here for `FileSystem.downloadAsync`
 * (which can't reuse the axios instance's interceptors). */
export async function getCallRecordingDownloadInfo(id: string): Promise<{ url: string; headers: Record<string, string> }> {
  const host = Constants.expoConfig?.extra?.apiHost || 'https://crm.lumiva.agency';
  const base = Constants.expoConfig?.extra?.apiBase || '/v1';
  const [token, tenantId, clientKey] = await Promise.all([
    AsyncStorage.getItem('auth_token'),
    AsyncStorage.getItem('tenant_id'),
    AsyncStorage.getItem('client_key'),
  ]);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  if (clientKey) headers['X-Client-Key'] = clientKey;
  return { url: `${host}${base}/telephony/calls/${id}/recording`, headers };
}
