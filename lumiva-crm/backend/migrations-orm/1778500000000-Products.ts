import { MigrationInterface, QueryRunner } from 'typeorm';

/** New "Товары" module — see lumiva-crm/md/lumiva_products_module_roadmap.md */
export class Products1778500000000 implements MigrationInterface {
  name = 'Products1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_categories_tenant_slug"
        ON "product_categories" ("tenantId", "slug")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_categories_tenant_active"
        ON "product_categories" ("tenantId", "isActive")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_attributes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "slug" varchar(140) NOT NULL,
        "values" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "order" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_attributes_tenant_slug"
        ON "product_attributes" ("tenantId", "slug")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "sku" varchar(64),
        "name" varchar(255) NOT NULL,
        "description" text,
        "categoryId" uuid REFERENCES "product_categories"("id") ON DELETE SET NULL,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "price" numeric(14,2) NOT NULL DEFAULT 0,
        "costPrice" numeric(14,2),
        "currency" char(3) NOT NULL DEFAULT 'EUR',
        "isVariable" boolean NOT NULL DEFAULT false,
        "variantAttributeIds" jsonb,
        "quantity" integer NOT NULL DEFAULT 0,
        "lowStockThreshold" integer,
        "unit" varchar(32),
        "images" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "externalId" varchar(255),
        "customFields" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_tenant_status" ON "products" ("tenantId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_tenant_category" ON "products" ("tenantId", "categoryId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_tenant_created" ON "products" ("tenantId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_products_tenant_sku"
        ON "products" ("tenantId", "sku") WHERE "sku" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_field_defs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "key" varchar(120) NOT NULL,
        "label" varchar(200) NOT NULL,
        "type" varchar(40) NOT NULL,
        "required" boolean NOT NULL DEFAULT false,
        "options" jsonb,
        "settings" jsonb,
        "width" varchar(3) NOT NULL DEFAULT '100',
        "description" text,
        "order" integer NOT NULL DEFAULT 0,
        "showInList" boolean NOT NULL DEFAULT true,
        "showInQuickEdit" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_field_defs_tenant_key"
        ON "product_field_defs" ("tenantId", "key")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_field_defs_tenant_order"
        ON "product_field_defs" ("tenantId", "order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_variants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "attributeValues" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "sku" varchar(64),
        "quantity" integer NOT NULL DEFAULT 0,
        "priceOverride" numeric(14,2),
        "images" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_variants_tenant_product"
        ON "product_variants" ("tenantId", "productId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variants_tenant_sku"
        ON "product_variants" ("tenantId", "sku") WHERE "sku" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_stock_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "variantId" uuid,
        "type" varchar(20) NOT NULL,
        "quantityDelta" integer NOT NULL,
        "resultingQuantity" integer NOT NULL,
        "reason" text,
        "userId" uuid,
        "source" varchar(40),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_stock_movements_tenant_product_created"
        ON "product_stock_movements" ("tenantId", "productId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_stock_movements_tenant_variant_created"
        ON "product_stock_movements" ("tenantId", "variantId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_import_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "originalFileName" varchar(255),
        "columns" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rows" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sample" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "totalRows" integer NOT NULL DEFAULT 0,
        "suggestedMapping" jsonb,
        "status" varchar(30) NOT NULL DEFAULT 'preview',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_import_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_stock_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_variants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_field_defs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_attributes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_categories"`);
  }
}
