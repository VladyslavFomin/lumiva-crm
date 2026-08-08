import { MigrationInterface, QueryRunner } from 'typeorm';
import { ESIGN_DEFAULT_TEMPLATES } from '../src/esign/esign-default-templates';

/** Backfills 6 starter templates (matching the original claude.ai/design mockup) for any
 * tenant that currently has zero esign_templates rows — otherwise a fresh tenant's "Подпись
 * документов" page shows an empty template gallery, which read as "no templates" / a bare
 * feature even though template CRUD itself was already built. Skips tenants that already
 * created their own templates (NOT EXISTS guard), so this never overwrites real data.
 * New tenants going forward get these via EsignService.seedDefaultTemplates() on signup. */
export class EsignDefaultTemplates1782300000000 implements MigrationInterface {
  name = 'EsignDefaultTemplates1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT t.id FROM "tenants" t WHERE NOT EXISTS (SELECT 1 FROM "esign_templates" et WHERE et."tenantId" = t.id)`,
    );
    for (const tenant of tenants) {
      for (const tpl of ESIGN_DEFAULT_TEMPLATES) {
        await queryRunner.query(
          `INSERT INTO "esign_templates" ("id", "tenantId", "name", "description", "kind", "bodyTemplate")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
          [tenant.id, tpl.name, tpl.description, tpl.kind, tpl.bodyTemplate],
        );
      }
    }
  }

  public async down(): Promise<void> {
    // Intentionally a no-op — these are seeded starter templates a tenant may have since
    // edited or relied on; reverting the migration shouldn't delete potentially-modified data.
  }
}
