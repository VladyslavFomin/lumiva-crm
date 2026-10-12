// src/api/leadCalls.ts
// Звонки лида и их AI-разбор: и звонки Twilio, и записи, загруженные вручную в карточку.
import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

export type CallAnalysisStatus = 'transcribing' | 'analyzing' | 'done' | 'failed';

export interface CallAiAnalysis {
  summary: string;
  nextSteps: { text: string; dueInDays: number | null }[];
  objections: string[];
  clientIntent: 'hot' | 'warm' | 'cold';
  managerScore: number;
  strengths: string[];
  improvements: string[];
  language: string | null;
}

export interface LeadCall {
  id: string;
  source: 'twilio' | 'upload';
  direction: 'inbound' | 'outbound';
  status: string;
  durationSeconds: number | null;
  fromNumber: string | null;
  toNumber: string | null;
  originalFilename: string | null;
  hasRecording: boolean;
  transcript: string | null;
  transcriptStatus: 'pending' | 'done' | 'failed' | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  sentimentTopic: string | null;
  aiAnalysis: CallAiAnalysis | null;
  analysisStatus: CallAnalysisStatus | null;
  analysisError: string | null;
  analyzedAt: string | null;
  staffUserId: string | null;
  startedAt: string | null;
  createdAt: string;
}

export const fetchLeadCalls = (leadId: string) => api.get<LeadCall[]>(`/leads/${leadId}/calls`);

export const uploadLeadCall = (leadId: string, file: File, direction: 'inbound' | 'outbound') => {
  const form = new FormData();
  form.append('file', file);
  form.append('direction', direction);
  return api.postForm<LeadCall>(`/leads/${leadId}/calls`, form);
};

export const reanalyzeLeadCall = (leadId: string, callId: string) =>
  api.post<LeadCall>(`/leads/${leadId}/calls/${callId}/reanalyze`);

export const deleteLeadCall = (leadId: string, callId: string) =>
  api.delete<{ ok: boolean }>(`/leads/${leadId}/calls/${callId}`);

/** Запись отдаётся только с Bearer-токеном — грузим как blob; вызывающий освобождает URL. */
export async function fetchLeadCallAudioUrl(leadId: string, callId: string): Promise<string> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/leads/${leadId}/calls/${callId}/audio`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Failed to load recording (${res.status})`);
  return URL.createObjectURL(await res.blob());
}
