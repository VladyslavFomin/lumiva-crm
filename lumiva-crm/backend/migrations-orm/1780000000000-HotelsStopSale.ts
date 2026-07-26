import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stop-sale controls: a full stop on a room type (independent of dates) + per-date stops for
 * the wholesale "Цены и рынки" grid (independent of the retail calendar's own blocked flag). */
export class HotelsStopSale1780000000000 implements MigrationInterface {
  name = 'HotelsStopSale1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_room_types"
        ADD COLUMN IF NOT EXISTS "stopSale" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_stop_sale_dates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "roomTypeId" uuid NOT NULL REFERENCES "hotel_room_types"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_room_stop_sale_dates_tenant_room"
        ON "hotel_room_stop_sale_dates" ("tenantId", "roomTypeId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_room_stop_sale_dates_room_date"
        ON "hotel_room_stop_sale_dates" ("roomTypeId", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_stop_sale_dates"`);
    await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "stopSale"`);
  }
}
