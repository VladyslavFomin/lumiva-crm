import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ccp_txns')
@Index(['tenantId', 'siteId', 'wpPostId'], { unique: true })
@Index(['tenantId', 'siteId', 'wpUserId'])
export class CcpTxnEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  siteId: string;

  @Column({ type: 'int' })
  wpPostId: number;

  @Column({ type: 'int', nullable: true })
  wpUserId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  status: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  spendEur: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  spendUsd: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  date: string | null; // free format from WP

  @Column({ type: 'text', nullable: true })
  desc: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ccpStatus: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}