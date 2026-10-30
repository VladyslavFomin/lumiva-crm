import { MigrationInterface, QueryRunner } from 'typeorm';

/** Единый расчёт цены брони: рынок → группа рынков, приоритет сезон/рынок, цена по ночам, режим авто/ручная. */
export class HotelRateEngine1794300000000 implements MigrationInterface {
  name = 'HotelRateEngine1794300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_markets" ADD COLUMN IF NOT EXISTS "marketGroupId" uuid REFERENCES "hotel_market_groups"("id") ON DELETE SET NULL`);
    await q.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "pricingPriority" varchar(16) NOT NULL DEFAULT 'season'`);
    await q.query(`ALTER TABLE "hotel_reservations"
      ADD COLUMN IF NOT EXISTS "priceMode" varchar(8) NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS "nightlyRates" jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "priceMode", DROP COLUMN IF EXISTS "nightlyRates"`);
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "pricingPriority"`);
    await q.query(`ALTER TABLE "hotel_markets" DROP COLUMN IF EXISTS "marketGroupId"`);
  }
}
