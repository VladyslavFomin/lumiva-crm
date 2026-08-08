import { MigrationInterface, QueryRunner } from 'typeorm';

/** Not every logged-in User has a StaffUser row (e.g. this repo's own demo tenant owner
 * doesn't) — requesterStaffId alone was too fragile to identify who filed an internal
 * helpdesk request. Adds requesterUserId (always available, from the JWT) plus a
 * name/department SNAPSHOT captured at creation time, matching how HelpdeskTicketMessage
 * already stores authorName as plain text rather than a live join. */
export class HelpdeskRequesterSnapshot1782200000000 implements MigrationInterface {
  name = 'HelpdeskRequesterSnapshot1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "helpdesk_tickets"
        ADD COLUMN IF NOT EXISTS "requesterUserId" uuid,
        ADD COLUMN IF NOT EXISTS "requesterName" varchar(255),
        ADD COLUMN IF NOT EXISTS "requesterDepartment" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "helpdesk_tickets"
        DROP COLUMN IF EXISTS "requesterUserId",
        DROP COLUMN IF EXISTS "requesterName",
        DROP COLUMN IF EXISTS "requesterDepartment"
    `);
  }
}
