import { MigrationInterface, QueryRunner } from 'typeorm';

/** "Бронирования" — Waitlist + Notification Templates (v1 follow-up, see plan file). */
export class BookingsWaitlistAndTemplates1779400000000 implements MigrationInterface {
  name = 'BookingsWaitlistAndTemplates1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_waitlist_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL REFERENCES "booking_projects"("id") ON DELETE CASCADE,
        "locationId" uuid REFERENCES "booking_locations"("id") ON DELETE SET NULL,
        "serviceId" uuid REFERENCES "booking_services"("id") ON DELETE SET NULL,
        "preferredStaffUserId" uuid REFERENCES "staff_users"("id") ON DELETE SET NULL,
        "leadId" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
        "contactId" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
        "customerName" varchar(255),
        "customerPhone" varchar(64),
        "customerEmail" varchar(255),
        "preferredWindow" text,
        "participants" integer NOT NULL DEFAULT 1,
        "priority" varchar(16) NOT NULL DEFAULT 'normal',
        "status" varchar(16) NOT NULL DEFAULT 'waiting',
        "offeredStartAt" timestamptz,
        "offeredEndAt" timestamptz,
        "convertedReservationId" uuid REFERENCES "reservations"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_waitlist_tenant_project"
        ON "booking_waitlist_entries" ("tenantId", "projectId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_waitlist_tenant_status"
        ON "booking_waitlist_entries" ("tenantId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_notification_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL REFERENCES "booking_projects"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "event" varchar(32) NOT NULL,
        "channel" varchar(16) NOT NULL,
        "subject" varchar(255),
        "body" text NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_notification_templates_tenant_project"
        ON "booking_notification_templates" ("tenantId", "projectId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_notification_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_waitlist_entries"`);
  }
}
