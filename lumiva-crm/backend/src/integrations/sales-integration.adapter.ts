// src/integrations/sales-integration.adapter.ts

import type { IntegrationKind } from './integration-kind.enum';
import type { IntegrationConnection } from './integration-connection.entity';

// Результат проверки подключения
export interface TestConnectionResult {
  ok: boolean;
  message?: string;
}

// Результат синхронизации
export interface SyncResult {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  message?: string;
  /** Записи пользовательской таблицы (Woo + customObjectId в запросе синка) */
  workspaceCreated?: number;
  workspaceUpdated?: number;
  workspaceSkipped?: number;
}

/** Контекст только для WooCommerce → рабочая область */
export type WooWorkspaceImportMapping = {
  /** Колонки Woo (ключи flatten), которые импортируем */
  enabledWooColumns: string[];
  /** Колонка Woo → ключ поля таблицы */
  wooColumnToFieldKey: Record<string, string>;
  /** Какое поле таблицы считать «статусом» (должно быть сопоставлено с колонкой Woo, напр. status) */
  statusFieldKey?: string | null;
  /** full — одна запись на строку источника; aggregate — группировка и суммы числовых колонок */
  importMode?: 'full' | 'aggregate';
  /** Ключи колонок источника для GROUP BY (напр. session_source + country_id) */
  aggregateGroupBySourceKeys?: string[];
};

export type IntegrationSyncContext = {
  tenantId: string;
  customObjectId?: string;
  /** Если задано — строки таблицы строятся только по этому маппингу (после превью) */
  wooWorkspaceImport?: WooWorkspaceImportMapping;
};

// Базовый интерфейс адаптера интеграции
export interface SalesIntegrationAdapter {
  readonly kind: IntegrationKind;
  readonly label: string;

  testConnection(connection: IntegrationConnection): Promise<TestConnectionResult>;
  syncSales(
    connection: IntegrationConnection,
    context?: IntegrationSyncContext,
  ): Promise<SyncResult>;
}