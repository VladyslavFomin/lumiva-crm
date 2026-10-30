import type { HotelChildPolicyRule } from './hotel-contract.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelStatus = 'active' | 'draft';

@Entity('hotels')
@Index(['tenantId'])
export class Hotel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  country: string | null;

  @Column({ type: 'integer', default: 5 })
  stars: number;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: HotelStatus;

  @Column({ type: 'varchar', length: 8, default: '14:00' })
  checkInTime: string;

  @Column({ type: 'varchar', length: 8, default: '12:00' })
  checkOutTime: string;

  /** Какая рыночная группа (HotelMarketGroup) служит базой для Net PP при расчёте
   * "Цены с размещением" — по умолчанию первая созданная группа, если не задано явно. */
  @Column({ type: 'uuid', nullable: true })
  referenceMarketGroupId: string | null;

  /** Плановая выручка на сезон/период — используется в воронке выручки в аналитике. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  seasonRevenueTarget: string;

  /** Пороги риска для теплокарты дат заезда в аналитике (загрузка ниже bad% — красный, ниже
   * warn% — жёлтый). null означает "использовать значения по умолчанию (45/65)". */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  riskThresholdBadPct: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  riskThresholdWarnPct: string | null;

  /** "Информация об отеле" (factsheet) — гибкая карта полей (год открытия, реновация, лифты,
   * пляж, бассейны и т.д.), т.к. список полей специфичен для отельного бизнеса и не должен быть
   * жёстко зашит в схему. Тот же паттерн, что и HotelRoomType.infoFields. */
  @Column({ type: 'jsonb', default: {} })
  infoFields: Record<string, string | boolean>;

  @Column({ type: 'varchar', length: 512, nullable: true })
  coverPhotoUrl: string | null;

  /** Быстрые ссылки в настройках отеля (Google, TripAdvisor и т.п.) — открытый список, а не
   * фиксированные поля, т.к. набор площадок у каждого отеля свой. */
  @Column({ type: 'jsonb', default: [] })
  quickLinks: Array<{ label: string; url: string }>;

  /** Секрет для публичной XML/JSON-ленты номеров/цен (см. HotelFeedController) — доступ без
   * входа в CRM, только по этому токену в URL. null пока ни разу не запрашивался. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  feedToken: string | null;

  /** When true, HotelAvailabilityService.checkAvailability always returns ok — bypasses
   * capacity/stop-sale/blocked-date checks entirely for this hotel. Hotel-level, not per-request
   * (mirrors Booking's Project.overbookingAllowed precedent: no client-supplied force flag). */
  @Column({ type: 'boolean', default: false })
  allowOverbooking: boolean;

  /** Налог на проживание, % (Турция — konaklama vergisi); входит в базу НДС */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  accommodationTaxPct: string;

  /** НДС на проживание, % (Турция — KDV) */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  vatPct: string;

  /** Цены в бронях уже включают налоги (иначе налоги начисляются сверху) */
  @Column({ type: 'boolean', default: true })
  pricesIncludeTax: boolean;

  /** Бренд/сеть отеля (The Norm, Selectum…) — разрез аналитики отзывов (hotel-reputation). */
  @Column({ type: 'uuid', nullable: true })
  brandId: string | null;

  /** Что важнее для прямой продажи, если есть оба: сезонная цена группы рынка ('season') или плоская цена рынка ('market') */
  @Column({ type: 'varchar', length: 16, default: 'season' })
  pricingPriority: 'season' | 'market';

  /** Гость младше этого возраста — ребёнок (12 → ребёнок до 11,99 лет); старше — считается взрослым при подборе размещения */
  @Column({ type: 'smallint', default: 12 })
  childMaxAge: number;

  /** Сообщения WhatsApp от проживающих гостей → заявки Guest Care */
  @Column({ type: 'boolean', default: false })
  guestCareWhatsapp: boolean;

  /** Детская политика прямых продаж: полосы возраста → бесплатно / % от цены взрослого (у контракта партнёра — своя) */
  @Column({ type: 'jsonb', default: [] })
  childPolicy: HotelChildPolicyRule[];

  /** Ранний заезд / поздний выезд: % от цены ночи, начисляется в фолио автоматически (PMS-062) */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  earlyCheckInFeePct: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  lateCheckOutFeePct: string;

  /** Часовой пояс отеля (IANA) — для бизнес-даты и времени ночного аудита */
  @Column({ type: 'varchar', length: 64, default: 'Europe/Istanbul' })
  timezone: string;

  /** Бизнес-дата (PMS-092): открытый операционный день; null — ещё не было аудита, берётся сегодня по часовому поясу */
  @Column({ type: 'date', nullable: true })
  businessDate: string | null;

  /** Последний закрытый аудитом день — изменения денег на эту дату и раньше только с правом override (PMS-094) */
  @Column({ type: 'date', nullable: true })
  lastAuditDate: string | null;

  @Column({ type: 'boolean', default: false })
  nightAuditAuto: boolean;

  @Column({ type: 'varchar', length: 5, default: '03:00' })
  nightAuditTime: string;

  /** Кому отправлять отчёт аудита (через запятую) */
  @Column({ type: 'text', nullable: true })
  nightAuditEmails: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
