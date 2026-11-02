import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BookingBusinessType =
  | 'salon'
  | 'restaurant'
  | 'fitness'
  | 'consultation'
  | 'rental';

export type BookingConfirmationMode = 'auto' | 'manual' | 'conditional';

export type BookingProjectStatus =
  | 'not_configured'
  | 'in_progress'
  | 'ready'
  | 'active'
  | 'paused'
  | 'error';

/** Параметры, специфичные для типа бизнеса. Все поля опциональны — дефолты в getVerticalSettings(). */
export interface BookingVerticalSettings {
  // ресторан
  turnMinutes?: number; // длительность брони стола по умолчанию
  serviceChargePercent?: number; // сервисный сбор по умолчанию
  autoReleaseMinutes?: number; // через сколько минут опоздания стол считается свободным
  // фитнес
  passChargeOn?: 'booking' | 'attendance'; // когда списывать посещение
  noShowChargesVisit?: boolean;
  lateCancelHours?: number; // отмена позже — посещение сгорает
  defaultClassCapacity?: number;
  // консультации
  defaultMeetingFormat?: 'offline' | 'online' | 'phone';
  meetingUrlTemplate?: string; // напр. https://meet.jit.si/{ORG}-{ID}
  followUpDays?: number;
  // аренда
  rentalUnit?: 'hour' | 'day';
  lateFeePercent?: number; // % от стоимости часа/дня за каждый просроченный час/день
  requireDeposit?: boolean;
}

/**
 * Один проект бронирования на тенанта (v1: без мастера создания нескольких
 * проектов — авто-создаётся при первом обращении, см. BookingsProjectsService).
 */
@Entity('booking_projects')
@Index(['tenantId'])
export class BookingProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'salon' })
  businessType: BookingBusinessType;

  @Column({ type: 'varchar', length: 64, default: 'Europe/Moscow' })
  timezone: string;

  @Column({ type: 'char', length: 3, default: 'RUB' })
  currency: string;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  confirmationMode: BookingConfirmationMode;

  @Column({ type: 'varchar', length: 32, default: 'not_configured' })
  status: BookingProjectStatus;

  // ==== ПРАВИЛА БРОНИРОВАНИЯ ====
  @Column({ type: 'integer', default: 120 })
  minNoticeMinutes: number;

  @Column({ type: 'integer', default: 60 })
  maxAdvanceDays: number;

  @Column({ type: 'integer', default: 15 })
  slotIntervalMinutes: number;

  @Column({ type: 'integer', default: 10 })
  bufferMinutes: number;

  @Column({ type: 'integer', default: 4 })
  cancellationDeadlineHours: number;

  @Column({ type: 'integer', default: 2 })
  rescheduleDeadlineHours: number;

  @Column({ type: 'boolean', default: false })
  overbookingAllowed: boolean;

  // ==== УВЕДОМЛЕНИЯ ====
  // { [eventKey]: { crm: bool, email: bool, telegram: bool } } — какие каналы включены
  // на событие. Каналы пока управляют только видимостью toggle в UI; реальная отправка
  // Telegram/Email по этим событиям не подключена (см. lumiva_booking_module memory).
  @Column({ type: 'jsonb', default: {} })
  notificationChannels: Record<string, { crm: boolean; email: boolean; telegram: boolean }>;

  // ==== НАСТРОЙКИ ВЕРТИКАЛИ (зависят от businessType) ====
  @Column({ type: 'jsonb', default: {} })
  verticalSettings: BookingVerticalSettings;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
