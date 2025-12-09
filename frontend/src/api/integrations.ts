// src/api/integrations.ts
import { api } from './client';

// Типы интеграций – должны совпадать с backend (IntegrationKind)
export type IntegrationKind = 'woocommerce' | 'manual-import' | 'other';

// Адаптер (тип интеграции, который можно выбрать при создании подключения)
export interface IntegrationAdapterDto {
  kind: IntegrationKind;
  label: string;
  description?: string;
}

// Подключение интеграции (конкретный инстанс Woo / импорта и т.п.)
export interface IntegrationConnectionDto {
  id: string;
  name: string;
  kind: IntegrationKind;

  channelId: string | null;
  description: string | null;

  isEnabled: boolean;
  isDeleted: boolean;

  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastError: string | null;

  totalSalesCount: number;
  totalSalesAmount: number;
  currency: string;

  createdAt: string;
  updatedAt: string;
}

// Результат теста подключения
export interface TestIntegrationResponse {
  ok: boolean;
  message?: string;
}

// Результат ручной синхронизации
export interface SyncIntegrationResponse {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  message?: string;
}

// Пэйлоады для создания/обновления подключения
export interface CreateIntegrationPayload {
  name: string;
  kind: IntegrationKind;
  channelId?: string | null;
  description?: string | null;
  config: Record<string, any>;
}

export interface UpdateIntegrationPayload {
  name?: string;
  isEnabled?: boolean;
  channelId?: string | null;
  description?: string | null;
  config?: Record<string, any>;
}

/* ---------------- API-функции ---------------- */

// список доступных адаптеров (WooCommerce, далее 1C и т.д.)
export async function fetchAdapters(): Promise<IntegrationAdapterDto[]> {
  return api.get<IntegrationAdapterDto[]>('/integrations/adapters');
}

// список всех подключений интеграций
export async function fetchIntegrations(): Promise<IntegrationConnectionDto[]> {
  return api.get<IntegrationConnectionDto[]>('/integrations');
}

// создать новое подключение интеграции
export async function createIntegration(
  payload: CreateIntegrationPayload,
): Promise<IntegrationConnectionDto> {
  return api.post<IntegrationConnectionDto>('/integrations', payload);
}

// обновить существующее подключение
export async function updateIntegration(
  id: string,
  payload: UpdateIntegrationPayload,
): Promise<IntegrationConnectionDto> {
  return api.patch<IntegrationConnectionDto>(`/integrations/${id}`, payload);
}

// протестировать подключение
export async function testIntegration(
  id: string,
): Promise<TestIntegrationResponse> {
  return api.post<TestIntegrationResponse>(`/integrations/${id}/test`);
}

// запустить ручную синхронизацию
export async function syncIntegration(
  id: string,
): Promise<SyncIntegrationResponse> {
  return api.post<SyncIntegrationResponse>(`/integrations/${id}/sync`);
}
// --- Алиасы под старые имена, чтобы не трогать страницу ---

// старое имя для списка адаптеров
export async function fetchIntegrationAdapters() {
  return fetchAdapters();
}

// удалить подключение интеграции
export async function deleteIntegration(id: string): Promise<void> {
  return api.del<void>(`/integrations/${id}`);
}

// старое имя для теста подключения
export async function testIntegrationConnection(id: string) {
  return testIntegration(id);
}

// старое имя для ручной синхронизации
export async function triggerIntegrationSync(id: string) {
  return syncIntegration(id);
}