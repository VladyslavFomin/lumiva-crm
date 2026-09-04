import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds a `files` jsonb array to crm_projects — replaces the old single
 * briefFileName/briefFileUrl pair with a real list of links (ТЗ, смета, договор и т.д.),
 * each tagged with a provider (google_drive/onedrive/other) for the icon in the UI.
 * briefFileName/briefFileUrl stay untouched for backward compatibility. */
export class ProjectFileLinks1783700000000 implements MigrationInterface {
  name = 'ProjectFileLinks1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "crm_projects" ADD COLUMN IF NOT EXISTS "files" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "crm_projects" DROP COLUMN IF EXISTS "files"`);
  }
}
