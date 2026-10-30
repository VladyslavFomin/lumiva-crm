import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelContractStatus = 'draft' | 'active' | 'expired' | 'cancelled';
export type HotelContractPricing = 'net' | 'commission';
export type HotelBoardType = 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | 'UAI';
export const HOTEL_BOARD_TYPES: HotelBoardType[] = ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI'];

/** Квота и цена одного типа номера в контракте. */
export interface HotelContractRoom {
  roomTypeId: string;
  /** Номеров в квоте на каждую ночь периода контракта */
  allotment: number;
  /** Release этой строки, дней до заезда; null — release контракта */
  releaseDays: number | null;
  /** Цена за ночь (нетто — при pricing=net, брутто — при pricing=commission); null — из прайса отеля */
  rate: string | null;
  /** Квота по датам: { 'YYYY-MM-DD': номеров } — переопределяет allotment на конкретные ночи */
  dateOverrides: Record<string, number>;
  /** Стоп-продажа по партнёру на даты */
  stopDates: string[];
}

export interface HotelCancellationRule {
  /** Отмена менее чем за N дней до заезда… */
  daysBefore: number;
  /** …штраф: процент от суммы или число ночей */
  penaltyType: 'percent' | 'nights';
  value: number;
}

/** Акция контракта: раннее бронирование (бронь до bookBy), спецпредложение на период проживания, длительное проживание. */
export interface HotelContractPromotion {
  id: string;
  type: 'early_booking' | 'spo' | 'long_stay';
  name: string;
  discountPct: number;
  /** Ранее бронирование: бронь создана не позже этой даты */
  bookBy: string | null;
  /** Период проживания (заезд внутри), необязательно */
  stayFrom: string | null;
  stayTo: string | null;
  /** Минимум ночей (для long_stay — обязательно) */
  minNights: number;
  /** Суммируется с другими акциями; иначе берётся лучшая */
  combinable: boolean;
}

export interface HotelChildPolicyRule {
  /** возраст от (включительно) и до (не включая): 0–2 = до 1,99 лет */
  ageFrom: number;
  ageTo: number;
  /** free — бесплатно, percent — % от цены взрослого */
  type: 'free' | 'percent';
  value: number;
  /** только для N-го ребёнка (1 — старший); 0 / нет — для любого */
  childNo?: number;
}

/** Контракт с партнёром на сезон по одному отелю: модель цены, питание, release, квоты по типам
 * номеров, политики отмены и детей. Бронь партнёра автоматически привязывается к действующему
 * контракту (по отелю и дате заезда), отсюда берутся комиссия и квота. */
@Entity('hotel_contracts')
@Index(['tenantId', 'agencyId'])
@Index(['tenantId', 'hotelId'])
export class HotelContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  agencyId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 48, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 12, default: 'draft' })
  status: HotelContractStatus;

  /** Период проживания */
  @Column({ type: 'date' })
  validFrom: string;

  @Column({ type: 'date' })
  validTo: string;

  /** Окно продаж (необязательно): брони, созданные вне окна, контракт не берут */
  @Column({ type: 'date', nullable: true })
  bookingFrom: string | null;

  @Column({ type: 'date', nullable: true })
  bookingTo: string | null;

  @Column({ type: 'varchar', length: 12, default: 'commission' })
  pricing: HotelContractPricing;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  commissionPct: string;

  @Column({ type: 'varchar', length: 4, default: 'BB' })
  boardType: HotelBoardType;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  /** Release по умолчанию, дней до заезда: позже квота возвращается в свободную продажу */
  @Column({ type: 'integer', default: 7 })
  releaseDays: number;

  /** Гарантированная квота: держит номера до release (иначе — мягкая, только учёт) */
  @Column({ type: 'boolean', default: false })
  guaranteed: boolean;

  /** Разрешить продажу сверх квоты (из свободных номеров) */
  @Column({ type: 'boolean', default: true })
  allowOverAllotment: boolean;

  /** Минимум ночей */
  @Column({ type: 'integer', default: 1 })
  minStay: number;

  /** Страны рынка контракта (ISO alpha-2); пусто — все */
  @Column({ type: 'text', array: true, default: '{}' })
  marketCountries: string[];

  @Column({ type: 'jsonb', default: [] })
  rooms: HotelContractRoom[];

  @Column({ type: 'jsonb', default: [] })
  cancellationPolicy: HotelCancellationRule[];

  @Column({ type: 'jsonb', default: [] })
  childPolicy: HotelChildPolicyRule[];

  @Column({ type: 'jsonb', default: [] })
  promotions: HotelContractPromotion[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
