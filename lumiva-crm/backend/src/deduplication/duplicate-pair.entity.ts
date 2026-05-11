import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type DedupEntityType = 'contact' | 'lead' | 'company' | 'sale' | 'segment';
export type DuplicatePairStatus = 'pending' | 'merged' | 'ignored';

@Entity('duplicate_pairs')
@Unique(['tenantId', 'entityType', 'entityAId', 'entityBId'])
@Index(['tenantId', 'entityType', 'status'])
export class DuplicatePair {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 32 })
  entityType: DedupEntityType;

  @Column({ type: 'uuid' })
  entityAId: string;

  @Column({ type: 'uuid' })
  entityBId: string;

  /** 0–100: процент схожести */
  @Column({ type: 'smallint', default: 0 })
  score: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: DuplicatePairStatus;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
