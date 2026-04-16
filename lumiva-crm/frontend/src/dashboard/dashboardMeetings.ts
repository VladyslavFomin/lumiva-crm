export type DashboardCalendarEntryKind = 'meeting' | 'note';

export interface DashboardMeeting {
  id: string;
  /** Встреча (со временем и участниками) или заметка на день */
  kind: DashboardCalendarEntryKind;
  title: string;
  startsAt: string;
  endsAt: string;
  body: string;
  /** Ссылка на звонок (Zoom, Meet, Teams…) */
  meetingUrl?: string;
  attendeeEmails: string[];
  leadIds: string[];
  departmentIds: string[];
  createdAt: string;
  /** После синка с лидом — для подтягивания деталей из Google Calendar */
  googleCalendarEventId?: string;
}

const KEY = 'lumiva_dashboard_meetings_v2';

export function loadMeetings(): DashboardMeeting[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const legacy = localStorage.getItem('lumiva_dashboard_meetings_v1');
      if (legacy) {
        const parsed = JSON.parse(legacy) as Partial<DashboardMeeting>[];
        const migrated = Array.isArray(parsed)
          ? parsed.map((m) => ({
              ...m,
              kind: (m as DashboardMeeting).kind || 'meeting',
              meetingUrl: (m as DashboardMeeting).meetingUrl || '',
            })) as DashboardMeeting[]
          : [];
        saveMeetings(migrated);
        try {
          localStorage.removeItem('lumiva_dashboard_meetings_v1');
        } catch {
          /* ignore */
        }
        return migrated;
      }
      return [];
    }
    const parsed = JSON.parse(raw) as DashboardMeeting[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m) => ({
      ...m,
      kind: m.kind || 'meeting',
      meetingUrl: m.meetingUrl || '',
    }));
  } catch {
    return [];
  }
}

export function saveMeetings(items: DashboardMeeting[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}
