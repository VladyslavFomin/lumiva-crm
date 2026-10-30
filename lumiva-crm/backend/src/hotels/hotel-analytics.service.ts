import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelAgency } from './hotel-agency.entity';
import { HotelSeasonPacingTarget } from './hotel-season-pacing-target.entity';
import { HotelAnalyticsQueryDto } from './dto/hotel-analytics-query.dto';
import { Tenant } from '../tenants/tenant.entity';
import { CurrencyRatesService } from '../currency/currency-rates.service';

const ACTIVE_STATUSES = ['confirmed', 'pending', 'checked_in', 'checked_out'];
const PAID_STATUSES = ['full', 'partial'];
const PACING_BUCKETS = [90, 60, 30, 14, 7, 0];
const DEFAULT_PACING_TARGETS: Record<number, number> = {
  90: 10,
  60: 40,
  30: 65,
  14: 80,
  7: 92,
  0: 100,
};
const DEFAULT_RISK_BAD = 45;
const DEFAULT_RISK_WARN = 65;

function toNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Scope {
  fromDate: string;
  toDate: string;
  hotelIds: string[] | null;
  roomTypeId?: string;
  marketId?: string;
  agencyId?: string;
  guestCountry?: string;
  saleCountry?: string;
  partnerCountry?: string;
  partnerType?: string;
}

const nightsOf = (r: HotelReservation) => Math.max(1, daysBetween(r.checkIn, r.checkOut));

