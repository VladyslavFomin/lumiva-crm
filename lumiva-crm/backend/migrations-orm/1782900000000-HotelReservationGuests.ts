import { MigrationInterface, QueryRunner } from 'typeorm';

/** Full guest manifest per reservation (name/passport/age per guest) — separate from the
 * existing guestName/guestEmail/guestPhone "booking contact" fields. */
export class HotelReservationGuests1782900000000 implements MigrationInterface {
  name = 'HotelReservationGuests1782900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "guests" jsonb NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "guests"`);
  }
}
