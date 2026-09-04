import { MigrationInterface, QueryRunner } from 'typeorm';

/** Turns "Подпись документов" into a full document workflow ("Мои документы"): contract
 * amount + a friendly export file name/size on each document, a {KEY}-based template file
 * name pattern, and a per-tenant org profile ("Наша сторона") used to resolve {ORG_NAME}/
 * {ORG_TAX}/{MANAGER}. Also migrates existing templates from the old {{path}} placeholder
 * syntax (contact.name/email/phone, tenant.name, date) to the new {KEY} catalog. */
export class EsignDocumentWorkflow1786000000000 implements MigrationInterface {
  name = 'EsignDocumentWorkflow1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "esign_documents"
        ADD COLUMN IF NOT EXISTS "amount" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "currency" varchar(8),
        ADD COLUMN IF NOT EXISTS "extraFields" jsonb,
        ADD COLUMN IF NOT EXISTS "fileName" varchar(255),
        ADD COLUMN IF NOT EXISTS "fileSizeBytes" integer,
        ADD COLUMN IF NOT EXISTS "templateId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "esign_templates"
        ADD COLUMN IF NOT EXISTS "fileNamePattern" varchar(255) NOT NULL DEFAULT '{KIND}-{NAME}-{CONTRACT_DATE}'
    `);

    await queryRunner.query(`
      UPDATE "esign_templates" SET "bodyTemplate" = replace(replace(replace(replace(replace(
        "bodyTemplate",
        '{{contact.name}}', '{NAME}'),
        '{{contact.email}}', '{EMAIL}'),
        '{{contact.phone}}', '{PHONE}'),
        '{{tenant.name}}', '{ORG_NAME}'),
        '{{date}}', '{TODAY}')
      WHERE "bodyTemplate" LIKE '%{{%'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "esign_org_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL UNIQUE,
        "orgName" varchar(255),
        "orgTaxId" varchar(255),
        "managerName" varchar(255),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "esign_org_profiles"`);
    await queryRunner.query(`ALTER TABLE "esign_templates" DROP COLUMN IF EXISTS "fileNamePattern"`);
    await queryRunner.query(`
      ALTER TABLE "esign_documents"
        DROP COLUMN IF EXISTS "amount",
        DROP COLUMN IF EXISTS "currency",
        DROP COLUMN IF EXISTS "extraFields",
        DROP COLUMN IF EXISTS "fileName",
        DROP COLUMN IF EXISTS "fileSizeBytes",
        DROP COLUMN IF EXISTS "templateId"
    `);
  }
}
