import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelRoomUnit, HotelRoomUnitHousekeepingStatus } from './hotel-room-unit.entity';
import { HotelRoomType } from './hotel-room-type.entity';

export interface HotelRoomUnitFilters {
  hotelId?: string;
  roomTypeId?: string;
}

@Injectable()
export class HotelRoomUnitsService {
  constructor(
    @InjectRepository(HotelRoomUnit)
    private readonly repo: Repository<HotelRoomUnit>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypeRepo: Repository<HotelRoomType>,
  ) {}

  list(tenantId: string, filters: HotelRoomUnitFilters) {
    const where: Record<string, unknown> = { tenantId };
    if (filters.hotelId) where.hotelId = filters.hotelId;
    if (filters.roomTypeId) where.roomTypeId = filters.roomTypeId;
    return this.repo.find({ where, order: { label: 'ASC' } });
  }

  async get(tenantId: string, id: string) {
    const unit = await this.repo.findOne({ where: { id, tenantId } });
    if (!unit) throw new NotFoundException('Номер не найден');
    return unit;
  }

  async create(tenantId: string, dto: { roomTypeId: string; label: string; note?: string | null }) {
    const roomType = await this.roomTypeRepo.findOne({ where: { id: dto.roomTypeId, tenantId } });
    if (!roomType) throw new NotFoundException('Тип номера не найден');

    try {
      return await this.repo.save(
        this.repo.create({
          tenantId,
          hotelId: roomType.hotelId,
          roomTypeId: roomType.id,
          label: dto.label.trim(),
          note: dto.note ?? null,
        }),
      );
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new BadRequestException('Номер с таким названием уже существует в этом отеле');
      }
      throw error;
    }
  }

  async update(tenantId: string, id: string, dto: Partial<{ label: string; note: string | null; active: boolean }>) {
    const unit = await this.get(tenantId, id);
    Object.assign(unit, dto);
    try {
      return await this.repo.save(unit);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new BadRequestException('Номер с таким названием уже существует в этом отеле');
      }
      throw error;
    }
  }

  async updateHousekeeping(tenantId: string, id: string, status: HotelRoomUnitHousekeepingStatus) {
    const unit = await this.get(tenantId, id);
    unit.housekeepingStatus = status;
    return this.repo.save(unit);
  }

  async remove(tenantId: string, id: string) {
    const unit = await this.get(tenantId, id);
    await this.repo.remove(unit);
    return { ok: true };
  }

  /** Active-unit count for a room type — used by availability checks as the real per-room
   * capacity when units exist, falling back to HotelRoomType.quantity when none are defined
   * yet (see HotelAvailabilityService). */
  countActiveUnits(tenantId: string, roomTypeId: string): Promise<number> {
    return this.repo.count({ where: { tenantId, roomTypeId, active: true } });
  }
}
