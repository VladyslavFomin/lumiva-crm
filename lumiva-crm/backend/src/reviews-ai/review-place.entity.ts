import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Объект в Google (отель, клиника…), чьи отзывы ведёт ИИ-менеджер отзывов. */
@Entity('review_places')
@Index(['tenantId', 'placeId'], { unique: true })
export class ReviewPlace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  /** Google Place ID */
  @Column({ type: 'varchar', length: 255 })
  placeId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  mapsUrl: string | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  rating: string | null;

  @Column({ type: 'int', default: 0 })
  totalReviews: number;

  /** Мониторинг включён (опрос по расписанию). */
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** Как часто проверять, часов (каждый опрос — платный запрос к Google). */
  @Column({ type: 'int', default: 3 })
  syncHours: number;

  /** Отзыв с оценкой ≤ этой — негатив: уведомление + письмо + задача. */
  @Column({ type: 'int', default: 3 })
  alertThreshold: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  recipients: string[];

  /** Что ИИ должен знать о бизнесе, чтобы отвечать по делу (услуги, тон, что можно обещать). */
  @Column({ type: 'text', nullable: true })
  businessContext: string | null;

  /** Подпись в конце ответа (например «Команда Akra Hotel»). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  signature: string | null;

  @Column({ type: 'uuid', nullable: true })
  taskProjectId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
