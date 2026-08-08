import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Удаляет "Шаблоны сообщений" бронирований — функционал перенесён в Автоматизации
 * (send_email/send_telegram/send_notification с токенами {{client_name}}, {{service}}, ...
 * см. ReservationsService.buildNotificationTokens). Таблица не использовалась ни одним
 * тенантом (отправка так и не была подключена), поэтому down() восстанавливает пустую структуру.
 */
export class DropBookingNotificationTemplates1780700000000 implements MigrationInterface {
  name = 'DropBookingNotificationTemplates1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_notification_templates"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_notification_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "projectId" uuid NOT NULL REFERENCES "booking_projects"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "event" varchar(32) NOT NULL,
        "channel" varchar(16) NOT NULL,
        "subject" varchar(255),
        "body" text NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_notification_templates_tenant_project"
        ON "booking_notification_templates" ("tenantId", "projectId")
    `);
  }
}
