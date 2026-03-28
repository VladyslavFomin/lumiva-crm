import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketing_traffic')
@Index(['tenantId', 'date', 'dataSource', 'source', 'medium', 'campaign'])
export class MarketingTraffic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'date' })
  date: string;

  /** n8n / google_ads / meta_ads / manual и т.п. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  dataSource: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  medium: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  campaign: string | null;

  @Column({ type: 'int', default: 0 })
  sessions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'int', default: 0 })
  leads: number;

  @Column({ type: 'int', default: 0 })
  projects: number;

  @Column({ type: 'numeric', precision: 14, scale: 4, default: 0 })
  cost: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  revenue: string;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
