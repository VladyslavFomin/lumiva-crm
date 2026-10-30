import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelPartnerType = 'tour_operator' | 'ota' | 'travel_agency' | 'corporate' | 'direct' | 'other';
export type HotelPartnerStatus = 'active' | 'archived';
export type HotelPartnerPaymentTerms = 'prepayment' | 'on_arrival' | 'postpayment';

/** Партнёр по продажам (туроператор, OTA, агентство, корпоративный клиент) — тенант-широкий,
 * один партнёр продаёт разные отели. Таблица историческая (hotel_agencies), в интерфейсе — «Партнёры».
 * Страна партнёра — одна из трёх стран в аналитике рынков (гость / покупка / партнёр). */
@Entity('hotel_agencies')
@Index(['tenantId'])
export class HotelAgency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 24, default: 'tour_operator' })
  type: HotelPartnerType;

  @Column({ type: 'varchar', length: 12, default: 'active' })
  status: HotelPartnerStatus;

  /** ISO 3166-1 alpha-2 */
  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  legalName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  taxId: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  /** Комиссия по умолчанию, % — контракт может переопределить */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  commissionPct: string;

  @Column({ type: 'varchar', length: 16, default: 'prepayment' })
  paymentTerms: HotelPartnerPaymentTerms;

  /** Отсрочка оплаты, дней (для postpayment) */
  @Column({ type: 'integer', default: 0 })
  paymentDays: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  creditLimit: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
