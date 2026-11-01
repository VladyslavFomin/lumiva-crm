import { BadRequestException, ConflictException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  HotelNightlyRate,
  HOTEL_CANCEL_REASONS,
  HOTEL_COMP_REASONS,
  HotelCancelReason,
  HotelReservation,
  HotelReservationGuest,
  HotelReservationPaidStatus,
  HotelReservationPayment,
  HotelReservationStatus,
} from './hotel-reservation.entity';
import { normalizeNumericInput } from './hotel-number.util';
import { normalizeChildAges, splitGuests } from './hotel-occupancy.util';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HotelAvailabilityService } from './hotel-availability.service';
import { renderHotelFolioPdf } from './hotel-folio-pdf.util';
import { MailService } from '../mail/mail.service';
import { TenantMailService } from '../mail/tenant-mail.service';
import { tenantFrontend } from '../common/tenant-branding.util';
import { normalizeCountry } from '../common/countries';
import { HotelAgency } from './hotel-agency.entity';
import { HotelMarket } from './hotel-market.entity';
import { HotelRoomBlock } from './hotel-room-block.entity';
import { HOTEL_BOARD_TYPES } from './hotel-contract.entity';
import { HotelContractsService, promotionDiscount } from './hotel-contracts.service';
import { HotelRoomOutage } from './hotel-housekeeping.entities';
import { HotelFolioLine } from './hotel-folio.entities';
import { HotelRateEngineService } from './hotel-rate-engine.service';
import { businessDateOf, folioSummary, hotelToday, HotelFolioService } from './hotel-folio.service';
import { HotelRatePlansService, ratePlanPenalty, ratePlanPrepayment } from './hotel-rate-plans.service';
import type { HotelRatePlan } from './hotel-rate-plan.entity';
import { mergePrepayment, promotionsPrepayment } from './hotel-promotions.util';

export interface HotelReservationWriteOptions {
  /** Never populated from the HTTP request body — set only by the reservation-import flow for
   * historical data, mirroring Booking's import precedent. The only other bypass is hotel-level
   * Hotel.allowOverbooking. */
  skipValidation?: boolean;
  /** Правка денег в закрытых ночным аудитом днях (право hotels_night_audit) */
  allowClosed?: boolean;
  /** Цены по ночам из менеджера каналов (бронь OTA): итог брони — их сумма, без пересчёта прайсом */
  channelNights?: HotelNightlyRate[];
}

/** Возврат вместе с отменой / no-show */
export interface HotelCloseRefund {
  amount?: string | number | null;
  method?: string;
  folio?: 'guest' | 'partner';
  note?: string | null;
}

export const HOTEL_REFUND_METHODS = ['cash', 'card', 'bank_transfer', 'other'] as const;

export interface HotelReservationFilters {
  hotelId?: string;
  roomTypeId?: string;
  agencyId?: string;
  status?: string;
  market?: string;
  search?: string;
  contractId?: string;
  blockId?: string;
  guestCountry?: string;
  source?: string;
}

function toNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export interface HotelReservationInput {
  hotelId: string;
  roomTypeId: string;
  agencyId?: string | null;
  roomUnitId?: string | null;
  occupancyTypeId?: string | null;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  pax?: number;
  market?: string | null;
  checkIn: string;
  checkOut: string;
  costPerNight?: string;
  ppPerNight?: string;
  grossPerNight?: string;
  /** auto — посчитать цену прайсом (и пересчитывать при изменениях); manual — взять присланную */
  priceMode?: 'auto' | 'manual';
  discountPct?: string;
  status?: HotelReservationStatus;
  paidStatus?: HotelReservationPaidStatus;
  source?: 'manual' | 'import' | 'website' | 'walk_in' | 'channel';
  optionUntil?: string | Date | null;
  isComplimentary?: boolean;
  compReason?: string | null;
  compNote?: string | null;
  depositAmount?: string;
  earlyCheckIn?: boolean;
  lateCheckOut?: boolean;
  notes?: string | null;
  guests?: HotelReservationGuest[];
  bookingCode?: string | null;
  guestCountry?: string | null;
  saleCountry?: string | null;
  marketId?: string | null;
  contractId?: string | null;
  blockId?: string | null;
  boardType?: string | null;
  commissionPct?: string | number | null;
  children?: number;
  /** Состав гостей из формы: взрослые + возрасты детей → pax/children пересчитываются по возрасту ребёнка отеля */
  adults?: number;
  childAges?: Array<number | null>;
  /** updatedAt брони, с которой открыли форму — для защиты от перезаписи чужих правок */
  expectedUpdatedAt?: string;
  /** бронь из менеджера каналов */
  channelConnectionId?: string | null;
  channelBookingId?: string | null;
  otaName?: string | null;
  otaCode?: string | null;
  /** тариф брони; не задан — тариф отеля по умолчанию (кроме контракта, блока и канала); 'none' — явно без тарифа */
  ratePlanId?: string | null;
  /** снять акции отеля с брони (гость не внёс предоплату по условиям акции и т. п.) / вернуть — цена пересчитывается */
  promotionsOff?: boolean;
  /** кто берёт оплату по брони канала (property / ota) и способ оплаты — только из менеджера каналов */
  paymentCollect?: 'property' | 'ota' | null;
  channelPaymentType?: string | null;
}

const PRICE_FIELDS = ['costPerNight', 'ppPerNight', 'grossPerNight', 'discountPct'] as const;

/** Поля, изменения которых пишутся в историю брони (PMS-028) — поле, было, стало */
const HISTORY_FIELDS = [
  'hotelId', 'roomTypeId', 'roomUnitId', 'occupancyTypeId', 'agencyId', 'contractId', 'blockId',
  'guestName', 'guestEmail', 'guestPhone', 'pax', 'children', 'checkIn', 'checkOut', 'status', 'paidStatus',
  'boardType', 'market', 'guestCountry', 'saleCountry', 'costPerNight', 'ppPerNight', 'grossPerNight',
  'discountPct', 'commissionPct', 'total', 'depositAmount', 'depositDueDate', 'ratePlanId', 'promotionsOff', 'earlyCheckIn', 'lateCheckOut', 'notes',
  'optionUntil', 'isComplimentary', 'compReason', 'compNote', 'cancelReason', 'cancelNote', 'cancellationFee', 'priceMode',
] as const;

