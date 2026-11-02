import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Reservation, RESERVATION_ACTIVE_STATUSES } from './reservation.entity';
import { BookingLocation } from './booking-location.entity';
import { BookingVerticalSettings } from './booking-project.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { ReservationsService, buildMeetingUrl } from './reservations.service';
import { BookingsRestaurantService } from './bookings-restaurant.service';
import { BookingsOrdersService } from './bookings-orders.service';
import { BookingsClassesService } from './bookings-classes.service';
import { BookingsPassesService } from './bookings-passes.service';
import { BookingsRentalService } from './bookings-rental.service';
import { addDaysYmd, safeTimeZone, zonedParts, zonedToUtc } from './booking-time.util';

/** Дефолты настроек вертикали — одно место, чтобы фронт и бэк показывали одно и то же. */
export const VERTICAL_DEFAULTS: Required<BookingVerticalSettings> = {
  turnMinutes: 120,
  serviceChargePercent: 0,
  autoReleaseMinutes: 20,
  passChargeOn: 'attendance',
  noShowChargesVisit: true,
  lateCancelHours: 12,
  defaultClassCapacity: 10,
  defaultMeetingFormat: 'offline',
  meetingUrlTemplate: 'https://meet.jit.si/{ORG}-{ID}',
  followUpDays: 14,
  rentalUnit: 'hour',
  lateFeePercent: 100,
  requireDeposit: false,
};

@Injectable()
export class BookingsVerticalService {
  constructor(
    @InjectRepository(Reservation) private readonly reservationsRepo: Repository<Reservation>,
    @InjectRepository(BookingLocation) private readonly locations: Repository<BookingLocation>,
    private readonly projects: BookingsProjectsService,
    private readonly reservations: ReservationsService,
    private readonly restaurant: BookingsRestaurantService,
    private readonly orders: BookingsOrdersService,
    private readonly classes: BookingsClassesService,
    private readonly passes: BookingsPassesService,
    private readonly rental: BookingsRentalService,
  ) {}

