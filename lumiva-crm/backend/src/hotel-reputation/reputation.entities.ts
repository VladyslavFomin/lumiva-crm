import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ReputationPlatform, ReviewSentiment } from './reputation.constants';

/** Бренд (сеть) отелей — The Norm, Selectum, Asteria. */
@Entity('hotel_brands')
export class HotelBrand {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 16, nullable: true }) color: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** Привязка отеля к площадке: ссылка на страницу отеля / ID локации / ключ API. */
@Entity('hotel_review_sources')
export class HotelReviewSource {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 24 }) platform: ReputationPlatform;
  /** Google: accounts/{a}/locations/{l}; HolidayCheck: UUID отеля; остальные — необязательно. */
  @Column({ type: 'varchar', length: 300, nullable: true }) externalId: string | null;
  @Column({ type: 'text', nullable: true }) url: string | null;
  /** Зашифрованный ключ API (HolidayCheck — свой на каждый отель). */
  @Column({ type: 'text', nullable: true }) apiKeyEnc: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'timestamptz', nullable: true }) lastSyncAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastSuccessAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastNewAt: Date | null;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  /** Рейтинг и число отзывов по данным самой площадки (Google API) — для сверки счётчика. */
  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true }) platformRating: string | null;
  @Column({ type: 'integer', nullable: true }) platformCount: number | null;
  /** Основной скрейпер сломался — временно работаем через запасной. */
  @Column({ type: 'boolean', default: false }) useFallback: boolean;
  /** Запрошена дозагрузка истории: сколько самых свежих отзывов взять при ближайшем запуске (дубли отбрасываются). */
  @Column({ type: 'integer', nullable: true }) backfillMax: number | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

export type ReviewStatus = 'active' | 'edited' | 'deleted';

@Entity('hotel_reviews')
export class HotelReview {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid', nullable: true }) sourceId: string | null;
  @Column({ type: 'varchar', length: 24 }) platform: ReputationPlatform;
  @Column({ type: 'varchar', length: 300 }) externalReviewId: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) author: string | null;
  @Column({ type: 'text', nullable: true }) authorPhoto: string | null;
  /** Язык оригинала (определяется по оригиналу, не по переводу площадки). */
  @Column({ type: 'varchar', length: 12, nullable: true }) lang: string | null;
  @Column({ type: 'text', nullable: true }) title: string | null;
  @Column({ type: 'text', nullable: true }) textOriginal: string | null;
  @Column({ type: 'text', nullable: true }) textTranslated: string | null;
  @Column({ type: 'varchar', length: 8, nullable: true }) translatedLang: string | null;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) ratingRaw: string | null;
  @Column({ type: 'smallint', nullable: true }) ratingScale: number | null;
  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true }) rating10: string | null;
  @Column({ type: 'jsonb', nullable: true }) subRatings: Record<string, number> | null;
  @Column({ type: 'date', nullable: true }) travelDate: string | null;
  @Column({ type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) platformUpdatedAt: Date | null;
  @Column({ type: 'varchar', length: 12, default: 'active' }) status: ReviewStatus;
  @Column({ type: 'text', nullable: true }) reviewUrl: string | null;
  @Column({ type: 'boolean', default: false }) hasReply: boolean;
  @Column({ type: 'timestamptz', nullable: true }) repliedAt: Date | null;
  /** Текст ответа отеля, как он виден на площадке (или отправлен из CRM). */
  @Column({ type: 'text', nullable: true }) replyText: string | null;
  /** «Отвечено» отметил менеджер вручную (ответ дан на самой площадке). */
  @Column({ type: 'boolean', default: false }) replyMarkedManually: boolean;
  @Column({ type: 'text', nullable: true }) aiDraft: string | null;
  /** Черновик подготовил ИИ-менеджер отзывов (id сотрудника); отвечает всегда человек. */
  @Column({ type: 'uuid', nullable: true }) aiDraftAgentId: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) sentiment: ReviewSentiment | null;
  @Column({ type: 'timestamptz', nullable: true }) analyzedAt: Date | null;
  /** Хэш текста, по которому делался разбор — повторный разбор только при правке гостем. */
  @Column({ type: 'varchar', length: 64, nullable: true }) analysisHash: string | null;
  @Column({ type: 'text', nullable: true }) analysisError: string | null;
  @Column({ type: 'timestamptz' }) firstSeenAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

