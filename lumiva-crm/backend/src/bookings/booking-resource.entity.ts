import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { BookingWeeklyHours } from './booking-location.entity';

/**
 * Универсальный ресурс: кабинет, стол, зал, оборудование, парковочное место и т.п.
 * `type` — свободная строка (не enum), чтобы не хардкодить вертикали (салон/ресторан/фитнес).
 */
@Entity('booking_resources')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'locationId'])
export class BookingResource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 60 })
  type: string; // room, cabinet, table, equipment, hall, parking...

  @Column({ type: 'integer', default: 1 })
  quantity: number; // для пулов ресурсов (напр. "12 реформеров")

  @Column({ type: 'integer', nullable: true })
  capacity: number | null;

  @Column({ type: 'uuid', array: true, default: [] })
  assignedServiceIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  weeklyAvailability: BookingWeeklyHours | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
