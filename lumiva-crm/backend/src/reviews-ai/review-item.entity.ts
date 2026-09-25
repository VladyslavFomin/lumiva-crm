import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ReviewStatus = 'new' | 'drafted' | 'replied' | 'ignored';
export type ReviewSentiment = 'positive' | 'neutral' | 'negative';

/** Отзыв из Google + разбор и черновик ответа ИИ. */
@Entity('review_items')
@Index(['placeRowId', 'externalKey'], { unique: true })
@Index(['tenantId', 'publishedAt'])
export class ReviewItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  placeRowId: string;

  /** Стабильный ключ отзыва (у Places API нет id): автор + время публикации. */
  @Column({ type: 'varchar', length: 255 })
  externalKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  authorName: string | null;

  @Column({ type: 'text', nullable: true })
  authorUrl: string | null;

  @Column({ type: 'text', nullable: true })
  authorPhoto: string | null;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  language: string | null;

  @Column({ type: 'timestamptz' })
  publishedAt: Date;

  @Column({ type: 'varchar', length: 16, default: 'new' })
  status: ReviewStatus;

  @Column({ type: 'varchar', length: 16, nullable: true })
  sentiment: ReviewSentiment | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  topics: string[];

  /** Краткая суть отзыва для владельца (на языке интерфейса отчётов). */
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  aiReply: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  alertedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  repliedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
