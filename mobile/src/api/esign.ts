import { api } from './client';

// Mirrors backend src/esign/esign-document.entity.ts + esign.service.ts decorateRow()/getDocument().
// NOTE: the list endpoint (GET /esign/documents) does NOT return `title` — only the detail
// endpoint (GET /esign/documents/:id) does, via a full entity spread. Both endpoints already
// resolve `contactName`/`contactCompany` server-side, so there is no need to call fetchContact
// separately from these screens.

export type EsignDocumentStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired';
export type EsignItemKind = 'product' | 'service';

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

/** Row shape returned by GET /esign/documents (EsignService.decorateRow) — no `title`. */
export interface EsignDocumentRow {
  id: string;
  kind: string;
  status: EsignDocumentStatus;
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

/** Shape returned by GET/POST/PATCH single-document endpoints (EsignService.getDocument, etc). */
export interface EsignDocument {
  id: string;
  title: string;
  kind: string;
  bodyText: string;
  status: EsignDocumentStatus;
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
  entityType: 'lead' | 'company' | 'project' | null;
  entityId: string | null;
  entityLabel: string | null;
  pageCount: number;
  viewedAt: string | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

export async function fetchEsignDocuments(): Promise<EsignDocumentRow[]> {
  const res = await api.get<EsignDocumentRow[]>('/esign/documents');
  return res.data;
}

export async function fetchEsignDocument(id: string): Promise<EsignDocument> {
  const res = await api.get<EsignDocument>(`/esign/documents/${id}`);
  return res.data;
}

export async function sendEsignDocument(id: string): Promise<EsignDocument> {
  const res = await api.post<EsignDocument>(`/esign/documents/${id}/send`);
  return res.data;
}

export async function duplicateEsignDocument(id: string): Promise<EsignDocument> {
  const res = await api.post<EsignDocument>(`/esign/documents/${id}/duplicate`);
  return res.data;
}

export async function deleteEsignDocument(id: string): Promise<{ ok: true }> {
  const res = await api.delete<{ ok: true }>(`/esign/documents/${id}`);
  return res.data;
}

export interface EsignKeyDef {
  key: string;
  label: string;
}
export interface EsignKeyGroup {
  group: 'client' | 'contract' | 'org' | 'product' | 'service';
  keys: EsignKeyDef[];
}

/** {KEY} placeholder catalog — client/org groups are auto-filled from the contact/tenant/user
 * (see fetchEsignAutoValues); contract-group keys (AMOUNT, SERVICE, TERM, ...) need manual input
 * except CONTRACT_NO, which the backend claims atomically on issue. Product/service groups only
 * resolve when line items are picked, which the mobile issue flow doesn't support yet. */
export async function fetchEsignKeyGroups(): Promise<EsignKeyGroup[]> {
  const res = await api.get<EsignKeyGroup[]>('/esign/documents/keys');
  return res.data;
}

export async function fetchEsignAutoValues(contactId: string): Promise<Record<string, string>> {
  const res = await api.get<Record<string, string>>('/esign/documents/auto-values', { params: { contactId } });
  return res.data;
}

export interface EsignAmountSuggestion {
  source: 'lead' | 'project' | 'sale';
  refId: string;
  label: string;
  amount: string;
  currency: string;
  createdAt: string;
}
export async function fetchEsignAmountSuggestions(contactId: string): Promise<EsignAmountSuggestion[]> {
  const res = await api.get<EsignAmountSuggestion[]>('/esign/documents/amount-suggestions', { params: { contactId } });
  return res.data;
}

export interface CreateEsignDocumentPayload {
  templateId: string;
  contactId: string;
  extraFields?: Record<string, string>;
}
export async function createEsignDocument(payload: CreateEsignDocumentPayload): Promise<EsignDocument> {
  const res = await api.post<EsignDocument>('/esign/documents', payload);
  return res.data;
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
export async function fetchEsignTemplates(): Promise<EsignTemplate[]> {
  const res = await api.get<EsignTemplate[]>('/esign/templates');
  return res.data;
}
export interface EsignTemplatePayload {
  name: string;
  description?: string;
  kind?: string;
  bodyTemplate: string;
  fileNamePattern?: string;
}
export async function createEsignTemplate(payload: EsignTemplatePayload): Promise<EsignTemplate> {
  const res = await api.post<EsignTemplate>('/esign/templates', payload);
  return res.data;
}
export async function updateEsignTemplate(id: string, payload: Partial<EsignTemplatePayload>): Promise<EsignTemplate> {
  const res = await api.patch<EsignTemplate>(`/esign/templates/${id}`, payload);
  return res.data;
}
export async function deleteEsignTemplate(id: string): Promise<void> {
  await api.delete(`/esign/templates/${id}`);
}
