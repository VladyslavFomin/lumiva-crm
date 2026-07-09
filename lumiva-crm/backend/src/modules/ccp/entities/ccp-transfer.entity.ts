import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ccp_transfers')
@Index(['tenantId', 'siteId', 'wpPostId'], { unique: true })
@Index(['tenantId', 'siteId', 'fromUserId'])
@Index(['tenantId', 'siteId', 'toUserId'])
export class CcpTransferEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  siteId: string;

  @Column({ type: 'int' })
  wpPostId: number;

  @Column({ type: 'int', nullable: true })
  fromUserId: number | null;

  @Column({ type: 'int', nullable: true })
  toUserId: number | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  date: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ccpStatus: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  status: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'varchar', length: 8, nullable: true })
  fromCurrency: string | null; // ccp_tr_from_cur

  @Column({ type: 'varchar', length: 8, nullable: true })
  toCurrency: string | null; // ccp_tr_to_cur

  @Column({ type: 'numeric', precision: 18, scale: 4, default: 1 })
  rate: string; // ccp_tr_rate

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  credited: string; // amount * rate (то, что "Зачислено")

  @Column({ type: 'text', nullable: true })
  desc: string | null; // ccp_tr_desc

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;
}