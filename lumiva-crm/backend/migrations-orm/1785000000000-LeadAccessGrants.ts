import { MigrationInterface, QueryRunner } from 'typeorm';

/** Row-level lead access grants — lets a full-access user (owner/manager/department head) give a
 * restricted staff member visibility into leads outside their own assignments, either tenant-wide
 * (scopeType='all') or scoped to one lead `source` value (scopeType='source'), with one of four
 * tiers (viewer/analyst/editor/owner) controlling what they can do with leads reached this way. */
export class LeadAccessGrants1785000000000 implements MigrationInterface {
  name = 'LeadAccessGrants1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lead_access_grants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "staffUserId" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
        "scopeType" varchar(16) NOT NULL,
        "scopeValue" varchar(64),
        "tier" varchar(16) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lead_access_grant_scope" UNIQUE ("tenantId", "staffUserId", "scopeType", "scopeValue")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lead_access_grants_tenant_staff"
      ON "lead_access_grants" ("tenantId", "staffUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lead_access_grants"`);
  }
}
