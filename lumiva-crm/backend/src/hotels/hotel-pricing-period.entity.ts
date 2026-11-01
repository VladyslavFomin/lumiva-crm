import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Период прайса сезона (колонка прайс-листа): PP минимальной категории, бюджет, мин. ночей, release, пик.
 * На странице «Цены и рынки» по дням — ещё и фильтр отображения. */
@Entity('hotel_pricing_periods')
@Index(['tenantId', 'hotelId'])
export class HotelPricingPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  /** PP в DBL минимальной (базовой) категории на этот период — от него считаются все цены сезона; 0 — не задан */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  ppBase: string;

  /** Бюджет PP минимальной категории — минимум, чтобы окупиться; 0 — не задан */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  budgetPP: string;

  @Column({ type: 'smallint', default: 1 })
  minNights: number;

  /** Release, дней до заезда */
  @Column({ type: 'smallint', default: 0 })
  releaseDays: number;

  /** Пиковый период: размещения берут пиковый коэффициент (SGL «1,6 / 2» → 2) */
  @Column({ type: 'boolean', default: false })
  isPeak: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
