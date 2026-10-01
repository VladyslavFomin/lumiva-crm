// src/bookings/bookings-ai.service.ts
//
// Запись клиентов ИИ-консультантом (WhatsApp / Telegram / онлайн-чат сайта) в модуль «Бронирования».
// Всё, что ИИ говорит клиенту о свободном времени и о записи, опирается только на этот сервис:
//  - свободные слоты считаются в поясе салона по часам работы локации (+ «особые даты»),
//    графику/отпускам мастеров, уже занятым броням (с буферами), ресурсам и правилам проекта;
//  - бронь создаётся обычным ReservationsService.create (те же проверки, автоматизации, лид);
//  - отмена/перенос — только своих броней клиента и с учётом дедлайнов проекта.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThan, MoreThan, Repository } from 'typeorm';

import { Reservation, RESERVATION_ACTIVE_STATUSES, ReservationSource } from './reservation.entity';
import { BookingService } from './booking-service.entity';
import { BookingLocation, BookingWorkingHoursPeriod } from './booking-location.entity';
import { BookingResource } from './booking-resource.entity';
import { BookingStaffProfile } from './booking-staff-profile.entity';
import { BookingProject } from './booking-project.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { BookingsAvailabilityService } from './bookings-availability.service';
import { ReservationsService } from './reservations.service';
import {
  addDaysYmd,
  HM_RE,
  hmToMinutes,
  minutesToHm,
  safeTimeZone,
  weekdayOfYmd,
  YMD_RE,
  zonedParts,
  zonedToUtc,
} from './booking-time.util';

/** Локация без заданных часов работы — считаем, что работает 09:00–20:00 (как сценарий Telegram-бота). */
const DEFAULT_HOURS: BookingWorkingHoursPeriod[] = [{ start: '09:00', end: '20:00' }];
/** Защита от накрутки: столько будущих броней ИИ может создать одному клиенту за сутки. */
const MAX_AI_BOOKINGS_PER_CLIENT_DAY = 3;
const CANCELLABLE = ['draft', 'pending', 'confirmed'];

export type AiBookingOwner = { leadId?: string | null; phone?: string | null };

export type AiBookingFailReason =
  | 'not_configured'
  | 'unknown_service'
  | 'unknown_master'
  | 'bad_datetime'
  | 'too_soon'
  | 'too_far'
  | 'closed'
  | 'busy'
  | 'no_resource'
  | 'missing_contact'
  | 'limit'
  | 'not_found'
  | 'not_active'
  | 'deadline'
  | 'error';

export interface AiBookingServiceInfo {
  id: string;
  name: string;
  category: string | null;
  minutes: number;
  price: number;
  currency: string;
  staff: Array<{ id: string; name: string }>;
}

export interface AiBookingCatalog {
  ready: boolean;
  reason?: string;
  timezone: string;
  nowLocal: string;
  confirmationMode: 'auto' | 'manual';
  cancellationDeadlineHours: number;
  rescheduleDeadlineHours: number;
  services: AiBookingServiceInfo[];
}

export interface AiBookingSlot {
  start: string; // YYYY-MM-DD HH:mm (местное время салона)
  weekday: string;
  master?: string;
}

type Ctx = {
  tenantId: string;
  project: BookingProject;
  tz: string;
  locations: BookingLocation[];
  services: BookingService[];
  profiles: Map<string, BookingStaffProfile>;
  staff: Map<string, StaffUser>;
  resources: BookingResource[];
};

type Busy = Pick<Reservation, 'id' | 'staffUserId' | 'resourceId' | 'serviceId' | 'startAt' | 'endAt'>;

type FreeCheck = { ok: true; staffUserId: string | null; resourceId: string | null } | { ok: false; reason: AiBookingFailReason };

const WEEKDAY_LABEL: Record<string, string> = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };

@Injectable()
export class BookingsAiService {
  constructor(
    @InjectRepository(Reservation) private readonly reservationsRepo: Repository<Reservation>,
    @InjectRepository(BookingService) private readonly servicesRepo: Repository<BookingService>,
    @InjectRepository(BookingLocation) private readonly locationsRepo: Repository<BookingLocation>,
    @InjectRepository(BookingResource) private readonly resourcesRepo: Repository<BookingResource>,
    @InjectRepository(BookingStaffProfile) private readonly profilesRepo: Repository<BookingStaffProfile>,
    @InjectRepository(StaffUser) private readonly staffRepo: Repository<StaffUser>,
    private readonly projects: BookingsProjectsService,
    private readonly availability: BookingsAvailabilityService,
    private readonly reservations: ReservationsService,
  ) {}

