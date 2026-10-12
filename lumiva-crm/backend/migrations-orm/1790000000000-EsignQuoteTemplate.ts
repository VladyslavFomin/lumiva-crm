import { MigrationInterface, QueryRunner } from 'typeorm';
import { quoteTemplateFor } from '../src/esign/esign-default-templates';

/** Adds the "Коммерческое предложение" (КП) starter template — in the tenant's interface
 * language — to every existing tenant that doesn't already have a template of that kind.
 * New tenants get it via EsignService.seedDefaultTemplates() on signup. */
export class EsignQuoteTemplate1790000000000 implements MigrationInterface {
  name = 'EsignQuoteTemplate1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string; uiLanguage: string | null }> = await queryRunner.query(
      `SELECT t.id, t."uiLanguage" FROM "tenants" t
       WHERE NOT EXISTS (
         SELECT 1 FROM "esign_templates" et
         WHERE et."tenantId" = t.id AND et."kind" IN ('КП', 'Quote', 'Teklif')
       )`,
    );
    for (const tenant of tenants) {
      const tpl = quoteTemplateFor(tenant.uiLanguage);
      await queryRunner.query(
        `INSERT INTO "esign_templates" ("id", "tenantId", "name", "description", "kind", "bodyTemplate", "fileNamePattern")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        [tenant.id, tpl.name, tpl.description, tpl.kind, tpl.bodyTemplate, tpl.fileNamePattern],
      );
    }
  }

  public async down(): Promise<void> {
    // No-op: a seeded template may since have been edited by the tenant.
  }
}
