import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Рыночный лист прайса (Avrupa / İngiltere / İç Pazar…) → цены группы рынков: свой PP категории на период там, где разница
 * категорий в рынке другая, валюта листа и курс пересчёта в валюту отеля, откуда и когда импортировано.
 */
export class HotelMarketSheets1795400000000 implements MigrationInterface {
  name = 'HotelMarketSheets1795400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_market_groups"
      ADD COLUMN IF NOT EXISTS "roomPP" jsonb NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "sourceCurrency" varchar(3),
      ADD COLUMN IF NOT EXISTS "fxRate" numeric(14,6),
      ADD COLUMN IF NOT EXISTS "importedSheet" varchar(100),
      ADD COLUMN IF NOT EXISTS "importedAt" timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_market_groups" DROP COLUMN IF EXISTS "roomPP", DROP COLUMN IF EXISTS "sourceCurrency", DROP COLUMN IF EXISTS "fxRate", DROP COLUMN IF EXISTS "importedSheet", DROP COLUMN IF EXISTS "importedAt"`);
  }
}
