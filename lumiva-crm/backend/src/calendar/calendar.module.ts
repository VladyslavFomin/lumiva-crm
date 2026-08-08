// src/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { Reservation } from '../bookings/reservation.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, Project, Reservation, HotelReservation])],
  providers: [CalendarService],
  controllers: [CalendarController],
})
export class CalendarModule {}
