import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * «Медиа»: папки с фото/видео/PDF (по отелям или общие), публичные ссылки на подборки
 * (пароль, срок, форма-гейт → лид), посетители ссылок и журнал событий для аналитики.
 */
export class Media1793300000000 implements MigrationInterface {
  name = 'Media1793300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "media_folders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "hotelId" uuid REFERENCES "hotels"("id") ON DELETE SET NULL,
        "parentId" uuid REFERENCES "media_folders"("id") ON DELETE CASCADE,
        "name" varchar(200) NOT NULL,
        "createdByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_media_folders_tenant" ON "media_folders" ("tenantId", "parentId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "media_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "folderId" uuid NOT NULL REFERENCES "media_folders"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "ext" varchar(16) NOT NULL DEFAULT '',
        "mime" varchar(128) NOT NULL,
        "kind" varchar(16) NOT NULL,
        "sizeBytes" bigint NOT NULL DEFAULT 0,
        "width" integer,
        "height" integer,
        "durationSec" integer,
        "storagePath" varchar(512) NOT NULL,
        "thumbPath" varchar(512),
        "downloads" integer NOT NULL DEFAULT 0,
        "lastDownloadAt" timestamptz,
        "lastDownloadBy" varchar(255),
        "createdByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_media_files_folder" ON "media_files" ("tenantId", "folderId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "media_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" varchar(200) NOT NULL,
        "slug" varchar(80) NOT NULL,
        "scope" varchar(16) NOT NULL DEFAULT 'hotel',
        "hotelIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "folderIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "fileIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "title" varchar(200),
        "description" text,
        "gate" boolean NOT NULL DEFAULT true,
        "allowZip" boolean NOT NULL DEFAULT true,
        "passwordHash" varchar(100),
        "expiresAt" timestamptz,
        "enabled" boolean NOT NULL DEFAULT true,
        "assigneeStaffId" uuid,
        "createdByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_media_links_slug" ON "media_links" ("slug")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_media_links_tenant" ON "media_links" ("tenantId")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "media_visitors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "token" varchar(64) NOT NULL,
        "formData" jsonb,
        "name" varchar(255),
        "email" varchar(255),
        "phone" varchar(64),
        "company" varchar(255),
        "role" varchar(128),
        "leadId" uuid,
        "contactId" uuid,
        "formAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "lastSeenAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_media_visitors_token" ON "media_visitors" ("tenantId", "token")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "media_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "linkId" uuid NOT NULL REFERENCES "media_links"("id") ON DELETE CASCADE,
        "visitorId" uuid REFERENCES "media_visitors"("id") ON DELETE SET NULL,
        "type" varchar(16) NOT NULL,
        "folderId" uuid,
        "fileIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "filesCount" integer NOT NULL DEFAULT 0,
        "bytes" bigint NOT NULL DEFAULT 0,
        "what" varchar(300),
        "zip" boolean NOT NULL DEFAULT false,
        "ip" varchar(64),
        "userAgent" varchar(300),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_media_events_link" ON "media_events" ("tenantId", "linkId", "createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_media_events_tenant_time" ON "media_events" ("tenantId", "createdAt")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "media_settings" (
        "tenantId" uuid PRIMARY KEY REFERENCES "tenants"("id") ON DELETE CASCADE,
        "formTitle" varchar(200),
        "formFields" jsonb,
        "leadStatus" varchar(32) NOT NULL DEFAULT 'new',
        "assigneeStaffId" uuid,
        "contactTags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "reaskDays" integer NOT NULL DEFAULT 30,
        "dedupe" varchar(16) NOT NULL DEFAULT 'merge',
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "media_uploads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "folderId" uuid NOT NULL REFERENCES "media_folders"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "mime" varchar(128) NOT NULL,
        "sizeBytes" bigint NOT NULL,
        "receivedBytes" bigint NOT NULL DEFAULT 0,
        "tmpPath" varchar(512) NOT NULL,
        "createdByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "media_uploads"`);
    await q.query(`DROP TABLE IF EXISTS "media_settings"`);
    await q.query(`DROP TABLE IF EXISTS "media_events"`);
    await q.query(`DROP TABLE IF EXISTS "media_visitors"`);
    await q.query(`DROP TABLE IF EXISTS "media_links"`);
    await q.query(`DROP TABLE IF EXISTS "media_files"`);
    await q.query(`DROP TABLE IF EXISTS "media_folders"`);
  }
}
