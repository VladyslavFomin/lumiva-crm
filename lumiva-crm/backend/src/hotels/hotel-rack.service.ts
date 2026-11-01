import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isInfant } from './hotel-occupancy.util';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelAgency } from './hotel-agency.entity';
import { HotelRoomOutage } from './hotel-housekeeping.entities';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** «101», «102», «1001», «A12» — номера сортируются как числа, а не как строки */
const labelCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Шахматка (PMS-010…014): номера × дни с бронями одного отеля за окно дат. Отдаёт компактные брони
 * без паспортных данных гостей — шахматку видят все с правом `hotels`, не только ресепшн. */
@Injectable()
export class HotelRackService {
  constructor(
    @InjectRepository(Hotel) private readonly hotelRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypeRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit) private readonly unitRepo: Repository<HotelRoomUnit>,
    @InjectRepository(HotelReservation) private readonly reservationRepo: Repository<HotelReservation>,
    @InjectRepository(HotelAgency) private readonly agencyRepo: Repository<HotelAgency>,
    @InjectRepository(HotelRoomOutage) private readonly outageRepo: Repository<HotelRoomOutage>,
  ) {}

  async rack(tenantId: string, hotelId: string, from: string, days: number) {
    if (!hotelId) throw new BadRequestException({ code: 'HOTEL_RACK_HOTEL_REQUIRED', message: 'Не выбран отель' });
    if (!ISO_DATE.test(from || '')) throw new BadRequestException({ code: 'HOTEL_RACK_BAD_DATES', message: 'Неверная дата' });
    const span = Math.min(62, Math.max(1, Math.round(Number(days) || 14)));
    const to = addDays(from, span);

    const hotel = await this.hotelRepo.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');

    const [roomTypes, units, reservations, outages] = await Promise.all([
      this.roomTypeRepo.find({ where: { tenantId, hotelId }, order: { createdAt: 'ASC' } }),
      this.unitRepo.find({ where: { tenantId, hotelId } }),
      this.reservationRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId', { tenantId })
        .andWhere('r.hotelId = :hotelId', { hotelId })
        .andWhere('r.status NOT IN (:...inactive)', { inactive: ['cancelled', 'no_show'] })
        .andWhere('r.checkIn < :to', { to })
        .andWhere('r.checkOut > :from', { from })
        .orderBy('r.checkIn', 'ASC')
        .getMany(),
      this.outageRepo
        .createQueryBuilder('o')
        .where('o.tenantId = :tenantId AND o.hotelId = :hotelId', { tenantId, hotelId })
        .andWhere('o.dateFrom < :to', { to })
        .andWhere('(o.dateTo IS NULL OR o.dateTo > :from)', { from })
        .getMany(),
    ]);

    const agencyIds = [...new Set(reservations.map((r) => r.agencyId).filter((x): x is string => !!x))];
    const agencies = agencyIds.length
      ? await this.agencyRepo.find({ where: { tenantId, id: In(agencyIds) }, select: ['id', 'name'] })
      : [];

    units.sort((a, b) => labelCollator.compare(a.label, b.label));

    return {
      hotel: { id: hotel.id, name: hotel.name, currency: hotel.currency, checkInTime: hotel.checkInTime, checkOutTime: hotel.checkOutTime },
      from,
      to,
      days: span,
      roomTypes: roomTypes.map((rt) => ({ id: rt.id, name: rt.name, quantity: rt.quantity, stopSale: rt.stopSale })),
      // неактивные номера нужны, только если на них ещё висят брони окна — иначе бронь «пропала бы» из шахматки
      units: units
        .filter((u) => u.active || reservations.some((r) => r.roomUnitId === u.id))
        .map((u) => ({ id: u.id, roomTypeId: u.roomTypeId, label: u.label, housekeepingStatus: u.housekeepingStatus, note: u.note, active: u.active, floor: u.floor, building: u.building, features: u.features || [] })),
      outages: outages.map((o) => ({ id: o.id, roomUnitId: o.roomUnitId, kind: o.kind, dateFrom: o.dateFrom, dateTo: o.dateTo, reason: o.reason, note: o.note })),
      agencies: agencies.map((a) => ({ id: a.id, name: a.name })),
      reservations: reservations.map((r) => ({
        id: r.id,
        hotelId: r.hotelId,
        roomTypeId: r.roomTypeId,
        roomUnitId: r.roomUnitId,
        agencyId: r.agencyId,
        guestName: r.guestName,
        guestPhone: r.guestPhone,
        guestEmail: r.guestEmail,
        guestCountry: r.guestCountry,
        pax: r.pax,
        children: r.children,
        /** младенцы до 2 лет — бесплатно, нужна детская кроватка */
        infants: (r.childAges || []).filter(isInfant).length,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        status: r.status,
        paidStatus: r.paidStatus,
        total: r.total,
        paidAmount: String((r.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)),
        grossPerNight: r.grossPerNight,
        boardType: r.boardType,
        bookingCode: r.bookingCode,
        source: r.source,
        blockId: r.blockId,
        earlyCheckIn: r.earlyCheckIn,
        lateCheckOut: r.lateCheckOut,
        notes: r.notes,
        guestsCount: (r.guests || []).length,
        optionUntil: r.optionUntil,
        isComplimentary: r.isComplimentary,
        extrasTotal: r.extrasTotal,
        cancellationFee: r.cancellationFee,
      })),
    };
  }
}
