import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelRatePlan, HotelPrepaymentType, HotelRatePlanAdjust } from './hotel-rate-plan.entity';
import { HOTEL_BOARD_TYPES, HotelBoardType, HotelCancellationRule } from './hotel-contract.entity';
import { normalizeNumericInput } from './hotel-number.util';

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bad = (code: string, message: string) => new BadRequestException({ code, message });
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Цена номера за ночь по тарифу: корректировка цены номера + питание за платящих гостей (младенцы бесплатно) */
export function ratePlanNight(roomPrice: number, plan: Pick<HotelRatePlan, 'adjustType' | 'adjustValue' | 'boardSupplementAdult' | 'boardSupplementChild'> | null, guests: { adults: number; children: number }) {
  if (!plan || !(roomPrice > 0)) return { room: round2(roomPrice), board: 0, price: round2(roomPrice) };
  const adj = num(plan.adjustValue);
  const room = Math.max(0, plan.adjustType === 'amount' ? roomPrice + adj : roomPrice * (1 + adj / 100));
  const board = num(plan.boardSupplementAdult) * Math.max(0, guests.adults) + num(plan.boardSupplementChild) * Math.max(0, guests.children);
  return { room: round2(room), board: round2(board), price: round2(Math.max(0, room + board)) };
}

/** Предоплата по тарифу: сумма и срок (при бронировании или за N дней до заезда, но не раньше даты брони) */
export function ratePlanPrepayment(
  plan: Pick<HotelRatePlan, 'prepaymentType' | 'prepaymentValue' | 'prepaymentDueDays'> | null,
  q: { total: number; nights: number[]; checkIn: string; bookedOn: string },
): { amount: number; dueDate: string | null } {
  if (!plan || plan.prepaymentType === 'none' || !(q.total > 0)) return { amount: 0, dueDate: null };
  let amount = 0;
  if (plan.prepaymentType === 'full') amount = q.total;
  else if (plan.prepaymentType === 'percent') amount = (q.total * Math.min(100, Math.max(0, num(plan.prepaymentValue)))) / 100;
  else if (plan.prepaymentType === 'nights') amount = q.nights.slice(0, Math.max(1, Math.round(num(plan.prepaymentValue)))).reduce((s, v) => s + v, 0);
  const due = plan.prepaymentDueDays > 0 ? addDays(q.checkIn, -plan.prepaymentDueDays) : q.bookedOn;
  return { amount: round2(Math.min(q.total, amount)), dueDate: due < q.bookedOn ? q.bookedOn : due };
}

/** Штраф отмены по тарифу: невозвратный — вся сумма, иначе — по правилам тарифа */
export function ratePlanPenalty(
  plan: Pick<HotelRatePlan, 'refundable' | 'cancellationPolicy'>,
  daysBefore: number,
  total: number,
  nightly: number,
): { rule: HotelCancellationRule | null; fee: number; nonRefundable: boolean } {
  if (!plan.refundable) return { rule: null, fee: round2(total), nonRefundable: true };
  const hit = [...(plan.cancellationPolicy || [])]
    .filter((r) => daysBefore < Number(r.daysBefore))
    .sort((a, b) => Number(a.daysBefore) - Number(b.daysBefore))[0];
  if (!hit) return { rule: null, fee: 0, nonRefundable: false };
  const fee = hit.penaltyType === 'nights' ? nightly * Number(hit.value) : (total * Number(hit.value)) / 100;
  return { rule: hit, fee: round2(Math.min(total, Math.max(0, fee))), nonRefundable: false };
}

export type HotelRatePlanInput = Partial<Omit<HotelRatePlan, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;

/** Тарифы отеля: список, создание, правка, «по умолчанию», удаление (используемый — только выключить) */
@Injectable()
export class HotelRatePlansService {
  constructor(
    @InjectRepository(HotelRatePlan) private readonly plans: Repository<HotelRatePlan>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
  ) {}

