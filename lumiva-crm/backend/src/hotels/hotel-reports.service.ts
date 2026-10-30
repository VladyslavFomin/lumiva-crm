import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelRoomOutage } from './hotel-housekeeping.entities';
import { hotelToday } from './hotel-folio.service';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const nightsOf = (r: Pick<HotelReservation, 'checkIn' | 'checkOut'>) => Math.max(1, daysBetween(r.checkIn, r.checkOut));
const SOLD = ['confirmed', 'pending', 'checked_in', 'checked_out'];
const bad = (code: string, message: string) => new BadRequestException({ code, message });

type Bucket = { period: string; available: number; sold: number; comp: number; revenue: number };
const finish = (b: Bucket) => {
  const paid = b.sold - b.comp;
  return {
    ...b,
    revenue: round2(b.revenue),
    occupancyPct: b.available ? round2((b.sold / b.available) * 100) : 0,
    adr: paid > 0 ? round2(b.revenue / paid) : 0,
    revpar: b.available ? round2(b.revenue / b.available) : 0,
  };
};

/**
 * Отчёты PMS (PMS-120…123) по одному отелю, в его валюте. Комната-ночь продана, если бронь подтверждена/ожидает/
 * заселена/выехала; бесплатные считаются в загрузке, но не в ADR. Вместимость по дням — рабочие номера минус OOO.
 */