  // ------------------------------------------------------------------ контекст

  private async ctx(tenantId: string): Promise<Ctx> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const [locations, services, profiles, staff, resources] = await Promise.all([
      this.locationsRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } }),
      this.servicesRepo.find({ where: { tenantId, active: true }, order: { name: 'ASC' } }),
      this.profilesRepo.find({ where: { tenantId } }),
      this.staffRepo.find({ where: { tenantId, isActive: true } }),
      this.resourcesRepo.find({ where: { tenantId, active: true } }),
    ]);
    return {
      tenantId,
      project,
      tz: safeTimeZone(project.timezone),
      locations: locations.filter((l) => (l.status || 'active') === 'active'),
      services,
      profiles: new Map(profiles.map((p) => [p.staffUserId, p])),
      staff: new Map(staff.map((s) => [s.id, s])),
      resources,
    };
  }

  private staffFor(ctx: Ctx, svc: BookingService): Array<{ id: string; name: string }> {
    const ids = svc.staffUserIds?.length
      ? svc.staffUserIds
      : [...ctx.profiles.values()].filter((p) => p.availableForBooking && (p.assignedServiceIds || []).includes(svc.id)).map((p) => p.staffUserId);
    const out: Array<{ id: string; name: string }> = [];
    for (const id of new Set(ids)) {
      const su = ctx.staff.get(id);
      const prof = ctx.profiles.get(id);
      if (!su || (prof && !prof.availableForBooking)) continue;
      out.push({ id, name: su.fullName || 'Specialist' });
    }
    return out;
  }

  private locationFor(ctx: Ctx, svc: BookingService): BookingLocation | null {
    if (svc.locationIds?.length) return ctx.locations.find((l) => svc.locationIds.includes(l.id)) || null;
    return ctx.locations[0] || null;
  }

  private tzOf(ctx: Ctx, loc: BookingLocation | null): string {
    return safeTimeZone(loc?.timezone || ctx.tz);
  }

  private dayWindows(loc: BookingLocation, ymd: string): BookingWorkingHoursPeriod[] {
    const closure = (loc.closures || []).find((c) => String(c.date || '').slice(0, 10) === ymd);
    if (closure) return closure.customHours?.length ? closure.customHours : [];
    const wh = loc.workingHours;
    if (wh && Object.values(wh).some((v) => Array.isArray(v) && v.length)) return wh[weekdayOfYmd(ymd)] || [];
    return DEFAULT_HOURS;
  }

  private nowLocal(tz: string): string {
    const p = zonedParts(new Date(), tz);
    return `${p.ymd} ${p.hm} (${WEEKDAY_LABEL[p.weekday]})`;
  }

  // ------------------------------------------------------------------ каталог для промпта

  /** Что ИИ может предлагать: активные услуги (в пределах разрешённых), их мастера, пояс, правила. */
  async catalog(tenantId: string, allowedServiceIds?: string[] | null): Promise<AiBookingCatalog> {
    const ctx = await this.ctx(tenantId);
    const allowed = allowedServiceIds?.length ? new Set(allowedServiceIds) : null;
    const services = ctx.services
      .filter((s) => !allowed || allowed.has(s.id))
      .filter((s) => !!this.locationFor(ctx, s))
      .map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        minutes: Number(s.durationMinutes) || 60,
        price: Number(s.price) || 0,
        currency: String(s.currency || ctx.project.currency || '').trim(),
        staff: this.staffFor(ctx, s),
      }));
    let reason: string | undefined;
    if (!ctx.locations.length) reason = 'no_locations';
    else if (!services.length) reason = 'no_services';
    return {
      ready: !reason,
      reason,
      timezone: ctx.tz,
      nowLocal: this.nowLocal(ctx.tz),
      confirmationMode: ctx.project.confirmationMode === 'auto' ? 'auto' : 'manual',
      cancellationDeadlineHours: Number(ctx.project.cancellationDeadlineHours) || 0,
      rescheduleDeadlineHours: Number(ctx.project.rescheduleDeadlineHours) || 0,
      services,
    };
  }

  // ------------------------------------------------------------------ проверка слота

  private async loadBusy(tenantId: string, from: Date, to: Date): Promise<Busy[]> {
    return this.reservationsRepo.find({
      select: ['id', 'staffUserId', 'resourceId', 'serviceId', 'startAt', 'endAt'],
      where: {
        tenantId,
        status: In(RESERVATION_ACTIVE_STATUSES),
        startAt: LessThan(new Date(to.getTime() + 86_400_000)),
        endAt: MoreThan(new Date(from.getTime() - 86_400_000)),
      },
    });
  }

  private async checkFree(
    ctx: Ctx,
    svc: BookingService,
    loc: BookingLocation,
    staffList: Array<{ id: string; name: string }>,
    start: Date,
    end: Date,
    busy: Busy[],
    excludeId?: string,
  ): Promise<FreeCheck> {
    const tz = this.tzOf(ctx, loc);
    const now = Date.now();
    const minNotice = (svc.minNoticeMinutes ?? ctx.project.minNoticeMinutes ?? 0) * 60_000;
    if (start.getTime() - now < minNotice) return { ok: false, reason: 'too_soon' };
    if (start.getTime() - now > (ctx.project.maxAdvanceDays || 60) * 86_400_000) return { ok: false, reason: 'too_far' };

    const sp = zonedParts(start, tz);
    const ep = zonedParts(end, tz);
    const endMin = ep.ymd === sp.ymd ? ep.minutes : 24 * 60 + ep.minutes;
    const windows = this.dayWindows(loc, sp.ymd);
    if (!windows.some((w) => sp.minutes >= hmToMinutes(w.start) && endMin <= hmToMinutes(w.end))) return { ok: false, reason: 'closed' };

    const pad = Number(ctx.project.bufferMinutes) || 0;
    const bs = start.getTime() - ((Number(svc.bufferBeforeMinutes) || 0) + pad) * 60_000;
    const be = end.getTime() + ((Number(svc.bufferAfterMinutes) || 0) + pad) * 60_000;
    const overlaps = (b: Busy) => b.id !== excludeId && new Date(b.startAt).getTime() < be && new Date(b.endAt).getTime() > bs;

    let resourceId: string | null = null;
    if (svc.resourceTypeRequired) {
      const pool = ctx.resources.filter(
        (r) =>
          r.type === svc.resourceTypeRequired &&
          r.locationId === loc.id &&
          (!r.assignedServiceIds?.length || r.assignedServiceIds.includes(svc.id)),
      );
      const free = pool.find((r) => busy.filter((b) => b.resourceId === r.id && overlaps(b)).length < Math.max(1, Number(r.quantity) || 1));
      if (!free) return { ok: false, reason: 'no_resource' };
      resourceId = free.id;
    }

    if (staffList.length) {
      for (const s of staffList) {
        const prof = ctx.profiles.get(s.id) ?? null;
        const sch = await this.availability.checkStaffSchedule(ctx.tenantId, s.id, start, end, tz, prof);
        if (!sch.ok) continue;
        const n = busy.filter((b) => b.staffUserId === s.id && overlaps(b)).length;
        if (n >= Math.max(1, Number(prof?.maxSimultaneousBookings) || 1)) continue;
        return { ok: true, staffUserId: s.id, resourceId };
      }
      return { ok: false, reason: 'busy' };
    }
    // услуга без мастеров (кабинет психолога, консультация) — одна бронь этой услуги за раз
    if (busy.some((b) => b.serviceId === svc.id && overlaps(b))) return { ok: false, reason: 'busy' };
    return { ok: true, staffUserId: null, resourceId };
  }

  private parseStart(start: string, tz: string): Date | null {
    const m = String(start || '').trim().replace('T', ' ').match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/);
    if (!m || !YMD_RE.test(m[1]) || !HM_RE.test(m[2])) return null;
    const d = zonedToUtc(m[1], m[2].padStart(5, '0'), tz);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  private slotLabel(d: Date, tz: string) {
    const p = zonedParts(d, tz);
    return { start: `${p.ymd} ${p.hm}`, weekday: WEEKDAY_LABEL[p.weekday] };
  }

  private resolveService(ctx: Ctx, serviceId: string, allowed?: string[] | null): BookingService | null {
    if (allowed?.length && !allowed.includes(serviceId)) return null;
    return ctx.services.find((s) => s.id === serviceId) || null;
  }

  // ------------------------------------------------------------------ свободные слоты

  async findSlots(
    tenantId: string,
    input: { serviceId: string; staffUserId?: string | null; date?: string | null; time?: string | null },
    allowedServiceIds?: string[] | null,
  ): Promise<
    | { ok: true; timezone: string; service: string; date: string | null; requestedTimeFree: boolean | null; slots: AiBookingSlot[]; alternatives: AiBookingSlot[] }
    | { ok: false; reason: AiBookingFailReason }
  > {
    const ctx = await this.ctx(tenantId);
    const svc = this.resolveService(ctx, input.serviceId, allowedServiceIds);
    if (!svc) return { ok: false, reason: 'unknown_service' };
    const loc = this.locationFor(ctx, svc);
    if (!loc) return { ok: false, reason: 'not_configured' };
    let staffList = this.staffFor(ctx, svc);
    if (input.staffUserId) {
      staffList = staffList.filter((s) => s.id === input.staffUserId);
      if (!staffList.length) return { ok: false, reason: 'unknown_master' };
    }
    const tz = this.tzOf(ctx, loc);
    const today = zonedParts(new Date(), tz).ymd;
    const date = input.date && YMD_RE.test(input.date) ? input.date : null;
    const time = input.time && HM_RE.test(input.time) ? input.time.padStart(5, '0') : null;
    const minutes = Number(svc.durationMinutes) || 60;
    const step = Math.max(5, Number(ctx.project.slotIntervalMinutes) || 15);

    const scanDays = async (fromYmd: string, days: number, perDay: number, total: number, spacing: number) => {
      const busy = await this.loadBusy(tenantId, zonedToUtc(fromYmd, '00:00', tz), zonedToUtc(addDaysYmd(fromYmd, days), '00:00', tz));
      const out: Array<AiBookingSlot & { min: number; ymd: string }> = [];
      for (let i = 0; i < days && out.length < total; i++) {
        const ymd = addDaysYmd(fromYmd, i);
        if (ymd < today) continue;
        let taken = 0;
        let lastMin = -Infinity;
        for (const w of this.dayWindows(loc, ymd)) {
          for (let m = hmToMinutes(w.start); m + minutes <= hmToMinutes(w.end) && taken < perDay && out.length < total; m += step) {
            if (m - lastMin < spacing) continue;
            const start = zonedToUtc(ymd, minutesToHm(m), tz);
            const end = new Date(start.getTime() + minutes * 60_000);
            const free = await this.checkFree(ctx, svc, loc, staffList, start, end, busy);
            if (!free.ok) continue;
            const master = free.staffUserId ? staffList.find((s) => s.id === free.staffUserId)?.name : undefined;
            out.push({ ...this.slotLabel(start, tz), ...(master ? { master } : {}), min: m, ymd });
            taken++;
            lastMin = m;
          }
        }
      }
      return out;
    };
    const strip = (l: Array<AiBookingSlot & { min: number; ymd: string }>): AiBookingSlot[] => l.map(({ min: _m, ymd: _y, ...s }) => s);

    if (date) {
      const all = await scanDays(date, 1, 200, 200, 0);
      let slots = all;
      let requestedTimeFree: boolean | null = null;
      if (time) {
        const t = hmToMinutes(time);
        requestedTimeFree = all.some((s) => s.min === t);
        slots = [...all].sort((a, b) => Math.abs(a.min - t) - Math.abs(b.min - t)).slice(0, 6).sort((a, b) => a.min - b.min);
      } else {
        // обзор дня: не больше 8 вариантов, не чаще раза в час
        const spaced: typeof all = [];
        for (const s of all) if (!spaced.length || s.min - spaced[spaced.length - 1].min >= 60) spaced.push(s);
        slots = spaced.slice(0, 8);
      }
      const alternatives = slots.length ? [] : strip(await scanDays(addDaysYmd(date, 1), 7, 2, 6, 120));
      return { ok: true, timezone: tz, service: svc.name, date, requestedTimeFree, slots: strip(slots), alternatives };
    }
    const slots = await scanDays(today, 7, 2, 6, 120);
    return { ok: true, timezone: tz, service: svc.name, date: null, requestedTimeFree: null, slots: strip(slots), alternatives: [] };
  }

  // ------------------------------------------------------------------ брони клиента

  private ownerWhere(qb: any, owner: AiBookingOwner) {
    const digits = String(owner.phone || '').replace(/\D/g, '').slice(-10);
    qb.andWhere(
      new Brackets((w) => {
        let any = false;
        if (owner.leadId) {
          w.where('r.leadId = :leadId', { leadId: owner.leadId });
          any = true;
        }
        if (digits.length >= 7) {
          const cond = `regexp_replace(coalesce(r.customerPhone, ''), '\\D', '', 'g') LIKE :ph`;
          if (any) w.orWhere(cond, { ph: `%${digits}` });
          else w.where(cond, { ph: `%${digits}` });
          any = true;
        }
        if (!any) w.where('1 = 0');
      }),
    );
  }

  private isOwner(r: Reservation, owner: AiBookingOwner): boolean {
    if (owner.leadId && r.leadId === owner.leadId) return true;
    const digits = String(owner.phone || '').replace(/\D/g, '').slice(-10);
    return digits.length >= 7 && String(r.customerPhone || '').replace(/\D/g, '').endsWith(digits);
  }

  /** Будущие активные брони клиента (по лиду переписки или телефону). */
  async customerBookings(tenantId: string, owner: AiBookingOwner) {
    const ctx = await this.ctx(tenantId);
    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.status IN (:...st)', { st: CANCELLABLE })
      .andWhere('r.startAt > :now', { now: new Date() });
    this.ownerWhere(qb, owner);
    const rows: Reservation[] = await qb.orderBy('r.startAt', 'ASC').take(10).getMany();
    return rows.map((r) => {
      const loc = ctx.locations.find((l) => l.id === r.locationId) || null;
      const tz = this.tzOf(ctx, loc);
      return {
        id: r.id,
        ...this.slotLabel(r.startAt, tz),
        service: ctx.services.find((s) => s.id === r.serviceId)?.name || null,
        master: r.staffUserId ? ctx.staff.get(r.staffUserId)?.fullName || null : null,
        status: r.status,
      };
    });
  }

  // ------------------------------------------------------------------ запись

  async book(
    tenantId: string,
    input: {
      serviceId: string;
      start: string;
      staffUserId?: string | null;
      name?: string | null;
      phone?: string | null;
      email?: string | null;
      leadId?: string | null;
      source: ReservationSource;
      agentId: string;
      agentName: string;
      channelLabel: string;
      dryRun?: boolean;
    },
    allowedServiceIds?: string[] | null,
  ): Promise<
    | { ok: true; dryRun?: boolean; already?: boolean; reservationId?: string; status: string; start: string; weekday: string; service: string; master: string | null; price: number; currency: string }
    | { ok: false; reason: AiBookingFailReason; detail?: string; alternatives?: AiBookingSlot[] }
  > {
    const ctx = await this.ctx(tenantId);
    const svc = this.resolveService(ctx, input.serviceId, allowedServiceIds);
    if (!svc) return { ok: false, reason: 'unknown_service' };
    const loc = this.locationFor(ctx, svc);
    if (!loc) return { ok: false, reason: 'not_configured' };
    const tz = this.tzOf(ctx, loc);
    const start = this.parseStart(input.start, tz);
    if (!start) return { ok: false, reason: 'bad_datetime' };
    const end = new Date(start.getTime() + (Number(svc.durationMinutes) || 60) * 60_000);
    const name = String(input.name || '').trim().slice(0, 120);
    const phone = String(input.phone || '').trim().slice(0, 40);
    const email = String(input.email || '').trim().slice(0, 120);
    if (!name || (!phone.replace(/\D/g, '').match(/\d{7,}/) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return { ok: false, reason: 'missing_contact' };
    }
    const owner: AiBookingOwner = { leadId: input.leadId || null, phone: phone || null };

    // повтор того же подтверждения (клиент написал «да» ещё раз) — не плодим дубль
    const sameQb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.status IN (:...st)', { st: CANCELLABLE })
      .andWhere('r.startAt = :startAt', { startAt: start })
      .andWhere('r.serviceId = :sid', { sid: svc.id });
    this.ownerWhere(sameQb, owner);
    const same = await sameQb.getOne();
    const label = this.slotLabel(start, tz);
    const price = Number(svc.price) || 0;
    const currency = String(svc.currency || ctx.project.currency || '').trim();
    if (same) {
      const master = same.staffUserId ? ctx.staff.get(same.staffUserId)?.fullName || null : null;
      return { ok: true, already: true, reservationId: same.id, status: same.status, ...label, service: svc.name, master, price, currency };
    }

    const recentQb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.status IN (:...st)', { st: CANCELLABLE })
      .andWhere('r.createdAt > :since', { since: new Date(Date.now() - 86_400_000) })
      .andWhere(`r.customFields ->> 'aiAgentId' IS NOT NULL`);
    this.ownerWhere(recentQb, owner);
    if ((await recentQb.getCount()) >= MAX_AI_BOOKINGS_PER_CLIENT_DAY) return { ok: false, reason: 'limit' };

    let staffList = this.staffFor(ctx, svc);
    if (input.staffUserId) {
      staffList = staffList.filter((s) => s.id === input.staffUserId);
      if (!staffList.length) return { ok: false, reason: 'unknown_master' };
    }
    const busy = await this.loadBusy(tenantId, start, end);
    const free = await this.checkFree(ctx, svc, loc, staffList, start, end, busy);
    if (!free.ok) {
      const alt = await this.findSlots(tenantId, { serviceId: svc.id, staffUserId: input.staffUserId, date: label.start.slice(0, 10), time: label.start.slice(11) }, allowedServiceIds);
      const alternatives = alt.ok ? (alt.slots.length ? alt.slots : alt.alternatives) : [];
      return { ok: false, reason: free.reason, alternatives };
    }
    const master = free.staffUserId ? staffList.find((s) => s.id === free.staffUserId)?.name || null : null;
    const pendingStatus = ctx.project.confirmationMode === 'auto' ? 'confirmed' : 'pending';
    if (input.dryRun) return { ok: true, dryRun: true, status: pendingStatus, ...label, service: svc.name, master, price, currency };

    try {
      const saved = await this.reservations.create(
        tenantId,
        {
          locationId: loc.id,
          serviceId: svc.id,
          staffUserId: free.staffUserId || undefined,
          resourceId: free.resourceId || undefined,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          customerName: name,
          customerPhone: phone || undefined,
          customerEmail: email || undefined,
          source: input.source,
          price: price ? String(price) : undefined,
          currency: currency || undefined,
          customFields: { aiAgentId: input.agentId, aiAgentName: input.agentName, aiChannel: input.channelLabel },
          leadId: input.leadId || undefined,
        },
        null,
      );
      await this.reservations
        .addNote(tenantId, saved.id, `Запись создана ИИ-сотрудником «${input.agentName}» (${input.channelLabel})`)
        .catch(() => undefined);
      return { ok: true, reservationId: saved.id, status: saved.status, ...label, service: svc.name, master, price, currency };
    } catch (e) {
      const detail = e instanceof BadRequestException || e instanceof NotFoundException ? e.message : 'internal error';
      return { ok: false, reason: 'error', detail };
    }
  }

  // ------------------------------------------------------------------ отмена / перенос

  private async ownedReservation(tenantId: string, reservationId: string, owner: AiBookingOwner) {
    const r = await this.reservationsRepo.findOne({ where: { id: reservationId, tenantId } });
    if (!r || !this.isOwner(r, owner)) return { error: 'not_found' as const };
    if (!CANCELLABLE.includes(r.status)) return { error: 'not_active' as const };
    return { r };
  }

  async cancel(
    tenantId: string,
    input: { reservationId: string; owner: AiBookingOwner; agentName: string; channelLabel: string; dryRun?: boolean },
  ): Promise<{ ok: true; dryRun?: boolean; start: string; service: string | null } | { ok: false; reason: AiBookingFailReason; hours?: number }> {
    const ctx = await this.ctx(tenantId);
    const found = await this.ownedReservation(tenantId, input.reservationId, input.owner);
    if ('error' in found) return { ok: false, reason: found.error! };
    const r = found.r;
    const hours = Number(ctx.project.cancellationDeadlineHours) || 0;
    if (r.startAt.getTime() - Date.now() < hours * 3_600_000) return { ok: false, reason: 'deadline', hours };
    const tz = this.tzOf(ctx, ctx.locations.find((l) => l.id === r.locationId) || null);
    const out = { start: this.slotLabel(r.startAt, tz).start, service: ctx.services.find((s) => s.id === r.serviceId)?.name || null };
    if (input.dryRun) return { ok: true, dryRun: true, ...out };
    await this.reservations.cancelByCustomer(tenantId, r.id, `Отменено клиентом через ИИ-сотрудника «${input.agentName}» (${input.channelLabel})`);
    return { ok: true, ...out };
  }

  async reschedule(
    tenantId: string,
    input: { reservationId: string; start: string; owner: AiBookingOwner; agentName: string; channelLabel: string; dryRun?: boolean },
    allowedServiceIds?: string[] | null,
  ): Promise<
    | { ok: true; dryRun?: boolean; from: string; start: string; weekday: string; service: string; master: string | null }
    | { ok: false; reason: AiBookingFailReason; hours?: number; alternatives?: AiBookingSlot[] }
  > {
    const ctx = await this.ctx(tenantId);
    const found = await this.ownedReservation(tenantId, input.reservationId, input.owner);
    if ('error' in found) return { ok: false, reason: found.error! };
    const r = found.r;
    const hours = Number(ctx.project.rescheduleDeadlineHours) || 0;
    if (r.startAt.getTime() - Date.now() < hours * 3_600_000) return { ok: false, reason: 'deadline', hours };
    const svc = r.serviceId ? ctx.services.find((s) => s.id === r.serviceId) || null : null;
    if (!svc) return { ok: false, reason: 'unknown_service' };
    const loc = ctx.locations.find((l) => l.id === r.locationId) || this.locationFor(ctx, svc);
    if (!loc) return { ok: false, reason: 'not_configured' };
    const tz = this.tzOf(ctx, loc);
    const start = this.parseStart(input.start, tz);
    if (!start) return { ok: false, reason: 'bad_datetime' };
    const end = new Date(start.getTime() + (r.endAt.getTime() - r.startAt.getTime()));
    // сначала тот же мастер, потом остальные мастера услуги
    const all = this.staffFor(ctx, svc);
    const staffList = r.staffUserId ? [...all.filter((s) => s.id === r.staffUserId), ...all.filter((s) => s.id !== r.staffUserId)] : all;
    const busy = await this.loadBusy(tenantId, start, end);
    const free = await this.checkFree(ctx, svc, loc, staffList, start, end, busy, r.id);
    const label = this.slotLabel(start, tz);
    if (!free.ok) {
      const alt = await this.findSlots(tenantId, { serviceId: svc.id, date: label.start.slice(0, 10), time: label.start.slice(11) }, allowedServiceIds);
      return { ok: false, reason: free.reason, alternatives: alt.ok ? (alt.slots.length ? alt.slots : alt.alternatives) : [] };
    }
    const master = free.staffUserId ? staffList.find((s) => s.id === free.staffUserId)?.name || null : null;
    const from = this.slotLabel(r.startAt, tz).start;
    if (input.dryRun) return { ok: true, dryRun: true, from, ...label, service: svc.name, master };
    await this.reservations.update(
      tenantId,
      r.id,
      { startAt: start, endAt: end, staffUserId: free.staffUserId, ...(free.resourceId ? { resourceId: free.resourceId } : {}) } as Partial<Reservation>,
      null,
    );
    await this.reservations
      .addNote(tenantId, r.id, `Перенесено клиентом через ИИ-сотрудника «${input.agentName}» (${input.channelLabel}): ${from} → ${label.start}`)
      .catch(() => undefined);
    return { ok: true, from, ...label, service: svc.name, master };
  }
}
