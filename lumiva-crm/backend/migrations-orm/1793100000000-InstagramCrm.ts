import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Instagram: директ и комментарии → лиды. Аккаунт подключается через платформенное Meta-приложение
 * (Facebook Login → страница с Instagram Business), токен страницы бессрочный.
 */
export class InstagramCrm1793100000000 implements MigrationInterface {
  name = 'InstagramCrm1793100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "instagram_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "igUserId" varchar(64) NOT NULL,
        "igUsername" varchar(255),
        "profilePictureUrl" text,
        "pageId" varchar(64) NOT NULL,
        "pageName" varchar(255),
        "pageAccessToken" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "lastError" text,
        "lastEventAt" timestamptz,
        "healthNotifiedAt" timestamptz,
        "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_instagram_accounts_tenant_ig" ON "instagram_accounts" ("tenantId", "igUserId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_instagram_accounts_ig" ON "instagram_accounts" ("igUserId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "instagram_contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "accountId" uuid NOT NULL REFERENCES "instagram_accounts"("id") ON DELETE CASCADE,
        "igsid" varchar(64),
        "username" varchar(255),
        "name" varchar(255),
        "profilePic" text,
        "contactId" uuid,
        "companyId" uuid,
        "leadId" uuid,
        "meta" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_instagram_contacts_account_igsid" ON "instagram_contacts" ("accountId", "igsid") WHERE "igsid" IS NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_instagram_contacts_account_username" ON "instagram_contacts" ("accountId", lower("username")) WHERE "igsid" IS NULL AND "username" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_instagram_contacts_lead" ON "instagram_contacts" ("tenantId", "leadId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "instagram_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "accountId" uuid NOT NULL REFERENCES "instagram_accounts"("id") ON DELETE CASCADE,
        "contactId" uuid NOT NULL REFERENCES "instagram_contacts"("id") ON DELETE CASCADE,
        "kind" varchar(16) NOT NULL DEFAULT 'dm',
        "externalId" varchar(255),
        "direction" varchar(16) NOT NULL,
        "text" text,
        "attachments" jsonb,
        "mediaId" varchar(64),
        "mediaPermalink" text,
        "date" timestamptz NOT NULL DEFAULT now(),
        "isRead" boolean NOT NULL DEFAULT false,
        "rawData" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_instagram_messages_tenant_external" ON "instagram_messages" ("tenantId", "externalId") WHERE "externalId" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_instagram_messages_contact_date" ON "instagram_messages" ("contactId", "date")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "instagram_messages"`);
    await q.query(`DROP TABLE IF EXISTS "instagram_contacts"`);
    await q.query(`DROP TABLE IF EXISTS "instagram_accounts"`);
  }
}
