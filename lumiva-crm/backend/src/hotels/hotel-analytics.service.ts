import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelAgency } from './hotel-agency.entity';
import { HotelSeasonPacingTarget } from './hotel-season-pacing-target.entity';
import { HotelAnalyticsQueryDto } from './dto/hotel-analytics-query.dto';

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
}

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
  ) {}

  private resolveScope(q: HotelAnalyticsQueryDto): Scope {
    const toDate = q.dateTo || todayStr();
    const fromDate = q.dateFrom || addDaysStr(toDate, -30);
    const hotelIds = !q.hotelIds || q.hotelIds === 'all' ? null : q.hotelIds.split(',').filter(Boolean);
    return { fromDate, toDate, hotelIds, roomTypeId: q.roomTypeId, marketId: q.marketId, agencyId: q.agencyId };
  }

  private async loadScope(tenantId: string, scope: Scope) {
    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.checkIn BETWEEN :from AND :to', { from: scope.fromDate, to: scope.toDate });
    if (scope.hotelIds) qb.andWhere('r.hotelId IN (:...hotelIds)', { hotelIds: scope.hotelIds });
    if (scope.roomTypeId) qb.andWhere('r.roomTypeId = :roomTypeId', { roomTypeId: scope.roomTypeId });
    if (scope.marketId) qb.andWhere('r.market = :marketId', { marketId: scope.marketId });
    if (scope.agencyId) qb.andWhere('r.agencyId = :agencyId', { agencyId: scope.agencyId });
    const reservations = await qb.getMany();

    const roomTypeWhere: any = scope.hotelIds ? { tenantId, hotelId: In(scope.hotelIds) } : { tenantId };
    let roomTypes = await this.roomTypesRepo.find({ where: roomTypeWhere });
    if (scope.roomTypeId) roomTypes = roomTypes.filter((rt) => rt.id === scope.roomTypeId);

    const hotelWhere: any = scope.hotelIds ? { tenantId, id: In(scope.hotelIds) } : { tenantId };
    const hotels = await this.hotelsRepo.find({ where: hotelWhere });

    return { reservations, roomTypes, hotels };
  }

  private active(reservations: HotelReservation[]) {
    return reservations.filter((r) => ACTIVE_STATUSES.includes(r.status));
  }

  async getSummary(tenantId: string, q: HotelAnalyticsQueryDto) {
    const scope = this.resolveScope(q);
    const { reservations, roomTypes, hotels } = await this.loadScope(tenantId, scope);
    const active = this.active(reservations);
    const roomsTotal = roomTypes.reduce((s, rt) => s + (rt.quantity || 0), 0);
    const numDays = Math.max(1, daysBetween(scope.fromDate, scope.toDate) + 1);
    const totalCapacity = roomsTotal * numDays;
    const currency = hotels[0]?.currency || 'USD';

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
    const agencies = await this.computeAgencyBreakdown(tenantId, active);
    const guests = this.computeGuestDemographics(active);

    return { kpis, pacing, funnel, roomTypes: roomTypesBreakdown, markets, agencies, guests };
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
      const adr = qtySold > 0 ? round2(rows.reduce((s, r) => s + toNum(r.costPerNight), 0) / qtySold) : 0;
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

  /* ---------- sales by agency/channel ---------- */

  private async computeAgencyBreakdown(tenantId: string, active: HotelReservation[]) {
    const agencyIds = Array.from(new Set(active.map((r) => r.agencyId).filter((id): id is string => !!id)));
    const agencies = agencyIds.length
      ? await this.agenciesRepo.find({ where: { tenantId, id: In(agencyIds) } })
      : [];
    const nameById = new Map(agencies.map((a) => [a.id, a.name]));

    const map = new Map<string, { name: string; bookingsCount: number; revenue: number }>();
    for (const r of active) {
      const key = r.agencyId || '__direct__';
      const name = r.agencyId ? nameById.get(r.agencyId) || 'Агентство' : 'Прямые продажи';
      const row = map.get(key) || { name, bookingsCount: 0, revenue: 0 };
      row.bookingsCount += 1;
      row.revenue += toNum(r.total);
      map.set(key, row);
    }
    const totalRevenue = Array.from(map.values()).reduce((s, v) => s + v.revenue, 0);
    return Array.from(map.entries())
      .map(([key, v]) => ({
        agencyId: key === '__direct__' ? null : key,
        name: v.name,
        bookingsCount: v.bookingsCount,
        revenue: round2(v.revenue),
        avgRate: v.bookingsCount > 0 ? round2(v.revenue / v.bookingsCount) : 0,
        sharePct: totalRevenue > 0 ? round2((v.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /* ---------- guest demographics (stubbed — no per-guest age data exists yet) ---------- */

  private computeGuestDemographics(active: HotelReservation[]) {
    const avgGuestsPerBooking = active.length > 0
      ? round2(active.reduce((s, r) => s + (r.pax || 0), 0) / active.length)
      : 0;
    return {
      adultsCount: 0,
      childrenCount: 0,
      infantsCount: 0,
      avgGuestsPerBooking,
      ageBuckets: { '0-2': 0, '3-6': 0, '7-11': 0, '12-17': 0 },
      dataAvailable: false,
    };
  }
}
