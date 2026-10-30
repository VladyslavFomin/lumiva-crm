import { MigrationInterface, QueryRunner } from 'typeorm';

/** Жизненный цикл брони (PMS v2, этап 2): отмена с причиной и штрафом, no-show, опцион с автоснятием,
 * бесплатное проживание с причиной и оценкой стоимости. Статус 'no_show' — varchar, отдельной миграции не требует. */
export class HotelReservationLifecycle1794000000000 implements MigrationInterface {
  name = 'HotelReservationLifecycle1794000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_reservations"
      ADD COLUMN IF NOT EXISTS "cancelReason" varchar(32),
      ADD COLUMN IF NOT EXISTS "cancelNote" text,
      ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "cancellationFee" numeric(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "noShowAt" timestamptz,
      ADD COLUMN IF NOT EXISTS "optionUntil" timestamptz,
      ADD COLUMN IF NOT EXISTS "isComplimentary" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "compReason" varchar(32),
      ADD COLUMN IF NOT EXISTS "compNote" text,
      ADD COLUMN IF NOT EXISTS "compValue" numeric(14,2) NOT NULL DEFAULT 0`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_res_option_until" ON "hotel_reservations" ("optionUntil") WHERE "status" = 'pending' AND "optionUntil" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_hotel_res_option_until"`);
    await q.query(`ALTER TABLE "hotel_reservations"
      DROP COLUMN IF EXISTS "cancelReason", DROP COLUMN IF EXISTS "cancelNote", DROP COLUMN IF EXISTS "cancelledAt",
      DROP COLUMN IF EXISTS "cancellationFee", DROP COLUMN IF EXISTS "noShowAt", DROP COLUMN IF EXISTS "optionUntil",
      DROP COLUMN IF EXISTS "isComplimentary", DROP COLUMN IF EXISTS "compReason", DROP COLUMN IF EXISTS "compNote",
      DROP COLUMN IF EXISTS "compValue"`);
  }
}
