import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Оплата на месте в точках продаж — в кассовую смену: чек помнит смену продажи, сторно — смену возврата денег
 * (та же смена, если она ещё открыта; иначе — текущая открытая).
 */
export class HotelPosShift1795800000000 implements MigrationInterface {
  name = 'HotelPosShift1795800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_pos_checks"
      ADD COLUMN IF NOT EXISTS "shiftId" uuid NULL REFERENCES "hotel_cash_shifts"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "voidShiftId" uuid NULL REFERENCES "hotel_cash_shifts"("id") ON DELETE SET NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_pos_checks_shift" ON "hotel_pos_checks" ("shiftId") WHERE "shiftId" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_pos_checks_void_shift" ON "hotel_pos_checks" ("voidShiftId") WHERE "voidShiftId" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_hotel_pos_checks_void_shift"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_hotel_pos_checks_shift"`);
    await q.query(`ALTER TABLE "hotel_pos_checks" DROP COLUMN IF EXISTS "voidShiftId", DROP COLUMN IF EXISTS "shiftId"`);
  }
}
