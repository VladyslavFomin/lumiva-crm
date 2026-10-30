import { MigrationInterface, QueryRunner } from 'typeorm';

/** Налоги отеля: налог на проживание, НДС, цены с налогами или без. */
export class HotelTaxes1793900000000 implements MigrationInterface {
  name = 'HotelTaxes1793900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotels"
      ADD COLUMN IF NOT EXISTS "accommodationTaxPct" numeric(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "vatPct" numeric(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "pricesIncludeTax" boolean NOT NULL DEFAULT true`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "accommodationTaxPct", DROP COLUMN IF EXISTS "vatPct", DROP COLUMN IF EXISTS "pricesIncludeTax"`);
  }
}
