import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Счёт брони: гостевой или партнёрский (агентство/туроператор) — PMS-080 */
export type HotelFolioKind = 'guest' | 'partner';
export const HOTEL_FOLIO_LINE_KINDS = ['extra', 'board', 'minibar', 'early_checkin', 'late_checkout', 'fee', 'discount', 'adjustment'] as const;
export type HotelFolioLineKind = (typeof HOTEL_FOLIO_LINE_KINDS)[number];

/**
 * Начисление в фолио (PMS-081): доп. услуги, минибар, ранний заезд/поздний выезд, сборы, скидки, корректировки.
 * Проживание не постится строками — оно берётся из суммы брони. Строки не удаляются (PMS-086):
 * сторно — новая строка с обратной суммой и voidOfId, исходная помечается voided.
 */
@Entity('hotel_folio_lines')
@Index(['tenantId', 'reservationId'])
@Index(['tenantId', 'hotelId', 'serviceDate'])
export class HotelFolioLine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) reservationId: string;
  @Column({ type: 'varchar', length: 16, default: 'guest' }) folio: HotelFolioKind;
  @Column({ type: 'date' }) serviceDate: string;
  @Column({ type: 'varchar', length: 24, default: 'extra' }) kind: HotelFolioLineKind;
  @Column({ type: 'uuid', nullable: true }) extraServiceId: string | null;
  @Column({ type: 'varchar', length: 255 }) description: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 }) quantity: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) unitPrice: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) amount: string;
  @Column({ type: 'uuid', nullable: true }) voidOfId: string | null;
  @Column({ type: 'boolean', default: false }) voided: boolean;
  @Column({ type: 'text', nullable: true }) reason: string | null;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

export const HOTEL_EXTRA_CATEGORIES = ['fnb', 'minibar', 'spa', 'transfer', 'excursion', 'laundry', 'room', 'other'] as const;
export type HotelExtraCategory = (typeof HOTEL_EXTRA_CATEGORIES)[number];

/** Каталог доп. услуг отеля для быстрых начислений */
@Entity('hotel_extra_services')
@Index(['tenantId', 'hotelId'])
export class HotelExtraService {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 16, default: 'other' }) category: HotelExtraCategory;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) price: string;
  @Column({ type: 'boolean', default: true }) active: boolean;
  /** предлагать гостю в онлайн-регистрации (допродажа); цена — за проживание, за ночь или за гостя */
  @Column({ type: 'boolean', default: false }) sellOnline: boolean;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 12, default: 'per_stay' }) priceMode: 'per_stay' | 'per_night' | 'per_person';
  /** позиция точки продаж (ресторан, бар…) и входит ли во «всё включено» */
  @Column({ type: 'uuid', nullable: true }) outletId: string | null;
  @Column({ type: 'boolean', default: false }) aiIncluded: boolean;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

/** Кассовая смена (PMS-087): открытие с остатком, закрытие с пересчётом наличных и расхождением */
@Entity('hotel_cash_shifts')
@Index(['tenantId', 'hotelId', 'status'])
export class HotelCashShift {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 8, default: 'open' }) status: 'open' | 'closed';
  @Column({ type: 'uuid', nullable: true }) openedBy: string | null;
  @Column({ type: 'timestamptz' }) openedAt: Date;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) openingCash: string;
  @Column({ type: 'uuid', nullable: true }) closedBy: string | null;
  @Column({ type: 'timestamptz', nullable: true }) closedAt: Date | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true }) countedCash: string | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true }) expectedCash: string | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true }) difference: string | null;
  /** Итоги смены по способам оплаты на момент закрытия: { cash: 120, card: 300, ... } */
  @Column({ type: 'jsonb', nullable: true }) totals: Record<string, number> | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
}

/** Ночной аудит (PMS-090…093): закрытие бизнес-дня отеля со снимком показателей */
@Entity('hotel_night_audits')
@Index(['tenantId', 'hotelId', 'businessDate'], { unique: true })
export class HotelNightAudit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'date' }) businessDate: string;
  @Column({ type: 'varchar', length: 8, default: 'manual' }) mode: 'manual' | 'auto';
  @Column({ type: 'uuid', nullable: true }) runBy: string | null;
  @Column({ type: 'timestamptz' }) completedAt: Date;
  /** Что было на проверках и что сделано автоматически (no-show и т.п.) */
  @Column({ type: 'jsonb', default: {} }) checks: Record<string, unknown>;
  /** Снимок дня: загрузка, ADR, RevPAR, выручка, оплаты по способам, движение гостей */
  @Column({ type: 'jsonb', default: {} }) snapshot: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) reportSentAt: Date | null;
}
