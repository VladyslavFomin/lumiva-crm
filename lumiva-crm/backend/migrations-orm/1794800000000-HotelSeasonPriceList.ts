import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Прайс сезона одной цепочкой: PP периода (минимальная категория) → + разница категории → × коэффициент размещения
 * (в пиковые периоды — пиковый) → ± рынок (надбавка в % или свой PP на период). У периода — бюджет PP, мин. ночей, release.
 */
export class HotelSeasonPriceList1794800000000 implements MigrationInterface {
  name = 'HotelSeasonPriceList1794800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_pricing_periods"
      ADD COLUMN IF NOT EXISTS "ppBase" numeric(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "budgetPP" numeric(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "minNights" smallint NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "releaseDays" smallint NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "isPeak" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "hotel_room_occupancy_types" ADD COLUMN IF NOT EXISTS "peakCoefficient" numeric(8,2)`);
    // младенцы (INF) в размещении — из названия «+ 1 INF (00-01,99)»
    await q.query(`ALTER TABLE "hotel_room_occupancy_types" ADD COLUMN IF NOT EXISTS "infants" smallint NOT NULL DEFAULT 0`);
    await q.query(`UPDATE "hotel_room_occupancy_types" SET "infants" = substring("label" from '(?i)(\\d+)\\s*(?:INF|INFANT|BEBEK|МЛАД)')::smallint
      WHERE "infants" = 0 AND "label" ~* '\\d+\\s*(INF|INFANT|BEBEK|МЛАД)'`);
    await q.query(`ALTER TABLE "hotel_market_groups"
      ADD COLUMN IF NOT EXISTS "adjustmentPct" numeric(6,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "periodPP" jsonb NOT NULL DEFAULT '{}'`);
    await q.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "periodPP" jsonb NOT NULL DEFAULT '{}'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "periodPP"`);
    await q.query(`ALTER TABLE "hotel_market_groups" DROP COLUMN IF EXISTS "adjustmentPct", DROP COLUMN IF EXISTS "periodPP"`);
    await q.query(`ALTER TABLE "hotel_room_occupancy_types" DROP COLUMN IF EXISTS "peakCoefficient", DROP COLUMN IF EXISTS "infants"`);
    await q.query(`ALTER TABLE "hotel_pricing_periods" DROP COLUMN IF EXISTS "ppBase", DROP COLUMN IF EXISTS "budgetPP",
      DROP COLUMN IF EXISTS "minNights", DROP COLUMN IF EXISTS "releaseDays", DROP COLUMN IF EXISTS "isPeak"`);
  }
}
