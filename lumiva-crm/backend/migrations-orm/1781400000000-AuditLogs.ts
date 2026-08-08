import { MigrationInterface, QueryRunner } from 'typeorm';

/** Unified cross-entity activity/audit log — a single global feed on top of the existing
 * per-entity logs (LeadActivity, ProjectActivity, ReservationActivity, ProductChangeLog), which
 * keep working as-is for their own "history" tabs. Wired into Leads (via LeadActivityService),
 * Contacts, Companies, Sales, and Hotel reservations. */
export class AuditLogs1781400000000 implements MigrationInterface {
  name = 'AuditLogs1781400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "entityType" varchar(32) NOT NULL,
        "entityId" uuid NOT NULL,
        "entityLabel" varchar(255),
        "action" varchar(16) NOT NULL,
        "summary" text,
        "changes" jsonb,
        "actorUserId" uuid,
        "actorName" varchar(255),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_created"
        ON "audit_logs" ("tenantId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_entity"
        ON "audit_logs" ("tenantId", "entityType", "entityId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_tenant_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_tenant_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
