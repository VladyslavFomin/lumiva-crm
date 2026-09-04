import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tenant-configurable project statuses (Kanban columns / status badges).
 * Creates project_status_definitions and seeds every existing tenant with the 7 built-in
 * statuses (isBuiltIn=true, colors matching what was previously hardcoded in the frontend),
 * so nothing changes visually for existing tenants. New/renamed non-built-in statuses are
 * added by tenants afterwards via the settings UI. */
export class ProjectStatusDefinitions1783800000000 implements MigrationInterface {
  name = 'ProjectStatusDefinitions1783800000000';

  private readonly builtIn: Array<{ value: string; color: string }> = [
    { value: 'Новый', color: '#1769d1' },
    { value: 'В работе', color: '#3b6cb6' },
    { value: 'На проверке', color: '#c08319' },
    { value: 'Заморожен', color: '#777777' },
    { value: 'Закрыт', color: '#9a9a9a' },
    { value: 'Выиграно', color: '#1f8a5e' },
    { value: 'Проиграно', color: '#cc2f47' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_status_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "value" varchar(64) NOT NULL,
        "color" varchar(16) NOT NULL DEFAULT '#777777',
        "order" integer NOT NULL DEFAULT 0,
        "isBuiltIn" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_project_status_tenant_value" UNIQUE ("tenantId", "value")
      )
    `);

    const tenants: Array<{ id: string }> = await queryRunner.query(`SELECT "id" FROM "tenants"`);
    for (const tenant of tenants) {
      for (let i = 0; i < this.builtIn.length; i++) {
        const s = this.builtIn[i];
        await queryRunner.query(
          `INSERT INTO "project_status_definitions" ("tenantId", "value", "color", "order", "isBuiltIn")
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT ("tenantId", "value") DO NOTHING`,
          [tenant.id, s.value, s.color, i],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_status_definitions"`);
  }
}
