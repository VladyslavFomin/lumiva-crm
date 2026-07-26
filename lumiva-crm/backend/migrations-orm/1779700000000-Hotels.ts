import { MigrationInterface, QueryRunner } from 'typeorm';

/** New "Система резервации" (Hotels) extension — separate PMS-style module from
 * the generic Booking extension (see hotels/*.entity.ts). */
export class Hotels1779700000000 implements MigrationInterface {
  name = 'Hotels1779700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "city" varchar(255),
        "country" varchar(255),
        "stars" integer NOT NULL DEFAULT 5,
        "currency" char(3) NOT NULL DEFAULT 'USD',
        "address" text,
        "description" text,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "checkInTime" varchar(8) NOT NULL DEFAULT '14:00',
        "checkOutTime" varchar(8) NOT NULL DEFAULT '12:00',
        "referenceMarketGroupId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotels_tenant" ON "hotels" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_types" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "sizeM2" numeric(8,2),
        "capacityLabel" varchar(255),
        "basePrice" numeric(14,2) NOT NULL DEFAULT 0,
        "currency" char(3) NOT NULL DEFAULT 'USD',
        "quantity" integer NOT NULL DEFAULT 0,
        "amenities" text[] NOT NULL DEFAULT '{}',
        "pricingMode" varchar(16) NOT NULL DEFAULT 'offset',
        "ppNetOffset" numeric(14,2) NOT NULL DEFAULT 0,
        "isBaseRoomType" boolean NOT NULL DEFAULT false,
        "infoFields" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_room_types_tenant_hotel"
        ON "hotel_room_types" ("tenantId", "hotelId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_markets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "code" varchar(16) NOT NULL,
        "name" varchar(255) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_markets_tenant_hotel"
        ON "hotel_markets" ("tenantId", "hotelId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_market_prices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "roomTypeId" uuid NOT NULL REFERENCES "hotel_room_types"("id") ON DELETE CASCADE,
        "marketId" uuid NOT NULL REFERENCES "hotel_markets"("id") ON DELETE CASCADE,
        "price" numeric(14,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_room_market_prices_tenant_room"
        ON "hotel_room_market_prices" ("tenantId", "roomTypeId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_room_market_prices_room_market"
        ON "hotel_room_market_prices" ("roomTypeId", "marketId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_date_overrides" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "roomTypeId" uuid NOT NULL REFERENCES "hotel_room_types"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "price" numeric(14,2),
        "blocked" boolean NOT NULL DEFAULT false,
        "discountPct" numeric(5,2) NOT NULL DEFAULT 0,
        "minNights" integer NOT NULL DEFAULT 1,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_room_date_overrides_tenant_room"
        ON "hotel_room_date_overrides" ("tenantId", "roomTypeId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_room_date_overrides_room_date"
        ON "hotel_room_date_overrides" ("roomTypeId", "date")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_market_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_market_groups_tenant_hotel"
        ON "hotel_market_groups" ("tenantId", "hotelId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_pricing_periods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_pricing_periods_tenant_hotel"
        ON "hotel_pricing_periods" ("tenantId", "hotelId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_daily_market_rates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "roomTypeId" uuid NOT NULL REFERENCES "hotel_room_types"("id") ON DELETE CASCADE,
        "marketGroupId" uuid NOT NULL REFERENCES "hotel_market_groups"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "budgetPP" numeric(14,2) NOT NULL DEFAULT 0,
        "ppAvg" numeric(14,2) NOT NULL DEFAULT 0,
        "grossPP" numeric(14,2) NOT NULL DEFAULT 0,
        "discountPct" numeric(5,2) NOT NULL DEFAULT 0,
        "netPP" numeric(14,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_daily_market_rates_tenant_room"
        ON "hotel_daily_market_rates" ("tenantId", "roomTypeId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_daily_market_rates_room_group_date"
        ON "hotel_daily_market_rates" ("roomTypeId", "marketGroupId", "date")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_room_occupancy_types" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "roomTypeId" uuid NOT NULL REFERENCES "hotel_room_types"("id") ON DELETE CASCADE,
        "label" varchar(255) NOT NULL,
        "coefficient" numeric(8,2) NOT NULL DEFAULT 1,
        "paidChildCount" integer NOT NULL DEFAULT 0,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_room_occupancy_types_tenant_room"
        ON "hotel_room_occupancy_types" ("tenantId", "roomTypeId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_agencies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_agencies_tenant" ON "hotel_agencies" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_reservations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "roomTypeId" uuid NOT NULL REFERENCES "hotel_room_types"("id") ON DELETE CASCADE,
        "agencyId" uuid REFERENCES "hotel_agencies"("id") ON DELETE SET NULL,
        "guestName" varchar(255) NOT NULL,
        "pax" integer NOT NULL DEFAULT 1,
        "market" varchar(255),
        "checkIn" date NOT NULL,
        "checkOut" date NOT NULL,
        "costPerNight" numeric(14,2) NOT NULL DEFAULT 0,
        "ppPerNight" numeric(14,2) NOT NULL DEFAULT 0,
        "grossPerNight" numeric(14,2) NOT NULL DEFAULT 0,
        "ppTotal" numeric(14,2) NOT NULL DEFAULT 0,
        "roomTotal" numeric(14,2) NOT NULL DEFAULT 0,
        "discountPct" numeric(5,2) NOT NULL DEFAULT 0,
        "total" numeric(14,2) NOT NULL DEFAULT 0,
        "status" varchar(16) NOT NULL DEFAULT 'confirmed',
        "paidStatus" varchar(16) NOT NULL DEFAULT 'none',
        "source" varchar(16) NOT NULL DEFAULT 'manual',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_reservations_tenant_hotel"
        ON "hotel_reservations" ("tenantId", "hotelId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_reservations_tenant_checkin"
        ON "hotel_reservations" ("tenantId", "checkIn")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_reservations_tenant_status"
        ON "hotel_reservations" ("tenantId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_agencies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_occupancy_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_daily_market_rates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_pricing_periods"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_market_groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_date_overrides"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_market_prices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_markets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotels"`);
  }
}
