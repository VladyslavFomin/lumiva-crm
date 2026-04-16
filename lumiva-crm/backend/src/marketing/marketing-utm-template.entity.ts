import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketing_utm_templates')
export class MarketingUtmTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  baseUrl: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  channelType: string | null; // google_ads_search / meta_ads / yandex / email / other

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmSource: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmMedium: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  utmContent: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  utmTerm: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}