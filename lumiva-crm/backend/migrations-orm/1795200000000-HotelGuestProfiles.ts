import { MigrationInterface, QueryRunner } from 'typeorm';

/** Профили гостей отеля + ссылка брони на профиль контакта (гости из состава — guests[].profileId в jsonb) */
export class HotelGuestProfiles1795200000000 implements MigrationInterface {
  name = 'HotelGuestProfiles1795200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_guest_profiles" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "fullName" varchar(200) NOT NULL,
      "email" varchar(200),
      "phone" varchar(40),
      "country" varchar(2),
      "language" varchar(5),
      "birthDate" date,
      "gender" varchar(1),
      "documentType" varchar(12),
      "documentNumber" varchar(40),
      "documentExpiry" date,
      "emailKey" varchar(200),
      "phoneKey" varchar(16),
      "documentKey" varchar(40),
      "nameKey" varchar(200) NOT NULL,
      "vip" boolean NOT NULL DEFAULT false,
      "blacklisted" boolean NOT NULL DEFAULT false,
      "blacklistReason" text,
      "preferences" text[] NOT NULL DEFAULT '{}',
      "allergies" text,
      "notes" text,
      "marketingConsent" boolean NOT NULL DEFAULT false,
      "anonymizedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hgp_tenant" ON "hotel_guest_profiles" ("tenantId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hgp_email" ON "hotel_guest_profiles" ("tenantId", "emailKey")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hgp_phone" ON "hotel_guest_profiles" ("tenantId", "phoneKey")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hgp_doc" ON "hotel_guest_profiles" ("tenantId", "documentKey")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hgp_name" ON "hotel_guest_profiles" ("tenantId", "nameKey")`);
    await q.query(`ALTER TABLE "hotel_reservations" ADD COLUMN IF NOT EXISTS "guestProfileId" uuid REFERENCES "hotel_guest_profiles"("id") ON DELETE SET NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_res_guest_profile" ON "hotel_reservations" ("guestProfileId")`);
    // гости из состава брони: guests @> [{"profileId": …}]
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_res_guests_gin" ON "hotel_reservations" USING gin ("guests" jsonb_path_ops)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_hotel_res_guests_gin"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_hotel_res_guest_profile"`);
    await q.query(`ALTER TABLE "hotel_reservations" DROP COLUMN IF EXISTS "guestProfileId"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_guest_profiles"`);
  }
}
