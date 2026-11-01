import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Простой розничный календарь доступности/цены по датам — отдельная сущность от
 * оптовой рыночной таблицы (HotelDailyMarketRate), см. решение пользователя в plan mode. */
@Entity('hotel_room_date_overrides')
@Index(['tenantId', 'roomTypeId'])
@Index(['roomTypeId', 'date'], { unique: true })
export class HotelRoomDateOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'date' })
  date: string;

  /** null = использовать HotelRoomType.basePrice */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'boolean', default: false })
  blocked: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  discountPct: string;

  /** минимум ночей при заезде в эту дату (в канал — min_stay_arrival) */
  @Column({ type: 'integer', default: 1 })
  minNights: number;

  /** закрыто на заезд (CTA): в эту дату нельзя заехать, проживание через неё — можно */
  @Column({ type: 'boolean', default: false })
  closedToArrival: boolean;

  /** закрыто на выезд (CTD): в эту дату нельзя выехать */
  @Column({ type: 'boolean', default: false })
  closedToDeparture: boolean;

  /** максимум ночей при заезде в эту дату; null — без ограничения */
  @Column({ type: 'smallint', nullable: true })
  maxNights: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
