import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { HotelFolioKind } from './hotel-folio.entities';

export type HotelPaymentRequestStatus = 'pending' | 'paid' | 'cancelled' | 'expired';
export type HotelPaymentRequestKind = 'deposit' | 'balance' | 'custom';

/**
 * Запрос оплаты брони: постоянная ссылка /hp/:token (сессия у платёжной системы создаётся в момент нажатия
 * «Оплатить» — у iyzico она живёт ~30 минут, а ссылка в письме — днями). Оплата зачисляется в фолио брони
 * способом «онлайн» (не в кассовую смену).
 */
@Entity('hotel_payment_requests')
@Index(['tenantId', 'reservationId'])
export class HotelPaymentRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) reservationId: string;
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 }) token: string;
  @Column({ type: 'varchar', length: 8, default: 'guest' }) folio: HotelFolioKind;
  @Column({ type: 'varchar', length: 8, default: 'custom' }) kind: HotelPaymentRequestKind;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) amount: string;
  @Column({ type: 'varchar', length: 3 }) currency: string;
  @Column({ type: 'varchar', length: 10, default: 'pending' }) status: HotelPaymentRequestStatus;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) note: string | null;
  /** платёж (payments.id), которым оплачено, и id строки оплаты в брони */
  @Column({ type: 'uuid', nullable: true }) paymentId: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) reservationPaymentId: string | null;
  @Column({ type: 'timestamptz', nullable: true }) paidAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) openedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) sentAt: Date | null;
  @Column({ type: 'varchar', length: 190, nullable: true }) sentTo: string | null;
  @Column({ type: 'varchar', length: 12, default: 'staff' }) origin: 'staff' | 'website';
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
