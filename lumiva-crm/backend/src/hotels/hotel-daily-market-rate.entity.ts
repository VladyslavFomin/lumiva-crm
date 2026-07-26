import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Подневная оптовая цена на человека по группе рынков: Bütçe(себестоимость)/
 * PP Ort.(средняя фактическая)/Brüt(целевая до скидки)/İndirim(скидка,%)/
 * Net(итоговая, идёт клиенту) = round(grossPP*(1-discountPct/100)), считается на сервере. */
@Entity('hotel_daily_market_rates')
@Index(['tenantId', 'roomTypeId'])
@Index(['roomTypeId', 'marketGroupId', 'date'], { unique: true })
export class HotelDailyMarketRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'uuid' })
  marketGroupId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  budgetPP: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  ppAvg: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  grossPP: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  discountPct: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  netPP: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
