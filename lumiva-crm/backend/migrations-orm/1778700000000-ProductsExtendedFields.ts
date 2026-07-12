import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Большой пакет доп. возможностей «Товаров»: SEO, вес/габариты, штрихкод, теги, похожие
 * товары, мультиязычные переводы, скидки/оптовые пороги, комплекты, журнал изменений.
 */
export class ProductsExtendedFields1778700000000 implements MigrationInterface {
  name = 'ProductsExtendedFields1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "slug" varchar(255),
        ADD COLUMN IF NOT EXISTS "metaTitle" varchar(255),
        ADD COLUMN IF NOT EXISTS "metaDescription" varchar(500),
        ADD COLUMN IF NOT EXISTS "weight" numeric(10,3),
        ADD COLUMN IF NOT EXISTS "dimensions" jsonb,
        ADD COLUMN IF NOT EXISTS "barcode" varchar(64),
        ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "relatedProductIds" jsonb,
        ADD COLUMN IF NOT EXISTS "translations" jsonb,
        ADD COLUMN IF NOT EXISTS "salePrice" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "saleStartAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "saleEndAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "priceTiers" jsonb,
        ADD COLUMN IF NOT EXISTS "isBundle" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "bundleItems" jsonb
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_products_tenant_barcode"
        ON "products" ("tenantId", "barcode") WHERE "barcode" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_products_tenant_slug"
        ON "products" ("tenantId", "slug") WHERE "slug" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_change_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "field" varchar(60) NOT NULL,
        "oldValue" text,
        "newValue" text,
        "userId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_change_logs_tenant_product_created"
        ON "product_change_logs" ("tenantId", "productId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_change_logs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_tenant_slug"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_tenant_barcode"`);
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "bundleItems",
        DROP COLUMN IF EXISTS "isBundle",
        DROP COLUMN IF EXISTS "priceTiers",
        DROP COLUMN IF EXISTS "saleEndAt",
        DROP COLUMN IF EXISTS "saleStartAt",
        DROP COLUMN IF EXISTS "salePrice",
        DROP COLUMN IF EXISTS "translations",
        DROP COLUMN IF EXISTS "relatedProductIds",
        DROP COLUMN IF EXISTS "tags",
        DROP COLUMN IF EXISTS "barcode",
        DROP COLUMN IF EXISTS "dimensions",
        DROP COLUMN IF EXISTS "weight",
        DROP COLUMN IF EXISTS "metaDescription",
        DROP COLUMN IF EXISTS "metaTitle",
        DROP COLUMN IF EXISTS "slug"
    `);
  }
}
