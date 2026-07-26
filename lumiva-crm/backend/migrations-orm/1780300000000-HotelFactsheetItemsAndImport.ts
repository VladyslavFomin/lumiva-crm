import { MigrationInterface, QueryRunner } from 'typeorm';

/** Structured repeating factsheet blocks (restaurants/bars/pools/mini-club/services) — one
 * generic table with a `kind` discriminator rather than 5 near-identical tables, since every
 * block shares the same name/description/hours/sortOrder shape (kind-specific rarities like pool
 * area or mini-club age range live in `extra` jsonb, same "don't hardcode hotel-business-specific
 * fields into the schema" philosophy as Hotel.infoFields). Plus an import session table for the
 * "Информация об отеле" Excel round-trip (key-value sheet + one sheet per block kind). */
export class HotelFactsheetItemsAndImport1780300000000 implements MigrationInterface {
  name = 'HotelFactsheetItemsAndImport1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_factsheet_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "kind" varchar(16) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "hours" varchar(255),
        "paid" boolean,
        "extra" jsonb NOT NULL DEFAULT '{}',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_factsheet_items_tenant_hotel"
        ON "hotel_factsheet_items" ("tenantId", "hotelId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_factsheet_items_hotel_kind"
        ON "hotel_factsheet_items" ("hotelId", "kind")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_info_import_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "originalFileName" varchar(255),
        "infoFields" jsonb NOT NULL DEFAULT '{}',
        "items" jsonb NOT NULL DEFAULT '[]',
        "unmatchedLabels" jsonb NOT NULL DEFAULT '[]',
        "status" varchar(16) NOT NULL DEFAULT 'preview',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_info_import_sessions_tenant"
        ON "hotel_info_import_sessions" ("tenantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_info_import_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_factsheet_items"`);
  }
}
