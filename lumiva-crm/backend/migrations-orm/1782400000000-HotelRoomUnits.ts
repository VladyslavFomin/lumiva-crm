import { MigrationInterface, QueryRunner } from 'typeorm';

/** Individual physical rooms ("204") inside a room type, for real front-desk/housekeeping
 * status tracking — HotelRoomType.quantity was only ever a count, no identity. Deliberately
 * NOT backfilled from quantity: room labels aren't knowable automatically, so every existing
 * room type simply has zero units until an owner manually adds them. Availability checks
 * (see a later migration) fall back to quantity when a room type has no units defined yet. */
export class HotelRoomUnits1782400000000 implements MigrationInterface {
  name = 'HotelRoomUnits1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_units" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "roomTypeId" uuid NOT NULL REFERENCES "hotel_room_types"("id") ON DELETE CASCADE,
        "label" varchar(64) NOT NULL,
        "housekeepingStatus" varchar(16) NOT NULL DEFAULT 'clean',
        "note" text,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_room_units_tenant_hotel"
        ON "hotel_room_units" ("tenantId", "hotelId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_room_units_hotel_label"
        ON "hotel_room_units" ("hotelId", "label")
    `);

    await queryRunner.query(`
      ALTER TABLE "hotel_reservations"
        ADD COLUMN IF NOT EXISTS "roomUnitId" uuid REFERENCES "hotel_room_units"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "roomUnitId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_units"`);
  }
}
