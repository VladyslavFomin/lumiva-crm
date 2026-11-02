-- GA4 по доменам (hostName) по дням: визиты, покупки, выручка. Отдельно от marketing_traffic,
-- чтобы не умножать основной отчёт (источник × кампания × страна) на число доменов.
-- Нужна для разбивки выручки по модулям бронирования и сигнала «выручка пропала».
CREATE TABLE IF NOT EXISTS marketing_ga4_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "dataSource" varchar(80) NOT NULL,
  date date NOT NULL,
  host varchar(255) NOT NULL,
  sessions integer NOT NULL DEFAULT 0,
  purchases numeric(12,2) NOT NULL DEFAULT 0,
  revenue numeric(16,2) NOT NULL DEFAULT 0,
  currency varchar(8) NOT NULL DEFAULT 'EUR'
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_ga4_hosts_day" ON marketing_ga4_hosts ("tenantId", "dataSource", date, host);
