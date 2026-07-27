import { MigrationInterface, QueryRunner } from 'typeorm';

/** Lets a gallery photo belong to a specific room type instead of the hotel's general gallery —
 * null roomTypeId (existing rows, unchanged) means "general hotel gallery". */
export class HotelPhotosRoomTypeScope1780400000000 implements MigrationInterface {
  name = 'HotelPhotosRoomTypeScope1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel_photos"
        ADD COLUMN IF NOT EXISTS "roomTypeId" uuid REFERENCES "hotel_room_types"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_photos_room_type"
        ON "hotel_photos" ("roomTypeId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotel_photos" DROP COLUMN IF EXISTS "roomTypeId"`);
  }
}
