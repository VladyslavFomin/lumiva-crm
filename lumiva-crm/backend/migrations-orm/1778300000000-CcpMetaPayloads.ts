import { MigrationInterface, QueryRunner } from 'typeorm';

export class CcpMetaPayloads1778300000000 implements MigrationInterface {
  name = 'CcpMetaPayloads1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ccp_clients"
      ADD COLUMN IF NOT EXISTS "meta" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ccp_txns"
      ADD COLUMN IF NOT EXISTS "meta" jsonb NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ccp_transfers"
      ADD COLUMN IF NOT EXISTS "meta" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ccp_transfers" DROP COLUMN IF EXISTS "meta"`);
    await queryRunner.query(`ALTER TABLE "ccp_txns" DROP COLUMN IF EXISTS "meta"`);
    await queryRunner.query(`ALTER TABLE "ccp_clients" DROP COLUMN IF EXISTS "meta"`);
  }
}
