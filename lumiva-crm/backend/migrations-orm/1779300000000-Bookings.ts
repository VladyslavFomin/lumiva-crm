import { MigrationInterface, QueryRunner } from 'typeorm';

/** New "Бронирования" (Booking/Reservations) extension — v1 slice. */
export class Bookings1779300000000 implements MigrationInterface {
  name = 'Bookings1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_projects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "businessType" varchar(32) NOT NULL DEFAULT 'salon',
        "timezone" varchar(64) NOT NULL DEFAULT 'Europe/Moscow',
        "currency" char(3) NOT NULL DEFAULT 'RUB',
        "confirmationMode" varchar(16) NOT NULL DEFAULT 'manual',
        "status" varchar(32) NOT NULL DEFAULT 'not_configured',
        "minNoticeMinutes" integer NOT NULL DEFAULT 120,
        "maxAdvanceDays" integer NOT NULL DEFAULT 60,
        "slotIntervalMinutes" integer NOT NULL DEFAULT 15,
        "bufferMinutes" integer NOT NULL DEFAULT 10,
        "cancellationDeadlineHours" integer NOT NULL DEFAULT 4,
        "rescheduleDeadlineHours" integer NOT NULL DEFAULT 2,
        "overbookingAllowed" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_projects_tenant" ON "booking_projects" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_locations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL REFERENCES "booking_projects"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "address" text,
        "timezone" varchar(64),
        "phone" varchar(64),
        "email" varchar(255),
        "workingHours" jsonb,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_locations_tenant_project"
        ON "booking_locations" ("tenantId", "projectId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_services" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL REFERENCES "booking_projects"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "category" varchar(160),
        "color" varchar(16),
        "durationMinutes" integer NOT NULL DEFAULT 60,
        "price" numeric(14,2) NOT NULL DEFAULT 0,
        "currency" char(3) NOT NULL DEFAULT 'RUB',
        "capacityMin" integer NOT NULL DEFAULT 1,
        "capacityMax" integer NOT NULL DEFAULT 1,
        "locationIds" uuid[] NOT NULL DEFAULT '{}',
        "staffUserIds" uuid[] NOT NULL DEFAULT '{}',
        "resourceTypeRequired" varchar(60),
        "bufferBeforeMinutes" integer NOT NULL DEFAULT 0,
        "bufferAfterMinutes" integer NOT NULL DEFAULT 0,
        "minNoticeMinutes" integer,
        "autoConfirm" boolean NOT NULL DEFAULT true,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_services_tenant_project"
        ON "booking_services" ("tenantId", "projectId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_services_tenant_active"
        ON "booking_services" ("tenantId", "active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_resources" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL REFERENCES "booking_projects"("id") ON DELETE CASCADE,
        "locationId" uuid NOT NULL REFERENCES "booking_locations"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "type" varchar(60) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "capacity" integer,
        "assignedServiceIds" uuid[] NOT NULL DEFAULT '{}',
        "weeklyAvailability" jsonb,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_resources_tenant_project"
        ON "booking_resources" ("tenantId", "projectId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_resources_tenant_location"
        ON "booking_resources" ("tenantId", "locationId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_staff_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "staffUserId" uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
        "availableForBooking" boolean NOT NULL DEFAULT true,
        "assignedLocationIds" uuid[] NOT NULL DEFAULT '{}',
        "assignedServiceIds" uuid[] NOT NULL DEFAULT '{}',
        "weeklyAvailability" jsonb,
        "timeOff" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "maxSimultaneousBookings" integer NOT NULL DEFAULT 1,
        "calendarColor" varchar(16),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_booking_staff_profiles_tenant_staff"
        ON "booking_staff_profiles" ("tenantId", "staffUserId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL REFERENCES "booking_projects"("id") ON DELETE CASCADE,
        "locationId" uuid NOT NULL REFERENCES "booking_locations"("id") ON DELETE CASCADE,
        "serviceId" uuid REFERENCES "booking_services"("id") ON DELETE SET NULL,
        "staffUserId" uuid REFERENCES "staff_users"("id") ON DELETE SET NULL,
        "resourceId" uuid REFERENCES "booking_resources"("id") ON DELETE SET NULL,
        "leadId" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
        "contactId" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
        "customerName" varchar(255),
        "customerPhone" varchar(64),
        "customerEmail" varchar(255),
        "startAt" timestamptz NOT NULL,
        "endAt" timestamptz NOT NULL,
        "participants" integer NOT NULL DEFAULT 1,
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "confirmationStatus" varchar(16) NOT NULL DEFAULT 'not_required',
        "paymentStatus" varchar(24) NOT NULL DEFAULT 'not_required',
        "price" numeric(14,2),
        "currency" char(3),
        "source" varchar(16) NOT NULL DEFAULT 'manual',
        "assignedUserId" uuid REFERENCES "staff_users"("id") ON DELETE SET NULL,
        "customFields" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservations_tenant_project"
        ON "reservations" ("tenantId", "projectId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservations_tenant_startAt"
        ON "reservations" ("tenantId", "startAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservations_tenant_lead"
        ON "reservations" ("tenantId", "leadId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservations_tenant_contact"
        ON "reservations" ("tenantId", "contactId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservations_tenant_staff_start"
        ON "reservations" ("tenantId", "staffUserId", "startAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservations_tenant_resource_start"
        ON "reservations" ("tenantId", "resourceId", "startAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservation_activity" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "reservationId" uuid NOT NULL REFERENCES "reservations"("id") ON DELETE CASCADE,
        "userId" uuid REFERENCES "staff_users"("id") ON DELETE SET NULL,
        "type" varchar(32) NOT NULL,
        "description" text,
        "fromValue" text,
        "toValue" text,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservation_activity_reservation"
        ON "reservation_activity" ("reservationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reservation_activity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_staff_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_resources"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_services"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_locations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_projects"`);
  }
}
