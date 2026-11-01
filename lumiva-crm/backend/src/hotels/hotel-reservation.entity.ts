import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelReservationStatus =
  | 'confirmed'
  | 'pending'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

/** Статусы, которые не занимают номер и не дают выручку (кроме штрафа cancellationFee) */
export const HOTEL_INACTIVE_STATUSES: HotelReservationStatus[] = ['cancelled', 'no_show'];
/** SQL-фрагмент для query builder: `r.status NOT IN (${HOTEL_INACTIVE_SQL})` */
export const HOTEL_INACTIVE_SQL = `'cancelled','no_show'`;

export const HOTEL_CANCEL_REASONS = ['guest_request', 'partner', 'no_payment', 'duplicate', 'overbooking', 'force_majeure', 'option_expired', 'other'] as const;
export type HotelCancelReason = (typeof HOTEL_CANCEL_REASONS)[number];

/** Причины бесплатного проживания (PMS-029): маркетинговые (инфотур/блогер/PR) идут в бюджет маркетинга */
export const HOTEL_COMP_REASONS = ['infotour', 'influencer', 'pr', 'partner_visit', 'staff', 'vip', 'compensation', 'other'] as const;
export type HotelCompReason = (typeof HOTEL_COMP_REASONS)[number];

export type HotelReservationPaidStatus = 'full' | 'partial' | 'none' | 'refunded';

export type HotelReservationSource = 'manual' | 'import' | 'website' | 'demo' | 'walk_in' | 'channel';

export interface HotelReservationPayment {
  id: string;
  date: string;
  /** Отрицательная сумма — возврат */
  amount: string;
  method: string;
  note: string | null;
  /** Счёт, в который зачтён платёж (по умолчанию гостевой) */
  folio?: 'guest' | 'partner';
  /** Кассовая смена, в которую принят платёж */
  shiftId?: string | null;
  createdBy?: string | null;
  createdAt?: string;
}

/** channel — цена ночи из брони менеджера каналов (OTA) */
export type HotelRateSource = 'block' | 'contract' | 'calendar' | 'season' | 'market' | 'base' | 'channel';
export interface HotelNightlyRate {
  date: string;
  price: number;
  source: HotelRateSource;
  /** питание по тарифу за ночь (входит в price) */
  boardAmount?: number;
  /** Скидка календаря на дату, % (уже учтена в price) */
  discountPct?: number;
  /** Цена на человека (PP) этой ночи = price ÷ коэффициент размещения — для аналитики PP */
  pp?: number;
  /** Доплата за детей по детской политике (уже в price) */
  childAmount?: number;
}

export interface HotelReservationGuest {
  id: string;
  fullName: string;
  citizenship: string;
  passportNumber: string;
  passportExpiry: string;
  age: string;
  note: string | null;
  /** YYYY-MM-DD — для журнала гостей / KBS; age считается из неё */
  birthDate?: string;
  gender?: 'M' | 'F' | '';
  documentType?: 'passport' | 'id_card' | 'other' | '';
  /** Гражданство, ISO alpha-2 (citizenship — свободный текст для печати) */
  nationalityCode?: string | null;
  /** Для граждан Турции — T.C. Kimlik No (11 цифр) и имена родителей (поля KBS) */
  tcKimlikNo?: string;
  fatherName?: string;
  motherName?: string;
  /** Когда гость отмечен переданным в KBS / МВД */
  kbsReportedAt?: string | null;
  /** Россия, миграционный учёт иностранцев: место рождения, дата выдачи документа, миграционная карта, виза, цель въезда */
  birthPlace?: string;
  documentIssueDate?: string;
  migrationCard?: string;
  visaNumber?: string;
  entryPurpose?: 'tourism' | 'business' | 'private' | 'work' | 'study' | 'other' | '';
}

/** Гость хранится как обычное имя/pax — без Contact/Lead-матчинга (решение
 * пользователя в plan mode: ни один из 7 макетов не показывает CRM-привязку гостя). */
