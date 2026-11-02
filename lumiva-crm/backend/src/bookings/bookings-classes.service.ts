import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { BookingClassSession } from './booking-class-session.entity';
import { BookingService } from './booking-service.entity';
import { BookingResource } from './booking-resource.entity';
import { BookingLocation } from './booking-location.entity';
import { BookingWaitlistEntry } from './booking-waitlist-entry.entity';
import { Reservation, RESERVATION_ACTIVE_STATUSES } from './reservation.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { BookingsAvailabilityService } from './bookings-availability.service';
import { ReservationsService } from './reservations.service';
import { BookingsPassLedgerService } from './bookings-pass-ledger.service';
import { BookingPass } from './booking-pass.entity';
import { HM_RE, YMD_RE, WEEKDAY_KEYS, addDaysYmd, safeTimeZone, weekdayOfYmd, zonedParts, zonedToUtc } from './booking-time.util';

const CANCELLED = ['cancelled_by_customer', 'cancelled_by_business', 'rejected'];

export interface SessionInput {
  serviceId: string;
  locationId: string;
  staffUserId?: string | null;
  resourceId?: string | null;
  startAt?: string;
  durationMinutes?: number;
  capacity?: number;
  price?: string | number | null;
  level?: string | null;
  notes?: string | null;
}

/** Фитнес / пилатес: расписание групповых занятий, запись участников, ростер, лист ожидания. */
@Injectable()
export class BookingsClassesService {
  constructor(
    @InjectRepository(BookingClassSession) private readonly sessions: Repository<BookingClassSession>,
    @InjectRepository(BookingService) private readonly services: Repository<BookingService>,
    @InjectRepository(BookingResource) private readonly resources: Repository<BookingResource>,
    @InjectRepository(BookingLocation) private readonly locations: Repository<BookingLocation>,
    @InjectRepository(BookingWaitlistEntry) private readonly waitlist: Repository<BookingWaitlistEntry>,
    @InjectRepository(Reservation) private readonly reservationsRepo: Repository<Reservation>,
    @InjectRepository(StaffUser) private readonly staff: Repository<StaffUser>,
    @InjectRepository(BookingPass) private readonly passes: Repository<BookingPass>,
    private readonly projects: BookingsProjectsService,
    private readonly availability: BookingsAvailabilityService,
    private readonly reservations: ReservationsService,
    private readonly ledger: BookingsPassLedgerService,
  ) {}

  /* ---------- расписание ---------- */

  async list(tenantId: string, f: { from?: string; to?: string; locationId?: string; serviceId?: string; staffUserId?: string; includeCancelled?: boolean }) {
    const qb = this.sessions.createQueryBuilder('s').where('s.tenantId = :tenantId', { tenantId }).orderBy('s.startAt', 'ASC');
    if (f.from) qb.andWhere('s.startAt >= :from', { from: new Date(f.from) });
    if (f.to) qb.andWhere('s.startAt <= :to', { to: new Date(f.to) });
    if (f.locationId) qb.andWhere('s.locationId = :loc', { loc: f.locationId });
    if (f.serviceId) qb.andWhere('s.serviceId = :svc', { svc: f.serviceId });
    if (f.staffUserId) qb.andWhere('s.staffUserId = :st', { st: f.staffUserId });
    if (!f.includeCancelled) qb.andWhere('s.status != :c', { c: 'cancelled' });
    const rows = await qb.take(1000).getMany();
    return this.withCounts(tenantId, rows);
  }

