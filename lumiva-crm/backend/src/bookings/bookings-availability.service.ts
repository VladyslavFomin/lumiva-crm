import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import {
  Reservation,
  RESERVATION_ACTIVE_STATUSES,
} from './reservation.entity';
import { BookingStaffProfile } from './booking-staff-profile.entity';
import { BookingResource } from './booking-resource.entity';
import { BookingProject } from './booking-project.entity';
import { BookingService } from './booking-service.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { BookingsProjectsService } from './bookings-projects.service';
import { ReservationActivity } from './reservation-activity.entity';

export interface ConflictCheckInput {
  tenantId: string;
  staffUserId?: string | null;
  resourceId?: string | null;
  startAt: Date;
  endAt: Date;
  excludeReservationId?: string;
}

export interface ConflictCheckResult {
  ok: boolean;
  reason?: string;
}

@Injectable()
export class BookingsAvailabilityService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepo: Repository<Reservation>,
    @InjectRepository(BookingStaffProfile)
    private readonly staffProfilesRepo: Repository<BookingStaffProfile>,
    @InjectRepository(BookingResource)
    private readonly resourcesRepo: Repository<BookingResource>,
    @InjectRepository(StaffUser)
    private readonly staffUsersRepo: Repository<StaffUser>,
    @InjectRepository(BookingService)
    private readonly servicesRepo: Repository<BookingService>,
    @InjectRepository(ReservationActivity)
    private readonly activityRepo: Repository<ReservationActivity>,
    private readonly projects: BookingsProjectsService,
  ) {}

  /** Пересекается ли [startAt,endAt) с уже занятым временем мастера/ресурса. */
  async checkConflict(input: ConflictCheckInput): Promise<ConflictCheckResult> {
    const { tenantId, staffUserId, resourceId, startAt, endAt, excludeReservationId } = input;
    if (!staffUserId && !resourceId) return { ok: true };

    if (staffUserId) {
      const scheduleCheck = await this.checkStaffSchedule(tenantId, staffUserId, startAt, endAt);
      if (!scheduleCheck.ok) return scheduleCheck;
    }

    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.status IN (:...statuses)', { statuses: RESERVATION_ACTIVE_STATUSES })
      .andWhere('r.startAt < :endAt', { endAt })
      .andWhere('r.endAt > :startAt', { startAt });

    if (excludeReservationId) {
      qb.andWhere('r.id != :excludeId', { excludeId: excludeReservationId });
    }

    if (staffUserId) {
      const staffConflict = await qb
        .clone()
        .andWhere('r.staffUserId = :staffUserId', { staffUserId })
        .getOne();
      if (staffConflict) {
        return { ok: false, reason: 'Мастер уже занят в это время' };
      }
    }

    if (resourceId) {
      const resourceConflict = await qb
        .clone()
        .andWhere('r.resourceId = :resourceId', { resourceId })
        .getOne();
      if (resourceConflict) {
        return { ok: false, reason: 'Ресурс уже занят в это время' };
      }
    }

    return { ok: true };
  }

  private static readonly WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  /**
   * Отпуск/выходной и недельный график мастера (booking_staff_profiles.timeOff/
   * weeklyAvailability) — раньше сохранялись через upsertStaffWeeklyAvailability/
   * addStaffTimeOff, но нигде не читались: слот-инспектор и создание брони уверенно
   * подтверждали время, когда мастер в отпуске. Нет профиля/графика — как раньше,
   * без ограничений (не отказываем тенантам, которые это не настраивали).
   */
  private async checkStaffSchedule(
    tenantId: string,
    staffUserId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<ConflictCheckResult> {
    const profile = await this.staffProfilesRepo.findOne({ where: { tenantId, staffUserId } });
    if (!profile) return { ok: true };

    for (const off of profile.timeOff || []) {
      const from = new Date(off.from);
      // "YYYY-MM-DD" без времени парсится как полночь UTC — без этого последний день отпуска
      // считался бы свободным для записи (см. тот же баг в reservations.service.ts::list).
      const to = /^\d{4}-\d{2}-\d{2}$/.test((off.to || '').trim())
        ? new Date(`${off.to.trim()}T23:59:59.999Z`)
        : new Date(off.to);
      if (startAt < to && endAt > from) {
        return {
          ok: false,
          reason: off.reason
            ? `Мастер недоступен (${off.reason})`
            : 'Мастер недоступен в этот период (отпуск/выходной)',
        };
      }
    }

    const weekly = profile.weeklyAvailability;
    if (weekly && Object.keys(weekly).length) {
      const dayKey = BookingsAvailabilityService.WEEKDAY_KEYS[startAt.getDay()];
      const periods = weekly[dayKey] || [];
      if (!periods.length) {
        return { ok: false, reason: 'У мастера нет рабочих часов в этот день' };
      }
      const toMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
      const parseHm = (s: string) => {
        const [h, m] = s.split(':').map((n) => Number(n) || 0);
        return h * 60 + m;
      };
      const slotStart = toMinutes(startAt);
      const slotEnd = toMinutes(endAt);
      const fitsSomePeriod = periods.some(
        (p) => slotStart >= parseHm(p.start) && slotEnd <= parseHm(p.end),
      );
      if (!fitsSomePeriod) {
        return { ok: false, reason: 'Время вне рабочих часов мастера' };
      }
    }

    return { ok: true };
  }

  /** Проверка правил проекта: мин. уведомление, горизонт бронирования. */
  async checkProjectRules(
    project: BookingProject,
    startAt: Date,
  ): Promise<ConflictCheckResult> {
    const now = new Date();
    const minNoticeMs = project.minNoticeMinutes * 60_000;
    if (startAt.getTime() - now.getTime() < minNoticeMs) {
      return {
        ok: false,
        reason: `Минимальное уведомление — ${project.minNoticeMinutes} минут`,
      };
    }
    const maxAdvanceMs = project.maxAdvanceDays * 24 * 60 * 60_000;
    if (startAt.getTime() - now.getTime() > maxAdvanceMs) {
      return {
        ok: false,
        reason: `Горизонт бронирования — ${project.maxAdvanceDays} дней`,
      };
    }
    return { ok: true };
  }

  async upsertStaffWeeklyAvailability(
    tenantId: string,
    staffUserId: string,
    weeklyAvailability: Record<string, any>,
  ): Promise<BookingStaffProfile> {
    let profile = await this.staffProfilesRepo.findOne({ where: { tenantId, staffUserId } });
    if (!profile) profile = this.staffProfilesRepo.create({ tenantId, staffUserId });
    profile.weeklyAvailability = weeklyAvailability as any;
    return this.staffProfilesRepo.save(profile);
  }

  async addStaffTimeOff(
    tenantId: string,
    staffUserId: string,
    timeOff: { from: string; to: string; reason: string | null },
  ): Promise<BookingStaffProfile> {
    let profile = await this.staffProfilesRepo.findOne({ where: { tenantId, staffUserId } });
    if (!profile) profile = this.staffProfilesRepo.create({ tenantId, staffUserId, timeOff: [] });
    profile.timeOff = [...(profile.timeOff || []), timeOff];
    return this.staffProfilesRepo.save(profile);
  }

  async removeStaffTimeOff(
    tenantId: string,
    staffUserId: string,
    index: number,
  ): Promise<BookingStaffProfile | null> {
    const profile = await this.staffProfilesRepo.findOne({ where: { tenantId, staffUserId } });
    if (!profile) return null;
    profile.timeOff = (profile.timeOff || []).filter((_, i) => i !== index);
    return this.staffProfilesRepo.save(profile);
  }

  /**
   * Сетка "кто свободен" на дату: почасовые слоты 09:00-20:00 для сотрудников,
   * доступных для бронирования — busy, если есть пересекающаяся активная бронь.
   */
  async getStaffGrid(
    tenantId: string,
    date: string,
    locationId?: string,
  ): Promise<
    Array<{
      staffUserId: string;
      name: string;
      slots: Array<{
        hour: number;
        busy: boolean;
        reservationId?: string;
        customerName?: string | null;
        serviceName?: string | null;
        price?: string | null;
      }>;
    }>
  > {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const profilesQuery = this.staffProfilesRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.availableForBooking = true');
    const profiles = await profilesQuery.getMany();
    const filtered = locationId
      ? profiles.filter((p) => !p.assignedLocationIds?.length || p.assignedLocationIds.includes(locationId))
      : profiles;

    const staffUsers = await this.staffUsersRepo.find({
      where: { tenantId },
    });
    const staffById = new Map(staffUsers.map((s) => [s.id, s]));

    const reservations = await this.reservationsRepo.find({
      where: {
        tenantId,
        startAt: LessThan(dayEnd),
        endAt: MoreThan(dayStart),
      },
    });
    const services = await this.servicesRepo.find({ where: { tenantId } });
    const serviceById = new Map(services.map((s) => [s.id, s.name]));

    const hours = Array.from({ length: 12 }, (_, i) => 9 + i); // 09..20

    return filtered
      .filter((p) => staffById.has(p.staffUserId))
      .map((p) => {
        const staff = staffById.get(p.staffUserId)!;
        const staffReservations = reservations.filter(
          (r) =>
            r.staffUserId === p.staffUserId &&
            RESERVATION_ACTIVE_STATUSES.includes(r.status),
        );
        const slots = hours.map((hour) => {
          const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
          const slotEnd = new Date(`${date}T${String(hour + 1).padStart(2, '0')}:00:00`);
          const conflicting = staffReservations.find(
            (r) => r.startAt < slotEnd && r.endAt > slotStart,
          );
          return {
            hour,
            busy: !!conflicting,
            reservationId: conflicting?.id,
            customerName: conflicting?.customerName ?? null,
            serviceName: conflicting?.serviceId ? serviceById.get(conflicting.serviceId) ?? null : null,
            price: conflicting?.price ?? null,
          };
        });
        return { staffUserId: p.staffUserId, name: staff.fullName, slots };
      });
  }

  /**
   * "Переназначить брони" — массовый перенос активных броней от одного мастера к
   * другому (или на "распределить автоматически" = снять staffUserId) в диапазоне дат.
   * Пишет `staff_changed` в ReservationActivity на каждую затронутую бронь.
   */
  async reassignStaffBookings(
    tenantId: string,
    input: { fromStaffUserId: string; toStaffUserId: string | null; fromDate: string; toDate: string },
    actingStaffUserId: string | null,
  ): Promise<{ reassignedCount: number; skippedCount: number }> {
    const rangeStart = new Date(`${input.fromDate}T00:00:00`);
    const rangeEnd = new Date(`${input.toDate}T23:59:59`);

    const reservations = await this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.staffUserId = :fromStaffUserId', { fromStaffUserId: input.fromStaffUserId })
      .andWhere('r.status IN (:...statuses)', { statuses: RESERVATION_ACTIVE_STATUSES })
      .andWhere('r.startAt BETWEEN :rangeStart AND :rangeEnd', { rangeStart, rangeEnd })
      .getMany();

    let skippedCount = 0;
    for (const reservation of reservations) {
      // Раньше переносило на нового мастера без единой проверки занятости — двойные
      // брони. "Распределить автоматически" (toStaffUserId=null) снимает мастера
      // целиком, конфликтовать не с чем — проверяем только реальную передачу другому.
      if (input.toStaffUserId) {
        const conflict = await this.checkConflict({
          tenantId,
          staffUserId: input.toStaffUserId,
          startAt: reservation.startAt,
          endAt: reservation.endAt,
          excludeReservationId: reservation.id,
        });
        if (!conflict.ok) {
          skippedCount += 1;
          continue;
        }
      }
      reservation.staffUserId = input.toStaffUserId;
      await this.reservationsRepo.save(reservation);
      await this.activityRepo.save(
        this.activityRepo.create({
          tenantId,
          reservationId: reservation.id,
          userId: actingStaffUserId,
          type: 'staff_changed',
          description: 'Мастер переназначен массово',
          fromValue: input.fromStaffUserId,
          toValue: input.toStaffUserId || 'auto',
        }),
      );
    }

    return { reassignedCount: reservations.length - skippedCount, skippedCount };
  }

  /** Slot Inspector: почему слот доступен/недоступен + правила проекта + конфликт мастера/ресурса. */
  async inspectSlot(
    tenantId: string,
    input: { staffUserId?: string; resourceId?: string; startAt: Date; endAt: Date },
  ): Promise<ConflictCheckResult> {
    const project = await this.projects.getOrCreateDefaultProject(tenantId);
    const rulesCheck = await this.checkProjectRules(project, input.startAt);
    if (!rulesCheck.ok) return rulesCheck;
    return this.checkConflict({ tenantId, ...input });
  }
}
