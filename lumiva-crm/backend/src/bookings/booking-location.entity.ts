import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface BookingWorkingHoursPeriod {
  start: string; // "09:00"
  end: string; // "20:00"
}

export type BookingWeeklyHours = Record<string, BookingWorkingHoursPeriod[]>; // "mon".."sun" -> periods

export interface BookingLocationClosure {
  date: string; // ISO date, single day
  reason: string | null;
  customHours?: BookingWorkingHoursPeriod[]; // set for "сокращённый день" instead of fully closed
}

@Entity('booking_locations')
@Index(['tenantId', 'projectId'])
export class BookingLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'jsonb', nullable: true })
  workingHours: BookingWeeklyHours | null;

  @Column({ type: 'jsonb', default: [] })
  closures: BookingLocationClosure[]; // "Особые даты" — закрытые дни / сокращённые часы

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string; // active, pending, disabled

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
