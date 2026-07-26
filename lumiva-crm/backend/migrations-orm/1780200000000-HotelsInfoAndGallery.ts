import { MigrationInterface, QueryRunner } from 'typeorm';

/** Factsheet-style flexible info fields on Hotel (mirrors HotelRoomType.infoFields), a cover
 * photo per hotel and per room type, and a per-hotel photo gallery organized into user-defined
 * categories. */
export class HotelsInfoAndGallery1780200000000 implements MigrationInterface {
  name = 'HotelsInfoAndGallery1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
        ADD COLUMN IF NOT EXISTS "infoFields" jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "coverPhotoUrl" varchar(512)
    `);

    await queryRunner.query(`
      ALTER TABLE "hotel_room_types"
        ADD COLUMN IF NOT EXISTS "coverPhotoUrl" varchar(512)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_gallery_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_gallery_categories_tenant_hotel"
        ON "hotel_gallery_categories" ("tenantId", "hotelId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_photos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "categoryId" uuid REFERENCES "hotel_gallery_categories"("id") ON DELETE SET NULL,
        "url" varchar(512) NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_photos_tenant_hotel"
        ON "hotel_photos" ("tenantId", "hotelId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_photos_category"
        ON "hotel_photos" ("categoryId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_photos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_gallery_categories"`);
    await queryRunner.query(`
      ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "coverPhotoUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "hotels"
        DROP COLUMN IF EXISTS "coverPhotoUrl",
        DROP COLUMN IF EXISTS "infoFields"
    `);
  }
}
