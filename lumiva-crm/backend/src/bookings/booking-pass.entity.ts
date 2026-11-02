import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BookingPassStatus = 'active' | 'frozen' | 'expired' | 'used_up' | 'cancelled';

/** Проданный клиенту абонемент / пакет сессий. Остаток = visitsTotal - visitsUsed. */
@Entity('booking_passes')
@Index(['tenantId', 'contactId'])
@Index(['tenantId', 'status'])
export class BookingPass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid' })
  planId: string;

  @Column({ type: 'integer' })
  number: number;

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

  /** Снимок тарифа на момент продажи. */
  @Column({ type: 'varchar', length: 255 })
  planName: string;

  @Column({ type: 'varchar', length: 16, default: 'visits' })
  kind: 'visits' | 'unlimited';

  @Column({ type: 'integer', nullable: true })
  visitsTotal: number | null;

  @Column({ type: 'integer', default: 0 })
  visitsUsed: number;

  @Column({ type: 'uuid', array: true, default: [] })
  serviceIds: string[];

  @Column({ type: 'date' })
  startsAt: string;

  @Column({ type: 'date' })
  expiresAt: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: BookingPassStatus;

  @Column({ type: 'date', nullable: true })
  frozenFrom: string | null;

  @Column({ type: 'integer', default: 0 })
  freezeDaysUsed: number;

  @Column({ type: 'integer', default: 0 })
  freezeDaysAllowed: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'char', length: 3, default: 'RUB' })
  currency: string;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
