import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailAccountUserId1778100000000 implements MigrationInterface {
  name = 'EmailAccountUserId1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_accounts"
      ADD COLUMN IF NOT EXISTS "userId" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_accounts_tenant_user"
      ON "email_accounts" ("tenantId", "userId")
    `);
    // Backfill: copy createdByUserId from meta into the new userId column
    await queryRunner.query(`
      UPDATE "email_accounts"
      SET "userId" = (meta->>'createdByUserId')::uuid
      WHERE meta->>'createdByUserId' IS NOT NULL
        AND "userId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_accounts_tenant_user"`);
    await queryRunner.query(`ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "userId"`);
  }
}
