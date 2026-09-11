import { api } from './client';

export type CalendarEventType = 'lead_meeting' | 'project_task' | 'booking' | 'hotel_reservation' | 'custom_date';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  subtitle: string | null;
  date: string;
  endDate: string | null;
  link: string;
  assignee?: string | null;
}

export async function fetchCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const res = await api.get<CalendarEvent[]>('/calendar/events', { params: { from, to } });
  return res.data;
}

/** The backend encodes the source entity id as the 2nd `:`-separated segment of every event id
 * (`type:entityId[:subId]`) — used to deep-link into the matching detail screen where one exists. */
export function calendarEventEntityId(event: CalendarEvent): string | null {
  const parts = event.id.split(':');
  return parts[1] || null;
}
