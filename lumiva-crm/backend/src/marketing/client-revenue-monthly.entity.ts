import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Выручка клиента (компании CRM) за месяц, введённая вручную или импортом отчёта отеля. */
@Entity('client_revenue_monthly')
@Index(['tenantId', 'companyId', 'month'], { unique: true })
export class ClientRevenueMonthly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  companyId: string;

  /** 'YYYY-MM' */
  @Column({ type: 'varchar', length: 7 })
  month: string;

  @Column({ type: 'numeric', precision: 16, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  /** Откуда значение: 'manual' — введено в CRM, 'import' — из файла. */
  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