@Injectable()
export class HotelAnalyticsService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelsRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypesRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelReservation)
    private readonly reservationsRepo: Repository<HotelReservation>,
    @InjectRepository(HotelAgency)
    private readonly agenciesRepo: Repository<HotelAgency>,
    @InjectRepository(HotelSeasonPacingTarget)
    private readonly pacingTargetsRepo: Repository<HotelSeasonPacingTarget>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly currencyRates: CurrencyRatesService,
  ) {}

  private resolveScope(q: HotelAnalyticsQueryDto): Scope {
    const toDate = q.dateTo || todayStr();
    const fromDate = q.dateFrom || addDaysStr(toDate, -30);
    const hotelIds = !q.hotelIds || q.hotelIds === 'all' ? null : q.hotelIds.split(',').filter(Boolean);
    const up = (v?: string) => (v ? v.trim().toUpperCase().slice(0, 2) : undefined);
    return {
      fromDate, toDate, hotelIds, roomTypeId: q.roomTypeId, marketId: q.marketId, agencyId: q.agencyId,
      guestCountry: up(q.guestCountry), saleCountry: up(q.saleCountry), partnerCountry: up(q.partnerCountry), partnerType: q.partnerType || undefined,
    };
  }

  private async loadScope(tenantId: string, scope: Scope) {
    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.checkIn BETWEEN :from AND :to', { from: scope.fromDate, to: scope.toDate });
    if (scope.hotelIds) qb.andWhere('r.hotelId IN (:...hotelIds)', { hotelIds: scope.hotelIds });
    if (scope.roomTypeId) qb.andWhere('r.roomTypeId = :roomTypeId', { roomTypeId: scope.roomTypeId });
    // рынок: id рынка отеля (новые брони) или старое текстовое значение
    if (scope.marketId) qb.andWhere('(r.marketId::text = :marketId OR r.market = :marketId)', { marketId: scope.marketId });
    if (scope.agencyId) qb.andWhere('r.agencyId = :agencyId', { agencyId: scope.agencyId });
    if (scope.guestCountry) qb.andWhere('r.guestCountry = :gc', { gc: scope.guestCountry });
    if (scope.saleCountry) qb.andWhere('r.saleCountry = :sc', { sc: scope.saleCountry });
    let reservations = await qb.getMany();
    const partners = await this.agenciesRepo.find({ where: { tenantId } });
    if (scope.partnerCountry || scope.partnerType) {
      const ok = new Set(
        partners
          .filter((p) => (!scope.partnerCountry || p.countryCode === scope.partnerCountry) && (!scope.partnerType || p.type === scope.partnerType))
          .map((p) => p.id),
      );
      reservations = reservations.filter((r) => r.agencyId && ok.has(r.agencyId));
    }

    const roomTypeWhere: any = scope.hotelIds ? { tenantId, hotelId: In(scope.hotelIds) } : { tenantId };
    let roomTypes = await this.roomTypesRepo.find({ where: roomTypeWhere });
    if (scope.roomTypeId) roomTypes = roomTypes.filter((rt) => rt.id === scope.roomTypeId);

    const hotelWhere: any = scope.hotelIds ? { tenantId, id: In(scope.hotelIds) } : { tenantId };
    const hotels = await this.hotelsRepo.find({ where: hotelWhere });

    // У каждого отеля своя валюта. Раньше все суммы (выручка, план, макс. потенциал) складывались
    // числами и подписывались валютой первого отеля. Если валюты разные — приводим суммы в памяти
    // (в БД ничего не пишем) к основной валюте тенанта по курсу, и все расчёты ниже считаются в ней.
    let currency = (hotels[0]?.currency || 'USD').toUpperCase();
    const distinct = new Set(hotels.map((h) => (h.currency || 'USD').toUpperCase()));
    if (distinct.size > 1) {
      const tenant = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['id', 'primaryCurrency'] });
      currency = (tenant?.primaryCurrency || 'EUR').toUpperCase();
      const rates = await this.currencyRates.getRates();
      const hotelCurrency = new Map(hotels.map((h) => [h.id, (h.currency || 'USD').toUpperCase()]));
      const conv = (value: string | number | null | undefined, from?: string | null) =>
        String(round2(this.currencyRates.convertWithRates(toNum(value), (from || currency).toUpperCase(), currency, rates)));
      for (const r of reservations) {
        const from = hotelCurrency.get(r.hotelId);
        r.total = conv(r.total, from);
        r.netTotal = conv(r.netTotal, from);
        r.commissionAmount = conv(r.commissionAmount, from);
      }
      for (const rt of roomTypes) rt.basePrice = conv(rt.basePrice, rt.currency || hotelCurrency.get(rt.hotelId));
      for (const h of hotels) h.seasonRevenueTarget = conv(h.seasonRevenueTarget, h.currency);
    }

    return { reservations, roomTypes, hotels, currency, partners };
  }

  private active(reservations: HotelReservation[]) {
    return reservations.filter((r) => ACTIVE_STATUSES.includes(r.status));
  }

  async getSummary(tenantId: string, q: HotelAnalyticsQueryDto) {
    const scope = this.resolveScope(q);
    const { reservations, roomTypes, hotels, currency, partners } = await this.loadScope(tenantId, scope);
    const active = this.active(reservations);
    const roomsTotal = roomTypes.reduce((s, rt) => s + (rt.quantity || 0), 0);
    const numDays = Math.max(1, daysBetween(scope.fromDate, scope.toDate) + 1);
    const totalCapacity = roomsTotal * numDays;

    const targetsByBucket = await this.resolvePacingTargets(tenantId, scope.hotelIds);
    const pacing = this.computePacing(active, totalCapacity, targetsByBucket);

    const today = todayStr();
    const occupiedToday = active.filter((r) => r.checkIn <= today && r.checkOut > today).length;
    const roomsAvailable = Math.max(0, roomsTotal - occupiedToday);
    const occupancyNowPct = roomsTotal > 0 ? round2((occupiedToday / roomsTotal) * 100) : 0;
    const revenueSold = round2(
      active.filter((r) => PAID_STATUSES.includes(r.paidStatus)).reduce((s, r) => s + toNum(r.total), 0),
    );
    const daysUntilTo = Math.max(0, daysBetween(today, scope.toDate));
    const currentBucket = this.nearestBucket(daysUntilTo);
    const roomsNeededPerDay = pacing.buckets.find((b) => b.daysBeforeArrival === currentBucket)?.roomsNeededPerDay ?? 0;

    const kpis = {
      occupancyNowPct,
      roomsAvailable,
      roomsTotal,
      revenueSold,
      roomsNeededPerDay,
      currency,
    };

    const funnel = this.computeRevenueFunnel(active, hotels, roomTypes, numDays, currency);
    const roomTypesBreakdown = this.computeRoomTypeBreakdown(active, roomTypes);
    const markets = this.computeMarketBreakdown(active);
    const agencies = this.computeAgencyBreakdown(active, reservations, partners);
    const countries = this.computeCountryBreakdown(active, reservations, partners);
    const partnerTypes = this.computePartnerTypeBreakdown(active, partners);
    const totals = {
      bookings: active.length,
      cancelled: reservations.length - active.length,
      roomNights: active.reduce((s, r) => s + nightsOf(r), 0),
      gross: round2(active.reduce((s, r) => s + toNum(r.total), 0)),
      net: round2(active.reduce((s, r) => s + toNum(r.netTotal || r.total), 0)),
      commission: round2(active.reduce((s, r) => s + toNum(r.commissionAmount), 0)),
    };
    const guests = this.computeGuestDemographics(active);

    return { kpis, pacing, funnel, roomTypes: roomTypesBreakdown, markets, agencies, guests, countries, partnerTypes, totals };
  }

  async getArrivals(tenantId: string, q: HotelAnalyticsQueryDto) {
    const scope = this.resolveScope(q);
    const { reservations, roomTypes, hotels } = await this.loadScope(tenantId, scope);
    const active = this.active(reservations);
    const capacity = roomTypes.reduce((s, rt) => s + (rt.quantity || 0), 0);

    let badThreshold = DEFAULT_RISK_BAD;
    let warnThreshold = DEFAULT_RISK_WARN;
    if (hotels.length === 1) {
      if (hotels[0].riskThresholdBadPct != null) badThreshold = toNum(hotels[0].riskThresholdBadPct);
      if (hotels[0].riskThresholdWarnPct != null) warnThreshold = toNum(hotels[0].riskThresholdWarnPct);
    }

    const rows: Array<{ date: string; occupancyPct: number; riskLevel: 'bad' | 'warn' | 'ok' }> = [];
    const numDays = Math.max(1, daysBetween(scope.fromDate, scope.toDate) + 1);
    for (let i = 0; i < numDays; i++) {
      const date = addDaysStr(scope.fromDate, i);
      const occupied = active.filter((r) => r.checkIn <= date && r.checkOut > date).length;
      const occupancyPct = capacity > 0 ? round2((occupied / capacity) * 100) : 0;
      const riskLevel = occupancyPct < badThreshold ? 'bad' : occupancyPct < warnThreshold ? 'warn' : 'ok';
      rows.push({ date, occupancyPct, riskLevel });
    }
    return rows;
  }

  /* ---------- pacing target curve settings ---------- */

  /**
   * Отчёт жизненного цикла броней по датам заезда: бесплатные проживания по причинам (PMS-126), отмены по причинам
   * и no-show со штрафами. Суммы — в валюте отеля, поэтому разложены по валютам (`{ EUR: 1200, TRY: 30000 }`).
   */
  async getLifecycle(tenantId: string, q: HotelAnalyticsQueryDto) {
    const scope = this.resolveScope(q);
    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.checkIn >= :from AND r.checkIn <= :to', { from: scope.fromDate, to: scope.toDate })
      .andWhere("(r.isComplimentary = true OR r.status IN ('cancelled','no_show'))");
    if (scope.hotelIds) qb.andWhere('r.hotelId IN (:...hotelIds)', { hotelIds: scope.hotelIds });
    const [rows, hotels] = await Promise.all([qb.orderBy('r.checkIn', 'DESC').getMany(), this.hotelsRepo.find({ where: { tenantId } })]);
    const cur = new Map(hotels.map((h) => [h.id, (h.currency || 'EUR').toUpperCase()]));
    const add = (m: Record<string, number>, c: string, v: number) => { m[c] = Math.round(((m[c] || 0) + v) * 100) / 100; };
    type Bucket = { reason: string; count: number; nights: number; amount: Record<string, number> };
    const bucket = (map: Map<string, Bucket>, reason: string) => {
      if (!map.has(reason)) map.set(reason, { reason, count: 0, nights: 0, amount: {} });
      return map.get(reason)!;
    };
    const comp = new Map<string, Bucket>();
    const cancel = new Map<string, Bucket>();
    const noShow: Bucket = { reason: 'no_show', count: 0, nights: 0, amount: {} };
    const compRows: any[] = [];
    for (const r of rows) {
      const c = cur.get(r.hotelId) || 'EUR';
      const n = nightsOf(r);
      if (r.isComplimentary && r.status !== 'cancelled' && r.status !== 'no_show') {
        const b = bucket(comp, r.compReason || 'other');
        b.count += 1; b.nights += n; add(b.amount, c, Number(r.compValue) || 0);
        if (compRows.length < 200) {
          compRows.push({ id: r.id, hotelId: r.hotelId, guestName: r.guestName, checkIn: r.checkIn, checkOut: r.checkOut, nights: n, reason: r.compReason, note: r.compNote, value: Number(r.compValue) || 0, currency: c, status: r.status });
        }
      }
      if (r.status === 'cancelled') {
        const b = bucket(cancel, r.cancelReason || 'other');
        b.count += 1; b.nights += n; add(b.amount, c, Number(r.cancellationFee) || 0);
      }
      if (r.status === 'no_show') {
        noShow.count += 1; noShow.nights += n; add(noShow.amount, c, Number(r.cancellationFee) || 0);
      }
    }
    const sortB = (m: Map<string, Bucket>) => [...m.values()].sort((a, b) => b.count - a.count);
    return { from: scope.fromDate, to: scope.toDate, complimentary: { byReason: sortB(comp), rows: compRows }, cancellations: sortB(cancel), noShow };
  }

  async getPacingTargets(tenantId: string, hotelId: string) {
    const existing = await this.pacingTargetsRepo.find({
      where: { tenantId, hotelId },
      order: { daysBeforeArrival: 'DESC' },
    });
    if (existing.length === PACING_BUCKETS.length) return existing;
    const seeded = await this.pacingTargetsRepo.save(
      PACING_BUCKETS.map((daysBeforeArrival) =>
        this.pacingTargetsRepo.create({
          tenantId,
          hotelId,
          daysBeforeArrival,
          targetPct: String(DEFAULT_PACING_TARGETS[daysBeforeArrival]),
        }),
      ),
    );
    return seeded.sort((a, b) => b.daysBeforeArrival - a.daysBeforeArrival);
  }

  async upsertPacingTargets(tenantId: string, hotelId: string, rows: { daysBeforeArrival: number; targetPct: number }[]) {
    await this.getPacingTargets(tenantId, hotelId); // ensure seeded
    for (const row of rows) {
      await this.pacingTargetsRepo.update(
        { tenantId, hotelId, daysBeforeArrival: row.daysBeforeArrival },
        { targetPct: String(row.targetPct) },
      );
    }
    return this.getPacingTargets(tenantId, hotelId);
  }

  private async resolvePacingTargets(tenantId: string, hotelIds: string[] | null): Promise<Record<number, number>> {
    const hotels = hotelIds
      ? await this.hotelsRepo.find({ where: { tenantId, id: In(hotelIds) } })
      : await this.hotelsRepo.find({ where: { tenantId } });
    if (!hotels.length) return { ...DEFAULT_PACING_TARGETS };

    const perHotel = await Promise.all(hotels.map((h) => this.getPacingTargets(tenantId, h.id)));
    const result: Record<number, number> = {};
    for (const bucket of PACING_BUCKETS) {
      const values = perHotel.map((rows) => toNum(rows.find((r) => r.daysBeforeArrival === bucket)?.targetPct));
      result[bucket] = values.length ? round2(values.reduce((s, v) => s + v, 0) / values.length) : DEFAULT_PACING_TARGETS[bucket];
    }
    return result;
  }

  private nearestBucket(daysUntilArrival: number): number {
    const sorted = [...PACING_BUCKETS].sort((a, b) => b - a);
    const found = sorted.find((b) => daysUntilArrival >= b);
    return found ?? sorted[sorted.length - 1];
  }

  /* ---------- pacing / pickup (retrospective lead-time buckets, with rollover) ---------- */

  private computePacing(active: HotelReservation[], totalCapacity: number, targetsByBucket: Record<number, number>) {
    const leadTimes = active.map((r) => daysBetween(r.createdAt.toISOString().slice(0, 10), r.checkIn));
    let carry = 0;
    const buckets = PACING_BUCKETS.map((b) => {
      const actualRooms = leadTimes.filter((lt) => lt >= b).length;
      const targetPct = targetsByBucket[b] ?? DEFAULT_PACING_TARGETS[b];
      const targetRooms = (targetPct / 100) * totalCapacity;
      const shortfall = targetRooms - actualRooms + carry;
      carry = Math.max(0, shortfall);
      const roomsNeededPerDay = b > 0 ? round2(carry / b) : null;
      const actualPct = totalCapacity > 0 ? round2((actualRooms / totalCapacity) * 100) : 0;
      const gapPct = round2(targetPct - actualPct);
      return { daysBeforeArrival: b, targetPct: round2(targetPct), actualPct, gapPct, roomsNeededPerDay };
    });
    return { buckets };
  }

  /* ---------- revenue funnel ---------- */

  private computeRevenueFunnel(
    active: HotelReservation[],
    hotels: Hotel[],
    roomTypes: HotelRoomType[],
    numDays: number,
    currency: string,
  ) {
    const planRevenue = round2(hotels.reduce((s, h) => s + toNum(h.seasonRevenueTarget), 0));
    const actualRevenue = round2(
      active.filter((r) => PAID_STATUSES.includes(r.paidStatus)).reduce((s, r) => s + toNum(r.total), 0),
    );
    const pendingRevenue = round2(
      active
        .filter((r) => !PAID_STATUSES.includes(r.paidStatus))
        .reduce((s, r) => s + toNum(r.total), 0),
    );
    const remainingRevenue = round2(Math.max(0, planRevenue - actualRevenue - pendingRevenue));
    const maxPossibleRevenue = round2(
      roomTypes.reduce((s, rt) => s + toNum(rt.basePrice) * (rt.quantity || 0) * numDays, 0),
    );
    return { planRevenue, actualRevenue, pendingRevenue, remainingRevenue, maxPossibleRevenue, currency };
  }

  /* ---------- room-type breakdown ---------- */

  private computeRoomTypeBreakdown(active: HotelReservation[], roomTypes: HotelRoomType[]) {
    return roomTypes.map((rt) => {
      const rows = active.filter((r) => r.roomTypeId === rt.id);
      const qtySold = rows.length;
      const occupancyPct = rt.quantity > 0 ? round2((qtySold / rt.quantity) * 100) : 0;
      // ADR — цена продажи за платную ночь (бесплатные проживания не занижают); раньше бралась себестоимость
      const paid = rows.filter((r) => !r.isComplimentary);
      const paidNights = paid.reduce((s, r) => s + nightsOf(r), 0);
      const adr = paidNights > 0 ? round2(paid.reduce((s, r) => s + toNum(r.total), 0) / paidNights) : 0;
      const avgGuestsPerBooking = qtySold > 0 ? round2(rows.reduce((s, r) => s + (r.pax || 0), 0) / qtySold) : 0;
      const revenue = round2(rows.reduce((s, r) => s + toNum(r.total), 0));
      return {
        roomTypeId: rt.id,
        name: rt.name,
        qtyTotal: rt.quantity,
        qtySold,
        occupancyPct,
        adr,
        avgGuestsPerBooking,
        revenue,
      };
    });
  }

  /* ---------- revenue by market (free-text market string, no FK) ---------- */

  private computeMarketBreakdown(active: HotelReservation[]) {
    const map = new Map<string, { revenueActual: number; roomsSold: number }>();
    for (const r of active) {
      const key = r.market || 'Не указан';
      const row = map.get(key) || { revenueActual: 0, roomsSold: 0 };
      row.revenueActual += toNum(r.total);
      row.roomsSold += 1;
      map.set(key, row);
    }
    return Array.from(map.entries())
      .map(([market, v]) => ({ market, revenueActual: round2(v.revenueActual), revenueTarget: null, roomsSold: v.roomsSold }))
      .sort((a, b) => b.revenueActual - a.revenueActual);
  }

  /* ---------- sales by partner ---------- */

  private computeAgencyBreakdown(active: HotelReservation[], all: HotelReservation[], partners: HotelAgency[]) {
    const byId = new Map(partners.map((p) => [p.id, p]));
    type Row = { name: string; type: string | null; country: string | null; bookingsCount: number; cancelled: number; roomNights: number; paidNights: number; revenue: number; net: number; commission: number };
    const map = new Map<string, Row>();
    const row = (r: HotelReservation) => {
      const key = r.agencyId || '__direct__';
      const p = r.agencyId ? byId.get(r.agencyId) : null;
      if (!map.has(key)) {
        map.set(key, { name: p?.name || (r.agencyId ? 'Партнёр' : 'Прямые продажи'), type: p?.type ?? (r.agencyId ? null : 'direct'), country: p?.countryCode ?? null, bookingsCount: 0, cancelled: 0, roomNights: 0, paidNights: 0, revenue: 0, net: 0, commission: 0 });
      }
      return map.get(key)!;
    };
    for (const r of active) {
      const x = row(r);
      x.bookingsCount += 1;
      x.roomNights += nightsOf(r);
      if (!r.isComplimentary) x.paidNights += nightsOf(r);
      x.revenue += toNum(r.total);
      x.net += toNum(r.netTotal || r.total);
      x.commission += toNum(r.commissionAmount);
    }
    for (const r of all) if (r.status === 'cancelled') row(r).cancelled += 1;
    const totalRevenue = Array.from(map.values()).reduce((s, v) => s + v.revenue, 0);
    return Array.from(map.entries())
      .map(([key, v]) => ({
        agencyId: key === '__direct__' ? null : key,
        name: v.name,
        type: v.type,
        country: v.country,
        bookingsCount: v.bookingsCount,
        roomNights: v.roomNights,
        revenue: round2(v.revenue),
        net: round2(v.net),
        commission: round2(v.commission),
        avgRate: v.bookingsCount > 0 ? round2(v.revenue / v.bookingsCount) : 0,
        adr: v.paidNights > 0 ? round2(v.revenue / v.paidNights) : 0,
        cancelPct: v.bookingsCount + v.cancelled > 0 ? round2((v.cancelled / (v.bookingsCount + v.cancelled)) * 100) : 0,
        sharePct: totalRevenue > 0 ? round2((v.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /* ---------- три страны: гостя, покупки, партнёра ---------- */

  private computeCountryBreakdown(active: HotelReservation[], all: HotelReservation[], partners: HotelAgency[]) {
    const partnerCountry = new Map(partners.map((p) => [p.id, p.countryCode]));
    const build = (keyOf: (r: HotelReservation) => string | null | undefined) => {
      type Row = { bookings: number; cancelled: number; roomNights: number; paidNights: number; gross: number; net: number; commission: number; guests: number };
      const map = new Map<string, Row>();
      const get = (k: string) => {
        if (!map.has(k)) map.set(k, { bookings: 0, cancelled: 0, roomNights: 0, paidNights: 0, gross: 0, net: 0, commission: 0, guests: 0 });
        return map.get(k)!;
      };
      for (const r of active) {
        const x = get(keyOf(r) || '');
        x.bookings += 1;
        x.roomNights += nightsOf(r);
        if (!r.isComplimentary) x.paidNights += nightsOf(r);
        x.gross += toNum(r.total);
        x.net += toNum(r.netTotal || r.total);
        x.commission += toNum(r.commissionAmount);
        x.guests += r.pax || 0;
      }
      for (const r of all) if (r.status === 'cancelled') get(keyOf(r) || '').cancelled += 1;
      const total = Array.from(map.values()).reduce((s, v) => s + v.gross, 0);
      return Array.from(map.entries())
        .map(([country, v]) => ({
          country: country || null,
          bookings: v.bookings,
          cancelled: v.cancelled,
          roomNights: v.roomNights,
          guests: v.guests,
          gross: round2(v.gross),
          net: round2(v.net),
          commission: round2(v.commission),
          adr: v.paidNights > 0 ? round2(v.gross / v.paidNights) : 0,
          avgStay: v.bookings > 0 ? round2(v.roomNights / v.bookings) : 0,
          sharePct: total > 0 ? round2((v.gross / total) * 100) : 0,
        }))
        .sort((a, b) => b.gross - a.gross);
    };
    return {
      guest: build((r) => r.guestCountry),
      sale: build((r) => r.saleCountry),
      partner: build((r) => (r.agencyId ? partnerCountry.get(r.agencyId) : null)),
    };
  }

  private computePartnerTypeBreakdown(active: HotelReservation[], partners: HotelAgency[]) {
    const typeOf = new Map(partners.map((p) => [p.id, p.type]));
    const map = new Map<string, { bookings: number; gross: number; net: number; commission: number }>();
    for (const r of active) {
      const k = r.agencyId ? typeOf.get(r.agencyId) || 'other' : 'direct';
      const x = map.get(k) || { bookings: 0, gross: 0, net: 0, commission: 0 };
      x.bookings += 1;
      x.gross += toNum(r.total);
      x.net += toNum(r.netTotal || r.total);
      x.commission += toNum(r.commissionAmount);
      map.set(k, x);
    }
    return Array.from(map.entries())
      .map(([type, v]) => ({ type, bookings: v.bookings, gross: round2(v.gross), net: round2(v.net), commission: round2(v.commission) }))
      .sort((a, b) => b.gross - a.gross);
  }

  /* ---------- guest demographics (stubbed — no per-guest age data exists yet) ---------- */

  private computeGuestDemographics(active: HotelReservation[]) {
    const avgGuestsPerBooking = active.length > 0
      ? round2(active.reduce((s, r) => s + (r.pax || 0), 0) / active.length)
      : 0;
    // возраст — из журнала гостей (дата рождения или поле «возраст»), дети — из брони
    const ageBuckets: Record<string, number> = { '0-2': 0, '3-6': 0, '7-11': 0, '12-17': 0 };
    let adults = 0;
    let withAges = 0;
    for (const r of active) {
      for (const g of r.guests || []) {
        let age = Number(g.age);
        if ((!g.age || !Number.isFinite(age)) && g.birthDate) age = daysBetween(g.birthDate, r.checkIn) / 365.25;
        if (!Number.isFinite(age) || age < 0) continue;
        withAges += 1;
        if (age < 3) ageBuckets['0-2'] += 1;
        else if (age < 7) ageBuckets['3-6'] += 1;
        else if (age < 12) ageBuckets['7-11'] += 1;
        else if (age < 18) ageBuckets['12-17'] += 1;
        else adults += 1;
      }
    }
    const children = withAges ? ageBuckets['3-6'] + ageBuckets['7-11'] + ageBuckets['12-17'] : active.reduce((s, r) => s + (r.children || 0), 0);
    return {
      adultsCount: withAges ? adults : Math.max(0, active.reduce((s, r) => s + (r.pax || 0), 0) - children),
      childrenCount: children,
      infantsCount: ageBuckets['0-2'],
      avgGuestsPerBooking,
      ageBuckets,
      dataAvailable: active.length > 0,
    };
  }
}
