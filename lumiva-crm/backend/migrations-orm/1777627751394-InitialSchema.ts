import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1777627751394 implements MigrationInterface {
    name = 'InitialSchema1777627751394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "embed_forms" DROP CONSTRAINT "FK_embed_forms_site"`);
        await queryRunner.query(`ALTER TABLE "embed_forms" DROP CONSTRAINT "FK_embed_forms_tenant"`);
        await queryRunner.query(`ALTER TABLE "embed_form_uploads" DROP CONSTRAINT "FK_embed_form_uploads_form"`);
        await queryRunner.query(`ALTER TABLE "embed_form_uploads" DROP CONSTRAINT "FK_embed_form_uploads_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b2f0c1a_embed_forms_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b2f0c1a_embed_forms_site_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b2f0c1a_embed_forms_public_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b2f0c1a_embed_forms_tenant_site"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c3a1b2d_embed_uploads_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c3a1b2d_embed_uploads_tenant_form"`);
        await queryRunner.query(`ALTER TABLE "custom_object_records" ALTER COLUMN "values" SET DEFAULT '{}'::jsonb`);
        await queryRunner.query(`ALTER TABLE "automations" ALTER COLUMN "actions" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "custom_object_import_sessions" ALTER COLUMN "columns" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "custom_object_import_sessions" ALTER COLUMN "rows" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "custom_object_import_sessions" ALTER COLUMN "sample" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`CREATE INDEX "IDX_6928b2fd674eb682c0323b3854" ON "embed_forms" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a49f2b9736110283ee1baea69" ON "embed_forms" ("site_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a14033fa3b06a855345e3bf2e6" ON "embed_forms" ("public_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_92d87c7474884f248b99aff4eb" ON "embed_forms" ("tenant_id", "site_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f7e297714026dcee3c32a8cb84" ON "embed_form_uploads" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_63297a47e86d5de97867dab947" ON "embed_form_uploads" ("tenant_id", "form_id") `);
        await queryRunner.query(`ALTER TABLE "embed_forms" ADD CONSTRAINT "FK_6928b2fd674eb682c0323b38548" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embed_forms" ADD CONSTRAINT "FK_1a49f2b9736110283ee1baea698" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embed_form_uploads" ADD CONSTRAINT "FK_a45e044539374da9e69287acc9d" FOREIGN KEY ("form_id") REFERENCES "embed_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "embed_form_uploads" DROP CONSTRAINT "FK_a45e044539374da9e69287acc9d"`);
        await queryRunner.query(`ALTER TABLE "embed_forms" DROP CONSTRAINT "FK_1a49f2b9736110283ee1baea698"`);
        await queryRunner.query(`ALTER TABLE "embed_forms" DROP CONSTRAINT "FK_6928b2fd674eb682c0323b38548"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63297a47e86d5de97867dab947"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7e297714026dcee3c32a8cb84"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_92d87c7474884f248b99aff4eb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a14033fa3b06a855345e3bf2e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a49f2b9736110283ee1baea69"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6928b2fd674eb682c0323b3854"`);
        await queryRunner.query(`ALTER TABLE "custom_object_import_sessions" ALTER COLUMN "sample" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "custom_object_import_sessions" ALTER COLUMN "rows" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "custom_object_import_sessions" ALTER COLUMN "columns" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "automations" ALTER COLUMN "actions" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "custom_object_records" ALTER COLUMN "values" SET DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "IDX_9c3a1b2d_embed_uploads_tenant_form" ON "embed_form_uploads" ("tenant_id", "form_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c3a1b2d_embed_uploads_tenant" ON "embed_form_uploads" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b2f0c1a_embed_forms_tenant_site" ON "embed_forms" ("tenant_id", "site_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b2f0c1a_embed_forms_public_id" ON "embed_forms" ("public_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b2f0c1a_embed_forms_site_id" ON "embed_forms" ("site_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b2f0c1a_embed_forms_tenant_id" ON "embed_forms" ("tenant_id") `);
        await queryRunner.query(`ALTER TABLE "embed_form_uploads" ADD CONSTRAINT "FK_embed_form_uploads_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embed_form_uploads" ADD CONSTRAINT "FK_embed_form_uploads_form" FOREIGN KEY ("form_id") REFERENCES "embed_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embed_forms" ADD CONSTRAINT "FK_embed_forms_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "embed_forms" ADD CONSTRAINT "FK_embed_forms_site" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
