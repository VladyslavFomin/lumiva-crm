import { MigrationInterface, QueryRunner } from 'typeorm';

/** Short human-readable code (e.g. "RES-A1B2C3D4") for the public test-storefront's "look up my
 * reservation by code + email" flow — HotelReservation only had a UUID `id` before this.
 * Nullable: only reservations created through the public storefront get one. */
export class HotelReservationBookingCode1783000000000 implements MigrationInterface {
  name = 'HotelReservationBookingCode1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "bookingCode" varchar(32)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_reservations_booking_code"
      ON "hotel_reservations" ("bookingCode") WHERE "bookingCode" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hotel_reservations_booking_code"`);
    await queryRunner.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "bookingCode"`);
  }
}
