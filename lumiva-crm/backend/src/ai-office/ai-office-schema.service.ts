import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Схема ИИ-офиса — тем же способом, что и ai-employees-schema.service.ts (идемпотентный DDL при
 * старте модуля). AiOfficeModule импортирует AiEmployeesModule, поэтому ai_agents к этому моменту
 * уже существует. Все таблицы — ON DELETE CASCADE от tenants (см. аудит FK 2026-09-29).
 */
@Injectable()
export class AiOfficeSchemaService implements OnModuleInit {
  private readonly log = new Logger(AiOfficeSchemaService.name);

  constructor(private readonly ds: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensure();
    } catch (e) {
      this.log.error(`AI office schema failed: ${(e as Error).message}`);
      throw e;
    }
  }

  private async ensure(): Promise<void> {
    const q = (sql: string) => this.ds.query(sql);

    await q(`
      CREATE TABLE IF NOT EXISTS "ai_departments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "color" varchar(16) NOT NULL,
        "slot_x" int NOT NULL DEFAULT 0,
        "slot_y" int NOT NULL DEFAULT 0,
        "template_key" varchar(40),
        "mission" text NOT NULL DEFAULT '',
        "system_prompt" text NOT NULL DEFAULT '',
        "rules" text[] NOT NULL DEFAULT '{}',
        "permissions" jsonb NOT NULL DEFAULT '{}',
        "connectors" text[] NOT NULL DEFAULT '{}',
        "engine" jsonb NOT NULL DEFAULT '{"mode":"platform"}',
        "monthly_budget_cents" int NOT NULL DEFAULT 15000,
        "parallel_limit" int NOT NULL DEFAULT 3,
        "work_hours" varchar(16) NOT NULL DEFAULT '24/7',
        "timezone" varchar(64) NOT NULL DEFAULT 'UTC',
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "paused_reason" varchar(24),
        "kpis" text[] NOT NULL DEFAULT '{}',
        "proactive_every_hours" int NOT NULL DEFAULT 6,
        "last_planned_at" timestamptz,
        "sort" int NOT NULL DEFAULT 0,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_departments_tenant" ON "ai_departments" ("tenant_id", "sort")`);
    await q(`ALTER TABLE "ai_departments" ADD COLUMN IF NOT EXISTS "language" varchar(2)`);
    await q(`ALTER TABLE "ai_office_tasks" ADD COLUMN IF NOT EXISTS "result_report" text`);
    await q(`ALTER TABLE "ai_office_tasks" ADD COLUMN IF NOT EXISTS "approval_mailed_at" timestamptz`);
    await q(`ALTER TABLE "ai_departments" ADD COLUMN IF NOT EXISTS "curator_agent_id" uuid REFERENCES ai_agents(id) ON DELETE SET NULL`);
    await q(`ALTER TABLE "ai_departments" ADD COLUMN IF NOT EXISTS "programs" jsonb`);
    await q(`ALTER TABLE "ai_departments" ADD COLUMN IF NOT EXISTS "safety" jsonb NOT NULL DEFAULT '{"dailySends":50,"minHoursPerClient":48,"stopList":[]}'`);
    await q(`ALTER TABLE "ai_office_tasks" ADD COLUMN IF NOT EXISTS "data_used" jsonb NOT NULL DEFAULT '[]'`);
    await q(`ALTER TABLE "ai_departments" ADD COLUMN IF NOT EXISTS "playbooks_installed" boolean NOT NULL DEFAULT false`);
    // отделы до появления поля: язык по тексту цели (кириллица → ru), иначе язык компании
    await q(`UPDATE "ai_departments" d SET "language" = CASE WHEN d."mission" ~ '[А-Яа-яЁё]' THEN 'ru'
              ELSE COALESCE(NULLIF(lower(left(t."uiLanguage", 2)), ''), 'en') END
             FROM "tenants" t WHERE t."id" = d."tenant_id" AND d."language" IS NULL`);
    await q(`UPDATE "ai_departments" SET "language" = 'en' WHERE "language" NOT IN ('ru','en','tr') OR "language" IS NULL`);
    // одна комната — один слот на карте
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_departments_slot" ON "ai_departments" ("tenant_id", "slot_x", "slot_y")`);

    // агенты отдела — те же ai_agents (все права/согласования/журнал/защиты работают как у ИИ-сотрудников)
    // колонки добавляет ai-employees-schema.service.ts (до инициализации этого модуля), здесь — только FK
    await q(`ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "department_id" uuid`);
    await q(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ai_agents_department') THEN
        ALTER TABLE "ai_agents" ADD CONSTRAINT "FK_ai_agents_department" FOREIGN KEY ("department_id") REFERENCES "ai_departments"("id") ON DELETE CASCADE;
      END IF;
    END $$`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_agents_department" ON "ai_agents" ("department_id")`);
    // агенты отдела говорят на языке отдела
    await q(`UPDATE "ai_agents" a SET "language" = CASE d."language" WHEN 'ru' THEN 'Russian' WHEN 'tr' THEN 'Turkish' ELSE 'English' END
             FROM "ai_departments" d WHERE d."id" = a."department_id" AND d."language" IS NOT NULL
               AND a."language" IS DISTINCT FROM CASE d."language" WHEN 'ru' THEN 'Russian' WHEN 'tr' THEN 'Turkish' ELSE 'English' END`);

    await q(`
      CREATE TABLE IF NOT EXISTS "ai_office_issues" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "department_id" uuid NOT NULL REFERENCES "ai_departments"("id") ON DELETE CASCADE,
        "agent_id" uuid REFERENCES "ai_agents"("id") ON DELETE SET NULL,
        "task_id" uuid,
        "kind" varchar(16) NOT NULL,
        "title" varchar(255) NOT NULL,
        "detail" text NOT NULL DEFAULT '',
        "fix" varchar(16) NOT NULL,
        "target" varchar(64),
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "dedupe_key" varchar(160),
        "resolved_by" uuid,
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_office_issues_open" ON "ai_office_issues" ("tenant_id", "status")`);
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_office_issues_open_dedupe" ON "ai_office_issues" ("tenant_id", "dedupe_key") WHERE "status" = 'open' AND "dedupe_key" IS NOT NULL`);

    await q(`
      CREATE TABLE IF NOT EXISTS "ai_office_tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "department_id" uuid NOT NULL REFERENCES "ai_departments"("id") ON DELETE CASCADE,
        "agent_id" uuid REFERENCES "ai_agents"("id") ON DELETE SET NULL,
        "title" varchar(255) NOT NULL,
        "details" text NOT NULL DEFAULT '',
        "source" varchar(24) NOT NULL DEFAULT 'manual',
        "source_ref" varchar(160),
        "entity_type" varchar(40),
        "entity_id" varchar(64),
        "status" varchar(16) NOT NULL DEFAULT 'backlog',
        "progress" int NOT NULL DEFAULT 0,
        "step" varchar(24) NOT NULL DEFAULT 'queued',
        "priority" int NOT NULL DEFAULT 2,
        "pending_action_ids" uuid[] NOT NULL DEFAULT '{}',
        "result_summary" text,
        "artifacts" jsonb NOT NULL DEFAULT '[]',
        "issue_id" uuid REFERENCES "ai_office_issues"("id") ON DELETE SET NULL,
        "parent_task_id" uuid REFERENCES "ai_office_tasks"("id") ON DELETE SET NULL,
        "from_department_id" uuid REFERENCES "ai_departments"("id") ON DELETE SET NULL,
        "handoff_depth" int NOT NULL DEFAULT 0,
        "cost_cents" int NOT NULL DEFAULT 0,
        "tokens" int NOT NULL DEFAULT 0,
        "attempts" int NOT NULL DEFAULT 0,
        "error" text,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        "decided_by" uuid,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_office_tasks_dept_status" ON "ai_office_tasks" ("tenant_id", "department_id", "status")`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_office_tasks_queue" ON "ai_office_tasks" ("status", "priority", "created_at")`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_office_tasks_source" ON "ai_office_tasks" ("tenant_id", "source", "source_ref")`);
    await q(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ai_office_issues_task') THEN
        ALTER TABLE "ai_office_issues" ADD CONSTRAINT "FK_ai_office_issues_task" FOREIGN KEY ("task_id") REFERENCES "ai_office_tasks"("id") ON DELETE SET NULL;
      END IF;
    END $$`);

    await q(`
      CREATE TABLE IF NOT EXISTS "ai_office_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "department_id" uuid REFERENCES "ai_departments"("id") ON DELETE CASCADE,
        "task_id" uuid REFERENCES "ai_office_tasks"("id") ON DELETE SET NULL,
        "agent_id" uuid REFERENCES "ai_agents"("id") ON DELETE SET NULL,
        "to_agent_id" uuid REFERENCES "ai_agents"("id") ON DELETE SET NULL,
        "kind" varchar(32) NOT NULL,
        "tool" varchar(80),
        "text" varchar(500) NOT NULL,
        "level" varchar(8) NOT NULL DEFAULT 'ok',
        "meta" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_office_events_tenant_created" ON "ai_office_events" ("tenant_id", "created_at")`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_office_events_dept_created" ON "ai_office_events" ("department_id", "created_at")`);

    await q(`
      CREATE TABLE IF NOT EXISTS "ai_brain_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "department_id" uuid REFERENCES "ai_departments"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "type" varchar(12) NOT NULL,
        "mime" varchar(128),
        "size_bytes" bigint NOT NULL DEFAULT 0,
        "storage_path" varchar(512),
        "body_md" text,
        "text_content" text,
        "scope" text[] NOT NULL DEFAULT '{all}',
        "index_status" varchar(16) NOT NULL DEFAULT 'pending',
        "index_progress" int NOT NULL DEFAULT 0,
        "chunk_count" int NOT NULL DEFAULT 0,
        "index_error" text,
        "source" varchar(16) NOT NULL DEFAULT 'upload',
        "uploaded_by" uuid,
        "author_agent_id" uuid REFERENCES "ai_agents"("id") ON DELETE SET NULL,
        "last_read_at" timestamptz,
        "last_read_agent_id" uuid REFERENCES "ai_agents"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_brain_files_tenant_folder" ON "ai_brain_files" ("tenant_id", "department_id")`);

    await q(`
      CREATE TABLE IF NOT EXISTS "ai_brain_chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "file_id" uuid NOT NULL REFERENCES "ai_brain_files"("id") ON DELETE CASCADE,
        "ord" int NOT NULL,
        "text" text NOT NULL,
        "embedding" real[],
        "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "text")) STORED
      )`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_brain_chunks_file" ON "ai_brain_chunks" ("file_id", "ord")`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_brain_chunks_tsv" ON "ai_brain_chunks" USING GIN ("tsv")`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_brain_chunks_tenant" ON "ai_brain_chunks" ("tenant_id")`);

    await q(`
      CREATE TABLE IF NOT EXISTS "ai_office_access" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "connector" varchar(40) NOT NULL,
        "connection_id" varchar(64) NOT NULL DEFAULT '',
        "label" varchar(190) NOT NULL DEFAULT '',
        "department_ids" uuid[] NOT NULL DEFAULT '{}',
        "granted_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_office_access_conn" ON "ai_office_access" ("tenant_id", "connector", "connection_id")`);

    // оплаченные доп. слоты отделов (ручное продление, как и сам тариф — см. billing)
    await q(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_office_extra_slots" int NOT NULL DEFAULT 0`);
    await q(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_office_digest_on" date`);
    await q(`ALTER TABLE "marketing_traffic" ADD COLUMN IF NOT EXISTS "allConversions" numeric(14,2) NOT NULL DEFAULT 0`);
    await q(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_office_slots_until" timestamptz`);
    await q(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_office_last_payment" varchar(200)`);
    // iyzico присылает в callback только token — тип покупки храним в своей таблице-связке
    await q(`ALTER TABLE "iyzico_billing_checkouts" ADD COLUMN IF NOT EXISTS "purchase_type" varchar(32)`);
    await q(`ALTER TABLE "iyzico_billing_checkouts" ADD COLUMN IF NOT EXISTS "extra_slots" int`);

    // автопостинг: посты одобренного владельцем контент-плана, выходят по расписанию
    await q(`
      CREATE TABLE IF NOT EXISTS "ai_office_posts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "department_id" uuid NOT NULL REFERENCES "ai_departments"("id") ON DELETE CASCADE,
        "plan_action_id" uuid,
        "task_id" uuid,
        "bot_id" uuid NOT NULL,
        "channel" varchar(120) NOT NULL,
        "text" text NOT NULL,
        "publish_at" timestamptz NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'scheduled',
        "error" text,
        "url" varchar(300),
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_office_posts_due" ON "ai_office_posts" ("status", "publish_at")`);
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_office_posts_dept" ON "ai_office_posts" ("department_id", "publish_at")`);

    // расход ИИ по отделам/задачам (колонки — ai-employees-schema.service.ts)
    await q(`CREATE INDEX IF NOT EXISTS "IDX_ai_usage_logs_department" ON "ai_usage_logs" ("department_id", "createdAt")`);
  }
}
