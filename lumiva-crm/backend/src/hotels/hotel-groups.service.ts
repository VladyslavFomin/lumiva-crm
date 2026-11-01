import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelAgency } from './hotel-agency.entity';
import { HotelReservation, HotelReservationGuest } from './hotel-reservation.entity';
import { HotelGroup, HotelGroupBilling, HotelGroupStatus } from './hotel-group.entity';
import { HotelReservationsService } from './hotel-reservations.service';
import { HOTEL_CANCEL_REASONS } from './hotel-reservation.entity';
import { normalizeChildAges } from './hotel-occupancy.util';
import { parseRoomingList, RoomingRoom } from './hotel-rooming-list.util';
import { normalizeNumericInput } from './hotel-number.util';
import { hotelToday } from './hotel-folio.service';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bad = (code: string, message: string, extra: Record<string, unknown> = {}) => new BadRequestException({ code, message, ...extra });
const ACTIVE = ['confirmed', 'pending', 'checked_in'];
const nameKey = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
const ageAt = (birth: string | null, at: string) => {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const [ay, am, ad] = at.split('-').map(Number);
  return ay - y - (am < m || (am === m && ad < d) ? 1 : 0);
};

export interface HotelGroupRoomLine { roomTypeId: string; count: number; adults?: number; childAges?: Array<number | null> }
export type HotelGroupInput = Partial<Pick<HotelGroup, 'name' | 'agencyId' | 'contractId' | 'blockId' | 'ratePlanId' | 'contactName' | 'contactEmail' | 'contactPhone' | 'checkIn' | 'checkOut' | 'status' | 'roomingDue' | 'billing' | 'notes'>> & {
  hotelId?: string;
  optionUntil?: string | null;
  rooms?: HotelGroupRoomLine[];
};

/** Групповые брони: создание номерами, опцион → подтверждение, даты, номера, rooming list, общий платёж, отмена номеров */
@Injectable()
export class HotelGroupsService {
  constructor(
    @InjectRepository(HotelGroup) private readonly groups: Repository<HotelGroup>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(HotelAgency) private readonly agencies: Repository<HotelAgency>,
    private readonly res: HotelReservationsService,
  ) {}

  private async getGroup(tenantId: string, id: string) {
    const g = await this.groups.findOne({ where: { id, tenantId } });
    if (!g) throw new NotFoundException('Группа не найдена');
    return g;
  }

  private rooms(tenantId: string, groupId: string) {
    return this.reservations.find({ where: { tenantId, groupId }, order: { checkIn: 'ASC', createdAt: 'ASC' } });
  }

