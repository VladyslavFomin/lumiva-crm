-- ============================================================================
-- Lumiva CRM: таблицы встраиваемых форм (embed_forms, embed_form_uploads)
--
-- Когда: prod с synchronize: false, или ручной контроль схемы.
-- Как применить (из каталога backend, с .env):
--   npm run migration:embed-forms
-- Docker (из каталога infra репозитория):
--   ./apply-embed-forms-migration.sh
-- Вручную:
--   psql "postgresql://$DB_USER:$DB_PASS@$DB_HOST:${DB_PORT:-5432}/$DB_NAME" -f ../backend/migrations/20260426190000-embed-forms.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "embed_forms" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "site_id" uuid NOT NULL,
  "name" character varying(220) NOT NULL,
  "public_id" character varying(40) NOT NULL,
  "template_key" character varying(64) NOT NULL,
  "field_config" jsonb NOT NULL,
  "design" jsonb NOT NULL,
  "published" boolean NOT NULL DEFAULT false,
  "honeypot_field" character varying(64) NOT NULL,
  "privacy_policy_url" text,
  "success_message" text,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_embed_forms_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_embed_forms_public_id" UNIQUE ("public_id"),
  CONSTRAINT "FK_embed_forms_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_embed_forms_site" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_8b2f0c1a_embed_forms_tenant_id" ON "embed_forms" ("tenant_id");
CREATE INDEX IF NOT EXISTS "IDX_8b2f0c1a_embed_forms_site_id" ON "embed_forms" ("site_id");
CREATE INDEX IF NOT EXISTS "IDX_8b2f0c1a_embed_forms_public_id" ON "embed_forms" ("public_id");
CREATE INDEX IF NOT EXISTS "IDX_8b2f0c1a_embed_forms_tenant_site" ON "embed_forms" ("tenant_id", "site_id");

CREATE TABLE IF NOT EXISTS "embed_form_uploads" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "form_id" uuid NOT NULL,
  "relative_path" character varying(512) NOT NULL,
  "original_name" character varying(255) NOT NULL,
  "mimetype" character varying(128),
  "size_bytes" bigint NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_embed_form_uploads_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_embed_form_uploads_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_embed_form_uploads_form" FOREIGN KEY ("form_id") REFERENCES "embed_forms"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_9c3a1b2d_embed_uploads_tenant" ON "embed_form_uploads" ("tenant_id");
CREATE INDEX IF NOT EXISTS "IDX_9c3a1b2d_embed_uploads_tenant_form" ON "embed_form_uploads" ("tenant_id", "form_id");

COMMIT;
