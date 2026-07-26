import { MigrationInterface, QueryRunner } from 'typeorm';

/** Import sessions for Hotels reservations + daily pricing (additive, mirrors
 * ReservationImportSession from the Bookings module). */
export class HotelsImportSessions1779800000000 implements MigrationInterface {
  name = 'HotelsImportSessions1779800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_reservation_import_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "originalFileName" varchar(255),
        "columns" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rows" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sample" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "totalRows" integer NOT NULL DEFAULT 0,
        "suggestedMapping" jsonb,
        "status" varchar(30) NOT NULL DEFAULT 'preview',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_pricing_import_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "originalFileName" varchar(255),
        "columns" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rows" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sample" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "totalRows" integer NOT NULL DEFAULT 0,
        "suggestedMapping" jsonb,
        "status" varchar(30) NOT NULL DEFAULT 'preview',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_pricing_import_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_reservation_import_sessions"`);
  }
}
