-- ИИ-SEO-ассистент: настройки (один на тенанта) и еженедельные отчёты.
CREATE TABLE IF NOT EXISTS seo_ai_agents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenantId" uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  "siteUrl" text,
  pages jsonb NOT NULL DEFAULT '[]',
  keywords jsonb NOT NULL DEFAULT '[]',
  recipients jsonb NOT NULL DEFAULT '[]',
  weekday int NOT NULL DEFAULT 1,
  hour int NOT NULL DEFAULT 9,
  timezone varchar(64) NOT NULL DEFAULT 'Europe/Istanbul',
  language varchar(8) NOT NULL DEFAULT 'ru',
  focus text,
  "lastRunAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_ai_agents_tenant ON seo_ai_agents ("tenantId");

CREATE TABLE IF NOT EXISTS seo_ai_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenantId" uuid NOT NULL,
  "siteUrl" text NOT NULL,
  trigger varchar(16) NOT NULL DEFAULT 'manual',
  status varchar(16) NOT NULL DEFAULT 'running',
  stage varchar(32),
  score int,
  facts jsonb,
  report jsonb,
  error text,
  "emailedTo" jsonb NOT NULL DEFAULT '[]',
  "createdByUserId" uuid,
  "finishedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_seo_ai_reports_tenant_created ON seo_ai_reports ("tenantId", "createdAt");
