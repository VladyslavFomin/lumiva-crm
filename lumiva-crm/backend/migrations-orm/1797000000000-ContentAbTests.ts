import { MigrationInterface, QueryRunner } from 'typeorm';

/** A/B-тексты в движке контента: пара постов A и B с общим ab_group (md/content_engine_plan.md). */
export class ContentAbTests1797000000000 implements MigrationInterface {
  name = 'ContentAbTests1797000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "content_posts" ADD COLUMN IF NOT EXISTS "ab_group" uuid`);
    await q.query(`ALTER TABLE "content_posts" ADD COLUMN IF NOT EXISTS "ab_label" varchar(2)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_content_posts_ab" ON "content_posts" ("tenant_id", "ab_group") WHERE "ab_group" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_content_posts_ab"`);
    await q.query(`ALTER TABLE "content_posts" DROP COLUMN IF EXISTS "ab_label"`);
    await q.query(`ALTER TABLE "content_posts" DROP COLUMN IF EXISTS "ab_group"`);
  }
}
