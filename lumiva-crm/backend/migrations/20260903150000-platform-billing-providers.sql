-- Multi-provider tariff billing: adds Stripe/YooKassa/iyzico selection per tenant plus
-- platform-wide (not per-tenant) credentials for the two new providers, and a short-lived
-- lookup table so iyzico's callback (which only carries back a token) can be resolved to
-- {tenantId, plan, period} without trusting anything in the redirect body.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(16);

ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS iyzico_api_key TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS iyzico_secret_key TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS iyzico_sandbox BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS yookassa_shop_id TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS yookassa_secret_key TEXT;

CREATE TABLE IF NOT EXISTS iyzico_billing_checkouts (
  token VARCHAR(128) PRIMARY KEY,
  tenant_id UUID NOT NULL,
  plan VARCHAR(32) NOT NULL,
  period VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
