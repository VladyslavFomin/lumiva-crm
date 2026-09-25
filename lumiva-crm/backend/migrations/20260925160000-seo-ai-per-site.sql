-- ИИ-SEO-ассистент: свой на каждый сайт тенанта (раньше один на тенанта).
ALTER TABLE seo_ai_agents ADD COLUMN IF NOT EXISTS "siteHost" varchar(255);
UPDATE seo_ai_agents SET "siteHost" = lower(regexp_replace(regexp_replace(regexp_replace(coalesce("siteUrl", ''), '^https?://', ''), '[/?#].*$', ''), '^www\.', ''))
  WHERE "siteHost" IS NULL;
DELETE FROM seo_ai_agents WHERE coalesce("siteHost", '') = '';
ALTER TABLE seo_ai_agents ALTER COLUMN "siteHost" SET NOT NULL;
DROP INDEX IF EXISTS uq_seo_ai_agents_tenant;
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_ai_agents_tenant_site ON seo_ai_agents ("tenantId", "siteHost");

ALTER TABLE seo_ai_reports ADD COLUMN IF NOT EXISTS "siteHost" varchar(255);
UPDATE seo_ai_reports SET "siteHost" = lower(regexp_replace(regexp_replace(regexp_replace("siteUrl", '^https?://', ''), '[/?#].*$', ''), '^www\.', ''))
  WHERE "siteHost" IS NULL;
ALTER TABLE seo_ai_reports ALTER COLUMN "siteHost" SET NOT NULL;
DROP INDEX IF EXISTS ix_seo_ai_reports_tenant_created;
CREATE INDEX IF NOT EXISTS ix_seo_ai_reports_tenant_site_created ON seo_ai_reports ("tenantId", "siteHost", "createdAt");
