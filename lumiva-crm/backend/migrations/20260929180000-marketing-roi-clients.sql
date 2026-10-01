-- ROI по клиентам: кабинет → компания CRM и выручка клиента по месяцам.
CREATE TABLE IF NOT EXISTS marketing_account_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "accountKey" varchar(120) NOT NULL,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_account_clients_key" ON marketing_account_clients ("tenantId", "accountKey");

CREATE TABLE IF NOT EXISTS client_revenue_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month varchar(7) NOT NULL,
  amount numeric(16,2) NOT NULL DEFAULT 0,
  currency varchar(8) NOT NULL DEFAULT 'EUR',
  source varchar(16) NOT NULL DEFAULT 'manual',
  note text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_client_revenue_monthly" ON client_revenue_monthly ("tenantId", "companyId", month);
