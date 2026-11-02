// src/payments/payment.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PaymentProvider = 'iyzico' | 'paytr' | 'yookassa';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type PaymentSource = 'sale_link' | 'storefront' | 'hotel_payment';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenantId' })
  tenantId: string;

  @Column({ type: 'varchar', length: 24 })
  provider: PaymentProvider;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: PaymentStatus;

  @Column({ type: 'double precision' })
  amount: number;

  @Column({ type: 'varchar', length: 8, default: 'TRY' })
  currency: string;

  @Column({ type: 'uuid', name: 'saleId', nullable: true })
  saleId: string | null;

  @Column({ type: 'varchar', length: 24, name: 'source', default: 'sale_link' })
  source: PaymentSource;

  /** запрос оплаты брони отеля (hotel_payment_requests) — для source 'hotel_payment' */
  @Column({ type: 'uuid', name: 'hotelPaymentRequestId', nullable: true })
  hotelPaymentRequestId: string | null;

  /** куда вернуть покупателя после оплаты (иначе общая страница /pay/result) */
  @Column({ type: 'text', name: 'returnUrl', nullable: true })
  returnUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  token: string | null;

  @Column({ type: 'varchar', length: 128, name: 'conversationId', nullable: true })
  conversationId: string | null;

  @Column({ type: 'text', name: 'paymentPageUrl', nullable: true })
  paymentPageUrl: string | null;

  @Column({ type: 'jsonb', name: 'providerRaw', nullable: true })
  providerRaw: Record<string, unknown> | null;

  @Column({ type: 'text', name: 'failReason', nullable: true })
  failReason: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updatedAt' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', name: 'paidAt', nullable: true })
  paidAt: Date | null;
}
