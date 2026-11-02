import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Рекомендации цены (revenue management): правила «загрузка / подборка → ±%» по дням до даты, поправка revenue на дату
 * и тип номера (rmPct поверх прайса), автоприменение с ограничителями (не ниже бюджета PP, не больше шага).
 */
export class HotelRevenue1795600000000 implements MigrationInterface {
  name = 'HotelRevenue1795600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_revenue_rules" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "name" varchar(120) NOT NULL,
      "roomTypeIds" uuid[] NOT NULL DEFAULT '{}',
      "metric" varchar(12) NOT NULL DEFAULT 'occupancy',
      "op" varchar(4) NOT NULL DEFAULT 'gte',
      "threshold" numeric(8,2) NOT NULL,
      "leadMin" smallint NOT NULL DEFAULT 0,
      "leadMax" smallint,
      "weekdays" smallint[] NOT NULL DEFAULT '{}',
      "adjustPct" numeric(6,2) NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_revenue_rules" ON "hotel_revenue_rules" ("tenantId", "hotelId")`);
    await q.query(`ALTER TABLE "hotel_room_date_overrides"
      ADD COLUMN IF NOT EXISTS "rmPct" numeric(6,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "rmRuleId" uuid,
      ADD COLUMN IF NOT EXISTS "rmAppliedAt" timestamptz`);
    await q.query(`ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "revenueAutoApply" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "revenueHorizon" smallint NOT NULL DEFAULT 90,
      ADD COLUMN IF NOT EXISTS "revenueMaxPct" numeric(6,2) NOT NULL DEFAULT 30`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "revenueAutoApply", DROP COLUMN IF EXISTS "revenueHorizon", DROP COLUMN IF EXISTS "revenueMaxPct"`);
    await q.query(`ALTER TABLE "hotel_room_date_overrides" DROP COLUMN IF EXISTS "rmPct", DROP COLUMN IF EXISTS "rmRuleId", DROP COLUMN IF EXISTS "rmAppliedAt"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_revenue_rules"`);
  }
}
