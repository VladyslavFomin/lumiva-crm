// src/api/calendar.ts
import { api } from './client';

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

export function fetchCalendarEvents(from: Date, to: Date): Promise<CalendarEventDto[]> {
  return api.get<CalendarEventDto[]>('/calendar/events', {
    params: { from: from.toISOString(), to: to.toISOString() },
  });
}
