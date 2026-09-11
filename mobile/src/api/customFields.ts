import { api } from './client';

export type CustomFieldEntityType = 'contact' | 'company' | 'lead' | 'sale' | 'project';

export type CustomFieldType =
  | 'text' | 'number' | 'email' | 'phone' | 'date' | 'datetime' | 'daterange'
  | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'url';

export interface CustomFieldOption {
  value: string;
  label: string;
}

export interface CustomFieldDef {
  id: string;
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: CustomFieldOption[] | null;
  order: number;
  isActive: boolean;
}

// Кэш по entityType на время жизни приложения — схема полей не меняется за сессию просмотра,
// а этот вызов дёргается с КАЖДОГО экрана детали (Лид/Проект/Продажа/Контакт/Компания).
const cache = new Map<CustomFieldEntityType, Promise<CustomFieldDef[]>>();

export async function fetchCustomFieldDefs(entityType: CustomFieldEntityType): Promise<CustomFieldDef[]> {
  if (!cache.has(entityType)) {
    cache.set(
      entityType,
      api.get<CustomFieldDef[]>(`/custom-fields/entity/${entityType}`)
        .then((res) => res.data.filter((f) => f.isActive).sort((a, b) => a.order - b.order))
        .catch((err) => {
          cache.delete(entityType);
          throw err;
        }),
    );
  }
  return cache.get(entityType)!;
}

/** Schema management (add/edit/delete field definitions) — separate from the per-record
 * value-fetching above, which caches per entityType for the session; call this after any
 * schema change so screens re-fetch the updated field list instead of a stale cache. */
export function invalidateCustomFieldDefsCache(entityType?: CustomFieldEntityType) {
  if (entityType) cache.delete(entityType);
  else cache.clear();
}

export async function fetchAllCustomFieldDefs(): Promise<CustomFieldDef[]> {
  const res = await api.get<CustomFieldDef[]>('/custom-fields');
  return res.data;
}

export interface CreateCustomFieldPayload {
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  options?: CustomFieldOption[];
}

export async function createCustomFieldDef(payload: CreateCustomFieldPayload): Promise<CustomFieldDef> {
  const res = await api.post<CustomFieldDef>('/custom-fields', payload);
  invalidateCustomFieldDefsCache(payload.entityType);
  return res.data;
}

export async function updateCustomFieldDef(id: string, entityType: CustomFieldEntityType, patch: Partial<CreateCustomFieldPayload> & { isActive?: boolean }): Promise<CustomFieldDef> {
  const res = await api.patch<CustomFieldDef>(`/custom-fields/${id}`, patch);
  invalidateCustomFieldDefsCache(entityType);
  return res.data;
}

export async function deleteCustomFieldDef(id: string, entityType: CustomFieldEntityType): Promise<void> {
  await api.delete(`/custom-fields/${id}`);
  invalidateCustomFieldDefsCache(entityType);
}
