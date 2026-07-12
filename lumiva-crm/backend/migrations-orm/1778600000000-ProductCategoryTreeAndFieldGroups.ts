import { MigrationInterface, QueryRunner } from 'typeorm';

/** Категории-дерево (color/parentId) + группы доп. полей (group/showInFilters) — премиальный редизайн. */
export class ProductCategoryTreeAndFieldGroups1778600000000 implements MigrationInterface {
  name = 'ProductCategoryTreeAndFieldGroups1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_categories"
        ADD COLUMN IF NOT EXISTS "parentId" uuid,
        ADD COLUMN IF NOT EXISTS "color" varchar(20) NOT NULL DEFAULT '#222222'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_categories_tenant_parent"
        ON "product_categories" ("tenantId", "parentId")
    `);

    await queryRunner.query(`
      ALTER TABLE "product_field_defs"
        ADD COLUMN IF NOT EXISTS "group" varchar(120),
        ADD COLUMN IF NOT EXISTS "showInFilters" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_field_defs" DROP COLUMN IF EXISTS "showInFilters"`);
    await queryRunner.query(`ALTER TABLE "product_field_defs" DROP COLUMN IF EXISTS "group"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_categories_tenant_parent"`);
    await queryRunner.query(`ALTER TABLE "product_categories" DROP COLUMN IF EXISTS "color"`);
    await queryRunner.query(`ALTER TABLE "product_categories" DROP COLUMN IF EXISTS "parentId"`);
  }
}
