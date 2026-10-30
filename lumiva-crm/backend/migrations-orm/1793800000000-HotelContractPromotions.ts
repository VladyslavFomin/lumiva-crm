import { MigrationInterface, QueryRunner } from 'typeorm';

/** Акции контракта (раннее бронирование, SPO, длительное проживание). */
export class HotelContractPromotions1793800000000 implements MigrationInterface {
  name = 'HotelContractPromotions1793800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_contracts" ADD COLUMN IF NOT EXISTS "promotions" jsonb NOT NULL DEFAULT '[]'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_contracts" DROP COLUMN IF EXISTS "promotions"`);
  }
}
