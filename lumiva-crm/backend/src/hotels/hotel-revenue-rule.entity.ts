import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** occupancy — загрузка типа номера на дату, %; pickup — сколько номеров на эту дату забронировали за последние 7 дней */
export type HotelRevenueMetric = 'occupancy' | 'pickup';

/**
 * Правило рекомендации цены: «если [загрузка / подборка] [≥ / ≤] порога за leadMin–leadMax дней до даты
 * (и в эти дни недели) — поправка ±adjustPct к цене по прайсу». Правила проверяются по порядку, срабатывает первое.
 */
@Entity('hotel_revenue_rules')
@Index(['tenantId', 'hotelId'])
export class HotelRevenueRule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  /** типы номеров; пусто — все */
  @Column({ type: 'uuid', array: true, default: '{}' }) roomTypeIds: string[];
  @Column({ type: 'varchar', length: 12, default: 'occupancy' }) metric: HotelRevenueMetric;
  @Column({ type: 'varchar', length: 4, default: 'gte' }) op: 'gte' | 'lte';
  @Column({ type: 'numeric', precision: 8, scale: 2 }) threshold: string;
  /** дней до даты проживания: от … до (null — без верхней границы) */
  @Column({ type: 'smallint', default: 0 }) leadMin: number;
  @Column({ type: 'smallint', nullable: true }) leadMax: number | null;
  /** дни недели 1 = пн … 7 = вс; пусто — все */
  @Column({ type: 'smallint', array: true, default: '{}' }) weekdays: number[];
  /** поправка к цене по прайсу, % (+10 — дороже, −15 — дешевле) */
  @Column({ type: 'numeric', precision: 6, scale: 2 }) adjustPct: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
