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

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ==== ПЛАН ЗАЛА (ресторан: стол на схеме зоны) ====
  @Column({ type: 'uuid', nullable: true })
  zoneId: string | null;

  /** round / square / rect / booth / bar */
  @Column({ type: 'varchar', length: 16, nullable: true })
  shape: string | null;

  @Column({ type: 'integer', nullable: true })
  posX: number | null;

  @Column({ type: 'integer', nullable: true })
  posY: number | null;

  @Column({ type: 'integer', nullable: true })
  width: number | null;

  @Column({ type: 'integer', nullable: true })
  height: number | null;

  @Column({ type: 'integer', default: 0 })
  rotation: number;

  /** Минимум гостей, на которых имеет смысл сажать за этот стол. */
  @Column({ type: 'integer', nullable: true })
  minCapacity: number | null;

  // ==== АРЕНДА (прокат оборудования / площадок) ====
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  pricePerHour: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  pricePerDay: string | null;

  /** Залог за одну единицу. */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  depositAmount: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
