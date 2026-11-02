import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type MigrationSource = 'amocrm' | 'bitrix24' | 'file';
export type MigrationCounter = { created: number; updated: number; skipped: number; failed: number };

@Entity('crm_migration_runs')
export class CrmMigrationRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 16 })
  source: MigrationSource;

  /** running / done / failed */
  @Column({ type: 'varchar', length: 16, default: 'running' })
  status: string;

  /** Что переносится сейчас: companies / contacts / leads / deals */
  @Column({ type: 'varchar', length: 32, nullable: true })
  stage: string | null;

  /** Что выбрали в мастере (без токенов) */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  options: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  counters: Record<string, MigrationCounter>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  warnings: string[];

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