@Entity('hotel_reservations')
@Index(['tenantId', 'hotelId'])
@Index(['tenantId', 'checkIn'])
@Index(['tenantId', 'status'])
export class HotelReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'uuid', nullable: true })
  agencyId: string | null;

  /** Specific physical room (HotelRoomUnit) assigned to this stay — nullable, usually set at
   * check-in rather than at booking time (booking by room type without a specific room number
   * yet is the normal flow in real hotels). ON DELETE SET NULL so deactivating/removing a unit
   * never destroys reservation history. */
  @Column({ type: 'uuid', nullable: true })
  roomUnitId: string | null;

  /** Drives price auto-fill (HotelsPricingService.getReservationPrice) — which occupancy row
   * ("тип размещения": SGL, 2 AD, ...) this stay is priced as. ON DELETE SET NULL, same
   * never-destroy-history precedent as roomUnitId. */
  @Column({ type: 'uuid', nullable: true })
  occupancyTypeId: string | null;

  @Column({ type: 'varchar', length: 255 })
  guestName: string;

  /** Сырой снимок контактов гостя на самой брони — тот же паттерн, что
   * Reservation.customerEmail/customerPhone в модуле Booking, без привязки к Contact/Lead
   * (см. комментарий выше). Нужен для автоматизаций ("письмо гостю о новой брони"). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  guestEmail: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  guestPhone: string | null;

  @Column({ type: 'integer', default: 1 })
  pax: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  market: string | null;

  /** Страна гостя (проживания/гражданства ведущего гостя), ISO alpha-2 */
  @Column({ type: 'varchar', length: 2, nullable: true })
  guestCountry: string | null;

  /** Страна покупки (где продан тур), ISO alpha-2; по умолчанию — страна партнёра */
  @Column({ type: 'varchar', length: 2, nullable: true })
  saleCountry: string | null;

  /** Рынок отеля (hotel_markets.id) — определяется по стране гостя, можно выбрать вручную */
  @Column({ type: 'uuid', nullable: true })
  marketId: string | null;

  @Column({ type: 'uuid', nullable: true })
  contractId: string | null;

  @Column({ type: 'uuid', nullable: true })
  blockId: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  boardType: string | null;

  /** Комиссия партнёра, % и сумма; netTotal = total − комиссия (выручка отеля) */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  commissionPct: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  commissionAmount: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  netTotal: string;

  @Column({ type: 'integer', default: 0 })
  children: number;

  /** Бронь из менеджера каналов: подключение, id брони в канале (для изменений/отмен), OTA и её код брони */
  @Column({ type: 'uuid', nullable: true })
  channelConnectionId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  channelBookingId: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  otaName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  otaCode: string | null;

  /** Кто берёт оплату по брони из канала: property — отель (гость платит на месте / картой отелю), ota — OTA (Expedia Collect, Booking Payments) */
  @Column({ type: 'varchar', length: 12, nullable: true })
  paymentCollect: 'property' | 'ota' | null;

  /** Способ оплаты по данным канала: credit_card / bank_transfer */
  @Column({ type: 'varchar', length: 16, nullable: true })
  channelPaymentType: string | null;

  /** Возрасты детей (лет; null — не указан). children = дети младше hotel.childMaxAge */
  @Column({ type: 'jsonb', default: [] })
  childAges: Array<number | null>;

  @Column({ type: 'date' })
  checkIn: string;

  @Column({ type: 'date' })
  checkOut: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  costPerNight: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  ppPerNight: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  grossPerNight: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  ppTotal: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  roomTotal: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  discountPct: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'varchar', length: 16, default: 'confirmed' })
  status: HotelReservationStatus;

  @Column({ type: 'varchar', length: 16, default: 'none' })
  paidStatus: HotelReservationPaidStatus;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source: HotelReservationSource;

  /** Short human-readable code for the public storefront's "look up my reservation by code +
   * email" flow — only set for reservations created via that flow (source:'website'). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  bookingCode: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkedOutAt: Date | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  depositAmount: string;

  /** Срок предоплаты (depositAmount) по тарифу / акции; null — без срока */
  @Column({ type: 'date', nullable: true })
  depositDueDate: string | null;

  /** Тариф брони (питание, условия отмены и предоплаты); null — без тарифа (контракт, блок, старые брони) */
  @Column({ type: 'uuid', nullable: true })
  ratePlanId: string | null;

  /** Simple payment ledger — appended to by addPayment/removePayment, drives the auto-suggested
   * paidStatus (see HotelReservationsService.suggestPaidStatus). paidStatus itself stays directly
   * editable too, so staff can always override the suggestion. */
  @Column({ type: 'jsonb', default: [] })
  payments: HotelReservationPayment[];

  @Column({ type: 'boolean', default: false })
  earlyCheckIn: boolean;

  @Column({ type: 'boolean', default: false })
  lateCheckOut: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Full guest manifest for check-in (name/passport/age per guest) — separate from
   * guestName/guestEmail/guestPhone above, which stay the "booking contact" used for
   * automations/email. Not auto-synced with pax — both are independently editable. */
  @Column({ type: 'jsonb', default: [] })
  guests: HotelReservationGuest[];

  @Column({ type: 'varchar', length: 32, nullable: true })
  cancelReason: HotelCancelReason | null;

  @Column({ type: 'text', nullable: true })
  cancelNote: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /** Штраф за отмену / no-show (по политике контракта или вручную) — остаётся выручкой отеля */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  cancellationFee: string;

  @Column({ type: 'timestamptz', nullable: true })
  noShowAt: Date | null;

  /** Опцион (PMS-024): бронь в статусе pending снимается автоматически после этого момента */
  @Column({ type: 'timestamptz', nullable: true })
  optionUntil: Date | null;

  /** Бесплатное проживание: total = 0, а compValue — стоимость по цене брони (для отчёта и бюджета) */
  @Column({ type: 'boolean', default: false })
  isComplimentary: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  compReason: HotelCompReason | null;

  @Column({ type: 'text', nullable: true })
  compNote: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  compValue: string;

  /** В какой счёт идёт проживание: гостевой или партнёрский (агентство платит по выставленному счёту) */
  @Column({ type: 'varchar', length: 16, default: 'guest' })
  accommodationFolio: 'guest' | 'partner';

  /** auto — цена считается прайсом по ночам и пересчитывается при смене дат/номера/рынка; manual — введена вручную */
  @Column({ type: 'varchar', length: 8, default: 'manual' })
  priceMode: 'auto' | 'manual';

  /** Цена по ночам из расчёта (priceMode=auto): дата, цена, откуда взята */
  @Column({ type: 'jsonb', nullable: true })
  nightlyRates: HotelNightlyRate[] | null;

  /** Кэш суммы начислений фолио (доп. услуги, сборы, корректировки) — пересчитывается при каждой строке */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  extrasTotal: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
