import { MigrationInterface, QueryRunner } from 'typeorm';

/** Hotel-level bypass for the new availability check in HotelAvailabilityService — mirrors
 * Booking's Project.overbookingAllowed precedent (all-or-nothing at the parent-entity level,
 * no per-request force flag). */
export class HotelOverbookingGuard1782500000000 implements MigrationInterface {
  name = 'HotelOverbookingGuard1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "allowOverbooking" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "allowOverbooking"`);
  }
}
