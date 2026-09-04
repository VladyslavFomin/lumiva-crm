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
export type DuplicatePairStatus = 'pending' | 'merged' | 'ignored' | 'undone';

/** Full pre-merge state, captured only for entity types that support soft-delete (contact/lead/
 * company — see MissingDeleteDateColumnError note on those entities) — the only ones a merge can
 * actually be undone for. sale/segment merges are a hard delete and cannot be undone. */
export interface DuplicateMergeSnapshot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  winnerBefore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loserRow: any;
}

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

  /** Какие правила совпали — 'email' | 'phone' | 'name' | 'fuzzy_name' | 'company' | ... */
  @Column({ type: 'text', array: true, nullable: true })
  reasons: string[] | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: DuplicatePairStatus;

  /** Записывается при объединении (только для contact/lead/company) — позволяет по-настоящему
   * отменить объединение, а не просто пометить статус. */
  @Column({ type: 'jsonb', nullable: true })
  snapshot: DuplicateMergeSnapshot | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
