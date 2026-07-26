import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { BookingWeeklyHours } from './booking-location.entity';

export interface BookingStaffTimeOff {
  from: string; // ISO date
  to: string; // ISO date
  reason: string | null;
}

/**
 * Настройки бронирования для сотрудника (StaffUser) — сателлит 1:1, не раздуваем
 * сам StaffUser, т.к. это общая для всей CRM сущность.
 */
@Entity('booking_staff_profiles')
@Index(['tenantId', 'staffUserId'], { unique: true })
export class BookingStaffProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  staffUserId: string;

  @Column({ type: 'boolean', default: true })
  availableForBooking: boolean;

  @Column({ type: 'uuid', array: true, default: [] })
  assignedLocationIds: string[];

  @Column({ type: 'uuid', array: true, default: [] })
  assignedServiceIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  weeklyAvailability: BookingWeeklyHours | null;

  @Column({ type: 'jsonb', default: [] })
  timeOff: BookingStaffTimeOff[];

  @Column({ type: 'integer', default: 1 })
  maxSimultaneousBookings: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  calendarColor: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
