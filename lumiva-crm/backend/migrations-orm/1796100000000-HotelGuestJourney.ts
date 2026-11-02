import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Путь гостя в автоматизациях: журнал «уже отправлено этой брони» и опрос гостя (/fb/:token).
 * Авторассылка онлайн-регистрации из кода (hotels.precheckinAutoDays) заменена автоматизацией — колонка остаётся
 * для отката, но больше не читается.
 */
export class HotelGuestJourney1796100000000 implements MigrationInterface {
  name = 'HotelGuestJourney1796100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_journey_sends" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "automationId" uuid NOT NULL REFERENCES "automations"("id") ON DELETE CASCADE,
      "reservationId" uuid NOT NULL REFERENCES "hotel_reservations"("id") ON DELETE CASCADE,
      "triggerEvent" varchar(60) NOT NULL,
      "executionId" uuid NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_journey_sends_once" ON "hotel_journey_sends" ("automationId", "reservationId")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "hotel_guest_feedback" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
      "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
      "reservationId" uuid NOT NULL REFERENCES "hotel_reservations"("id") ON DELETE CASCADE,
      "token" varchar(48) NOT NULL,
      "stage" varchar(12) NOT NULL DEFAULT 'other',
      "automationId" uuid NULL,
      "score" smallint NULL,
      "comment" text NULL,
      "openedAt" timestamptz NULL,
      "answeredAt" timestamptz NULL,
      "reviewPlatform" varchar(24) NULL,
      "reviewClickedAt" timestamptz NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_guest_feedback_token" ON "hotel_guest_feedback" ("token")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_hotel_guest_feedback_hotel" ON "hotel_guest_feedback" ("tenantId", "hotelId", "createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "hotel_guest_feedback"`);
    await q.query(`DROP TABLE IF EXISTS "hotel_journey_sends"`);
  }
}
