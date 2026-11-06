import { MigrationInterface, QueryRunner } from 'typeorm';

/** «Кто может просматривать этот столбец» для таблиц Лидов и Проектов. */
export class TableColumnRestrictions1796700000000 implements MigrationInterface {
  name = 'TableColumnRestrictions1796700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "table_column_restrictions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "tableKey" varchar(32) NOT NULL,
        "columnId" varchar(160) NOT NULL,
        "viewerStaffIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "updatedByUserId" uuid NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_table_column_restrictions_col" ON "table_column_restrictions" ("tenantId", "tableKey", "columnId")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "table_column_restrictions"`);
  }
}
