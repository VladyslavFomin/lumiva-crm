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

export interface HotelReservationPayment {
  id: string;
  date: string;
  amount: string;
  method: string;
  note: string | null;
}

export interface HotelReservationGuest {
  id: string;
  fullName: string;
  passportNumber: string;
  age: string;
  note: string | null;
}

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

  /** Specific physical room (HotelRoomUnit) assigned to this stay — nullable, usually set at
   * check-in rather than at booking time (booking by room type without a specific room number
   * yet is the normal flow in real hotels). ON DELETE SET NULL so deactivating/removing a unit
   * never destroys reservation history. */
  @Column({ type: 'uuid', nullable: true })
  roomUnitId: string | null;

  /** Drives price auto-fill (HotelsPricingService.getReservationPrice) — which occupancy row
   * ("тип размещения": SGL, 2 AD, ...) this stay is priced as. ON DELETE SET NULL, same
   * never-destroy-history precedent as roomUnitId. */
  @Column({ type: 'uuid', nullable: true })
  occupancyTypeId: string | null;

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

  @Column({ type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkedOutAt: Date | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  depositAmount: string;

  /** Simple payment ledger — appended to by addPayment/removePayment, drives the auto-suggested
   * paidStatus (see HotelReservationsService.suggestPaidStatus). paidStatus itself stays directly
   * editable too, so staff can always override the suggestion. */
  @Column({ type: 'jsonb', default: [] })
  payments: HotelReservationPayment[];

  @Column({ type: 'boolean', default: false })
  earlyCheckIn: boolean;

  @Column({ type: 'boolean', default: false })
  lateCheckOut: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Full guest manifest for check-in (name/passport/age per guest) — separate from
   * guestName/guestEmail/guestPhone above, which stay the "booking contact" used for
   * automations/email. Not auto-synced with pax — both are independently editable. */
  @Column({ type: 'jsonb', default: [] })
  guests: HotelReservationGuest[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
