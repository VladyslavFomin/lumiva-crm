import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('seo_gsc_daily')
@Index(['tenantId', 'propertyUrl', 'date'], { unique: true })
export class SeoGscDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  propertyUrl: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'numeric', precision: 8, scale: 4, default: 0 })
  ctr: string;

  @Column({ type: 'numeric', precision: 8, scale: 4, default: 0 })
  position: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
