import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «Бронирования» — отдельные интерфейсы под тип бизнеса: план зала и меню (ресторан),
 * счета/заказы (все типы), расписание групповых занятий и абонементы (фитнес),
 * пакеты сессий и протокол (консультации), выдача/возврат/залог (аренда).
 */
export class BookingVerticals1792000000000 implements MigrationInterface {
  name = 'BookingVerticals1792000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "booking_projects" ADD COLUMN IF NOT EXISTS "verticalSettings" jsonb NOT NULL DEFAULT '{}'::jsonb`);

    await q.query(`
      ALTER TABLE "booking_resources"
        ADD COLUMN IF NOT EXISTS "description" text,
        ADD COLUMN IF NOT EXISTS "zoneId" uuid,
        ADD COLUMN IF NOT EXISTS "shape" varchar(16),
        ADD COLUMN IF NOT EXISTS "posX" integer,
        ADD COLUMN IF NOT EXISTS "posY" integer,
        ADD COLUMN IF NOT EXISTS "width" integer,
        ADD COLUMN IF NOT EXISTS "height" integer,
        ADD COLUMN IF NOT EXISTS "rotation" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "minCapacity" integer,
        ADD COLUMN IF NOT EXISTS "pricePerHour" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "pricePerDay" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "depositAmount" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "sku" varchar(64)
    `);

