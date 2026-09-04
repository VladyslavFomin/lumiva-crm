-- Marketing email templates (used by /marketing/email-templates and the tenant AI/transactional
-- mail wrapper selector in Настройки компании → aiWrapperEmailTemplateId). Both the table and the
-- tenants column were created via TypeORM synchronize during development without an accompanying
-- migration — this backfills schema parity for fresh databases. Column names match the live
-- schema (created under default TypeORM naming, i.e. camelCase, unlike this repo's usual
-- snake_case convention for hand-written migrations).

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenantId" UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(255),
  "htmlBody" TEXT,
  "textBody" TEXT,
  meta JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_06c564c515d8cdb40b6f3bfbbb4" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS "IDX_2922bb3ea8f35e25c310789acc" ON email_templates ("tenantId", name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_9bbba723be40ebdd6c93587a997'
  ) THEN
    ALTER TABLE email_templates
      ADD CONSTRAINT "FK_9bbba723be40ebdd6c93587a997"
      FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_wrapper_email_template_id UUID;
