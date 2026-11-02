import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Точки продаж отеля (ресторан, бар, SPA, мини-бар, магазин): позиции — услуги каталога кассы с точкой и отметкой
 * «входит во всё включено», чеки — на номер заселённого гостя (строки фолио) или оплата на месте; лимит кредита на номер.
 */
export class HotelPos1795700000000 implements MigrationInterface {
  name = 'HotelPos1795700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_pos_outlets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL,
      "kind" varchar(12) NOT NULL DEFAULT 'restaurant',
      "active" boolean NOT NULL DEFAULT true,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_pos_outlets" ON "hotel_pos_outlets" ("tenantId", "hotelId")`);
    await q.query(`ALTER TABLE "hotel_extra_services"
      ADD COLUMN IF NOT EXISTS "outletId" uuid REFERENCES "hotel_pos_outlets"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "aiIncluded" boolean NOT NULL DEFAULT false`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_pos_checks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "outletId" uuid NOT NULL REFERENCES "hotel_pos_outlets"("id") ON DELETE CASCADE,
      "number" integer NOT NULL,
      "businessDate" date NOT NULL,
      "reservationId" uuid REFERENCES "hotel_reservations"("id") ON DELETE SET NULL,
      "roomLabel" varchar(64),
      "guestName" varchar(200),
      "paymentMethod" varchar(16),
      "lines" jsonb NOT NULL DEFAULT '[]',
      "total" numeric(14,2) NOT NULL DEFAULT 0,
      "includedValue" numeric(14,2) NOT NULL DEFAULT 0,
      "folioLineIds" uuid[] NOT NULL DEFAULT '{}',
      "status" varchar(8) NOT NULL DEFAULT 'posted',
      "note" text,
      "voidReason" text,
      "createdBy" uuid,
      "voidedBy" uuid,
      "voidedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_pos_checks" ON "hotel_pos_checks" ("tenantId", "hotelId", "businessDate")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_pos_check_no" ON "hotel_pos_checks" ("outletId", "number")`);
    await q.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "posCreditLimit" numeric(14,2)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "posCreditLimit"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_pos_checks"`);
    await q.query(`ALTER TABLE "hotel_extra_services" DROP COLUMN IF EXISTS "outletId", DROP COLUMN IF EXISTS "aiIncluded"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_pos_outlets"`);
  }
}
