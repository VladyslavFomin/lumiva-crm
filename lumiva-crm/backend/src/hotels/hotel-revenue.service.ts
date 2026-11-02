import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelRoomDateOverride } from './hotel-room-date-override.entity';
import { HotelRevenueRule } from './hotel-revenue-rule.entity';
import { HotelsPricingService } from './hotels-pricing.service';
import { HotelChannelsService } from './hotel-channels.service';
import { hotelToday } from './hotel-folio.service';
import { normalizeNumericInput } from './hotel-number.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bad = (code: string, message: string) => new BadRequestException({ code, message });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
/** 1 = пн … 7 = вс */
const weekday = (iso: string) => ((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
const BLOCKING = `'confirmed','pending','checked_in'`;

export interface HotelRevenueRow {
  date: string;
  weekday: number;
  lead: number;
  roomTypeId: string;
  roomTypeName: string;
  capacity: number;
  sold: number;
  occupancy: number;
  pickup: number;
  currentPct: number;
  /** поправку поставило правило (иначе — вручную) */
  currentByRule: boolean;
  recommendedPct: number | null;
  ruleId: string | null;
  ruleName: string | null;
  /** budget — урезали до бюджета PP; max — до предела ±%; manual — на дату ручная цена, поправка не действует */
  guard: 'budget' | 'max' | null;
  manualPrice: boolean;
  basePrice: number;
  currentPrice: number;
  newPrice: number | null;
}

export type HotelRevenueRuleInput = Partial<Omit<HotelRevenueRule, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;

/**
 * Рекомендации цены по загрузке и подборке: правила дают поправку ± % к цене по прайсу на дату и тип номера.
 * Ограничители — не ниже бюджета PP периода и не дальше предела отеля. Применение — поправкой rmPct в календаре
 * (движок цены, сайт и каналы подхватывают сами); автоприменение — раз в сутки, если включено.
 */
@Injectable()
export class HotelRevenueService {
  private readonly log = new Logger(HotelRevenueService.name);

  constructor(
    @InjectRepository(HotelRevenueRule) private readonly rules: Repository<HotelRevenueRule>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomOccupancyType) private readonly occupancy: Repository<HotelRoomOccupancyType>,
    @InjectRepository(HotelRoomDateOverride) private readonly overrides: Repository<HotelRoomDateOverride>,
    private readonly pricing: HotelsPricingService,
    private readonly channels: HotelChannelsService,
  ) {}

  private async hotel(tenantId: string, hotelId: string) {
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!h) throw new NotFoundException('Отель не найден');
    return h;
  }

  listRules(tenantId: string, hotelId: string) {
    return this.rules.find({ where: { tenantId, hotelId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  private async clean(tenantId: string, hotel: Hotel, dto: HotelRevenueRuleInput, current?: HotelRevenueRule): Promise<Partial<HotelRevenueRule>> {
    const out: Partial<HotelRevenueRule> = {};
    if (dto.name !== undefined) {
      const n = String(dto.name || '').trim().slice(0, 120);
      if (!n) throw bad('HOTEL_RM_NAME', 'Укажите название правила');
      out.name = n;
    }
    if (dto.metric !== undefined) out.metric = dto.metric === 'pickup' ? 'pickup' : 'occupancy';
    if (dto.op !== undefined) out.op = dto.op === 'lte' ? 'lte' : 'gte';
    if (dto.threshold !== undefined) out.threshold = String(round2(num(normalizeNumericInput(dto.threshold as any))));
    if (dto.adjustPct !== undefined) out.adjustPct = String(round2(num(normalizeNumericInput(dto.adjustPct as any))));
    if (dto.leadMin !== undefined) out.leadMin = Math.max(0, Math.min(365, Math.round(num(dto.leadMin))));
    if (dto.leadMax !== undefined) out.leadMax = dto.leadMax === null || (dto.leadMax as any) === '' ? null : Math.max(0, Math.min(365, Math.round(num(dto.leadMax))));
    if (dto.weekdays !== undefined) out.weekdays = [...new Set((Array.isArray(dto.weekdays) ? dto.weekdays : []).map((x) => Math.round(num(x))).filter((x) => x >= 1 && x <= 7))].sort();
    if (dto.roomTypeIds !== undefined) {
      const ids = [...new Set((Array.isArray(dto.roomTypeIds) ? dto.roomTypeIds : []).filter((x) => typeof x === 'string'))];
      if (ids.length && (await this.roomTypes.count({ where: { tenantId, hotelId: hotel.id, id: In(ids) } })) !== ids.length) throw bad('HOTEL_RM_ROOM', 'Тип номера не из этого отеля');
      out.roomTypeIds = ids;
    }
    if (dto.active !== undefined) out.active = !!dto.active;
    if (dto.sortOrder !== undefined) out.sortOrder = Math.round(num(dto.sortOrder));
    const r = { ...(current || {}), ...out } as HotelRevenueRule;
    const th = num(r.threshold);
    if (r.metric === 'occupancy' && (th < 0 || th > 100)) throw bad('HOTEL_RM_THRESHOLD', 'Порог загрузки — от 0 до 100 %');
    if (r.metric === 'pickup' && (th < 0 || th > 999)) throw bad('HOTEL_RM_THRESHOLD', 'Порог подборки — от 0 до 999 номеров');
    const adj = num(r.adjustPct);
    const max = num(hotel.revenueMaxPct) || 30;
    if (!adj || Math.abs(adj) > max) throw bad('HOTEL_RM_ADJUST', `Поправка — от −${max} до +${max} %, не ноль`);
    if (r.leadMax !== null && r.leadMax !== undefined && r.leadMax < (r.leadMin || 0)) throw bad('HOTEL_RM_LEAD', 'Дней до даты: «до» меньше «от»');
    return out;
  }

  async createRule(tenantId: string, dto: HotelRevenueRuleInput & { hotelId?: string }) {
    const hotel = await this.hotel(tenantId, String(dto.hotelId || ''));
    if (!dto.name || dto.threshold === undefined || dto.adjustPct === undefined) throw bad('HOTEL_RM_REQUIRED', 'Нужны название, порог и поправка');
    const base = this.rules.create({ tenantId, hotelId: hotel.id, metric: 'occupancy', op: 'gte', leadMin: 0, leadMax: null, weekdays: [], roomTypeIds: [], active: true });
    const fields = await this.clean(tenantId, hotel, dto, base);
    const count = await this.rules.count({ where: { tenantId, hotelId: hotel.id } });
    return this.rules.save(this.rules.create({ ...base, sortOrder: count, ...fields }));
  }

  async updateRule(tenantId: string, id: string, dto: HotelRevenueRuleInput) {
    const r = await this.rules.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Правило не найдено');
    Object.assign(r, await this.clean(tenantId, await this.hotel(tenantId, r.hotelId), dto, r));
    return this.rules.save(r);
  }

  async removeRule(tenantId: string, id: string) {
    const r = await this.rules.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Правило не найдено');
    await this.rules.remove(r);
    return { ok: true };
  }

  async settings(tenantId: string, hotelId: string, dto: { revenueAutoApply?: boolean; revenueHorizon?: number; revenueMaxPct?: number | string }) {
    const h = await this.hotel(tenantId, hotelId);
    if (dto.revenueAutoApply !== undefined) h.revenueAutoApply = !!dto.revenueAutoApply;
    if (dto.revenueHorizon !== undefined) {
      const v = Math.round(num(dto.revenueHorizon));
      if (v < 7 || v > 365) throw bad('HOTEL_RM_HORIZON', 'Горизонт — от 7 до 365 дней');
      h.revenueHorizon = v;
    }
    if (dto.revenueMaxPct !== undefined) {
      const v = num(normalizeNumericInput(dto.revenueMaxPct as any));
      if (v < 1 || v > 90) throw bad('HOTEL_RM_MAX', 'Предел поправки — от 1 до 90 %');
      h.revenueMaxPct = String(round2(v));
    }
    await this.hotels.save(h);
    return { revenueAutoApply: h.revenueAutoApply, revenueHorizon: h.revenueHorizon, revenueMaxPct: num(h.revenueMaxPct) };
  }

  /** Загрузка, подборка и рекомендация по каждой дате горизонта и типу номера */
  async recommendations(tenantId: string, hotelId: string, q: { from?: string; days?: number } = {}) {
    const hotel = await this.hotel(tenantId, hotelId);
    const today = hotelToday(hotel);
    const from = q.from && ISO.test(q.from) && q.from >= today ? q.from : today;
    const days = Math.max(1, Math.min(365, Math.round(num(q.days) || hotel.revenueHorizon || 90)));
    const to = addDays(from, days - 1);
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
    const [types, rules] = await Promise.all([
      this.roomTypes.find({ where: { tenantId, hotelId: hotel.id } }),
      this.rules.find({ where: { tenantId, hotelId: hotel.id, active: true }, order: { sortOrder: 'ASC', createdAt: 'ASC' } }),
    ]);
    const rts = types.filter((t) => t.quantity > 0);
    if (!rts.length) return { from, to, today, rows: [] as HotelRevenueRow[], rules: rules.length, settings: { revenueAutoApply: hotel.revenueAutoApply, revenueHorizon: hotel.revenueHorizon, revenueMaxPct: num(hotel.revenueMaxPct) } };
    const ids = rts.map((t) => t.id);
    const [stats, ooo, ovs] = await Promise.all([
      this.rules.manager.query(
        `SELECT r."roomTypeId" AS rt, d::date::text AS date, count(*)::int AS sold,
                count(*) FILTER (WHERE r."createdAt" >= now() - interval '7 days')::int AS pickup
           FROM generate_series($2::date, $3::date, interval '1 day') d
           JOIN hotel_reservations r ON r."tenantId" = $1 AND r."hotelId" = $4 AND r.status IN (${BLOCKING})
                AND r."checkIn" <= d::date AND r."checkOut" > d::date
          GROUP BY 1, 2`,
        [tenantId, from, to, hotel.id],
      ),
      this.rules.manager.query(
        `SELECT u."roomTypeId" AS rt, d::date::text AS date, count(DISTINCT u.id)::int AS n
           FROM generate_series($2::date, $3::date, interval '1 day') d
           JOIN hotel_room_outages o ON o."tenantId" = $1 AND o.kind = 'ooo' AND o."dateFrom" <= d::date AND (o."dateTo" IS NULL OR o."dateTo" >= d::date)
           JOIN hotel_room_units u ON u.id = o."roomUnitId" AND u."hotelId" = $4
          GROUP BY 1, 2`,
        [tenantId, from, to, hotel.id],
      ),
      this.overrides.find({ where: { tenantId, roomTypeId: In(ids), date: Between(from, to) } }),
    ]);
    const key = (rt: string, d: string) => `${rt}|${d}`;
    const sold = new Map<string, { sold: number; pickup: number }>(stats.map((x: any) => [key(x.rt, x.date), { sold: x.sold, pickup: x.pickup }]));
    const out = new Map<string, number>(ooo.map((x: any) => [key(x.rt, x.date), x.n]));
    const ov = new Map(ovs.map((o) => [key(o.roomTypeId, o.date), o]));
    const max = num(hotel.revenueMaxPct) || 30;
    const rows: HotelRevenueRow[] = [];
    for (const t of rts) {
      const occ = await this.occupancy.findOne({ where: { tenantId, roomTypeId: t.id }, order: { sortOrder: 'ASC' } });
      const prices = await this.pricing.dailyPrices(tenantId, hotel, t, occ, null, dates);
      for (const d of dates) {
        const s = sold.get(key(t.id, d)) || { sold: 0, pickup: 0 };
        const capacity = Math.max(0, t.quantity - (out.get(key(t.id, d)) || 0));
        const occupancy = capacity > 0 ? round2((s.sold / capacity) * 100) : 100;
        const o = ov.get(key(t.id, d));
        const cur = num(o?.rmPct);
        const manualPrice = !!o?.price && num(o.price) > 0;
        const season = prices.get(d);
        const base = season?.price || num(t.basePrice);
        const lead = daysBetween(today, d);
        const wd = weekday(d);
        const rule = o?.blocked || manualPrice ? null : rules.find((r) => {
          if (r.roomTypeIds?.length && !r.roomTypeIds.includes(t.id)) return false;
          if (r.weekdays?.length && !r.weekdays.includes(wd)) return false;
          if (lead < (r.leadMin || 0) || (r.leadMax !== null && r.leadMax !== undefined && lead > r.leadMax)) return false;
          const v = r.metric === 'pickup' ? s.pickup : occupancy;
          return r.op === 'lte' ? v <= num(r.threshold) : v >= num(r.threshold);
        }) || null;
        let rec: number | null = null;
        let guard: HotelRevenueRow['guard'] = null;
        if (rule) {
          rec = num(rule.adjustPct);
          if (Math.abs(rec) > max) { rec = Math.sign(rec) * max; guard = 'max'; }
          // не ниже бюджета PP периода (окупаемость)
          if (rec < 0 && season?.budget && season.pp > 0 && season.pp * (1 + rec / 100) < season.budget) {
            // шаг 0,5 %; 90/100−1 даёт −0,0999…, поэтому сначала гасим ошибку плавающей точки
            rec = Math.min(0, Math.ceil(Math.round((season.budget / season.pp - 1) * 200 * 1e6) / 1e6) / 2);
            guard = 'budget';
          }
        } else if (o?.rmRuleId && cur && !manualPrice) {
          // поправку ставило правило, а условие больше не выполняется — вернуть прайс
          rec = 0;
        }
        const changes = rec !== null && Math.abs(rec - cur) > 0.004;
        rows.push({
          date: d, weekday: wd, lead, roomTypeId: t.id, roomTypeName: t.name, capacity, sold: s.sold, occupancy, pickup: s.pickup,
          currentPct: cur, currentByRule: !!o?.rmRuleId, recommendedPct: changes ? rec : null, ruleId: changes ? rule?.id ?? null : null,
          ruleName: changes ? rule?.name ?? null : null, guard: changes ? guard : null, manualPrice,
          basePrice: round2(base), currentPrice: round2(base * (1 + cur / 100)), newPrice: changes && rec !== null ? round2(base * (1 + rec / 100)) : null,
        });
      }
    }
    return { from, to, today, rows, rules: rules.length, settings: { revenueAutoApply: hotel.revenueAutoApply, revenueHorizon: hotel.revenueHorizon, revenueMaxPct: max } };
  }

  /** Применить поправки (рекомендации или вручную): rmPct на дату и тип номера; каналы получат новые цены */
  async apply(tenantId: string, hotelId: string, items: Array<{ roomTypeId: string; date: string; pct: number | string; ruleId?: string | null }>) {
    const hotel = await this.hotel(tenantId, hotelId);
    const list = (Array.isArray(items) ? items : []).slice(0, 5000);
    if (!list.length) throw bad('HOTEL_RM_EMPTY', 'Нечего применять');
    const max = num(hotel.revenueMaxPct) || 30;
    const types = await this.roomTypes.find({ where: { tenantId, hotelId: hotel.id }, select: ['id'] });
    const ruleIds = new Set((await this.rules.find({ where: { tenantId, hotelId: hotel.id }, select: ['id'] })).map((r) => r.id));
    const today = hotelToday(hotel);
    for (const it of list) {
      if (!types.some((t) => t.id === it.roomTypeId)) throw bad('HOTEL_RM_ROOM', 'Тип номера не из этого отеля');
      if (!ISO.test(it.date || '') || it.date < today) throw bad('HOTEL_RM_DATE', 'Поправку можно ставить с сегодняшнего дня');
      if (Math.abs(num(it.pct)) > max) throw bad('HOTEL_RM_ADJUST', `Поправка — в пределах ±${max} %`);
    }
    const existing = await this.overrides.find({ where: { tenantId, roomTypeId: In([...new Set(list.map((x) => x.roomTypeId))]), date: In([...new Set(list.map((x) => x.date))]) } });
    const now = new Date();
    const save: HotelRoomDateOverride[] = [];
    for (const it of list) {
      const row = existing.find((o) => o.roomTypeId === it.roomTypeId && o.date === it.date)
        || this.overrides.create({ tenantId, roomTypeId: it.roomTypeId, date: it.date, price: null, blocked: false, discountPct: '0', minNights: 1, closedToArrival: false, closedToDeparture: false, maxNights: null });
      const pct = round2(num(it.pct));
      row.rmPct = String(pct);
      row.rmRuleId = pct && it.ruleId && ruleIds.has(it.ruleId) ? it.ruleId : null;
      row.rmAppliedAt = pct ? now : null;
      save.push(row);
    }
    for (let i = 0; i < save.length; i += 500) await this.overrides.save(save.slice(i, i + 500));
    this.channels.markRatesDirty(tenantId, hotel.id);
    return { applied: save.length };
  }

  /** Ручная поправка на диапазон дат и типы номеров (0 — снять) */
  async setRange(tenantId: string, hotelId: string, dto: { roomTypeIds: string[]; from: string; to: string; pct: number | string }) {
    if (!ISO.test(dto?.from || '') || !ISO.test(dto?.to || '') || dto.to < dto.from) throw bad('HOTEL_RM_DATE', 'Неверный диапазон дат');
    if (daysBetween(dto.from, dto.to) > 365) throw bad('HOTEL_RM_DATE', 'Не больше года за раз');
    const ids = Array.isArray(dto.roomTypeIds) && dto.roomTypeIds.length ? dto.roomTypeIds : (await this.roomTypes.find({ where: { tenantId, hotelId }, select: ['id'] })).map((t) => t.id);
    const items: Array<{ roomTypeId: string; date: string; pct: number | string }> = [];
    for (const rt of ids) for (let d = dto.from; d <= dto.to; d = addDays(d, 1)) items.push({ roomTypeId: rt, date: d, pct: dto.pct });
    return this.apply(tenantId, hotelId, items);
  }

  /** Автоприменение раз в сутки: только то, что рекомендуют правила (ручные поправки не трогаем) */
  async autoApplyAll(): Promise<number> {
    const hotels = await this.hotels.find({ where: { revenueAutoApply: true } });
    let n = 0;
    for (const h of hotels) {
      try {
        const rec = await this.recommendations(h.tenantId, h.id);
        const items = rec.rows.filter((r) => r.recommendedPct !== null).map((r) => ({ roomTypeId: r.roomTypeId, date: r.date, pct: r.recommendedPct as number, ruleId: r.ruleId }));
        if (items.length) n += (await this.apply(h.tenantId, h.id, items)).applied;
      } catch (e) {
        this.log.warn(`revenue auto-apply ${h.id}: ${(e as Error).message}`);
      }
    }
    return n;
  }
}
