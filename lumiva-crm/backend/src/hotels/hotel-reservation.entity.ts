import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelReservationStatus =
  | 'confirmed'
  | 'pending'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';

export type HotelReservationPaidStatus = 'full' | 'partial' | 'none' | 'refunded';

export type HotelReservationSource = 'manual' | 'import';

/** Гость хранится как обычное имя/pax — без Contact/Lead-матчинга (решение
 * пользователя в plan mode: ни один из 7 макетов не показывает CRM-привязку гостя). */
@Entity('hotel_reservations')
@Index(['tenantId', 'hotelId'])
@Index(['tenantId', 'checkIn'])
@Index(['tenantId', 'status'])
export class HotelReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'uuid', nullable: true })
  agencyId: string | null;

  @Column({ type: 'varchar', length: 255 })
  guestName: string;

  /** Сырой снимок контактов гостя на самой брони — тот же паттерн, что
   * Reservation.customerEmail/customerPhone в модуле Booking, без привязки к Contact/Lead
   * (см. комментарий выше). Нужен для автоматизаций ("письмо гостю о новой брони"). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  guestEmail: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  guestPhone: string | null;

  @Column({ type: 'integer', default: 1 })
  pax: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  market: string | null;

  @Column({ type: 'date' })
  checkIn: string;

  @Column({ type: 'date' })
  checkOut: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  costPerNight: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  ppPerNight: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  grossPerNight: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  ppTotal: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  roomTotal: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  discountPct: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'varchar', length: 16, default: 'confirmed' })
  status: HotelReservationStatus;

  @Column({ type: 'varchar', length: 16, default: 'none' })
  paidStatus: HotelReservationPaidStatus;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source: HotelReservationSource;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
