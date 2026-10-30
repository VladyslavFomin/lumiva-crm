import { MigrationInterface, QueryRunner } from 'typeorm';

/** PMS v2, этапы 4–5: фолио (начисления, сторно, два счёта), каталог услуг, кассовые смены, ночной аудит и бизнес-дата. */
export class HotelFolioNightAudit1794200000000 implements MigrationInterface {
  name = 'HotelFolioNightAudit1794200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_reservations"
      ADD COLUMN IF NOT EXISTS "accommodationFolio" varchar(16) NOT NULL DEFAULT 'guest',
      ADD COLUMN IF NOT EXISTS "extrasTotal" numeric(14,2) NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "earlyCheckInFeePct" numeric(6,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lateCheckOutFeePct" numeric(6,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "timezone" varchar(64) NOT NULL DEFAULT 'Europe/Istanbul',
      ADD COLUMN IF NOT EXISTS "businessDate" date,
      ADD COLUMN IF NOT EXISTS "lastAuditDate" date,
      ADD COLUMN IF NOT EXISTS "nightAuditAuto" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "nightAuditTime" varchar(5) NOT NULL DEFAULT '03:00',
      ADD COLUMN IF NOT EXISTS "nightAuditEmails" text`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_folio_lines" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "reservationId" uuid NOT NULL REFERENCES "hotel_reservations"("id") ON DELETE CASCADE,
      "folio" varchar(16) NOT NULL DEFAULT 'guest',
      "serviceDate" date NOT NULL,
      "kind" varchar(24) NOT NULL DEFAULT 'extra',
      "extraServiceId" uuid,
      "description" varchar(255) NOT NULL,
      "quantity" numeric(10,2) NOT NULL DEFAULT 1,
      "unitPrice" numeric(14,2) NOT NULL DEFAULT 0,
      "amount" numeric(14,2) NOT NULL DEFAULT 0,
      "voidOfId" uuid,
      "voided" boolean NOT NULL DEFAULT false,
      "reason" text,
      "createdBy" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_folio_res" ON "hotel_folio_lines" ("tenantId", "reservationId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_folio_day" ON "hotel_folio_lines" ("tenantId", "hotelId", "serviceDate")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_extra_services" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "name" varchar(255) NOT NULL,
      "category" varchar(16) NOT NULL DEFAULT 'other',
      "price" numeric(14,2) NOT NULL DEFAULT 0,
      "active" boolean NOT NULL DEFAULT true,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_extras_scope" ON "hotel_extra_services" ("tenantId", "hotelId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_cash_shifts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "status" varchar(8) NOT NULL DEFAULT 'open',
      "openedBy" uuid,
      "openedAt" timestamptz NOT NULL,
      "openingCash" numeric(14,2) NOT NULL DEFAULT 0,
      "closedBy" uuid,
      "closedAt" timestamptz,
      "countedCash" numeric(14,2),
      "expectedCash" numeric(14,2),
      "difference" numeric(14,2),
      "totals" jsonb,
      "note" text)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_shifts_scope" ON "hotel_cash_shifts" ("tenantId", "hotelId", "status")`);
    // одна открытая смена на отель
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_shift_open" ON "hotel_cash_shifts" ("hotelId") WHERE "status" = 'open'`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_night_audits" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "businessDate" date NOT NULL,
      "mode" varchar(8) NOT NULL DEFAULT 'manual',
      "runBy" uuid,
      "completedAt" timestamptz NOT NULL,
      "checks" jsonb NOT NULL DEFAULT '{}',
      "snapshot" jsonb NOT NULL DEFAULT '{}',
      "reportSentAt" timestamptz)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_audit_day" ON "hotel_night_audits" ("tenantId", "hotelId", "businessDate")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "hotel_night_audits"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_cash_shifts"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_extra_services"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_folio_lines"`);
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "earlyCheckInFeePct", DROP COLUMN IF EXISTS "lateCheckOutFeePct", DROP COLUMN IF EXISTS "timezone",
      DROP COLUMN IF EXISTS "businessDate", DROP COLUMN IF EXISTS "lastAuditDate", DROP COLUMN IF EXISTS "nightAuditAuto", DROP COLUMN IF EXISTS "nightAuditTime", DROP COLUMN IF EXISTS "nightAuditEmails"`);
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "accommodationFolio", DROP COLUMN IF EXISTS "extrasTotal"`);
  }
}
