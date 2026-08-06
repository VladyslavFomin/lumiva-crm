import { MigrationInterface, QueryRunner } from 'typeorm';

/** Simple payment ledger per reservation — paidStatus already existed but had no monetary
 * tracking and no UI control to edit it at all. */
export class HotelReservationBilling1782700000000 implements MigrationInterface {
  name = 'HotelReservationBilling1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        ADD COLUMN IF NOT EXISTS "depositAmount" numeric(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "payments" jsonb NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        DROP COLUMN IF EXISTS "depositAmount",
        DROP COLUMN IF EXISTS "payments"
    `);
  }
}
