import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds createdByUserId to custom_object_records — backs the new own_rows_only workspace-area
 * role (needs to know which rows are "mine"). No FK to staff_users: a record shouldn't become
 * unreadable/orphaned if the creating staff member is later deleted. Existing rows stay NULL —
 * they predate per-row ownership and are treated as "nobody's row" (own_rows_only can't edit
 * them, matching the conservative default for a newly-enforced permission). */
export class CustomObjectRecordCreatedBy1783500000000 implements MigrationInterface {
  name = 'CustomObjectRecordCreatedBy1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "custom_object_records" ADD COLUMN IF NOT EXISTS "createdByUserId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "custom_object_records" DROP COLUMN IF EXISTS "createdByUserId"`);
  }
}
