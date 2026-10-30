import { MigrationInterface, QueryRunner } from 'typeorm';

/** Детская политика цен отеля по умолчанию (прямые продажи): полосы возраста → бесплатно / % от цены взрослого. У контракта — своя (hotel_contracts.childPolicy). */
export class HotelChildPolicy1794500000000 implements MigrationInterface {
  name = 'HotelChildPolicy1794500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "childPolicy" jsonb NOT NULL DEFAULT '[]'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "childPolicy"`);
  }
}
