import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Онлайн-регистрация до заезда (ссылка гостю: паспорта, время прилёта, пожелания) и допродажи (апгрейд, ранний заезд,
 * поздний выезд, услуги из каталога «продавать онлайн») — заявки, которые подтверждает отель.
 */
export class HotelPrecheckin1795500000000 implements MigrationInterface {
  name = 'HotelPrecheckin1795500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_precheckins" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "reservationId" uuid NOT NULL REFERENCES "hotel_reservations"("id") ON DELETE CASCADE,
      "token" varchar(48) NOT NULL,
      "status" varchar(12) NOT NULL DEFAULT 'new',
      "sentAt" timestamptz,
      "sentTo" varchar(200),
      "openedAt" timestamptz,
      "completedAt" timestamptz,
      "language" varchar(5),
      "eta" varchar(5),
      "flight" varchar(40),
      "needTransfer" boolean NOT NULL DEFAULT false,
      "requests" text,
      "preferences" text[] NOT NULL DEFAULT '{}',
      "consent" boolean NOT NULL DEFAULT false,
      "scanCount" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_precheckin_res" ON "hotel_precheckins" ("reservationId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_precheckin_token" ON "hotel_precheckins" ("token")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_precheckin_tenant" ON "hotel_precheckins" ("tenantId", "hotelId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_upsell_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "reservationId" uuid NOT NULL REFERENCES "hotel_reservations"("id") ON DELETE CASCADE,
      "kind" varchar(16) NOT NULL,
      "extraServiceId" uuid REFERENCES "hotel_extra_services"("id") ON DELETE SET NULL,
      "roomTypeId" uuid REFERENCES "hotel_room_types"("id") ON DELETE SET NULL,
      "name" varchar(255) NOT NULL,
      "quantity" numeric(10,2) NOT NULL DEFAULT 1,
      "amount" numeric(14,2) NOT NULL DEFAULT 0,
      "status" varchar(12) NOT NULL DEFAULT 'requested',
      "note" text,
      "decidedBy" uuid,
      "decidedAt" timestamptz,
      "folioLineId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_upsell_tenant" ON "hotel_upsell_requests" ("tenantId", "hotelId", "status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_upsell_res" ON "hotel_upsell_requests" ("reservationId")`);
    await q.query(`ALTER TABLE "hotel_extra_services"
      ADD COLUMN IF NOT EXISTS "sellOnline" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "description" text,
      ADD COLUMN IF NOT EXISTS "priceMode" varchar(12) NOT NULL DEFAULT 'per_stay'`);
    await q.query(`ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "precheckinAutoDays" smallint,
      ADD COLUMN IF NOT EXISTS "precheckinUpgrades" boolean NOT NULL DEFAULT true`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "precheckinAutoDays", DROP COLUMN IF EXISTS "precheckinUpgrades"`);
    await q.query(`ALTER TABLE "hotel_extra_services" DROP COLUMN IF EXISTS "sellOnline", DROP COLUMN IF EXISTS "description", DROP COLUMN IF EXISTS "priceMode"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_upsell_requests"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_precheckins"`);
  }
}