  async getSettings(tenantId: string) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    return { ...VERTICAL_DEFAULTS, ...(project.verticalSettings || {}) };
  }

  async updateSettings(tenantId: string, dto: Partial<BookingVerticalSettings>) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const cur = { ...(project.verticalSettings || {}) } as BookingVerticalSettings;
    const int = (v: unknown, min: number, max: number) => {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < min || n > max) throw new BadRequestException(`Значение должно быть от ${min} до ${max}`);
      return n;
    };
    if (dto.turnMinutes !== undefined) cur.turnMinutes = int(dto.turnMinutes, 15, 720);
    if (dto.serviceChargePercent !== undefined) cur.serviceChargePercent = int(dto.serviceChargePercent, 0, 50);
    if (dto.autoReleaseMinutes !== undefined) cur.autoReleaseMinutes = int(dto.autoReleaseMinutes, 0, 240);
    if (dto.passChargeOn !== undefined) cur.passChargeOn = dto.passChargeOn === 'booking' ? 'booking' : 'attendance';
    if (dto.noShowChargesVisit !== undefined) cur.noShowChargesVisit = !!dto.noShowChargesVisit;
    if (dto.lateCancelHours !== undefined) cur.lateCancelHours = int(dto.lateCancelHours, 0, 168);
    if (dto.defaultClassCapacity !== undefined) cur.defaultClassCapacity = int(dto.defaultClassCapacity, 1, 500);
    if (dto.defaultMeetingFormat !== undefined) cur.defaultMeetingFormat = ['online', 'phone'].includes(dto.defaultMeetingFormat) ? dto.defaultMeetingFormat : 'offline';
    if (dto.meetingUrlTemplate !== undefined) {
      const t = String(dto.meetingUrlTemplate || '').trim();
      if (t && !/^https?:\/\//i.test(t)) throw new BadRequestException('Шаблон ссылки должен начинаться с http(s)://');
      cur.meetingUrlTemplate = t || VERTICAL_DEFAULTS.meetingUrlTemplate;
    }
    if (dto.followUpDays !== undefined) cur.followUpDays = int(dto.followUpDays, 1, 365);
    if (dto.rentalUnit !== undefined) cur.rentalUnit = dto.rentalUnit === 'day' ? 'day' : 'hour';
    if (dto.lateFeePercent !== undefined) cur.lateFeePercent = int(dto.lateFeePercent, 0, 1000);
    if (dto.requireDeposit !== undefined) cur.requireDeposit = !!dto.requireDeposit;
    await this.projects.updateSettings(tenantId, { verticalSettings: cur } as any);
    return { ...VERTICAL_DEFAULTS, ...cur };
  }

  /* ---------- консультации ---------- */

  async setMeeting(tenantId: string, id: string, dto: { format: 'offline' | 'online' | 'phone'; url?: string | null; regenerate?: boolean }, actingStaffUserId: string | null) {
    const r = await this.reservations.findOne(tenantId, id);
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const format = ['online', 'phone'].includes(dto.format) ? dto.format : 'offline';
    let url: string | null = r.meetingUrl;
    if (format === 'online') {
      if (dto.url?.trim()) {
        if (!/^https?:\/\//i.test(dto.url.trim())) throw new BadRequestException('Ссылка должна начинаться с http(s)://');
        url = dto.url.trim();
      } else if (!url || dto.regenerate) {
        url = buildMeetingUrl(project.verticalSettings?.meetingUrlTemplate, project.name, `${r.id.slice(0, 4)}${Date.now().toString(36).slice(-4)}`);
      }
    } else {
      url = null;
    }
    await this.reservationsRepo.update({ id, tenantId }, { meetingFormat: format, meetingUrl: url });
    await this.reservations.log(tenantId, id, actingStaffUserId, format === 'online' ? `Онлайн-встреча: ${url}` : format === 'phone' ? 'Формат: по телефону' : 'Формат: очно');
    return this.reservations.findOne(tenantId, id);
  }

  async saveSession(tenantId: string, id: string, dto: { sessionSummary?: string | null; followUpAt?: string | null }, actingStaffUserId: string | null) {
    await this.reservations.findOne(tenantId, id);
    const patch: Partial<Reservation> = {};
    if (dto.sessionSummary !== undefined) patch.sessionSummary = dto.sessionSummary ? String(dto.sessionSummary).slice(0, 20000) : null;
    if (dto.followUpAt !== undefined) {
      const d = dto.followUpAt ? new Date(dto.followUpAt) : null;
      if (d && Number.isNaN(d.getTime())) throw new BadRequestException('Некорректная дата повторной встречи');
      patch.followUpAt = d;
    }
    await this.reservationsRepo.update({ id, tenantId }, patch);
    if (dto.sessionSummary !== undefined) await this.reservations.log(tenantId, id, actingStaffUserId, 'Обновлён протокол сессии');
    return this.reservations.findOne(tenantId, id);
  }

  /** Клиенты, которым пора на повторную сессию и которые ещё не записаны. */
  async followUps(tenantId: string, days = 7) {
    const until = new Date(Date.now() + days * 86400_000);
    const due = await this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.followUpAt IS NOT NULL AND r.followUpAt <= :until', { tenantId, until })
      .orderBy('r.followUpAt', 'ASC')
      .take(200)
      .getMany();
    const contactIds = [...new Set(due.map((r) => r.contactId).filter(Boolean) as string[])];
    const upcoming = contactIds.length
      ? await this.reservationsRepo.find({ where: { tenantId, contactId: In(contactIds), status: In(['pending', 'confirmed']) } })
      : [];
    return due.filter((r) => !upcoming.some((u) => u.contactId === r.contactId && u.startAt > r.startAt));
  }

  /* ---------- обзор ---------- */

  async overview(tenantId: string, locationId?: string) {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const tz = safeTimeZone(project.timezone);
    const today = zonedParts(new Date(), tz).ymd;
    const dayStart = zonedToUtc(today, '00:00', tz);
    const dayEnd = zonedToUtc(addDaysYmd(today, 1), '00:00', tz);
    const ordersToday = await this.orders.summary(tenantId, dayStart, dayEnd);
    const base = { businessType: project.businessType, currency: project.currency, ordersToday };

    if (project.businessType === 'restaurant') {
      const loc = locationId || (await this.locations.findOne({ where: { tenantId }, order: { createdAt: 'ASC' } }))?.id;
      const floor = loc ? await this.restaurant.floorState(tenantId, loc) : null;
      const topDishes = await this.orders.topMenuItems(tenantId, new Date(Date.now() - 30 * 86400_000), new Date(), 5);
      return { ...base, floor: floor ? { stats: floor.stats, unseated: floor.unseated.length } : null, topDishes };
    }
    if (project.businessType === 'fitness') {
      const [classes, passes] = await Promise.all([this.classes.stats(tenantId), this.passes.stats(tenantId)]);
      return { ...base, classes, passes };
    }
    if (project.businessType === 'consultation') {
      const monthAgo = new Date(Date.now() - 30 * 86400_000);
      const todays = await this.reservationsRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.startAt >= :from AND r.startAt < :to', { tenantId, from: monthAgo, to: dayEnd })
        .andWhere('r.status IN (:...st)', { st: [...RESERVATION_ACTIVE_STATUSES, 'completed'] })
        .getMany();
      const list = todays.filter((r) => r.startAt >= dayStart && r.startAt < dayEnd);
      const noSummary = todays.filter((r) => r.status === 'completed' && r.startAt >= monthAgo && !r.sessionSummary?.trim()).length;
      const [followUps, passes] = await Promise.all([this.followUps(tenantId, 7), this.passes.stats(tenantId)]);
      return {
        ...base,
        consult: {
          sessionsToday: list.length,
          onlineToday: list.filter((r) => r.meetingFormat === 'online').length,
          followUpsDue: followUps.length,
          withoutSummary: noSummary,
        },
        passes,
      };
    }
    if (project.businessType === 'rental') {
      const desk = await this.rental.desk(tenantId);
      return {
        ...base,
        rental: {
          pickupsToday: desk.pickups.length,
          returnsToday: desk.returns.length,
          overdue: desk.overdue.length,
          outNow: desk.outNow,
          unitsOut: desk.unitsOut,
          depositsHeld: desk.depositsHeld,
        },
      };
    }
    return base;
  }
}
