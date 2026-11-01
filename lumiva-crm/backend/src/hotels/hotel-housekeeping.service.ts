import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { isInfant } from './hotel-occupancy.util';
import {
  HOTEL_ISSUE_CATEGORIES,
  HOTEL_LOST_CATEGORIES,
  HOTEL_OUTAGE_REASONS,
  HOTEL_UNIT_FEATURES,
  HotelHkTaskKind,
  HotelHousekeepingTask,
  HotelIssuePriority,
  HotelIssueStatus,
  HotelLostFound,
  HotelLostStatus,
  HotelMaintenanceIssue,
  HotelRoomOutage,
} from './hotel-housekeeping.entities';
import { TenantMailService } from '../mail/tenant-mail.service';
import { hotelToday } from './hotel-folio.service';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const bad = (code: string, message: string) => new BadRequestException({ code, message });

/** Неработающий номер в этот день (OOO/OOS): dateFrom ≤ день < dateTo (или до устранения) */
export const outageActiveOn = (o: Pick<HotelRoomOutage, 'dateFrom' | 'dateTo'>, date: string) => o.dateFrom <= date && (!o.dateTo || date < o.dateTo);
export const outageOverlaps = (o: Pick<HotelRoomOutage, 'dateFrom' | 'dateTo'>, from: string, to: string) => o.dateFrom < to && (!o.dateTo || o.dateTo > from);

/** Младенцы брони (до 2 лет) — горничной поставить детскую кроватку */
const babyCots = (r: Pick<HotelReservation, 'childAges'> | null | undefined) => (r?.childAges || []).filter(isInfant).length;

const CREDITS: Record<HotelHkTaskKind, number> = { departure: 3, arrival: 2, vacant_dirty: 2, stayover: 1 };
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

type ActionKind = 'start' | 'done' | 'skip' | 'reopen' | 'inspect';