function historyValue(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseOptionUntil(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new BadRequestException({ code: 'HOTEL_OPTION_BAD_DATE', message: 'Неверная дата опциона' });
  return d;
}

/** Бесплатное проживание требует причину из справочника (PMS-029) */
function normalizeComp(dto: { isComplimentary?: boolean; compReason?: string | null }, current?: { isComplimentary: boolean; compReason: string | null }) {
  const isComp = dto.isComplimentary ?? current?.isComplimentary ?? false;
  const reason = dto.compReason !== undefined ? dto.compReason : current?.compReason ?? null;
  if (!isComp) return { isComplimentary: false, compReason: null as any };
  if (!reason || !(HOTEL_COMP_REASONS as readonly string[]).includes(reason)) {
    throw new BadRequestException({ code: 'HOTEL_COMP_REASON_REQUIRED', message: 'Укажите причину бесплатного проживания' });
  }
  return { isComplimentary: true, compReason: reason as any };
}

/** Штраф по политике отмены контракта: правило с наименьшим daysBefore, под которое попадает отмена */
export function cancellationPenalty(
  rules: Array<{ daysBefore: number; penaltyType: 'percent' | 'nights'; value: number }> | null | undefined,
  daysBeforeArrival: number,
  total: number,
  nightly: number,
) {
  const hit = [...(rules || [])]
    .filter((r) => Number.isFinite(Number(r.daysBefore)) && daysBeforeArrival < Number(r.daysBefore))
    .sort((a, b) => Number(a.daysBefore) - Number(b.daysBefore))[0];
  if (!hit) return { rule: null, fee: 0 };
  const fee = hit.penaltyType === 'nights' ? nightly * Number(hit.value) : (total * Number(hit.value)) / 100;
  return { rule: hit, fee: Math.round(Math.min(total, Math.max(0, fee)) * 100) / 100 };
}

function diffReservation(before: Partial<HotelReservation>, after: HotelReservation) {
  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  for (const f of HISTORY_FIELDS) {
    const a = historyValue((before as any)[f]);
    const b = historyValue((after as any)[f]);
    // numeric-колонки приходят строками с разной точностью ("120" vs "120.00")
    if (a !== null && b !== null && /^-?\d+(\.\d+)?$/.test(a) && /^-?\d+(\.\d+)?$/.test(b) && Number(a) === Number(b)) continue;
    if (a !== b) changes.push({ field: f, oldValue: a, newValue: b });
  }
  return changes;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface HotelReservationMoveInput {
  /** undefined — номер не меняется, null — снять номер (бронь уходит в «без номера») */
  roomUnitId?: string | null;
  /** Новый заезд; без checkOut длительность сохраняется */
  checkIn?: string;
  checkOut?: string;
  reason?: string;
  /** Номер занят одной бронью — поменять их местами */
  swap?: boolean;
}

const BLOCKING_STATUSES: HotelReservationStatus[] = ['confirmed', 'pending', 'checked_in'];

@Injectable()
export class HotelReservationsService {
  constructor(
    @InjectRepository(HotelReservation)
    private readonly repo: Repository<HotelReservation>,
    @InjectRepository(Hotel)
    private readonly hotelRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypeRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit)
    private readonly roomUnitsRepo: Repository<HotelRoomUnit>,
    private readonly roomTypesService: HotelRoomTypesService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    private readonly auditLog: AuditLogService,
    private readonly availability: HotelAvailabilityService,
    private readonly mail: MailService,
    private readonly tenantMail: TenantMailService,
    @InjectRepository(HotelAgency)
    private readonly partnersRepo: Repository<HotelAgency>,
    @InjectRepository(HotelMarket)
    private readonly marketsRepo: Repository<HotelMarket>,
    @InjectRepository(HotelRoomBlock)
    private readonly blocksRepo: Repository<HotelRoomBlock>,
    private readonly contracts: HotelContractsService,
    @InjectRepository(HotelRoomOutage)
    private readonly outagesRepo: Repository<HotelRoomOutage>,
    @InjectRepository(HotelFolioLine)
    private readonly folioLinesRepo: Repository<HotelFolioLine>,
    private readonly folio: HotelFolioService,
    private readonly rates: HotelRateEngineService,
    private readonly ratePlans: HotelRatePlansService,
  ) {}

  /**
   * Цена брони по прайсу (priceMode=auto): расчёт по ночам — блок/контракт/календарь/сезон по рынку/рынок/база.
   * Ночь без цены — ошибка с датами: такую бронь нужно оценить вручную.
   */
  /** Взрослые + возрасты детей → pax, children (младше hotel.childMaxAge), childAges. Ничего не прислали — не трогаем. */
  private async applyGuests(tenantId: string, row: HotelReservation, dto: Partial<HotelReservationInput>) {
    if (dto.adults === undefined && dto.childAges === undefined) return false;
    const hotel = await this.hotelRepo.findOne({ where: { id: row.hotelId, tenantId } });
    const ages = dto.childAges !== undefined ? normalizeChildAges(dto.childAges) : row.childAges || [];
    const prevAdults = Math.max(1, (row.pax || 1) - ((row.childAges || []).length || row.children || 0));
    const adults = dto.adults !== undefined ? Math.max(1, Math.min(20, Math.round(toNum(dto.adults)))) : prevAdults;
    const split = splitGuests(adults, ages, Number(hotel?.childMaxAge) || 12);
    const changed = row.pax !== adults + ages.length || row.children !== split.children || JSON.stringify(row.childAges || []) !== JSON.stringify(ages);
    row.childAges = ages;
    row.children = split.children;
    row.pax = adults + ages.length;
    return changed;
  }

  /** Состав для подбора размещения: взрослые «по паспорту» + возрасты (у старых броней без возрастов — дети без возраста) */
  private guestsForQuote(row: HotelReservation) {
    const ages = row.childAges?.length ? row.childAges : Array.from({ length: Math.max(0, row.children || 0) }, () => null);
    return { adults: Math.max(1, (row.pax || 1) - ages.length), childAges: ages };
  }

  /**
   * Тариф брони: у контракта, блока и брони из канала — свои условия (без тарифа). Иначе явно выбранный (того же отеля и
   * для этого типа номера) или тариф по умолчанию. Питание брони — из тарифа.
   */
  private async applyRatePlan(tenantId: string, row: HotelReservation, requested: string | null | undefined): Promise<HotelRatePlan | null> {
    if (row.contractId || row.blockId || row.source === 'channel') {
      row.ratePlanId = null;
      return null;
    }
    // 'none' — явно без тарифа (чистый прайс); null / не задан — тариф по умолчанию
    if (requested === 'none') {
      row.ratePlanId = null;
      return null;
    }
    const plan = await this.ratePlans.resolve(tenantId, row.hotelId, row.roomTypeId, requested === undefined ? row.ratePlanId : requested);
    row.ratePlanId = plan?.id ?? null;
    if (plan) row.boardType = plan.boardType;
    return plan;
  }

  /**
   * Предоплата брони: по тарифу и по условиям акций (EB: 50 % до даты) — большая сумма, самый ранний срок.
   * hadPromoPrepay — до правки предоплату требовала акция: акцию сняли, тарифа нет — требование снимается.
   */
  private async applyPrepayment(tenantId: string, row: HotelReservation, plan: HotelRatePlan | null, hadPromoPrepay = false) {
    const promoP = promotionsPrepayment(row.promotions, toNum(row.total));
    if ((!plan && !promoP) || row.isComplimentary) {
      if (plan === null && row.depositDueDate) row.depositDueDate = null;
      if (!plan && !promoP && hadPromoPrepay) row.depositAmount = '0';
      return;
    }
    const hotel = await this.hotelRepo.findOne({ where: { id: row.hotelId, tenantId } });
    const bookedOn = row.createdAt ? hotelToday(hotel, row.createdAt) : hotelToday(hotel);
    const nights = row.nightlyRates?.length ? row.nightlyRates.map((n) => toNum(n.price)) : Array.from({ length: nightsBetween(row.checkIn, row.checkOut) }, () => toNum(row.grossPerNight));
    const planP = plan ? ratePlanPrepayment(plan, { total: toNum(row.total), nights, checkIn: row.checkIn, bookedOn }) : null;
    const p = mergePrepayment(planP, promoP) || { amount: 0, dueDate: null };
    row.depositAmount = String(p.amount);
    row.depositDueDate = p.dueDate;
  }

  /** strict — состав гостей прислала форма: нет размещения под него → ошибка; иначе (API/старые брони по pax) — как раньше */
  private async applyAutoPrice(tenantId: string, row: HotelReservation, strict = false) {
    const q = await this.rates.quote(tenantId, {
      ...(row.occupancyTypeId ? {} : { ...this.guestsForQuote(row), strictOccupancy: strict }),
      roomTypeId: row.roomTypeId,
      occupancyTypeId: row.occupancyTypeId,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      marketId: row.marketId,
      market: row.market,
      guestCountry: row.guestCountry,
      contractId: row.contractId,
      blockId: row.blockId,
      ratePlanId: row.ratePlanId,
      useDefaultRatePlan: false,
      // акции — прямые продажи и сайт; у брони из канала цена канала. Дата брони — день создания (раннее бронирование)
      promotions: row.source === 'channel' || row.promotionsOff ? 'none' : 'auto',
      salesChannel: row.source === 'website' ? 'website' : 'direct',
      bookedAt: row.createdAt ?? null,
    });
    if (q.warnings.some((w) => w.code === 'no_occupancy')) {
      const g = q.guests;
      throw new BadRequestException({ code: 'HOTEL_OCCUPANCY_MISSING', message: `Нет размещения для ${g?.adults ?? '?'} взр. + ${g?.children ?? 0} дет. — добавьте его в «Ценах с размещением»`, adults: g?.adults, children: g?.children });
    }
    const missing = q.warnings.find((w) => w.code === 'no_price');
    if (missing) {
      throw new BadRequestException({ code: 'HOTEL_PRICE_MISSING', message: `Нет цены в прайсе на даты: ${missing.dates.join(', ')}`, dates: missing.dates });
    }
    row.nightlyRates = q.nights;
    row.promotions = q.promotions;
    row.grossPerNight = String(q.average);
    row.ppPerNight = String(q.ppAverage || q.seasonAverage || q.average);
    row.priceMode = 'auto';
    if (!row.occupancyTypeId && q.occupancyTypeId) row.occupancyTypeId = q.occupancyTypeId;
    if (!row.marketId && q.marketId) row.marketId = q.marketId;
    return q;
  }

  /** Предпросмотр цены для формы брони и walk-in */
  quote(tenantId: string, input: Parameters<HotelRateEngineService['quote']>[1]) {
    return this.rates.quote(tenantId, input);
  }

  /** Язык письма/счёта гостю по стране: TR → tr, СНГ → ru, иначе en */
  static guestLang(country: string | null | undefined): 'ru' | 'en' | 'tr' {
    const c = String(country || '').toUpperCase();
    if (c === 'TR') return 'tr';
    return ['RU', 'UA', 'BY', 'KZ', 'KG', 'UZ', 'AM', 'AZ', 'MD', 'TJ', 'TM', 'GE'].includes(c) ? 'ru' : 'en';
  }

  /** Сегодня по часовому поясу отеля брони */
  private async todayFor(tenantId: string, hotelId: string) {
    const h = await this.hotelRepo.findOne({ where: { id: hotelId, tenantId } });
    return hotelToday(h);
  }

  /** Номер снят с продажи (OOO) хотя бы на одну ночь периода */
  private async unitOutOfOrder(tenantId: string, unitId: string, from: string, to: string) {
    const n = await this.outagesRepo
      .createQueryBuilder('o')
      .where('o.tenantId = :tenantId AND o.roomUnitId = :unitId AND o.kind = :kind', { tenantId, unitId, kind: 'ooo' })
      .andWhere('o.dateFrom < :to', { to })
      .andWhere('(o.dateTo IS NULL OR o.dateTo > :from)', { from })
      .getCount();
    return n > 0;
  }

  /**
   * Условия партнёра на бронь: блок → контракт (явный или действующий по отелю/дате заезда/стране) →
   * комиссия (явная из формы, иначе контракта, иначе партнёра), питание, страна покупки (по умолчанию
   * страна партнёра), рынок отеля по стране гостя. Пересчитывается при создании и при смене этих полей.
   */
  private async applyPartnerTerms(tenantId: string, row: HotelReservation, dto: Partial<HotelReservationInput>) {
    row.guestCountry = normalizeCountry(row.guestCountry);
    row.saleCountry = normalizeCountry(row.saleCountry);
    if (row.boardType && !HOTEL_BOARD_TYPES.includes(row.boardType as any)) row.boardType = null;

    if (row.blockId) {
      const block = await this.blocksRepo.findOne({ where: { id: row.blockId, tenantId } });
      if (!block || block.hotelId !== row.hotelId || block.roomTypeId !== row.roomTypeId) {
        throw new BadRequestException('Блок не подходит: другой отель или тип номера');
      }
      if (!row.agencyId && block.agencyId) row.agencyId = block.agencyId;
      if (!row.contractId && block.contractId) row.contractId = block.contractId;
      if (!row.boardType && block.boardType) row.boardType = block.boardType;
      if (!row.guestCountry && block.countryCode) row.guestCountry = block.countryCode;
    }

    const partner = row.agencyId ? await this.partnersRepo.findOne({ where: { id: row.agencyId, tenantId } }) : null;
    if (row.agencyId && !partner) throw new BadRequestException('Партнёр не найден');

    let contract = row.contractId ? await this.contracts.get(tenantId, row.contractId).catch(() => null) : null;
    if (contract && (contract.agencyId !== row.agencyId || contract.hotelId !== row.hotelId)) contract = null;
    if (!contract && partner && dto.contractId === undefined) {
      contract = await this.contracts.resolveForReservation(tenantId, {
        agencyId: partner.id,
        hotelId: row.hotelId,
        checkIn: row.checkIn,
        guestCountry: row.guestCountry,
      });
    }
    row.contractId = contract?.id ?? null;

    if (dto.commissionPct !== undefined && dto.commissionPct !== null && String(dto.commissionPct) !== '') {
      row.commissionPct = String(Math.min(100, Math.max(0, toNum(dto.commissionPct))));
    } else if (contract) {
      row.commissionPct = contract.pricing === 'net' ? '0' : contract.commissionPct;
    } else {
      row.commissionPct = partner?.commissionPct ?? '0';
    }
    if (!row.boardType && contract) row.boardType = contract.boardType;
    if (!row.saleCountry && partner?.countryCode) row.saleCountry = partner.countryCode;

    // рынок брони: явный ID → явный код → по стране гостя; код и ID всегда согласованы
    // (раньше при смене страны ID пересчитывался, а код оставался старым — «гость из РФ, рынок Германия»)
    const hotelMarkets = await this.marketsRepo.find({ where: { tenantId, hotelId: row.hotelId } });
    if (dto.marketId === undefined && dto.market) {
      const byCode = hotelMarkets.find((x) => x.code === dto.market);
      if (byCode) row.marketId = byCode.id;
    }
    if (dto.marketId === undefined && !dto.market && row.guestCountry && !row.marketId) {
      const m = hotelMarkets.find((x) => (x.countryCodes || []).includes(row.guestCountry!));
      if (m) row.marketId = m.id;
    }
    if (row.marketId) {
      const m = hotelMarkets.find((x) => x.id === row.marketId);
      if (m) row.market = m.code;
      else row.marketId = null;
    }
  }

  /** Проверяет заполняемость типа номера за месяц заезда и, если она достигла/превысила
   * порог отеля (Hotel.riskThresholdWarnPct, тот же порог, что у теплокарты в аналитике),
   * шлёт HOTEL_LOW_AVAILABILITY. Срабатывает при создании/отмене брони — без отдельного
   * планировщика (см. план: "fire-on-write, not a new cron"). */
  private async checkLowAvailability(tenantId: string, reservation: HotelReservation, adminEmails: string[]) {
    try {
      const [year, month] = reservation.checkIn.split('-').map(Number);
      const monthStats = await this.roomTypesService.getMonthFillStats(tenantId, reservation.roomTypeId, year, month - 1);
      const hotel = await this.hotelRepo.findOne({ where: { id: reservation.hotelId, tenantId } });
      const warnPct = toNum(hotel?.riskThresholdWarnPct) || 65;
      if (monthStats.occupancyPct >= warnPct) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_LOW_AVAILABILITY, {
          entityType: 'hotel_room_type',
          entityId: reservation.roomTypeId,
          hotel,
          monthStats,
          adminEmails,
        });
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
  }

  async list(tenantId: string, filters: HotelReservationFilters) {
    const qb = this.repo.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId });
    if (filters.hotelId) qb.andWhere('r.hotelId = :hotelId', { hotelId: filters.hotelId });
    if (filters.roomTypeId) qb.andWhere('r.roomTypeId = :roomTypeId', { roomTypeId: filters.roomTypeId });
    if (filters.agencyId) qb.andWhere('r.agencyId = :agencyId', { agencyId: filters.agencyId });
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.market) qb.andWhere('r.market = :market', { market: filters.market });
    if (filters.contractId) qb.andWhere('r.contractId = :contractId', { contractId: filters.contractId });
    if (filters.blockId) qb.andWhere('r.blockId = :blockId', { blockId: filters.blockId });
    if (filters.guestCountry) qb.andWhere('r.guestCountry = :gc', { gc: String(filters.guestCountry).toUpperCase() });
    if (filters.source) qb.andWhere('r.source = :source', { source: filters.source });
    if (filters.search) {
      qb.andWhere('(r.guestName ILIKE :search OR r.bookingCode ILIKE :search OR r.guestEmail ILIKE :search OR r.guestPhone ILIKE :search)', { search: `%${filters.search}%` });
    }
    qb.orderBy('r.createdAt', 'DESC');
    return qb.getMany();
  }

  async get(tenantId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Бронь не найдена');
    return row;
  }

  private computeTotals(row: HotelReservation) {
    const nights = nightsBetween(row.checkIn, row.checkOut);
    row.ppTotal = String(round2(toNum(row.ppPerNight) * nights));
    // цена по ночам из прайса — итог суммой ночей (сезоны и даты календаря могут отличаться), иначе цена ночи × ночи
    row.roomTotal = (row.priceMode === 'auto' || row.source === 'channel') && row.nightlyRates?.length === nights
      ? String(round2(row.nightlyRates.reduce((s, n) => s + toNum(n.price), 0)))
      : String(round2(toNum(row.grossPerNight) * nights));
    row.total = String(round2(toNum(row.roomTotal) * (1 - toNum(row.discountPct) / 100)));
    if (row.isComplimentary) {
      // стоимость считаем по цене брони, но гостю/партнёру — 0: в отчёт бесплатных и бюджет идёт compValue
      row.compValue = row.total;
      row.total = '0';
    } else {
      row.compValue = '0';
    }
    row.commissionAmount = String(round2(toNum(row.total) * (toNum(row.commissionPct) / 100)));
    row.netTotal = String(round2(toNum(row.total) - toNum(row.commissionAmount)));
  }

  async create(
    tenantId: string,
    dto: HotelReservationInput,
    actorUserId?: string | null,
    options: HotelReservationWriteOptions = {},
  ) {
    const row = this.repo.create({
      tenantId,
      hotelId: dto.hotelId,
      roomTypeId: dto.roomTypeId,
      agencyId: dto.agencyId ?? null,
      roomUnitId: dto.roomUnitId ?? null,
      occupancyTypeId: dto.occupancyTypeId ?? null,
      guestName: dto.guestName,
      guestEmail: dto.guestEmail ?? null,
      guestPhone: dto.guestPhone ?? null,
      pax: dto.pax ?? 1,
      market: dto.market ?? null,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      costPerNight: normalizeNumericInput(dto.costPerNight),
      ppPerNight: normalizeNumericInput(dto.ppPerNight),
      grossPerNight: normalizeNumericInput(dto.grossPerNight),
      discountPct: normalizeNumericInput(dto.discountPct),
      status: dto.status ?? 'confirmed',
      paidStatus: dto.paidStatus ?? 'none',
      source: dto.source ?? 'manual',
      depositAmount: dto.depositAmount !== undefined ? normalizeNumericInput(dto.depositAmount) : '0',
      promotionsOff: dto.promotionsOff === true,
      promotions: [],
      earlyCheckIn: dto.earlyCheckIn ?? false,
      lateCheckOut: dto.lateCheckOut ?? false,
      notes: dto.notes ?? null,
      guests: dto.guests ?? [],
      bookingCode: dto.bookingCode ?? null,
      guestCountry: dto.guestCountry ?? null,
      saleCountry: dto.saleCountry ?? null,
      marketId: dto.marketId ?? null,
      contractId: dto.contractId ?? null,
      blockId: dto.blockId ?? null,
      boardType: dto.boardType ?? null,
      children: Math.max(0, Math.round(toNum(dto.children))),
      channelConnectionId: dto.channelConnectionId ?? null,
      channelBookingId: dto.channelBookingId ?? null,
      otaName: dto.otaName ?? null,
      paymentCollect: dto.paymentCollect === 'ota' || dto.paymentCollect === 'property' ? dto.paymentCollect : null,
      channelPaymentType: dto.channelPaymentType ? String(dto.channelPaymentType).slice(0, 16) : null,
      otaCode: dto.otaCode ?? null,
      optionUntil: parseOptionUntil(dto.optionUntil),
      ...normalizeComp(dto),
      compNote: dto.isComplimentary ? dto.compNote ?? null : null,
    });
    await this.applyPartnerTerms(tenantId, row, dto);
    // проживание — в счёт партнёра, если он платит по выставленному счёту (постоплата)
    if ((dto as any).accommodationFolio === 'partner' || (dto as any).accommodationFolio === 'guest') {
      row.accommodationFolio = row.agencyId ? (dto as any).accommodationFolio : 'guest';
    } else if (row.agencyId) {
      const partner = await this.partnersRepo.findOne({ where: { id: row.agencyId, tenantId } });
      row.accommodationFolio = partner?.paymentTerms === 'postpayment' ? 'partner' : 'guest';
    }
    // акции контракта (раннее бронирование / SPO / длительное проживание) — если скидку не задали явно
    if (dto.discountPct === undefined && row.contractId) {
      const c = await this.contracts.get(tenantId, row.contractId).catch(() => null);
      const promo = promotionDiscount(c, { checkIn: row.checkIn, checkOut: row.checkOut, bookedOn: new Date().toISOString().slice(0, 10) });
      if (promo.pct) row.discountPct = String(promo.pct);
    }
    await this.applyGuests(tenantId, row, dto);
    const plan = await this.applyRatePlan(tenantId, row, dto.ratePlanId ?? null);
    const strictGuests = dto.adults !== undefined || dto.childAges !== undefined;
    const noPriceGiven = (v: unknown) => v === undefined || v === null || v === '';
    // импорт истории (skipValidation) без цен не пересчитываем прайсом — переносим как есть
    if (dto.priceMode === 'auto' || (!options.skipValidation && dto.priceMode !== 'manual' && noPriceGiven(dto.grossPerNight) && noPriceGiven(dto.ppPerNight))) {
      await this.applyAutoPrice(tenantId, row, strictGuests);
    } else {
      row.priceMode = 'manual';
      row.nightlyRates = null;
      row.promotions = [];
    }
    if (options.channelNights?.length) row.nightlyRates = options.channelNights;
    if (!options.skipValidation) {
      const result = await this.availability.checkAvailability({
        tenantId,
        roomTypeId: row.roomTypeId,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        contractId: row.contractId,
        blockId: row.blockId,
      });
      if (!result.ok) throw new BadRequestException(result.reason);
      if (row.roomUnitId && (await this.unitOutOfOrder(tenantId, row.roomUnitId, row.checkIn, row.checkOut))) {
        throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_OOO', message: 'Номер выведен из эксплуатации на эти даты' });
      }
    }
    this.computeTotals(row);
    // предоплата по тарифу, если сумму не задали явно
    if (dto.depositAmount === undefined) await this.applyPrepayment(tenantId, row, plan);
    const saved = await this.repo.save(row);

    try {
      const [hotel, roomType, adminEmails] = await Promise.all([
        this.hotelRepo.findOne({ where: { id: saved.hotelId, tenantId } }),
        this.roomTypeRepo.findOne({ where: { id: saved.roomTypeId, tenantId } }),
        this.automationsService.resolveAdminEmails(tenantId),
      ]);
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_RESERVATION_CREATED, {
        entityType: 'hotel_reservation',
        entityId: saved.id,
        reservation: saved,
        hotel,
        roomType,
        adminEmails,
        ...this.buildNotificationTokens(saved, hotel, roomType),
      });
      await this.checkLowAvailability(tenantId, saved, adminEmails);
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'create',
      summary: 'Бронь отеля создана',
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<HotelReservationInput>,
    actorUserId?: string | null,
    options: HotelReservationWriteOptions = {},
  ) {
    const row = await this.get(tenantId, id);
    // форма открыта по старой версии брони, а её уже изменили — не перезаписываем чужие правки молча
    if (dto.expectedUpdatedAt && row.updatedAt && new Date(dto.expectedUpdatedAt).getTime() !== new Date(row.updatedAt).getTime()) {
      throw new ConflictException({ code: 'HOTEL_RES_STALE', message: 'Бронь изменили, пока вы её редактировали — откройте заново', updatedAt: row.updatedAt });
    }
    const before = { ...row };
    const fromStatus = row.status;
    const priceFieldsChanged = PRICE_FIELDS.some(
      (key) => dto[key] !== undefined && normalizeNumericInput(dto[key]) !== row[key],
    );
    const datesOrRoomChanged =
      (dto.checkIn !== undefined && dto.checkIn !== row.checkIn) ||
      (dto.checkOut !== undefined && dto.checkOut !== row.checkOut) ||
      (dto.roomTypeId !== undefined && dto.roomTypeId !== row.roomTypeId) ||
      (dto.contractId !== undefined && dto.contractId !== row.contractId) ||
      (dto.blockId !== undefined && dto.blockId !== row.blockId);
    const termsChanged =
      datesOrRoomChanged ||
      (dto.agencyId !== undefined && dto.agencyId !== row.agencyId) ||
      (dto.hotelId !== undefined && dto.hotelId !== row.hotelId) ||
      ['guestCountry', 'saleCountry', 'marketId', 'boardType', 'commissionPct'].some((k) => (dto as any)[k] !== undefined);

    // проживание, целиком попавшее в закрытые аудитом дни, меняется только с правом override (PMS-094)
    if (!options.allowClosed && (priceFieldsChanged || datesOrRoomChanged)) {
      const h = await this.hotelRepo.findOne({ where: { id: row.hotelId, tenantId } });
      if (h?.lastAuditDate && row.checkOut <= h.lastAuditDate) {
        throw new BadRequestException({ code: 'HOTEL_DAY_CLOSED', message: 'Проживание в закрытых аудитом днях — нужна правка с правом ночного аудита' });
      }
    }
    const normalized: any = { ...dto };
    for (const key of PRICE_FIELDS) {
      if (normalized[key] !== undefined) normalized[key] = normalizeNumericInput(normalized[key]);
    }
    if (normalized.depositAmount !== undefined) normalized.depositAmount = normalizeNumericInput(normalized.depositAmount);
    if (normalized.children !== undefined) normalized.children = Math.max(0, Math.round(toNum(normalized.children)));
    delete normalized.commissionPct;
    // смена партнёра/отеля/дат без явного контракта — контракт подбирается заново
    if (dto.contractId === undefined && ((dto.agencyId !== undefined && dto.agencyId !== row.agencyId) || (dto.hotelId !== undefined && dto.hotelId !== row.hotelId) || (dto.checkIn !== undefined && dto.checkIn !== row.checkIn))) {
      normalized.contractId = null;
    }
    if (dto.guestCountry !== undefined && dto.marketId === undefined) normalized.marketId = null;
    if (dto.optionUntil !== undefined) normalized.optionUntil = parseOptionUntil(dto.optionUntil);
    if (dto.isComplimentary !== undefined || dto.compReason !== undefined) {
      Object.assign(normalized, normalizeComp(dto, row));
      if (!normalized.isComplimentary) normalized.compNote = null;
    }
    // служебные поля жизненного цикла меняются только своими действиями (cancel / noShow)
    for (const k of ['cancelReason', 'cancelNote', 'cancelledAt', 'cancellationFee', 'noShowAt', 'compValue', 'extrasTotal', 'accommodationFolio', 'payments', 'priceMode', 'nightlyRates', 'promotions']) delete normalized[k];
    if (normalized.promotionsOff !== undefined) normalized.promotionsOff = normalized.promotionsOff === true;
    if (dto.status === 'cancelled' && row.status !== 'cancelled') normalized.cancelledAt = new Date();
    if (dto.status === 'no_show' && row.status !== 'no_show') normalized.noShowAt = new Date();
    if (dto.status && dto.status !== 'pending') normalized.optionUntil = null;
    delete normalized.adults;
    delete normalized.childAges;
    delete normalized.expectedUpdatedAt;
    // привязка к каналу меняется только при загрузке из канала
    for (const k of ['channelConnectionId', 'channelBookingId']) delete normalized[k];
    if (normalized.paymentCollect !== undefined && !['ota', 'property', null].includes(normalized.paymentCollect)) delete normalized.paymentCollect;
    // тариф ставится через applyRatePlan (с проверкой), срок предоплаты — дата или пусто
    delete normalized.ratePlanId;
    if (normalized.depositDueDate !== undefined && normalized.depositDueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(normalized.depositDueDate))) delete normalized.depositDueDate;
    Object.assign(row, normalized);
    // состав гостей поменялся, а размещение явно не прислали — подбираем заново по составу
    const guestsChanged = (await this.applyGuests(tenantId, row, dto)) || (dto.pax !== undefined && dto.pax !== before.pax) || (dto.children !== undefined && Number(dto.children) !== before.children);
    if (guestsChanged && dto.occupancyTypeId === undefined) row.occupancyTypeId = null;
    if (termsChanged) await this.applyPartnerTerms(tenantId, row, dto);
    // тариф: прислали другой, или сменился тип номера / отель / партнёрские условия — проверяем заново
    const planTouched = dto.ratePlanId !== undefined || datesOrRoomChanged || termsChanged;
    const plan = planTouched ? await this.applyRatePlan(tenantId, row, dto.ratePlanId !== undefined ? dto.ratePlanId : row.ratePlanId) : row.ratePlanId ? await this.ratePlans.get(tenantId, row.ratePlanId).catch(() => null) : null;
    const planChanged = (row.ratePlanId ?? null) !== (before.ratePlanId ?? null);
    // цена: явно «по прайсу» → пересчёт; бронь в авто-режиме и поменялись условия цены → пересчёт; прислали цену руками → ручная
    // себестоимость — не цена продажи, её правка режим цены не меняет; сравниваем числа ("120" и "120.00" — одно)
    const manualPriceSent = dto.priceMode !== 'auto' && (['ppPerNight', 'grossPerNight'] as const).some((k) => dto[k] !== undefined && Number(normalizeNumericInput(dto[k])) !== Number((before as any)[k]));
    const promoToggled = dto.promotionsOff !== undefined && (dto.promotionsOff === true) !== !!before.promotionsOff;
    if (promoToggled && (row.source === 'channel' || row.contractId || row.blockId)) {
      throw new BadRequestException({ code: 'HOTEL_PROMO_PARTNER', message: 'У брони из канала, по контракту или блоку свои условия — акции отеля к ней не применяются' });
    }
    if (promoToggled && row.priceMode !== 'auto' && dto.priceMode !== 'auto') {
      throw new BadRequestException({ code: 'HOTEL_PROMO_MANUAL', message: 'Цена брони введена вручную — акции применяются только к цене по прайсу' });
    }
    const priceInputsChanged = promoToggled || datesOrRoomChanged || termsChanged || guestsChanged || planChanged || (dto.occupancyTypeId !== undefined && dto.occupancyTypeId !== before.occupancyTypeId) || (dto.market !== undefined && dto.market !== before.market);
    if (dto.priceMode === 'auto' || (row.priceMode === 'auto' && !manualPriceSent && priceInputsChanged)) {
      await this.applyAutoPrice(tenantId, row, dto.adults !== undefined || dto.childAges !== undefined);
    } else if (manualPriceSent || dto.priceMode === 'manual') {
      row.priceMode = 'manual';
      row.nightlyRates = null;
      row.promotions = [];
    }
    if (options.channelNights?.length) row.nightlyRates = options.channelNights;

    if (datesOrRoomChanged && !options.skipValidation) {
      const result = await this.availability.checkAvailability({
        tenantId,
        roomTypeId: row.roomTypeId,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        excludeReservationId: id,
        contractId: row.contractId,
        blockId: row.blockId,
      });
      if (!result.ok) throw new BadRequestException(result.reason);
    }
    const unitTouched = (dto.roomUnitId !== undefined && dto.roomUnitId !== before.roomUnitId) || datesOrRoomChanged;
    if (!options.skipValidation && unitTouched && row.roomUnitId && ['confirmed', 'pending'].includes(row.status)
      && (await this.unitOutOfOrder(tenantId, row.roomUnitId, row.checkIn, row.checkOut))) {
      throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_OOO', message: 'Номер выведен из эксплуатации на эти даты' });
    }
    this.computeTotals(row);
    // предоплата по тарифу пересчитывается, если поменялись тариф или сумма, а её не задали явно (оплаченную не трогаем)
    const hadPromoPrepay = (before.promotions || []).some((a) => a.prepaymentPct > 0);
    const promosChanged = JSON.stringify((row.promotions || []).map((a) => [a.id, a.amount])) !== JSON.stringify((before.promotions || []).map((a) => [a.id, a.amount]));
    const needsPrepay = plan || hadPromoPrepay || (row.promotions || []).some((a) => a.prepaymentPct > 0);
    if (dto.depositAmount === undefined && needsPrepay && (planChanged || promosChanged || toNum(row.total) !== toNum(before.total))) {
      await this.applyPrepayment(tenantId, row, plan, hadPromoPrepay);
    }
    if (planChanged && !plan && !promotionsPrepayment(row.promotions, toNum(row.total))) row.depositDueDate = null;
    const saved = await this.repo.save(row);

    try {
      const adminEmails = await this.automationsService.resolveAdminEmails(tenantId);
      const statusChanged = dto.status !== undefined && dto.status !== fromStatus;
      let hotel: Hotel | null = null;
      let roomType: HotelRoomType | null = null;
      if (statusChanged || priceFieldsChanged) {
        [hotel, roomType] = await Promise.all([
          this.hotelRepo.findOne({ where: { id: saved.hotelId, tenantId } }),
          this.roomTypeRepo.findOne({ where: { id: saved.roomTypeId, tenantId } }),
        ]);
      }
      if (dto.status !== undefined && dto.status !== fromStatus) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_RESERVATION_STATUS_CHANGED, {
          entityType: 'hotel_reservation',
          entityId: id,
          reservation: saved,
          fromStatus,
          toStatus: saved.status,
          adminEmails,
          ...this.buildNotificationTokens(saved, hotel, roomType),
        });
        if (saved.status === 'cancelled') {
          await this.checkLowAvailability(tenantId, saved, adminEmails);
        }
      }
      if (priceFieldsChanged) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_PRICE_CHANGED, {
          entityType: 'hotel_reservation',
          entityId: id,
          reservation: saved,
          ...this.buildNotificationTokens(saved, hotel, roomType),
        });
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: dto.status !== undefined && dto.status !== fromStatus
        ? `Статус брони изменён: ${fromStatus} → ${saved.status}`
        : 'Бронь отеля обновлена',
      changes: diffReservation(before, saved),
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  /** Fires HOTEL_RESERVATION_STATUS_CHANGED — shared by update() (generic status field edit) and
   * checkIn()/checkOut() (dedicated front-desk actions) so the automation-trigger logic isn't
   * duplicated across all three status-changing call sites. */
  private async fireStatusChangeTrigger(
    tenantId: string,
    saved: HotelReservation,
    fromStatus: HotelReservationStatus,
  ) {
    try {
      const adminEmails = await this.automationsService.resolveAdminEmails(tenantId);
      const [hotel, roomType] = await Promise.all([
        this.hotelRepo.findOne({ where: { id: saved.hotelId, tenantId } }),
        this.roomTypeRepo.findOne({ where: { id: saved.roomTypeId, tenantId } }),
      ]);
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_RESERVATION_STATUS_CHANGED, {
        entityType: 'hotel_reservation',
        entityId: saved.id,
        reservation: saved,
        fromStatus,
        toStatus: saved.status,
        adminEmails,
        ...this.buildNotificationTokens(saved, hotel, roomType),
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
  }

  async checkIn(tenantId: string, id: string, roomUnitId: string | null | undefined, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    if (row.status === 'checked_in') throw new BadRequestException('Гость уже заселён');
    if (row.status === 'cancelled') throw new BadRequestException('Бронь отменена');
    if (row.status === 'no_show') throw new BadRequestException({ code: 'HOTEL_CHECKIN_NO_SHOW', message: 'Бронь отмечена как no-show — сначала верните статус «Подтверждена»' });
    const prevUnitId = row.roomUnitId;

    if (roomUnitId) {
      const unit = await this.roomUnitsRepo.findOne({
        where: { id: roomUnitId, tenantId, roomTypeId: row.roomTypeId, active: true },
      });
      if (!unit) throw new BadRequestException('Номер не найден или не принадлежит этому типу номера');
      const today = await this.todayFor(tenantId, row.hotelId);
      const stayFrom = row.checkIn > today ? row.checkIn : today;
      if (unit.housekeepingStatus === 'out_of_order' || (stayFrom < row.checkOut && (await this.unitOutOfOrder(tenantId, unit.id, stayFrom, row.checkOut)))) {
        throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_OOO', message: 'Номер выведен из эксплуатации' });
      }

      // Раньше проверка занятости номера была только на фронтенде (дизейбл в выпадающем
      // списке по once-loaded списку броней) — прямой вызов API или гонка двух front-desk
      // сессий могли заселить двух гостей в один номер на пересекающиеся даты.
      const overlapping = await this.repo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId', { tenantId })
        .andWhere('r.roomUnitId = :roomUnitId', { roomUnitId })
        .andWhere('r.id != :id', { id })
        .andWhere('r.status IN (:...statuses)', { statuses: ['confirmed', 'pending', 'checked_in'] })
        .andWhere('r.checkIn < :checkOut', { checkOut: row.checkOut })
        .andWhere('r.checkOut > :checkIn', { checkIn: row.checkIn })
        .getOne();
      if (overlapping) throw new BadRequestException('Номер уже занят на эти даты другой бронью');

      row.roomUnitId = roomUnitId;
    }

    const fromStatus = row.status;
    row.status = 'checked_in';
    row.checkedInAt = new Date();
    row.optionUntil = null;
    const saved = await this.repo.save(row);
    if (saved.earlyCheckIn) await this.folio.autoTimeFee(tenantId, saved, 'early_checkin', actorUserId ?? null);

    await this.fireStatusChangeTrigger(tenantId, saved, fromStatus);

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: 'Гость заселён',
      changes: [
        { field: 'status', oldValue: fromStatus, newValue: saved.status },
        ...(roomUnitId && roomUnitId !== prevUnitId ? [{ field: 'roomUnitId', oldValue: prevUnitId, newValue: roomUnitId }] : []),
      ],
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async checkOut(tenantId: string, id: string, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    if (row.status !== 'checked_in') throw new BadRequestException('Бронь не в статусе «Заселён»');

    if (row.lateCheckOut) await this.folio.autoTimeFee(tenantId, row, 'late_checkout', actorUserId ?? null);
    const fromStatus = row.status;
    row.status = 'checked_out';
    row.checkedOutAt = new Date();
    const saved = await this.repo.save(row);
    // после выезда номер нужно убрать — он попадает в план уборки
    if (saved.roomUnitId) {
      await this.roomUnitsRepo.update({ tenantId, id: saved.roomUnitId, housekeepingStatus: In(['clean', 'inspected']) }, { housekeepingStatus: 'dirty' });
    }

    await this.fireStatusChangeTrigger(tenantId, saved, fromStatus);

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: 'Гость выселен',
      changes: [{ field: 'status', oldValue: fromStatus, newValue: saved.status }],
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  /**
   * Перенос из шахматки (PMS-011/025/065): другой номер (в т.ч. другого типа), сдвиг дат с сохранением
   * длительности, продление/сокращение. Цена за ночь сохраняется, итоги пересчитываются. Заселённого гостя
   * можно только переселить (дата заезда не меняется, причина обязательна), старый номер — «грязный».
   * Номер занят → 409 HOTEL_MOVE_CONFLICT со списком броней; swap=true меняет местами с единственной такой бронью.
   */
  async move(tenantId: string, id: string, dto: HotelReservationMoveInput, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    if (row.status === 'cancelled' || row.status === 'checked_out' || row.status === 'no_show') {
      throw new BadRequestException({ code: 'HOTEL_MOVE_CLOSED', message: 'Отменённую или выселенную бронь нельзя перенести' });
    }
    const nights = nightsBetween(row.checkIn, row.checkOut);
    const checkIn = dto.checkIn ?? row.checkIn;
    const checkOut = dto.checkOut ?? (dto.checkIn ? addDaysIso(dto.checkIn, nights) : row.checkOut);
    if (!ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut) || checkOut <= checkIn) {
      throw new BadRequestException({ code: 'HOTEL_MOVE_BAD_DATES', message: 'Дата выезда должна быть позже даты заезда' });
    }
    const unitChanging = dto.roomUnitId !== undefined && (dto.roomUnitId || null) !== row.roomUnitId;
    const targetUnitId = dto.roomUnitId === undefined ? row.roomUnitId : dto.roomUnitId || null;
    const reason = String(dto.reason || '').trim().slice(0, 500) || null;
    const inHouse = row.status === 'checked_in';

    if (inHouse) {
      if (checkIn !== row.checkIn) {
        throw new BadRequestException({ code: 'HOTEL_MOVE_IN_HOUSE_DATES', message: 'Гость уже заселён — дату заезда изменить нельзя' });
      }
      if (unitChanging && !targetUnitId) {
        throw new BadRequestException({ code: 'HOTEL_MOVE_IN_HOUSE_UNASSIGN', message: 'У заселённого гостя должен быть номер' });
      }
      if (unitChanging && !reason) {
        throw new BadRequestException({ code: 'HOTEL_MOVE_REASON_REQUIRED', message: 'Укажите причину переселения' });
      }
    }

    let targetUnit: HotelRoomUnit | null = null;
    if (targetUnitId) {
      targetUnit = await this.roomUnitsRepo.findOne({ where: { id: targetUnitId, tenantId, hotelId: row.hotelId } });
      if (!targetUnit || (!targetUnit.active && unitChanging)) {
        throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_NOT_FOUND', message: 'Номер не найден в этом отеле' });
      }
      if (unitChanging && targetUnit.housekeepingStatus === 'out_of_order') {
        throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_OOO', message: 'Номер выведен из эксплуатации' });
      }
      const today = await this.todayFor(tenantId, row.hotelId);
      const from = inHouse && checkIn < today ? today : checkIn;
      if ((unitChanging || checkIn !== row.checkIn || checkOut !== row.checkOut) && from < checkOut && (await this.unitOutOfOrder(tenantId, targetUnit.id, from, checkOut))) {
        throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_OOO', message: 'Номер выведен из эксплуатации на эти даты' });
      }
    }
    const roomTypeId = targetUnit ? targetUnit.roomTypeId : row.roomTypeId;
    const datesChanged = checkIn !== row.checkIn || checkOut !== row.checkOut;
    if (!unitChanging && !datesChanged) return row;

    // кто ещё стоит на целевом номере в новые даты
    const conflicts = targetUnitId
      ? await this.repo
          .createQueryBuilder('r')
          .where('r.tenantId = :tenantId', { tenantId })
          .andWhere('r.roomUnitId = :unit', { unit: targetUnitId })
          .andWhere('r.id != :id', { id })
          .andWhere('r.status IN (:...st)', { st: BLOCKING_STATUSES })
          .andWhere('r.checkIn < :checkOut', { checkOut })
          .andWhere('r.checkOut > :checkIn', { checkIn })
          .getMany()
      : [];

    let swapWith: HotelReservation | null = null;
    if (conflicts.length) {
      const canSwap = conflicts.length === 1 && unitChanging;
      if (!dto.swap || !canSwap) {
        throw new ConflictException({
          code: 'HOTEL_MOVE_CONFLICT',
          message: 'Номер занят на эти даты',
          canSwap,
          conflicts: conflicts.map((c) => ({ id: c.id, guestName: c.guestName, checkIn: c.checkIn, checkOut: c.checkOut, status: c.status })),
        });
      }
      swapWith = conflicts[0];
      const sourceUnitId = row.roomUnitId;
      if (!sourceUnitId && swapWith.status === 'checked_in') {
        throw new BadRequestException({ code: 'HOTEL_MOVE_SWAP_IN_HOUSE', message: 'Заселённого гостя нельзя оставить без номера' });
      }
      if (swapWith.status === 'checked_in' && !reason) {
        throw new BadRequestException({ code: 'HOTEL_MOVE_REASON_REQUIRED', message: 'Укажите причину переселения' });
      }
      if (sourceUnitId) {
        const blocking = await this.repo
          .createQueryBuilder('r')
          .where('r.tenantId = :tenantId', { tenantId })
          .andWhere('r.roomUnitId = :unit', { unit: sourceUnitId })
          .andWhere('r.id NOT IN (:...ids)', { ids: [row.id, swapWith.id] })
          .andWhere('r.status IN (:...st)', { st: BLOCKING_STATUSES })
          .andWhere('r.checkIn < :checkOut', { checkOut: swapWith.checkOut })
          .andWhere('r.checkOut > :checkIn', { checkIn: swapWith.checkIn })
          .getCount();
        if (blocking) {
          throw new ConflictException({ code: 'HOTEL_MOVE_SWAP_BLOCKED', message: 'Вторую бронь некуда перенести: исходный номер занят в её даты', canSwap: false, conflicts: [] });
        }
      }
    }

    // доступность по типу номера нужна, когда меняются даты или тип (обмен номерами количество по типам не меняет)
    if ((datesChanged || roomTypeId !== row.roomTypeId) && !swapWith) {
      const result = await this.availability.checkAvailability({
        tenantId,
        roomTypeId,
        checkIn,
        checkOut,
        excludeReservationId: id,
        contractId: roomTypeId === row.roomTypeId ? row.contractId : null,
        blockId: roomTypeId === row.roomTypeId ? row.blockId : null,
      });
      if (!result.ok) throw new BadRequestException({ code: 'HOTEL_MOVE_NO_AVAILABILITY', message: result.reason });
    }

    const before = { ...row };
    const prevUnitId = row.roomUnitId;
    row.roomUnitId = targetUnitId;
    row.roomTypeId = roomTypeId;
    row.checkIn = checkIn;
    row.checkOut = checkOut;
    if (row.priceMode === 'auto') {
      // перенос/продление брони «по прайсу» — пересчёт по новым ночам; нет цены на новые даты — оставляем прежнюю цену ночи
      await this.applyAutoPrice(tenantId, row).catch(() => {
        row.priceMode = 'manual';
        row.nightlyRates = null;
      });
    }
    this.computeTotals(row);

    const otherBefore = swapWith ? { ...swapWith } : null;
    if (swapWith) {
      const sourceUnit = prevUnitId ? await this.roomUnitsRepo.findOne({ where: { id: prevUnitId, tenantId } }) : null;
      swapWith.roomUnitId = prevUnitId;
      if (sourceUnit) swapWith.roomTypeId = sourceUnit.roomTypeId;
    }

    const saved = await this.repo.manager.transaction(async (em) => {
      const s = await em.save(HotelReservation, row);
      if (swapWith) await em.save(HotelReservation, swapWith);
      // переселение заселённого гостя — номер, где он жил, нужно убрать
      const dirty = [inHouse && unitChanging ? prevUnitId : null, swapWith?.status === 'checked_in' ? otherBefore!.roomUnitId : null]
        .filter((x): x is string => !!x);
      if (dirty.length) await em.update(HotelRoomUnit, { tenantId, id: In(dirty) }, { housekeepingStatus: 'dirty' });
      return s;
    });

    const summary = inHouse && unitChanging ? 'Гость переселён' : 'Бронь перенесена в шахматке';
    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary,
      changes: [...diffReservation(before, saved), ...(reason ? [{ field: 'reason', oldValue: null, newValue: reason }] : [])],
      actorUserId: actorUserId ?? null,
    });
    if (swapWith && otherBefore) {
      void this.auditLog.log({
        tenantId,
        entityType: 'hotel_reservation',
        entityId: swapWith.id,
        entityLabel: swapWith.guestName,
        action: 'update',
        summary: 'Номер обменян с другой бронью',
        changes: [...diffReservation(otherBefore, swapWith), ...(reason ? [{ field: 'reason', oldValue: null, newValue: reason }] : [])],
        actorUserId: actorUserId ?? null,
      });
    }

    return { reservation: saved, swapped: swapWith ? { id: swapWith.id, roomUnitId: swapWith.roomUnitId } : null };
  }

  /** История брони из общего журнала изменений; имена сотрудников подставляются из users */
  async history(tenantId: string, id: string) {
    await this.get(tenantId, id);
    const { items } = await this.auditLog.findGlobal(tenantId, { entityType: 'hotel_reservation', entityId: id, limit: 100 });
    const actorIds = [...new Set(items.map((i) => i.actorUserId).filter((x): x is string => !!x))];
    const users: Array<{ id: string; name: string | null; email: string | null }> = actorIds.length
      ? await this.repo.manager.query('SELECT id, name, email FROM users WHERE id = ANY($1)', [actorIds])
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name || u.email || null]));
    return items.map((i) => ({
      id: i.id,
      createdAt: i.createdAt,
      action: i.action,
      summary: i.summary,
      changes: i.changes || [],
      actorName: i.actorName || (i.actorUserId ? nameById.get(i.actorUserId) ?? null : null),
    }));
  }

  /** Подсказка штрафа перед отменой / no-show: дней до заезда, правило контракта, сумма */
  async cancellationQuote(tenantId: string, id: string) {
    const row = await this.get(tenantId, id);
    const nights = nightsBetween(row.checkIn, row.checkOut);
    const total = toNum(row.total);
    const nightly = nights ? total / nights : 0;
    const today = await this.todayFor(tenantId, row.hotelId);
    const daysBefore = Math.round((Date.parse(`${row.checkIn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const contract = row.contractId ? await this.contracts.get(tenantId, row.contractId).catch(() => null) : null;
    // условия отмены: контракт партнёра, иначе тариф брони
    const plan = !contract && row.ratePlanId ? await this.ratePlans.get(tenantId, row.ratePlanId).catch(() => null) : null;
    const byPlan = plan ? ratePlanPenalty(plan, daysBefore, total, nightly) : null;
    const { rule, fee } = byPlan ? { rule: byPlan.rule, fee: byPlan.fee } : cancellationPenalty(contract?.cancellationPolicy, daysBefore, total, nightly);
    return {
      daysBefore,
      total: round2(total),
      firstNight: round2(nightly),
      contractId: contract?.id ?? null,
      contractName: contract?.name ?? null,
      ratePlan: plan ? { id: plan.id, code: plan.code, name: plan.name, refundable: plan.refundable } : null,
      nonRefundable: !!byPlan?.nonRefundable,
      rule,
      suggestedFee: fee,
      paid: round2((row.payments || []).reduce((sum, p) => sum + toNum(p.amount), 0)),
      ...(await this.moneyAfterClose(tenantId, row, fee)),
    };
  }

  /**
   * Деньги после отмены / no-show с удержанием fee: по каждому счёту — оплачено, доп. услуги и сколько можно вернуть
   * (оплачено − штраф на счёте проживания − доп. услуги этого счёта). Форма считает возврат вживую при правке штрафа.
   */
  private async moneyAfterClose(tenantId: string, row: HotelReservation, fee: number) {
    const [f, hotel] = await Promise.all([this.folio.folio(tenantId, row.id), this.folio.hotelOf(tenantId, row.hotelId)]);
    const sim = folioSummary({ ...row, status: 'cancelled', cancellationFee: String(round2(fee)) } as HotelReservation, f.lines, hotel);
    const of = (k: 'guest' | 'partner') => ({ payments: sim.folios[k].payments, extras: sim.folios[k].extras, refundable: round2(Math.max(0, -sim.folios[k].balance)) });
    return { accommodationFolio: sim.accommodationFolio, folios: { guest: of('guest'), partner: of('partner') } };
  }

  /** Возврат вместе с отменой / no-show: сумма > 0, счёт, способ; не больше, чем можно вернуть после удержания штрафа */
  private async checkCloseRefund(tenantId: string, row: HotelReservation, fee: number, raw: HotelCloseRefund | undefined) {
    if (!raw || raw.amount === undefined || raw.amount === null || String(raw.amount).trim() === '') return null;
    const amount = round2(toNum(normalizeNumericInput(raw.amount as any)));
    if (!(amount > 0)) return null;
    const folio: 'guest' | 'partner' = raw.folio === 'partner' && row.agencyId ? 'partner' : 'guest';
    const method = HOTEL_REFUND_METHODS.includes(raw.method as any) ? String(raw.method) : 'cash';
    const money = await this.moneyAfterClose(tenantId, row, fee);
    if (amount > money.folios[folio].refundable + 0.009) {
      throw new BadRequestException({ code: 'HOTEL_REFUND_TOO_BIG', message: `Вернуть можно не больше ${money.folios[folio].refundable}` });
    }
    return { amount, folio, method, note: String(raw.note || '').trim().slice(0, 500) || null };
  }

  private async applyCloseRefund(tenantId: string, id: string, refund: NonNullable<Awaited<ReturnType<HotelReservationsService['checkCloseRefund']>>>, label: string, actorUserId?: string | null) {
    return this.addPayment(tenantId, id, { amount: String(refund.amount), method: refund.method, folio: refund.folio, refund: true, note: refund.note || label }, actorUserId ?? null);
  }

  /** Отмена с причиной и штрафом (PMS-026). Штраф по умолчанию — по политике контракта. */
  async cancel(tenantId: string, id: string, dto: { reason?: string; note?: string; fee?: string | number | null; refund?: HotelCloseRefund }, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    if (!['confirmed', 'pending'].includes(row.status)) {
      throw new BadRequestException({ code: 'HOTEL_CANCEL_NOT_ALLOWED', message: 'Отменить можно только подтверждённую или ожидающую бронь' });
    }
    const reason = String(dto.reason || '');
    if (!(HOTEL_CANCEL_REASONS as readonly string[]).includes(reason) || reason === 'option_expired') {
      throw new BadRequestException({ code: 'HOTEL_CANCEL_REASON_REQUIRED', message: 'Укажите причину отмены' });
    }
    const fee = dto.fee === undefined || dto.fee === null || dto.fee === ''
      ? (await this.cancellationQuote(tenantId, id)).suggestedFee
      : Math.max(0, toNum(normalizeNumericInput(dto.fee as any)));
    // возврат проверяем до отмены — отмена не должна пройти, если возврат невозможен
    const refund = await this.checkCloseRefund(tenantId, row, round2(fee), dto.refund);
    const closed = await this.closeAs(tenantId, row, 'cancelled', {
      cancelReason: reason as HotelCancelReason,
      cancelNote: String(dto.note || '').trim().slice(0, 1000) || null,
      cancellationFee: String(round2(fee)),
    }, 'Бронь отменена', actorUserId);
    return refund ? this.applyCloseRefund(tenantId, id, refund, 'Возврат при отмене', actorUserId) : closed;
  }

  /** Гость не заехал (no-show). Штраф по умолчанию — первая ночь. */
  async noShow(tenantId: string, id: string, dto: { fee?: string | number | null; note?: string; refund?: HotelCloseRefund }, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    if (!['confirmed', 'pending'].includes(row.status)) {
      throw new BadRequestException({ code: 'HOTEL_NO_SHOW_NOT_ALLOWED', message: 'No-show можно отметить только у незаселённой брони' });
    }
    if (row.checkIn > (await this.todayFor(tenantId, row.hotelId))) {
      throw new BadRequestException({ code: 'HOTEL_NO_SHOW_TOO_EARLY', message: 'Дата заезда ещё не наступила' });
    }
    const nights = nightsBetween(row.checkIn, row.checkOut);
    const fee = dto.fee === undefined || dto.fee === null || dto.fee === ''
      ? toNum(row.total) / nights
      : Math.max(0, toNum(normalizeNumericInput(dto.fee as any)));
    const kept = round2(Math.min(fee, toNum(row.total)));
    const refund = await this.checkCloseRefund(tenantId, row, kept, dto.refund);
    const closed = await this.closeAs(tenantId, row, 'no_show', {
      noShowAt: new Date(),
      cancelNote: String(dto.note || '').trim().slice(0, 1000) || null,
      cancellationFee: String(kept),
    }, 'Гость не заехал (no-show)', actorUserId);
    return refund ? this.applyCloseRefund(tenantId, id, refund, 'Возврат при no-show', actorUserId) : closed;
  }

  /** Массовая отметка no-show с экрана дня; feeMode: none — без штрафа, first_night — первая ночь */
  async bulkNoShow(tenantId: string, ids: string[], feeMode: 'none' | 'first_night', actorUserId?: string | null) {
    const done: string[] = [];
    const failed: Array<{ id: string; code: string; message: string }> = [];
    for (const id of [...new Set(ids || [])].slice(0, 200)) {
      try {
        await this.noShow(tenantId, id, { fee: feeMode === 'none' ? 0 : null }, actorUserId);
        done.push(id);
      } catch (e: any) {
        const r = e?.getResponse?.();
        failed.push({ id, code: r?.code || 'ERROR', message: r?.message || e?.message || 'error' });
      }
    }
    return { done, failed };
  }

  private async closeAs(
    tenantId: string,
    row: HotelReservation,
    status: 'cancelled' | 'no_show',
    patch: Partial<HotelReservation>,
    summary: string,
    actorUserId?: string | null,
  ) {
    const before = { ...row };
    Object.assign(row, patch, { status, optionUntil: null });
    if (status === 'cancelled') row.cancelledAt = new Date();
    const saved = await this.repo.save(row);
    await this.fireStatusChangeTrigger(tenantId, saved, before.status);
    try {
      const adminEmails = await this.automationsService.resolveAdminEmails(tenantId);
      await this.checkLowAvailability(tenantId, saved, adminEmails);
    } catch {
      /* уведомление о доступности — не критично */
    }
    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary,
      changes: diffReservation(before, saved),
      actorUserId: actorUserId ?? null,
    });
    return saved;
  }

  /**
   * Walk-in за один шаг (PMS-068): бронь на сегодня + заселение в выбранный номер (+ оплата, если внесена).
   * Проверки доступности и занятости номера — те же, что у обычной брони и заселения.
   */
  async walkIn(
    tenantId: string,
    dto: {
      hotelId: string; roomUnitId: string; nights: number; guestName: string; guestPhone?: string | null; guestEmail?: string | null;
      pax?: number; children?: number; grossPerNight?: string; boardType?: string | null; guestCountry?: string | null; notes?: string | null;
      adults?: number; childAges?: Array<number | null>;
      payment?: { amount: string; method: string; note?: string } | null;
    },
    actorUserId?: string | null,
  ) {
    const guestName = String(dto.guestName || '').trim();
    if (!guestName) throw new BadRequestException({ code: 'HOTEL_WALKIN_NAME_REQUIRED', message: 'Укажите имя гостя' });
    const nights = Math.round(toNum(dto.nights));
    if (nights < 1 || nights > 90) throw new BadRequestException({ code: 'HOTEL_WALKIN_BAD_NIGHTS', message: 'Число ночей — от 1 до 90' });
    const unit = await this.roomUnitsRepo.findOne({ where: { id: dto.roomUnitId, tenantId, hotelId: dto.hotelId, active: true } });
    if (!unit) throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_NOT_FOUND', message: 'Номер не найден в этом отеле' });
    if (unit.housekeepingStatus === 'out_of_order') throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_OOO', message: 'Номер выведен из эксплуатации' });
    const checkIn = await this.todayFor(tenantId, dto.hotelId);
    const checkOut = addDaysIso(checkIn, nights);
    if (await this.unitOutOfOrder(tenantId, unit.id, checkIn, checkOut)) {
      throw new BadRequestException({ code: 'HOTEL_MOVE_UNIT_OOO', message: 'Номер выведен из эксплуатации на эти даты' });
    }
    const busy = await this.repo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.roomUnitId = :unit', { unit: unit.id })
      .andWhere('r.status IN (:...st)', { st: BLOCKING_STATUSES })
      .andWhere('r.checkIn < :checkOut', { checkOut })
      .andWhere('r.checkOut > :checkIn', { checkIn })
      .getCount();
    if (busy) throw new ConflictException({ code: 'HOTEL_MOVE_CONFLICT', message: 'Номер занят на эти даты', canSwap: false, conflicts: [] });

    const created = await this.create(tenantId, {
      hotelId: dto.hotelId,
      roomTypeId: unit.roomTypeId,
      roomUnitId: unit.id,
      guestName,
      guestPhone: dto.guestPhone ?? null,
      guestEmail: dto.guestEmail ?? null,
      pax: Math.max(1, Math.round(toNum(dto.pax) || 1)),
      children: Math.max(0, Math.round(toNum(dto.children))),
      // состав из окна walk-in: взрослые + возрасты детей (pax/children пересчитает applyGuests)
      ...(dto.adults !== undefined ? { adults: dto.adults, childAges: dto.childAges ?? [] } : {}),
      checkIn,
      checkOut,
      grossPerNight: dto.grossPerNight === undefined || dto.grossPerNight === null || dto.grossPerNight === '' ? undefined : dto.grossPerNight,
      boardType: dto.boardType ?? null,
      guestCountry: dto.guestCountry ?? null,
      notes: dto.notes ?? null,
      status: 'confirmed',
      source: 'walk_in',
    }, actorUserId);
    let saved = await this.checkIn(tenantId, created.id, unit.id, actorUserId);
    if (dto.payment && toNum(normalizeNumericInput(dto.payment.amount)) > 0) {
      saved = await this.addPayment(tenantId, created.id, { date: checkIn, amount: dto.payment.amount, method: dto.payment.method || 'cash', note: dto.payment.note }, actorUserId);
    }
    return saved;
  }

  /** Крон: снимает просроченные опционы (pending + optionUntil в прошлом) */
  async expireOptions(now = new Date()) {
    const due = await this.repo
      .createQueryBuilder('r')
      .where('r.status = :st', { st: 'pending' })
      .andWhere('r.optionUntil IS NOT NULL')
      .andWhere('r.optionUntil < :now', { now })
      .take(200)
      .getMany();
    for (const row of due) {
      try {
        await this.closeAs(row.tenantId, row, 'cancelled', { cancelReason: 'option_expired', cancellationFee: '0' }, 'Опцион истёк — бронь снята', null);
      } catch (e) {
        console.error('expireOptions failed', row.id, (e as Error).message);
      }
    }
    return due.length;
  }

  /** none/partial/full from Σpayments vs total — never overwrites a manually-set 'refunded'
   * state. paidStatus stays directly editable via update() too, so staff can always override. */
  private suggestPaidStatus(row: HotelReservation): HotelReservationPaidStatus {
    const paid = row.payments.reduce((s, p) => s + toNum(p.amount), 0);
    const total = toNum(row.status === 'cancelled' || row.status === 'no_show' ? row.cancellationFee : row.total) + toNum(row.extrasTotal);
    if (paid <= 0) return 'none';
    if (paid >= total) return 'full';
    return 'partial';
  }

  async addPayment(
    tenantId: string,
    id: string,
    payment: { date?: string; amount: string; method: string; note?: string | null; folio?: string; refund?: boolean },
    actorUserId?: string | null,
    allowClosed = false,
  ) {
    const row = await this.get(tenantId, id);
    const hotel = await this.folio.hotelOf(tenantId, row.hotelId);
    const date = payment.date && /^\d{4}-\d{2}-\d{2}$/.test(payment.date) ? payment.date : businessDateOf(hotel);
    this.folio.assertOpenDay(hotel, date, allowClosed);
    let amount = toNum(normalizeNumericInput(payment.amount));
    if (payment.refund) amount = -Math.abs(amount);
    if (!amount) throw new BadRequestException({ code: 'HOTEL_PAYMENT_ZERO', message: 'Сумма платежа не может быть нулевой' });
    const folio = payment.folio === 'partner' && row.agencyId ? 'partner' : 'guest';
    if (amount < 0) {
      const paidInFolio = (row.payments || []).filter((p) => (p.folio || 'guest') === folio).reduce((s, p) => s + toNum(p.amount), 0);
      if (-amount > paidInFolio + 0.009) throw new BadRequestException({ code: 'HOTEL_REFUND_TOO_BIG', message: 'Возврат больше, чем оплачено по этому счёту' });
    }
    const shift = await this.folio.openShiftOf(tenantId, row.hotelId);
    const entry: HotelReservationPayment = {
      id: randomUUID(),
      date,
      amount: String(round2(amount)),
      method: payment.method || 'cash',
      note: payment.note ?? null,
      folio,
      shiftId: shift?.id ?? null,
      createdBy: actorUserId ?? null,
      createdAt: new Date().toISOString(),
    };
    row.payments = [...row.payments, entry];
    if (row.paidStatus !== 'refunded') row.paidStatus = this.suggestPaidStatus(row);
    // закрытая бронь, деньги вернули полностью — «возвращено»
    if (amount < 0 && (row.status === 'cancelled' || row.status === 'no_show') && row.payments.reduce((s, p) => s + toNum(p.amount), 0) <= 0.009) row.paidStatus = 'refunded';
    const saved = await this.repo.save(row);

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: amount < 0 ? `Возврат: ${entry.amount}` : `Платёж добавлен: ${entry.amount}`,
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async removePayment(tenantId: string, id: string, paymentId: string, actorUserId?: string | null, allowClosed = false) {
    const row = await this.get(tenantId, id);
    const target = row.payments.find((p) => p.id === paymentId);
    if (!target) throw new NotFoundException('Платёж не найден');
    const hotel = await this.folio.hotelOf(tenantId, row.hotelId);
    this.folio.assertOpenDay(hotel, target.date, allowClosed);
    // платёж закрытой смены уже пересчитан в кассе — удалять нельзя, только оформлять возврат
    if (target.shiftId && !allowClosed) {
      const open = await this.folio.openShiftOf(tenantId, row.hotelId);
      if (open?.id !== target.shiftId) throw new BadRequestException({ code: 'HOTEL_PAYMENT_SHIFT_CLOSED', message: 'Смена этого платежа закрыта — оформите возврат' });
    }
    row.payments = row.payments.filter((p) => p.id !== paymentId);
    if (row.paidStatus !== 'refunded') row.paidStatus = this.suggestPaidStatus(row);
    const saved = await this.repo.save(row);

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: saved.id,
      entityLabel: saved.guestName,
      action: 'update',
      summary: 'Платёж удалён',
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async renderFolio(tenantId: string, id: string, opts: { lang?: string; folio?: 'guest' | 'partner' } = {}) {
    const reservation = await this.get(tenantId, id);
    const [hotel, roomType, lines] = await Promise.all([
      this.hotelRepo.findOne({ where: { id: reservation.hotelId, tenantId } }),
      this.roomTypeRepo.findOne({ where: { id: reservation.roomTypeId, tenantId } }),
      this.folioLinesRepo.find({ where: { tenantId, reservationId: id }, order: { serviceDate: 'ASC', createdAt: 'ASC' } }),
    ]);
    return renderHotelFolioPdf(reservation, hotel, roomType, lines, { lang: opts.lang || HotelReservationsService.guestLang(reservation.guestCountry), folio: opts.folio });
  }

  async sendFolioEmail(tenantId: string, id: string) {
    const reservation = await this.get(tenantId, id);
    if (!reservation.guestEmail) {
      throw new BadRequestException('У брони нет email гостя — добавьте его, чтобы отправить счёт');
    }
    const hotel = await this.hotelRepo.findOne({ where: { id: reservation.hotelId, tenantId } });
    const lang = HotelReservationsService.guestLang(reservation.guestCountry);
    const buffer = await this.renderFolio(tenantId, id, { lang, folio: 'guest' });
    const esc = (v: string) => String(v || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
    const T = {
      ru: { s: `Счёт по брони — ${hotel?.name || 'отель'}`, h: `Здравствуйте, ${esc(reservation.guestName)}!`, b: `Во вложении счёт по вашей брони (${reservation.checkIn} — ${reservation.checkOut}).` },
      en: { s: `Your invoice — ${hotel?.name || 'hotel'}`, h: `Dear ${esc(reservation.guestName)},`, b: `Please find attached the invoice for your stay (${reservation.checkIn} — ${reservation.checkOut}).` },
      tr: { s: `Rezervasyon faturanız — ${hotel?.name || 'otel'}`, h: `Sayın ${esc(reservation.guestName)},`, b: `Konaklamanızın (${reservation.checkIn} — ${reservation.checkOut}) faturası ektedir.` },
    }[lang];

    // счёт гостю — с почты отеля; не подключена — понятная ошибка
    await this.tenantMail.sendOrThrow(tenantId, {
      to: reservation.guestEmail,
      subject: T.s,
      html: `<p>${T.h}</p><p>${T.b}</p>`,
      attachments: [{ filename: `folio-${id}.pdf`, content: buffer.toString('base64') }],
    });

    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: reservation.id,
      entityLabel: reservation.guestName,
      action: 'update',
      summary: `Счёт отправлен на ${reservation.guestEmail}`,
      actorUserId: null,
    });

    return { ok: true };
  }

  async remove(tenantId: string, id: string, actorUserId?: string | null) {
    const row = await this.get(tenantId, id);
    await this.repo.remove(row);
    void this.auditLog.log({
      tenantId,
      entityType: 'hotel_reservation',
      entityId: id,
      entityLabel: row.guestName,
      action: 'delete',
      summary: 'Бронь отеля удалена',
      actorUserId: actorUserId ?? null,
    });
    return { ok: true };
  }

  /**
   * Плоские токены для текста уведомлений в автоматизациях ({{guest_name}}, {{room_type}}, ...) —
   * та же идея, что и у токенов бронирований (см. ReservationsService.buildNotificationTokens),
   * чтобы конструктор автоматизаций одинаково выглядел для Бронирований и Hotels/PMS.
   */
  private buildNotificationTokens(
    reservation: HotelReservation,
    hotel: Hotel | null,
    roomType: HotelRoomType | null,
  ): Record<string, string> {
    return {
      guest_name: reservation.guestName || '',
      room_type: roomType?.name || '',
      check_in: reservation.checkIn,
      check_out: reservation.checkOut,
      hotel_name: hotel?.name || '',
      booking_id: reservation.id,
      status: reservation.status,
    };
  }
}
