import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Закрывает два открытых вопроса из §13 lumiva_products_module_roadmap.md, решённые с клиентом
 * 2026-07-11: (1) публичная витрина без API-токена — опт-ин флаг на товаре; (2) мультивалютные
 * цены — аддитивный список override-ов, `price`/`currency` остаются основной ценой.
 */
export class ProductsVisibilityAndCurrency1778900000000 implements MigrationInterface {
  name = 'ProductsVisibilityAndCurrency1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "isPubliclyVisible" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "prices" jsonb
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_tenant_publicly_visible"
        ON "products" ("tenantId", "isPubliclyVisible")
        WHERE "isPubliclyVisible" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_tenant_publicly_visible"`);
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "prices",
        DROP COLUMN IF EXISTS "isPubliclyVisible"
    `);
  }
}
