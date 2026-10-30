import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  HOTEL_BOARD_TYPES,
  HotelContract,
  type HotelCancellationRule,
  type HotelChildPolicyRule,
  type HotelContractPromotion,
  type HotelContractRoom,
  type HotelContractStatus,
} from './hotel-contract.entity';
import { HotelRoomBlock, type HotelRoomBlockStatus } from './hotel-room-block.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelAgency } from './hotel-agency.entity';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { normalizeCountry, normalizeCountryList } from '../common/countries';
import { normalizeChildPolicy } from './hotel-occupancy.util';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CONTRACT_STATUSES: HotelContractStatus[] = ['draft', 'active', 'expired', 'cancelled'];
const BLOCK_STATUSES: HotelRoomBlockStatus[] = ['tentative', 'definite', 'released', 'cancelled'];

export const todayStr = () => new Date().toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
/** Ночи [from, to) */
export function nightsOf(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d < to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const date = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) ? v : null);
const active = (r: HotelReservation) => r.status !== 'cancelled';
const covers = (r: { checkIn: string; checkOut: string }, d: string) => r.checkIn <= d && r.checkOut > d;

/** Квота строки контракта на ночь: переопределение по дате → общая; стоп-дата → 0; вне периода → 0. */
export function allotmentOn(c: HotelContract, line: HotelContractRoom, d: string): number {
  if (d < c.validFrom || d > c.validTo) return 0;
  if ((line.stopDates || []).includes(d)) return 0;
  const o = line.dateOverrides?.[d];
  return typeof o === 'number' ? o : line.allotment || 0;
}
/** Квота возвращена в свободную продажу: release-дата (заезд − N дней) уже прошла. */
export function isReleased(c: HotelContract, line: HotelContractRoom, d: string, today = todayStr()): boolean {
  const days = line.releaseDays ?? c.releaseDays ?? 0;
  return today > addDays(d, -days);
}
/** Скидка по акциям контракта для брони: суммируемые складываются, из несуммируемых берётся лучшая. */
export function promotionDiscount(c: HotelContract | null, q: { checkIn: string; checkOut: string; bookedOn: string }) {
  if (!c?.promotions?.length) return { pct: 0, applied: [] as HotelContractPromotion[] };
  const nights = nightsOf(q.checkIn, q.checkOut).length;
  const fits = c.promotions.filter(
    (p) =>
      nights >= (p.minNights || 1) &&
      (!p.stayFrom || q.checkIn >= p.stayFrom) &&
      (!p.stayTo || q.checkIn <= p.stayTo) &&
      (p.type !== 'early_booking' || (!!p.bookBy && q.bookedOn <= p.bookBy)),
  );
  const comb = fits.filter((p) => p.combinable);
  const best = fits.filter((p) => !p.combinable).sort((a, b) => b.discountPct - a.discountPct)[0];
  const applied = [...comb, ...(best ? [best] : [])];
  return { pct: Math.min(90, applied.reduce((s, p) => s + p.discountPct, 0)), applied };
}

/** Блок держит номера: подтверждён и отсечка ещё не прошла. */
export function blockHolds(b: HotelRoomBlock, today = todayStr()): boolean {
  return b.status === 'definite' && today <= b.cutoffDate;
}

export type HotelContractInput = Partial<Omit<HotelContract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;
export type HotelRoomBlockInput = Partial<Omit<HotelRoomBlock, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>;

