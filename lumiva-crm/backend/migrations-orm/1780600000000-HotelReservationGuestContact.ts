import { MigrationInterface, QueryRunner } from 'typeorm';

/** Guest email/phone snapshot on the reservation row (same raw-snapshot pattern as Booking's
 * Reservation.customerEmail/customerPhone) — unblocks "email the guest" automations for hotel
 * reservations, which previously had no contact field at all. */
export class HotelReservationGuestContact1780600000000 implements MigrationInterface {
  name = 'HotelReservationGuestContact1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        ADD COLUMN IF NOT EXISTS "guestEmail" varchar(255),
        ADD COLUMN IF NOT EXISTS "guestPhone" varchar(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        DROP COLUMN IF EXISTS "guestPhone",
        DROP COLUMN IF EXISTS "guestEmail"
    `);
  }
}
