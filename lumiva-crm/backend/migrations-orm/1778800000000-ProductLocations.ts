import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Множественные склады/локации (lumiva_products_module_roadmap.md §12.2). Каждый тенант
 * получает одну дефолтную локацию, и весь текущий остаток (products.quantity /
 * product_variants.quantity) переносится в product_location_stock на неё — существующий код,
 * который читает агрегатные колонки, продолжает работать без изменений.
 */
export class ProductLocations1778800000000 implements MigrationInterface {
  name = 'ProductLocations1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_locations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "code" varchar(32),
        "isDefault" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_locations_tenant_active"
        ON "product_locations" ("tenantId", "isActive")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_location_stock" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "variantId" uuid,
        "locationId" uuid NOT NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_location_stock_tenant_location"
        ON "product_location_stock" ("tenantId", "locationId")
    `);
    // NULL != NULL в обычном unique-индексе Postgres, поэтому уникальность на variantId IS NULL
    // (невариативные товары) и variantId IS NOT NULL (варианты) обеспечивается раздельно.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_location_stock_product_location_uq"
        ON "product_location_stock" ("tenantId", "productId", "locationId")
        WHERE "variantId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_location_stock_variant_location_uq"
        ON "product_location_stock" ("tenantId", "variantId", "locationId")
        WHERE "variantId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "product_stock_movements"
        ADD COLUMN IF NOT EXISTS "locationId" uuid,
        ADD COLUMN IF NOT EXISTS "relatedMovementId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_stock_movements_tenant_location"
        ON "product_stock_movements" ("tenantId", "locationId")
    `);

    // Одна дефолтная локация на тенант.
    await queryRunner.query(`
      INSERT INTO "product_locations" ("tenantId", "name", "code", "isDefault", "isActive")
      SELECT t."id", 'Основной склад', 'MAIN', true, true
      FROM "tenants" t
      WHERE NOT EXISTS (
        SELECT 1 FROM "product_locations" pl WHERE pl."tenantId" = t."id" AND pl."isDefault" = true
      )
    `);

    // Перенос текущего остатка невариативных товаров на дефолтную локацию их тенанта.
    await queryRunner.query(`
      INSERT INTO "product_location_stock" ("tenantId", "productId", "variantId", "locationId", "quantity")
      SELECT p."tenantId", p."id", NULL, pl."id", p."quantity"
      FROM "products" p
      JOIN "product_locations" pl ON pl."tenantId" = p."tenantId" AND pl."isDefault" = true
      WHERE p."isVariable" = false
      ON CONFLICT DO NOTHING
    `);

    // Перенос текущего остатка вариантов на дефолтную локацию тенанта товара-родителя.
    await queryRunner.query(`
      INSERT INTO "product_location_stock" ("tenantId", "productId", "variantId", "locationId", "quantity")
      SELECT v."tenantId", v."productId", v."id", pl."id", v."quantity"
      FROM "product_variants" v
      JOIN "product_locations" pl ON pl."tenantId" = v."tenantId" AND pl."isDefault" = true
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_stock_movements_tenant_location"`);
    await queryRunner.query(`
      ALTER TABLE "product_stock_movements"
        DROP COLUMN IF EXISTS "relatedMovementId",
        DROP COLUMN IF EXISTS "locationId"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_location_stock"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_locations"`);
  }
}
