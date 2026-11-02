import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { hotelTaxes } from './hotel-tax.util';
import { normalizeNumericInput } from './hotel-number.util';
import {
  HOTEL_EXTRA_CATEGORIES,
  HOTEL_FOLIO_LINE_KINDS,
  HotelCashShift,
  HotelExtraService,
  HotelFolioKind,
  HotelFolioLine,
  HotelFolioLineKind,
} from './hotel-folio.entities';

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const bad = (code: string, message: string) => new BadRequestException({ code, message });

/** Сегодня по часовому поясу отеля */
export function hotelToday(hotel: Pick<Hotel, 'timezone'> | null | undefined, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: hotel?.timezone || 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Открытый операционный день отеля (PMS-092): после аудита — следующий за закрытым, до первого аудита — сегодня */
export function businessDateOf(hotel: Pick<Hotel, 'timezone' | 'businessDate'> | null | undefined): string {
  const today = hotelToday(hotel);
  // аудит уже закрыл сегодня (вечером) — бизнес-дата завтра; аудит перестали запускать — не уходим в прошлое
  return hotel?.businessDate && hotel.businessDate > today ? hotel.businessDate : today;
}

const nightsOf = (r: Pick<HotelReservation, 'checkIn' | 'checkOut'>) =>
  Math.max(1, Math.round((Date.parse(`${r.checkOut}T00:00:00Z`) - Date.parse(`${r.checkIn}T00:00:00Z`)) / 86_400_000));

export interface HotelFolioSummary {
  currency: string;
  accommodation: number;
  accommodationFolio: HotelFolioKind;
  taxes: { base: number; accommodationTax: number; vat: number; accommodationTaxPct: number; vatPct: number; pricesIncludeTax: boolean };
  folios: Record<HotelFolioKind, { charges: number; extras: number; payments: number; balance: number }>;
  extrasTotal: number;
  paymentsTotal: number;
  balance: number;
}

/**
 * Сводка счёта брони. Проживание — по сумме брони (с налогами сверху, если цены без налогов); у отменённой и no-show
 * вместо проживания — удержанный штраф. Начисления и платежи разнесены по гостевому и партнёрскому счёту.
 */
export function folioSummary(r: HotelReservation, lines: HotelFolioLine[], hotel: Hotel | null): HotelFolioSummary {
  const closed = r.status === 'cancelled' || r.status === 'no_show';
  const taxes = hotelTaxes(num(r.total), hotel);
  const hasTax = taxes.accommodationTaxPct > 0 || taxes.vatPct > 0;
  const accommodation = closed ? num(r.cancellationFee) : hasTax && hotel?.pricesIncludeTax === false ? taxes.total : num(r.total);
  const accFolio: HotelFolioKind = r.accommodationFolio === 'partner' ? 'partner' : 'guest';
  const folios: HotelFolioSummary['folios'] = {
    guest: { charges: 0, extras: 0, payments: 0, balance: 0 },
    partner: { charges: 0, extras: 0, payments: 0, balance: 0 },
  };
  folios[accFolio].charges += accommodation;
  for (const l of lines) {
    const f: HotelFolioKind = l.folio === 'partner' ? 'partner' : 'guest';
    folios[f].extras += num(l.amount);
    folios[f].charges += num(l.amount);
  }
  for (const p of r.payments || []) folios[p.folio === 'partner' ? 'partner' : 'guest'].payments += num(p.amount);
  for (const f of ['guest', 'partner'] as const) {
    for (const k of ['charges', 'extras', 'payments'] as const) folios[f][k] = round2(folios[f][k]);
    folios[f].balance = round2(folios[f].charges - folios[f].payments);
  }
  const extrasTotal = round2(folios.guest.extras + folios.partner.extras);
  const paymentsTotal = round2(folios.guest.payments + folios.partner.payments);
  return {
    currency: (hotel?.currency || '').toUpperCase(),
    accommodation: round2(accommodation),
    accommodationFolio: accFolio,
    taxes: { base: taxes.base, accommodationTax: taxes.accommodationTax, vat: taxes.vat, accommodationTaxPct: taxes.accommodationTaxPct, vatPct: taxes.vatPct, pricesIncludeTax: hotel?.pricesIncludeTax !== false },
    folios,
    extrasTotal,
    paymentsTotal,
    balance: round2(folios.guest.balance + folios.partner.balance),
  };
}

@Injectable()
export class HotelFolioService {
  constructor(
    @InjectRepository(Hotel) readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelFolioLine) private readonly lines: Repository<HotelFolioLine>,
    @InjectRepository(HotelExtraService) private readonly extras: Repository<HotelExtraService>,
    @InjectRepository(HotelCashShift) private readonly shifts: Repository<HotelCashShift>,
  ) {}

  async hotelOf(tenantId: string, hotelId: string) {
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!h) throw new NotFoundException('Отель не найден');
    return h;
  }

  private async reservation(tenantId: string, id: string) {
    const r = await this.reservations.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Бронь не найдена');
    return r;
  }

  /** Закрытый аудитом день: менять деньги можно только с правом override (PMS-094) */
  assertOpenDay(hotel: Hotel, date: string, allowClosed: boolean) {
    if (!allowClosed && hotel.lastAuditDate && date <= hotel.lastAuditDate) {
      throw bad('HOTEL_DAY_CLOSED', `День ${date} закрыт ночным аудитом`);
    }
  }

  async folio(tenantId: string, reservationId: string) {
    const r = await this.reservation(tenantId, reservationId);
    const [lines, hotel] = await Promise.all([
      this.lines.find({ where: { tenantId, reservationId }, order: { serviceDate: 'ASC', createdAt: 'ASC' } }),
      this.hotels.findOne({ where: { id: r.hotelId, tenantId } }),
    ]);
    return {
      lines,
      summary: folioSummary(r, lines, hotel),
      businessDate: businessDateOf(hotel),
      lastAuditDate: hotel?.lastAuditDate ?? null,
      payments: r.payments || [],
    };
  }

  /** Кэш extrasTotal на брони — для списков и экрана дня без загрузки строк */
  async refreshExtras(tenantId: string, reservationId: string) {
    const row = await this.lines
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.amount), 0)', 'sum')
      .where('l.tenantId = :tenantId AND l.reservationId = :reservationId', { tenantId, reservationId })
      .getRawOne<{ sum: string }>();
    const total = String(round2(num(row?.sum)));
    const r = await this.reservations.findOne({ where: { id: reservationId, tenantId } });
    if (r) {
      r.extrasTotal = total;
      // статус оплаты зависит и от начислений: после доп. услуг «оплачено» превращается в «частично»
      if (r.paidStatus !== 'refunded') {
        const paid = (r.payments || []).reduce((s, p) => s + num(p.amount), 0);
        const due = num(r.status === 'cancelled' || r.status === 'no_show' ? r.cancellationFee : r.total) + num(total);
        r.paidStatus = paid <= 0 ? 'none' : paid + 0.009 >= due ? 'full' : 'partial';
      }
      await this.reservations.save(r);
    }
    return total;
  }

  async postLine(
    tenantId: string,
    reservationId: string,
    dto: { folio?: string; serviceDate?: string; kind?: string; extraServiceId?: string | null; description?: string; quantity?: string | number; unitPrice?: string | number },
    actorUserId: string | null,
    allowClosed = false,
  ) {
    const r = await this.reservation(tenantId, reservationId);
    const hotel = await this.hotelOf(tenantId, r.hotelId);
    const kind = (HOTEL_FOLIO_LINE_KINDS as readonly string[]).includes(String(dto.kind)) ? (dto.kind as HotelFolioLineKind) : 'extra';
    let description = String(dto.description || '').trim().slice(0, 255);
    let unitPrice = num(normalizeNumericInput(dto.unitPrice as any));
    let extraServiceId: string | null = null;
    if (dto.extraServiceId) {
      const svc = await this.extras.findOne({ where: { id: dto.extraServiceId, tenantId, hotelId: r.hotelId } });
      if (!svc) throw bad('HOTEL_EXTRA_NOT_FOUND', 'Услуга не найдена');
      extraServiceId = svc.id;
      description = description || svc.name;
      if (dto.unitPrice === undefined || dto.unitPrice === '' || dto.unitPrice === null) unitPrice = num(svc.price);
    }
    if (!description && !['early_checkin', 'late_checkout'].includes(kind)) throw bad('HOTEL_FOLIO_DESCRIPTION_REQUIRED', 'Укажите, что начисляется');
    const quantity = Math.max(0.01, num(normalizeNumericInput(dto.quantity as any)) || 1);
    let amount = round2(quantity * unitPrice);
    if (kind === 'discount') amount = -Math.abs(amount);
    if (!amount) throw bad('HOTEL_FOLIO_ZERO', 'Сумма начисления не может быть нулевой');
    const serviceDate = dto.serviceDate && ISO.test(dto.serviceDate) ? dto.serviceDate : businessDateOf(hotel);
    this.assertOpenDay(hotel, serviceDate, allowClosed);
    const line = await this.lines.save(this.lines.create({
      tenantId,
      hotelId: r.hotelId,
      reservationId,
      folio: dto.folio === 'partner' ? 'partner' : 'guest',
      serviceDate,
      kind,
      extraServiceId,
      description,
      quantity: String(quantity),
      unitPrice: String(round2(kind === 'discount' ? -Math.abs(unitPrice) : unitPrice)),
      amount: String(amount),
      createdBy: actorUserId,
    }));
    await this.refreshExtras(tenantId, reservationId);
    return line;
  }

  /** Сторно (PMS-086): обратная строка в открытом дне, исходная помечается сторнированной */
  async voidLine(tenantId: string, reservationId: string, lineId: string, reason: string | undefined, actorUserId: string | null) {
    const line = await this.lines.findOne({ where: { id: lineId, tenantId, reservationId } });
    if (!line) throw new NotFoundException('Строка не найдена');
    if (line.voided || line.voidOfId) throw bad('HOTEL_FOLIO_ALREADY_VOID', 'Строка уже сторнирована');
    const why = String(reason || '').trim();
    if (!why) throw bad('HOTEL_FOLIO_VOID_REASON', 'Укажите причину сторно');
    const hotel = await this.hotelOf(tenantId, line.hotelId);
    const rev = await this.lines.save(this.lines.create({
      tenantId,
      hotelId: line.hotelId,
      reservationId,
      folio: line.folio,
      serviceDate: businessDateOf(hotel),
      kind: line.kind,
      extraServiceId: line.extraServiceId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: String(-num(line.unitPrice)),
      amount: String(-num(line.amount)),
      voidOfId: line.id,
      reason: why.slice(0, 500),
      createdBy: actorUserId,
    }));
    line.voided = true;
    await this.lines.save(line);
    await this.refreshExtras(tenantId, reservationId);
    return rev;
  }

  async setRouting(tenantId: string, reservationId: string, folio: string) {
    const r = await this.reservation(tenantId, reservationId);
    if (folio === 'partner' && !r.agencyId) throw bad('HOTEL_FOLIO_NO_PARTNER', 'У брони нет партнёра');
    r.accommodationFolio = folio === 'partner' ? 'partner' : 'guest';
    await this.reservations.save(r);
    return r;
  }

  /** Ранний заезд / поздний выезд: % от средней цены ночи, один раз на бронь (PMS-062) */
  async autoTimeFee(tenantId: string, r: HotelReservation, kind: 'early_checkin' | 'late_checkout', actorUserId: string | null) {
    const hotel = await this.hotels.findOne({ where: { id: r.hotelId, tenantId } });
    const pct = num(kind === 'early_checkin' ? hotel?.earlyCheckInFeePct : hotel?.lateCheckOutFeePct);
    if (!hotel || pct <= 0 || r.isComplimentary) return null;
    const exists = await this.lines.count({ where: { tenantId, reservationId: r.id, kind, voided: false, voidOfId: null as any } });
    if (exists) return null;
    const nightly = num(r.total) / nightsOf(r);
    const amount = round2((nightly * pct) / 100);
    if (amount <= 0) return null;
    const line = await this.lines.save(this.lines.create({
      tenantId, hotelId: r.hotelId, reservationId: r.id, folio: 'guest', serviceDate: businessDateOf(hotel), kind,
      description: '', quantity: '1', unitPrice: String(amount), amount: String(amount), createdBy: actorUserId,
    }));
    await this.refreshExtras(tenantId, r.id);
    return line;
  }

  // ─── каталог услуг ───
  listExtras(tenantId: string, hotelId: string, includeInactive = false) {
    return this.extras.find({ where: { tenantId, hotelId, ...(includeInactive ? {} : { active: true }) }, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async saveExtra(tenantId: string, dto: Partial<HotelExtraService> & { hotelId?: string }, id?: string) {
    const row = id ? await this.extras.findOne({ where: { id, tenantId } }) : this.extras.create({ tenantId, hotelId: (await this.hotelOf(tenantId, String(dto.hotelId || ''))).id });
    if (!row) throw new NotFoundException('Услуга не найдена');
    if (dto.name !== undefined) row.name = String(dto.name || '').trim().slice(0, 255);
    if (!row.name) throw bad('HOTEL_EXTRA_NAME_REQUIRED', 'Укажите название услуги');
    if (dto.category !== undefined) row.category = (HOTEL_EXTRA_CATEGORIES as readonly string[]).includes(String(dto.category)) ? dto.category! : 'other';
    if (dto.price !== undefined) row.price = normalizeNumericInput(dto.price as any);
    if (dto.active !== undefined) row.active = !!dto.active;
    if (dto.sortOrder !== undefined) row.sortOrder = Math.round(num(dto.sortOrder));
    if (dto.sellOnline !== undefined) row.sellOnline = !!dto.sellOnline;
    if (dto.description !== undefined) row.description = String(dto.description || '').trim().slice(0, 1000) || null;
    if (dto.priceMode !== undefined) row.priceMode = dto.priceMode === 'per_night' || dto.priceMode === 'per_person' ? dto.priceMode : 'per_stay';
    if (dto.outletId !== undefined) {
      if (dto.outletId) {
        const [o] = await this.extras.manager.query(`SELECT id FROM hotel_pos_outlets WHERE id = $1 AND "tenantId" = $2 AND "hotelId" = $3`, [dto.outletId, tenantId, row.hotelId]);
        if (!o) throw bad('HOTEL_POS_OUTLET', 'Точка продаж не из этого отеля');
      }
      row.outletId = dto.outletId || null;
    }
    if (dto.aiIncluded !== undefined) row.aiIncluded = !!dto.aiIncluded;
    if (row.sellOnline && !(num(row.price) > 0)) throw bad('HOTEL_EXTRA_ONLINE_PRICE', 'Для продажи онлайн укажите цену услуги');
    return this.extras.save(row);
  }

  async removeExtra(tenantId: string, id: string) {
    // в начислениях услуга остаётся текстом; из каталога убираем совсем
    await this.extras.delete({ id, tenantId });
    return { ok: true };
  }

  // ─── кассовые смены (PMS-087) ───
  openShiftOf(tenantId: string, hotelId: string) {
    return this.shifts.findOne({ where: { tenantId, hotelId, status: 'open' } });
  }

  /** Платежи смены — платежи броней отеля, помеченные этой сменой, и оплаты на месте в точках продаж */
  async shiftPayments(tenantId: string, hotelId: string, shiftId: string) {
    const rows = await this.reservations
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId })
      .andWhere(`r.payments @> :needle::jsonb`, { needle: JSON.stringify([{ shiftId }]) })
      .getMany();
    const out: Array<{ reservationId: string | null; guestName: string; bookingCode: string | null; id: string; date: string; amount: number; method: string; note: string | null; createdAt?: string; source?: 'pos'; posCheckId?: string; voided?: boolean }> = [];
    for (const r of rows) {
      for (const p of r.payments || []) {
        if (p.shiftId === shiftId) out.push({ reservationId: r.id, guestName: r.guestName, bookingCode: r.bookingCode, id: p.id, date: p.date, amount: num(p.amount), method: p.method, note: p.note, createdAt: p.createdAt });
      }
    }
    // чеки точек продаж с оплатой на месте: продажа (+) в смене продажи, сторно (−) в смене возврата денег
    const pos: Array<{ id: string; number: number; businessDate: string; total: string; paymentMethod: string; shiftId: string | null; voidShiftId: string | null; voidReason: string | null; voidedAt: Date | null; createdAt: Date; outletName: string }> = await this.shifts.manager.query(
      `SELECT c.id, c.number, c."businessDate"::text AS "businessDate", c.total, c."paymentMethod", c."shiftId", c."voidShiftId", c."voidReason", c."voidedAt", c."createdAt", o.name AS "outletName"
         FROM hotel_pos_checks c JOIN hotel_pos_outlets o ON o.id = c."outletId"
        WHERE c."tenantId" = $1 AND c."hotelId" = $2 AND (c."shiftId" = $3 OR c."voidShiftId" = $3)`,
      [tenantId, hotelId, shiftId],
    );
    for (const c of pos) {
      const base = { reservationId: null, guestName: c.outletName, bookingCode: `#${c.number}`, method: c.paymentMethod, source: 'pos' as const, posCheckId: c.id };
      if (c.shiftId === shiftId) out.push({ ...base, id: `pos:${c.id}`, date: c.businessDate, amount: num(c.total), note: null, createdAt: new Date(c.createdAt).toISOString() });
      if (c.voidShiftId === shiftId) out.push({ ...base, id: `pos-void:${c.id}`, date: c.businessDate, amount: -num(c.total), note: c.voidReason, createdAt: c.voidedAt ? new Date(c.voidedAt).toISOString() : undefined, voided: true });
    }
    out.sort((a, b) => String(a.createdAt || a.date).localeCompare(String(b.createdAt || b.date)));
    return out;
  }

  private totalsOf(payments: Array<{ amount: number; method: string }>) {
    const t: Record<string, number> = {};
    for (const p of payments) t[p.method] = round2((t[p.method] || 0) + p.amount);
    return t;
  }

  async currentShift(tenantId: string, hotelId: string) {
    await this.hotelOf(tenantId, hotelId);
    const shift = await this.openShiftOf(tenantId, hotelId);
    if (!shift) return { shift: null, payments: [], totals: {}, expectedCash: null };
    const payments = await this.shiftPayments(tenantId, hotelId, shift.id);
    const totals = this.totalsOf(payments);
    return { shift, payments, totals, expectedCash: round2(num(shift.openingCash) + (totals.cash || 0)) };
  }

  async openShift(tenantId: string, hotelId: string, openingCash: unknown, actorUserId: string | null) {
    await this.hotelOf(tenantId, hotelId);
    if (await this.openShiftOf(tenantId, hotelId)) throw bad('HOTEL_SHIFT_ALREADY_OPEN', 'Смена уже открыта');
    return this.shifts.save(this.shifts.create({
      tenantId, hotelId, status: 'open', openedBy: actorUserId, openedAt: new Date(), openingCash: normalizeNumericInput(openingCash as any),
    }));
  }

  async closeShift(tenantId: string, hotelId: string, countedCash: unknown, note: string | undefined, actorUserId: string | null) {
    const shift = await this.openShiftOf(tenantId, hotelId);
    if (!shift) throw bad('HOTEL_SHIFT_NOT_OPEN', 'Открытой смены нет');
    if (countedCash === undefined || countedCash === null || countedCash === '') throw bad('HOTEL_SHIFT_COUNT_REQUIRED', 'Пересчитайте наличные в кассе');
    const payments = await this.shiftPayments(tenantId, hotelId, shift.id);
    const totals = this.totalsOf(payments);
    const expected = round2(num(shift.openingCash) + (totals.cash || 0));
    const counted = round2(num(normalizeNumericInput(countedCash as any)));
    Object.assign(shift, {
      status: 'closed', closedBy: actorUserId, closedAt: new Date(), countedCash: String(counted), expectedCash: String(expected),
      difference: String(round2(counted - expected)), totals, note: String(note || '').trim() || null,
    });
    return this.shifts.save(shift);
  }

  listShifts(tenantId: string, hotelId: string) {
    return this.shifts.find({ where: { tenantId, hotelId }, order: { openedAt: 'DESC' }, take: 60 });
  }

  async shiftDetail(tenantId: string, shiftId: string) {
    const shift = await this.shifts.findOne({ where: { id: shiftId, tenantId } });
    if (!shift) throw new NotFoundException('Смена не найдена');
    const payments = await this.shiftPayments(tenantId, shift.hotelId, shift.id);
    return { shift, payments, totals: shift.totals || this.totalsOf(payments) };
  }
}
