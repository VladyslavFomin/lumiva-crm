import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelReservation } from './hotel-reservation.entity';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class HotelFrontDeskService {
  constructor(
    @InjectRepository(HotelReservation)
    private readonly repo: Repository<HotelReservation>,
  ) {}

  async today(tenantId: string, date?: string, hotelId?: string) {
    const day = date || todayIso();

    const base = () => {
      const qb = this.repo.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId });
      if (hotelId) qb.andWhere('r.hotelId = :hotelId', { hotelId });
      return qb;
    };

    const [arrivals, departures, inHouseCount] = await Promise.all([
      base()
        .andWhere('r.checkIn = :day', { day })
        .andWhere('r.status IN (:...statuses)', { statuses: ['confirmed', 'pending'] })
        .orderBy('r.guestName', 'ASC')
        .getMany(),
      base()
        .andWhere('r.checkOut = :day', { day })
        .andWhere('r.status = :status', { status: 'checked_in' })
        .orderBy('r.guestName', 'ASC')
        .getMany(),
      base()
        .andWhere('r.checkIn <= :day', { day })
        .andWhere('r.checkOut > :day', { day })
        .andWhere('r.status = :status', { status: 'checked_in' })
        .getCount(),
    ]);

    return { date: day, arrivals, departures, inHouseCount };
  }
}
