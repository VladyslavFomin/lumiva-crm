import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BookingTemplateChannel = 'email' | 'telegram' | 'internal';

export type BookingTemplateEvent =
  | 'reservation_created'
  | 'reservation_confirmed'
  | 'reservation_rescheduled'
  | 'reservation_cancelled'
  | 'reservation_reminder'
  | 'reservation_no_show';

/**
 * Шаблоны сообщений — только определение текста/канала для v1. Реальная отправка
 * (Telegram/email) не подключена в этом проходе, см. lumiva_booking_module memory.
 */
@Entity('booking_notification_templates')
@Index(['tenantId', 'projectId'])
export class BookingNotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  event: BookingTemplateEvent;

  @Column({ type: 'varchar', length: 16 })
  channel: BookingTemplateChannel;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
