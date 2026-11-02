import { MigrationInterface, QueryRunner } from 'typeorm';

/** Заголовок формы скачивания на каждом языке (ru/en/tr); тексты полей — в formFields[].l10n. */
export class MediaFormTitles1793600000000 implements MigrationInterface {
  name = 'MediaFormTitles1793600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_settings" ADD COLUMN IF NOT EXISTS "formTitles" jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_settings" DROP COLUMN IF EXISTS "formTitles"`);
  }
}
