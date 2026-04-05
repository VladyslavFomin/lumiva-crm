import type { Lead } from '../api/leads';

/** Встречи из meta.lead — те же, что создаёт ИИ (crm_add_lead_meeting). */
export type LeadMeetingCalendarEvent = {
  leadId: string;
  leadName: string;
  meetingId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetingUrl?: string;
  notes?: string;
};

export function flattenLeadMeetingsFromLeads(leads: Lead[]): LeadMeetingCalendarEvent[] {
  const out: LeadMeetingCalendarEvent[] = [];
  for (const lead of leads) {
    const raw = (lead.meta as any)?.meetings;
    if (!Array.isArray(raw)) continue;
    const leadName = (lead.name || '').trim() || '—';
    for (const item of raw) {
      if (!item || typeof item.id !== 'string' || typeof item.startsAt !== 'string') continue;
      out.push({
        leadId: lead.id,
        leadName,
        meetingId: item.id,
        title: String(item.title || '').trim() || '—',
        startsAt: String(item.startsAt),
        endsAt: item.endsAt ? String(item.endsAt) : '',
        meetingUrl: item.meetingUrl ? String(item.meetingUrl) : undefined,
        notes: item.notes ? String(item.notes) : undefined,
      });
    }
  }
  return out;
}
