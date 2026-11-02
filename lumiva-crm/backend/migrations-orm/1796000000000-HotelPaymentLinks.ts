import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Онлайн-предоплата брони: запросы оплаты (постоянная ссылка /hp/:token) и привязка платежа платёжной системы
 * к запросу + адрес возврата покупателя.
 */
export class HotelPaymentLinks1796000000000 implements MigrationInterface {
  name = 'HotelPaymentLinks1796000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_payment_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "reservationId" uuid NOT NULL REFERENCES "hotel_reservations"("id") ON DELETE CASCADE,
      "token" varchar(64) NOT NULL,
      "folio" varchar(8) NOT NULL DEFAULT 'guest',
      "kind" varchar(8) NOT NULL DEFAULT 'custom',
      "amount" numeric(14,2) NOT NULL,
      "currency" varchar(3) NOT NULL,
      "status" varchar(10) NOT NULL DEFAULT 'pending',
      "expiresAt" timestamptz NULL,
      "note" varchar(200) NULL,
      "paymentId" uuid NULL,
      "reservationPaymentId" varchar(64) NULL,
      "paidAt" timestamptz NULL,
      "openedAt" timestamptz NULL,
      "sentAt" timestamptz NULL,
      "sentTo" varchar(190) NULL,
      "origin" varchar(12) NOT NULL DEFAULT 'staff',
      "createdBy" uuid NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_payment_requests_token" ON "hotel_payment_requests" ("token")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_payment_requests_res" ON "hotel_payment_requests" ("tenantId", "reservationId")`);
    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "hotelPaymentRequestId" uuid NULL, ADD COLUMN IF NOT EXISTS "returnUrl" text NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_hotel_request" ON "payments" ("hotelPaymentRequestId") WHERE "hotelPaymentRequestId" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_payments_hotel_request"`);
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "returnUrl", DROP COLUMN IF EXISTS "hotelPaymentRequestId"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_payment_requests"`);
  }
}
