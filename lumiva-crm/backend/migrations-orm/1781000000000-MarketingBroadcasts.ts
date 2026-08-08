import { MigrationInterface, QueryRunner } from 'typeorm';

/** Real scheduled/multi-step email+SMS broadcast tool. Distinct from `marketing_automation`
 * (n8n webhook triggers) and from `automations` (event-triggered IF/THEN) — this is a time-based
 * send to a fixed audience snapshot, optionally as a linear multi-step drip (delayDays between
 * steps), not conditional/branching. Named "broadcast" rather than "campaign" to avoid colliding
 * with the existing ads-traffic "Campaigns" page (UTM/spend analytics, unrelated concept). */
export class MarketingBroadcasts1781000000000 implements MigrationInterface {
  name = 'MarketingBroadcasts1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_broadcasts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "channel" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "segmentId" uuid,
        "steps" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "fromEmailAccountId" uuid,
        "trackOpens" boolean NOT NULL DEFAULT false,
        "scheduledAt" timestamptz,
        "startedAt" timestamptz,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketing_broadcasts_tenant_status"
        ON "marketing_broadcasts" ("tenantId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_broadcast_recipients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "broadcastId" uuid NOT NULL,
        "leadId" uuid,
        "email" varchar(255),
        "phone" varchar(64),
        "lastStepSent" integer NOT NULL DEFAULT -1,
        "lastSentAt" timestamptz,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "lastError" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketing_broadcast_recipients_broadcast"
        ON "marketing_broadcast_recipients" ("tenantId", "broadcastId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_broadcast_recipients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_broadcasts"`);
  }
}
