// src/integrations/integration-kind.enum.ts

export const INTEGRATION_KINDS = [
  'woocommerce',      // API WooCommerce
  'manual-import',    // ручной импорт CSV/XML
  'other',            // прочие подключения
] as const;

export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];