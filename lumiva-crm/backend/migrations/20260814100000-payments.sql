-- Payments: iyzico / PayTR checkout sessions, linked to a Sale or a public storefront order.

CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       UUID NOT NULL,
  provider         VARCHAR(24) NOT NULL,
  status           VARCHAR(16) NOT NULL DEFAULT 'pending',
  amount           DOUBLE PRECISION NOT NULL,
  currency         VARCHAR(8) NOT NULL DEFAULT 'TRY',
  "saleId"         UUID,
  source           VARCHAR(24) NOT NULL DEFAULT 'sale_link',
  token            VARCHAR(255),
  "conversationId" VARCHAR(128),
  "paymentPageUrl" TEXT,
  "providerRaw"    JSONB,
  "failReason"     TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "paidAt"         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_sale ON payments ("tenantId", "saleId");
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status ON payments ("tenantId", status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_token ON payments (token) WHERE token IS NOT NULL;
