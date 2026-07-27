import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HotelReservation,
  HotelReservationPaidStatus,
  HotelReservationStatus,
} from './hotel-reservation.entity';
import { normalizeNumericInput } from './hotel-number.util';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

export interface HotelReservationFilters {
  hotelId?: string;
  roomTypeId?: string;
  agencyId?: string;
  status?: string;
  market?: string;
  search?: string;
}

function toNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export interface HotelReservationInput {
  hotelId: string;
  roomTypeId: string;
  agencyId?: string | null;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  pax?: number;
  market?: string | null;
  checkIn: string;
  checkOut: string;
  costPerNight?: string;
  ppPerNight?: string;
  grossPerNight?: string;
  discountPct?: string;
  status?: HotelReservationStatus;
  paidStatus?: HotelReservationPaidStatus;
  source?: 'manual' | 'import';
}

const PRICE_FIELDS = ['costPerNight', 'ppPerNight', 'grossPerNight', 'discountPct'] as const;

@Injectable()
export class HotelReservationsService {
  constructor(
    @InjectRepository(HotelReservation)
    private readonly repo: Repository<HotelReservation>,
    @InjectRepository(Hotel)
    private readonly hotelRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypeRepo: Repository<HotelRoomType>,
    private readonly roomTypesService: HotelRoomTypesService,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  /** Проверяет заполняемость типа номера за месяц заезда и, если она достигла/превысила
   * порог отеля (Hotel.riskThresholdWarnPct, тот же порог, что у теплокарты в аналитике),
   * шлёт HOTEL_LOW_AVAILABILITY. Срабатывает при создании/отмене брони — без отдельного
   * планировщика (см. план: "fire-on-write, not a new cron"). */
  private async checkLowAvailability(tenantId: string, reservation: HotelReservation, adminEmails: string[]) {
    try {
      const [year, month] = reservation.checkIn.split('-').map(Number);
      const monthStats = await this.roomTypesService.getMonthFillStats(tenantId, reservation.roomTypeId, year, month - 1);
      const hotel = await this.hotelRepo.findOne({ where: { id: reservation.hotelId, tenantId } });
      const warnPct = toNum(hotel?.riskThresholdWarnPct) || 65;
      if (monthStats.occupancyPct >= warnPct) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_LOW_AVAILABILITY, {
          entityType: 'hotel_room_type',
          entityId: reservation.roomTypeId,
          hotel,
          monthStats,
          adminEmails,
        });
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
  }

  async list(tenantId: string, filters: HotelReservationFilters) {
    const qb = this.repo.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId });
    if (filters.hotelId) qb.andWhere('r.hotelId = :hotelId', { hotelId: filters.hotelId });
    if (filters.roomTypeId) qb.andWhere('r.roomTypeId = :roomTypeId', { roomTypeId: filters.roomTypeId });
    if (filters.agencyId) qb.andWhere('r.agencyId = :agencyId', { agencyId: filters.agencyId });
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.market) qb.andWhere('r.market = :market', { market: filters.market });
    if (filters.search) {
      qb.andWhere('(r.guestName ILIKE :search)', { search: `%${filters.search}%` });
    }
    qb.orderBy('r.createdAt', 'DESC');
    return qb.getMany();
  }

  async get(tenantId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Бронь не найдена');
    return row;
  }

  private computeTotals(row: HotelReservation) {
    const nights = nightsBetween(row.checkIn, row.checkOut);
    row.ppTotal = String(round2(toNum(row.ppPerNight) * nights));
    row.roomTotal = String(round2(toNum(row.grossPerNight) * nights));
    row.total = String(round2(toNum(row.roomTotal) * (1 - toNum(row.discountPct) / 100)));
  }

  async create(tenantId: string, dto: HotelReservationInput) {
    const row = this.repo.create({
      tenantId,
      hotelId: dto.hotelId,
      roomTypeId: dto.roomTypeId,
      agencyId: dto.agencyId ?? null,
      guestName: dto.guestName,
      guestEmail: dto.guestEmail ?? null,
      guestPhone: dto.guestPhone ?? null,
      pax: dto.pax ?? 1,
      market: dto.market ?? null,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      costPerNight: normalizeNumericInput(dto.costPerNight),
      ppPerNight: normalizeNumericInput(dto.ppPerNight),
      grossPerNight: normalizeNumericInput(dto.grossPerNight),
      discountPct: normalizeNumericInput(dto.discountPct),
      status: dto.status ?? 'confirmed',
      paidStatus: dto.paidStatus ?? 'none',
      source: dto.source ?? 'manual',
    });
    this.computeTotals(row);
    const saved = await this.repo.save(row);

    try {
      const [hotel, roomType, adminEmails] = await Promise.all([
        this.hotelRepo.findOne({ where: { id: saved.hotelId, tenantId } }),
        this.roomTypeRepo.findOne({ where: { id: saved.roomTypeId, tenantId } }),
        this.automationsService.resolveAdminEmails(tenantId),
      ]);
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_RESERVATION_CREATED, {
        entityType: 'hotel_reservation',
        entityId: saved.id,
        reservation: saved,
        hotel,
        roomType,
        adminEmails,
      });
      await this.checkLowAvailability(tenantId, saved, adminEmails);
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    return saved;
  }

  async update(tenantId: string, id: string, dto: Partial<HotelReservationInput>) {
    const row = await this.get(tenantId, id);
    const fromStatus = row.status;
    const priceFieldsChanged = PRICE_FIELDS.some(
      (key) => dto[key] !== undefined && normalizeNumericInput(dto[key]) !== row[key],
    );

    const normalized = { ...dto };
    for (const key of PRICE_FIELDS) {
      if (normalized[key] !== undefined) normalized[key] = normalizeNumericInput(normalized[key]);
    }
    Object.assign(row, normalized);
    this.computeTotals(row);
    const saved = await this.repo.save(row);

    try {
      const adminEmails = await this.automationsService.resolveAdminEmails(tenantId);
      if (dto.status !== undefined && dto.status !== fromStatus) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_RESERVATION_STATUS_CHANGED, {
          entityType: 'hotel_reservation',
          entityId: id,
          reservation: saved,
          fromStatus,
          toStatus: saved.status,
          adminEmails,
        });
        if (saved.status === 'cancelled') {
          await this.checkLowAvailability(tenantId, saved, adminEmails);
        }
      }
      if (priceFieldsChanged) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_PRICE_CHANGED, {
          entityType: 'hotel_reservation',
          entityId: id,
          reservation: saved,
        });
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    return saved;
  }

  async remove(tenantId: string, id: string) {
    const row = await this.get(tenantId, id);
    await this.repo.remove(row);
    return { ok: true };
  }
}
