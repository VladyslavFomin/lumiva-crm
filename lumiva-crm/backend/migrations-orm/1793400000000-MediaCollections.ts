import { MigrationInterface, QueryRunner } from 'typeorm';

/** «Медиа»: свои разделы (бренд, архив агентства…) рядом с отелями. Папка верхнего уровня — в отеле, в разделе или нигде. */
export class MediaCollections1793400000000 implements MigrationInterface {
  name = 'MediaCollections1793400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "media_collections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" varchar(200) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_media_collections_tenant" ON "media_collections" ("tenantId")`);
    await q.query(`ALTER TABLE "media_folders" ADD COLUMN IF NOT EXISTS "collectionId" uuid REFERENCES "media_collections"("id") ON DELETE SET NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_folders" DROP COLUMN IF EXISTS "collectionId"`);
    await q.query(`DROP TABLE IF EXISTS "media_collections"`);
  }
}
