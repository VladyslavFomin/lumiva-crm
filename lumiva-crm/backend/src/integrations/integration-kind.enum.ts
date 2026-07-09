// src/integrations/integration-kind.enum.ts

export const INTEGRATION_KINDS = [
  'woocommerce',      // API WooCommerce
  'shopify',          // API Shopify Admin
  'manual-import',    // ручной импорт CSV/XML
  'other',            // прочие подключения
  'third_party_link', // Slack, Teams, Zapier, Make … — конфиг в JSON
] as const;

export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];