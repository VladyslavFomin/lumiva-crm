import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation, RESERVATION_ACTIVE_STATUSES } from './reservation.entity';
import { BookingService } from './booking-service.entity';
import { BookingResource } from './booking-resource.entity';
import { BookingLocation } from './booking-location.entity';
import { BookingStaffProfile } from './booking-staff-profile.entity';
import { StaffUser } from '../staff/staff-user.entity';

export interface BookingAnalyticsSummary {
  totalReservations: number;
  completed: number;
  cancelled: number;
  noShow: number;
  noShowRate: number;
  totalRevenue: number;
  avgCheck: number;
  occupancyRate: number;
}

export interface AtRiskCustomerRow {
  contactId: string;
  customerName: string | null;
  lastVisit: string;
  visits: number;
  ltv: number;
}

const DEFAULT_DAILY_MINUTES = 11 * 60; // 09:00–20:00, если рабочие часы локации не заданы

@Injectable()
export class BookingsAnalyticsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepo: Repository<Reservation>,
    @InjectRepository(BookingService)
    private readonly servicesRepo: Repository<BookingService>,
    @InjectRepository(BookingResource)
    private readonly resourcesRepo: Repository<BookingResource>,
    @InjectRepository(BookingLocation)
    private readonly locationsRepo: Repository<BookingLocation>,
    @InjectRepository(BookingStaffProfile)
    private readonly staffProfilesRepo: Repository<BookingStaffProfile>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  private dayRange(dateStr?: string) {
    const day = dateStr ? new Date(dateStr) : new Date();
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
    return { dayStart, dayEnd };
  }

  private range(from?: string, to?: string) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60_000);
    return { fromDate, toDate };
  }

  async getSummary(tenantId: string, from?: string, to?: string): Promise<BookingAnalyticsSummary> {
    const { fromDate, toDate } = this.range(from, to);
    const qb = this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate });
    const reservations = await qb.getMany();

    const completed = reservations.filter((r) => r.status === 'completed').length;
    const cancelled = reservations.filter(
      (r) => r.status === 'cancelled_by_business' || r.status === 'cancelled_by_customer' || r.status === 'rejected',
    ).length;
    const noShow = reservations.filter((r) => r.status === 'no_show').length;
    const revenueRows = reservations.filter((r) => r.status === 'completed' && r.price);
    const totalRevenue = revenueRows.reduce((sum, r) => sum + Number(r.price || 0), 0);

    const occupancyRate = await this.getOccupancyRate(tenantId, fromDate, toDate);

    return {
      totalReservations: reservations.length,
      completed,
      cancelled,
      noShow,
      noShowRate: reservations.length ? Math.round((noShow / reservations.length) * 1000) / 10 : 0,
      totalRevenue,
      avgCheck: revenueRows.length ? Math.round((totalRevenue / revenueRows.length) * 100) / 100 : 0,
      occupancyRate,
    };
  }

  /**
   * "Загрузка кабинетов" — доля забронированных минут ресурсов от теоретически
   * доступных (по кол-ву ресурсов × рабочим часам их локации, по умолчанию
   * 09:00-20:00 если часы локации не заданы). Реальный расчёт по имеющимся данным,
   * не заглушка.
   */
  private async getOccupancyRate(tenantId: string, fromDate: Date, toDate: Date): Promise<number> {
    const resources = await this.resourcesRepo.find({ where: { tenantId, active: true } });
    if (!resources.length) return 0;

    const locations = await this.locationsRepo.find({ where: { tenantId } });
    const locationById = new Map(locations.map((l) => [l.id, l]));
    const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60_000)));

    let totalAvailableMinutes = 0;
    for (const resource of resources) {
      const location = locationById.get(resource.locationId);
      totalAvailableMinutes += this.estimateDailyMinutes(location?.workingHours) * days * resource.quantity;
    }
    if (!totalAvailableMinutes) return 0;

    const bookedRows = await this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.resourceId IS NOT NULL')
      .andWhere('r.status IN (:...statuses)', {
        statuses: [...RESERVATION_ACTIVE_STATUSES, 'completed'],
      })
      .andWhere('r.startAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .getMany();
    const bookedMinutes = bookedRows.reduce(
      (sum, r) => sum + (r.endAt.getTime() - r.startAt.getTime()) / 60_000,
      0,
    );

    return Math.min(100, Math.round((bookedMinutes / totalAvailableMinutes) * 1000) / 10);
  }

  private estimateDailyMinutes(workingHours?: Record<string, { start: string; end: string }[]> | null): number {
    if (!workingHours || !Object.keys(workingHours).length) return DEFAULT_DAILY_MINUTES;
    const dayEntries = Object.values(workingHours);
    if (!dayEntries.length) return DEFAULT_DAILY_MINUTES;
    let totalMinutes = 0;
    let dayCount = 0;
    for (const periods of dayEntries) {
      if (!periods?.length) continue;
      dayCount += 1;
      for (const period of periods) {
        const [sh, sm] = period.start.split(':').map(Number);
        const [eh, em] = period.end.split(':').map(Number);
        totalMinutes += eh * 60 + em - (sh * 60 + sm);
      }
    }
    return dayCount ? totalMinutes / dayCount : DEFAULT_DAILY_MINUTES;
  }

  /** "Клиенты в зоне риска" — не появлялись 60+ дней, отсортированы по LTV. */
  async getAtRiskCustomers(tenantId: string, days = 60): Promise<AtRiskCustomerRow[]> {
    const reservations = await this.reservationsRepo.find({
      where: { tenantId },
      order: { startAt: 'DESC' },
    });
    const byContact = new Map<string, AtRiskCustomerRow>();
    for (const r of reservations) {
      if (!r.contactId) continue;
      if (!['completed', 'checked_in', 'confirmed'].includes(r.status)) continue;
      const existing = byContact.get(r.contactId);
      if (!existing) {
        byContact.set(r.contactId, {
          contactId: r.contactId,
          customerName: r.customerName,
          lastVisit: r.startAt.toISOString(),
          visits: 1,
          ltv: Number(r.price || 0),
        });
      } else {
        existing.visits += 1;
        existing.ltv += Number(r.price || 0);
        if (r.startAt.toISOString() > existing.lastVisit) {
          existing.lastVisit = r.startAt.toISOString();
          existing.customerName = r.customerName;
        }
      }
    }
    const cutoff = Date.now() - days * 24 * 60 * 60_000;
    return [...byContact.values()]
      .filter((c) => new Date(c.lastVisit).getTime() < cutoff)
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, 10);
  }

  async getDailyTrend(tenantId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.range(from, to);
    const rows = await this.reservationsRepo
      .createQueryBuilder('r')
      .select("to_char(r.createdAt, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  }

  async getHeatmap(tenantId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.range(from, to);
    const rows = await this.reservationsRepo
      .createQueryBuilder('r')
      .select('EXTRACT(DOW FROM r.startAt)', 'dow')
      .addSelect('EXTRACT(HOUR FROM r.startAt)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.startAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .groupBy('dow, hour')
      .getRawMany();
    return rows.map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), count: Number(r.count) }));
  }

  async getTopServices(tenantId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.range(from, to);
    const rows = await this.reservationsRepo
      .createQueryBuilder('r')
      .select('r.serviceId', 'serviceId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(COALESCE(r.price, 0))', 'revenue')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .andWhere('r.serviceId IS NOT NULL')
      .groupBy('r.serviceId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();
    const services = await this.servicesRepo.find({ where: { tenantId } });
    const byId = new Map(services.map((s) => [s.id, s.name]));
    return rows.map((r) => ({
      serviceId: r.serviceId,
      name: byId.get(r.serviceId) || r.serviceId,
      count: Number(r.count),
      revenue: Number(r.revenue),
    }));
  }

  async getStaffUtilization(tenantId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.range(from, to);
    const rows = await this.reservationsRepo
      .createQueryBuilder('r')
      .select('r.staffUserId', 'staffUserId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(COALESCE(r.price, 0))', 'revenue')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .andWhere('r.staffUserId IS NOT NULL')
      .groupBy('r.staffUserId')
      .orderBy('count', 'DESC')
      .getRawMany();
    const staff = await this.staffRepo.find({ where: { tenantId } });
    const byId = new Map(staff.map((s) => [s.id, s.fullName]));
    return rows.map((r) => ({
      staffUserId: r.staffUserId,
      name: byId.get(r.staffUserId) || r.staffUserId,
      count: Number(r.count),
      revenue: Number(r.revenue),
    }));
  }

  async getSourceBreakdown(tenantId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.range(from, to);
    const rows = await this.reservationsRepo
      .createQueryBuilder('r')
      .select('r.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.createdAt BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .groupBy('r.source')
      .orderBy('count', 'DESC')
      .getRawMany();
    return rows.map((r) => ({ source: r.source, count: Number(r.count) }));
  }

  /** Сравнение локаций (страница "Локации") — реальные счётчики и загрузка на сегодня. */
  async getLocationStats(tenantId: string) {
    const { dayStart, dayEnd } = this.dayRange();
    const [locations, resources, staffProfiles, todayReservations] = await Promise.all([
      this.locationsRepo.find({ where: { tenantId } }),
      this.resourcesRepo.find({ where: { tenantId, active: true } }),
      this.staffProfilesRepo.find({ where: { tenantId, availableForBooking: true } }),
      this.reservationsRepo.find({
        where: { tenantId },
        order: { startAt: 'ASC' },
      }),
    ]);
    const todayFiltered = todayReservations.filter((r) => r.startAt >= dayStart && r.startAt < dayEnd);

    return locations.map((location) => {
      const locationResources = resources.filter((r) => r.locationId === location.id);
      const staffCount = staffProfiles.filter(
        (p) => !p.assignedLocationIds?.length || p.assignedLocationIds.includes(location.id),
      ).length;
      const todayAtLocation = todayFiltered.filter((r) => r.locationId === location.id);
      const todayRevenue = todayAtLocation
        .filter((r) => r.status === 'completed')
        .reduce((sum, r) => sum + Number(r.price || 0), 0);

      const availableMinutes = locationResources.reduce(
        (sum, r) => sum + this.estimateDailyMinutes(location.workingHours) * r.quantity,
        0,
      );
      const bookedMinutes = todayAtLocation
        .filter((r) => r.resourceId && RESERVATION_ACTIVE_STATUSES.includes(r.status))
        .reduce((sum, r) => sum + (r.endAt.getTime() - r.startAt.getTime()) / 60_000, 0);
      const occupancy = availableMinutes ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 1000) / 10) : 0;

      return {
        id: location.id,
        name: location.name,
        address: location.address,
        status: location.status,
        staffCount,
        resourceCount: locationResources.length,
        todayReservations: todayAtLocation.length,
        todayRevenue,
        occupancy,
      };
    });
  }

  /** Список ресурсов с реальной загрузкой на сегодня и ближайшей записью. */
  async getResourceStats(tenantId: string) {
    const { dayStart, dayEnd } = this.dayRange();
    const [resources, reservations] = await Promise.all([
      this.resourcesRepo.find({ where: { tenantId } }),
      this.reservationsRepo.find({
        where: { tenantId },
        order: { startAt: 'ASC' },
      }),
    ]);
    const now = new Date();

    return resources.map((resource) => {
      const resReservations = reservations.filter(
        (r) => r.resourceId === resource.id && RESERVATION_ACTIVE_STATUSES.includes(r.status),
      );
      const todayReservations = resReservations.filter((r) => r.startAt >= dayStart && r.startAt < dayEnd);
      const bookedMinutesToday = todayReservations.reduce(
        (sum, r) => sum + (r.endAt.getTime() - r.startAt.getTime()) / 60_000,
        0,
      );
      const availableMinutesToday = DEFAULT_DAILY_MINUTES * resource.quantity;
      const utilizationToday = availableMinutesToday
        ? Math.min(100, Math.round((bookedMinutesToday / availableMinutesToday) * 1000) / 10)
        : 0;
      const next = resReservations.find((r) => r.startAt >= now);

      return {
        id: resource.id,
        utilizationToday,
        nextReservation: next
          ? { startAt: next.startAt.toISOString(), customerName: next.customerName }
          : null,
      };
    });
  }
}
