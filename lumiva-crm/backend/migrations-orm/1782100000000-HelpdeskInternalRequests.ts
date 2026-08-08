import { MigrationInterface, QueryRunner } from 'typeorm';

/** Internal helpdesk requests — any staff member (not just external clients) can raise a
 * ticket to support, e.g. via the "Создать заявку" button in the notifications panel.
 * requesterStaffId identifies the requesting employee; channel gets a new 'internal' value
 * so replies don't try to dispatch through an external channel (they notify the requester instead). */
export class HelpdeskInternalRequests1782100000000 implements MigrationInterface {
  name = 'HelpdeskInternalRequests1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "helpdesk_tickets"
        ADD COLUMN IF NOT EXISTS "requesterStaffId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_helpdesk_tickets_requester" ON "helpdesk_tickets" ("tenantId", "requesterStaffId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_helpdesk_tickets_requester"`);
    await queryRunner.query(`ALTER TABLE "helpdesk_tickets" DROP COLUMN IF EXISTS "requesterStaffId"`);
  }
}