@Injectable()
export class HotelReportsService {
  constructor(
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelRoomOutage) private readonly outages: Repository<HotelRoomOutage>,
  ) {}

  private async scope(tenantId: string, hotelId: string, from: string, to: string) {
    if (!hotelId) throw bad('HOTEL_REPORT_HOTEL_REQUIRED', 'Выберите отель');
    if (!ISO.test(from) || !ISO.test(to) || to < from) throw bad('HOTEL_REPORT_BAD_DATES', 'Неверный период');
    if (daysBetween(from, to) > 731) throw bad('HOTEL_REPORT_RANGE', 'Период не больше двух лет');
    const hotel = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const [types, units, outs] = await Promise.all([
      this.roomTypes.find({ where: { tenantId, hotelId } }),
      this.units.find({ where: { tenantId, hotelId, active: true } }),
      this.outages.find({ where: { tenantId, hotelId, kind: 'ooo' } }),
    ]);
    /** доступно номеров типа в ночь d */
    const capacity = (typeId: string, d: string) => {
      const list = units.filter((u) => u.roomTypeId === typeId);
      if (!list.length) return types.find((t) => t.id === typeId)?.quantity || 0;
      return list.filter((u) => u.housekeepingStatus !== 'out_of_order' && !outs.some((o) => o.roomUnitId === u.id && o.dateFrom <= d && (!o.dateTo || d < o.dateTo))).length;
    };
    return { hotel, types, capacity };
  }

  private stays(tenantId: string, hotelId: string, from: string, to: string) {
    return this.reservations
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId })
      .andWhere('r.checkIn <= :to AND r.checkOut > :from', { from, to })
      .getMany();
  }

  /** Occupancy / ADR / RevPAR по дням или месяцам, итог и разрез по типам номеров (PMS-120) */
  async performance(tenantId: string, q: { hotelId: string; from: string; to: string; groupBy?: string; roomTypeId?: string }) {
    const { hotel, types, capacity } = await this.scope(tenantId, q.hotelId, q.from, q.to);
    const typeIds = types.filter((t) => !q.roomTypeId || t.id === q.roomTypeId).map((t) => t.id);
    const res = (await this.stays(tenantId, q.hotelId, q.from, q.to)).filter((r) => SOLD.includes(r.status) && typeIds.includes(r.roomTypeId));
    const byMonth = q.groupBy === 'month';
    const periods = new Map<string, Bucket>();
    const byType = new Map<string, Bucket>(typeIds.map((id) => [id, { period: id, available: 0, sold: 0, comp: 0, revenue: 0 }]));
    const total: Bucket = { period: 'total', available: 0, sold: 0, comp: 0, revenue: 0 };
    for (let d = q.from; d <= q.to; d = addDays(d, 1)) {
      const key = byMonth ? d.slice(0, 7) : d;
      if (!periods.has(key)) periods.set(key, { period: key, available: 0, sold: 0, comp: 0, revenue: 0 });
      const p = periods.get(key)!;
      for (const tid of typeIds) {
        const cap = capacity(tid, d);
        const sold = res.filter((r) => r.roomTypeId === tid && r.checkIn <= d && r.checkOut > d);
        const comp = sold.filter((r) => r.isComplimentary).length;
        const rev = sold.reduce((s, r) => s + num(r.total) / nightsOf(r), 0);
        for (const b of [p, byType.get(tid)!, total]) {
          b.available += cap;
          b.sold += sold.length;
          b.comp += comp;
          b.revenue += rev;
        }
      }
    }
    return {
      hotel: { id: hotel.id, name: hotel.name, currency: (hotel.currency || '').toUpperCase() },
      from: q.from,
      to: q.to,
      groupBy: byMonth ? 'month' : 'day',
      rows: [...periods.values()].map(finish),
      byRoomType: [...byType.values()].map((b) => ({ ...finish(b), roomTypeId: b.period, name: types.find((t) => t.id === b.period)?.name || '' })),
      total: finish(total),
    };
  }

  /**
   * Прогноз «на книгах» (PMS-121) на 30/90/365 дней от сегодня и сравнение с тем же моментом прошлого года
   * (STLY: даты −364 дня — тот же день недели; брони, созданные к той же дате и не отменённые к ней).
   */
  async forecast(tenantId: string, q: { hotelId: string; horizon?: string }) {
    const hotel0 = await this.hotels.findOne({ where: { id: q.hotelId, tenantId } });
    if (!hotel0) throw new NotFoundException('Отель не найден');
    const horizon = [30, 90, 365].includes(Number(q.horizon)) ? Number(q.horizon) : 90;
    const today = hotelToday(hotel0);
    const to = addDays(today, horizon - 1);
    const lyFrom = addDays(today, -364);
    const lyTo = addDays(to, -364);
    const asOfLy = new Date(`${lyFrom}T23:59:59Z`);
    const { capacity, types } = await this.scope(tenantId, q.hotelId, today, to);
    const [cur, ly] = await Promise.all([this.stays(tenantId, q.hotelId, today, to), this.stays(tenantId, q.hotelId, lyFrom, lyTo)]);
    const onBooks = cur.filter((r) => SOLD.includes(r.status));
    // на тот момент прошлого года: бронь уже была создана и ещё не отменена
    const stly = ly.filter((r) => r.createdAt <= asOfLy && (SOLD.includes(r.status) || (r.status === 'cancelled' && r.cancelledAt && r.cancelledAt > asOfLy)));
    const lyActual = ly.filter((r) => r.status === 'checked_in' || r.status === 'checked_out');
    const byMonth = horizon > 30;
    const rows = new Map<string, { period: string; available: number; otbRooms: number; otbRevenue: number; stlyRooms: number; stlyRevenue: number; lyRooms: number; lyRevenue: number }>();
    const night = (list: HotelReservation[], d: string) => list.filter((r) => r.checkIn <= d && r.checkOut > d);
    for (let d = today; d <= to; d = addDays(d, 1)) {
      const key = byMonth ? d.slice(0, 7) : d;
      if (!rows.has(key)) rows.set(key, { period: key, available: 0, otbRooms: 0, otbRevenue: 0, stlyRooms: 0, stlyRevenue: 0, lyRooms: 0, lyRevenue: 0 });
      const row = rows.get(key)!;
      const dl = addDays(d, -364);
      row.available += types.reduce((s, t) => s + capacity(t.id, d), 0);
      const a = night(onBooks, d), b = night(stly, dl), c = night(lyActual, dl);
      row.otbRooms += a.length;
      row.otbRevenue += a.reduce((s, r) => s + num(r.total) / nightsOf(r), 0);
      row.stlyRooms += b.length;
      row.stlyRevenue += b.reduce((s, r) => s + num(r.total) / nightsOf(r), 0);
      row.lyRooms += c.length;
      row.lyRevenue += c.reduce((s, r) => s + num(r.total) / nightsOf(r), 0);
    }
    const out = [...rows.values()].map((r) => ({
      ...r,
      otbRevenue: round2(r.otbRevenue), stlyRevenue: round2(r.stlyRevenue), lyRevenue: round2(r.lyRevenue),
      otbOccPct: r.available ? round2((r.otbRooms / r.available) * 100) : 0,
      stlyOccPct: r.available ? round2((r.stlyRooms / r.available) * 100) : 0,
    }));
    const sum = (k: keyof (typeof out)[number]) => round2(out.reduce((s, r) => s + num(r[k]), 0));
    return {
      hotel: { id: hotel0.id, name: hotel0.name, currency: (hotel0.currency || '').toUpperCase() },
      today, to, horizon, groupBy: byMonth ? 'month' : 'day', rows: out,
      total: { available: sum('available'), otbRooms: sum('otbRooms'), otbRevenue: sum('otbRevenue'), stlyRooms: sum('stlyRooms'), stlyRevenue: sum('stlyRevenue'), lyRooms: sum('lyRooms'), lyRevenue: sum('lyRevenue') },
    };
  }

  /** Pickup (PMS-123): сколько комнато-ночей добавилось за 1/7/30 дней по будущим датам проживания (минус отмены за то же окно) */
  async pickup(tenantId: string, q: { hotelId: string; horizon?: string }) {
    const hotel0 = await this.hotels.findOne({ where: { id: q.hotelId, tenantId } });
    if (!hotel0) throw new NotFoundException('Отель не найден');
    const horizon = [30, 90, 180].includes(Number(q.horizon)) ? Number(q.horizon) : 90;
    const today = hotelToday(hotel0);
    const to = addDays(today, horizon - 1);
    const res = await this.stays(tenantId, q.hotelId, today, to);
    const now = Date.now();
    const windows = [1, 7, 30] as const;
    const since = Object.fromEntries(windows.map((w) => [w, new Date(now - w * 86_400_000)])) as Record<number, Date>;
    const byMonth = horizon > 30;
    const rows = new Map<string, Record<string, number | string>>();
    for (let d = today; d <= to; d = addDays(d, 1)) {
      const key = byMonth ? d.slice(0, 7) : d;
      if (!rows.has(key)) rows.set(key, { period: key, otb: 0, p1: 0, p7: 0, p30: 0, c1: 0, c7: 0, c30: 0 });
      const row = rows.get(key)!;
      for (const r of res) {
        if (!(r.checkIn <= d && r.checkOut > d)) continue;
        const active = SOLD.includes(r.status);
        if (active) row.otb = (row.otb as number) + 1;
        for (const w of windows) {
          if (active && r.createdAt >= since[w]) row[`p${w}`] = (row[`p${w}`] as number) + 1;
          const cancelledAt = r.status === 'cancelled' ? r.cancelledAt : r.status === 'no_show' ? r.noShowAt : null;
          // отменённая в окне бронь, созданная до окна, — минус к pickup
          if (cancelledAt && cancelledAt >= since[w] && r.createdAt < since[w]) row[`c${w}`] = (row[`c${w}`] as number) + 1;
        }
      }
    }
    const out = [...rows.values()].map((r) => ({
      period: r.period as string, otb: r.otb as number,
      pickup1: (r.p1 as number) - (r.c1 as number), pickup7: (r.p7 as number) - (r.c7 as number), pickup30: (r.p30 as number) - (r.c30 as number),
      new30: r.p30 as number, cancelled30: r.c30 as number,
    }));
    const total = out.reduce((s, r) => ({ otb: s.otb + r.otb, pickup1: s.pickup1 + r.pickup1, pickup7: s.pickup7 + r.pickup7, pickup30: s.pickup30 + r.pickup30, new30: s.new30 + r.new30, cancelled30: s.cancelled30 + r.cancelled30 }), { otb: 0, pickup1: 0, pickup7: 0, pickup30: 0, new30: 0, cancelled30: 0 });
    return { hotel: { id: hotel0.id, name: hotel0.name }, today, to, horizon, groupBy: byMonth ? 'month' : 'day', rows: out, total };
  }

  /** Excel по отчёту показателей — заголовки на языке пользователя */
  async performanceXlsx(tenantId: string, q: { hotelId: string; from: string; to: string; groupBy?: string; roomTypeId?: string; lang?: string }) {
    const data = await this.performance(tenantId, q);
    const H = {
      ru: ['Период', 'Доступно', 'Продано', 'Бесплатно', 'Загрузка %', 'Выручка', 'ADR', 'RevPAR', 'Итого', 'Тип номера', 'По типам номеров'],
      en: ['Period', 'Available', 'Sold', 'Complimentary', 'Occupancy %', 'Revenue', 'ADR', 'RevPAR', 'Total', 'Room type', 'By room type'],
      tr: ['Dönem', 'Müsait', 'Satılan', 'Ücretsiz', 'Doluluk %', 'Gelir', 'ADR', 'RevPAR', 'Toplam', 'Oda tipi', 'Oda tiplerine göre'],
    }[q.lang === 'en' || q.lang === 'tr' ? q.lang : 'ru'];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(data.hotel.name.slice(0, 30) || 'Report');
    ws.addRow([`${data.hotel.name} · ${data.from} – ${data.to} · ${data.hotel.currency}`]);
    ws.addRow([]);
    ws.addRow(H.slice(0, 8)).font = { bold: true };
    for (const r of data.rows) ws.addRow([r.period, r.available, r.sold, r.comp, r.occupancyPct, r.revenue, r.adr, r.revpar]);
    const t = data.total;
    ws.addRow([H[8], t.available, t.sold, t.comp, t.occupancyPct, t.revenue, t.adr, t.revpar]).font = { bold: true };
    ws.addRow([]);
    ws.addRow([H[10]]).font = { bold: true };
    ws.addRow([H[9], ...H.slice(1, 8)]).font = { bold: true };
    for (const r of data.byRoomType) ws.addRow([r.name, r.available, r.sold, r.comp, r.occupancyPct, r.revenue, r.adr, r.revpar]);
    ws.columns.forEach((c, i) => { c.width = i === 0 ? 22 : 13; });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
