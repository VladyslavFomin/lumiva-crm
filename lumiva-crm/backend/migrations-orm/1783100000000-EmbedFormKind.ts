import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds EmbedForm.kind ('lead'|'product_order'|'booking'|'hotel_reservation') — default 'lead'
 * keeps every existing form's behavior byte-for-byte unchanged (submit() still always creates a
 * Lead for kind='lead'). */
export class EmbedFormKind1783100000000 implements MigrationInterface {
  name = 'EmbedFormKind1783100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "embed_forms" ADD COLUMN IF NOT EXISTS "kind" varchar(24) NOT NULL DEFAULT 'lead'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "embed_forms" DROP COLUMN IF EXISTS "kind"`);
  }
}
