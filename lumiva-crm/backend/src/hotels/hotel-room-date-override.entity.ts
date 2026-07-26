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

  @Column({ type: 'integer', default: 1 })
  minNights: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
