import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds manual per-period price overrides to occupancy rows (real hotel price sheets almost
 * always have point overrides on top of the coefficient formula) + the import session table
 * for the "Цены с размещением" sheet. */
export class HotelsOccupancyOverridesAndRoomPricingImport1779900000000
  implements MigrationInterface
{
  name = 'HotelsOccupancyOverridesAndRoomPricingImport1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_room_occupancy_types"
        ADD COLUMN IF NOT EXISTS "periodOverrides" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "hotel_pricing_import_sessions"
        ADD COLUMN IF NOT EXISTS "groupNames" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_pricing_import_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "originalFileName" varchar(255),
        "periods" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "occupancyRows" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" varchar(30) NOT NULL DEFAULT 'preview',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_pricing_import_sessions"`);
    await queryRunner.query(`
      ALTER TABLE "hotel_pricing_import_sessions" DROP COLUMN IF EXISTS "groupNames"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotel_room_occupancy_types" DROP COLUMN IF EXISTS "periodOverrides"
    `);
  }
}
