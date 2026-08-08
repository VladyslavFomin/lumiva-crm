import { MigrationInterface, QueryRunner } from 'typeorm';

/** Real AI sentiment/topic classification for call transcripts — previously the "SMS и телефония"
 * redesign shipped without this because it wasn't backed by anything real; the user asked for it
 * to be built for real. Runs on top of the transcript Whisper already produces (same
 * AiOpenAiService, same insufficient_quota outage caveat as transcription itself). */
export class CallSentiment1781300000000 implements MigrationInterface {
  name = 'CallSentiment1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "calls"
        ADD COLUMN IF NOT EXISTS "sentiment" varchar(16),
        ADD COLUMN IF NOT EXISTS "sentimentTopic" varchar(32),
        ADD COLUMN IF NOT EXISTS "sentimentStatus" varchar(16)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "calls"
        DROP COLUMN IF EXISTS "sentimentStatus",
        DROP COLUMN IF EXISTS "sentimentTopic",
        DROP COLUMN IF EXISTS "sentiment"
    `);
  }
}
