// backend/src/marketing/marketing-traffic.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketing_traffic')
@Index(['tenantId', 'date', 'source', 'medium', 'campaign'], { unique: true })
export class MarketingTraffic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  // дата в формате YYYY-MM-DD
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  medium: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  campaign: string | null;

  @Column({ type: 'int', default: 0 })
  sessions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'int', default: 0 })
  leads: number;

  // расходы
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  cost: string;

  // доход, атрибутированный этой связке
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  revenue: string;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}