import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BookingClassSessionStatus = 'scheduled' | 'cancelled' | 'completed';

/**
 * Занятие в расписании (фитнес / пилатес / групповые классы). Шаблон занятия — BookingService
 * (направление: «Пилатес реформер», длительность, цена, вместимость по умолчанию), зал —
 * BookingResource, тренер — StaffUser. Участники — это Reservation с classSessionId.
 */
@Entity('booking_class_sessions')
@Index(['tenantId', 'startAt'])
@Index(['tenantId', 'seriesId'])
export class BookingClassSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'uuid' })
  serviceId: string;

  @Column({ type: 'uuid', nullable: true })
  staffUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'timestamptz' })
  startAt: Date;

  @Column({ type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'integer', default: 10 })
  capacity: number;

  /** Цена разового посещения (если пусто — цена направления). */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'varchar', length: 16, default: 'scheduled' })
  status: BookingClassSessionStatus;

  /** Занятия, созданные одной серией (повтор по дням недели), — для массового изменения. */
  @Column({ type: 'uuid', nullable: true })
  seriesId: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  level: string | null; // beginner / intermediate / advanced / all

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
