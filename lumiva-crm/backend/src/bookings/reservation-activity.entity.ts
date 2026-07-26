import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Reservation } from './reservation.entity';
import { StaffUser } from '../staff/staff-user.entity';

export type ReservationActivityType =
  | 'created'
  | 'status_changed'
  | 'rescheduled'
  | 'staff_changed'
  | 'resource_changed'
  | 'notification_sent'
  | 'note_added';

/** Аудит-лог брони — по образцу LeadActivity. */
@Entity('reservation_activity')
export class ReservationActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  reservationId: string;

  @ManyToOne(() => Reservation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservationId' })
  reservation: Reservation;

  @Column({ nullable: true })
  userId: string | null; // StaffUser.id, null = система/коннектор

  @ManyToOne(() => StaffUser, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: StaffUser | null;

  @Column({ type: 'varchar', length: 32 })
  type: ReservationActivityType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  fromValue: string | null;

  @Column({ type: 'text', nullable: true })
  toValue: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
