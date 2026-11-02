import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Внешний ID записи в amoCRM / Битрикс24 → наша запись (компания / контакт / лид). */
@Entity('crm_migration_external_ids')
export class CrmMigrationExternalId {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 16 })
  source: string;

  /** company / contact / lead */
  @Column({ type: 'varchar', length: 16 })
  entityType: string;

  @Column({ type: 'varchar', length: 128 })
  externalId: string;

  @Column({ type: 'uuid' })
  localId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
