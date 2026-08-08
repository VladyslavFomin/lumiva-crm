import { MigrationInterface, QueryRunner } from 'typeorm';

/** WhatsApp had a webhook receiver that only wrote inbound messages as Lead notes — no persisted
 * conversation/message rows, so there was no way to build a CRM inbox UI or reply from one thread.
 * Mirrors the shape of telegram_contacts/telegram_messages. */
export class WhatsappCrmInbox1780900000000 implements MigrationInterface {
  name = 'WhatsappCrmInbox1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "connectionId" uuid,
        "waPhoneDigits" varchar(32) NOT NULL,
        "waProfileName" varchar(255),
        "contactId" uuid,
        "companyId" uuid,
        "leadId" uuid,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "meta" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_contacts_tenant_phone"
        ON "whatsapp_contacts" ("tenantId", "waPhoneDigits")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_contacts_tenant_connection"
        ON "whatsapp_contacts" ("tenantId", "connectionId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "contactId" uuid NOT NULL,
        "connectionId" uuid,
        "waMessageId" varchar(128),
        "direction" varchar(20) NOT NULL,
        "text" text,
        "messageType" varchar(50),
        "attachments" jsonb,
        "linkedContactId" uuid,
        "linkedCompanyId" uuid,
        "linkedLeadId" uuid,
        "linkedSaleId" uuid,
        "date" timestamptz NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "rawData" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_messages_tenant_contact_date"
        ON "whatsapp_messages" ("tenantId", "contactId", "date")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_messages_tenant_wamessageid"
        ON "whatsapp_messages" ("tenantId", "waMessageId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_contacts"`);
  }
}
