import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ccp_clients')
@Index(['tenantId', 'siteId', 'wpUserId'], { unique: true })
@Index(['tenantId', 'email'])
export class CcpClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  siteId: string;

  @Column({ type: 'int' })
  wpUserId: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  balanceEur: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  balanceUsd: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ibanEur: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ibanUsd: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  wpUpdatedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
  
  @Column({ type: 'varchar', length: 64, nullable: true })
  accountEur: string | null; // ccp_acc_eur_number

  @Column({ type: 'varchar', length: 64, nullable: true })
  accountUsd: string | null; // ccp_acc_usd_number

  @Column({ type: 'varchar', length: 1024, nullable: true })
  analyticsUrl: string | null; // ccp_analytics_url

  @Column({ type: 'text', nullable: true })
  filesList: string | null; // ccp_files_list

  @Column({ type: 'varchar', length: 64, nullable: true })
  tgChatId: string | null; // ccp_tg_chat_id

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  investmentStyle: string | null;

  @Column({ type: 'numeric', precision: 7, scale: 2, nullable: true })
  investmentAnnualPercent: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  creditLeverage: string | null;

  @Column({ type: 'numeric', precision: 7, scale: 4, nullable: true })
  creditRepayMonthlyPercent: string | null;

  @Column({ type: 'numeric', precision: 7, scale: 4, nullable: true })
  investmentProfitMonthlyPercent: string | null;

  @Column({ type: 'numeric', precision: 7, scale: 4, nullable: true })
  accountDebitMonthlyPercent: string | null;
}