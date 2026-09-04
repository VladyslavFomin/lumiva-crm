// src/api/custom-fields.ts
import { api } from './client';

export type EntityType = 'contact' | 'company' | 'lead' | 'sale' | 'project';

export type FieldType = 'text' | 'number' | 'email' | 'phone' | 'date' | 'datetime' | 'daterange' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'url';

/** Источник значения для email/phone полей: тянуть из привязанного лида/компании вместо ручного ввода. */
export type CustomFieldValueSource = 'manual' | 'lead' | 'company';

export interface CustomFieldMeta {
  source?: CustomFieldValueSource;
  [key: string]: any;
}

export interface CustomField {
  id: string;
  tenantId: string;
  entityType: EntityType;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: Array<{ value: string; label: string }> | null;
  defaultValue: string | null;
  order: number;
  isActive: boolean;
  meta?: CustomFieldMeta | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomFieldDto {
  entityType: EntityType;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
  order?: number;
  isActive?: boolean;
  meta?: CustomFieldMeta;
}

export interface UpdateCustomFieldDto extends Partial<CreateCustomFieldDto> {
  // key и entityType нельзя менять
}

export function normalizeCustomFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export async function fetchCustomFields(entityType?: EntityType): Promise<CustomField[]> {
  const qs = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
  const res = await api.get<CustomField[]>(`/custom-fields${qs}`);
  return res;
}

export async function fetchCustomField(id: string): Promise<CustomField> {
  const res = await api.get<CustomField>(`/custom-fields/${id}`);
  return res;
}

export async function createCustomField(dto: CreateCustomFieldDto): Promise<CustomField> {
  const res = await api.post<CustomField>('/custom-fields', dto);
  return res;
}

export async function updateCustomField(id: string, dto: UpdateCustomFieldDto): Promise<CustomField> {
  const res = await api.patch<CustomField>(`/custom-fields/${id}`, dto);
  return res;
}

export async function deleteCustomField(id: string): Promise<void> {
  await api.delete(`/custom-fields/${id}`);
}













