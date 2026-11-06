import { MigrationInterface, QueryRunner } from 'typeorm';

/** Автодобавление новых папок в медиа-ссылку; у существующих ссылок включено с момента создания. */
export class MediaLinkAutoFolders1796600000000 implements MigrationInterface {
  name = 'MediaLinkAutoFolders1796600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_links" ADD COLUMN IF NOT EXISTS "autoSince" timestamptz`);
    await q.query(`UPDATE "media_links" SET "autoSince" = "createdAt" WHERE "autoSince" IS NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_links" DROP COLUMN IF EXISTS "autoSince"`);
  }
}
