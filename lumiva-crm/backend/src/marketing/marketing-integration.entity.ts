import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketing_integrations')
export class MarketingIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  // google_analytics, yandex_metrika, meta_ads, google_ads, tiktok_ads и т.п.
  @Column({ type: 'varchar', length: 80 })
  provider: string;

  // analytics / ads / email / other
  @Column({ type: 'varchar', length: 40, default: 'analytics' })
  kind: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Основные ID для быстрого доступа
  @Column({ type: 'varchar', length: 160, nullable: true })
  primaryId: string | null; // например, GA4 property ID, Counter ID и т.п.

  @Column({ type: 'jsonb', nullable: true })
  settings: any | null;

  // Состояние синхронизации — пишет MarketingService.trackSync при любом запуске (cron, кнопка, ИИ)
  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;

  // never / ok / error
  @Column({ type: 'varchar', length: 16, default: 'never' })
  lastSyncStatus: string;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'int', nullable: true })
  lastSyncRows: number | null;

  // Начало текущей серии ошибок
  @Column({ type: 'timestamptz', nullable: true })
  failingSince: Date | null;

  // Владельцу уже сообщили о текущей серии ошибок
  @Column({ type: 'timestamptz', nullable: true })
  healthNotifiedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}