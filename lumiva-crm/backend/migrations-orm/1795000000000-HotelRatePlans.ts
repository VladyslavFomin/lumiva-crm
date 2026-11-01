import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Тарифы отеля (питание, невозвратный, условия отмены и предоплаты) + у брони тариф и срок предоплаты,
 * у сопоставления канала — наш тариф.
 */
export class HotelRatePlans1795000000000 implements MigrationInterface {
  name = 'HotelRatePlans1795000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_rate_plans" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "code" varchar(16) NOT NULL,
      "name" varchar(120) NOT NULL,
      "description" text,
      "boardType" varchar(4) NOT NULL,
      "boardSupplementAdult" numeric(14,2) NOT NULL DEFAULT 0,
      "boardSupplementChild" numeric(14,2) NOT NULL DEFAULT 0,
      "adjustType" varchar(8) NOT NULL DEFAULT 'percent',
      "adjustValue" numeric(14,2) NOT NULL DEFAULT 0,
      "refundable" boolean NOT NULL DEFAULT true,
      "cancellationPolicy" jsonb NOT NULL DEFAULT '[]',
      "prepaymentType" varchar(8) NOT NULL DEFAULT 'none',
      "prepaymentValue" numeric(8,2) NOT NULL DEFAULT 0,
      "prepaymentDueDays" smallint NOT NULL DEFAULT 0,
      "minNights" smallint NOT NULL DEFAULT 1,
      "roomTypeIds" uuid[] NOT NULL DEFAULT '{}',
      "sellDirect" boolean NOT NULL DEFAULT true,
      "sellWebsite" boolean NOT NULL DEFAULT true,
      "isDefault" boolean NOT NULL DEFAULT false,
      "active" boolean NOT NULL DEFAULT true,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_rate_plan_code" ON "hotel_rate_plans" ("hotelId", lower("code"))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_rate_plans_tenant_hotel" ON "hotel_rate_plans" ("tenantId", "hotelId")`);
    await q.query(`ALTER TABLE "hotel_reservations"
      ADD COLUMN IF NOT EXISTS "ratePlanId" uuid REFERENCES "hotel_rate_plans"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "depositDueDate" date`);
    await q.query(`ALTER TABLE "hotel_channel_mappings" ADD COLUMN IF NOT EXISTS "ratePlanId" uuid REFERENCES "hotel_rate_plans"("id") ON DELETE SET NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_channel_mappings" DROP COLUMN IF EXISTS "ratePlanId"`);
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "ratePlanId", DROP COLUMN IF EXISTS "depositDueDate"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_rate_plans"`);
  }
}
