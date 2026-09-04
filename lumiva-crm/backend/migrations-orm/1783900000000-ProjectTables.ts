import { MigrationInterface, QueryRunner } from 'typeorm';

/** Real, per-table data isolation for the Projects module. Until now every "table" tab
 * ("Таблица", user-created custom views) was a frontend-only localStorage filter over the
 * single shared `crm_projects` dataset — a project created on one tab always leaked into
 * every other tab. This migration introduces `project_tables` (a genuine separate dataset
 * per table) and `project_table_members` (per-table sharing, mirroring
 * workspace_area_members), and backfills one default `slug='main'` table per existing
 * tenant so every current project keeps working exactly as before. Non-default tables are
 * created by users afterwards and are private until explicitly shared — no owner-bypass
 * seeding here (unlike WorkspaceAreaMembers), since there's nothing to seed yet: private
 * tables don't exist until users create them. */
export class ProjectTables1783900000000 implements MigrationInterface {
  name = 'ProjectTables1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_tables" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "createdByStaffId" uuid,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_project_tables_tenant_slug"
        ON "project_tables" ("tenantId", "slug")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_table_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectTableId" uuid NOT NULL REFERENCES "project_tables"("id") ON DELETE CASCADE,
        "staffUserId" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
        "role" varchar(24) NOT NULL,
        "invitedByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_project_table_members_table_staff"
        ON "project_table_members" ("projectTableId", "staffUserId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_table_members_tenant"
        ON "project_table_members" ("tenantId")
    `);

    await queryRunner.query(`
      ALTER TABLE "crm_projects" ADD COLUMN IF NOT EXISTS "table_id" uuid REFERENCES "project_tables"("id")
    `);

    // One default table per tenant that already has projects.
    await queryRunner.query(`
      INSERT INTO "project_tables" ("tenantId", "name", "slug", "sortOrder")
      SELECT DISTINCT "tenant_id", 'Таблица', 'main', 0
      FROM "crm_projects"
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "crm_projects" p
      SET "table_id" = pt."id"
      FROM "project_tables" pt
      WHERE pt."tenantId" = p."tenant_id" AND pt."slug" = 'main' AND p."table_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "crm_projects" DROP COLUMN IF EXISTS "table_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_table_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_tables"`);
  }
}
