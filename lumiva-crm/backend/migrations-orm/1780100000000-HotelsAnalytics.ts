import { MigrationInterface, QueryRunner } from 'typeorm';

/** Hotel Analytics: season revenue target + risk thresholds on Hotel, plus a per-hotel
 * configurable pacing target curve (% of inventory that should be sold by N days before
 * arrival). */
export class HotelsAnalytics1780100000000 implements MigrationInterface {
  name = 'HotelsAnalytics1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels"
        ADD COLUMN IF NOT EXISTS "seasonRevenueTarget" numeric(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "riskThresholdBadPct" numeric(5,2),
        ADD COLUMN IF NOT EXISTS "riskThresholdWarnPct" numeric(5,2)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hotel_season_pacing_targets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "hotelId" uuid NOT NULL REFERENCES "hotels"("id") ON DELETE CASCADE,
        "daysBeforeArrival" integer NOT NULL,
        "targetPct" numeric(5,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hotel_season_pacing_targets_tenant_hotel"
        ON "hotel_season_pacing_targets" ("tenantId", "hotelId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hotel_season_pacing_targets_hotel_bucket"
        ON "hotel_season_pacing_targets" ("hotelId", "daysBeforeArrival")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel_season_pacing_targets"`);
    await queryRunner.query(`
      ALTER TABLE "hotels"
        DROP COLUMN IF EXISTS "riskThresholdWarnPct",
        DROP COLUMN IF EXISTS "riskThresholdBadPct",
        DROP COLUMN IF EXISTS "seasonRevenueTarget"
    `);
  }
}
