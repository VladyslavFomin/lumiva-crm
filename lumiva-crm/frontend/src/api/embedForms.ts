// src/api/embedForms.ts
import { API_BASE, ApiError, api } from './client';

export type EmbedFieldType =
  | 'text'
  | 'email'
  | 'url'
  | 'tel'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multi_checkbox'
  | 'hidden'
  | 'utm'
  | 'page_url'
  | 'rating'
  | 'range'
  | 'html'
  | 'divider'
  | 'service'
  | 'specialist'
  | 'guests'
  | 'promo_code'
  | 'file'
  | 'checkbox_consent'
  | 'messaging';

export interface EmbedFieldConfigItem {
  id: string;
  type: EmbedFieldType;
  key: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  stepId?: string;
  defaultValue?: string | number | boolean | string[];
  maxLength?: number;
  min?: number;
  max?: number;
  options?: {
    value: string;
    label: string;
    description?: string;
    price?: string | number;
    duration?: string;
    imageUrl?: string;
  }[];
  /** 2 = полная ширина, 1 = половина (два поля в ряд) */
  colSpan?: 1 | 2;
}

export interface EmbedFormFieldConfig {
  fields: EmbedFieldConfigItem[];
  steps?: { id: string; title: string; description?: string }[];
  settings?: Record<string, unknown>;
  display?: Record<string, unknown>;
  logic?: Array<Record<string, unknown>>;
  booking?: Record<string, unknown>;
}

export interface EmbedFormRow {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  publicId: string;
  templateKey: string;
  fieldConfig: EmbedFormFieldConfig;
  design: Record<string, unknown>;
  published: boolean;
  honeypotField: string;
  privacyPolicyUrl: string | null;
  successMessage: string | null;
  createdAt: string;
  updatedAt: string;
  site?: { id: string; domain: string; name: string | null };
}

export async function fetchEmbedTemplateList() {
  return api.get<{ items: { key: string }[] }>('/embed-forms/templates');
}

export async function fetchEmbedForms(): Promise<EmbedFormRow[]> {
  return api.get<EmbedFormRow[]>('/embed-forms');
}

export async function fetchEmbedForm(id: string): Promise<EmbedFormRow> {
  return api.get<EmbedFormRow>(`/embed-forms/${encodeURIComponent(id)}`);
}

export async function createEmbedForm(body: {
  siteId: string;
  templateKey: string;
  name: string;
}): Promise<EmbedFormRow> {
  return api.post<EmbedFormRow>('/embed-forms', body);
}

export async function updateEmbedForm(
  id: string,
  body: Partial<{
    name: string;
    fieldConfig: Record<string, unknown>;
    design: Record<string, unknown>;
    published: boolean;
    privacyPolicyUrl: string | null;
    successMessage: string | null;
  }>,
): Promise<EmbedFormRow> {
  return api.patch<EmbedFormRow>(
    `/embed-forms/${encodeURIComponent(id)}`,
    body,
  );
}

export async function deleteEmbedForm(id: string) {
  return api.del<{ ok: boolean }>(`/embed-forms/${encodeURIComponent(id)}`);
}

export async function postEmbedPreviewToken(id: string) {
  return api.post<{
    token: string;
    expiresIn: number;
    publicId: string;
  }>(`/embed-forms/${encodeURIComponent(id)}/preview-token`, {});
}

export interface PublicEmbedConfig {
  publicId: string;
  name: string;
  templateKey: string;
  fieldConfig: EmbedFormFieldConfig;
  design: Record<string, unknown>;
  honeypotField: string;
  successMessage: string | null;
  privacyPolicyUrl: string | null;
  siteLabel?: string | null;
}

/** Публичные ручки embed: без JWT (и без перехвата 401 сессии CRM). */
async function publicJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, cache: 'no-store' });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (data as { message?: string })?.message ||
      (typeof data === 'string' ? data : res.statusText);
    const code = (data as { code?: string })?.code;
    throw new ApiError(
      String(msg) || 'Request failed',
      res.status,
      code,
      data,
    );
  }
  return data as T;
}

export async function fetchPublicEmbedConfig(
  publicId: string,
  previewToken?: string | null,
): Promise<PublicEmbedConfig> {
  const headers: Record<string, string> = {};
  if (previewToken) {
    headers['X-Embed-Preview-Token'] = previewToken;
  }
  return publicJson<PublicEmbedConfig>(
    `/public/embed/${encodeURIComponent(publicId)}/config`,
    { method: 'GET', headers },
  );
}

export async function submitPublicEmbed(
  publicId: string,
  body: Record<string, unknown>,
  previewToken?: string | null,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (previewToken) {
    headers['X-Embed-Preview-Token'] = previewToken;
  }
  return publicJson<{
    ok: boolean;
    accepted?: boolean;
    preview?: boolean;
    leadId?: string;
    silent?: boolean;
  }>(`/public/embed/${encodeURIComponent(publicId)}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export async function uploadPublicEmbedAttachment(
  publicId: string,
  file: File,
  previewToken?: string | null,
) {
  const form = new FormData();
  form.append('file', file);
  const headers: Record<string, string> = {};
  if (previewToken) {
    headers['X-Embed-Preview-Token'] = previewToken;
  }
  return publicJson<{ id: string; name: string }>(
    `/public/embed/${encodeURIComponent(publicId)}/attachment`,
    { method: 'POST', body: form, headers },
  );
}
