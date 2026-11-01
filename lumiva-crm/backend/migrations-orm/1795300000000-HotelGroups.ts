import { MigrationInterface, QueryRunner } from 'typeorm';

/** Групповые брони: группа + у брони groupId и признак «гость ещё не указан» (номер ждёт rooming list) */
export class HotelGroups1795300000000 implements MigrationInterface {
  name = 'HotelGroups1795300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_groups" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "code" varchar(24) NOT NULL,
      "name" varchar(160) NOT NULL,
      "agencyId" uuid REFERENCES "hotel_agencies"("id") ON DELETE SET NULL,
      "contractId" uuid REFERENCES "hotel_contracts"("id") ON DELETE SET NULL,
      "blockId" uuid REFERENCES "hotel_room_blocks"("id") ON DELETE SET NULL,
      "ratePlanId" uuid REFERENCES "hotel_rate_plans"("id") ON DELETE SET NULL,
      "contactName" varchar(160),
      "contactEmail" varchar(200),
      "contactPhone" varchar(40),
      "checkIn" date NOT NULL,
      "checkOut" date NOT NULL,
      "status" varchar(12) NOT NULL DEFAULT 'definite',
      "optionUntil" timestamptz,
      "roomingDue" date,
      "billing" varchar(12) NOT NULL DEFAULT 'individual',
      "notes" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_groups_tenant_hotel" ON "hotel_groups" ("tenantId", "hotelId")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_groups_code" ON "hotel_groups" ("tenantId", "code")`);
    await q.query(`ALTER TABLE "hotel_reservations"
      ADD COLUMN IF NOT EXISTS "groupId" uuid REFERENCES "hotel_groups"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "roomingPending" boolean NOT NULL DEFAULT false`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_res_group" ON "hotel_reservations" ("groupId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_hotel_res_group"`);
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "groupId", DROP COLUMN IF EXISTS "roomingPending"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_groups"`);
  }
}
