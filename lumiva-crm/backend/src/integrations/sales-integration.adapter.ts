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
}

// Базовый интерфейс адаптера интеграции
export interface SalesIntegrationAdapter {
  readonly kind: IntegrationKind;
  readonly label: string;

  testConnection(connection: IntegrationConnection): Promise<TestConnectionResult>;
  syncSales(connection: IntegrationConnection): Promise<SyncResult>;
}