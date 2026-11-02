import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BookingOrderStatus = 'open' | 'billed' | 'paid' | 'cancelled';
export type BookingOrderKind = 'table' | 'reservation' | 'pass' | 'rental' | 'walkin';
export type BookingOrderPaymentMethod = 'cash' | 'card' | 'online' | 'transfer' | 'mixed';

/**
 * Счёт / заказ. Для ресторана — заказ стола (позиции из меню), для салона/консультаций —
 * счёт по брони (услуга + доп. позиции), для фитнеса — продажа абонемента, для аренды —
 * аренда + штрафы/залог. Один формат счёта для всех вертикалей, чтобы оплата (наличные/
 * карта/онлайн-ссылка через Payments → Sale) работала одинаково.
 */
@Entity('booking_orders')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'reservationId'])
@Index(['tenantId', 'resourceId'])
@Index(['tenantId', 'createdAt'])
export class BookingOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  /** Порядковый номер счёта внутри тенанта (#1024). */
  @Column({ type: 'integer' })
  number: number;

  @Column({ type: 'varchar', length: 16, default: 'reservation' })
  kind: BookingOrderKind;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: BookingOrderStatus;

  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ type: 'uuid', nullable: true })
  reservationId: string | null;

  /** Стол (ресторан) или ресурс аренды. */
  @Column({ type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  passId: string | null;

  @Column({ type: 'uuid', nullable: true })
  contactId: string | null;

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  customerPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerEmail: string | null;

  @Column({ type: 'integer', default: 1 })
  guests: number;

  /** Официант / ответственный (StaffUser.id). */
  @Column({ type: 'uuid', nullable: true })
  staffUserId: string | null;

  @Column({ type: 'char', length: 3, default: 'RUB' })
  currency: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  discountPercent: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  discountAmount: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  serviceChargePercent: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  serviceChargeAmount: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  tipAmount: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  paidAmount: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  paymentMethod: BookingOrderPaymentMethod | null;

  /** Продажа в модуле «Продажи», созданная при выставлении счёта (для выручки + онлайн-оплаты). */
  @Column({ type: 'uuid', nullable: true })
  saleId: string | null;

  @Column({ type: 'text', nullable: true })
  paymentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  billedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdByStaffUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
