import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Журнал «путь гостя»: автоматизация уже сработала для этой брони — второй раз не шлём */
@Entity('hotel_journey_sends')
@Index(['automationId', 'reservationId'], { unique: true })
export class HotelJourneySend {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) automationId: string;
  @Column({ type: 'uuid' }) reservationId: string;
  @Column({ type: 'varchar', length: 60 }) triggerEvent: string;
  @Column({ type: 'uuid', nullable: true }) executionId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

export type HotelFeedbackStage = 'in_stay' | 'after_stay' | 'other';

/**
 * Опрос гостя по ссылке /fb/:token ({{survey_link}} в автоматизации): оценка 1–5 и комментарий. Довольным — ссылки
 * на отзывы площадок отеля; оценка 3 и ниже — событие hotel.guest_feedback_negative для автоматизаций.
 */
@Entity('hotel_guest_feedback')
@Index(['tenantId', 'hotelId', 'createdAt'])
export class HotelGuestFeedback {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) reservationId: string;
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 48 }) token: string;
  @Column({ type: 'varchar', length: 12, default: 'other' }) stage: HotelFeedbackStage;
  @Column({ type: 'uuid', nullable: true }) automationId: string | null;
  @Column({ type: 'smallint', nullable: true }) score: number | null;
  @Column({ type: 'text', nullable: true }) comment: string | null;
  @Column({ type: 'timestamptz', nullable: true }) openedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) answeredAt: Date | null;
  /** гость нажал «Оставить отзыв» на площадке — какой */
  @Column({ type: 'varchar', length: 24, nullable: true }) reviewPlatform: string | null;
  @Column({ type: 'timestamptz', nullable: true }) reviewClickedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
