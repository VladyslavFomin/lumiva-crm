import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketing_traffic')
@Index(['tenantId', 'date', 'dataSource', 'source', 'medium', 'campaign', 'country'])
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

  /** Подключение (marketing_integrations.id), из которого пришла строка. Сейчас заполняет только синк
   * Meta Ads — несколько рекламных кабинетов делят один dataSource 'meta_ads', и без этого их не
   * разделить. null — старые строки и остальные источники. */
  @Column({ type: 'uuid', nullable: true })
  integrationId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  medium: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  campaign: string | null;

  /** ISO 3166-1 alpha-2 из GA4 (countryId) или импорт; null — нет гео в строке. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  country: string | null;

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

  /** Конверсии по данным рекламной площадки (Google Ads conversions / выбранные действия Meta). */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  conversions: string;

  /** Ценность конверсий по данным площадки (Google Ads conversions_value / Meta action_values) —
   * «выручка площадки», хранится отдельно от revenue (реальная выручка из CRM/аналитики). */
  @Column({ type: 'numeric', precision: 16, scale: 2, default: 0 })
  conversionValue: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
