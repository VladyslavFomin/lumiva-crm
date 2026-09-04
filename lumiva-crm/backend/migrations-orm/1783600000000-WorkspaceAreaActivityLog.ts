import { MigrationInterface, QueryRunner } from 'typeorm';

/** New workspace_area_activity_log table — a real, persisted event history for an area
 * (sync/import/push/mapping-change/table-created/error), replacing what was previously only
 * the single latest sync status on IntegrationConnection. No FK on workspaceAreaId/
 * relatedObjectId (matches audit_logs' precedent) so the log survives deletion of its subject. */
export class WorkspaceAreaActivityLog1783600000000 implements MigrationInterface {
  name = 'WorkspaceAreaActivityLog1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_area_activity_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "workspaceAreaId" uuid NOT NULL,
        "kind" varchar(24) NOT NULL,
        "title" varchar(255) NOT NULL,
        "detail" text,
        "relatedObjectId" uuid,
        "actorUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workspace_area_activity_log_tenant_area_created"
        ON "workspace_area_activity_log" ("tenantId", "workspaceAreaId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_area_activity_log"`);
  }
}
