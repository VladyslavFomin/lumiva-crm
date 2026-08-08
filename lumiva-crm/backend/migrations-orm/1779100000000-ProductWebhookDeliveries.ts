import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Журнал доставки вебхуков товаров + состояние ретраев при недоступности сайта
 * (lumiva_products_module_roadmap.md §16 «Ретраи вебхуков»).
 */
export class ProductWebhookDeliveries1779100000000 implements MigrationInterface {
  name = 'ProductWebhookDeliveries1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_webhook_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "webhookId" uuid NOT NULL,
        "event" varchar(40) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "attempt" integer NOT NULL DEFAULT 0,
        "maxAttempts" integer NOT NULL DEFAULT 5,
        "nextAttemptAt" timestamptz NOT NULL,
        "lastStatusCode" integer,
        "lastError" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_webhook_deliveries_tenant_webhook_created"
        ON "product_webhook_deliveries" ("tenantId", "webhookId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_webhook_deliveries_status_next"
        ON "product_webhook_deliveries" ("status", "nextAttemptAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_webhook_deliveries"`);
  }
}
