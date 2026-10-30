import { MigrationInterface, QueryRunner } from 'typeorm';

/** Менеджер каналов: подключения отеля к channel manager (Channex → Booking.com, Expedia, Airbnb…), сопоставления
 * типов номеров и тарифов, журнал синхронизации; у брони — откуда пришла (канал, OTA, код брони OTA). */
export class HotelChannels1794600000000 implements MigrationInterface {
  name = 'HotelChannels1794600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_channel_connections" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "provider" varchar(24) NOT NULL,
      "environment" varchar(16) NOT NULL DEFAULT 'production',
      "status" varchar(16) NOT NULL DEFAULT 'active',
      "apiKeyEnc" text,
      "externalPropertyId" varchar(80),
      "externalPropertyName" varchar(255),
      "settings" jsonb NOT NULL DEFAULT '{}',
      "lastPushAt" timestamptz,
      "lastPullAt" timestamptz,
      "lastError" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_hotel_channel_conn" ON "hotel_channel_connections" ("tenantId", "hotelId", "provider")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_channel_mappings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "connectionId" uuid NOT NULL REFERENCES "hotel_channel_connections"("id") ON DELETE CASCADE,
      "roomTypeId" uuid NOT NULL REFERENCES "hotel_room_types"("id") ON DELETE CASCADE,
      "occupancyTypeId" uuid REFERENCES "hotel_room_occupancy_types"("id") ON DELETE SET NULL,
      "marketGroupId" uuid REFERENCES "hotel_market_groups"("id") ON DELETE SET NULL,
      "externalRoomTypeId" varchar(80) NOT NULL,
      "externalRatePlanId" varchar(80),
      "externalName" varchar(255),
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_hotel_channel_map_conn" ON "hotel_channel_mappings" ("tenantId", "connectionId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_channel_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "connectionId" uuid NOT NULL REFERENCES "hotel_channel_connections"("id") ON DELETE CASCADE,
      "kind" varchar(16) NOT NULL,
      "ok" boolean NOT NULL DEFAULT true,
      "message" text NOT NULL,
      "details" jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_hotel_channel_logs" ON "hotel_channel_logs" ("tenantId", "connectionId", "createdAt")`);
    await q.query(`ALTER TABLE "hotel_reservations"
      ADD COLUMN IF NOT EXISTS "channelConnectionId" uuid REFERENCES "hotel_channel_connections"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "channelBookingId" varchar(120),
      ADD COLUMN IF NOT EXISTS "otaName" varchar(80),
      ADD COLUMN IF NOT EXISTS "otaCode" varchar(120)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_hotel_res_channel_booking" ON "hotel_reservations" ("tenantId", "channelConnectionId", "channelBookingId") WHERE "channelBookingId" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "uq_hotel_res_channel_booking"`);
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "channelConnectionId", DROP COLUMN IF EXISTS "channelBookingId", DROP COLUMN IF EXISTS "otaName", DROP COLUMN IF EXISTS "otaCode"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_channel_logs"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_channel_mappings"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_channel_connections"`);
  }
}
