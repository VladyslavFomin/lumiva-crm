import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** GA4 по доменам сайта (hostName) за день — разбивка по модулям бронирования и сигнал об обрыве выручки. */
@Entity('marketing_ga4_hosts')
@Index(['tenantId', 'dataSource', 'date', 'host'], { unique: true })
export class MarketingGa4Host {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  /** ga4_{propertyId} — как в marketing_traffic. */
  @Column({ type: 'varchar', length: 80 })
  dataSource: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 255 })
  host: string;

  @Column({ type: 'int', default: 0 })
  sessions: number;

  /** GA4 ecommercePurchases — число событий purchase. */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  purchases: string;

  /** GA4 purchaseRevenue. */
  @Column({ type: 'numeric', precision: 16, scale: 2, default: 0 })
  revenue: string;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;
}
