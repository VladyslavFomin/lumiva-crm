import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

export type EsignStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired';
export type EsignLinkType = 'lead' | 'company' | 'project';

export interface EsignDocumentRow {
  id: string;
  kind: string;
  status: EsignStatus;
  contactId: string | null;
  contactName: string | null;
  contactCompany: string | null;
  docNo: string | null;
  amount: string | null;
  currency: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  pageCount: number;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

export type EsignItemKind = 'product' | 'service';

export interface EsignItemPick {
  kind: EsignItemKind;
  refId: string;
  masterId?: string | null;
}

export interface EsignDocumentItem {
  kind: EsignItemKind;
  refId: string;
  name: string;
  sku?: string | null;
  price: string;
  currency: string;
  durationMinutes?: number | null;
  masterId?: string | null;
  masterName?: string | null;
}

export interface EsignDocumentDetail {
  id: string;
  title: string;
  kind: string;
  bodyText: string;
  status: EsignStatus;
  contactId: string | null;
  contactName: string | null;
  contactCompany: string | null;
  templateId: string | null;
  extraFields: Record<string, string> | null;
  items: EsignDocumentItem[] | null;
  amount: string | null;
  currency: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  entityType: EsignLinkType | null;
  entityId: string | null;
  entityLabel: string | null;
  pageCount: number;
  draftPdfUrl: string | null;
  signedPdfUrl: string | null;
  signerName: string | null;
  signerEmail: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface EsignTemplate {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  bodyTemplate: string;
  fileNamePattern: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsignLinkOption {
  id: string;
  name: string;
}

export interface EsignKeyDef {
  key: string;
  label: string;
}

export interface EsignKeyGroup {
  group: 'client' | 'contract' | 'org' | 'product' | 'service';
  keys: EsignKeyDef[];
}

export interface EsignAmountSuggestion {
  source: 'lead' | 'project' | 'sale';
  refId: string;
  label: string;
  amount: string;
  currency: string;
}

export function fetchEsignDocuments(): Promise<EsignDocumentRow[]> {
  return api.get('/esign/documents');
}

export function fetchEsignDocument(id: string): Promise<EsignDocumentDetail> {
  return api.get(`/esign/documents/${id}`);
}

export function fetchEsignKeys(): Promise<EsignKeyGroup[]> {
  return api.get('/esign/documents/keys');
}

export function fetchEsignAutoValues(contactId: string | null): Promise<Record<string, string>> {
  const q = contactId ? `?contactId=${encodeURIComponent(contactId)}` : '';
  return api.get(`/esign/documents/auto-values${q}`);
}

export function fetchEsignNextContractNo(): Promise<{ preview: string }> {
  return api.get('/esign/documents/next-contract-no');
}

export function fetchEsignAmountSuggestions(contactId: string): Promise<EsignAmountSuggestion[]> {
  return api.get(`/esign/documents/amount-suggestions?contactId=${encodeURIComponent(contactId)}`);
}

export function issueEsignDocument(payload: {
  templateId: string;
  contactId: string;
  extraFields?: Record<string, string>;
  items?: EsignItemPick[];
}): Promise<EsignDocumentDetail> {
  return api.post('/esign/documents', payload);
}

export function updateEsignDocument(id: string, payload: { bodyText?: string }): Promise<EsignDocumentDetail> {
  return api.patch(`/esign/documents/${id}`, payload);
}

export function deleteEsignDocument(id: string): Promise<{ ok: true }> {
  return api.delete(`/esign/documents/${id}`);
}

export function sendEsignDocument(id: string): Promise<EsignDocumentDetail> {
  return api.post(`/esign/documents/${id}/send`);
}

export function duplicateEsignDocument(id: string): Promise<EsignDocumentDetail> {
  return api.post(`/esign/documents/${id}/duplicate`);
}

export async function downloadEsignDocumentFile(id: string, fileName: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/esign/documents/${id}/file?download=1`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Не удалось скачать файл: ${res.status}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function openEsignDocumentFile(id: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/esign/documents/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Не удалось открыть файл: ${res.status}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

export function searchEsignLinkOptions(type: EsignLinkType, search?: string): Promise<EsignLinkOption[]> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return api.get(`/esign/link-options/${type}${q}`);
}

export function fetchEsignTemplates(): Promise<EsignTemplate[]> {
  return api.get('/esign/templates');
}

export function createEsignTemplate(payload: {
  name: string;
  description?: string;
  kind?: string;
  bodyTemplate: string;
  fileNamePattern?: string;
}): Promise<EsignTemplate> {
  return api.post('/esign/templates', payload);
}

export function updateEsignTemplate(
  id: string,
  payload: Partial<{ name: string; description: string; kind: string; bodyTemplate: string; fileNamePattern: string }>,
): Promise<EsignTemplate> {
  return api.patch(`/esign/templates/${id}`, payload);
}

export function deleteEsignTemplate(id: string): Promise<{ ok: true }> {
  return api.delete(`/esign/templates/${id}`);
}
