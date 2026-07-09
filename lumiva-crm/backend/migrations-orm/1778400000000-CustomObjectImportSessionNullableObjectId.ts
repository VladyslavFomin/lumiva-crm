import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets an import session exist before a target table is chosen — the AI chat attaches a
 * spreadsheet, previews it (no objectId yet), and only later "adopts" the session into a
 * table the model just created via crm_workspace_create_table.
 */
export class CustomObjectImportSessionNullableObjectId1778400000000 implements MigrationInterface {
  name = 'CustomObjectImportSessionNullableObjectId1778400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "custom_object_import_sessions"
      ALTER COLUMN "objectId" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "custom_object_import_sessions" WHERE "objectId" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_object_import_sessions"
      ALTER COLUMN "objectId" SET NOT NULL
    `);
  }
}
