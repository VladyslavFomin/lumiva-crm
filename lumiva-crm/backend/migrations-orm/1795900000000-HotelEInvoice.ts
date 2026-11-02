import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * e-Fatura / e-Arşiv: подключение отеля к интегратору (первый — Paraşüt) и выставленные документы по фолио брони.
 * У доп. услуги — своя ставка KDV (иначе — ставка по умолчанию из настроек e-Fatura).
 */
export class HotelEInvoice1795900000000 implements MigrationInterface {
  name = 'HotelEInvoice1795900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_einvoice_connections" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "provider" varchar(24) NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "clientId" varchar(160) NULL,
      "clientSecretEnc" text NULL,
      "username" varchar(190) NULL,
      "passwordEnc" text NULL,
      "externalCompanyId" varchar(64) NULL,
      "accessTokenEnc" text NULL,
      "refreshTokenEnc" text NULL,
      "tokenExpiresAt" timestamptz NULL,
      "settings" jsonb NOT NULL DEFAULT '{}',
      "lastCheckedAt" timestamptz NULL,
      "lastError" text NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_einvoice_conn_hotel" ON "hotel_einvoice_connections" ("tenantId", "hotelId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_einvoices" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "reservationId" uuid NOT NULL REFERENCES "hotel_reservations"("id") ON DELETE CASCADE,
      "folio" varchar(16) NOT NULL DEFAULT 'guest',
      "provider" varchar(24) NOT NULL,
      "status" varchar(12) NOT NULL DEFAULT 'sending',
      "docType" varchar(12) NULL,
      "issueDate" date NOT NULL,
      "currency" varchar(3) NOT NULL,
      "exchangeRate" numeric(14,6) NULL,
      "recipient" jsonb NOT NULL,
      "lines" jsonb NOT NULL,
      "totals" jsonb NOT NULL,
      "note" text NULL,
      "externalInvoiceId" varchar(64) NULL,
      "externalDocId" varchar(64) NULL,
      "externalJobId" varchar(64) NULL,
      "invoiceNo" varchar(40) NULL,
      "error" text NULL,
      "pollCount" integer NOT NULL DEFAULT 0,
      "issuedAt" timestamptz NULL,
      "cancelledAt" timestamptz NULL,
      "createdBy" uuid NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_einvoices_hotel" ON "hotel_einvoices" ("tenantId", "hotelId", "createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_einvoices_res" ON "hotel_einvoices" ("tenantId", "reservationId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_einvoices_sending" ON "hotel_einvoices" ("status") WHERE "status" = 'sending'`);
    await q.query(`ALTER TABLE "hotel_extra_services" ADD COLUMN IF NOT EXISTS "vatPct" numeric(5,2) NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_extra_services" DROP COLUMN IF EXISTS "vatPct"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_einvoices"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_einvoice_connections"`);
  }
}
