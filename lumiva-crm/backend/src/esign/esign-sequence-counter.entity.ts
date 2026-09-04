// src/esign/esign-sequence-counter.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Per-tenant running counter for {CONTRACT_NO} — auto-assigned sequentially at issue time
 * (never typed by hand), so contract numbers never collide or go out of order. One row per
 * tenant, created lazily on first use. `nextContractSeq` is the number the NEXT issued
 * document consuming {CONTRACT_NO} will receive; starts at 401. */
@Entity('esign_sequence_counters')
export class EsignSequenceCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  tenantId: string;

  @Column({ type: 'int', default: 401 })
  nextContractSeq: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
