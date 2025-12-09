// backend/src/marketing/marketing-cost.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('marketing_costs')
@Index(['tenantId', 'date'])
@Index(['tenantId', 'utmSource', 'utmMedium', 'utmCampaign'])
export class MarketingCost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  // Дата отчёта (день), без времени
  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  // Откуда пришли данные (google_ads, meta_ads, yandex_direct и т.п.)
  @Column({ type: 'varchar', length: 64 })
  sourceSystem: string;

  // Человекочитаемый канал (Google Ads Search, Meta Ads, TikTok, OTA и т.п.)
  @Column({ type: 'varchar', length: 128, nullable: true })
  channel: string | null;

  // UTM-метки
  @Column({ type: 'varchar', length: 128, nullable: true })
  utmSource: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  utmMedium: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  cost: string; // хранится как numeric, в TS будем приводить к number

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}