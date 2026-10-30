import { MigrationInterface, QueryRunner } from 'typeorm';

/** PMS v2, этап 3: этаж/корпус/признаки номера, неработающие номера на период, план уборки, неисправности, находки. */
export class HotelHousekeeping1794100000000 implements MigrationInterface {
  name = 'HotelHousekeeping1794100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "hotel_room_units"
      ADD COLUMN IF NOT EXISTS "floor" varchar(16),
      ADD COLUMN IF NOT EXISTS "building" varchar(64),
      ADD COLUMN IF NOT EXISTS "features" jsonb NOT NULL DEFAULT '[]'`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_room_outages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "roomUnitId" uuid NOT NULL REFERENCES "hotel_room_units"("id") ON DELETE CASCADE,
      "kind" varchar(8) NOT NULL DEFAULT 'ooo',
      "dateFrom" date NOT NULL,
      "dateTo" date,
      "reason" varchar(32) NOT NULL DEFAULT 'repair',
      "note" text,
      "issueId" uuid,
      "createdBy" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_outages_scope" ON "hotel_room_outages" ("tenantId", "hotelId", "dateFrom")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_outages_unit" ON "hotel_room_outages" ("roomUnitId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_housekeeping_tasks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "date" date NOT NULL,
      "roomUnitId" uuid NOT NULL REFERENCES "hotel_room_units"("id") ON DELETE CASCADE,
      "kind" varchar(16) NOT NULL,
      "priority" integer NOT NULL DEFAULT 0,
      "credits" integer NOT NULL DEFAULT 1,
      "reservationId" uuid,
      "assigneeUserId" uuid,
      "status" varchar(16) NOT NULL DEFAULT 'pending',
      "note" text,
      "startedAt" timestamptz,
      "doneAt" timestamptz,
      "inspectedAt" timestamptz,
      "inspectedBy" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_hk_scope" ON "hotel_housekeeping_tasks" ("tenantId", "hotelId", "date")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hotel_hk_unit_day" ON "hotel_housekeeping_tasks" ("hotelId", "date", "roomUnitId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_hk_assignee" ON "hotel_housekeeping_tasks" ("tenantId", "assigneeUserId", "date")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_maintenance_issues" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "roomUnitId" uuid REFERENCES "hotel_room_units"("id") ON DELETE SET NULL,
      "category" varchar(24) NOT NULL DEFAULT 'other',
      "priority" varchar(8) NOT NULL DEFAULT 'normal',
      "status" varchar(16) NOT NULL DEFAULT 'open',
      "description" text NOT NULL,
      "photoUrls" jsonb NOT NULL DEFAULT '[]',
      "reportedBy" uuid,
      "assigneeUserId" uuid,
      "outageId" uuid,
      "resolution" text,
      "resolvedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_issues_scope" ON "hotel_maintenance_issues" ("tenantId", "hotelId", "status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_issues_unit" ON "hotel_maintenance_issues" ("roomUnitId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_lost_found" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "roomUnitId" uuid REFERENCES "hotel_room_units"("id") ON DELETE SET NULL,
      "reservationId" uuid REFERENCES "hotel_reservations"("id") ON DELETE SET NULL,
      "guestName" varchar(255),
      "category" varchar(16) NOT NULL DEFAULT 'other',
      "description" text NOT NULL,
      "foundPlace" varchar(255),
      "foundAt" timestamptz NOT NULL,
      "foundBy" uuid,
      "storageLocation" varchar(255),
      "photoUrls" jsonb NOT NULL DEFAULT '[]',
      "status" varchar(16) NOT NULL DEFAULT 'stored',
      "returnedTo" varchar(255),
      "closedAt" timestamptz,
      "notifiedAt" timestamptz,
      "note" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_lost_scope" ON "hotel_lost_found" ("tenantId", "hotelId", "status")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "hotel_lost_found"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_maintenance_issues"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_housekeeping_tasks"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_room_outages"`);
    await q.query(`ALTER TABLE "hotel_room_units" DROP COLUMN IF EXISTS "floor", DROP COLUMN IF EXISTS "building", DROP COLUMN IF EXISTS "features"`);
  }
}