@Entity('hotel_review_versions')
export class HotelReviewVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) reviewId: string;
  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true }) rating10: string | null;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) ratingRaw: string | null;
  @Column({ type: 'text', nullable: true }) text: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) capturedAt: Date;
}

export type ReplyStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'published';

@Entity('hotel_review_replies')
export class HotelReviewReply {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) reviewId: string;
  @Column({ type: 'text' }) text: string;
  @Column({ type: 'uuid', nullable: true }) authorUserId: string | null;
  /** crm — отправлен из CRM; platform — ответ найден на площадке при сборе. */
  @Column({ type: 'varchar', length: 12 }) source: 'crm' | 'platform' | 'manual';
  @Column({ type: 'varchar', length: 12 }) status: ReplyStatus;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @Column({ type: 'timestamptz', nullable: true }) nextAttemptAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) postedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('hotel_review_topics')
export class HotelReviewTopic {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) reviewId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 40 }) topic: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) otherLabel: string | null;
  @Column({ type: 'varchar', length: 10 }) sentiment: ReviewSentiment;
  @Column({ type: 'text', nullable: true }) quote: string | null;
  @Column({ type: 'timestamptz', nullable: true }) publishedAt: Date | null;
}

@Entity('hotel_review_sync_runs')
export class HotelReviewSyncRun {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 24 }) platform: ReputationPlatform;
  @Column({ type: 'uuid', nullable: true }) hotelId: string | null;
  @Column({ type: 'uuid', nullable: true }) sourceId: string | null;
  /** schedule | manual | push | reconcile | test */
  @Column({ type: 'varchar', length: 16 }) trigger: string;
  @Column({ type: 'varchar', length: 12, default: 'running' }) status: 'running' | 'ok' | 'error';
  @Column({ type: 'varchar', length: 200, nullable: true }) actorId: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) externalRunId: string | null;
  @Column({ type: 'timestamptz' }) startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @Column({ type: 'integer', default: 0 }) fetched: number;
  @Column({ type: 'integer', default: 0, name: 'new' }) newCount: number;
  @Column({ type: 'integer', default: 0 }) updated: number;
  @Column({ type: 'integer', default: 0 }) errors: number;
  @Column({ type: 'text', nullable: true }) errorText: string | null;
}

@Entity('hotel_reputation_settings')
export class HotelReputationSettings {
  @PrimaryColumn('uuid') tenantId: string;
  @Column({ type: 'jsonb', default: {} }) config: Record<string, any>;
  /** Зашифрованные секреты: apifyToken, googleRefreshToken. Наружу не отдаются. */
  @Column({ type: 'jsonb', default: {} }) secrets: Record<string, string>;
  /** Токен в URL push-эндпоинта Pub/Sub — без него уведомление не принимается. */
  @Column({ type: 'varchar', length: 64, nullable: true }) pushToken: string | null;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

@Entity('hotel_review_alerts')
export class HotelReviewAlert {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'varchar', length: 32 }) kind: string;
  @Column({ type: 'varchar', length: 300 }) dedupKey: string;
  @Column({ type: 'uuid', nullable: true }) hotelId: string | null;
  @Column({ type: 'uuid', nullable: true }) reviewId: string | null;
  @Column({ type: 'text', nullable: true }) title: string | null;
  @Column({ type: 'text', nullable: true }) body: string | null;
  @Column({ type: 'jsonb', nullable: true }) channels: Record<string, number> | null;
  @CreateDateColumn({ type: 'timestamptz' }) sentAt: Date;
}
