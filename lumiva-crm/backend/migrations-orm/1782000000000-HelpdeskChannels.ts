import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds channel/category/CRM-entity-link to helpdesk tickets — supports the redesigned
 * "Хэлпдеск" (channel-aware replies: staff replies now dispatch through the ticket's real
 * channel — email/Telegram/WhatsApp/SMS — instead of only ever writing an in-app portal message). */
export class HelpdeskChannels1782000000000 implements MigrationInterface {
  name = 'HelpdeskChannels1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "helpdesk_tickets"
        ADD COLUMN IF NOT EXISTS "channel" varchar(16) NOT NULL DEFAULT 'portal',
        ADD COLUMN IF NOT EXISTS "category" varchar(64),
        ADD COLUMN IF NOT EXISTS "entityType" varchar(20),
        ADD COLUMN IF NOT EXISTS "entityId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_helpdesk_tickets_entity" ON "helpdesk_tickets" ("tenantId", "entityType", "entityId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_helpdesk_tickets_entity"`);
    await queryRunner.query(`
      ALTER TABLE "helpdesk_tickets"
        DROP COLUMN IF EXISTS "channel",
        DROP COLUMN IF EXISTS "category",
        DROP COLUMN IF EXISTS "entityType",
        DROP COLUMN IF EXISTS "entityId"
    `);
  }
}
