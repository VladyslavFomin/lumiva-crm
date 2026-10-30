import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomStopSaleDate } from './hotel-room-stop-sale-date.entity';
import { HotelRoomDateOverride } from './hotel-room-date-override.entity';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { HotelRoomUnitsService } from './hotel-room-units.service';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelContract } from './hotel-contract.entity';
import { HotelRoomBlock } from './hotel-room-block.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelRoomOutage } from './hotel-housekeeping.entities';
import { allotmentOn, blockHolds, isReleased, nightsOf, todayStr } from './hotel-contracts.service';

export interface HotelAvailabilityCheckInput {
  tenantId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  excludeReservationId?: string;
  /** Контракт/блок брони: их квота и удержание расходуются этой бронью, а не свободным фондом */
  contractId?: string | null;
  blockId?: string | null;
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
    @InjectRepository(HotelReservation)
    private readonly reservationsRepo: Repository<HotelReservation>,
    @InjectRepository(HotelContract)
    private readonly contractsRepo: Repository<HotelContract>,
    @InjectRepository(HotelRoomBlock)
    private readonly blocksRepo: Repository<HotelRoomBlock>,
    @InjectRepository(HotelRoomUnit)
    private readonly unitsRepo: Repository<HotelRoomUnit>,
    @InjectRepository(HotelRoomOutage)
    private readonly outagesRepo: Repository<HotelRoomOutage>,
    private readonly roomTypesService: HotelRoomTypesService,
    private readonly roomUnitsService: HotelRoomUnitsService,
  ) {}

  async checkAvailability(input: HotelAvailabilityCheckInput): Promise<HotelAvailabilityCheckResult> {
    const roomType = await this.roomTypeRepo.findOne({ where: { id: input.roomTypeId, tenantId: input.tenantId } });
    if (!roomType) return { ok: false, reason: 'Тип номера не найден' };

    const hotel = await this.hotelRepo.findOne({ where: { id: roomType.hotelId, tenantId: input.tenantId } });
    const contract = input.contractId
      ? await this.contractsRepo.findOne({ where: { id: input.contractId, tenantId: input.tenantId } })
      : null;
    const line = contract?.rooms.find((l) => l.roomTypeId === input.roomTypeId) || null;
    const nights = nightsOf(input.checkIn, input.checkOut);
    if (contract && nights.length < (contract.minStay || 1)) {
      return { ok: false, reason: `Минимум ночей по контракту «${contract.name}»: ${contract.minStay}` };
    }
    if (line) {
      const stop = nights.find((d) => (line.stopDates || []).includes(d));
      if (stop) return { ok: false, reason: `Дата ${stop} закрыта для партнёра (стоп-продажа по контракту)` };
    }
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

    // Удержания: подтверждённые блоки до отсечки и гарантированные квоты до release держат
    // невыкупленные номера — другим броням они не достаются.
    const [blocks, guaranteed, others] = await Promise.all([
      this.blocksRepo.find({ where: { tenantId: input.tenantId, roomTypeId: input.roomTypeId, status: 'definite' } }),
      this.contractsRepo.find({ where: { tenantId: input.tenantId, hotelId: roomType.hotelId, status: 'active', guaranteed: true } }),
      this.reservationsRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.roomTypeId = :roomTypeId', { tenantId: input.tenantId, roomTypeId: input.roomTypeId })
        .andWhere("r.status NOT IN ('cancelled','no_show')")
        .andWhere('r.checkIn < :to AND r.checkOut > :from', { from: input.checkIn, to: input.checkOut })
        .andWhere(input.excludeReservationId ? 'r.id <> :ex' : '1=1', { ex: input.excludeReservationId })
        .getMany(),
    ]);
    const today = todayStr();
    const on = (d: string) => others.filter((r) => r.checkIn <= d && r.checkOut > d);
    // номера, снятые с продажи на период (OOO), уменьшают вместимость в эти ночи
    const oooOn = await this.oooCounter(input.tenantId, input.roomTypeId, input.checkIn, input.checkOut, activeUnits > 0);

    for (const [date, count] of Object.entries(dayCounts)) {
      if (stopSet.has(date)) return { ok: false, reason: `Дата ${date} закрыта для продаж (стоп-дата)` };
      if (blockedSet.has(date)) return { ok: false, reason: `Дата ${date} заблокирована в календаре` };
      const day = on(date);
      let ownHeldLeft = 0;
      let held = 0;
      for (const b of blocks) {
        if (!blockHolds(b, today) || date < b.dateFrom || date >= b.dateTo) continue;
        const left = Math.max(0, b.rooms - day.filter((r) => r.blockId === b.id).length);
        if (b.id === input.blockId) ownHeldLeft += left;
        else held += left;
      }
      for (const c of guaranteed) {
        const l = c.rooms.find((x) => x.roomTypeId === input.roomTypeId);
        if (!l || isReleased(c, l, date, today)) continue;
        const left = Math.max(0, allotmentOn(c, l, date) - day.filter((r) => r.contractId === c.id).length);
        if (c.id === input.contractId) ownHeldLeft += left;
        else held += left;
      }
      // своя квота партнёра: сверх неё — только если контракт разрешает продажу из свободного фонда
      if (contract && line) {
        const allot = isReleased(contract, line, date, today) ? 0 : allotmentOn(contract, line, date);
        const sold = day.filter((r) => r.contractId === contract.id).length;
        if (sold >= allot && !contract.allowOverAllotment) {
          return { ok: false, reason: `Квота партнёра по контракту «${contract.name}» на ${date} исчерпана (${sold} из ${allot})` };
        }
      }
      if (ownHeldLeft > 0) continue;
      if (count + held + ownHeldLeft >= capacity - oooOn(date)) {
        return {
          ok: false,
          reason: held
            ? `Нет свободных номеров на ${date}: занято ${count}, держат блоки/квоты ${held}, всего ${capacity}`
            : `Нет свободных номеров на ${date} (занято ${count} из ${capacity})`,
        };
      }
    }
    return { ok: true };
  }

  /** Сколько номеров типа снято с продажи (OOO и «не работает») на дату — общий для проверки и выгрузки в каналы */
  async oooCounter(tenantId: string, roomTypeId: string, from: string, to: string, unitBased: boolean): Promise<(date: string) => number> {
    if (!unitBased) return () => 0;
    const units = await this.unitsRepo.find({ where: { tenantId, roomTypeId, active: true }, select: ['id', 'housekeepingStatus'] });
    // номер со статусом «не работает» снят с продажи на все дни — так же, как его показывает шахматка
    const brokenIds = new Set(units.filter((u) => u.housekeepingStatus === 'out_of_order').map((u) => u.id));
    const unitIds = units.map((u) => u.id);
    if (!unitIds.length) return () => 0;
    const outs = await this.outagesRepo
      .createQueryBuilder('o')
      .where('o.tenantId = :tenantId AND o.kind = :kind', { tenantId, kind: 'ooo' })
      .andWhere('o.roomUnitId IN (:...unitIds)', { unitIds })
      .andWhere('o.dateFrom < :to', { to })
      .andWhere('(o.dateTo IS NULL OR o.dateTo > :from)', { from })
      .getMany();
    return (date: string) => new Set([...brokenIds, ...outs.filter((o) => o.dateFrom <= date && (!o.dateTo || date < o.dateTo)).map((o) => o.roomUnitId)]).size;
  }
}
