import { MigrationInterface, QueryRunner } from 'typeorm';

/** Extends esign_documents with the fields needed to port the "Подпись документов" design
 * (kind/type, CRM-entity link, viewed tracking, page count) and adds a reusable template
 * library (esign_templates) so "Создать документ" can start from a saved template. */
export class EsignExtended1781900000000 implements MigrationInterface {
  name = 'EsignExtended1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "esign_documents"
        ADD COLUMN IF NOT EXISTS "kind" varchar(64) NOT NULL DEFAULT 'Договор',
        ADD COLUMN IF NOT EXISTS "entityType" varchar(20),
        ADD COLUMN IF NOT EXISTS "entityId" uuid,
        ADD COLUMN IF NOT EXISTS "viewedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "pageCount" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_esign_documents_entity" ON "esign_documents" ("tenantId", "entityType", "entityId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "esign_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" varchar(500),
        "kind" varchar(64) NOT NULL DEFAULT 'Договор',
        "bodyTemplate" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_esign_templates_tenant" ON "esign_templates" ("tenantId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "esign_templates"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_esign_documents_entity"`);
    await queryRunner.query(`
      ALTER TABLE "esign_documents"
        DROP COLUMN IF EXISTS "kind",
        DROP COLUMN IF EXISTS "entityType",
        DROP COLUMN IF EXISTS "entityId",
        DROP COLUMN IF EXISTS "viewedAt",
        DROP COLUMN IF EXISTS "pageCount"
    `);
  }
}
