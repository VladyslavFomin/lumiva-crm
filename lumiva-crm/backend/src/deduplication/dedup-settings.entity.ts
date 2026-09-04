// src/deduplication/dedup-settings.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type DedupMasterRule = 'oldest' | 'newest';

@Entity('dedup_settings')
export class DedupSettings {
  @PrimaryColumn({ type: 'uuid', name: 'tenantId' })
  tenantId: string;

  /** Which record in a group becomes the default "primary" — the person merging a group can
   * still override it manually. */
  @Column({ type: 'varchar', length: 16, name: 'masterRule', default: 'oldest' })
  masterRule: DedupMasterRule;

  /** Whether merge fills the winner's empty fields from the loser (previously the service always
   * did this unconditionally — now it's a real, toggleable setting). */
  @Column({ type: 'boolean', name: 'fillEmptyFields', default: true })
  fillEmptyFields: boolean;

  /** null = off (default). When set, the nightly job auto-merges contact/lead pairs whose score
   * is at or above this threshold — deliberately never companies (their names legitimately repeat
   * across unrelated legal entities more often) and never sales/segments (hard-deleted, can't be
   * undone if the auto-merge is wrong). */
  @Column({ type: 'smallint', name: 'autoMergeThreshold', nullable: true })
  autoMergeThreshold: number | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
