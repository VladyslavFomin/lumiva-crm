import { MigrationInterface, QueryRunner } from 'typeorm';

/** Settings tab additions: an editable list of quick external links (Google/TripAdvisor/etc.)
 * and a secret token for the public read-only rooms/prices feed (JSON+XML). */
export class HotelQuickLinksAndFeed1780500000000 implements MigrationInterface {
  name = 'HotelQuickLinksAndFeed1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
        ADD COLUMN IF NOT EXISTS "quickLinks" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "feedToken" varchar(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
        DROP COLUMN IF EXISTS "feedToken",
        DROP COLUMN IF EXISTS "quickLinks"
    `);
  }
}
