import { MigrationInterface, QueryRunner } from 'typeorm';

/** Язык публичной страницы ссылки по умолчанию (null — по браузеру посетителя). */
export class MediaLinkLang1793500000000 implements MigrationInterface {
  name = 'MediaLinkLang1793500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_links" ADD COLUMN IF NOT EXISTS "lang" varchar(5)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_links" DROP COLUMN IF EXISTS "lang"`);
  }
}
