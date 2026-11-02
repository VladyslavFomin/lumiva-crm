import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BookingResource } from './booking-resource.entity';
import { Reservation, RESERVATION_ACTIVE_STATUSES } from './reservation.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { BookingsAvailabilityService } from './bookings-availability.service';
import { ReservationsService } from './reservations.service';
import { BookingsOrdersService } from './bookings-orders.service';
import { addDaysYmd, safeTimeZone, zonedParts, zonedToUtc, YMD_RE } from './booking-time.util';

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (n: number) => Math.round(n * 100) / 100;

/** Аренда/прокат: расчёт стоимости, график занятости пула, выдача и возврат с залогом. */
@Injectable()
export class BookingsRentalService {
  constructor(
    @InjectRepository(BookingResource) private readonly resources: Repository<BookingResource>,
    @InjectRepository(Reservation) private readonly reservationsRepo: Repository<Reservation>,
    private readonly projects: BookingsProjectsService,
    private readonly availability: BookingsAvailabilityService,
    private readonly reservations: ReservationsService,
    private readonly orders: BookingsOrdersService,
  ) {}

  async quote(tenantId: string, dto: { resourceId: string; startAt: string; endAt: string; units?: number; excludeReservationId?: string }) {
    const res = await this.resources.findOne({ where: { id: dto.resourceId, tenantId } });
    if (!res) throw new NotFoundException('Ресурс не найден');
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (!(startAt < endAt)) throw new BadRequestException('Окончание должно быть позже начала');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const units = Math.max(1, Number(dto.units) || 1);
    const q = this.orders.quoteRental(res, startAt, endAt, units, project.verticalSettings?.rentalUnit);
    const availability = await this.availability.checkConflict({ tenantId, resourceId: res.id, startAt, endAt, units, excludeReservationId: dto.excludeReservationId });
    const free = await this.freeUnits(tenantId, res, startAt, endAt, dto.excludeReservationId);
    return { ...q, currency: project.currency, available: availability.ok, reason: availability.reason || null, freeUnits: free, quantity: res.quantity };
  }

