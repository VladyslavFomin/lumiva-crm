import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelGuestProfilesService } from './hotel-guest-profiles.service';
import { Hotel } from './hotel.entity';
import { hotelToday } from './hotel-folio.service';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Экран дня ресепшна (PMS-060): кто заезжает/выезжает, кто уже оформлен, кто живёт, кто не заехал, какие опционы истекают. */
@Injectable()
export class HotelFrontDeskService {
  constructor(
    @InjectRepository(HotelReservation)
    private readonly repo: Repository<HotelReservation>,
    @InjectRepository(Hotel)
    private readonly hotels: Repository<Hotel>,
    private readonly guestProfiles: HotelGuestProfilesService,
  ) {}

  async today(tenantId: string, date?: string, hotelId?: string) {
    // день стойки по времени отеля (в Турции с 21:00 UTC уже завтра); все отели — по первому отелю тенанта
    const hotel = await this.hotels.findOne({ where: hotelId ? { id: hotelId, tenantId } : { tenantId }, order: { createdAt: 'ASC' } as any });
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : hotel ? hotelToday(hotel) : todayIso();

    const base = () => {
      const qb = this.repo.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId });
      if (hotelId) qb.andWhere('r.hotelId = :hotelId', { hotelId });
      return qb;
    };
    const waiting = ['confirmed', 'pending'];

    const [arrivals, arrived, departures, departed, inHouse, overdue, noShowCandidates, optionsExpiring] = await Promise.all([
      base().andWhere('r.checkIn = :day', { day }).andWhere('r.status IN (:...st)', { st: waiting }).orderBy('r.guestName', 'ASC').getMany(),
      base().andWhere('r.checkIn = :day', { day }).andWhere('r.status IN (:...st)', { st: ['checked_in', 'checked_out'] }).orderBy('r.checkedInAt', 'DESC').getMany(),
      base().andWhere('r.checkOut = :day', { day }).andWhere('r.status = :st', { st: 'checked_in' }).orderBy('r.guestName', 'ASC').getMany(),
      base().andWhere('r.checkOut = :day', { day }).andWhere('r.status = :st', { st: 'checked_out' }).orderBy('r.checkedOutAt', 'DESC').getMany(),
      base().andWhere('r.checkIn <= :day', { day }).andWhere('r.checkOut > :day', { day }).andWhere('r.status = :st', { st: 'checked_in' }).orderBy('r.checkOut', 'ASC').getMany(),
      // выезд прошёл, а гость всё ещё «заселён» — забыли выселить или продлили на словах
      base().andWhere('r.checkOut < :day', { day }).andWhere('r.status = :st', { st: 'checked_in' }).orderBy('r.checkOut', 'ASC').getMany(),
      // дата заезда прошла, а гость не заселён — кандидаты в no-show
      base().andWhere('r.checkIn < :day', { day }).andWhere('r.checkOut > :minDay', { minDay: addDays(day, -30) }).andWhere('r.status IN (:...st)', { st: waiting }).orderBy('r.checkIn', 'ASC').getMany(),
      base().andWhere('r.status = :st', { st: 'pending' }).andWhere('r.optionUntil IS NOT NULL').andWhere('r.optionUntil < :until', { until: new Date(`${addDays(day, 2)}T00:00:00Z`) }).orderBy('r.optionUntil', 'ASC').getMany(),
    ]);

    // гость: VIP, чёрный список, сколько раз жил, предпочтения — чтобы стойка видела до заселения
    const all = [...arrivals, ...arrived, ...departures, ...departed, ...inHouse, ...overdue, ...noShowCandidates, ...optionsExpiring];
    const guestProfiles = await this.guestProfiles.briefMany(tenantId, [...new Set(all.map((r) => r.guestProfileId).filter((x): x is string => !!x))]);

    return {
      date: day,
      guestProfiles,
      arrivals,
      arrived,
      departures,
      departed,
      inHouse,
      overdue,
      noShowCandidates,
      optionsExpiring,
      inHouseCount: inHouse.length,
    };
  }
}
