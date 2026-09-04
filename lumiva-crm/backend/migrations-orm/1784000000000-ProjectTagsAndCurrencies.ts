import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tenant-configurable tag and currency dictionaries for Projects, replacing the previously
 * hardcoded tag chips (CRM/IT/WEB/SEO/SMM/ADS) and free-text currency field. Both tables are
 * lazily seeded per-tenant on first read (ProjectTagsService/ProjectCurrenciesService
 * .ensureSeeded), same idiom as ProjectStatusDefinitions — this migration only creates the
 * tables, no backfill needed since existing Project.tags/currency values are plain strings
 * unaffected by the dictionary (not a validated enum). */
export class ProjectTagsAndCurrencies1784000000000 implements MigrationInterface {
  name = 'ProjectTagsAndCurrencies1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_tag_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "value" varchar(64) NOT NULL,
        "color" varchar(16) NOT NULL DEFAULT '#777777',
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_project_tag_tenant_value" UNIQUE ("tenantId", "value")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_currency_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "code" varchar(8) NOT NULL,
        "label" varchar(64),
        "isDefault" boolean NOT NULL DEFAULT false,
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_project_currency_tenant_code" UNIQUE ("tenantId", "code")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_currency_definitions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_tag_definitions"`);
  }
}
