// src/api/integrations.ts
import { api } from './client';

// Типы интеграций – должны совпадать с backend (IntegrationKind)
export type IntegrationKind = 'woocommerce' | 'manual-import' | 'other' | 'third_party_link';

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
  linkCatalogId?: string | null;
  /** WhatsApp: URL для Callback URL в Meta (если на сервере задан PUBLIC_API_URL) */
  whatsappInboundWebhookUrl?: string | null;
  /** amoCRM: URL для входящих вебхуков (если задан PUBLIC_API_URL) */
  amocrmInboundWebhookUrl?: string | null;
  /** WordPress / CF7 — URL для заявок с сайта */
  siteFormInboundWebhookUrl?: string | null;
  /** WordPress / CF7 — URL с ?secret= (если GET с полным config или ответ create/update) */
  siteFormInboundWebhookPasteUrl?: string | null;
  /** Lumiva Wizard: POST CF7 в CRM с X-Api-Token */
  lumivaWizardCf7IngestUrl?: string | null;
  /** Только GET /integrations/:id — полный config (секреты). */
  config?: Record<string, unknown> | null;
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

/** GET /integrations/hub/catalog — зеркало backend integration-hub.types */
export type IntegrationHubLifecycle =
  | 'live'
  | 'beta'
  | 'planned'
  | 'in_development';

export type IntegrationHubCrmModule =
  | 'automations'
  | 'leads'
  | 'sales'
  | 'marketing'
  | 'projects'
  | 'workspace'
  | 'calendar';

export interface IntegrationHubCapabilityFlags {
  outboundAutomationActions: boolean;
  inboundWebhook: boolean;
  oauthPlatformSupported: boolean;
  salesImport: boolean;
  workspaceTableSync: boolean;
  calendarSync: boolean;
  leadCapture: boolean;
}

export interface IntegrationHubCatalogEntry {
  id: string;
  lifecycle: IntegrationHubLifecycle;
  modules: IntegrationHubCrmModule[];
  capabilities: IntegrationHubCapabilityFlags;
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

/** Готовность OAuth-приложений платформы по каталогу (без секретов) */
export async function fetchIntegrationOauthReadiness(): Promise<
  Record<string, { oauthReady: boolean }>
> {
  return api.get<Record<string, { oauthReady: boolean }>>('/integrations/oauth-readiness');
}

// список всех подключений интеграций
export async function fetchIntegrations(): Promise<IntegrationConnectionDto[]> {
  return api.get<IntegrationConnectionDto[]>('/integrations');
}

/** Одно подключение (для Google Sheets — с полным config). */
export async function fetchIntegration(id: string): Promise<IntegrationConnectionDto> {
  return api.get<IntegrationConnectionDto>(`/integrations/${id}`);
}

/** Каталог коннекторов CRM-хаба (без секретов) */
export async function fetchIntegrationHubCatalog(): Promise<
  IntegrationHubCatalogEntry[]
> {
  return api.get<IntegrationHubCatalogEntry[]>('/integrations/hub/catalog');
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

export type GoogleSheetsPreviewRow = { rowNumber: number; cells: string[] };

export type GoogleSheetsPreviewResult = {
  headers: string[];
  rows: GoogleSheetsPreviewRow[];
  previewFromRow: number;
  previewToRow: number;
};

/** Превью листа для выбора строк (без сохранения подключения). */
export async function startGoogleCalendarOAuth(body: {
  intent: 'create' | 'reconnect';
  redirectPath?: string;
  integrationId?: string;
  name?: string;
  calendarId?: string;
}): Promise<{ url: string }> {
  return api.post<{ url: string }>('/integrations/google-calendar/oauth/start', body);
}

export type GoogleCalendarEventSnapshotAttendee = {
  email?: string;
  displayName?: string;
  responseStatus?: string;
};

export type GoogleCalendarEventSnapshot = {
  summary: string | null;
  description: string | null;
  htmlLink: string | null;
  hangoutLink: string | null;
  meetUri: string | null;
  startDisplay: string | null;
  endDisplay: string | null;
  attendees: GoogleCalendarEventSnapshotAttendee[];
  organizerEmail: string | null;
  organizerDisplayName: string | null;
};

/** Детали события из Google (Meet, участники) — только для событий CRM с меткой Lumiva. */
export async function fetchGoogleCalendarEventSnapshot(
  eventId: string,
): Promise<GoogleCalendarEventSnapshot> {
  const enc = encodeURIComponent(eventId);
  return api.get<GoogleCalendarEventSnapshot>(
    `/integrations/google-calendar/events/${enc}`,
  );
}

export async function previewGoogleSheetsIntegration(payload: {
  spreadsheetId: string;
  apiToken: string;
  sheetTabName?: string;
  headerRow?: number;
  firstDataRow?: number;
  lastDataRow?: number;
  maxPreviewRows?: number;
}): Promise<GoogleSheetsPreviewResult> {
  return api.post<GoogleSheetsPreviewResult>(
    '/integrations/google-sheets/preview',
    payload,
  );
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