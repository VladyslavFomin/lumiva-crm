import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Состояние подключений: у маркетинговых интеграций (Meta Ads, GA4, Google Ads, Метрика, Директ, VK)
 * раньше не было ни последней синхронизации, ни ошибки — сбой ночного синка видели только в логах.
 * failingSince — начало текущей серии ошибок, healthNotifiedAt — владельцу уже написали об этой серии.
 */
export class IntegrationHealth1793000000000 implements MigrationInterface {
  name = 'IntegrationHealth1793000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "marketing_integrations"
        ADD COLUMN IF NOT EXISTS "lastSyncAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "lastSyncStatus" varchar(16) NOT NULL DEFAULT 'never',
        ADD COLUMN IF NOT EXISTS "lastError" text,
        ADD COLUMN IF NOT EXISTS "lastSyncRows" integer,
        ADD COLUMN IF NOT EXISTS "failingSince" timestamptz,
        ADD COLUMN IF NOT EXISTS "healthNotifiedAt" timestamptz
    `);
    await q.query(`ALTER TABLE "integration_connections" ADD COLUMN IF NOT EXISTS "healthNotifiedAt" timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "integration_connections" DROP COLUMN IF EXISTS "healthNotifiedAt"`);
    await q.query(`
      ALTER TABLE "marketing_integrations"
        DROP COLUMN IF EXISTS "healthNotifiedAt",
        DROP COLUMN IF EXISTS "failingSince",
        DROP COLUMN IF EXISTS "lastSyncRows",
        DROP COLUMN IF EXISTS "lastError",
        DROP COLUMN IF EXISTS "lastSyncStatus",
        DROP COLUMN IF EXISTS "lastSyncAt"
    `);
  }
}
