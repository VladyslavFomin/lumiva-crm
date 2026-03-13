// src/api/custom-fields.ts
import { api } from './client';

export type EntityType = 'contact' | 'company' | 'lead' | 'sale' | 'project';

export type FieldType = 'text' | 'number' | 'email' | 'phone' | 'date' | 'datetime' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'url';

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
}

export interface UpdateCustomFieldDto extends Partial<CreateCustomFieldDto> {
  // key и entityType нельзя менять
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













