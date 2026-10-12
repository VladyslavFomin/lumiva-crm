import { MigrationInterface, QueryRunner } from 'typeorm';

/** AI-разбор звонков: полный разбор (резюме, шаги, возражения, оценка менеджера) в jsonb +
 * звонки, загруженные вручную в карточку лида (source='upload', файл в uploads тенанта). */
export class CallAiAnalysis1791000000000 implements MigrationInterface {
  name = 'CallAiAnalysis1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "source" varchar(16) NOT NULL DEFAULT 'twilio'`);
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "recordingPath" text NULL`);
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "originalFilename" varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "aiAnalysis" jsonb NULL`);
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "analysisStatus" varchar(16) NULL`);
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "analysisError" text NULL`);
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "analyzedAt" timestamptz NULL`);
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "uploadedByStaffId" uuid NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const c of ['uploadedByStaffId', 'analyzedAt', 'analysisError', 'analysisStatus', 'aiAnalysis', 'originalFilename', 'recordingPath', 'source']) {
      await queryRunner.query(`ALTER TABLE "calls" DROP COLUMN IF EXISTS "${c}"`);
    }
  }
}
