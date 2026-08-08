import { MigrationInterface, QueryRunner } from 'typeorm';

/** Lets a running automation pause mid-sequence (delay-before-step, or wait for staff approval)
 * and resume later instead of the previous strict run-to-completion-or-error model. Additive only —
 * existing executions/automations that never use `_delayMinutes`/`_requireApproval` on a step behave
 * exactly as before (loop never pauses, these columns stay null). */
export class AutomationExecutionPauseResume1781100000000 implements MigrationInterface {
  name = 'AutomationExecutionPauseResume1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "automation_executions"
        ADD COLUMN IF NOT EXISTS "pausedAtStep" integer,
        ADD COLUMN IF NOT EXISTS "resumeAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "ctxSnapshot" jsonb,
        ADD COLUMN IF NOT EXISTS "approvalDecidedBy" uuid,
        ADD COLUMN IF NOT EXISTS "approvalDecidedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "approvalNote" text
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_automation_executions_resume"
        ON "automation_executions" ("status", "resumeAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_automation_executions_resume"`);
    await queryRunner.query(`
      ALTER TABLE "automation_executions"
        DROP COLUMN IF EXISTS "approvalNote",
        DROP COLUMN IF EXISTS "approvalDecidedAt",
        DROP COLUMN IF EXISTS "approvalDecidedBy",
        DROP COLUMN IF EXISTS "ctxSnapshot",
        DROP COLUMN IF EXISTS "resumeAt",
        DROP COLUMN IF EXISTS "pausedAtStep"
    `);
  }
}