@Injectable()
export class HotelContractsService {
  constructor(
    @InjectRepository(HotelContract) private readonly contracts: Repository<HotelContract>,
    @InjectRepository(HotelRoomBlock) private readonly blocks: Repository<HotelRoomBlock>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelAgency) private readonly partners: Repository<HotelAgency>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit) private readonly roomUnits: Repository<HotelRoomUnit>,
  ) {}

  /* ───────────── контракты ───────────── */

  list(tenantId: string, f: { agencyId?: string; hotelId?: string }) {
    const where: any = { tenantId };
    if (f.agencyId) where.agencyId = f.agencyId;
    if (f.hotelId) where.hotelId = f.hotelId;
    return this.contracts.find({ where, order: { validFrom: 'DESC', createdAt: 'DESC' } });
  }

  async get(tenantId: string, id: string) {
    const c = await this.contracts.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Контракт не найден');
    return c;
  }

  private async cleanContract(tenantId: string, dto: HotelContractInput, current?: HotelContract): Promise<Partial<HotelContract>> {
    const out: Partial<HotelContract> = {};
    if (dto.agencyId !== undefined) {
      const p = await this.partners.findOne({ where: { id: String(dto.agencyId), tenantId } });
      if (!p) throw new BadRequestException('Партнёр не найден');
      out.agencyId = p.id;
    }
    if (dto.hotelId !== undefined) {
      const h = await this.hotels.findOne({ where: { id: String(dto.hotelId), tenantId } });
      if (!h) throw new BadRequestException('Отель не найден');
      out.hotelId = h.id;
    }
    if (dto.name !== undefined) {
      const name = str(dto.name, 160);
      if (!name) throw new BadRequestException('Название контракта обязательно');
      out.name = name;
    }
    if (dto.code !== undefined) out.code = str(dto.code, 48);
    if (dto.status !== undefined) out.status = CONTRACT_STATUSES.includes(dto.status) ? dto.status : 'draft';
    for (const k of ['validFrom', 'validTo'] as const) {
      if (dto[k] !== undefined) {
        const v = date(dto[k]);
        if (!v) throw new BadRequestException('Укажите даты контракта');
        out[k] = v;
      }
    }
    for (const k of ['bookingFrom', 'bookingTo'] as const) if (dto[k] !== undefined) out[k] = date(dto[k]);
    if (dto.pricing !== undefined) out.pricing = dto.pricing === 'net' ? 'net' : 'commission';
    if (dto.commissionPct !== undefined) out.commissionPct = String(num(dto.commissionPct, 0, 100, 0));
    if (dto.boardType !== undefined) out.boardType = HOTEL_BOARD_TYPES.includes(dto.boardType) ? dto.boardType : 'BB';
    if (dto.currency !== undefined) out.currency = str(dto.currency, 3)?.toUpperCase() ?? null;
    if (dto.releaseDays !== undefined) out.releaseDays = Math.round(num(dto.releaseDays, 0, 365, 7));
    if (dto.minStay !== undefined) out.minStay = Math.round(num(dto.minStay, 1, 60, 1));
    if (dto.guaranteed !== undefined) out.guaranteed = !!dto.guaranteed;
    if (dto.allowOverAllotment !== undefined) out.allowOverAllotment = !!dto.allowOverAllotment;
    if (dto.marketCountries !== undefined) out.marketCountries = normalizeCountryList(dto.marketCountries);
    if (dto.notes !== undefined) out.notes = str(dto.notes, 5000);

    const hotelId = out.hotelId ?? current?.hotelId;
    if (dto.rooms !== undefined) {
      const valid = new Set((await this.roomTypes.find({ where: { tenantId, hotelId } })).map((r) => r.id));
      const seen = new Set<string>();
      out.rooms = (Array.isArray(dto.rooms) ? dto.rooms : [])
        .filter((l) => l && valid.has(String(l.roomTypeId)) && !seen.has(String(l.roomTypeId)) && seen.add(String(l.roomTypeId)))
        .map((l) => ({
          roomTypeId: String(l.roomTypeId),
          allotment: Math.round(num(l.allotment, 0, 10000, 0)),
          releaseDays: l.releaseDays === null || l.releaseDays === undefined || (l.releaseDays as unknown) === '' ? null : Math.round(num(l.releaseDays, 0, 365, 0)),
          rate: l.rate === null || l.rate === undefined || (l.rate as unknown) === '' ? null : String(num(l.rate, 0, 1e9, 0)),
          dateOverrides: Object.fromEntries(
            Object.entries(l.dateOverrides || {})
              .filter(([d, v]) => DATE_RE.test(d) && Number.isFinite(Number(v)))
              .map(([d, v]) => [d, Math.round(num(v, 0, 10000, 0))]),
          ),
          stopDates: [...new Set((Array.isArray(l.stopDates) ? l.stopDates : []).filter((d) => DATE_RE.test(String(d))))],
        }));
    }
    if (dto.cancellationPolicy !== undefined) {
      out.cancellationPolicy = (Array.isArray(dto.cancellationPolicy) ? dto.cancellationPolicy : [])
        .map((r): HotelCancellationRule => ({
          daysBefore: Math.round(num(r?.daysBefore, 0, 365, 0)),
          penaltyType: r?.penaltyType === 'nights' ? 'nights' : 'percent',
          value: num(r?.value, 0, r?.penaltyType === 'nights' ? 60 : 100, 0),
        }))
        .sort((a, b) => b.daysBefore - a.daysBefore)
        .slice(0, 10);
    }
    if (dto.childPolicy !== undefined) out.childPolicy = normalizeChildPolicy(dto.childPolicy);
    if (dto.promotions !== undefined) {
      out.promotions = (Array.isArray(dto.promotions) ? dto.promotions : [])
        .map((p, i): HotelContractPromotion => {
          const type = p?.type === 'early_booking' || p?.type === 'long_stay' ? p.type : 'spo';
          return {
            id: str(p?.id, 40) || `p${Date.now().toString(36)}${i}`,
            type,
            name: str(p?.name, 120) || type,
            discountPct: num(p?.discountPct, 0, 90, 0),
            bookBy: date(p?.bookBy),
            stayFrom: date(p?.stayFrom),
            stayTo: date(p?.stayTo),
            minNights: Math.round(num(p?.minNights, 1, 60, type === 'long_stay' ? 7 : 1)),
            combinable: !!p?.combinable,
          };
        })
        .filter((p) => p.discountPct > 0 && (p.type !== 'early_booking' || p.bookBy))
        .slice(0, 20);
    }
    const from = out.validFrom ?? current?.validFrom;
    const to = out.validTo ?? current?.validTo;
    if (from && to && to < from) throw new BadRequestException('Дата окончания контракта раньше даты начала');
    return out;
  }

  async create(tenantId: string, dto: HotelContractInput) {
    if (!dto?.agencyId || !dto?.hotelId) throw new BadRequestException('Выберите партнёра и отель');
    if (!dto.validFrom || !dto.validTo) throw new BadRequestException('Укажите даты контракта');
    const clean = await this.cleanContract(tenantId, { rooms: [], ...dto, name: dto.name || 'Контракт' });
    if (dto.commissionPct === undefined) {
      const p = await this.partners.findOne({ where: { id: clean.agencyId!, tenantId } });
      clean.commissionPct = p?.commissionPct ?? '0';
    }
    return this.contracts.save(this.contracts.create({ ...clean, tenantId }));
  }

  async update(tenantId: string, id: string, dto: HotelContractInput) {
    const c = await this.get(tenantId, id);
    Object.assign(c, await this.cleanContract(tenantId, dto, c));
    return this.contracts.save(c);
  }

  async duplicate(tenantId: string, id: string) {
    const c = await this.get(tenantId, id);
    const { id: _id, createdAt, updatedAt, ...rest } = c;
    return this.contracts.save(this.contracts.create({ ...rest, name: `${c.name} (копия)`, status: 'draft' }));
  }

  async remove(tenantId: string, id: string) {
    const c = await this.get(tenantId, id);
    const used = await this.reservations.count({ where: { tenantId, contractId: id } });
    if (used) {
      c.status = 'cancelled';
      await this.contracts.save(c);
      return { ok: true, cancelled: true };
    }
    await this.contracts.remove(c);
    return { ok: true, cancelled: false };
  }

  /** Действующий контракт партнёра для брони: отель, ночь заезда в периоде, окно продаж, страна рынка. */
  async resolveForReservation(
    tenantId: string,
    q: { agencyId: string; hotelId: string; checkIn: string; guestCountry?: string | null },
  ): Promise<HotelContract | null> {
    const today = todayStr();
    const list = await this.contracts.find({ where: { tenantId, agencyId: q.agencyId, hotelId: q.hotelId, status: 'active' } });
    const fits = list.filter(
      (c) =>
        c.validFrom <= q.checkIn &&
        c.validTo >= q.checkIn &&
        (!c.bookingFrom || c.bookingFrom <= today) &&
        (!c.bookingTo || c.bookingTo >= today),
    );
    const byCountry = q.guestCountry ? fits.find((c) => c.marketCountries?.includes(q.guestCountry!)) : null;
    return byCountry || fits.find((c) => !c.marketCountries?.length) || fits[0] || null;
  }

  /** Использование квот контракта по ночам и типам номеров. */
  async usage(tenantId: string, id: string, from?: string, to?: string) {
    const c = await this.get(tenantId, id);
    const start = date(from) || c.validFrom;
    const end = date(to) || addDays(c.validTo, 1);
    const nights = nightsOf(start, end).filter((d) => d >= c.validFrom && d <= c.validTo);
    const res = (
      await this.reservations
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.contractId = :id', { tenantId, id })
        .andWhere('r.checkIn < :end AND r.checkOut > :start', { start, end })
        .getMany()
    ).filter(active);
    const today = todayStr();
    const rows = c.rooms.map((line) => {
      const days = nights.map((d) => {
        const allotment = allotmentOn(c, line, d);
        const sold = res.filter((r) => r.roomTypeId === line.roomTypeId && covers(r, d)).length;
        return { date: d, allotment, sold, left: Math.max(0, allotment - sold), released: isReleased(c, line, d, today), stop: (line.stopDates || []).includes(d) };
      });
      const totalAllot = days.reduce((s, x) => s + x.allotment, 0);
      const totalSold = days.reduce((s, x) => s + Math.min(x.sold, x.allotment), 0);
      return { roomTypeId: line.roomTypeId, days, totalAllotment: totalAllot, totalSold, utilizationPct: totalAllot ? Math.round((totalSold / totalAllot) * 1000) / 10 : 0 };
    });
    return { contract: c, from: start, to: end, rows };
  }

  /* ───────────── блоки номеров ───────────── */

  listBlocks(tenantId: string, f: { hotelId?: string; agencyId?: string }) {
    const where: any = { tenantId };
    if (f.hotelId) where.hotelId = f.hotelId;
    if (f.agencyId) where.agencyId = f.agencyId;
    return this.blocks.find({ where, order: { dateFrom: 'ASC' } });
  }

  async getBlock(tenantId: string, id: string) {
    const b = await this.blocks.findOne({ where: { id, tenantId } });
    if (!b) throw new NotFoundException('Блок не найден');
    return b;
  }

  /** Блоки + выкуп: на каждую ночь — сколько номеров блока уже заняты бронями. */
  async listBlocksWithPickup(tenantId: string, f: { hotelId?: string; agencyId?: string }) {
    const list = await this.listBlocks(tenantId, f);
    if (!list.length) return [];
    const res = (await this.reservations.find({ where: { tenantId, blockId: In(list.map((b) => b.id)) } })).filter(active);
    return list.map((b) => {
      const nights = nightsOf(b.dateFrom, b.dateTo);
      const mine = res.filter((r) => r.blockId === b.id);
      const roomNights = nights.length * b.rooms;
      const picked = nights.reduce((s, d) => s + Math.min(b.rooms, mine.filter((r) => covers(r, d)).length), 0);
      return { ...b, pickup: { bookings: mine.length, roomNights, pickedRoomNights: picked, pct: roomNights ? Math.round((picked / roomNights) * 1000) / 10 : 0 }, holds: blockHolds(b) };
    });
  }

  private async cleanBlock(tenantId: string, dto: HotelRoomBlockInput, current?: HotelRoomBlock): Promise<Partial<HotelRoomBlock>> {
    const out: Partial<HotelRoomBlock> = {};
    const hotelId = dto.hotelId !== undefined ? String(dto.hotelId) : current?.hotelId;
    if (dto.hotelId !== undefined) {
      if (!(await this.hotels.findOne({ where: { id: hotelId!, tenantId } }))) throw new BadRequestException('Отель не найден');
      out.hotelId = hotelId!;
    }
    if (dto.roomTypeId !== undefined) {
      const rt = await this.roomTypes.findOne({ where: { id: String(dto.roomTypeId), tenantId } });
      if (!rt || rt.hotelId !== hotelId) throw new BadRequestException('Тип номера не найден в этом отеле');
      out.roomTypeId = rt.id;
    }
    if (dto.agencyId !== undefined) {
      if (dto.agencyId && !(await this.partners.findOne({ where: { id: String(dto.agencyId), tenantId } }))) throw new BadRequestException('Партнёр не найден');
      out.agencyId = dto.agencyId ? String(dto.agencyId) : null;
    }
    if (dto.contractId !== undefined) out.contractId = dto.contractId ? String(dto.contractId) : null;
    if (dto.name !== undefined) {
      const name = str(dto.name, 160);
      if (!name) throw new BadRequestException('Название блока обязательно');
      out.name = name;
    }
    if (dto.status !== undefined) out.status = BLOCK_STATUSES.includes(dto.status) ? dto.status : 'tentative';
    for (const k of ['dateFrom', 'dateTo', 'cutoffDate'] as const) {
      if (dto[k] !== undefined) {
        const v = date(dto[k]);
        if (!v) throw new BadRequestException('Укажите даты блока и дату отсечки');
        out[k] = v;
      }
    }
    if (dto.rooms !== undefined) out.rooms = Math.round(num(dto.rooms, 1, 10000, 1));
    if (dto.ratePerNight !== undefined) out.ratePerNight = dto.ratePerNight === null || (dto.ratePerNight as unknown) === '' ? null : String(num(dto.ratePerNight, 0, 1e9, 0));
    if (dto.boardType !== undefined) out.boardType = HOTEL_BOARD_TYPES.includes(dto.boardType as any) ? dto.boardType : null;
    if (dto.countryCode !== undefined) out.countryCode = normalizeCountry(dto.countryCode);
    if (dto.contactName !== undefined) out.contactName = str(dto.contactName, 160);
    if (dto.notes !== undefined) out.notes = str(dto.notes, 5000);
    const from = out.dateFrom ?? current?.dateFrom;
    const to = out.dateTo ?? current?.dateTo;
    if (from && to && to <= from) throw new BadRequestException('Дата выезда должна быть позже даты заезда');
    return out;
  }

  async createBlock(tenantId: string, dto: HotelRoomBlockInput) {
    if (!dto?.hotelId || !dto?.roomTypeId || !dto?.dateFrom || !dto?.dateTo || !dto?.rooms) {
      throw new BadRequestException('Укажите отель, тип номера, даты и число номеров');
    }
    const clean = await this.cleanBlock(tenantId, { cutoffDate: addDays(String(dto.dateFrom), -14), name: 'Группа', ...dto });
    return this.blocks.save(this.blocks.create({ ...clean, tenantId }));
  }

  async updateBlock(tenantId: string, id: string, dto: HotelRoomBlockInput) {
    const b = await this.getBlock(tenantId, id);
    Object.assign(b, await this.cleanBlock(tenantId, dto, b));
    return this.blocks.save(b);
  }

  async removeBlock(tenantId: string, id: string) {
    const b = await this.getBlock(tenantId, id);
    const used = await this.reservations.count({ where: { tenantId, blockId: id } });
    if (used) {
      b.status = 'cancelled';
      await this.blocks.save(b);
      return { ok: true, cancelled: true };
    }
    await this.blocks.remove(b);
    return { ok: true, cancelled: false };
  }

  /* ───────────── шахматка квот ───────────── */

  /** По отелю и периоду: на каждый тип номера и ночь — ёмкость, продано, держат блоки и гарантированные
   * квоты, свободно; плюс строки по каждому контракту и блоку. */
  async inventory(tenantId: string, hotelId: string, from: string, to: string) {
    const start = date(from) || todayStr();
    const end = date(to) || addDays(start, 30);
    if (nightsOf(start, end).length > 120) throw new BadRequestException('Период не больше 120 ночей');
    const nights = nightsOf(start, end);
    const [types, units, contracts, blocks, resAll] = await Promise.all([
      this.roomTypes.find({ where: { tenantId, hotelId } }),
      this.roomUnits.find({ where: { tenantId, hotelId } }),
      this.contracts.find({ where: { tenantId, hotelId, status: 'active' } }),
      this.blocks.find({ where: { tenantId, hotelId } }),
      this.reservations
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId })
        // no-show номер не занимает (как в шахматке и проверке доступности)
        .andWhere("r.status NOT IN ('cancelled','no_show')")
        .andWhere('r.checkIn < :end AND r.checkOut > :start', { start, end })
        .getMany(),
    ]);
    const partnerIds = [...new Set([...contracts.map((c) => c.agencyId), ...blocks.map((b) => b.agencyId).filter(Boolean)])] as string[];
    const partners = partnerIds.length ? await this.partners.find({ where: { tenantId, id: In(partnerIds) } }) : [];
    const pName = new Map(partners.map((p) => [p.id, p.name]));
    const today = todayStr();
    const activeUnits = (rtId: string) => units.filter((u) => u.roomTypeId === rtId && u.active).length;

    const rows = types.map((rt) => {
      const capacity = activeUnits(rt.id) || rt.quantity || 0;
      const res = resAll.filter((r) => r.roomTypeId === rt.id);
      const contractRows = contracts
        .map((c) => ({ c, line: c.rooms.find((l) => l.roomTypeId === rt.id) }))
        .filter((x) => x.line)
        .map(({ c, line }) => ({
          contractId: c.id,
          name: c.name,
          partner: pName.get(c.agencyId) || '—',
          guaranteed: c.guaranteed,
          days: nights.map((d) => {
            const allotment = allotmentOn(c, line!, d);
            const sold = res.filter((r) => r.contractId === c.id && covers(r, d)).length;
            const released = isReleased(c, line!, d, today);
            return { date: d, allotment, sold, released, stop: (line!.stopDates || []).includes(d) };
          }),
        }));
      const blockRows = blocks
        .filter((b) => b.roomTypeId === rt.id && b.dateFrom < end && b.dateTo > start)
        .map((b) => ({
          blockId: b.id,
          name: b.name,
          status: b.status,
          partner: b.agencyId ? pName.get(b.agencyId) || '—' : null,
          cutoffDate: b.cutoffDate,
          days: nights.map((d) => ({
            date: d,
            rooms: d >= b.dateFrom && d < b.dateTo ? b.rooms : 0,
            picked: res.filter((r) => r.blockId === b.id && covers(r, d)).length,
          })),
        }));
      const days = nights.map((d, i) => {
        const sold = res.filter((r) => covers(r, d)).length;
        const heldBlocks = blocks
          .filter((b) => b.roomTypeId === rt.id && blockHolds(b, today) && d >= b.dateFrom && d < b.dateTo)
          .reduce((s, b) => s + Math.max(0, b.rooms - res.filter((r) => r.blockId === b.id && covers(r, d)).length), 0);
        const heldAllot = contractRows
          .filter((x) => x.guaranteed)
          .reduce((s, x) => {
            const day = x.days[i];
            return s + (day.released ? 0 : Math.max(0, day.allotment - day.sold));
          }, 0);
        const allotted = contractRows.reduce((s, x) => s + (x.days[i].released ? 0 : x.days[i].allotment), 0);
        return { date: d, capacity, sold, heldBlocks, heldAllot, allotted, free: capacity - sold - heldBlocks - heldAllot };
      });
      return { roomTypeId: rt.id, name: rt.name, capacity, days, contracts: contractRows, blocks: blockRows };
    });
    return { hotelId, from: start, to: end, nights, rows };
  }
}
