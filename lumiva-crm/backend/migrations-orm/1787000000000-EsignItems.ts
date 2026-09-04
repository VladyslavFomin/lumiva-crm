import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds {PRODUCT_*}/{BOOKING_SERVICE_*} keys — documents can now carry real Products and
 * "Бронирования" services (snapshotted name/price/master) picked in the issue wizard. */
export class EsignItems1787000000000 implements MigrationInterface {
  name = 'EsignItems1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "esign_documents"
        ADD COLUMN IF NOT EXISTS "items" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "esign_documents" DROP COLUMN IF EXISTS "items"`);
  }
}
