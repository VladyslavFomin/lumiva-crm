import { MigrationInterface, QueryRunner } from 'typeorm';

/** КП PDFs now carry the tenant's requisites in a letterhead, so the seeded КП template's
 * closing "{ORG_NAME}, {ORG_TAX}" line is dropped (otherwise a tenant without requisites would
 * get a literal {ORG_TAX} mark). Only touches templates still containing the exact seeded line. */
export class EsignQuoteTemplateNoOrgTax1790100000000 implements MigrationInterface {
  name = 'EsignQuoteTemplateNoOrgTax1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "esign_templates"
       SET "bodyTemplate" = replace("bodyTemplate", E'\\n{ORG_NAME}, {ORG_TAX}', E'\\n{ORG_NAME}')
       WHERE "kind" IN ('КП', 'Quote', 'Teklif') AND "bodyTemplate" LIKE '%{ORG_NAME}, {ORG_TAX}'`,
    );
  }

  public async down(): Promise<void> {
    // No-op.
  }
}
