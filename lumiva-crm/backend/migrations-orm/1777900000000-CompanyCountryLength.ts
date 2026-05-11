import { MigrationInterface, QueryRunner } from "typeorm";

export class CompanyCountryLength1777900000000 implements MigrationInterface {
  name = 'CompanyCountryLength1777900000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" ALTER COLUMN "country" TYPE character varying(100)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" ALTER COLUMN "country" TYPE character varying(2)`);
  }
}