@Injectable()
export class HotelHousekeepingService {
  constructor(
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelRoomOutage) private readonly outages: Repository<HotelRoomOutage>,
    @InjectRepository(HotelHousekeepingTask) private readonly tasks: Repository<HotelHousekeepingTask>,
    @InjectRepository(HotelMaintenanceIssue) private readonly issues: Repository<HotelMaintenanceIssue>,
    @InjectRepository(HotelLostFound) private readonly lost: Repository<HotelLostFound>,
    private readonly tenantMail: TenantMailService,
  ) {}

  private async hotel(tenantId: string, hotelId: string) {
    if (!hotelId) throw bad('HOTEL_HK_HOTEL_REQUIRED', 'Не выбран отель');
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!h) throw new NotFoundException('Отель не найден');
    return h;
  }

  private async unit(tenantId: string, id: string) {
    const u = await this.units.findOne({ where: { id, tenantId } });
    if (!u) throw bad('HOTEL_HK_UNIT_NOT_FOUND', 'Номер не найден');
    return u;
  }

  /** Сотрудники компании — кандидаты в горничные/исполнители */
  async staff(tenantId: string) {
    const rows: Array<{ id: string; name: string | null; email: string }> = await this.units.manager.query(
      `SELECT id, name, email FROM users WHERE "tenantId" = $1 AND (status IS NULL OR status = 'active') ORDER BY COALESCE(name, email)`,
      [tenantId],
    );
    return rows.map((u) => ({ id: u.id, name: u.name || u.email }));
  }

  // ─── номера: этаж, корпус, признаки ───
  async listUnits(tenantId: string, hotelId: string) {
    await this.hotel(tenantId, hotelId);
    const [units, types] = await Promise.all([
      this.units.find({ where: { tenantId, hotelId } }),
      this.roomTypes.find({ where: { tenantId, hotelId }, select: ['id', 'name'] }),
    ]);
    units.sort((a, b) => collator.compare(a.label, b.label));
    return { units, roomTypes: types };
  }

  async updateUnit(tenantId: string, id: string, dto: { floor?: string | null; building?: string | null; features?: string[]; note?: string | null }) {
    const u = await this.unit(tenantId, id);
    if (dto.floor !== undefined) u.floor = String(dto.floor ?? '').trim().slice(0, 16) || null;
    if (dto.building !== undefined) u.building = String(dto.building ?? '').trim().slice(0, 64) || null;
    if (dto.note !== undefined) u.note = String(dto.note ?? '').trim() || null;
    if (dto.features !== undefined) u.features = [...new Set((dto.features || []).filter((f) => (HOTEL_UNIT_FEATURES as readonly string[]).includes(f)))];
    return this.units.save(u);
  }

  /** «Этаж по номеру»: 101→1, 1204→12, A305→3 — для номеров без этажа (или всех при overwrite) */
  async floorsFromLabels(tenantId: string, hotelId: string, overwrite = false) {
    await this.hotel(tenantId, hotelId);
    const units = await this.units.find({ where: { tenantId, hotelId } });
    let changed = 0;
    for (const u of units) {
      if (u.floor && !overwrite) continue;
      const digits = (u.label.match(/\d+/) || [''])[0];
      if (digits.length < 3) continue;
      const floor = String(Number(digits.slice(0, digits.length - 2)));
      if (floor !== u.floor) {
        u.floor = floor;
        changed += 1;
      }
    }
    await this.units.save(units);
    return { changed };
  }

  // ─── неработающие номера (PMS-005) ───
  async listOutages(tenantId: string, hotelId: string, opts: { activeOn?: string; includeEnded?: boolean } = {}) {
    const h = await this.hotel(tenantId, hotelId);
    const rows = await this.outages.find({ where: { tenantId, hotelId }, order: { dateFrom: 'DESC' } });
    const today = opts.activeOn && ISO.test(opts.activeOn) ? opts.activeOn : hotelToday(h);
    return opts.includeEnded ? rows : rows.filter((o) => !o.dateTo || o.dateTo > today);
  }

  /** Брони, назначенные на номер в период неработы, — их нужно переселить */
  private async conflictsFor(tenantId: string, unitId: string, from: string, to: string | null) {
    const qb = this.reservations
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.roomUnitId = :unitId', { tenantId, unitId })
      .andWhere("r.status IN ('confirmed','pending','checked_in')")
      .andWhere('r.checkOut > :from', { from });
    if (to) qb.andWhere('r.checkIn < :to', { to });
    const rows = await qb.orderBy('r.checkIn', 'ASC').getMany();
    return rows.map((r) => ({ id: r.id, guestName: r.guestName, checkIn: r.checkIn, checkOut: r.checkOut, status: r.status }));
  }

  async createOutage(tenantId: string, dto: Partial<HotelRoomOutage>, actorUserId?: string | null) {
    const u = await this.unit(tenantId, String(dto.roomUnitId || ''));
    const dateFrom = String(dto.dateFrom || hotelToday(await this.hotels.findOne({ where: { id: u.hotelId, tenantId } })));
    const dateTo = dto.dateTo ? String(dto.dateTo) : null;
    if (!ISO.test(dateFrom) || (dateTo && (!ISO.test(dateTo) || dateTo <= dateFrom))) throw bad('HOTEL_OUTAGE_BAD_DATES', 'Дата окончания должна быть позже начала');
    const reason = (HOTEL_OUTAGE_REASONS as readonly string[]).includes(String(dto.reason)) ? (dto.reason as any) : 'other';
    const saved = await this.outages.save(this.outages.create({
      tenantId, hotelId: u.hotelId, roomUnitId: u.id, kind: dto.kind === 'oos' ? 'oos' : 'ooo', dateFrom, dateTo, reason,
      note: String(dto.note || '').trim() || null, issueId: dto.issueId ?? null, createdBy: actorUserId ?? null,
    }));
    return { outage: saved, conflicts: saved.kind === 'ooo' ? await this.conflictsFor(tenantId, u.id, dateFrom, dateTo) : [] };
  }

  async updateOutage(tenantId: string, id: string, dto: Partial<HotelRoomOutage>) {
    const o = await this.outages.findOne({ where: { id, tenantId } });
    if (!o) throw new NotFoundException('Запись не найдена');
    if (dto.dateFrom !== undefined) o.dateFrom = String(dto.dateFrom);
    if (dto.dateTo !== undefined) o.dateTo = dto.dateTo ? String(dto.dateTo) : null;
    if (!ISO.test(o.dateFrom) || (o.dateTo && (!ISO.test(o.dateTo) || o.dateTo <= o.dateFrom))) throw bad('HOTEL_OUTAGE_BAD_DATES', 'Дата окончания должна быть позже начала');
    if (dto.kind) o.kind = dto.kind === 'oos' ? 'oos' : 'ooo';
    if (dto.reason && (HOTEL_OUTAGE_REASONS as readonly string[]).includes(dto.reason)) o.reason = dto.reason;
    if (dto.note !== undefined) o.note = String(dto.note || '').trim() || null;
    const saved = await this.outages.save(o);
    return { outage: saved, conflicts: saved.kind === 'ooo' ? await this.conflictsFor(tenantId, o.roomUnitId, o.dateFrom, o.dateTo) : [] };
  }

  /** Номер снова в строю с сегодняшнего дня; будущий период просто удаляется */
  async endOutage(tenantId: string, id: string) {
    const o = await this.outages.findOne({ where: { id, tenantId } });
    if (!o) throw new NotFoundException('Запись не найдена');
    const today = hotelToday(await this.hotels.findOne({ where: { id: o.hotelId, tenantId } }));
    if (o.dateFrom >= today) {
      await this.outages.delete({ id, tenantId });
      return { removed: true };
    }
    o.dateTo = today;
    return { outage: await this.outages.save(o) };
  }

  async removeOutage(tenantId: string, id: string) {
    await this.outages.delete({ id, tenantId });
    return { ok: true };
  }

  // ─── план уборки (PMS-100) ───
  /**
   * Строит/обновляет задачи на день по броням и статусам номеров. Идемпотентно: назначения и выполненные задачи
   * сохраняются, ненужные «ожидающие» удаляются. Прошлые дни не пересчитываются — только читаются.
   */
  private async syncPlan(tenantId: string, hotelId: string, date: string) {
    const [units, res, outs, existing] = await Promise.all([
      this.units.find({ where: { tenantId, hotelId, active: true } }),
      this.reservations
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId })
        .andWhere('r.roomUnitId IS NOT NULL')
        .andWhere("r.status IN ('confirmed','pending','checked_in','checked_out')")
        .andWhere('r.checkIn <= :date AND r.checkOut >= :date', { date })
        .getMany(),
      this.outages.find({ where: { tenantId, hotelId } }),
      this.tasks.find({ where: { tenantId, hotelId, date } }),
    ]);
    const byUnit = new Map<string, HotelHousekeepingTask>(existing.map((t) => [t.roomUnitId, t]));
    const toSave: HotelHousekeepingTask[] = [];
    const toDelete: string[] = [];
    for (const u of units) {
      const ooo = u.housekeepingStatus === 'out_of_order' || outs.some((o) => o.roomUnitId === u.id && o.kind === 'ooo' && outageActiveOn(o, date));
      const mine = res.filter((r) => r.roomUnitId === u.id);
      const dep = mine.find((r) => r.checkOut === date && (r.status === 'checked_in' || r.status === 'checked_out'));
      const arr = mine.find((r) => r.checkIn === date && ['confirmed', 'pending', 'checked_in'].includes(r.status));
      const stay = mine.find((r) => r.checkIn < date && r.checkOut > date && r.status === 'checked_in');
      let kind: HotelHkTaskKind | null = null;
      let priority = 0;
      let credits = 0;
      let reservationId: string | null = null;
      if (!ooo) {
        if (dep) {
          kind = 'departure';
          reservationId = dep.id;
          priority = arr ? (arr.earlyCheckIn ? 100 : 90) : dep.lateCheckOut ? 30 : 60;
        } else if (stay) {
          kind = 'stayover';
          reservationId = stay.id;
          priority = 20;
        } else if (arr && u.housekeepingStatus !== 'inspected') {
          kind = 'arrival';
          reservationId = arr.id;
          priority = arr.earlyCheckIn ? 100 : 80;
        } else if (u.housekeepingStatus === 'dirty') {
          kind = 'vacant_dirty';
          priority = 40;
        }
        if (kind) credits = kind === 'arrival' && u.housekeepingStatus === 'clean' ? 1 : CREDITS[kind];
      }
      const cur = byUnit.get(u.id);
      if (!kind) {
        if (cur && cur.status === 'pending') toDelete.push(cur.id);
        continue;
      }
      if (cur) {
        if (cur.status === 'pending' || cur.status === 'in_progress') {
          if (cur.kind !== kind || cur.priority !== priority || cur.credits !== credits || cur.reservationId !== reservationId) {
            Object.assign(cur, { kind, priority, credits, reservationId });
            toSave.push(cur);
          }
        }
      } else {
        toSave.push(this.tasks.create({ tenantId, hotelId, date, roomUnitId: u.id, kind, priority, credits, reservationId, status: 'pending' }));
      }
    }
    if (toDelete.length) await this.tasks.delete({ tenantId, id: In(toDelete) });
    if (toSave.length) await this.tasks.save(toSave);
  }

  async plan(tenantId: string, hotelId: string, date?: string) {
    const hotelRow = await this.hotel(tenantId, hotelId);
    const hotelDay = hotelToday(hotelRow);
    const day = date && ISO.test(date) ? date : hotelDay;
    if (day >= hotelDay) await this.syncPlan(tenantId, hotelId, day);
    const [tasks, units, types, outs, staff, res] = await Promise.all([
      this.tasks.find({ where: { tenantId, hotelId, date: day } }),
      this.units.find({ where: { tenantId, hotelId } }),
      this.roomTypes.find({ where: { tenantId, hotelId }, select: ['id', 'name'] }),
      this.outages.find({ where: { tenantId, hotelId } }),
      this.staff(tenantId),
      this.reservations
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId })
        .andWhere('r.roomUnitId IS NOT NULL')
        .andWhere("r.status IN ('confirmed','pending','checked_in','checked_out')")
        .andWhere('r.checkIn <= :date AND r.checkOut >= :date', { date: day })
        .getMany(),
    ]);
    const typeName = new Map(types.map((t) => [t.id, t.name]));
    const unitById = new Map(units.map((u) => [u.id, u]));
    // статус номера как в PMS-004: занят/свободен × убран/грязный/проверен, либо OOO/OOS
    const roomState = (u: HotelRoomUnit) => {
      const out = outs.find((o) => o.roomUnitId === u.id && outageActiveOn(o, day));
      if (u.housekeepingStatus === 'out_of_order' || out?.kind === 'ooo') return 'out_of_order';
      if (out?.kind === 'oos') return 'out_of_service';
      const occupied = res.some((r) => r.roomUnitId === u.id && r.status === 'checked_in' && r.checkIn <= day && r.checkOut > day);
      if (u.housekeepingStatus === 'inspected') return occupied ? 'occupied_clean' : 'inspected';
      return `${occupied ? 'occupied' : 'vacant'}_${u.housekeepingStatus === 'dirty' ? 'dirty' : 'clean'}`;
    };
    const resById = new Map(res.map((r) => [r.id, r]));
    const rows = tasks
      .map((t) => {
        const u = unitById.get(t.roomUnitId);
        const r = t.reservationId ? resById.get(t.reservationId) : null;
        const next = res.find((x) => x.roomUnitId === t.roomUnitId && x.checkIn === day && x.id !== t.reservationId && ['confirmed', 'pending'].includes(x.status));
        return {
          ...t,
          unit: u ? { id: u.id, label: u.label, floor: u.floor, building: u.building, roomTypeName: typeName.get(u.roomTypeId) || '', housekeepingStatus: u.housekeepingStatus, state: roomState(u) } : null,
          guestName: r?.guestName ?? null,
          pax: r?.pax ?? null,
          earlyCheckIn: (next || (t.kind === 'arrival' ? r : null))?.earlyCheckIn ?? false,
          lateCheckOut: t.kind === 'departure' ? r?.lateCheckOut ?? false : false,
          nextArrival: next ? { guestName: next.guestName, earlyCheckIn: next.earlyCheckIn } : null,
          departed: t.kind === 'departure' ? r?.status === 'checked_out' : null,
          babyCots: t.kind === 'departure' ? babyCots(next) : babyCots(r),
        };
      })
      .sort((a, b) => b.priority - a.priority || collator.compare(a.unit?.floor || '', b.unit?.floor || '') || collator.compare(a.unit?.label || '', b.unit?.label || ''));
    const load = new Map<string, { userId: string; tasks: number; credits: number; done: number }>();
    for (const t of tasks) {
      if (!t.assigneeUserId) continue;
      const l = load.get(t.assigneeUserId) || { userId: t.assigneeUserId, tasks: 0, credits: 0, done: 0 };
      l.tasks += 1;
      l.credits += t.credits;
      if (t.status === 'done' || t.status === 'inspected' || t.status === 'skipped') l.done += 1;
      load.set(t.assigneeUserId, l);
    }
    const states: Record<string, number> = {};
    for (const u of units.filter((x) => x.active)) states[roomState(u)] = (states[roomState(u)] || 0) + 1;
    return {
      date: day,
      editable: day >= hotelDay,
      tasks: rows,
      staff,
      load: [...load.values()],
      roomStates: states,
      summary: {
        total: tasks.length,
        done: tasks.filter((t) => t.status === 'done' || t.status === 'inspected').length,
        inspected: tasks.filter((t) => t.status === 'inspected').length,
        unassigned: tasks.filter((t) => !t.assigneeUserId && t.status === 'pending').length,
        credits: tasks.reduce((s, t) => s + t.credits, 0),
      },
    };
  }

  /** Распределение по горничным (PMS-101): по корпусу/этажу подряд, поровну в кредитах */
  async autoAssign(tenantId: string, hotelId: string, date: string, userIds: string[], mode: 'unassigned' | 'all' = 'unassigned') {
    const hotelRow = await this.hotel(tenantId, hotelId);
    const staff = new Set((await this.staff(tenantId)).map((s) => s.id));
    const users = [...new Set(userIds || [])].filter((id) => staff.has(id));
    if (!users.length) throw bad('HOTEL_HK_NO_STAFF', 'Выберите хотя бы одну горничную');
    const hotelDay = hotelToday(hotelRow);
    const day = date && ISO.test(date) ? date : hotelDay;
    if (day >= hotelDay) await this.syncPlan(tenantId, hotelId, day);
    const all = await this.tasks.find({ where: { tenantId, hotelId, date: day } });
    const units = new Map((await this.units.find({ where: { tenantId, hotelId } })).map((u) => [u.id, u]));
    const pool = all.filter((t) => t.status === 'pending' && (mode === 'all' || !t.assigneeUserId));
    if (!pool.length) return { assigned: 0 };
    pool.sort((a, b) => {
      const ua = units.get(a.roomUnitId);
      const ub = units.get(b.roomUnitId);
      return collator.compare(ua?.building || '', ub?.building || '') || collator.compare(ua?.floor || '', ub?.floor || '') || collator.compare(ua?.label || '', ub?.label || '');
    });
    // уже закреплённая нагрузка (выполненные/начатые) учитывается, чтобы не перегрузить одну горничную
    const kept = new Map(users.map((u) => [u, 0]));
    for (const t of all) if (!pool.includes(t) && t.assigneeUserId && kept.has(t.assigneeUserId)) kept.set(t.assigneeUserId, kept.get(t.assigneeUserId)! + t.credits);
    const total = pool.reduce((s, t) => s + t.credits, 0) + [...kept.values()].reduce((s, v) => s + v, 0);
    const target = total / users.length;
    let i = 0;
    let acc = kept.get(users[0]) || 0;
    for (const t of pool) {
      while (i < users.length - 1 && acc >= target) {
        i += 1;
        acc = kept.get(users[i]) || 0;
      }
      t.assigneeUserId = users[i];
      acc += t.credits;
    }
    await this.tasks.save(pool);
    return { assigned: pool.length };
  }

  async assignTask(tenantId: string, id: string, userId: string | null) {
    const t = await this.tasks.findOne({ where: { id, tenantId } });
    if (!t) throw new NotFoundException('Задача не найдена');
    if (userId) {
      const ok = (await this.staff(tenantId)).some((s) => s.id === userId);
      if (!ok) throw bad('HOTEL_HK_NO_STAFF', 'Сотрудник не найден');
    }
    t.assigneeUserId = userId || null;
    return this.tasks.save(t);
  }

  /** Смена статуса задачи (PMS-102/104); «готово» — номер убран, «проверено» — номер проверен супервайзером */
  async taskAction(tenantId: string, id: string, action: ActionKind, note: string | undefined, actorUserId?: string | null) {
    const t = await this.tasks.findOne({ where: { id, tenantId } });
    if (!t) throw new NotFoundException('Задача не найдена');
    const u = await this.unit(tenantId, t.roomUnitId);
    const now = new Date();
    if (note !== undefined) t.note = String(note || '').trim().slice(0, 500) || null;
    if (action === 'start') {
      if (t.status !== 'pending') throw bad('HOTEL_HK_BAD_TRANSITION', 'Задача уже начата или закрыта');
      t.status = 'in_progress';
      t.startedAt = now;
      if (!t.assigneeUserId && actorUserId) t.assigneeUserId = actorUserId;
    } else if (action === 'done') {
      if (!['pending', 'in_progress'].includes(t.status)) throw bad('HOTEL_HK_BAD_TRANSITION', 'Задача уже закрыта');
      t.status = 'done';
      t.doneAt = now;
      t.startedAt = t.startedAt || now;
      if (!t.assigneeUserId && actorUserId) t.assigneeUserId = actorUserId;
      if (u.housekeepingStatus !== 'out_of_order') u.housekeepingStatus = 'clean';
    } else if (action === 'inspect') {
      if (t.status !== 'done') throw bad('HOTEL_HK_BAD_TRANSITION', 'Проверить можно только убранный номер');
      t.status = 'inspected';
      t.inspectedAt = now;
      t.inspectedBy = actorUserId ?? null;
      if (u.housekeepingStatus !== 'out_of_order') u.housekeepingStatus = 'inspected';
    } else if (action === 'skip') {
      if (!['pending', 'in_progress'].includes(t.status)) throw bad('HOTEL_HK_BAD_TRANSITION', 'Задача уже закрыта');
      if (!t.note) throw bad('HOTEL_HK_SKIP_REASON', 'Укажите причину: «не беспокоить», гость отказался…');
      t.status = 'skipped';
      t.doneAt = now;
    } else if (action === 'reopen') {
      t.status = 'pending';
      t.startedAt = null;
      t.doneAt = null;
      t.inspectedAt = null;
      t.inspectedBy = null;
      if (u.housekeepingStatus !== 'out_of_order') u.housekeepingStatus = 'dirty';
    } else {
      throw bad('HOTEL_HK_BAD_TRANSITION', 'Неизвестное действие');
    }
    await this.units.save(u);
    return this.tasks.save(t);
  }

  /** Экран горничной: мои номера на день по всем отелям */
  async myTasks(tenantId: string, userId: string, date?: string) {
    const day = date && ISO.test(date) ? date : todayIso();
    const tasks = await this.tasks.find({ where: { tenantId, assigneeUserId: userId, date: day } });
    if (!tasks.length) return { date: day, tasks: [] };
    const [units, hotels, res] = await Promise.all([
      this.units.find({ where: { tenantId, id: In([...new Set(tasks.map((t) => t.roomUnitId))]) } }),
      this.hotels.find({ where: { tenantId, id: In([...new Set(tasks.map((t) => t.hotelId))]) }, select: ['id', 'name'] }),
      this.reservations.find({ where: { tenantId, id: In(tasks.map((t) => t.reservationId).filter((x): x is string => !!x)) } }),
    ]);
    const types = await this.roomTypes.find({ where: { tenantId, id: In([...new Set(units.map((u) => u.roomTypeId))]) }, select: ['id', 'name'] });
    const unitById = new Map(units.map((u) => [u.id, u]));
    const resById = new Map(res.map((r) => [r.id, r]));
    const rows = tasks.map((t) => {
      const u = unitById.get(t.roomUnitId);
      const r = t.reservationId ? resById.get(t.reservationId) : null;
      return {
        ...t,
        hotelName: hotels.find((h) => h.id === t.hotelId)?.name || '',
        unit: u ? { id: u.id, label: u.label, floor: u.floor, building: u.building, housekeepingStatus: u.housekeepingStatus, roomTypeName: types.find((x) => x.id === u.roomTypeId)?.name || '' } : null,
        guestName: r?.guestName ?? null,
        earlyCheckIn: r?.earlyCheckIn ?? false,
        lateCheckOut: r?.lateCheckOut ?? false,
        departed: t.kind === 'departure' ? r?.status === 'checked_out' : null,
        babyCots: t.kind === 'departure' ? 0 : babyCots(r),
      };
    });
    const order = { in_progress: 0, pending: 1, done: 2, skipped: 3, inspected: 4 } as Record<string, number>;
    rows.sort((a, b) => order[a.status] - order[b.status] || b.priority - a.priority || collator.compare(a.unit?.floor || '', b.unit?.floor || '') || collator.compare(a.unit?.label || '', b.unit?.label || ''));
    return { date: day, tasks: rows };
  }

  // ─── неисправности (PMS-103) ───
  async listIssues(tenantId: string, hotelId: string, status?: string) {
    await this.hotel(tenantId, hotelId);
    const where: any = { tenantId, hotelId };
    if (status === 'active') where.status = In(['open', 'in_progress']);
    else if (status) where.status = status;
    const rows = await this.issues.find({ where, order: { createdAt: 'DESC' }, take: 500 });
    // повторяющиеся поломки: ≥3 обращения одной категории по номеру за 30 дней (CARE-013)
    const since = new Date(Date.now() - 30 * 86_400_000);
    const recent = await this.issues
      .createQueryBuilder('i')
      .select('i.roomUnitId', 'unit')
      .addSelect('i.category', 'category')
      .addSelect('COUNT(*)::int', 'n')
      .where('i.tenantId = :tenantId AND i.hotelId = :hotelId AND i.createdAt >= :since AND i.roomUnitId IS NOT NULL', { tenantId, hotelId, since })
      .andWhere("i.status <> 'cancelled'")
      .groupBy('i.roomUnitId')
      .addGroupBy('i.category')
      .getRawMany<{ unit: string; category: string; n: number }>();
    const repeat = new Set(recent.filter((x) => x.n >= 3).map((x) => `${x.unit}:${x.category}`));
    return rows.map((i) => ({ ...i, repeated: !!i.roomUnitId && repeat.has(`${i.roomUnitId}:${i.category}`) }));
  }

  async createIssue(
    tenantId: string,
    dto: { hotelId: string; roomUnitId?: string | null; category?: string; priority?: string; description?: string; photoUrls?: string[]; makeOoo?: boolean; assigneeUserId?: string | null },
    actorUserId?: string | null,
  ) {
    const h = await this.hotel(tenantId, dto.hotelId);
    const description = String(dto.description || '').trim();
    if (!description) throw bad('HOTEL_ISSUE_DESCRIPTION_REQUIRED', 'Опишите неисправность');
    let unit: HotelRoomUnit | null = null;
    if (dto.roomUnitId) {
      unit = await this.unit(tenantId, dto.roomUnitId);
      if (unit.hotelId !== h.id) throw bad('HOTEL_HK_UNIT_NOT_FOUND', 'Номер не из этого отеля');
    }
    if (dto.makeOoo && !unit) throw bad('HOTEL_ISSUE_OOO_NEEDS_ROOM', 'Чтобы снять номер с продажи, выберите номер');
    const issue = await this.issues.save(this.issues.create({
      tenantId,
      hotelId: h.id,
      roomUnitId: unit?.id ?? null,
      category: (HOTEL_ISSUE_CATEGORIES as readonly string[]).includes(String(dto.category)) ? (dto.category as any) : 'other',
      priority: PRIORITIES.includes(String(dto.priority)) ? (dto.priority as HotelIssuePriority) : 'normal',
      description: description.slice(0, 4000),
      photoUrls: (dto.photoUrls || []).filter((u) => typeof u === 'string' && u.startsWith('/v1/uploads/')).slice(0, 10),
      reportedBy: actorUserId ?? null,
      assigneeUserId: dto.assigneeUserId || null,
      status: 'open',
    }));
    let conflicts: Array<{ id: string; guestName: string; checkIn: string; checkOut: string; status: string }> = [];
    if (dto.makeOoo && unit) {
      const r = await this.createOutage(tenantId, { roomUnitId: unit.id, kind: 'ooo', dateFrom: hotelToday(h), dateTo: null, reason: 'repair', note: description.slice(0, 200), issueId: issue.id }, actorUserId);
      issue.outageId = r.outage.id;
      conflicts = r.conflicts;
      await this.issues.save(issue);
    }
    return { issue, conflicts };
  }

  async updateIssue(tenantId: string, id: string, dto: { status?: HotelIssueStatus; priority?: string; assigneeUserId?: string | null; resolution?: string | null; category?: string }) {
    const i = await this.issues.findOne({ where: { id, tenantId } });
    if (!i) throw new NotFoundException('Неисправность не найдена');
    if (dto.priority && PRIORITIES.includes(dto.priority)) i.priority = dto.priority as HotelIssuePriority;
    if (dto.category && (HOTEL_ISSUE_CATEGORIES as readonly string[]).includes(dto.category)) i.category = dto.category as any;
    if (dto.assigneeUserId !== undefined) i.assigneeUserId = dto.assigneeUserId || null;
    if (dto.resolution !== undefined) i.resolution = String(dto.resolution || '').trim() || null;
    if (dto.status && ['open', 'in_progress', 'resolved', 'cancelled'].includes(dto.status) && dto.status !== i.status) {
      i.status = dto.status;
      if (dto.status === 'resolved' || dto.status === 'cancelled') {
        i.resolvedAt = new Date();
        // устранено — номер, снятый с продажи из-за этой неисправности, возвращается в строй
        if (i.outageId) {
          const o = await this.outages.findOne({ where: { id: i.outageId, tenantId } });
          if (o && (!o.dateTo || o.dateTo > hotelToday(await this.hotels.findOne({ where: { id: o.hotelId, tenantId } })))) await this.endOutage(tenantId, o.id);
        }
      } else {
        i.resolvedAt = null;
      }
    }
    return this.issues.save(i);
  }

  // ─── находки (PMS-105) ───
  async listLost(tenantId: string, hotelId: string, status?: string, search?: string) {
    await this.hotel(tenantId, hotelId);
    const qb = this.lost.createQueryBuilder('l').where('l.tenantId = :tenantId AND l.hotelId = :hotelId', { tenantId, hotelId });
    if (status) qb.andWhere('l.status = :status', { status });
    if (search) qb.andWhere('(l.description ILIKE :s OR l.guestName ILIKE :s OR l.storageLocation ILIKE :s)', { s: `%${search}%` });
    return qb.orderBy('l.foundAt', 'DESC').take(500).getMany();
  }

  /** Чья вещь: бронь, жившая в номере в день находки (последняя по дате выезда) */
  private async guessReservation(tenantId: string, unitId: string, foundDay: string) {
    return this.reservations
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.roomUnitId = :unitId', { tenantId, unitId })
      .andWhere("r.status IN ('checked_in','checked_out')")
      .andWhere('r.checkIn <= :d AND r.checkOut >= :back', { d: foundDay, back: addDays(foundDay, -1) })
      .orderBy('r.checkOut', 'DESC')
      .getOne();
  }

  async createLost(tenantId: string, dto: Partial<HotelLostFound> & { hotelId: string }, actorUserId?: string | null) {
    const h = await this.hotel(tenantId, dto.hotelId);
    const description = String(dto.description || '').trim();
    if (!description) throw bad('HOTEL_LOST_DESCRIPTION_REQUIRED', 'Опишите находку');
    const foundAt = dto.foundAt ? new Date(dto.foundAt as any) : new Date();
    if (Number.isNaN(foundAt.getTime())) throw bad('HOTEL_LOST_BAD_DATE', 'Неверная дата');
    let unitId: string | null = null;
    if (dto.roomUnitId) {
      const u = await this.unit(tenantId, dto.roomUnitId);
      if (u.hotelId !== h.id) throw bad('HOTEL_HK_UNIT_NOT_FOUND', 'Номер не из этого отеля');
      unitId = u.id;
    }
    let reservationId = dto.reservationId || null;
    let guestName = String(dto.guestName || '').trim() || null;
    if (reservationId) {
      const r = await this.reservations.findOne({ where: { id: reservationId, tenantId } });
      if (!r) reservationId = null;
      else guestName = guestName || r.guestName;
    } else if (unitId) {
      const r = await this.guessReservation(tenantId, unitId, foundAt.toISOString().slice(0, 10));
      if (r) {
        reservationId = r.id;
        guestName = guestName || r.guestName;
      }
    }
    return this.lost.save(this.lost.create({
      tenantId,
      hotelId: h.id,
      roomUnitId: unitId,
      reservationId,
      guestName,
      category: (HOTEL_LOST_CATEGORIES as readonly string[]).includes(String(dto.category)) ? (dto.category as any) : 'other',
      description: description.slice(0, 2000),
      foundPlace: String(dto.foundPlace || '').trim() || null,
      foundAt,
      foundBy: actorUserId ?? null,
      storageLocation: String(dto.storageLocation || '').trim() || null,
      photoUrls: (dto.photoUrls || []).filter((u) => typeof u === 'string' && u.startsWith('/v1/uploads/')).slice(0, 10),
      note: String(dto.note || '').trim() || null,
      status: 'stored',
    }));
  }

  async updateLost(tenantId: string, id: string, dto: Partial<HotelLostFound>) {
    const l = await this.lost.findOne({ where: { id, tenantId } });
    if (!l) throw new NotFoundException('Находка не найдена');
    for (const k of ['description', 'foundPlace', 'storageLocation', 'note', 'guestName', 'returnedTo'] as const) {
      if (dto[k] !== undefined) (l as any)[k] = String(dto[k] ?? '').trim() || (k === 'description' ? l.description : null);
    }
    if (dto.category && (HOTEL_LOST_CATEGORIES as readonly string[]).includes(dto.category)) l.category = dto.category;
    if (dto.status && ['stored', 'returned', 'disposed', 'handed_over'].includes(dto.status) && dto.status !== l.status) {
      if (dto.status === 'returned' && !l.returnedTo && !dto.returnedTo) throw bad('HOTEL_LOST_RETURNED_TO_REQUIRED', 'Укажите, кому выдана вещь');
      l.status = dto.status as HotelLostStatus;
      l.closedAt = dto.status === 'stored' ? null : new Date();
    }
    return this.lost.save(l);
  }

  async removeLost(tenantId: string, id: string) {
    await this.lost.delete({ id, tenantId });
    return { ok: true };
  }

  /** Письмо гостю «мы нашли вашу вещь» — с почты отеля (TenantMailService), на языке по стране гостя */
  async notifyLost(tenantId: string, id: string) {
    const l = await this.lost.findOne({ where: { id, tenantId } });
    if (!l) throw new NotFoundException('Находка не найдена');
    const r = l.reservationId ? await this.reservations.findOne({ where: { id: l.reservationId, tenantId } }) : null;
    if (!r?.guestEmail) throw bad('HOTEL_LOST_NO_EMAIL', 'У брони гостя нет email');
    const hotel = await this.hotels.findOne({ where: { id: l.hotelId, tenantId } });
    const c = String(r.guestCountry || '').toUpperCase();
    const lang = c === 'TR' ? 'tr' : ['RU', 'UA', 'BY', 'KZ', 'KG', 'UZ', 'AM', 'AZ', 'MD', 'TJ', 'TM', 'GE'].includes(c) ? 'ru' : 'en';
    const T = {
      ru: { s: `Мы нашли вашу вещь — ${hotel?.name || ''}`, h: `Здравствуйте, ${r.guestName}!`, b: `После вашего проживания в отеле «${esc(hotel?.name || '')}» мы нашли вещь: <b>${esc(l.description)}</b>. Она хранится у нас. Ответьте на это письмо, и мы договоримся, как её вернуть.` },
      en: { s: `We found your item — ${hotel?.name || ''}`, h: `Dear ${r.guestName},`, b: `After your stay at ${esc(hotel?.name || '')} we found an item: <b>${esc(l.description)}</b>. We are keeping it safe. Please reply to this email and we will arrange how to return it.` },
      tr: { s: `Eşyanızı bulduk — ${hotel?.name || ''}`, h: `Sayın ${r.guestName},`, b: `${esc(hotel?.name || '')} otelindeki konaklamanızın ardından bir eşya bulduk: <b>${esc(l.description)}</b>. Eşyanız bizde güvende. Bu e-postayı yanıtlayın, iadesini birlikte planlayalım.` },
    }[lang];
    await this.tenantMail.sendOrThrow(tenantId, { to: r.guestEmail, subject: T.s, html: `<p>${esc(T.h)}</p><p>${T.b}</p><p>${esc(hotel?.name || '')}</p>` });
    l.notifiedAt = new Date();
    await this.lost.save(l);
    return l;
  }
}

function esc(s: string) {
  return String(s || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}
