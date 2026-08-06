import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomStopSaleDate } from './hotel-room-stop-sale-date.entity';
import { HotelRoomDateOverride } from './hotel-room-date-override.entity';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { HotelRoomUnitsService } from './hotel-room-units.service';

export interface HotelAvailabilityCheckInput {
  tenantId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  excludeReservationId?: string;
}

export interface HotelAvailabilityCheckResult {
  ok: boolean;
  reason?: string;
}

/** Real per-day availability check on reservation create/update — mirrors
 * bookings/bookings-availability.service.ts's checkConflict shape. Considers all three
 * independent "unavailable" signals this module already has (room-type-wide stopSale,
 * per-date wholesale HotelRoomStopSaleDate, per-date retail HotelRoomDateOverride.blocked) plus
 * real capacity (active HotelRoomUnit count, falling back to HotelRoomType.quantity when no
 * units are defined yet for that room type). */
@Injectable()
export class HotelAvailabilityService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypeRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomStopSaleDate)
    private readonly stopSaleDatesRepo: Repository<HotelRoomStopSaleDate>,
    @InjectRepository(HotelRoomDateOverride)
    private readonly overridesRepo: Repository<HotelRoomDateOverride>,
    private readonly roomTypesService: HotelRoomTypesService,
    private readonly roomUnitsService: HotelRoomUnitsService,
  ) {}

  async checkAvailability(input: HotelAvailabilityCheckInput): Promise<HotelAvailabilityCheckResult> {
    const roomType = await this.roomTypeRepo.findOne({ where: { id: input.roomTypeId, tenantId: input.tenantId } });
    if (!roomType) return { ok: false, reason: 'Тип номера не найден' };

    const hotel = await this.hotelRepo.findOne({ where: { id: roomType.hotelId, tenantId: input.tenantId } });
    if (hotel?.allowOverbooking) return { ok: true };
    if (roomType.stopSale) return { ok: false, reason: 'Тип номера закрыт для продаж (стоп-продажа)' };

    const [stopDates, overrides, activeUnits, dayCounts] = await Promise.all([
      this.stopSaleDatesRepo.find({ where: { tenantId: input.tenantId, roomTypeId: input.roomTypeId } }),
      this.overridesRepo.find({ where: { tenantId: input.tenantId, roomTypeId: input.roomTypeId } }),
      this.roomUnitsService.countActiveUnits(input.tenantId, input.roomTypeId),
      this.roomTypesService.getConcurrentCountsByDay(
        input.tenantId,
        input.roomTypeId,
        input.checkIn,
        input.checkOut,
        input.excludeReservationId,
      ),
    ]);
    const stopSet = new Set(stopDates.map((d) => d.date));
    const blockedSet = new Set(overrides.filter((o) => o.blocked).map((o) => o.date));
    const capacity = activeUnits > 0 ? activeUnits : roomType.quantity;

    for (const [date, count] of Object.entries(dayCounts)) {
      if (stopSet.has(date)) return { ok: false, reason: `Дата ${date} закрыта для продаж (стоп-дата)` };
      if (blockedSet.has(date)) return { ok: false, reason: `Дата ${date} заблокирована в календаре` };
      if (count >= capacity) {
        return { ok: false, reason: `Нет свободных номеров на ${date} (занято ${count} из ${capacity})` };
      }
    }
    return { ok: true };
  }
}
