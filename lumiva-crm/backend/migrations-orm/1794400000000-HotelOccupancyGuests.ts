import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Размещение по составу гостей: у варианта размещения — число взрослых и детей (подбор по взрослым + детям брони),
 * у отеля — возраст, до которого гость считается ребёнком, у брони — возрасты детей.
 * Взрослые/дети существующих размещений заполняются по названию: SGL → 1, DBL / 2 AD → 2, TRPL → 3, «+ 1 CHD» → 1 ребёнок.
 */
export class HotelOccupancyGuests1794400000000 implements MigrationInterface {
  name = 'HotelOccupancyGuests1794400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "childMaxAge" smallint NOT NULL DEFAULT 12`);
    await q.query(`ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "childAges" jsonb NOT NULL DEFAULT '[]'`);
    await q.query(`ALTER TABLE "hotel_room_occupancy_types"
      ADD COLUMN IF NOT EXISTS "adults" smallint,
      ADD COLUMN IF NOT EXISTS "children" smallint NOT NULL DEFAULT 0`);
    await q.query(`UPDATE "hotel_room_occupancy_types" SET "adults" = CASE
        WHEN "label" ~* '(\\d+)\\s*(AD|ADL|ADT|ADULT|ВЗР|YET|YTŞ)' THEN substring("label" from '(?i)(\\d+)\\s*(?:AD|ADL|ADT|ADULT|ВЗР|YET|YTŞ)')::smallint
        WHEN "label" ~* '(SGL|SNG|SINGLE|TEK)' THEN 1
        WHEN "label" ~* '(DBL|DOUBLE|TWN|TWIN|ÇİFT)' THEN 2
        WHEN "label" ~* '(TRP|TRIPLE)' THEN 3
        WHEN "label" ~* '(QUAD|QDR)' THEN 4
        ELSE NULL END
      WHERE "adults" IS NULL`);
    await q.query(`UPDATE "hotel_room_occupancy_types" SET "children" = COALESCE(substring("label" from '(?i)(\\d+)\\s*(?:CHD|CH|CHILD|РЕБ|ДЕТ|ÇCK|ÇOC)')::smallint, 0)
      WHERE "children" = 0`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_room_occupancy_types" DROP COLUMN IF EXISTS "adults", DROP COLUMN IF EXISTS "children"`);
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "childAges"`);
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "childMaxAge"`);
  }
}
