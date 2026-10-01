import { MigrationInterface, QueryRunner } from 'typeorm';

/** marketing_traffic.integrationId — из какого подключения пришла строка, чтобы разделять
 * несколько рекламных кабинетов Meta Ads (у всех dataSource = 'meta_ads'). */
export class MarketingTrafficIntegrationId1789000000000 implements MigrationInterface {
  name = 'MarketingTrafficIntegrationId1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "marketing_traffic" ADD COLUMN IF NOT EXISTS "integrationId" uuid`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_traffic_tenant_integration" ON "marketing_traffic" ("tenantId", "integrationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_marketing_traffic_tenant_integration"`);
    await queryRunner.query(`ALTER TABLE "marketing_traffic" DROP COLUMN IF EXISTS "integrationId"`);
  }
}
