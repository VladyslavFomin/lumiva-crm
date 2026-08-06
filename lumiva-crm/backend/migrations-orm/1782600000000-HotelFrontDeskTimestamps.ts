import { MigrationInterface, QueryRunner } from 'typeorm';

/** status already had 'checked_in'/'checked_out' values but no timestamp of when that
 * happened — needed for a real front-desk "Сегодня" board. */
export class HotelFrontDeskTimestamps1782600000000 implements MigrationInterface {
  name = 'HotelFrontDeskTimestamps1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        ADD COLUMN IF NOT EXISTS "checkedInAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "checkedOutAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        DROP COLUMN IF EXISTS "checkedInAt",
        DROP COLUMN IF EXISTS "checkedOutAt"
    `);
  }
}
