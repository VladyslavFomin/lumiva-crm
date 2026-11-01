import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelRatePlan } from './hotel-rate-plan.entity';
import { HOTEL_PROMOTION_TYPES, HotelPromotion, HotelPromotionType } from './hotel-promotion.entity';
import { normalizeNumericInput } from './hotel-number.util';
import { componentDefault } from '../tenants/plan-entitlements';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(normalizeNumericInput(v as any));
  return Number.isFinite(n) ? n : 0;
};
const bad = (code: string, message: string) => new BadRequestException({ code, message });
const date = (v: unknown, field: string): string | null => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).slice(0, 10);
  const d = new Date(`${s}T00:00:00Z`);
  // V8 принимает 2027-02-31 (сдвигает на март) — сверяем обратным преобразованием
  if (!ISO.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw bad('HOTEL_PROMO_DATE', `${field}: неверная дата`);
  return s;
};
const int = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === '') return null;
  return Math.min(max, Math.max(min, Math.round(num(v))));
};

export type HotelPromotionInput = Partial<Omit<HotelPromotion, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;

/** Акции отеля: раннее бронирование, горящие, спецпредложения, длительное проживание — CRUD с проверкой условий */
@Injectable()
export class HotelPromotionsService {
  constructor(
    @InjectRepository(HotelPromotion) private readonly promos: Repository<HotelPromotion>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelMarketGroup) private readonly groups: Repository<HotelMarketGroup>,
    @InjectRepository(HotelRatePlan) private readonly plans: Repository<HotelRatePlan>,
  ) {}

  list(tenantId: string, hotelId: string) {
    return this.promos.find({ where: { tenantId, hotelId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  /** Действующие акции отеля — для расчёта цены; компонент «Акции» выключен в pl1 — акций нет */
  async active(tenantId: string, hotelId: string) {
    const [t] = await this.promos.manager.query(`SELECT "enabledComponents" FROM tenants WHERE id = $1`, [tenantId]);
    if (!componentDefault('hotels_promotions', t?.enabledComponents || {})) return [];
    return this.promos.find({ where: { tenantId, hotelId, active: true }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async get(tenantId: string, id: string) {
    const p = await this.promos.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Акция не найдена');
    return p;
  }

  private async ids(tenantId: string, hotelId: string, raw: unknown, kind: 'room' | 'group' | 'plan'): Promise<string[]> {
    const ids = [...new Set((Array.isArray(raw) ? raw : []).filter((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))] as string[];
    if (!ids.length) return [];
    const repo: Repository<{ id: string }> = (kind === 'room' ? this.roomTypes : kind === 'group' ? this.groups : this.plans) as any;
    const found = await repo.find({ where: { tenantId, hotelId, id: In(ids) } as any, select: ['id'] as any });
    if (found.length !== ids.length) {
      throw bad('HOTEL_PROMO_SCOPE', kind === 'room' ? 'Тип номера не из этого отеля' : kind === 'group' ? 'Группа рынков не из этого отеля' : 'Тариф не из этого отеля');
    }
    return ids;
  }

  /** Нормализация и проверка: итоговая акция (с учётом текущей) должна быть осмысленной */
  private async clean(tenantId: string, hotelId: string, dto: HotelPromotionInput, current?: HotelPromotion): Promise<Partial<HotelPromotion>> {
    const out: Partial<HotelPromotion> = {};
    if (dto.type !== undefined) {
      if (!HOTEL_PROMOTION_TYPES.includes(dto.type as HotelPromotionType)) throw bad('HOTEL_PROMO_TYPE', 'Неизвестный вид акции');
      out.type = dto.type as HotelPromotionType;
    }
    if (dto.name !== undefined) {
      const name = String(dto.name || '').trim().slice(0, 120);
      if (!name) throw bad('HOTEL_PROMO_NAME', 'Укажите название акции');
      out.name = name;
    }
    if (dto.description !== undefined) out.description = String(dto.description || '').trim().slice(0, 2000) || null;
    if (dto.discountPct !== undefined) {
      const v = num(dto.discountPct);
      if (v < 0 || v > 90) throw bad('HOTEL_PROMO_DISCOUNT', 'Скидка — от 0 до 90 %');
      out.discountPct = String(round2(v));
    }
    if (dto.freeNights !== undefined) out.freeNights = int(dto.freeNights, 0, 14) ?? 0;
    if (dto.bookFrom !== undefined) out.bookFrom = date(dto.bookFrom, 'Бронь с');
    if (dto.bookTo !== undefined) out.bookTo = date(dto.bookTo, 'Бронь по');
    if (dto.stayFrom !== undefined) out.stayFrom = date(dto.stayFrom, 'Проживание с');
    if (dto.stayTo !== undefined) out.stayTo = date(dto.stayTo, 'Проживание по');
    if (dto.stayRule !== undefined) out.stayRule = dto.stayRule === 'arrival' ? 'arrival' : 'nights';
    if (dto.minNights !== undefined) out.minNights = int(dto.minNights, 1, 60) ?? 1;
    if (dto.maxNights !== undefined) out.maxNights = int(dto.maxNights, 1, 365);
    if (dto.minDaysBefore !== undefined) out.minDaysBefore = int(dto.minDaysBefore, 0, 730);
    if (dto.maxDaysBefore !== undefined) out.maxDaysBefore = int(dto.maxDaysBefore, 0, 730);
    if (dto.combinable !== undefined) out.combinable = !!dto.combinable;
    if (dto.prepaymentPct !== undefined) {
      const v = num(dto.prepaymentPct);
      if (v < 0 || v > 100) throw bad('HOTEL_PROMO_PREPAY', 'Предоплата — от 0 до 100 %');
      out.prepaymentPct = String(round2(v));
    }
    if (dto.prepaymentDueDate !== undefined) out.prepaymentDueDate = date(dto.prepaymentDueDate, 'Срок предоплаты');
    if (dto.prepaymentDueDays !== undefined) out.prepaymentDueDays = int(dto.prepaymentDueDays, 0, 365);
    if (dto.marketGroupIds !== undefined) out.marketGroupIds = await this.ids(tenantId, hotelId, dto.marketGroupIds, 'group');
    if (dto.roomTypeIds !== undefined) out.roomTypeIds = await this.ids(tenantId, hotelId, dto.roomTypeIds, 'room');
    if (dto.ratePlanIds !== undefined) out.ratePlanIds = await this.ids(tenantId, hotelId, dto.ratePlanIds, 'plan');
    for (const k of ['sellDirect', 'sellWebsite', 'active'] as const) if (dto[k] !== undefined) out[k] = !!dto[k];
    if (dto.sortOrder !== undefined) out.sortOrder = Math.round(num(dto.sortOrder));

    // проверка акции целиком
    const r = { ...(current || {}), ...out } as HotelPromotion;
    const pct = num(r.discountPct);
    const free = r.freeNights || 0;
    if (!(pct > 0) && !(free > 0)) throw bad('HOTEL_PROMO_BENEFIT', 'Укажите скидку % или бесплатные ночи');
    if (pct > 0 && free > 0) throw bad('HOTEL_PROMO_BENEFIT', 'Либо скидка %, либо бесплатные ночи — не оба сразу');
    if (free > 0 && (r.minNights || 1) <= free) throw bad('HOTEL_PROMO_FREE_NIGHTS', 'Бесплатных ночей должно быть меньше, чем ночей в условии (7 = 6: 7 ночей, 1 бесплатно)');
    if (r.bookFrom && r.bookTo && r.bookTo < r.bookFrom) throw bad('HOTEL_PROMO_RANGE', 'Окно бронирования: дата «по» раньше даты «с»');
    if (r.stayFrom && r.stayTo && r.stayTo < r.stayFrom) throw bad('HOTEL_PROMO_RANGE', 'Период проживания: дата «по» раньше даты «с»');
    if (r.maxNights && r.maxNights < (r.minNights || 1)) throw bad('HOTEL_PROMO_RANGE', 'Максимум ночей меньше минимума');
    if (r.minDaysBefore !== null && r.minDaysBefore !== undefined && r.maxDaysBefore !== null && r.maxDaysBefore !== undefined && r.maxDaysBefore < r.minDaysBefore) {
      throw bad('HOTEL_PROMO_RANGE', 'Дней до заезда: максимум меньше минимума');
    }
    if (r.type === 'early_booking' && !r.bookTo && !(r.minDaysBefore && r.minDaysBefore > 0)) {
      throw bad('HOTEL_PROMO_EB', 'Раннее бронирование: укажите «бронь до» или «бронь не позже чем за N дней»');
    }
    if (r.type === 'last_minute' && (r.maxDaysBefore === null || r.maxDaysBefore === undefined)) {
      throw bad('HOTEL_PROMO_LM', 'Горящее: укажите «бронь не раньше чем за N дней до заезда»');
    }
    if (r.type === 'long_stay' && (r.minNights || 1) < 2) throw bad('HOTEL_PROMO_LS', 'Длительное проживание: минимум ночей — от 2');
    if (num(r.prepaymentPct) > 0 && !r.prepaymentDueDate && (r.prepaymentDueDays === null || r.prepaymentDueDays === undefined)) {
      throw bad('HOTEL_PROMO_PREPAY', 'Укажите срок предоплаты: дату или число дней после брони');
    }
    if (!(num(r.prepaymentPct) > 0)) {
      out.prepaymentDueDate = null;
      out.prepaymentDueDays = null;
    }
    if (!r.sellDirect && !r.sellWebsite) throw bad('HOTEL_PROMO_CHANNEL', 'Отметьте, где действует акция: у стойки или на сайте');
    return out;
  }

  async create(tenantId: string, dto: HotelPromotionInput & { hotelId?: string }) {
    const hotel = await this.hotels.findOne({ where: { id: dto.hotelId || '', tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    if (!dto.type || !dto.name) throw bad('HOTEL_PROMO_REQUIRED', 'Нужны вид и название акции');
    const base = this.promos.create({ tenantId, hotelId: hotel.id, discountPct: '0', freeNights: 0, minNights: 1, stayRule: 'nights', prepaymentPct: '0', sellDirect: true, sellWebsite: true, active: true, combinable: false, marketGroupIds: [], roomTypeIds: [], ratePlanIds: [] });
    const fields = await this.clean(tenantId, hotel.id, dto, base);
    const count = await this.promos.count({ where: { tenantId, hotelId: hotel.id } });
    return this.promos.save(this.promos.create({ ...base, sortOrder: count, ...fields, origin: dto.origin === 'import' ? 'import' : 'manual' }));
  }

  async update(tenantId: string, id: string, dto: HotelPromotionInput) {
    const p = await this.get(tenantId, id);
    Object.assign(p, await this.clean(tenantId, p.hotelId, dto, p));
    return this.promos.save(p);
  }

  /** Удаление безопасно: бронь хранит снимок применённой акции (имя, %, сумму, условия предоплаты) */
  async remove(tenantId: string, id: string) {
    const p = await this.get(tenantId, id);
    await this.promos.remove(p);
    return { ok: true };
  }
}
