import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tracks which bot a contact/message belongs to — needed to build a real inbox UI (reply requires
 * knowing which bot token to send through). Previously unset: a tenant with >1 bot had no way to
 * tell which bot a stored contact/message came through. Nullable — old rows stay untagged, new
 * writes populate it from `TelegramCrmService`. */
export class TelegramContactMessageBotId1780800000000 implements MigrationInterface {
  name = 'TelegramContactMessageBotId1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "telegram_contacts"
        ADD COLUMN IF NOT EXISTS "botId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "telegram_messages"
        ADD COLUMN IF NOT EXISTS "botId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_telegram_contacts_botId" ON "telegram_contacts" ("botId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_telegram_contacts_botId"
    `);
    await queryRunner.query(`
      ALTER TABLE "telegram_messages"
        DROP COLUMN IF EXISTS "botId"
    `);
    await queryRunner.query(`
      ALTER TABLE "telegram_contacts"
        DROP COLUMN IF EXISTS "botId"
    `);
  }
}
