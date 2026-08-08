import { api } from './client';

export type EsignStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired';
export type EsignLinkType = 'lead' | 'company' | 'project';

export interface EsignDocumentRow {
  id: string;
  title: string;
  kind: string;
  status: EsignStatus;
  contactName: string | null;
  entityType: EsignLinkType | null;
  entityId: string | null;
  entityLabel: string | null;
  pageCount: number;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface EsignDocumentDetail {
  id: string;
  title: string;
  kind: string;
  bodyText: string;
  status: EsignStatus;
  contactId: string | null;
  contactName: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface EsignLinkOption {
  id: string;
  name: string;
}

export function fetchEsignDocuments(): Promise<EsignDocumentRow[]> {
  return api.get('/esign/documents');
}

export function fetchEsignDocument(id: string): Promise<EsignDocumentDetail> {
  return api.get(`/esign/documents/${id}`);
}

export function createEsignDocument(payload: {
  contactId?: string;
  title: string;
  bodyTemplate: string;
  kind?: string;
  entityType?: EsignLinkType;
  entityId?: string;
  templateId?: string;
}): Promise<EsignDocumentDetail> {
  return api.post('/esign/documents', payload);
}

export function updateEsignDocument(
  id: string,
  payload: Partial<{ title: string; kind: string; bodyText: string; contactId: string | null; entityType: EsignLinkType | null; entityId: string | null }>,
): Promise<EsignDocumentDetail> {
  return api.patch(`/esign/documents/${id}`, payload);
}

export function deleteEsignDocument(id: string): Promise<{ ok: true }> {
  return api.delete(`/esign/documents/${id}`);
}

export function sendEsignDocument(id: string): Promise<EsignDocumentDetail> {
  return api.post(`/esign/documents/${id}/send`);
}

export function remindEsignDocument(id: string): Promise<EsignDocumentDetail> {
  return api.post(`/esign/documents/${id}/remind`);
}

export function duplicateEsignDocument(id: string): Promise<EsignDocumentDetail> {
  return api.post(`/esign/documents/${id}/duplicate`);
}

export function searchEsignLinkOptions(type: EsignLinkType, search?: string): Promise<EsignLinkOption[]> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return api.get(`/esign/link-options/${type}${q}`);
}

export function fetchEsignTemplates(): Promise<EsignTemplate[]> {
  return api.get('/esign/templates');
}

export function createEsignTemplate(payload: { name: string; description?: string; kind?: string; bodyTemplate: string }): Promise<EsignTemplate> {
  return api.post('/esign/templates', payload);
}

export function updateEsignTemplate(
  id: string,
  payload: Partial<{ name: string; description: string; kind: string; bodyTemplate: string }>,
): Promise<EsignTemplate> {
  return api.patch(`/esign/templates/${id}`, payload);
}

export function deleteEsignTemplate(id: string): Promise<{ ok: true }> {
  return api.delete(`/esign/templates/${id}`);
}
