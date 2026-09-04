import { MigrationInterface, QueryRunner } from 'typeorm';

/** Consolidates esign settings into the real places they belong instead of a bespoke
 * settings card: {ORG_NAME}/{ORG_TAX}/{MANAGER} now read from the tenant's own real
 * "Настройки компании" page (`tenants.documentRequisites`/`documentManagerName`, alongside
 * the already-existing `tenants.name`) rather than a separate `esign_org_profiles` table —
 * so users fill this in once, not twice. That table is replaced by `esign_sequence_counters`,
 * which now holds only the {CONTRACT_NO} auto-numbering counter (no real data existed in
 * `esign_org_profiles` yet, confirmed before dropping it — safe to replace outright). */
export class EsignSettingsAndSequence1788000000000 implements MigrationInterface {
  name = 'EsignSettingsAndSequence1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "documentRequisites" varchar(255),
        ADD COLUMN IF NOT EXISTS "documentManagerName" varchar(255)
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "esign_org_profiles"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "esign_sequence_counters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL UNIQUE,
        "nextContractSeq" integer NOT NULL DEFAULT 401,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "esign_sequence_counters"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "esign_org_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL UNIQUE,
        "orgName" varchar(255),
        "orgTaxId" varchar(255),
        "managerName" varchar(255),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
        DROP COLUMN IF EXISTS "documentRequisites",
        DROP COLUMN IF EXISTS "documentManagerName"
    `);
  }
}