  private async nextCode(tenantId: string) {
    const d = new Date();
    const prefix = `GRP-${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}-`;
    const [{ n }] = await this.groups.manager.query(`SELECT count(*)::int AS n FROM hotel_groups WHERE "tenantId" = $1 AND code LIKE $2`, [tenantId, `${prefix}%`]);
    for (let i = n + 1; i < n + 50; i++) {
      const code = `${prefix}${String(i).padStart(4, '0')}`;
      if (!(await this.groups.count({ where: { tenantId, code } }))) return code;
    }
    return `${prefix}${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  /** Сводка по номерам группы: номера по типам, гости, rooming, деньги по валюте отеля */
  private summary(rows: HotelReservation[], currency: string) {
    const active = rows.filter((r) => ACTIVE.includes(r.status));
    const money = (r: HotelReservation) => num(r.total) + num(r.extrasTotal);
    const paid = (r: HotelReservation) => (r.payments || []).reduce((s, p) => s + num(p.amount), 0);
    const byType = new Map<string, number>();
    for (const r of active) byType.set(r.roomTypeId, (byType.get(r.roomTypeId) || 0) + 1);
    const total = round2(active.reduce((s, r) => s + money(r), 0) + rows.filter((r) => !ACTIVE.includes(r.status)).reduce((s, r) => s + num(r.cancellationFee), 0));
    const paidSum = round2(rows.reduce((s, r) => s + paid(r), 0));
    return {
      rooms: active.length,
      cancelled: rows.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length,
      named: active.filter((r) => !r.roomingPending).length,
      pax: active.reduce((s, r) => s + (r.pax || 0), 0),
      inHouse: active.filter((r) => r.status === 'checked_in').length,
      checkedOut: rows.filter((r) => r.status === 'checked_out').length,
      withUnit: active.filter((r) => !!r.roomUnitId).length,
      byType: [...byType.entries()].map(([roomTypeId, count]) => ({ roomTypeId, count })),
      total,
      paid: paidSum,
      balance: round2(total - paidSum),
      currency,
    };
  }

  async list(tenantId: string, q: { hotelId?: string; status?: string; period?: 'upcoming' | 'past' | 'all' }) {
    const qb = this.groups.createQueryBuilder('g').where('g.tenantId = :tenantId', { tenantId });
    if (q.hotelId) qb.andWhere('g.hotelId = :hotelId', { hotelId: q.hotelId });
    if (q.status && ['tentative', 'definite', 'cancelled'].includes(q.status)) qb.andWhere('g.status = :status', { status: q.status });
    const today = new Date().toISOString().slice(0, 10);
    if (q.period === 'upcoming' || !q.period) qb.andWhere('g.checkOut >= :today', { today });
    if (q.period === 'past') qb.andWhere('g.checkOut < :today', { today });
    const list = await qb.orderBy('g.checkIn', q.period === 'past' ? 'DESC' : 'ASC').take(300).getMany();
    if (!list.length) return [];
    const [rows, hotels, partners] = await Promise.all([
      this.reservations.find({ where: { tenantId, groupId: In(list.map((g) => g.id)) } }),
      this.hotels.find({ where: { tenantId, id: In([...new Set(list.map((g) => g.hotelId))]) } }),
      this.agencies.find({ where: { tenantId, id: In(list.map((g) => g.agencyId).filter((x): x is string => !!x).concat(['00000000-0000-0000-0000-000000000000'])) } }),
    ]);
    return list.map((g) => {
      const h = hotels.find((x) => x.id === g.hotelId);
      return {
        ...g,
        hotelName: h?.name || '',
        partnerName: partners.find((p) => p.id === g.agencyId)?.name || null,
        summary: this.summary(rows.filter((r) => r.groupId === g.id), (h?.currency || '').toUpperCase()),
      };
    });
  }

  async get(tenantId: string, id: string) {
    const g = await this.getGroup(tenantId, id);
    const [rows, hotel] = await Promise.all([this.rooms(tenantId, id), this.hotels.findOne({ where: { id: g.hotelId, tenantId } })]);
    const unitIds = rows.map((r) => r.roomUnitId).filter((x): x is string => !!x);
    const [units, types, partner] = await Promise.all([
      unitIds.length ? this.units.find({ where: { tenantId, id: In(unitIds) } }) : Promise.resolve([]),
      this.roomTypes.find({ where: { tenantId, hotelId: g.hotelId } }),
      g.agencyId ? this.agencies.findOne({ where: { id: g.agencyId, tenantId } }) : Promise.resolve(null),
    ]);
    return {
      ...g,
      hotelName: hotel?.name || '',
      partnerName: partner?.name || null,
      roomTypes: types.map((t) => ({ id: t.id, name: t.name })),
      summary: this.summary(rows, (hotel?.currency || '').toUpperCase()),
      reservations: rows.map((r) => ({
        id: r.id, guestName: r.guestName, roomingPending: r.roomingPending, roomTypeId: r.roomTypeId,
        roomTypeName: types.find((t) => t.id === r.roomTypeId)?.name || '', roomUnitId: r.roomUnitId,
        roomLabel: units.find((u) => u.id === r.roomUnitId)?.label || null, checkIn: r.checkIn, checkOut: r.checkOut,
        status: r.status, pax: r.pax, children: r.children, total: r.total, extrasTotal: r.extrasTotal,
        paid: round2((r.payments || []).reduce((s, p) => s + num(p.amount), 0)), guests: r.guests || [], optionUntil: r.optionUntil,
      })),
    };
  }

  private async clean(tenantId: string, dto: HotelGroupInput, current?: HotelGroup): Promise<Partial<HotelGroup>> {
    const out: Partial<HotelGroup> = {};
    const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n) || null;
    if (dto.name !== undefined) {
      const n = str(dto.name, 160);
      if (!n) throw bad('HOTEL_GROUP_NAME', 'Укажите название группы');
      out.name = n;
    }
    for (const k of ['contactName', 'contactPhone'] as const) if (dto[k] !== undefined) out[k] = str(dto[k], k === 'contactPhone' ? 40 : 160);
    if (dto.contactEmail !== undefined) {
      const e = str(dto.contactEmail, 200);
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad('HOTEL_GROUP_EMAIL', 'Неверный email контакта');
      out.contactEmail = e;
    }
    if (dto.notes !== undefined) out.notes = str(dto.notes, 4000);
    if (dto.billing !== undefined) out.billing = (dto.billing === 'group' ? 'group' : 'individual') as HotelGroupBilling;
    if (dto.roomingDue !== undefined) {
      if (dto.roomingDue && !ISO.test(String(dto.roomingDue))) throw bad('HOTEL_GROUP_DATE', 'Неверная дата rooming list');
      out.roomingDue = dto.roomingDue || null;
    }
    if (dto.optionUntil !== undefined) {
      const d = dto.optionUntil ? new Date(dto.optionUntil) : null;
      if (d && Number.isNaN(d.getTime())) throw bad('HOTEL_GROUP_DATE', 'Неверный срок опциона');
      out.optionUntil = d;
    }
    for (const k of ['checkIn', 'checkOut'] as const) {
      if (dto[k] === undefined) continue;
      if (!ISO.test(String(dto[k]))) throw bad('HOTEL_GROUP_DATE', 'Неверные даты группы');
      out[k] = String(dto[k]);
    }
    const ci = out.checkIn ?? current?.checkIn;
    const co = out.checkOut ?? current?.checkOut;
    if (ci && co && co <= ci) throw bad('HOTEL_GROUP_DATE', 'Выезд должен быть позже заезда');
    if (dto.agencyId !== undefined) {
      if (dto.agencyId && !(await this.agencies.count({ where: { id: dto.agencyId, tenantId } }))) throw bad('HOTEL_GROUP_PARTNER', 'Партнёр не найден');
      out.agencyId = dto.agencyId || null;
    }
    for (const k of ['contractId', 'blockId', 'ratePlanId'] as const) if (dto[k] !== undefined) out[k] = dto[k] || null;
    return out;
  }

  /** Номера группы — обычные брони с заглушкой имени «Группа · 3», без писем на каждый номер */
  private async createRooms(tenantId: string, g: HotelGroup, lines: HotelGroupRoomLine[], actor: string | null, startNo: number) {
    const created: HotelReservation[] = [];
    let no = startNo;
    try {
      for (const line of lines) {
        const count = Math.round(num(line.count));
        for (let i = 0; i < count; i++) {
          no++;
          const r = await this.res.create(tenantId, {
            hotelId: g.hotelId,
            roomTypeId: line.roomTypeId,
            guestName: `${g.name} · ${no}`,
            guestEmail: null,
            adults: Math.max(1, Math.min(10, Math.round(num(line.adults) || 2))),
            childAges: normalizeChildAges(line.childAges || []),
            checkIn: g.checkIn,
            checkOut: g.checkOut,
            agencyId: g.agencyId,
            ...(g.contractId ? { contractId: g.contractId } : {}),
            blockId: g.blockId,
            ratePlanId: g.contractId || g.blockId ? undefined : g.ratePlanId || undefined,
            priceMode: 'auto',
            status: g.status === 'tentative' ? 'pending' : 'confirmed',
            optionUntil: g.status === 'tentative' && g.optionUntil ? g.optionUntil.toISOString() : null,
            source: 'manual',
            notes: g.notes,
          } as any, actor, { quiet: true, groupId: g.id, roomingPending: true });
          created.push(r);
        }
      }
    } catch (e: any) {
      // группа — всё или ничего: не хватило мест / цены на одном номере — созданные номера убираем
      for (const r of created) await this.reservations.delete({ id: r.id, tenantId });
      const resp = e?.response || {};
      throw bad('HOTEL_GROUP_ROOMS_FAILED', `Номер ${no}: ${resp.message || e?.message || 'ошибка'}`, { room: no, cause: resp.code || null, created: 0 });
    }
    return created;
  }

  private validateLines(lines: HotelGroupRoomLine[], types: HotelRoomType[]) {
    const clean = (lines || []).filter((l) => l && num(l.count) > 0);
    if (!clean.length) throw bad('HOTEL_GROUP_ROOMS', 'Добавьте номера в группу');
    const total = clean.reduce((s, l) => s + Math.round(num(l.count)), 0);
    if (total > 300) throw bad('HOTEL_GROUP_ROOMS', 'Не больше 300 номеров в группе');
    for (const l of clean) if (!types.some((t) => t.id === l.roomTypeId)) throw bad('HOTEL_GROUP_ROOM_TYPE', 'Тип номера не из этого отеля');
    return clean;
  }

  async create(tenantId: string, dto: HotelGroupInput, actor: string | null) {
    const hotel = await this.hotels.findOne({ where: { id: dto.hotelId || '', tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    if (!dto.name || !dto.checkIn || !dto.checkOut) throw bad('HOTEL_GROUP_REQUIRED', 'Нужны название и даты группы');
    const types = await this.roomTypes.find({ where: { tenantId, hotelId: hotel.id } });
    const lines = this.validateLines(dto.rooms || [], types);
    const fields = await this.clean(tenantId, dto);
    const status: HotelGroupStatus = dto.status === 'tentative' ? 'tentative' : 'definite';
    if (status === 'tentative' && !fields.optionUntil) throw bad('HOTEL_GROUP_OPTION', 'Для опциона укажите срок, до которого держим номера');
    const g = await this.groups.save(this.groups.create({
      tenantId, hotelId: hotel.id, code: await this.nextCode(tenantId), billing: 'individual', status, ...fields,
      optionUntil: status === 'tentative' ? fields.optionUntil ?? null : null,
    }));
    try {
      await this.createRooms(tenantId, g, lines, actor, 0);
    } catch (e) {
      await this.groups.delete({ id: g.id, tenantId });
      throw e;
    }
    return this.get(tenantId, g.id);
  }

  async addRooms(tenantId: string, id: string, lines: HotelGroupRoomLine[], actor: string | null) {
    const g = await this.getGroup(tenantId, id);
    if (g.status === 'cancelled') throw bad('HOTEL_GROUP_CANCELLED', 'Группа отменена');
    const types = await this.roomTypes.find({ where: { tenantId, hotelId: g.hotelId } });
    const clean = this.validateLines(lines, types);
    const existing = await this.reservations.count({ where: { tenantId, groupId: id } });
    await this.createRooms(tenantId, g, clean, actor, existing);
    return this.get(tenantId, id);
  }

  /**
   * Правка группы. Статус: tentative → definite — все номера «ожидает» подтверждаются, опцион снимается; срок опциона —
   * на все ожидающие номера. Название / контакт / заметки — только группе (имена гостей не трогаем).
   */
  async update(tenantId: string, id: string, dto: HotelGroupInput, actor: string | null) {
    const g = await this.getGroup(tenantId, id);
    const fields = await this.clean(tenantId, { ...dto, checkIn: undefined, checkOut: undefined, agencyId: undefined, contractId: undefined, blockId: undefined, ratePlanId: undefined }, g);
    Object.assign(g, fields);
    const rows = await this.rooms(tenantId, id);
    if (dto.status === 'definite' && g.status === 'tentative') {
      g.status = 'definite';
      g.optionUntil = null;
      for (const r of rows.filter((x) => x.status === 'pending')) await this.res.update(tenantId, r.id, { status: 'confirmed', optionUntil: null } as any, actor, { quiet: true });
    } else if (dto.status === 'tentative' && g.status === 'definite') {
      throw bad('HOTEL_GROUP_STATUS', 'Подтверждённую группу нельзя вернуть в опцион');
    } else if (dto.status === 'cancelled') {
      throw bad('HOTEL_GROUP_STATUS', 'Для отмены группы используйте «Отменить номера»');
    }
    if (dto.optionUntil !== undefined && g.status === 'tentative') {
      if (!g.optionUntil) throw bad('HOTEL_GROUP_OPTION', 'Для опциона укажите срок');
      for (const r of rows.filter((x) => x.status === 'pending')) await this.res.update(tenantId, r.id, { optionUntil: g.optionUntil.toISOString() } as any, actor, { quiet: true });
    }
    await this.groups.save(g);
    return this.get(tenantId, id);
  }

  /** Новые даты для номеров группы (все или выбранные): цена и наличие проверяются по каждому номеру */
  async changeDates(tenantId: string, id: string, dto: { checkIn: string; checkOut: string; reservationIds?: string[] }, actor: string | null) {
    const g = await this.getGroup(tenantId, id);
    if (!ISO.test(dto?.checkIn || '') || !ISO.test(dto?.checkOut || '') || dto.checkOut <= dto.checkIn) throw bad('HOTEL_GROUP_DATE', 'Выезд должен быть позже заезда');
    const rows = (await this.rooms(tenantId, id)).filter((r) => ['confirmed', 'pending'].includes(r.status) && (!dto.reservationIds?.length || dto.reservationIds.includes(r.id)));
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const r of rows) {
      try {
        await this.res.update(tenantId, r.id, { checkIn: dto.checkIn, checkOut: dto.checkOut } as any, actor, { quiet: true });
        results.push({ id: r.id, ok: true });
      } catch (e: any) {
        results.push({ id: r.id, ok: false, error: e?.response?.message || e?.message });
      }
    }
    // все номера группы на новых датах — даты группы тоже
    if (!dto.reservationIds?.length && results.every((x) => x.ok)) {
      g.checkIn = dto.checkIn;
      g.checkOut = dto.checkOut;
      await this.groups.save(g);
    }
    return { updated: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok), group: await this.get(tenantId, id) };
  }

  /**
   * Раздать номера (комнаты) броням группы без номера: свободные рабочие комнаты того же типа на все даты, подряд по
   * номеру — группа живёт рядом. Занятые другими бронями и выведенные из эксплуатации пропускаются.
   */
  async assignRooms(tenantId: string, id: string, actor: string | null) {
    const g = await this.getGroup(tenantId, id);
    const rows = (await this.rooms(tenantId, id)).filter((r) => ['confirmed', 'pending'].includes(r.status) && !r.roomUnitId);
    if (!rows.length) return { assigned: 0, missing: 0, group: await this.get(tenantId, id) };
    const units = (await this.units.find({ where: { tenantId, hotelId: g.hotelId, active: true } }))
      .filter((u) => u.housekeepingStatus !== 'out_of_order')
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    const taken = new Set<string>();
    let assigned = 0;
    let missing = 0;
    for (const r of rows) {
      const busy: Array<{ roomUnitId: string }> = await this.reservations.manager.query(
        `SELECT DISTINCT "roomUnitId" FROM hotel_reservations WHERE "tenantId" = $1 AND "hotelId" = $2 AND "roomUnitId" IS NOT NULL
           AND status IN ('confirmed','pending','checked_in') AND "checkIn" < $4 AND "checkOut" > $3 AND id <> $5`,
        [tenantId, g.hotelId, r.checkIn, r.checkOut, r.id],
      );
      const busySet = new Set(busy.map((b) => b.roomUnitId));
      let done = false;
      for (const u of units.filter((x) => x.roomTypeId === r.roomTypeId && !busySet.has(x.id) && !taken.has(`${x.id}|${r.checkIn}`))) {
        try {
          await this.res.move(tenantId, r.id, { roomUnitId: u.id, reason: 'group' }, actor);
          taken.add(`${u.id}|${r.checkIn}`);
          assigned++;
          done = true;
          break;
        } catch {
          // номер выведен на часть дат / занят — следующий
        }
      }
      if (!done) missing++;
    }
    return { assigned, missing, group: await this.get(tenantId, id) };
  }

  /** Rooming list: что найдено в файле и куда ляжет (какой номер группы получит каких гостей) */
  async roomingPreview(tenantId: string, id: string, file: any) {
    const g = await this.getGroup(tenantId, id);
    const parsed = await parseRoomingList(file);
    const plan = await this.roomingPlan(tenantId, g, parsed.rooms);
    return { columns: parsed.columns, skipped: parsed.skipped, rooms: plan.map((p) => ({ ...p.room, roomTypeId: p.roomTypeId, reservationId: p.reservation?.id ?? null, reservationName: p.reservation?.guestName ?? null, existing: p.existing, problem: p.problem })) };
  }

  private async roomingPlan(tenantId: string, g: HotelGroup, rooms: RoomingRoom[]) {
    const [types, rows] = await Promise.all([this.roomTypes.find({ where: { tenantId, hotelId: g.hotelId } }), this.rooms(tenantId, g.id)]);
    const free = rows.filter((r) => r.roomingPending && ['confirmed', 'pending'].includes(r.status));
    const groupTypes = [...new Set(rows.filter((r) => ACTIVE.includes(r.status)).map((r) => r.roomTypeId))];
    const used = new Set<string>();
    const alive = rows.filter((r) => ['confirmed', 'pending', 'checked_in'].includes(r.status) && !r.roomingPending);
    return rooms.map((room) => {
      // гость уже стоит в номере группы (файл прислали повторно / дополненный) — обновляем этот номер, новый не нужен
      const leadKey = nameKey(room.guests[0]?.fullName || '');
      const already = leadKey ? alive.find((r) => !used.has(r.id) && room.guests.some((g) => nameKey(g.fullName) === nameKey(r.guestName))) : null;
      if (already) {
        used.add(already.id);
        return { room, roomTypeId: already.roomTypeId, reservation: already, problem: null as string | null, existing: true };
      }
      let roomTypeId: string | null = null;
      if (room.roomType) {
        const k = nameKey(room.roomType);
        const hit = types.find((t) => nameKey(t.name) === k) || types.find((t) => nameKey(t.name).includes(k) || k.includes(nameKey(t.name)));
        roomTypeId = hit?.id ?? null;
      } else if (groupTypes.length === 1) roomTypeId = groupTypes[0];
      const candidates = free.filter((r) => !used.has(r.id) && (!roomTypeId || r.roomTypeId === roomTypeId));
      const reservation = candidates.find((r) => (!room.checkIn || r.checkIn === room.checkIn) && (!room.checkOut || r.checkOut === room.checkOut)) || candidates[0] || null;
      if (reservation) used.add(reservation.id);
      const problem = room.roomType && !roomTypeId ? 'unknown_room_type' : !reservation ? 'no_free_room' : null;
      return { room, roomTypeId: roomTypeId ?? reservation?.roomTypeId ?? null, reservation, problem, existing: false };
    });
  }

  /**
   * Применить rooming list: каждому номеру файла — свободный номер группы того же типа: имя гостя, состав (паспорта,
   * даты рождения), взрослые / дети по возрасту ребёнка отеля, даты из файла. addMissing — недостающие номера добавить в группу.
   */
  async roomingApply(tenantId: string, id: string, file: any, opts: { addMissing?: boolean }, actor: string | null) {
    const g = await this.getGroup(tenantId, id);
    if (g.status === 'cancelled') throw bad('HOTEL_GROUP_CANCELLED', 'Группа отменена');
    const hotel = await this.hotels.findOne({ where: { id: g.hotelId, tenantId } });
    const childMax = Number(hotel?.childMaxAge) || 12;
    const parsed = await parseRoomingList(file);
    const plan = await this.roomingPlan(tenantId, g, parsed.rooms);
    const result = { applied: 0, updated: 0, added: 0, failed: [] as Array<{ row: number; name: string; error: string }> };
    for (const p of plan) {
      const at = p.room.checkIn || p.reservation?.checkIn || g.checkIn;
      const guests: HotelReservationGuest[] = p.room.guests.map((x) => ({
        id: randomUUID(), fullName: x.fullName, citizenship: x.nationality || '', passportNumber: x.passportNumber || '', passportExpiry: x.passportExpiry || '',
        age: String(x.age ?? ageAt(x.birthDate, at) ?? ''), note: null, birthDate: x.birthDate || '', gender: x.gender || '', nationalityCode: x.nationality,
        documentType: x.passportNumber ? 'passport' : '',
      }));
      const ages = p.room.guests.map((x) => x.age ?? ageAt(x.birthDate, at));
      const kids = p.room.guests.map((x, i) => ({ x, age: ages[i] })).filter(({ x, age }) => (age !== null && age < childMax) || (age === null && x.childHint));
      const adults = Math.max(1, p.room.guests.length - kids.length);
      const lead = p.room.guests.find((x, i) => !kids.some((k) => k.x === x) && i >= 0) || p.room.guests[0];
      const dto: any = {
        guestName: lead.fullName, guests, adults, childAges: kids.map((k) => k.age),
        ...(p.room.checkIn ? { checkIn: p.room.checkIn } : {}), ...(p.room.checkOut ? { checkOut: p.room.checkOut } : {}),
        ...(p.room.notes ? { notes: [p.reservation?.notes, p.room.notes].filter(Boolean).join('\n') } : {}),
      };
      try {
        if (p.reservation) {
          await this.res.update(tenantId, p.reservation.id, dto, actor, { quiet: true });
          if (p.existing) result.updated++;
          else result.applied++;
        } else if (opts.addMissing && p.roomTypeId && !p.problem?.startsWith('unknown')) {
          const created = await this.createRooms(tenantId, { ...g, checkIn: p.room.checkIn || g.checkIn, checkOut: p.room.checkOut || g.checkOut } as HotelGroup, [{ roomTypeId: p.roomTypeId, count: 1, adults, childAges: dto.childAges }], actor, await this.reservations.count({ where: { tenantId, groupId: id } }));
          await this.res.update(tenantId, created[0].id, dto, actor, { quiet: true });
          result.added++;
        } else {
          result.failed.push({ row: p.room.row, name: lead.fullName, error: p.problem || 'no_free_room' });
        }
      } catch (e: any) {
        result.failed.push({ row: p.room.row, name: lead.fullName, error: e?.response?.code || e?.response?.message || e?.message || 'error' });
      }
    }
    return { ...result, group: await this.get(tenantId, id) };
  }

  /**
   * Общий платёж группы: раскладывается по номерам с долгом (сначала ранний заезд), остаток — на первый номер.
   * В каждой брони — обычный платёж с пометкой группы (фолио, касса, отчёты видят его как есть).
   */
  async pay(tenantId: string, id: string, dto: { amount: string | number; method: string; date?: string; note?: string; folio?: 'guest' | 'partner' }, actor: string | null) {
    const g = await this.getGroup(tenantId, id);
    let left = round2(num(normalizeNumericInput(dto?.amount as any)));
    if (!(left > 0)) throw bad('HOTEL_PAYMENT_ZERO', 'Сумма платежа не может быть нулевой');
    const rows = (await this.rooms(tenantId, id)).filter((r) => ACTIVE.includes(r.status) || r.status === 'checked_out');
    if (!rows.length) throw bad('HOTEL_GROUP_EMPTY', 'В группе нет номеров для оплаты');
    const note = `${g.code}${dto.note ? ` · ${String(dto.note).slice(0, 200)}` : ''}`;
    const parts: Array<{ id: string; amount: number }> = [];
    for (const r of rows) {
      if (left <= 0) break;
      const due = round2(num(r.total) + num(r.extrasTotal) - (r.payments || []).reduce((s, p) => s + num(p.amount), 0));
      if (due <= 0) continue;
      const a = round2(Math.min(due, left));
      parts.push({ id: r.id, amount: a });
      left = round2(left - a);
    }
    if (left > 0) {
      const first = parts[0] || { id: rows[0].id, amount: 0 };
      if (!parts.length) parts.push(first);
      first.amount = round2(first.amount + left);
    }
    for (const p of parts) {
      await this.res.addPayment(tenantId, p.id, { amount: String(p.amount), method: dto.method || 'bank_transfer', date: dto.date, note, folio: dto.folio }, actor);
    }
    return { distributed: parts, group: await this.get(tenantId, id) };
  }

  /** Отменить номера группы (все или выбранные): штраф по условиям каждой брони или без штрафа */
  async cancelRooms(tenantId: string, id: string, dto: { reservationIds?: string[]; reason: string; fee: 'policy' | 'none'; note?: string }, actor: string | null) {
    const g = await this.getGroup(tenantId, id);
    if (!(HOTEL_CANCEL_REASONS as readonly string[]).includes(dto?.reason) || dto.reason === 'option_expired') throw bad('HOTEL_CANCEL_REASON_REQUIRED', 'Укажите причину отмены');
    const rows = (await this.rooms(tenantId, id)).filter((r) => ['confirmed', 'pending'].includes(r.status) && (!dto.reservationIds?.length || dto.reservationIds.includes(r.id)));
    const failed: Array<{ id: string; error: string }> = [];
    let cancelled = 0;
    for (const r of rows) {
      try {
        await this.res.cancel(tenantId, r.id, { reason: dto.reason, note: dto.note || g.code, fee: dto.fee === 'none' ? 0 : null }, actor);
        cancelled++;
      } catch (e: any) {
        failed.push({ id: r.id, error: e?.response?.message || e?.message });
      }
    }
    // в группе не осталось ни живых, ни прожитых номеров — группа отменена целиком
    const alive = await this.reservations.count({ where: { tenantId, groupId: id, status: In([...ACTIVE, 'checked_out']) as any } });
    if (!alive) {
      g.status = 'cancelled';
      await this.groups.save(g);
    }
    return { cancelled, failed, group: await this.get(tenantId, id) };
  }

  /** Заселить номера группы, у которых сегодня заезд и есть комната; выселить тех, у кого сегодня выезд */
  async bulkStay(tenantId: string, id: string, action: 'check_in' | 'check_out', actor: string | null) {
    const g = await this.getGroup(tenantId, id);
    const today = hotelToday(await this.hotels.findOne({ where: { id: g.hotelId, tenantId } }));
    const rows = await this.rooms(tenantId, id);
    const done: string[] = [];
    const failed: Array<{ id: string; name: string; error: string }> = [];
    for (const r of rows) {
      // заселяем только сегодняшний заезд, выселяем — с выездом сегодня или раньше
      const fit = action === 'check_in' ? ['confirmed', 'pending'].includes(r.status) && r.checkIn === today : r.status === 'checked_in' && r.checkOut <= today;
      if (!fit) continue;
      try {
        if (action === 'check_in') {
          if (!r.roomUnitId) throw bad('HOTEL_GROUP_NO_UNIT', 'Нет номера');
          await this.res.checkIn(tenantId, r.id, r.roomUnitId, actor);
        } else {
          await this.res.checkOut(tenantId, r.id, actor);
        }
        done.push(r.id);
      } catch (e: any) {
        failed.push({ id: r.id, name: r.guestName, error: e?.response?.code || e?.response?.message || e?.message });
      }
    }
    return { done: done.length, failed, group: await this.get(tenantId, id) };
  }
}
