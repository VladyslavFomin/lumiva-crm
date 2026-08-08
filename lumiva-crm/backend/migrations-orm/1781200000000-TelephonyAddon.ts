import { MigrationInterface, QueryRunner } from 'typeorm';

/** Real IP-telephony feature (previously advertised on the public site but not implemented at all —
 * see the roadmap's 🔴 critical section, resolved 2026-08-04 by building this instead of removing
 * the copy). Twilio Voice: click-to-call, recording, Whisper transcription, tags, retention.
 * `telephonyAddonEnabled` is a standalone flag (not part of plan-entitlements/COMPONENT_MIN_PLAN) —
 * it's a paid add-on available on top of any plan, not a tier-included feature. */
export class TelephonyAddon1781200000000 implements MigrationInterface {
  name = 'TelephonyAddon1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "telephonyAddonEnabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        ADD COLUMN IF NOT EXISTS "stripePriceTelephonyAddon" text
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "telephony_configs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL UNIQUE,
        "accountSid" varchar(64),
        "authToken" varchar(128),
        "voiceNumber" varchar(32),
        "forwardToNumbers" text[] NOT NULL DEFAULT '{}',
        "isEnabled" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calls" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "direction" varchar(16) NOT NULL,
        "fromNumber" varchar(32),
        "toNumber" varchar(32),
        "status" varchar(24) NOT NULL DEFAULT 'queued',
        "durationSeconds" integer,
        "twilioCallSid" varchar(64),
        "recordingSid" varchar(64),
        "recordingUrl" text,
        "transcript" text,
        "transcriptStatus" varchar(16),
        "tags" text[] NOT NULL DEFAULT '{}',
        "linkedLeadId" uuid,
        "staffUserId" uuid,
        "startedAt" timestamptz,
        "endedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_calls_tenant_created" ON "calls" ("tenantId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_calls_tenant_callsid" ON "calls" ("tenantId", "twilioCallSid")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_calls_tenant_lead" ON "calls" ("tenantId", "linkedLeadId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calls"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "telephony_configs"`);
    await queryRunner.query(`
      ALTER TABLE "platform_settings" DROP COLUMN IF EXISTS "stripePriceTelephonyAddon"
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "telephonyAddonEnabled"
    `);
  }
}
