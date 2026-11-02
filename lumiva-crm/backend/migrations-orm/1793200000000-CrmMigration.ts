import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Мастер переезда из amoCRM / Битрикс24 / Excel: история запусков и соответствие
 * внешних ID → наши записи (повторный запуск обновляет, а не дублирует).
 */
export class CrmMigration1793200000000 implements MigrationInterface {
  name = 'CrmMigration1793200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "crm_migration_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "source" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'running',
        "stage" varchar(32),
        "options" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "counters" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "warnings" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "error" text,
        "createdByUserId" uuid,
        "startedAt" timestamptz NOT NULL DEFAULT now(),
        "finishedAt" timestamptz
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_migration_runs_tenant" ON "crm_migration_runs" ("tenantId", "startedAt")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "crm_migration_external_ids" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "source" varchar(16) NOT NULL,
        "entityType" varchar(16) NOT NULL,
        "externalId" varchar(128) NOT NULL,
        "localId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_crm_migration_external" ON "crm_migration_external_ids" ("tenantId", "source", "entityType", "externalId")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "crm_migration_external_ids"`);
    await q.query(`DROP TABLE IF EXISTS "crm_migration_runs"`);
  }
}
