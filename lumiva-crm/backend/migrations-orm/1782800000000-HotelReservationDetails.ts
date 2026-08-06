import { MigrationInterface, QueryRunner } from 'typeorm';

/** Occupancy-type link (drives price auto-fill), early check-in / late check-out flags, and a
 * free-text notes field on hotel reservations. */
export class HotelReservationDetails1782800000000 implements MigrationInterface {
  name = 'HotelReservationDetails1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        ADD COLUMN IF NOT EXISTS "occupancyTypeId" uuid REFERENCES "hotel_room_occupancy_types"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "earlyCheckIn" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "lateCheckOut" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "notes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        DROP COLUMN IF EXISTS "occupancyTypeId",
        DROP COLUMN IF EXISTS "earlyCheckIn",
        DROP COLUMN IF EXISTS "lateCheckOut",
        DROP COLUMN IF EXISTS "notes"
    `);
  }
}