  private async freeUnits(tenantId: string, res: BookingResource, startAt: Date, endAt: Date, excludeId?: string) {
    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.units),0)', 'used')
      .where('r.tenantId = :tenantId AND r.resourceId = :rid', { tenantId, rid: res.id })
      .andWhere('r.status IN (:...st)', { st: RESERVATION_ACTIVE_STATUSES })
      .andWhere('r.startAt < :endAt AND r.endAt > :startAt', { startAt, endAt });
    if (excludeId) qb.andWhere('r.id != :ex', { ex: excludeId });
    const row = await qb.getRawOne<{ used: string }>();
    return Math.max(0, (res.quantity || 1) - Number(row?.used || 0));
  }

  /** Создать аренду: цена и залог считаются на сервере по тарифам ресурса. */
  async createRental(
    tenantId: string,
    dto: { resourceId: string; locationId?: string; startAt: string; endAt: string; units?: number; customerName?: string; customerPhone?: string; customerEmail?: string; notes?: string; source?: Reservation['source'] },
    actingStaffUserId: string | null,
  ) {
    const res = await this.resources.findOne({ where: { id: dto.resourceId, tenantId } });
    if (!res) throw new NotFoundException('Ресурс не найден');
    const q = await this.quote(tenantId, dto);
    if (!q.available) throw new BadRequestException(q.reason || 'Нет свободных единиц');
    const reservation = await this.reservations.create(
      tenantId,
      {
        locationId: dto.locationId || res.locationId,
        resourceId: res.id,
        startAt: dto.startAt,
        endAt: dto.endAt,
        units: Math.max(1, Number(dto.units) || 1),
        participants: 1,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        price: String(q.total),
        depositAmount: q.deposit || null,
        source: dto.source || 'manual',
        customFields: dto.notes ? { notes: dto.notes } : undefined,
      },
      actingStaffUserId,
    );
    return reservation;
  }

  /** Выдача клиенту: фиксируем состояние, залог (если берётся), бронь → «в аренде». */
  async issue(tenantId: string, id: string, dto: { conditionOut?: string; depositCollected?: boolean; depositAmount?: number | string }, actingStaffUserId: string | null) {
    const r = await this.reservations.findOne(tenantId, id);
    if (!r.resourceId) throw new BadRequestException('У брони нет ресурса');
    if (r.issuedAt) throw new BadRequestException('Уже выдано');
    if (!RESERVATION_ACTIVE_STATUSES.includes(r.status)) throw new BadRequestException('Бронь закрыта или отменена');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const deposit = dto.depositAmount !== undefined && dto.depositAmount !== '' ? money(num(dto.depositAmount)) : num(r.depositAmount);
    if (project.verticalSettings?.requireDeposit && deposit > 0 && dto.depositCollected === false) {
      throw new BadRequestException('По настройкам выдача только после внесения залога');
    }
    await this.reservationsRepo.update(
      { id, tenantId },
      {
        issuedAt: new Date(),
        conditionOut: dto.conditionOut?.trim() || null,
        depositAmount: deposit ? String(deposit) : null,
        depositStatus: deposit && dto.depositCollected !== false ? 'held' : 'none',
      },
    );
    await this.reservations.setStatus(tenantId, id, 'in_progress', actingStaffUserId, `Выдано клиенту${deposit && dto.depositCollected !== false ? `, залог ${deposit} ${r.currency || project.currency}` : ''}`);
    return this.reservations.findOne(tenantId, id);
  }

  /**
   * Возврат: состояние, штраф за просрочку (по % от тарифа за каждый просроченный час/сутки),
   * ущерб, судьба залога. Штрафы попадают отдельными строками в счёт аренды.
   */
  async returnItem(
    tenantId: string,
    id: string,
    dto: { conditionIn?: string; damageFee?: number | string; damageNote?: string; deposit?: 'return' | 'withhold' | 'partial'; withheldAmount?: number | string; waiveLateFee?: boolean },
    actingStaffUserId: string | null,
  ) {
    const r = await this.reservations.findOne(tenantId, id);
    if (!r.issuedAt) throw new BadRequestException('Ресурс ещё не выдан');
    if (r.returnedAt) throw new BadRequestException('Уже возвращено');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const res = r.resourceId ? await this.resources.findOne({ where: { id: r.resourceId, tenantId } }) : null;
    const now = new Date();
    const late = this.lateFee(r, res, now, project.verticalSettings);
    const lateFee = dto.waiveLateFee ? 0 : late.fee;
    const damage = Math.max(0, money(num(dto.damageFee)));

    let depositStatus = r.depositStatus;
    if (r.depositStatus === 'held') {
      if (dto.deposit === 'withhold') depositStatus = 'withheld';
      else if (dto.deposit === 'partial') depositStatus = 'partial';
      else depositStatus = 'returned';
    }
    await this.reservationsRepo.update(
      { id, tenantId },
      { returnedAt: now, conditionIn: dto.conditionIn?.trim() || null, lateFee: lateFee ? String(lateFee) : null, depositStatus },
    );

    if (lateFee > 0 || damage > 0) {
      // Есть незакрытый счёт аренды — штрафы туда. Счёт уже оплачен — отдельный счёт только
      // на штрафы (без повторной строки аренды). Счёта нет — обычный счёт аренды + штрафы.
      const existing = await this.orders.list(tenantId, { reservationId: r.id });
      const hasPaid = existing.some((o) => o.status === 'paid');
      const target = await this.orders.create(tenantId, { kind: 'rental', reservationId: r.id, prefillFromReservation: !hasPaid }, actingStaffUserId);
      if (lateFee > 0) await this.orders.addItem(tenantId, target.id, { kind: 'fee', name: `Просрочка возврата · ${late.label}`, unitPrice: lateFee, qty: 1 });
      if (damage > 0) await this.orders.addItem(tenantId, target.id, { kind: 'fee', name: `Ущерб${dto.damageNote ? ` · ${dto.damageNote}` : ''}`, unitPrice: damage, qty: 1 });
    }
    const depositNote =
      depositStatus === 'returned' ? ', залог возвращён' : depositStatus === 'withheld' ? ', залог удержан' : depositStatus === 'partial' ? `, залог удержан частично (${money(num(dto.withheldAmount))})` : '';
    await this.reservations.setStatus(tenantId, id, 'completed', actingStaffUserId, `Возвращено${late.periods ? `, просрочка ${late.label}` : ''}${depositNote}`);
    return { reservation: await this.reservations.findOne(tenantId, id), lateFee, damage };
  }

  lateFee(r: Reservation, res: BookingResource | null, now: Date, vs: { lateFeePercent?: number; rentalUnit?: 'hour' | 'day' } = {}) {
    const overMs = now.getTime() - r.endAt.getTime();
    if (overMs <= 15 * 60_000 || !res) return { periods: 0, fee: 0, label: '' }; // 15 мин льготы
    const pct = vs.lateFeePercent ?? 100;
    const perHour = res.pricePerHour != null ? num(res.pricePerHour) : null;
    const perDay = res.pricePerDay != null ? num(res.pricePerDay) : null;
    const byDay = (vs.rentalUnit === 'day' || perHour == null) && perDay != null;
    const periods = byDay ? Math.ceil(overMs / 86400_000) : Math.ceil(overMs / 3600_000);
    const rate = byDay ? perDay! : perHour ?? 0;
    return { periods, fee: money(periods * rate * (r.units || 1) * (pct / 100)), label: `${periods} ${byDay ? 'сут' : 'ч'}` };
  }

  /** Продлить аренду (с проверкой, что единицы свободны на продление). */
  async extend(tenantId: string, id: string, dto: { endAt: string }, actingStaffUserId: string | null) {
    const r = await this.reservations.findOne(tenantId, id);
    const endAt = new Date(dto.endAt);
    if (!(endAt > r.endAt)) throw new BadRequestException('Новое окончание должно быть позже текущего');
    const res = r.resourceId ? await this.resources.findOne({ where: { id: r.resourceId, tenantId } }) : null;
    if (!res) throw new BadRequestException('У брони нет ресурса');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const q = this.orders.quoteRental(res, r.startAt, endAt, r.units, project.verticalSettings?.rentalUnit);
    const updated = await this.reservations.update(tenantId, id, { endAt, price: String(q.total) } as any, actingStaffUserId);
    return updated;
  }

  /** Стойка выдачи на день: выдачи, возвраты, просрочки, что сейчас на руках. */
  async desk(tenantId: string, date?: string) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const tz = safeTimeZone(project.timezone);
    const ymd = date && YMD_RE.test(date) ? date : zonedParts(new Date(), tz).ymd;
    const dayStart = zonedToUtc(ymd, '00:00', tz);
    const dayEnd = new Date(dayStart.getTime() + 86400_000);
    const now = new Date();
    const base = () =>
      this.reservationsRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.resourceId IS NOT NULL', { tenantId })
        .andWhere('r.classSessionId IS NULL');
    const [pickups, returns, overdue, out] = await Promise.all([
      base().andWhere('r.issuedAt IS NULL AND r.status IN (:...st)', { st: ['pending', 'confirmed', 'checked_in'] }).andWhere('r.startAt >= :a AND r.startAt < :b', { a: dayStart, b: dayEnd }).orderBy('r.startAt', 'ASC').getMany(),
      base().andWhere('r.issuedAt IS NOT NULL AND r.returnedAt IS NULL').andWhere('r.endAt >= :a AND r.endAt < :b', { a: dayStart, b: dayEnd }).orderBy('r.endAt', 'ASC').getMany(),
      base().andWhere('r.issuedAt IS NOT NULL AND r.returnedAt IS NULL AND r.endAt < :now', { now }).orderBy('r.endAt', 'ASC').getMany(),
      base().andWhere('r.issuedAt IS NOT NULL AND r.returnedAt IS NULL').getMany(),
    ]);
    const resIds = [...new Set([...pickups, ...returns, ...overdue, ...out].map((r) => r.resourceId!))];
    const resources = resIds.length ? await this.resources.find({ where: { tenantId, id: In(resIds) } }) : [];
    const withLate = (r: Reservation) => ({ ...r, lateEstimate: this.lateFee(r, resources.find((x) => x.id === r.resourceId) || null, now, project.verticalSettings) });
    return {
      date: ymd,
      pickups,
      returns: returns.map(withLate),
      overdue: overdue.map(withLate),
      outNow: out.length,
      unitsOut: out.reduce((s, r) => s + (r.units || 1), 0),
      depositsHeld: money(out.filter((r) => r.depositStatus === 'held').reduce((s, r) => s + num(r.depositAmount), 0)),
      currency: project.currency,
      resources: resources.map((r) => ({ id: r.id, name: r.name, type: r.type })),
    };
  }

  /** График занятости: по каждому ресурсу и дню — сколько единиц занято из quantity. */
  async timeline(tenantId: string, dto: { from?: string; days?: number; locationId?: string }) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const tz = safeTimeZone(project.timezone);
    const from = dto.from && YMD_RE.test(dto.from) ? dto.from : zonedParts(new Date(), tz).ymd;
    const days = Math.min(62, Math.max(1, Number(dto.days) || 14));
    const where: any = { tenantId, active: true };
    if (dto.locationId) where.locationId = dto.locationId;
    const resources = (await this.resources.find({ where, order: { name: 'ASC' } })).filter((r) => r.type !== 'table');
    const start = zonedToUtc(from, '00:00', tz);
    const end = zonedToUtc(addDaysYmd(from, days), '00:00', tz);
    const ids = resources.map((r) => r.id);
    const rows = ids.length
      ? await this.reservationsRepo
          .createQueryBuilder('r')
          .where('r.tenantId = :tenantId AND r.resourceId IN (:...ids)', { tenantId, ids })
          .andWhere('r.status IN (:...st)', { st: [...RESERVATION_ACTIVE_STATUSES, 'completed'] })
          .andWhere('r.startAt < :end AND r.endAt > :start', { start, end })
          .getMany()
      : [];
    const dayList = Array.from({ length: days }, (_, i) => addDaysYmd(from, i));
    return {
      from,
      days: dayList,
      resources: resources.map((res) => {
        const mine = rows.filter((r) => r.resourceId === res.id);
        return {
          id: res.id,
          name: res.name,
          type: res.type,
          quantity: res.quantity,
          pricePerHour: res.pricePerHour,
          pricePerDay: res.pricePerDay,
          depositAmount: res.depositAmount,
          cells: dayList.map((d) => {
            const ds = zonedToUtc(d, '00:00', tz);
            const de = zonedToUtc(addDaysYmd(d, 1), '00:00', tz);
            const overlap = mine.filter((r) => r.startAt < de && r.endAt > ds && r.status !== 'completed');
            return { date: d, used: overlap.reduce((s, r) => s + (r.units || 1), 0), reservations: overlap.map((r) => ({ id: r.id, customerName: r.customerName, units: r.units, startAt: r.startAt, endAt: r.endAt, status: r.status, issuedAt: r.issuedAt })) };
          }),
        };
      }),
    };
  }
}
