import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Менеджер каналов по правилам Channex (сертификация PMS):
 * — последнее отправленное значение ARI по дню (hotel_channel_ari_state) — в канал уходят только изменения;
 * — у подключения: вебхук броней (секрет зашифрован), последняя полная выгрузка, пауза после ошибок;
 * — ограничения продаж на дату: закрыто на заезд / выезд, максимум ночей;
 * — у брони из канала: кто берёт оплату (отель / OTA) и способ оплаты.
 */
export class HotelChannelSync1794900000000 implements MigrationInterface {
  name = 'HotelChannelSync1794900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_channel_ari_state" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "connectionId" uuid NOT NULL REFERENCES "hotel_channel_connections"("id") ON DELETE CASCADE,
      "kind" varchar(8) NOT NULL,
      "externalId" varchar(80) NOT NULL,
      "date" date NOT NULL,
      "value" jsonb NOT NULL,
      "sentAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_channel_ari_state" ON "hotel_channel_ari_state" ("connectionId", "kind", "externalId", "date")`);
    await q.query(`ALTER TABLE "hotel_channel_connections"
      ADD COLUMN IF NOT EXISTS "webhookId" varchar(80),
      ADD COLUMN IF NOT EXISTS "webhookSecretEnc" text,
      ADD COLUMN IF NOT EXISTS "lastFullSyncAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "lastDeltaAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "backoffUntil" timestamptz,
      ADD COLUMN IF NOT EXISTS "failCount" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "hotel_channel_mappings" ADD COLUMN IF NOT EXISTS "ratePlanMeta" jsonb`);
    await q.query(`ALTER TABLE "hotel_room_date_overrides"
      ADD COLUMN IF NOT EXISTS "closedToArrival" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "closedToDeparture" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "maxNights" smallint`);
    await q.query(`ALTER TABLE "hotel_reservations"
      ADD COLUMN IF NOT EXISTS "paymentCollect" varchar(12),
      ADD COLUMN IF NOT EXISTS "channelPaymentType" varchar(16)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "paymentCollect", DROP COLUMN IF EXISTS "channelPaymentType"`);
    await q.query(`ALTER TABLE "hotel_room_date_overrides" DROP COLUMN IF EXISTS "closedToArrival", DROP COLUMN IF EXISTS "closedToDeparture", DROP COLUMN IF EXISTS "maxNights"`);
    await q.query(`ALTER TABLE "hotel_channel_mappings" DROP COLUMN IF EXISTS "ratePlanMeta"`);
    await q.query(`ALTER TABLE "hotel_channel_connections" DROP COLUMN IF EXISTS "webhookId", DROP COLUMN IF EXISTS "webhookSecretEnc",
      DROP COLUMN IF EXISTS "lastFullSyncAt", DROP COLUMN IF EXISTS "lastDeltaAt", DROP COLUMN IF EXISTS "backoffUntil", DROP COLUMN IF EXISTS "failCount"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_channel_ari_state"`);
  }
}
