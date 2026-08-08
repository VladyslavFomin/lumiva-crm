// src/calendar/calendar.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { Reservation } from '../bookings/reservation.entity';
import { HotelReservation } from '../hotels/hotel-reservation.entity';

export type CalendarEventType = 'lead_meeting' | 'project_task' | 'booking' | 'hotel_reservation';

export interface CalendarEventDto {
  id: string;
  type: CalendarEventType;
  title: string;
  subtitle: string | null;
  date: string;
  endDate: string | null;
  link: string;
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Reservation) private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(HotelReservation) private readonly hotelReservationRepo: Repository<HotelReservation>,
  ) {}

  async getEvents(tenantId: string, from: Date, to: Date): Promise<CalendarEventDto[]> {
    const [leads, projects, reservations, hotelReservations] = await Promise.all([
      this.leadRepo.find({ where: { tenantId } }),
      this.projectRepo.find({ where: { tenantId } }),
      this.reservationRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId', { tenantId })
        .andWhere('r.startAt >= :from AND r.startAt <= :to', { from, to })
        .getMany(),
      this.hotelReservationRepo
        .createQueryBuilder('h')
        .where('h.tenantId = :tenantId', { tenantId })
        .andWhere('h."checkIn" >= :fromDate AND h."checkIn" <= :toDate', {
          fromDate: from.toISOString().slice(0, 10),
          toDate: to.toISOString().slice(0, 10),
        })
        .getMany(),
    ]);

    const events: CalendarEventDto[] = [];
    const inRange = (d: Date) => d >= from && d <= to;

    // Lead meetings — stored as unstructured JSON in Lead.meta.meetings[], not a typed column.
    for (const lead of leads) {
      const meetings = (lead.meta as any)?.meetings;
      if (!Array.isArray(meetings)) continue;
      const leadName = (lead.name || '').trim() || '—';
      for (const m of meetings) {
        if (!m || typeof m.id !== 'string' || typeof m.startsAt !== 'string') continue;
        if (m.closedAt) continue;
        const date = new Date(m.startsAt);
        if (Number.isNaN(date.getTime()) || !inRange(date)) continue;
        events.push({
          id: `lead_meeting:${lead.id}:${m.id}`,
          type: 'lead_meeting',
          title: String(m.title || '').trim() || 'Встреча',
          subtitle: leadName,
          date: date.toISOString(),
          endDate: m.endsAt ? new Date(m.endsAt).toISOString() : null,
          link: '/leads/calendar',
        });
      }
    }

    // Project task deadlines — Project.tasks is a simple-json array, not a typed entity.
    for (const project of projects) {
      const tasks = project.tasks;
      if (!Array.isArray(tasks)) continue;
      for (const task of tasks) {
        if (!task?.deadline) continue;
        const date = new Date(task.deadline);
        if (Number.isNaN(date.getTime()) || !inRange(date)) continue;
        events.push({
          id: `project_task:${project.id}:${task.id}`,
          type: 'project_task',
          title: String(task.title || '').trim() || 'Задача',
          subtitle: project.name,
          date: date.toISOString(),
          endDate: null,
          link: `/projects/${project.id}`,
        });
      }
    }

    for (const r of reservations) {
      events.push({
        id: `booking:${r.id}`,
        type: 'booking',
        title: r.customerName?.trim() || 'Бронирование',
        subtitle: null,
        date: r.startAt.toISOString(),
        endDate: r.endAt ? r.endAt.toISOString() : null,
        link: `/bookings/reservations/${r.id}`,
      });
    }

    for (const h of hotelReservations) {
      events.push({
        id: `hotel_reservation:${h.id}`,
        type: 'hotel_reservation',
        title: h.guestName?.trim() || 'Заезд',
        subtitle: null,
        date: new Date(h.checkIn).toISOString(),
        endDate: h.checkOut ? new Date(h.checkOut).toISOString() : null,
        link: '/hotels/reservations',
      });
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }
}
