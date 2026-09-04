import { MigrationInterface, QueryRunner } from 'typeorm';

/** New `workspace_area_members` table — area-scoped roles (owner/editor/reader/own_rows_only)
 * for the upcoming Workspace Area RBAC enforcement. Custom-object endpoints had NO permission
 * gating before this (any authenticated tenant staff member could read/write any table) —
 * this migration backfills an 'owner' membership row for every existing area × every
 * tenant-global 'owner'-role staff user, so nobody loses access once enforcement ships. */
export class WorkspaceAreaMembers1783400000000 implements MigrationInterface {
  name = 'WorkspaceAreaMembers1783400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_area_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "workspaceAreaId" uuid NOT NULL REFERENCES "workspace_areas"("id") ON DELETE CASCADE,
        "staffUserId" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
        "role" varchar(24) NOT NULL,
        "invitedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_workspace_area_members_area_staff"
        ON "workspace_area_members" ("workspaceAreaId", "staffUserId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workspace_area_members_tenant"
        ON "workspace_area_members" ("tenantId")
    `);

    await queryRunner.query(`
      INSERT INTO "workspace_area_members" ("tenantId", "workspaceAreaId", "staffUserId", "role")
      SELECT wa."tenantId", wa."id", su."id", 'owner'
      FROM "workspace_areas" wa
      JOIN "staff_users" su ON su."tenant_id" = wa."tenantId" AND su."role" = 'owner'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_area_members"`);
  }
}
