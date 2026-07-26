import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WaitlistPriority = 'normal' | 'high' | 'vip';
export type WaitlistStatus = 'waiting' | 'offer' | 'confirmed' | 'expired' | 'removed';

@Entity('booking_waitlist_entries')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'status'])
export class BookingWaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  preferredStaffUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null;

  @Column({ type: 'uuid', nullable: true })
  contactId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  customerPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerEmail: string | null;

  @Column({ type: 'text', nullable: true })
  preferredWindow: string | null; // free-text, e.g. "23–25 апр, после 15:00"

  @Column({ type: 'integer', default: 1 })
  participants: number;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  priority: WaitlistPriority;

  @Column({ type: 'varchar', length: 16, default: 'waiting' })
  status: WaitlistStatus;

  @Column({ type: 'timestamptz', nullable: true })
  offeredStartAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  offeredEndAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  convertedReservationId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
