import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Три пункта из «что дальше» по модулю Товары (2026-07-11, после закрытия §13):
 * 1) привязка товаров к сайтам тенанта (`Site`) для мультисайтовой раздачи;
 * 2) исходящие вебхуки при изменениях товара;
 * 3) модерация публикации в публичный каталог (запрос → подтверждение).
 * Фиды (Google/WooCommerce/JSON) не требуют своей схемы — читают то же самое.
 */
export class ProductsSitesWebhooksModeration1779000000000 implements MigrationInterface {
  name = 'ProductsSitesWebhooksModeration1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "siteIds" jsonb,
        ADD COLUMN IF NOT EXISTS "publicationRequestedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "publicationRequestedBy" uuid,
        ADD COLUMN IF NOT EXISTS "publicationApprovedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "publicationApprovedBy" uuid,
        ADD COLUMN IF NOT EXISTS "publicationRejectedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "publicationRejectionReason" varchar(500)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_tenant_publication_requested"
        ON "products" ("tenantId", "publicationRequestedAt")
        WHERE "publicationRequestedAt" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_webhooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "siteId" uuid,
        "name" varchar(255) NOT NULL,
        "url" varchar(2048) NOT NULL,
        "secret" varchar(128) NOT NULL,
        "events" jsonb NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastTriggeredAt" timestamptz,
        "lastStatusCode" integer,
        "lastError" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_webhooks_tenant_active"
        ON "product_webhooks" ("tenantId", "isActive")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_webhooks"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_tenant_publication_requested"`);
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "publicationRejectionReason",
        DROP COLUMN IF EXISTS "publicationRejectedAt",
        DROP COLUMN IF EXISTS "publicationApprovedBy",
        DROP COLUMN IF EXISTS "publicationApprovedAt",
        DROP COLUMN IF EXISTS "publicationRequestedBy",
        DROP COLUMN IF EXISTS "publicationRequestedAt",
        DROP COLUMN IF EXISTS "siteIds"
    `);
  }
}
