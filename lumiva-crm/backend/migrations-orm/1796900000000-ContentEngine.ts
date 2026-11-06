import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Движок публикаций (/marketing/smm): каналы, OAuth-подключения сетей без своего модуля (LinkedIn),
 * контент-планы, посты и варианты «пост × канал». См. md/content_engine_plan.md.
 */
export class ContentEngine1796900000000 implements MigrationInterface {
  name = 'ContentEngine1796900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "content_connections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "provider" varchar(24) NOT NULL,
        "external_id" varchar(120) NOT NULL,
        "name" varchar(255),
        "avatar_url" varchar(600),
        "access_token" text,
        "refresh_token" text,
        "expires_at" timestamptz,
        "scopes" text,
        "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_content_connections" ON "content_connections" ("tenant_id", "provider", "external_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "content_channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "network" varchar(24) NOT NULL,
        "account_id" varchar(120) NOT NULL,
        "account_name" varchar(255) NOT NULL,
        "account_handle" varchar(255),
        "avatar_url" varchar(600),
        "connection_id" uuid REFERENCES "content_connections"("id") ON DELETE SET NULL,
        "bot_id" uuid,
        "autonomy" varchar(12) NOT NULL DEFAULT 'assisted',
        "rules" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "enabled" boolean NOT NULL DEFAULT true,
        "status" varchar(16) NOT NULL DEFAULT 'ok',
        "last_error" text,
        "department_ids" text[] NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_content_channels" ON "content_channels" ("tenant_id", "network", "account_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "content_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "title" varchar(255) NOT NULL,
        "period_from" date,
        "period_to" date,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "source" varchar(16) NOT NULL DEFAULT 'manual',
        "department_id" uuid,
        "agent_id" uuid,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "content_posts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "plan_id" uuid REFERENCES "content_plans"("id") ON DELETE SET NULL,
        "title" varchar(255) NOT NULL DEFAULT '',
        "rubric" varchar(120),
        "format" varchar(16) NOT NULL DEFAULT 'post',
        "text" text NOT NULL DEFAULT '',
        "media" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "text_approved" boolean,
        "source" varchar(16) NOT NULL DEFAULT 'manual',
        "department_id" uuid,
        "agent_id" uuid,
        "comments" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "review_note" text,
        "created_by" uuid,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_content_posts_tenant_status" ON "content_posts" ("tenant_id", "status")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "content_variants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "post_id" uuid NOT NULL REFERENCES "content_posts"("id") ON DELETE CASCADE,
        "channel_id" uuid NOT NULL REFERENCES "content_channels"("id") ON DELETE CASCADE,
        "text" text,
        "publish_at" timestamptz,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "external_id" varchar(200),
        "url" varchar(600),
        "error" text,
        "attempts" int NOT NULL DEFAULT 0,
        "next_attempt_at" timestamptz,
        "published_at" timestamptz,
        "metrics" jsonb,
        "metrics_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_content_variants_post_channel" ON "content_variants" ("post_id", "channel_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_content_variants_due" ON "content_variants" ("status", "publish_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "content_variants"`);
    await q.query(`DROP TABLE IF EXISTS "content_posts"`);
    await q.query(`DROP TABLE IF EXISTS "content_plans"`);
    await q.query(`DROP TABLE IF EXISTS "content_channels"`);
    await q.query(`DROP TABLE IF EXISTS "content_connections"`);
  }
}
