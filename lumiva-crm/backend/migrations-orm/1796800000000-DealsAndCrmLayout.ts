import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «Сделки» (на движке проектов: crm_projects.kind = 'deal') со своей воронкой статусов и
 * настройки структуры CRM (tenants.crmLayout: блоки карточек лида/проекта/сделки, бюджет проектов).
 */
export class DealsAndCrmLayout1796800000000 implements MigrationInterface {
  name = 'DealsAndCrmLayout1796800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "crm_projects" ADD COLUMN IF NOT EXISTS "kind" varchar(16) NOT NULL DEFAULT 'project'`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_projects_tenant_kind" ON "crm_projects" ("tenant_id", "kind")`);

    await q.query(`ALTER TABLE "project_status_definitions" ADD COLUMN IF NOT EXISTS "kind" varchar(16) NOT NULL DEFAULT 'project'`);
    // won | lost — смысл статуса для воронки сделок и аналитики («Создать продажу» у выигранной)
    await q.query(`ALTER TABLE "project_status_definitions" ADD COLUMN IF NOT EXISTS "outcome" varchar(8)`);
    // уникальность «тенант + значение» была constraint'ом (а где-то — просто индексом): снимаем оба варианта
    await q.query(`ALTER TABLE "project_status_definitions" DROP CONSTRAINT IF EXISTS "UQ_project_status_tenant_value"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_project_status_tenant_value"`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_project_status_tenant_kind_value" ON "project_status_definitions" ("tenantId", "kind", "value")`,
    );
    await q.query(`UPDATE "project_status_definitions" SET "outcome" = 'won' WHERE "kind" = 'project' AND "value" = 'Выиграно' AND "outcome" IS NULL`);
    await q.query(`UPDATE "project_status_definitions" SET "outcome" = 'lost' WHERE "kind" = 'project' AND "value" = 'Проиграно' AND "outcome" IS NULL`);

    await q.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "crmLayout" jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "crmLayout"`);
    await q.query(`DELETE FROM "project_status_definitions" WHERE "kind" <> 'project'`);
    await q.query(`DROP INDEX IF EXISTS "UQ_project_status_tenant_kind_value"`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_project_status_tenant_value" ON "project_status_definitions" ("tenantId", "value")`);
    await q.query(`ALTER TABLE "project_status_definitions" DROP COLUMN IF EXISTS "outcome"`);
    await q.query(`ALTER TABLE "project_status_definitions" DROP COLUMN IF EXISTS "kind"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_crm_projects_tenant_kind"`);
    await q.query(`ALTER TABLE "crm_projects" DROP COLUMN IF EXISTS "kind"`);
  }
}
