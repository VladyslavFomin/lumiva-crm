import { MigrationInterface, QueryRunner } from 'typeorm';

/** New-tenant onboarding: a persisted (not localStorage-only) completion flag on Tenant, plus a
 * tracking table for sample data created by the setup wizard so it can be bulk-removed later
 * without adding an isSample column to every seedable entity (Lead/Company/Contact/Product/Sale). */
export class Onboarding1781500000000 implements MigrationInterface {
  name = 'Onboarding1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "sampleDataSeededAt" timestamptz
    `);
    // Existing tenants predate the wizard — treat them as already onboarded (using their own
    // creation date) so only genuinely new signups after this migration see it.
    await queryRunner.query(`
      UPDATE "tenants" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "onboarding_sample_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "entityType" varchar(32) NOT NULL,
        "entityId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_onboarding_sample_records_tenant"
        ON "onboarding_sample_records" ("tenantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_onboarding_sample_records_tenant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "onboarding_sample_records"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "sampleDataSeededAt"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "onboardingCompletedAt"`);
  }
}
