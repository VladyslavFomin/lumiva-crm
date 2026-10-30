import { MigrationInterface, QueryRunner } from 'typeorm';

/** Отели: партнёры (полная карточка), контракты с квотами, блоки номеров, страны в бронях и рынках. */
export class HotelPartnersContracts1793700000000 implements MigrationInterface {
  name = 'HotelPartnersContracts1793700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "hotel_agencies"
        ADD COLUMN IF NOT EXISTS "type" varchar(24) NOT NULL DEFAULT 'tour_operator',
        ADD COLUMN IF NOT EXISTS "status" varchar(12) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "countryCode" varchar(2),
        ADD COLUMN IF NOT EXISTS "city" varchar(120),
        ADD COLUMN IF NOT EXISTS "code" varchar(32),
        ADD COLUMN IF NOT EXISTS "legalName" varchar(255),
        ADD COLUMN IF NOT EXISTS "taxId" varchar(64),
        ADD COLUMN IF NOT EXISTS "address" text,
        ADD COLUMN IF NOT EXISTS "contactName" varchar(160),
        ADD COLUMN IF NOT EXISTS "email" varchar(190),
        ADD COLUMN IF NOT EXISTS "phone" varchar(64),
        ADD COLUMN IF NOT EXISTS "website" varchar(255),
        ADD COLUMN IF NOT EXISTS "currency" varchar(3),
        ADD COLUMN IF NOT EXISTS "commissionPct" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "paymentTerms" varchar(16) NOT NULL DEFAULT 'prepayment',
        ADD COLUMN IF NOT EXISTS "paymentDays" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "creditLimit" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "notes" text
    `);
    // засеянные по умолчанию партнёры получают тип: «Прямая продажа» — direct, Booking.com — ota
    await q.query(`UPDATE "hotel_agencies" SET "type" = 'direct' WHERE "name" = 'Прямая продажа'`);
    await q.query(`UPDATE "hotel_agencies" SET "type" = 'ota' WHERE "name" = 'Booking.com'`);
    await q.query(`UPDATE "hotel_agencies" SET "type" = 'travel_agency' WHERE "name" LIKE 'Local Agent%'`);

    await q.query(`ALTER TABLE "hotel_markets" ADD COLUMN IF NOT EXISTS "countryCodes" text[] NOT NULL DEFAULT '{}'`);
    // рынки с кодом страны получают эту страну (de → DE, uk → GB); «ru/СНГ» — набор стран СНГ
    await q.query(`UPDATE "hotel_markets" SET "countryCodes" = ARRAY[upper("code")] WHERE cardinality("countryCodes") = 0 AND length("code") = 2 AND lower("code") NOT IN ('uk', 'ru')`);
    await q.query(`UPDATE "hotel_markets" SET "countryCodes" = ARRAY['GB'] WHERE cardinality("countryCodes") = 0 AND lower("code") = 'uk'`);
    await q.query(`UPDATE "hotel_markets" SET "countryCodes" = CASE WHEN "name" ILIKE '%СНГ%' OR "name" ILIKE '%CIS%'
        THEN ARRAY['RU','BY','KZ','UZ','KG','TJ','AM','AZ','MD','UA','GE','TM'] ELSE ARRAY['RU'] END
      WHERE cardinality("countryCodes") = 0 AND lower("code") = 'ru'`);

    await q.query(`
      ALTER TABLE "hotel_reservations"
        ADD COLUMN IF NOT EXISTS "guestCountry" varchar(2),
        ADD COLUMN IF NOT EXISTS "saleCountry" varchar(2),
        ADD COLUMN IF NOT EXISTS "marketId" uuid,
        ADD COLUMN IF NOT EXISTS "contractId" uuid,
        ADD COLUMN IF NOT EXISTS "blockId" uuid,
        ADD COLUMN IF NOT EXISTS "boardType" varchar(4),
        ADD COLUMN IF NOT EXISTS "commissionPct" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "commissionAmount" numeric(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "netTotal" numeric(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "children" integer NOT NULL DEFAULT 0
    `);
    await q.query(`UPDATE "hotel_reservations" SET "netTotal" = "total" WHERE "netTotal" = 0 AND "total" <> 0`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_res_contract" ON "hotel_reservations" ("tenantId", "contractId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_res_block" ON "hotel_reservations" ("tenantId", "blockId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "hotel_contracts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "agencyId" uuid NOT NULL REFERENCES "hotel_agencies"("id") ON DELETE CASCADE,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "name" varchar(160) NOT NULL,
        "code" varchar(48),
        "status" varchar(12) NOT NULL DEFAULT 'draft',
        "validFrom" date NOT NULL,
        "validTo" date NOT NULL,
        "bookingFrom" date,
        "bookingTo" date,
        "pricing" varchar(12) NOT NULL DEFAULT 'commission',
        "commissionPct" numeric(5,2) NOT NULL DEFAULT 0,
        "boardType" varchar(4) NOT NULL DEFAULT 'BB',
        "currency" varchar(3),
        "releaseDays" integer NOT NULL DEFAULT 7,
        "guaranteed" boolean NOT NULL DEFAULT false,
        "allowOverAllotment" boolean NOT NULL DEFAULT true,
        "minStay" integer NOT NULL DEFAULT 1,
        "marketCountries" text[] NOT NULL DEFAULT '{}',
        "rooms" jsonb NOT NULL DEFAULT '[]',
        "cancellationPolicy" jsonb NOT NULL DEFAULT '[]',
        "childPolicy" jsonb NOT NULL DEFAULT '[]',
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_contracts_agency" ON "hotel_contracts" ("tenantId", "agencyId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_contracts_hotel" ON "hotel_contracts" ("tenantId", "hotelId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_blocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "roomTypeId" uuid NOT NULL,
        "agencyId" uuid REFERENCES "hotel_agencies"("id") ON DELETE SET NULL,
        "contractId" uuid REFERENCES "hotel_contracts"("id") ON DELETE SET NULL,
        "name" varchar(160) NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'tentative',
        "dateFrom" date NOT NULL,
        "dateTo" date NOT NULL,
        "rooms" integer NOT NULL,
        "cutoffDate" date NOT NULL,
        "ratePerNight" numeric(14,2),
        "boardType" varchar(4),
        "countryCode" varchar(2),
        "contactName" varchar(160),
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_room_blocks_hotel" ON "hotel_room_blocks" ("tenantId", "hotelId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "hotel_room_blocks"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_contracts"`);
    await q.query(`ALTER TABLE "hotel_reservations"
      DROP COLUMN IF EXISTS "guestCountry", DROP COLUMN IF EXISTS "saleCountry", DROP COLUMN IF EXISTS "marketId",
      DROP COLUMN IF EXISTS "contractId", DROP COLUMN IF EXISTS "blockId", DROP COLUMN IF EXISTS "boardType",
      DROP COLUMN IF EXISTS "commissionPct", DROP COLUMN IF EXISTS "commissionAmount", DROP COLUMN IF EXISTS "netTotal",
      DROP COLUMN IF EXISTS "children"`);
    await q.query(`ALTER TABLE "hotel_markets" DROP COLUMN IF EXISTS "countryCodes"`);
    await q.query(`ALTER TABLE "hotel_agencies"
      DROP COLUMN IF EXISTS "type", DROP COLUMN IF EXISTS "status", DROP COLUMN IF EXISTS "countryCode", DROP COLUMN IF EXISTS "city",
      DROP COLUMN IF EXISTS "code", DROP COLUMN IF EXISTS "legalName", DROP COLUMN IF EXISTS "taxId", DROP COLUMN IF EXISTS "address",
      DROP COLUMN IF EXISTS "contactName", DROP COLUMN IF EXISTS "email", DROP COLUMN IF EXISTS "phone", DROP COLUMN IF EXISTS "website",
      DROP COLUMN IF EXISTS "currency", DROP COLUMN IF EXISTS "commissionPct", DROP COLUMN IF EXISTS "paymentTerms",
      DROP COLUMN IF EXISTS "paymentDays", DROP COLUMN IF EXISTS "creditLimit", DROP COLUMN IF EXISTS "notes"`);
  }
}
