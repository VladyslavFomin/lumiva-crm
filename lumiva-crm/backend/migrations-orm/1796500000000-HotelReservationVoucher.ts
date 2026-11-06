import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ваучер брони — номер заявки у партнёра (ТО: Anex/SAMO, Sejour…; OTA: номер брони Booking.com).
 *  По нему потом сопоставляются брони из интеграций с туроператорами, поэтому индекс (tenant, партнёр, ваучер). */
export class HotelReservationVoucher1796500000000 implements MigrationInterface {
  name = 'HotelReservationVoucher1796500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "voucherNo" varchar(120)`);
    // брони из менеджера каналов: код брони OTA и есть ваучер
    await q.query(`UPDATE "hotel_reservations" SET "voucherNo" = "otaCode" WHERE "voucherNo" IS NULL AND "otaCode" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_reservations_voucher" ON "hotel_reservations" ("tenantId", "agencyId", "voucherNo") WHERE "voucherNo" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_hotel_reservations_voucher"`);
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "voucherNo"`);
  }
}
