/** Где в CRM используется интеграция (для каталога / UI / RBAC). */
export type IntegrationCrmModule =
  | 'automations'
  | 'leads'
  | 'sales'
  | 'marketing'
  | 'projects'
  | 'workspace'
  | 'calendar';

/** Стадия зрелости коннектора. */
export type IntegrationLifecycle =
  | 'live'
  | 'beta'
  | 'planned'
  | 'in_development';

/**
 * Возможности коннектора (флаги для каталога и других сервисов CRM).
 * Не содержит секретов.
 */
export interface IntegrationCapabilityFlags {
  /** Шаги сценариев (Slack, Mailchimp, …). */
  outboundAutomationActions: boolean;
  /** Публичный URL вебхука в нашу сторону (WhatsApp, amo, WP…). */
  inboundWebhook: boolean;
  /** Можно ли ожидать OAuth-приложение платформы (pl1 / env). */
  oauthPlatformSupported: boolean;
  /** Импорт в продажи / канал WooCommerce и т.п. */
  salesImport: boolean;
  /** Синхронизация с пользовательскими таблицами рабочей области. */
  workspaceTableSync: boolean;
  /** Календарь Google / Outlook. */
  calendarSync: boolean;
  /** Создание / обновление лидов извне. */
  leadCapture: boolean;
}

/** Элемент каталога для GET /integrations/hub/catalog */
export interface IntegrationHubCatalogEntry {
  id: string;
  lifecycle: IntegrationLifecycle;
  modules: IntegrationCrmModule[];
  capabilities: IntegrationCapabilityFlags;
}