    await q.query(`
      ALTER TABLE "reservations"
        ADD COLUMN IF NOT EXISTS "classSessionId" uuid,
        ADD COLUMN IF NOT EXISTS "passId" uuid,
        ADD COLUMN IF NOT EXISTS "passVisitCharged" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "meetingFormat" varchar(16),
        ADD COLUMN IF NOT EXISTS "meetingUrl" text,
        ADD COLUMN IF NOT EXISTS "sessionSummary" text,
        ADD COLUMN IF NOT EXISTS "followUpAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "units" integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "depositAmount" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "depositStatus" varchar(16) NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS "issuedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "returnedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "conditionOut" text,
        ADD COLUMN IF NOT EXISTS "conditionIn" text,
        ADD COLUMN IF NOT EXISTS "lateFee" numeric(14,2)
    `);
    await q.query(`ALTER TABLE "booking_waitlist_entries" ADD COLUMN IF NOT EXISTS "classSessionId" uuid`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_reservations_tenant_class" ON "reservations" ("tenantId", "classSessionId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_reservations_tenant_pass" ON "reservations" ("tenantId", "passId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "booking_zones" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "projectId" uuid NOT NULL,
        "locationId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "color" varchar(16),
        "width" integer NOT NULL DEFAULT 1000,
        "height" integer NOT NULL DEFAULT 640,
        "decor" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_zones_tenant_loc" ON "booking_zones" ("tenantId", "locationId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "booking_menu_categories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "projectId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_menu_categories_tenant" ON "booking_menu_categories" ("tenantId", "projectId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "booking_menu_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "projectId" uuid NOT NULL,
        "categoryId" uuid,
        "name" varchar(255) NOT NULL,
        "description" text,
        "price" numeric(14,2) NOT NULL DEFAULT 0,
        "currency" char(3) NOT NULL DEFAULT 'RUB',
        "portion" varchar(60),
        "tags" text[] NOT NULL DEFAULT '{}',
        "imageUrl" text,
        "prepMinutes" integer,
        "available" boolean NOT NULL DEFAULT true,
        "active" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_menu_items_tenant" ON "booking_menu_items" ("tenantId", "projectId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_menu_items_cat" ON "booking_menu_items" ("tenantId", "categoryId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "booking_orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "projectId" uuid NOT NULL,
        "number" integer NOT NULL,
        "kind" varchar(16) NOT NULL DEFAULT 'reservation',
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "locationId" uuid,
        "reservationId" uuid,
        "resourceId" uuid,
        "passId" uuid,
        "contactId" uuid,
        "leadId" uuid,
        "customerName" varchar(255),
        "customerPhone" varchar(64),
        "customerEmail" varchar(255),
        "guests" integer NOT NULL DEFAULT 1,
        "staffUserId" uuid,
        "currency" char(3) NOT NULL DEFAULT 'RUB',
        "subtotal" numeric(14,2) NOT NULL DEFAULT 0,
        "discountPercent" numeric(6,2) NOT NULL DEFAULT 0,
        "discountAmount" numeric(14,2) NOT NULL DEFAULT 0,
        "serviceChargePercent" numeric(6,2) NOT NULL DEFAULT 0,
        "serviceChargeAmount" numeric(14,2) NOT NULL DEFAULT 0,
        "tipAmount" numeric(14,2) NOT NULL DEFAULT 0,
        "total" numeric(14,2) NOT NULL DEFAULT 0,
        "paidAmount" numeric(14,2) NOT NULL DEFAULT 0,
        "paymentMethod" varchar(16),
        "saleId" uuid,
        "paymentUrl" text,
        "notes" text,
        "billedAt" timestamptz,
        "paidAt" timestamptz,
        "createdByStaffUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_booking_orders_tenant_number" ON "booking_orders" ("tenantId", "number")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_orders_status" ON "booking_orders" ("tenantId", "status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_orders_res" ON "booking_orders" ("tenantId", "reservationId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_orders_resource" ON "booking_orders" ("tenantId", "resourceId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_orders_created" ON "booking_orders" ("tenantId", "createdAt")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "booking_order_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "orderId" uuid NOT NULL REFERENCES "booking_orders"("id") ON DELETE CASCADE,
        "kind" varchar(16) NOT NULL DEFAULT 'custom',
        "refId" uuid,
        "name" varchar(255) NOT NULL,
        "unitPrice" numeric(14,2) NOT NULL DEFAULT 0,
        "qty" numeric(10,2) NOT NULL DEFAULT 1,
        "status" varchar(16) NOT NULL DEFAULT 'new',
        "course" integer,
        "note" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_order_items_order" ON "booking_order_items" ("tenantId", "orderId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "booking_class_sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "projectId" uuid NOT NULL,
        "locationId" uuid NOT NULL,
        "serviceId" uuid NOT NULL,
        "staffUserId" uuid,
        "resourceId" uuid,
        "startAt" timestamptz NOT NULL,
        "endAt" timestamptz NOT NULL,
        "capacity" integer NOT NULL DEFAULT 10,
        "price" numeric(14,2),
        "status" varchar(16) NOT NULL DEFAULT 'scheduled',
        "seriesId" uuid,
        "level" varchar(16),
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_class_sessions_start" ON "booking_class_sessions" ("tenantId", "startAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_class_sessions_series" ON "booking_class_sessions" ("tenantId", "seriesId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "booking_pass_plans" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "projectId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "kind" varchar(16) NOT NULL DEFAULT 'visits',
        "visits" integer,
        "validityDays" integer NOT NULL DEFAULT 30,
        "price" numeric(14,2) NOT NULL DEFAULT 0,
        "currency" char(3) NOT NULL DEFAULT 'RUB',
        "serviceIds" uuid[] NOT NULL DEFAULT '{}',
        "freezeDaysAllowed" integer NOT NULL DEFAULT 0,
        "color" varchar(16),
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_pass_plans_tenant" ON "booking_pass_plans" ("tenantId", "projectId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "booking_passes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "projectId" uuid NOT NULL,
        "planId" uuid NOT NULL,
        "number" integer NOT NULL,
        "contactId" uuid,
        "leadId" uuid,
        "customerName" varchar(255),
        "customerPhone" varchar(64),
        "customerEmail" varchar(255),
        "planName" varchar(255) NOT NULL,
        "kind" varchar(16) NOT NULL DEFAULT 'visits',
        "visitsTotal" integer,
        "visitsUsed" integer NOT NULL DEFAULT 0,
        "serviceIds" uuid[] NOT NULL DEFAULT '{}',
        "startsAt" date NOT NULL,
        "expiresAt" date NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "frozenFrom" date,
        "freezeDaysUsed" integer NOT NULL DEFAULT 0,
        "freezeDaysAllowed" integer NOT NULL DEFAULT 0,
        "price" numeric(14,2) NOT NULL DEFAULT 0,
        "currency" char(3) NOT NULL DEFAULT 'RUB',
        "orderId" uuid,
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_booking_passes_tenant_number" ON "booking_passes" ("tenantId", "number")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_passes_contact" ON "booking_passes" ("tenantId", "contactId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_booking_passes_status" ON "booking_passes" ("tenantId", "status")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['booking_passes', 'booking_pass_plans', 'booking_class_sessions', 'booking_order_items', 'booking_orders', 'booking_menu_items', 'booking_menu_categories', 'booking_zones']) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
    await q.query(`ALTER TABLE "booking_waitlist_entries" DROP COLUMN IF EXISTS "classSessionId"`);
    await q.query(`ALTER TABLE "reservations" DROP COLUMN IF EXISTS "classSessionId", DROP COLUMN IF EXISTS "passId", DROP COLUMN IF EXISTS "passVisitCharged", DROP COLUMN IF EXISTS "meetingFormat", DROP COLUMN IF EXISTS "meetingUrl", DROP COLUMN IF EXISTS "sessionSummary", DROP COLUMN IF EXISTS "followUpAt", DROP COLUMN IF EXISTS "units", DROP COLUMN IF EXISTS "depositAmount", DROP COLUMN IF EXISTS "depositStatus", DROP COLUMN IF EXISTS "issuedAt", DROP COLUMN IF EXISTS "returnedAt", DROP COLUMN IF EXISTS "conditionOut", DROP COLUMN IF EXISTS "conditionIn", DROP COLUMN IF EXISTS "lateFee"`);
    await q.query(`ALTER TABLE "booking_resources" DROP COLUMN IF EXISTS "description", DROP COLUMN IF EXISTS "zoneId", DROP COLUMN IF EXISTS "shape", DROP COLUMN IF EXISTS "posX", DROP COLUMN IF EXISTS "posY", DROP COLUMN IF EXISTS "width", DROP COLUMN IF EXISTS "height", DROP COLUMN IF EXISTS "rotation", DROP COLUMN IF EXISTS "minCapacity", DROP COLUMN IF EXISTS "pricePerHour", DROP COLUMN IF EXISTS "pricePerDay", DROP COLUMN IF EXISTS "depositAmount", DROP COLUMN IF EXISTS "sku"`);
    await q.query(`ALTER TABLE "booking_projects" DROP COLUMN IF EXISTS "verticalSettings"`);
  }
}
