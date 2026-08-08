import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Персистентный Stripe Customer на тенанта — нужен, чтобы Checkout-сессии и
 * Stripe Customer Portal (управление способами оплаты) ссылались на один и тот же
 * объект в Stripe, а не создавали анонимные разовые платежи без привязки к клиенту.
 */
export class TenantStripeCustomerId1779200000000 implements MigrationInterface {
  name = 'TenantStripeCustomerId1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "stripeCustomerId" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "stripeCustomerId"
    `);
  }
}
