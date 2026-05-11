import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AiEmployeesSchemaService implements OnModuleInit {
  private readonly log = new Logger(AiEmployeesSchemaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    try {
      await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    } catch (e) {
      this.log.warn(
        `pgcrypto extension check skipped: ${(e as Error).message}`,
      );
    }

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "ai_agents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "role" varchar(80) NOT NULL,
        "name" varchar(190) NOT NULL,
        "avatar_url" varchar(512),
        "department" varchar(120),
        "job_title" varchar(160),
        "language" varchar(64) NOT NULL DEFAULT 'English',
        "tone" varchar(255) NOT NULL DEFAULT 'Professional, warm, concise',
        "status" varchar(32) NOT NULL DEFAULT 'setup_required',
        "autonomy_mode" varchar(32) NOT NULL DEFAULT 'suggest',
        "provider" varchar(80) NOT NULL DEFAULT 'openai_compatible',
        "model" varchar(128),
        "daily_report_time" varchar(8) NOT NULL DEFAULT '18:00',
        "schedule_mode" varchar(40) NOT NULL DEFAULT 'manual',
        "created_by" uuid,
        "settings" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agents_tenant_status" ON "ai_agents" ("tenant_id", "status")`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agents_tenant_role" ON "ai_agents" ("tenant_id", "role")`,
    );

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "ai_agent_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "agent_id" uuid NOT NULL REFERENCES "ai_agents"("id") ON DELETE CASCADE,
        "permission_key" varchar(80) NOT NULL,
        "value" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_agent_permissions_agent_key" UNIQUE ("tenant_id", "agent_id", "permission_key")
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "ai_agent_approval_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "agent_id" uuid NOT NULL REFERENCES "ai_agents"("id") ON DELETE CASCADE,
        "action_type" varchar(80) NOT NULL,
        "requires_approval" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ai_agent_approval_rules_agent_action" UNIQUE ("tenant_id", "agent_id", "action_type")
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "ai_agent_actions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "agent_id" uuid NOT NULL REFERENCES "ai_agents"("id") ON DELETE CASCADE,
        "action_type" varchar(80) NOT NULL,
        "target_type" varchar(80),
        "target_id" varchar(160),
        "title" varchar(255) NOT NULL,
        "reason" text,
        "payload" jsonb,
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "requires_approval" boolean NOT NULL DEFAULT true,
        "approved_by" uuid,
        "approved_at" timestamptz,
        "executed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_actions_tenant_status_created" ON "ai_agent_actions" ("tenant_id", "status", "created_at")`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_actions_tenant_agent_created" ON "ai_agent_actions" ("tenant_id", "agent_id", "created_at")`,
    );

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "ai_agent_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "agent_id" uuid REFERENCES "ai_agents"("id") ON DELETE SET NULL,
        "action_id" uuid REFERENCES "ai_agent_actions"("id") ON DELETE SET NULL,
        "user_id" uuid,
        "event_type" varchar(80) NOT NULL,
        "target_type" varchar(80),
        "target_id" varchar(160),
        "input_summary" text,
        "output_summary" text,
        "status" varchar(32) NOT NULL DEFAULT 'success',
        "error_message" text,
        "model" varchar(128),
        "tokens_used" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_logs_tenant_created" ON "ai_agent_logs" ("tenant_id", "created_at")`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_logs_tenant_agent_created" ON "ai_agent_logs" ("tenant_id", "agent_id", "created_at")`,
    );

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "ai_agent_reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "agent_id" uuid NOT NULL REFERENCES "ai_agents"("id") ON DELETE CASCADE,
        "report_type" varchar(80) NOT NULL DEFAULT 'daily',
        "title" varchar(255) NOT NULL,
        "content_md" text NOT NULL,
        "content_json" jsonb,
        "period_start" timestamptz,
        "period_end" timestamptz,
        "sent_to" jsonb,
        "status" varchar(32) NOT NULL DEFAULT 'generated',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_reports_tenant_created" ON "ai_agent_reports" ("tenant_id", "created_at")`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_reports_tenant_agent_created" ON "ai_agent_reports" ("tenant_id", "agent_id", "created_at")`,
    );

    this.log.log('AI Employees schema is ready');
  }
}
