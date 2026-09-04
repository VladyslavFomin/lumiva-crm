import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds deal fields to `leads` for the new Kanban card design: amount/currency (mirrors
 * Project.amount/currency, but defaults currency to TRY per this business's Turkey-first
 * market rather than Project's EUR default) and a lightweight `tasks` checklist (jsonb array
 * of {id,title,done,deadline}) that powers both the card's progress dots and its "next step"
 * row — no separate next-step column, same convention Project uses for its own tasks array.
 * Also indexes lead_activity for the new per-lead comment-count query. */
export class LeadDealFields1783300000000 implements MigrationInterface {
  name = 'LeadDealFields1783300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "amount" numeric(14,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "currency" char(3) NOT NULL DEFAULT 'TRY'
    `);
    await queryRunner.query(`
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "tasks" jsonb
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lead_activity_tenant_lead_type"
        ON "lead_activity" ("tenantId", "leadId", "type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lead_activity_tenant_lead_type"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN IF EXISTS "tasks"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN IF EXISTS "currency"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN IF EXISTS "amount"`);
  }
}
