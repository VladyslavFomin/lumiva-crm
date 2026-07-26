import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HotelReservation,
  HotelReservationPaidStatus,
  HotelReservationStatus,
} from './hotel-reservation.entity';
import { normalizeNumericInput } from './hotel-number.util';

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

@Injectable()
export class HotelReservationsService {
  constructor(
    @InjectRepository(HotelReservation)
    private readonly repo: Repository<HotelReservation>,
  ) {}

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
    return this.repo.save(row);
  }

  async update(tenantId: string, id: string, dto: Partial<HotelReservationInput>) {
    const row = await this.get(tenantId, id);
    const normalized = { ...dto };
    for (const key of ['costPerNight', 'ppPerNight', 'grossPerNight', 'discountPct'] as const) {
      if (normalized[key] !== undefined) normalized[key] = normalizeNumericInput(normalized[key]);
    }
    Object.assign(row, normalized);
    this.computeTotals(row);
    return this.repo.save(row);
  }

  async remove(tenantId: string, id: string) {
    const row = await this.get(tenantId, id);
    await this.repo.remove(row);
    return { ok: true };
  }
}
