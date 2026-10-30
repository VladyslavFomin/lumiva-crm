import { MigrationInterface, QueryRunner } from 'typeorm';

/** Заявки гостей (Guest Care): из QR-кода в номере и сообщений WhatsApp проживающих → уборка / техники. */
export class HotelGuestCare1794700000000 implements MigrationInterface {
  name = 'HotelGuestCare1794700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_room_units" ADD COLUMN IF NOT EXISTS "guestToken" varchar(40)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_hotel_room_units_guest_token" ON "hotel_room_units" ("guestToken") WHERE "guestToken" IS NOT NULL`);
    await q.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "guestCareWhatsapp" boolean NOT NULL DEFAULT false`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_guest_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "roomUnitId" uuid REFERENCES "hotel_room_units"("id") ON DELETE SET NULL,
      "reservationId" uuid REFERENCES "hotel_reservations"("id") ON DELETE SET NULL,
      "number" integer NOT NULL,
      "source" varchar(16) NOT NULL,
      "category" varchar(24) NOT NULL,
      "subcategory" varchar(24),
      "text" text,
      "guestName" varchar(255),
      "guestPhone" varchar(64),
      "lang" varchar(4),
      "status" varchar(16) NOT NULL DEFAULT 'new',
      "assigneeUserId" uuid,
      "maintenanceIssueId" uuid,
      "staffNote" text,
      "startedAt" timestamptz,
      "doneAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_hotel_guest_requests" ON "hotel_guest_requests" ("tenantId", "hotelId", "status", "createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "hotel_guest_requests"`);
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "guestCareWhatsapp"`);
    await q.query(`DROP INDEX IF EXISTS "uq_hotel_room_units_guest_token"`);
    await q.query(`ALTER TABLE "hotel_room_units" DROP COLUMN IF EXISTS "guestToken"`);
  }
}