  list(tenantId: string, hotelId: string) {
    return this.plans.find({ where: { tenantId, hotelId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async get(tenantId: string, id: string) {
    const p = await this.plans.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Тариф не найден');
    return p;
  }

  /** Тариф для брони: явно выбранный (того же отеля, действующий для типа номера) или тариф по умолчанию */
  async resolve(tenantId: string, hotelId: string, roomTypeId: string, ratePlanId?: string | null): Promise<HotelRatePlan | null> {
    if (ratePlanId) {
      const p = await this.plans.findOne({ where: { id: ratePlanId, tenantId, hotelId } });
      if (!p) throw bad('HOTEL_RATE_PLAN_NOT_FOUND', 'Тариф не найден в этом отеле');
      if (p.roomTypeIds?.length && !p.roomTypeIds.includes(roomTypeId)) throw bad('HOTEL_RATE_PLAN_ROOM', 'Тариф не действует для этого типа номера');
      return p;
    }
    const def = await this.plans.findOne({ where: { tenantId, hotelId, isDefault: true, active: true } });
    return def && (!def.roomTypeIds?.length || def.roomTypeIds.includes(roomTypeId)) ? def : null;
  }

  /** Тариф для продажи на сайте: тариф по умолчанию, если он продаётся на сайте, иначе первый такой; нет — без тарифа */
  async websitePlan(tenantId: string, hotelId: string, roomTypeId: string): Promise<HotelRatePlan | null> {
    const list = await this.plans.find({ where: { tenantId, hotelId, active: true, sellWebsite: true }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    const fits = list.filter((p) => !p.roomTypeIds?.length || p.roomTypeIds.includes(roomTypeId));
    return fits.find((p) => p.isDefault) || fits[0] || null;
  }

  private async clean(tenantId: string, hotelId: string, dto: HotelRatePlanInput, current?: HotelRatePlan): Promise<Partial<HotelRatePlan>> {
    const out: Partial<HotelRatePlan> = {};
    if (dto.code !== undefined) {
      const code = String(dto.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
      if (!code) throw bad('HOTEL_RATE_PLAN_CODE', 'Укажите код тарифа (латиница, цифры)');
      const dup = await this.plans
        .createQueryBuilder('p')
        .where('p.hotelId = :hotelId AND LOWER(p.code) = LOWER(:code)', { hotelId, code })
        .andWhere(current ? 'p.id <> :id' : '1=1', { id: current?.id })
        .getOne();
      if (dup) throw bad('HOTEL_RATE_PLAN_CODE_DUP', `Код ${code} уже есть в этом отеле`);
      out.code = code;
    }
    if (dto.name !== undefined) {
      const name = String(dto.name || '').trim().slice(0, 120);
      if (!name) throw bad('HOTEL_RATE_PLAN_NAME', 'Укажите название тарифа');
      out.name = name;
    }
    if (dto.description !== undefined) out.description = String(dto.description || '').trim().slice(0, 2000) || null;
    if (dto.boardType !== undefined) {
      if (!HOTEL_BOARD_TYPES.includes(dto.boardType as HotelBoardType)) throw bad('HOTEL_RATE_PLAN_BOARD', 'Неизвестный тип питания');
      out.boardType = dto.boardType as HotelBoardType;
    }
    const money = (v: unknown, field: string, min = -100000, max = 100000) => {
      const n = num(normalizeNumericInput(v as any));
      if (n < min || n > max) throw bad('HOTEL_RATE_PLAN_VALUE', `${field}: от ${min} до ${max}`);
      return String(round2(n));
    };
    if (dto.boardSupplementAdult !== undefined) out.boardSupplementAdult = money(dto.boardSupplementAdult, 'Питание за взрослого');
    if (dto.boardSupplementChild !== undefined) out.boardSupplementChild = money(dto.boardSupplementChild, 'Питание за ребёнка');
    if (dto.adjustType !== undefined) out.adjustType = (dto.adjustType === 'amount' ? 'amount' : 'percent') as HotelRatePlanAdjust;
    if (dto.adjustValue !== undefined) {
      const type = out.adjustType || current?.adjustType || 'percent';
      out.adjustValue = type === 'percent' ? money(dto.adjustValue, 'Корректировка, %', -90, 300) : money(dto.adjustValue, 'Корректировка');
    }
    if (dto.refundable !== undefined) out.refundable = !!dto.refundable;
    if (dto.cancellationPolicy !== undefined) {
      out.cancellationPolicy = (Array.isArray(dto.cancellationPolicy) ? dto.cancellationPolicy : [])
        .map((r: any): HotelCancellationRule => ({
          daysBefore: Math.min(365, Math.max(0, Math.round(num(r?.daysBefore)))),
          penaltyType: r?.penaltyType === 'nights' ? 'nights' : 'percent',
          value: r?.penaltyType === 'nights' ? Math.min(30, Math.max(0, Math.round(num(r?.value)))) : Math.min(100, Math.max(0, num(r?.value))),
        }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.daysBefore - a.daysBefore)
        .slice(0, 10);
    }
    if (dto.prepaymentType !== undefined) {
      if (!['none', 'percent', 'nights', 'full'].includes(String(dto.prepaymentType))) throw bad('HOTEL_RATE_PLAN_PREPAY', 'Неизвестный вид предоплаты');
      out.prepaymentType = dto.prepaymentType as HotelPrepaymentType;
    }
    if (dto.prepaymentValue !== undefined) {
      const type = out.prepaymentType || current?.prepaymentType || 'none';
      out.prepaymentValue = type === 'percent' ? money(dto.prepaymentValue, 'Предоплата, %', 0, 100) : type === 'nights' ? money(dto.prepaymentValue, 'Предоплата, ночей', 0, 30) : '0';
    }
    if (dto.prepaymentDueDays !== undefined) out.prepaymentDueDays = Math.min(365, Math.max(0, Math.round(num(dto.prepaymentDueDays))));
    if (dto.minNights !== undefined) out.minNights = Math.min(60, Math.max(1, Math.round(num(dto.minNights) || 1)));
    if (dto.roomTypeIds !== undefined) {
      const ids = [...new Set((Array.isArray(dto.roomTypeIds) ? dto.roomTypeIds : []).filter((x) => typeof x === 'string'))];
      if (ids.length) {
        const found = await this.roomTypes.find({ where: { tenantId, hotelId, id: In(ids) }, select: ['id'] });
        if (found.length !== ids.length) throw bad('HOTEL_RATE_PLAN_ROOM', 'Тип номера не из этого отеля');
      }
      out.roomTypeIds = ids;
    }
    for (const k of ['sellDirect', 'sellWebsite', 'active'] as const) if (dto[k] !== undefined) out[k] = !!dto[k];
    if (dto.sortOrder !== undefined) out.sortOrder = Math.round(num(dto.sortOrder));
    const prepType = out.prepaymentType ?? current?.prepaymentType;
    if (prepType && prepType !== 'none' && !(num(out.prepaymentValue ?? current?.prepaymentValue) > 0) && prepType !== 'full') {
      throw bad('HOTEL_RATE_PLAN_PREPAY', 'Укажите размер предоплаты');
    }
    return out;
  }

  async create(tenantId: string, dto: HotelRatePlanInput & { hotelId?: string }) {
    const hotel = await this.hotels.findOne({ where: { id: dto.hotelId || '', tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    if (!dto.code || !dto.name || !dto.boardType) throw bad('HOTEL_RATE_PLAN_REQUIRED', 'Нужны код, название и питание');
    const fields = await this.clean(tenantId, hotel.id, dto);
    const count = await this.plans.count({ where: { tenantId, hotelId: hotel.id } });
    const saved = await this.plans.save(this.plans.create({ tenantId, hotelId: hotel.id, sortOrder: count, ...fields, isDefault: count === 0 }));
    if (dto.isDefault && !saved.isDefault) return this.makeDefault(tenantId, saved.id);
    return saved;
  }

  async update(tenantId: string, id: string, dto: HotelRatePlanInput) {
    const p = await this.get(tenantId, id);
    const fields = await this.clean(tenantId, p.hotelId, dto, p);
    Object.assign(p, fields);
    if (p.isDefault && p.active === false) throw bad('HOTEL_RATE_PLAN_DEFAULT_OFF', 'Тариф по умолчанию нельзя выключить — сначала выберите другой');
    const saved = await this.plans.save(p);
    if (dto.isDefault === true && !saved.isDefault) return this.makeDefault(tenantId, saved.id);
    return saved;
  }

  async makeDefault(tenantId: string, id: string) {
    const p = await this.get(tenantId, id);
    if (!p.active) throw bad('HOTEL_RATE_PLAN_DEFAULT_OFF', 'Выключенный тариф не может быть по умолчанию');
    await this.plans.update({ tenantId, hotelId: p.hotelId, isDefault: true }, { isDefault: false });
    p.isDefault = true;
    return this.plans.save(p);
  }

  /** Удаление: тариф с бронями только выключается (история броней должна остаться понятной) */
  async remove(tenantId: string, id: string) {
    const p = await this.get(tenantId, id);
    const used = await this.reservations.count({ where: { tenantId, ratePlanId: p.id } as any });
    if (used) throw bad('HOTEL_RATE_PLAN_IN_USE', `По тарифу есть брони (${used}) — выключите его вместо удаления`);
    if (p.isDefault) {
      const next = await this.plans.findOne({ where: { tenantId, hotelId: p.hotelId, active: true }, order: { sortOrder: 'ASC' } as any });
      await this.plans.remove(p);
      const other = next && next.id !== p.id ? next : await this.plans.findOne({ where: { tenantId, hotelId: p.hotelId, active: true } });
      if (other) await this.makeDefault(tenantId, other.id);
      return { ok: true };
    }
    await this.plans.remove(p);
    return { ok: true };
  }
}
