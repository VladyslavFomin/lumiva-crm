import { MigrationInterface, QueryRunner } from 'typeorm';

/** E-signature — own PDF + email-confirmation flow (no external provider like DocuSign, per explicit
 * user choice). A click on the public signing link + timestamp + IP is the recorded consent evidence. */
export class Esign1781800000000 implements MigrationInterface {
  name = 'Esign1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "esign_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "contactId" uuid,
        "createdByUserId" uuid,
        "title" varchar(255) NOT NULL,
        "bodyText" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "draftPdfUrl" varchar(512),
        "signedPdfUrl" varchar(512),
        "signerName" varchar(255),
        "signerEmail" varchar(255),
        "signatureIp" varchar(64),
        "signatureUserAgent" varchar(512),
        "sentAt" timestamptz,
        "signedAt" timestamptz,
        "declinedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_esign_documents_tenant" ON "esign_documents" ("tenantId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "esign_documents"`);
  }
}
