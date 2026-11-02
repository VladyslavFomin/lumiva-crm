import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Программы лояльности: область (отели / бренды-сеть / весь аккаунт), уровни, баллы, простой режим скидки;
 * участники (профили гостей), движения баллов (основа взаиморасчётов сети), учтённые проживания.
 */
export class HotelLoyalty1796200000000 implements MigrationInterface {
  name = 'HotelLoyalty1796200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_loyalty_programs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL,
      "scope" varchar(10) NOT NULL DEFAULT 'hotels',
      "hotelIds" uuid[] NOT NULL DEFAULT '{}',
      "brandIds" uuid[] NOT NULL DEFAULT '{}',
      "currency" varchar(3) NOT NULL DEFAULT 'EUR',
      "active" boolean NOT NULL DEFAULT true,
      "settings" jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_loyalty_programs_tenant" ON "hotel_loyalty_programs" ("tenantId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_loyalty_members" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "programId" uuid NOT NULL REFERENCES "hotel_loyalty_programs"("id") ON DELETE CASCADE,
      "profileId" uuid NOT NULL REFERENCES "hotel_guest_profiles"("id") ON DELETE CASCADE,
      "number" varchar(16) NOT NULL,
      "tier" varchar(40) NULL,
      "tierSince" timestamptz NULL,
      "points" integer NOT NULL DEFAULT 0,
      "pendingPoints" integer NOT NULL DEFAULT 0,
      "lifetimePoints" integer NOT NULL DEFAULT 0,
      "status" varchar(10) NOT NULL DEFAULT 'active',
      "token" varchar(48) NOT NULL,
      "lastActivityAt" timestamptz NULL,
      "expiryWarnedAt" timestamptz NULL,
      "joinedAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_loyalty_members_profile" ON "hotel_loyalty_members" ("programId", "profileId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_loyalty_members_token" ON "hotel_loyalty_members" ("token")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_loyalty_members_number" ON "hotel_loyalty_members" ("tenantId", "number")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_loyalty_tx" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "programId" uuid NOT NULL REFERENCES "hotel_loyalty_programs"("id") ON DELETE CASCADE,
      "memberId" uuid NOT NULL REFERENCES "hotel_loyalty_members"("id") ON DELETE CASCADE,
      "hotelId" uuid NULL REFERENCES "hotels"("id") ON DELETE SET NULL,
      "reservationId" uuid NULL REFERENCES "hotel_reservations"("id") ON DELETE SET NULL,
      "type" varchar(8) NOT NULL,
      "points" integer NOT NULL,
      "value" numeric(14,2) NOT NULL DEFAULT 0,
      "status" varchar(8) NOT NULL DEFAULT 'posted',
      "availableAt" timestamptz NULL,
      "paymentId" varchar(64) NULL,
      "note" text NULL,
      "createdBy" uuid NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_loyalty_tx_program" ON "hotel_loyalty_tx" ("tenantId", "programId", "createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_loyalty_tx_member" ON "hotel_loyalty_tx" ("memberId", "createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_loyalty_tx_pending" ON "hotel_loyalty_tx" ("availableAt") WHERE "status" = 'pending'`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_loyalty_stays" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "programId" uuid NOT NULL REFERENCES "hotel_loyalty_programs"("id") ON DELETE CASCADE,
      "memberId" uuid NOT NULL REFERENCES "hotel_loyalty_members"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "reservationId" uuid NOT NULL REFERENCES "hotel_reservations"("id") ON DELETE CASCADE,
      "checkOut" date NOT NULL,
      "nights" integer NOT NULL,
      "spend" numeric(14,2) NOT NULL DEFAULT 0,
      "countsForTier" boolean NOT NULL DEFAULT true,
      "points" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_loyalty_stays_res" ON "hotel_loyalty_stays" ("reservationId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_loyalty_stays_member" ON "hotel_loyalty_stays" ("memberId", "checkOut")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "hotel_loyalty_stays"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_loyalty_tx"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_loyalty_members"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_loyalty_programs"`);
  }
}
