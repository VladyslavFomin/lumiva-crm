import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';

export type ReservationStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_business'
  | 'rejected'
  | 'no_show';

export type ReservationConfirmationStatus =
  | 'not_required'
  | 'pending'
  | 'confirmed'
  | 'rejected';

export type ReservationPaymentStatus =
  | 'not_required'
  | 'unpaid'
  | 'deposit_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed';

export type ReservationSource =
  | 'website'
  | 'phone'
  | 'walkin'
  | 'manual'
  | 'api'
  | 'import'
  | 'telegram';

/** Открытые (не финальные) статусы — участвуют в проверке конфликтов ресурса/мастера. */
export const RESERVATION_ACTIVE_STATUSES: ReservationStatus[] = [
  'draft',
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
];

@Entity('reservations')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'startAt'])
@Index(['tenantId', 'leadId'])
@Index(['tenantId', 'contactId'])
@Index(['tenantId', 'staffUserId', 'startAt'])
@Index(['tenantId', 'resourceId', 'startAt'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  staffUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null;

  @ManyToOne(() => Lead, (lead) => lead.reservations, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'leadId' })
  lead: Lead | null;

  @Column({ type: 'uuid', nullable: true })
  contactId: string | null;

  @ManyToOne(() => Contact, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'contactId' })
  contact: Contact | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  customerPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerEmail: string | null;

  @Column({ type: 'timestamptz' })
  startAt: Date;

  @Column({ type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'integer', default: 1 })
  participants: number;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: ReservationStatus;

  @Column({ type: 'varchar', length: 16, default: 'not_required' })
  confirmationStatus: ReservationConfirmationStatus;

  @Column({ type: 'varchar', length: 24, default: 'not_required' })
  paymentStatus: ReservationPaymentStatus;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'char', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source: ReservationSource;

  @Column({ type: 'uuid', nullable: true })
  assignedUserId: string | null; // StaffUser.id — ответственный в CRM (напр. reception)

  @Column({ type: 'jsonb', nullable: true })
  customFields: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
