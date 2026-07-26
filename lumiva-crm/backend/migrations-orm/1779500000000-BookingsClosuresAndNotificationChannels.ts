import { MigrationInterface, QueryRunner } from 'typeorm';

/** "Бронирования" — особые даты локаций + матрица каналов уведомлений проекта. */
export class BookingsClosuresAndNotificationChannels1779500000000
  implements MigrationInterface
{
  name = 'BookingsClosuresAndNotificationChannels1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "booking_locations"
        ADD COLUMN IF NOT EXISTS "closures" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "booking_projects"
        ADD COLUMN IF NOT EXISTS "notificationChannels" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "booking_projects" DROP COLUMN IF EXISTS "notificationChannels"`);
    await queryRunner.query(`ALTER TABLE "booking_locations" DROP COLUMN IF EXISTS "closures"`);
  }
}
