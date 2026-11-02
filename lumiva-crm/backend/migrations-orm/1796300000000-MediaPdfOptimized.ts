import { MigrationInterface, QueryRunner } from 'typeorm';

/** Отметка «PDF перепакован для просмотра в браузере» (null — ещё не обработан, false — оставлен как есть). */
export class MediaPdfOptimized1796300000000 implements MigrationInterface {
  name = 'MediaPdfOptimized1796300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "pdfOptimized" boolean`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "media_files" DROP COLUMN IF EXISTS "pdfOptimized"`);
  }
}
