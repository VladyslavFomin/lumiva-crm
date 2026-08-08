import { MigrationInterface, QueryRunner } from 'typeorm';

/** Helpdesk/ticketing — new module. Tickets are opened by a Contact (via the self-service portal)
 * or by staff on a customer's behalf; messages are a simple incoming/outgoing thread, mirroring
 * the whatsapp-crm contact+message shape rather than inventing a new conversation abstraction. */
export class Helpdesk1781700000000 implements MigrationInterface {
  name = 'Helpdesk1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "helpdesk_tickets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "contactId" uuid,
        "subject" varchar(255) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "priority" varchar(16) NOT NULL DEFAULT 'medium',
        "assignedUserId" uuid,
        "resolvedAt" timestamptz,
        "closedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_helpdesk_tickets_tenant" ON "helpdesk_tickets" ("tenantId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_helpdesk_tickets_contact" ON "helpdesk_tickets" ("tenantId", "contactId")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "helpdesk_ticket_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "ticketId" uuid NOT NULL,
        "direction" varchar(16) NOT NULL,
        "authorName" varchar(255),
        "text" text NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_helpdesk_ticket_messages_ticket" ON "helpdesk_ticket_messages" ("tenantId", "ticketId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "helpdesk_ticket_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "helpdesk_tickets"`);
  }
}
