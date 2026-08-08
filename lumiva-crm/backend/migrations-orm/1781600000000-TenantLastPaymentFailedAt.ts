import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tracks the last Stripe invoice.payment_failed for a tenant (telephony addon subscription only
 * — the main plan is prepaid one-time Checkout, not a Stripe Subscription, so it never raises
 * invoice events). Surfaced on the new pl1 billing-ops overview. */
export class TenantLastPaymentFailedAt1781600000000 implements MigrationInterface {
  name = 'TenantLastPaymentFailedAt1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "lastPaymentFailedAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "lastPaymentFailedAt"`);
  }
}
