import { MigrationInterface, QueryRunner } from 'typeorm';

/** "Бронирования" — сессии импорта броней из CSV/Excel (мирроит product_import_sessions). */
export class BookingsReservationImportSessions1779600000000 implements MigrationInterface {
  name = 'BookingsReservationImportSessions1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservation_import_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "originalFileName" varchar(255),
        "columns" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rows" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sample" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "totalRows" integer NOT NULL DEFAULT 0,
        "suggestedMapping" jsonb,
        "status" varchar(30) NOT NULL DEFAULT 'preview',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reservation_import_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservation_import_sessions_tenant"
        ON "reservation_import_sessions" ("tenantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reservation_import_sessions"`);
  }
}
