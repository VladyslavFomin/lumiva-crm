import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelRoomDateOverride } from './hotel-room-date-override.entity';
import { HotelRoomStopSaleDate } from './hotel-room-stop-sale-date.entity';
import { HotelPricingPeriod } from './hotel-pricing-period.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelContractsService } from './hotel-contracts.service';
import { HotelAvailabilityService } from './hotel-availability.service';
import { HotelRateEngineService } from './hotel-rate-engine.service';
import { matchOccupancyByAges } from './hotel-occupancy.util';
import { normalizeNumericInput } from './hotel-number.util';
import { hotelToday } from './hotel-folio.service';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const weekdayOf = (iso: string) => {
  const w = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
};

/** Ограничения продаж на дату по типу номера — то, что видят форма брони и менеджер каналов */
export interface AriRestrictions {
  /** стоп-продажа: тип номера снят с продажи, стоп-дата в таблице «По дням» или «закрыто» в календаре */
  stop: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  /** минимум ночей при заезде — строже из периода прайса и календаря */
  minStay: number;
  /** максимум ночей при заезде; 0 — без ограничения */
  maxStay: number;
}

/** Цена: что и как считать (тип номера, размещение или число взрослых, группа рынков) */
export interface AriPriceRequest {
  key: string;
  roomTypeId: string;
  occupancyTypeId?: string | null;
  /** вместо размещения — число взрослых: размещение подбирается как у брони */
  adults?: number | null;
  marketGroupId?: string | null;
}

export interface AriSnapshot {
  dates: string[];
  free: Map<string, Map<string, number>>;
  restrictions: Map<string, Map<string, AriRestrictions>>;
  overrides: Map<string, Map<string, HotelRoomDateOverride>>;
  prices: Map<string, Map<string, number | null>>;
}

/** Правка ограничений на диапазон дат (по дням недели) сразу для нескольких типов номеров */
export interface AriBulkPatch {
  roomTypeIds: string[];
  from: string;
  to: string;
  /** 1 — понедельник … 7 — воскресенье; пусто — все дни */
  weekdays?: number[];
  /** null — убрать ручную цену (снова по прайсу) */
  price?: string | number | null;
  discountPct?: string | number | null;
  stop?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  minNights?: number | null;
  maxNights?: number | null;
}

const MAX_GRID_DAYS = 62;
const MAX_BULK_DAYS = 500;

/**
 * Наличие, цены и ограничения по дням (ARI) из одного места: календарь ограничений на экране и выгрузка в каналы
 * берут одни и те же числа. Свободно = по квотам и блокам (как «Квоты и блоки») − неработающие номера.
 */
