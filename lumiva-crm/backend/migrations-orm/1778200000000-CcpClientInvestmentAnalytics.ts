import { MigrationInterface, QueryRunner } from 'typeorm';

export class CcpClientInvestmentAnalytics1778200000000 implements MigrationInterface {
  name = 'CcpClientInvestmentAnalytics1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ccp_clients"
      ADD COLUMN IF NOT EXISTS "investmentStyle" varchar(64) NULL,
      ADD COLUMN IF NOT EXISTS "investmentAnnualPercent" numeric(7, 2) NULL,
      ADD COLUMN IF NOT EXISTS "creditLeverage" numeric(18, 2) NULL,
      ADD COLUMN IF NOT EXISTS "creditRepayMonthlyPercent" numeric(7, 4) NULL,
      ADD COLUMN IF NOT EXISTS "investmentProfitMonthlyPercent" numeric(7, 4) NULL,
      ADD COLUMN IF NOT EXISTS "accountDebitMonthlyPercent" numeric(7, 4) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ccp_clients"
      DROP COLUMN IF EXISTS "accountDebitMonthlyPercent",
      DROP COLUMN IF EXISTS "investmentProfitMonthlyPercent",
      DROP COLUMN IF EXISTS "creditRepayMonthlyPercent",
      DROP COLUMN IF EXISTS "creditLeverage",
      DROP COLUMN IF EXISTS "investmentAnnualPercent",
      DROP COLUMN IF EXISTS "investmentStyle"
    `);
  }
}
