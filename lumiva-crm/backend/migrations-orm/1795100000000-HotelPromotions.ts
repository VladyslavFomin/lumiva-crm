import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Акции отеля для прямых продаж (раннее бронирование, горящие, спецпредложения, длительное проживание)
 * + у брони снимок применённых акций и признак «акции сняты».
 */
export class HotelPromotions1795100000000 implements MigrationInterface {
  name = 'HotelPromotions1795100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_promotions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "type" varchar(16) NOT NULL,
      "name" varchar(120) NOT NULL,
      "description" text,
      "discountPct" numeric(5,2) NOT NULL DEFAULT 0,
      "freeNights" smallint NOT NULL DEFAULT 0,
      "bookFrom" date,
      "bookTo" date,
      "stayFrom" date,
      "stayTo" date,
      "stayRule" varchar(8) NOT NULL DEFAULT 'nights',
      "minNights" smallint NOT NULL DEFAULT 1,
      "maxNights" smallint,
      "minDaysBefore" smallint,
      "maxDaysBefore" smallint,
      "combinable" boolean NOT NULL DEFAULT false,
      "prepaymentPct" numeric(5,2) NOT NULL DEFAULT 0,
      "prepaymentDueDate" date,
      "prepaymentDueDays" smallint,
      "marketGroupIds" uuid[] NOT NULL DEFAULT '{}',
      "roomTypeIds" uuid[] NOT NULL DEFAULT '{}',
      "ratePlanIds" uuid[] NOT NULL DEFAULT '{}',
      "sellDirect" boolean NOT NULL DEFAULT true,
      "sellWebsite" boolean NOT NULL DEFAULT true,
      "active" boolean NOT NULL DEFAULT true,
      "origin" varchar(8) NOT NULL DEFAULT 'manual',
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_promotions_tenant_hotel" ON "hotel_promotions" ("tenantId", "hotelId")`);
    await q.query(`ALTER TABLE "hotel_reservations"
      ADD COLUMN IF NOT EXISTS "promotions" jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS "promotionsOff" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "promotions", DROP COLUMN IF EXISTS "promotionsOff"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_promotions"`);
  }
}