@Injectable()
export class HotelAriService {
  constructor(
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomOccupancyType) private readonly occupancy: Repository<HotelRoomOccupancyType>,
    @InjectRepository(HotelRoomDateOverride) private readonly overrides: Repository<HotelRoomDateOverride>,
    @InjectRepository(HotelRoomStopSaleDate) private readonly stopDates: Repository<HotelRoomStopSaleDate>,
    @InjectRepository(HotelPricingPeriod) private readonly periods: Repository<HotelPricingPeriod>,
    @InjectRepository(HotelMarketGroup) private readonly groups: Repository<HotelMarketGroup>,
    private readonly contracts: HotelContractsService,
    private readonly availability: HotelAvailabilityService,
    private readonly rates: HotelRateEngineService,
  ) {}

  /** Снимок ARI на dates (подряд идущие даты) для типов номеров отеля */
  async snapshot(tenantId: string, hotel: Hotel, roomTypeIds: string[], dates: string[], prices: AriPriceRequest[] = []): Promise<AriSnapshot> {
    const out: AriSnapshot = { dates, free: new Map(), restrictions: new Map(), overrides: new Map(), prices: new Map() };
    if (!dates.length || !roomTypeIds.length) return out;
    const start = dates[0];
    const endExcl = addDaysIso(dates[dates.length - 1], 1);
    const types = await this.roomTypes.find({ where: { tenantId, hotelId: hotel.id, id: In(roomTypeIds) } });
    const ids = types.map((t) => t.id);

    // свободно: окнами по 120 ночей (ограничение расчёта квот)
    const freeRaw = new Map<string, number>();
    for (let i = 0; i < dates.length; i += 120) {
      const from = dates[i];
      const to = addDaysIso(dates[Math.min(dates.length - 1, i + 119)], 1);
      const inv = await this.contracts.inventory(tenantId, hotel.id, from, to);
      for (const row of inv.rows) for (const d of row.days) freeRaw.set(`${row.roomTypeId}|${d.date}`, d.free);
    }
    const [ovs, stops, periods] = await Promise.all([
      ids.length ? this.overrides.find({ where: { tenantId, roomTypeId: In(ids), date: Between(start, endExcl) } }) : Promise.resolve([] as HotelRoomDateOverride[]),
      ids.length ? this.stopDates.find({ where: { tenantId, roomTypeId: In(ids), date: Between(start, endExcl) } }) : Promise.resolve([] as HotelRoomStopSaleDate[]),
      this.periods.find({ where: { tenantId, hotelId: hotel.id }, order: { startDate: 'ASC' } }),
    ]);
    const periodMin = (d: string) => periods.find((p) => d >= p.startDate && d <= p.endDate)?.minNights || 1;

    for (const t of types) {
      const ooo = await this.availability.oooCounter(tenantId, t.id, start, endExcl, true);
      const free = new Map<string, number>();
      const restr = new Map<string, AriRestrictions>();
      const ovMap = new Map<string, HotelRoomDateOverride>();
      for (const o of ovs) if (o.roomTypeId === t.id) ovMap.set(o.date, o);
      const stopSet = new Set(stops.filter((s) => s.roomTypeId === t.id).map((s) => s.date));
      for (const d of [...dates, endExcl]) {
        const o = ovMap.get(d);
        if (d !== endExcl) free.set(d, Math.max(0, (freeRaw.get(`${t.id}|${d}`) ?? 0) - ooo(d)));
        restr.set(d, {
          stop: !!t.stopSale || stopSet.has(d) || !!o?.blocked,
          closedToArrival: !!o?.closedToArrival,
          closedToDeparture: !!o?.closedToDeparture,
          minStay: Math.max(1, periodMin(d), o?.minNights || 1),
          maxStay: o?.maxNights && o.maxNights > 0 ? o.maxNights : 0,
        });
      }
      out.free.set(t.id, free);
      out.restrictions.set(t.id, restr);
      out.overrides.set(t.id, ovMap);
    }

    // цены — тем же расчётом, что у брони (prices по ночам), окнами по 366 ночей
    for (const p of prices) {
      if (!ids.includes(p.roomTypeId)) continue;
      const map = new Map<string, number | null>();
      let occupancyTypeId = p.occupancyTypeId ?? null;
      if (!occupancyTypeId && p.adults) {
        const occ = await this.occupancy.find({ where: { tenantId, roomTypeId: p.roomTypeId }, order: { sortOrder: 'ASC' } });
        occupancyTypeId = matchOccupancyByAges(occ, p.adults, [])?.id ?? null;
        if (!occupancyTypeId) {
          for (const d of dates) map.set(d, null);
          out.prices.set(p.key, map);
          continue;
        }
      }
      for (let i = 0; i < dates.length; i += 366) {
        const checkIn = dates[i];
        const checkOut = addDaysIso(dates[Math.min(dates.length - 1, i + 365)], 1);
        const q = await this.rates.quote(tenantId, { roomTypeId: p.roomTypeId, occupancyTypeId, checkIn, checkOut, marketGroupId: p.marketGroupId ?? null });
        for (const n of q.nights) map.set(n.date, n.price > 0 ? round2(n.price) : null);
      }
      out.prices.set(p.key, map);
    }
    return out;
  }

  /** Сетка «типы номеров × дни» для календаря ограничений: свободно, цена (по числу взрослых), ограничения */
  async grid(tenantId: string, hotelId: string, q: { from?: string; days?: number; adults?: number; marketGroupId?: string | null }) {
    const hotel = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const from = q.from && ISO.test(q.from) ? q.from : hotelToday(hotel);
    const days = Math.min(MAX_GRID_DAYS, Math.max(7, Math.round(Number(q.days) || 31)));
    const adults = Math.min(12, Math.max(1, Math.round(Number(q.adults) || 2)));
    const dates = Array.from({ length: days }, (_, i) => addDaysIso(from, i));
    const types = await this.roomTypes.find({ where: { tenantId, hotelId }, order: { createdAt: 'ASC' } });
    types.sort((a, b) => Number(b.isBaseRoomType) - Number(a.isBaseRoomType));
    const groups = await this.groups.find({ where: { tenantId, hotelId } });
    const marketGroupId = q.marketGroupId && groups.some((g) => g.id === q.marketGroupId) ? q.marketGroupId : null;
    const snap = await this.snapshot(tenantId, hotel, types.map((t) => t.id), dates, types.map((t) => ({ key: t.id, roomTypeId: t.id, adults, marketGroupId })));
    return {
      hotelId,
      from,
      days,
      adults,
      marketGroupId,
      today: hotelToday(hotel),
      currency: (hotel.currency || 'EUR').toUpperCase(),
      dates,
      roomTypes: types.map((t) => ({
        id: t.id,
        name: t.name,
        isBase: t.isBaseRoomType,
        stopSale: t.stopSale,
        days: dates.map((d) => {
          const r = snap.restrictions.get(t.id)?.get(d);
          const o = snap.overrides.get(t.id)?.get(d);
          return {
            date: d,
            free: snap.free.get(t.id)?.get(d) ?? 0,
            price: snap.prices.get(t.id)?.get(d) ?? null,
            stop: r?.stop ?? false,
            closedToArrival: r?.closedToArrival ?? false,
            closedToDeparture: r?.closedToDeparture ?? false,
            minStay: r?.minStay ?? 1,
            maxStay: r?.maxStay ?? 0,
            manualPrice: o?.price !== null && o?.price !== undefined ? Number(o.price) : null,
            discountPct: o ? Number(o.discountPct) || 0 : 0,
            /** стоп поставлен не в календаре (тип номера снят с продажи или стоп-дата «По дням») — снимается там же */
            stopElsewhere: !!r?.stop && !o?.blocked,
          };
        }),
      })),
    };
  }

  /** Одна дата: то же, что bulk на один день и один тип номера */
  async upsertOne(tenantId: string, roomTypeId: string, date: string, dto: Omit<AriBulkPatch, 'roomTypeIds' | 'from' | 'to' | 'weekdays'> & { blocked?: boolean }) {
    const { blocked, ...rest } = dto;
    await this.bulk(tenantId, { ...rest, ...(blocked !== undefined && rest.stop === undefined ? { stop: blocked } : {}), roomTypeIds: [roomTypeId], from: date, to: date });
    const row = await this.overrides.findOne({ where: { tenantId, roomTypeId, date } });
    return row ?? { tenantId, roomTypeId, date, price: null, blocked: false, discountPct: '0', minNights: 1, closedToArrival: false, closedToDeparture: false, maxNights: null };
  }

  /**
   * Массовая правка ограничений: диапазон дат × дни недели × типы номеров. Меняются только присланные поля; запись,
   * в которой не осталось ни одного отличия от «по умолчанию», удаляется (календарь не копит пустые строки).
   */
  async bulk(tenantId: string, dto: AriBulkPatch) {
    const bad = (code: string, message: string) => new BadRequestException({ code, message });
    if (!ISO.test(dto.from || '') || !ISO.test(dto.to || '') || dto.to < dto.from) throw bad('HOTEL_ARI_DATES', 'Неверный диапазон дат');
    const ids = [...new Set((Array.isArray(dto.roomTypeIds) ? dto.roomTypeIds : []).filter((x) => typeof x === 'string'))];
    if (!ids.length) throw bad('HOTEL_ARI_ROOMS', 'Выберите типы номеров');
    const types = await this.roomTypes.find({ where: { tenantId, id: In(ids) } });
    if (types.length !== ids.length) throw bad('HOTEL_ARI_ROOMS', 'Тип номера не найден');
    if (new Set(types.map((t) => t.hotelId)).size !== 1) throw bad('HOTEL_ARI_ROOMS', 'Типы номеров из разных отелей');
    const weekdays = (Array.isArray(dto.weekdays) ? dto.weekdays : []).map(Number).filter((w) => w >= 1 && w <= 7);
    const dates: string[] = [];
    for (let d = dto.from; d <= dto.to; d = addDaysIso(d, 1)) {
      if (!weekdays.length || weekdays.includes(weekdayOf(d))) dates.push(d);
      if (dates.length > MAX_BULK_DAYS) throw bad('HOTEL_ARI_RANGE', `Не больше ${MAX_BULK_DAYS} дней за раз`);
    }
    if (!dates.length) return { updated: 0, removed: 0, dates: 0 };

    const intOrNull = (v: unknown, min: number, max: number, field: string) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < min || n > max) throw bad('HOTEL_ARI_VALUE', `${field}: от ${min} до ${max}`);
      return n;
    };
    const patch: Partial<HotelRoomDateOverride> = {};
    if (dto.price !== undefined) {
      if (dto.price === null || dto.price === '') patch.price = null;
      else {
        const p = Number(normalizeNumericInput(dto.price));
        if (!Number.isFinite(p) || p <= 0) throw bad('HOTEL_ARI_VALUE', 'Цена должна быть больше 0');
        patch.price = String(round2(p));
      }
    }
    if (dto.discountPct !== undefined) {
      const p = dto.discountPct === null || dto.discountPct === '' ? 0 : Number(normalizeNumericInput(dto.discountPct));
      if (!Number.isFinite(p) || p < 0 || p >= 100) throw bad('HOTEL_ARI_VALUE', 'Скидка: от 0 до 99 %');
      patch.discountPct = String(round2(p));
    }
    if (dto.stop !== undefined) patch.blocked = !!dto.stop;
    if (dto.closedToArrival !== undefined) patch.closedToArrival = !!dto.closedToArrival;
    if (dto.closedToDeparture !== undefined) patch.closedToDeparture = !!dto.closedToDeparture;
    if (dto.minNights !== undefined) patch.minNights = intOrNull(dto.minNights, 1, 60, 'Минимум ночей') ?? 1;
    if (dto.maxNights !== undefined) patch.maxNights = intOrNull(dto.maxNights, 1, 365, 'Максимум ночей');
    if (patch.maxNights && patch.minNights && patch.maxNights < patch.minNights) throw bad('HOTEL_ARI_VALUE', 'Максимум ночей меньше минимума');
    if (!Object.keys(patch).length) throw bad('HOTEL_ARI_EMPTY', 'Нечего менять');

    const existing = await this.overrides.find({ where: { tenantId, roomTypeId: In(ids), date: In(dates) } });
    const byKey = new Map(existing.map((o) => [`${o.roomTypeId}|${o.date}`, o]));
    const toSave: HotelRoomDateOverride[] = [];
    const toRemove: HotelRoomDateOverride[] = [];
    for (const rt of ids) {
      for (const d of dates) {
        const cur = byKey.get(`${rt}|${d}`) || this.overrides.create({ tenantId, roomTypeId: rt, date: d, price: null, blocked: false, discountPct: '0', minNights: 1, closedToArrival: false, closedToDeparture: false, maxNights: null });
        Object.assign(cur, patch);
        if (cur.maxNights && cur.maxNights < (cur.minNights || 1)) {
          throw bad('HOTEL_ARI_VALUE', `Максимум ночей меньше минимума (${d})`);
        }
        const empty = cur.price === null && !cur.blocked && !(Number(cur.discountPct) > 0) && (cur.minNights || 1) <= 1 && !cur.closedToArrival && !cur.closedToDeparture && !cur.maxNights;
        if (empty) {
          if (cur.id) toRemove.push(cur);
        } else toSave.push(cur);
      }
    }
    for (let i = 0; i < toSave.length; i += 500) await this.overrides.save(toSave.slice(i, i + 500));
    if (toRemove.length) await this.overrides.remove(toRemove);
    return { updated: toSave.length, removed: toRemove.length, dates: dates.length, roomTypes: ids.length };
  }
}
