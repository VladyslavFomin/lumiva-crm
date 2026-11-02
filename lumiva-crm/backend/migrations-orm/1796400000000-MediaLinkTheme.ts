import { MigrationInterface, QueryRunner } from 'typeorm';

/** Тема публичной страницы медиакита: dark (как было) | light. */
export class MediaLinkTheme1796400000000 implements MigrationInterface {
  name = 'MediaLinkTheme1796400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_links" ADD COLUMN IF NOT EXISTS "theme" varchar(8) NOT NULL DEFAULT 'dark'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_links" DROP COLUMN IF EXISTS "theme"`);
  }
}