  private async withCounts(tenantId: string, rows: BookingClassSession[]) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const counts = await this.reservationsRepo
      .createQueryBuilder('r')
      .select('r.classSessionId', 'sid')
      .addSelect(`COALESCE(SUM(CASE WHEN r.status IN (:...active) THEN r.participants ELSE 0 END),0)`, 'booked')
      .addSelect(`COALESCE(SUM(CASE WHEN r.status IN ('checked_in','in_progress','completed') THEN r.participants ELSE 0 END),0)`, 'attended')
      .addSelect(`COALESCE(SUM(CASE WHEN r.status = 'no_show' THEN r.participants ELSE 0 END),0)`, 'noShow')
      .where('r.tenantId = :tenantId AND r.classSessionId IN (:...ids)', { tenantId, ids, active: ['draft', 'pending', 'confirmed'] })
      .groupBy('r.classSessionId')
      .getRawMany<{ sid: string; booked: string; attended: string; noShow: string }>();
    const wl = await this.waitlist
      .createQueryBuilder('w')
      .select('w.classSessionId', 'sid')
      .addSelect('COUNT(*)', 'cnt')
      .where('w.tenantId = :tenantId AND w.classSessionId IN (:...ids) AND w.status = :st', { tenantId, ids, st: 'waiting' })
      .groupBy('w.classSessionId')
      .getRawMany<{ sid: string; cnt: string }>();
    return rows.map((r) => {
      const c = counts.find((x) => x.sid === r.id);
      // посещённые тоже занимают место (занятие идёт / прошло)
      const booked = Number(c?.booked || 0) + Number(c?.attended || 0) + Number(c?.noShow || 0);
      return {
        ...r,
        booked,
        attended: Number(c?.attended || 0),
        noShow: Number(c?.noShow || 0),
        waitlist: Number(wl.find((x) => x.sid === r.id)?.cnt || 0),
        spotsLeft: Math.max(0, r.capacity - booked),
      };
    });
  }

  async get(tenantId: string, id: string) {
    const s = await this.sessions.findOne({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Занятие не найдено');
    return (await this.withCounts(tenantId, [s]))[0];
  }

  private async validateSessionRefs(tenantId: string, dto: SessionInput) {
    const svc = await this.services.findOne({ where: { id: dto.serviceId, tenantId } });
    if (!svc) throw new BadRequestException('Направление не найдено');
    if (!(await this.locations.exists({ where: { id: dto.locationId, tenantId } }))) throw new BadRequestException('Локация не найдена');
    if (dto.staffUserId && !(await this.staff.exists({ where: { id: dto.staffUserId, tenantId } }))) throw new BadRequestException('Тренер не найден');
    if (dto.resourceId && !(await this.resources.exists({ where: { id: dto.resourceId, tenantId } }))) throw new BadRequestException('Зал не найден');
    return svc;
  }

  /** Тренер и зал не могут вести два занятия одновременно (и не заняты обычными бронями). */
  private async checkSessionConflict(tenantId: string, s: { staffUserId?: string | null; resourceId?: string | null; startAt: Date; endAt: Date }, excludeId?: string) {
    const qb = this.sessions
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId AND s.status != :c', { tenantId, c: 'cancelled' })
      .andWhere('s.startAt < :endAt AND s.endAt > :startAt', { startAt: s.startAt, endAt: s.endAt });
    if (excludeId) qb.andWhere('s.id != :ex', { ex: excludeId });
    if (s.staffUserId) {
      const hit = await qb.clone().andWhere('s.staffUserId = :st', { st: s.staffUserId }).getOne();
      if (hit) return 'Тренер уже ведёт другое занятие в это время';
    }
    if (s.resourceId) {
      const hit = await qb.clone().andWhere('s.resourceId = :r', { r: s.resourceId }).getOne();
      if (hit) return 'Зал уже занят другим занятием';
    }
    const c = await this.availability.checkConflict({ tenantId, staffUserId: s.staffUserId, resourceId: s.resourceId, startAt: s.startAt, endAt: s.endAt, excludeClassSessionId: excludeId });
    if (!c.ok) return c.reason || 'Конфликт расписания';
    return null;
  }

  async create(tenantId: string, dto: SessionInput) {
    if (!dto.startAt) throw new BadRequestException('Укажите время начала');
    const svc = await this.validateSessionRefs(tenantId, dto);
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime())) throw new BadRequestException('Некорректное время');
    const duration = Math.max(10, Number(dto.durationMinutes) || svc.durationMinutes || 60);
    const endAt = new Date(startAt.getTime() + duration * 60_000);
    const conflict = await this.checkSessionConflict(tenantId, { ...dto, startAt, endAt });
    if (conflict) throw new BadRequestException(conflict);
    const saved = await this.sessions.save(
      this.sessions.create({
        tenantId,
        projectId: project.id,
        serviceId: svc.id,
        locationId: dto.locationId,
        staffUserId: dto.staffUserId || null,
        resourceId: dto.resourceId || null,
        startAt,
        endAt,
        capacity: Math.max(1, Number(dto.capacity) || svc.capacityMax || project.verticalSettings?.defaultClassCapacity || 10),
        price: dto.price != null && dto.price !== '' ? String(dto.price) : null,
        level: dto.level || null,
        notes: dto.notes || null,
      }),
    );
    return this.get(tenantId, saved.id);
  }

  /**
   * Серия по дням недели: «Пн/Ср/Пт 19:00 на 8 недель». Время — местное время студии.
   * Занятия, которые конфликтуют (тренер/зал заняты), пропускаются и возвращаются списком.
   */
  async createSeries(tenantId: string, dto: SessionInput & { days: string[]; time: string; fromDate: string; weeks: number }) {
    if (!Array.isArray(dto.days) || !dto.days.length) throw new BadRequestException('Выберите дни недели');
    if (!HM_RE.test(dto.time || '')) throw new BadRequestException('Время в формате ЧЧ:ММ');
    if (!YMD_RE.test(dto.fromDate || '')) throw new BadRequestException('Дата начала в формате ГГГГ-ММ-ДД');
    const weeks = Math.min(26, Math.max(1, Number(dto.weeks) || 4));
    const days = dto.days.filter((d) => (WEEKDAY_KEYS as readonly string[]).includes(d));
    const svc = await this.validateSessionRefs(tenantId, dto);
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const tz = safeTimeZone(project.timezone);
    const duration = Math.max(10, Number(dto.durationMinutes) || svc.durationMinutes || 60);
    const seriesId = randomUUID();
    const created: string[] = [];
    const skipped: Array<{ date: string; reason: string }> = [];
    for (let i = 0; i < weeks * 7; i++) {
      const ymd = addDaysYmd(dto.fromDate, i);
      if (!days.includes(weekdayOfYmd(ymd))) continue;
      const startAt = zonedToUtc(ymd, dto.time, tz);
      if (startAt.getTime() < Date.now() - 60_000) {
        skipped.push({ date: ymd, reason: 'Прошедшая дата' });
        continue;
      }
      const endAt = new Date(startAt.getTime() + duration * 60_000);
      const conflict = await this.checkSessionConflict(tenantId, { ...dto, startAt, endAt });
      if (conflict) {
        skipped.push({ date: ymd, reason: conflict });
        continue;
      }
      const s = await this.sessions.save(
        this.sessions.create({
          tenantId,
          projectId: project.id,
          serviceId: svc.id,
          locationId: dto.locationId,
          staffUserId: dto.staffUserId || null,
          resourceId: dto.resourceId || null,
          startAt,
          endAt,
          capacity: Math.max(1, Number(dto.capacity) || svc.capacityMax || project.verticalSettings?.defaultClassCapacity || 10),
          price: dto.price != null && dto.price !== '' ? String(dto.price) : null,
          level: dto.level || null,
          notes: dto.notes || null,
          seriesId,
        }),
      );
      created.push(s.id);
    }
    return { seriesId, created: created.length, skipped };
  }

  /** scope: one — только это занятие; future — это и все следующие занятия серии. */
  async update(tenantId: string, id: string, dto: Partial<SessionInput> & { scope?: 'one' | 'future' }) {
    const base = await this.sessions.findOne({ where: { id, tenantId } });
    if (!base) throw new NotFoundException('Занятие не найдено');
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const tz = safeTimeZone(project.timezone);
    const targets =
      dto.scope === 'future' && base.seriesId
        ? await this.sessions
            .createQueryBuilder('s')
            .where('s.tenantId = :tenantId AND s.seriesId = :sid AND s.startAt >= :from AND s.status = :st', { tenantId, sid: base.seriesId, from: base.startAt, st: 'scheduled' })
            .getMany()
        : [base];
    if (dto.staffUserId && !(await this.staff.exists({ where: { id: dto.staffUserId, tenantId } }))) throw new BadRequestException('Тренер не найден');
    if (dto.resourceId && !(await this.resources.exists({ where: { id: dto.resourceId, tenantId } }))) throw new BadRequestException('Зал не найден');
    // смещение времени задаём как новое местное время начала — применяем ко всем занятиям серии
    let newHm: string | null = null;
    if (dto.startAt) newHm = zonedParts(new Date(dto.startAt), tz).hm;
    const errors: string[] = [];
    for (const s of targets) {
      const next = { ...s };
      if (dto.staffUserId !== undefined) next.staffUserId = dto.staffUserId || null;
      if (dto.resourceId !== undefined) next.resourceId = dto.resourceId || null;
      if (dto.capacity !== undefined) {
        const booked = (await this.withCounts(tenantId, [s]))[0].booked;
        const cap = Math.max(1, Number(dto.capacity) || s.capacity);
        if (cap < booked) {
          errors.push(`${zonedParts(s.startAt, tz).ymd}: записано ${booked}, нельзя уменьшить до ${cap}`);
          continue;
        }
        next.capacity = cap;
      }
      if (dto.price !== undefined) next.price = dto.price != null && dto.price !== '' ? String(dto.price) : null;
      if (dto.level !== undefined) next.level = dto.level || null;
      if (dto.notes !== undefined) next.notes = dto.notes || null;
      const duration = dto.durationMinutes ? Math.max(10, Number(dto.durationMinutes)) : (s.endAt.getTime() - s.startAt.getTime()) / 60_000;
      if (s === base && dto.startAt) next.startAt = new Date(dto.startAt);
      else if (newHm) next.startAt = zonedToUtc(zonedParts(s.startAt, tz).ymd, newHm, tz);
      next.endAt = new Date(next.startAt.getTime() + duration * 60_000);
      const timeOrPeopleChanged =
        next.startAt.getTime() !== s.startAt.getTime() || next.endAt.getTime() !== s.endAt.getTime() || next.staffUserId !== s.staffUserId || next.resourceId !== s.resourceId;
      if (timeOrPeopleChanged) {
        const conflict = await this.checkSessionConflict(tenantId, next, s.id);
        if (conflict) {
          errors.push(`${zonedParts(s.startAt, tz).ymd}: ${conflict}`);
          continue;
        }
      }
      await this.sessions.save(next);
      if (next.startAt.getTime() !== s.startAt.getTime() || next.endAt.getTime() !== s.endAt.getTime()) {
        const enrolled = await this.reservationsRepo.find({ where: { tenantId, classSessionId: s.id, status: In(RESERVATION_ACTIVE_STATUSES) } });
        for (const r of enrolled) {
          await this.reservations.update(tenantId, r.id, { startAt: next.startAt, endAt: next.endAt } as any, null).catch(() => undefined);
        }
      }
    }
    return { updated: targets.length - errors.length, errors, session: await this.get(tenantId, id) };
  }

  /** Отмена занятия: все записи отменяются бизнесом (посещения возвращаются на абонементы). */
  async cancel(tenantId: string, id: string, actingStaffUserId: string | null, scope: 'one' | 'future' = 'one') {
    const base = await this.sessions.findOne({ where: { id, tenantId } });
    if (!base) throw new NotFoundException('Занятие не найдено');
    const targets =
      scope === 'future' && base.seriesId
        ? await this.sessions
            .createQueryBuilder('s')
            .where('s.tenantId = :tenantId AND s.seriesId = :sid AND s.startAt >= :from AND s.status = :st', { tenantId, sid: base.seriesId, from: base.startAt, st: 'scheduled' })
            .getMany()
        : [base];
    let cancelledBookings = 0;
    for (const s of targets) {
      const enrolled = await this.reservationsRepo.find({ where: { tenantId, classSessionId: s.id, status: In(RESERVATION_ACTIVE_STATUSES) } });
      for (const r of enrolled) {
        await this.reservations.cancelByBusiness(tenantId, r.id, actingStaffUserId);
        cancelledBookings++;
      }
      await this.waitlist.update({ tenantId, classSessionId: s.id, status: 'waiting' }, { status: 'removed' });
      s.status = 'cancelled';
      await this.sessions.save(s);
    }
    return { cancelledSessions: targets.length, cancelledBookings };
  }

  /** Завершить занятие: кто отмечен — «посетил», остальные записанные — неявка. */
  async complete(tenantId: string, id: string, actingStaffUserId: string | null) {
    const s = await this.sessions.findOne({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Занятие не найдено');
    const enrolled = await this.reservationsRepo.find({ where: { tenantId, classSessionId: id, status: In(RESERVATION_ACTIVE_STATUSES) } });
    let attended = 0;
    let noShow = 0;
    for (const r of enrolled) {
      if (r.status === 'checked_in' || r.status === 'in_progress') {
        await this.reservations.complete(tenantId, r.id, actingStaffUserId);
        attended++;
      } else {
        await this.reservations.markNoShow(tenantId, r.id, actingStaffUserId);
        noShow++;
      }
    }
    await this.waitlist.update({ tenantId, classSessionId: id, status: 'waiting' }, { status: 'expired' });
    s.status = 'completed';
    await this.sessions.save(s);
    return { attended, noShow };
  }

  /* ---------- участники ---------- */

  async roster(tenantId: string, id: string) {
    const session = await this.get(tenantId, id);
    const [bookings, queue] = await Promise.all([
      this.reservationsRepo.find({ where: { tenantId, classSessionId: id }, order: { createdAt: 'ASC' } }),
      this.waitlist.find({ where: { tenantId, classSessionId: id, status: In(['waiting', 'offer']) }, order: { createdAt: 'ASC' } }),
    ]);
    const passIds = bookings.map((b) => b.passId).filter(Boolean) as string[];
    const passes = passIds.length ? await this.passes.find({ where: { tenantId, id: In(passIds) } }) : [];
    return {
      session,
      bookings: bookings.map((b) => {
        const p = passes.find((x) => x.id === b.passId);
        return {
          ...b,
          pass: p ? { id: p.id, number: p.number, planName: p.planName, kind: p.kind, visitsTotal: p.visitsTotal, visitsUsed: p.visitsUsed, expiresAt: p.expiresAt } : null,
        };
      }),
      waitlist: queue,
    };
  }

  /**
   * Записать клиента. Если мест нет — в лист ожидания этого занятия (waitlistIfFull).
   * Абонемент: переданный passId или автоматически подходящий активный абонемент клиента.
   */
  async enroll(
    tenantId: string,
    id: string,
    dto: { customerName?: string; customerPhone?: string; customerEmail?: string; participants?: number; passId?: string | null; usePass?: boolean; waitlistIfFull?: boolean; source?: Reservation['source']; leadId?: string },
    actingStaffUserId: string | null,
  ) {
    const s = await this.get(tenantId, id);
    if (s.status !== 'scheduled') throw new BadRequestException('Запись на это занятие закрыта');
    if (s.endAt.getTime() < Date.now()) throw new BadRequestException('Занятие уже прошло');
    if (!dto.customerName?.trim() && !dto.customerPhone?.trim() && !dto.customerEmail?.trim()) {
      throw new BadRequestException('Укажите имя или контакт клиента');
    }
    const participants = Math.max(1, Number(dto.participants) || 1);
    const { contactId, leadId } = await this.reservations.resolveLeadAndContact(tenantId, {
      name: dto.customerName,
      phone: dto.customerPhone,
      email: dto.customerEmail,
    });
    const already = await this.reservationsRepo.findOne({
      where: { tenantId, classSessionId: id, contactId, status: In(RESERVATION_ACTIVE_STATUSES) },
    });
    if (already) throw new BadRequestException('Клиент уже записан на это занятие');

    if (s.spotsLeft < participants) {
      if (!dto.waitlistIfFull) throw new BadRequestException(`Мест нет (свободно ${s.spotsLeft})`);
      const project = await this.projects.getOrCreateDefaultProject(tenantId);
      const entry = await this.waitlist.save(
        this.waitlist.create({
          tenantId,
          projectId: project.id,
          locationId: s.locationId,
          serviceId: s.serviceId,
          classSessionId: s.id,
          preferredStaffUserId: s.staffUserId,
          leadId,
          contactId,
          customerName: dto.customerName || null,
          customerPhone: dto.customerPhone || null,
          customerEmail: dto.customerEmail || null,
          participants,
          priority: 'normal',
          status: 'waiting',
        }),
      );
      return { waitlisted: true, entry };
    }

    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const onDate = zonedParts(s.startAt, safeTimeZone(project.timezone)).ymd;
    let passId: string | null = null;
    if (dto.passId) {
      const p = await this.passes.findOne({ where: { id: dto.passId, tenantId } });
      if (!p) throw new BadRequestException('Абонемент не найден');
      this.ledger.normalize(p, onDate);
      if (!this.ledger.isUsableFor(p, s.serviceId, onDate)) throw new BadRequestException(`Абонемент №${p.number} не действует на это занятие`);
      passId = p.id;
    } else if (dto.usePass !== false) {
      passId = (await this.ledger.findUsable(tenantId, contactId, s.serviceId, onDate))?.id || null;
    }
    const svc = await this.services.findOne({ where: { id: s.serviceId, tenantId } });
    const price = passId ? '0' : s.price ?? svc?.price ?? null;
    const reservation = await this.reservations.create(
      tenantId,
      {
        locationId: s.locationId,
        serviceId: s.serviceId,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
        participants,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        source: dto.source || 'manual',
        price: price != null ? String(Number(price) * participants) : undefined,
        classSessionId: s.id,
        passId: passId || undefined,
        leadId: dto.leadId || leadId,
      },
      actingStaffUserId,
    );
    if (passId) await this.reservationsRepo.update({ id: reservation.id, tenantId }, { paymentStatus: 'paid' });
    return { waitlisted: false, reservation: await this.reservations.findOne(tenantId, reservation.id) };
  }

  /** Отмена записи участника + автозапись первого из листа ожидания на освободившееся место. */
  async cancelEnrollment(tenantId: string, reservationId: string, byCustomer: boolean, actingStaffUserId: string | null) {
    const r = await this.reservations.findOne(tenantId, reservationId);
    if (!r.classSessionId) throw new BadRequestException('Это не запись на занятие');
    if (CANCELLED.includes(r.status)) return { promoted: null };
    if (byCustomer) await this.reservations.cancelByCustomer(tenantId, r.id);
    else await this.reservations.cancelByBusiness(tenantId, r.id, actingStaffUserId);
    const promoted = await this.promoteFromWaitlist(tenantId, r.classSessionId, actingStaffUserId);
    return { promoted };
  }

  async promoteFromWaitlist(tenantId: string, sessionId: string, actingStaffUserId: string | null) {
    const s = await this.get(tenantId, sessionId);
    if (s.status !== 'scheduled' || s.startAt.getTime() < Date.now()) return null;
    const queue = await this.waitlist.find({ where: { tenantId, classSessionId: sessionId, status: 'waiting' }, order: { createdAt: 'ASC' } });
    // VIP/high вперёд, внутри приоритета — по времени постановки
    const rank = { vip: 0, high: 1, normal: 2 } as Record<string, number>;
    queue.sort((a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2) || a.createdAt.getTime() - b.createdAt.getTime());
    const next = queue.find((q) => q.participants <= s.spotsLeft);
    if (!next) return null;
    const res = await this.enroll(
      tenantId,
      sessionId,
      { customerName: next.customerName || undefined, customerPhone: next.customerPhone || undefined, customerEmail: next.customerEmail || undefined, participants: next.participants, leadId: next.leadId || undefined },
      actingStaffUserId,
    );
    if (!res.waitlisted && res.reservation) {
      next.status = 'confirmed';
      next.convertedReservationId = res.reservation.id;
      await this.waitlist.save(next);
      await this.reservations.log(tenantId, res.reservation.id, actingStaffUserId, 'Автоматически записан из листа ожидания');
      return res.reservation;
    }
    return null;
  }

  async removeFromWaitlist(tenantId: string, entryId: string) {
    const e = await this.waitlist.findOne({ where: { id: entryId, tenantId } });
    if (!e) throw new NotFoundException('Запись листа ожидания не найдена');
    e.status = 'removed';
    return this.waitlist.save(e);
  }

  /** Отметка посещения из ростера. */
  async mark(tenantId: string, reservationId: string, mark: 'attended' | 'no_show' | 'reset', actingStaffUserId: string | null) {
    const r = await this.reservations.findOne(tenantId, reservationId);
    if (!r.classSessionId) throw new BadRequestException('Это не запись на занятие');
    if (mark === 'attended') return this.reservations.checkIn(tenantId, r.id, actingStaffUserId);
    if (mark === 'no_show') return this.reservations.markNoShow(tenantId, r.id, actingStaffUserId);
    return this.reservations.confirm(tenantId, r.id, actingStaffUserId);
  }

  /** Сводка для обзора: занятия сегодня, заполняемость, посещаемость за 30 дней. */
  async stats(tenantId: string) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const tz = safeTimeZone(project.timezone);
    const today = zonedParts(new Date(), tz).ymd;
    const dayStart = zonedToUtc(today, '00:00', tz);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600_000);
    const todayList = await this.list(tenantId, { from: dayStart.toISOString(), to: dayEnd.toISOString() });
    const past = await this.list(tenantId, { from: monthAgo.toISOString(), to: new Date().toISOString() });
    const capPast = past.reduce((s, x) => s + x.capacity, 0);
    const bookedPast = past.reduce((s, x) => s + x.booked, 0);
    const attendedPast = past.reduce((s, x) => s + x.attended, 0);
    const noShowPast = past.reduce((s, x) => s + x.noShow, 0);
    return {
      today: todayList,
      classesToday: todayList.length,
      spotsToday: todayList.reduce((s, x) => s + x.capacity, 0),
      bookedToday: todayList.reduce((s, x) => s + x.booked, 0),
      waitlistToday: todayList.reduce((s, x) => s + x.waitlist, 0),
      fillRate30: capPast ? Math.round((bookedPast / capPast) * 1000) / 10 : 0,
      attendanceRate30: attendedPast + noShowPast ? Math.round((attendedPast / (attendedPast + noShowPast)) * 1000) / 10 : 0,
      classes30: past.length,
    };
  }
}
