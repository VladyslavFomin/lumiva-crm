import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchEmailAccounts, sendEmail } from '../api/email';
import {
  fetchGoogleCalendarEventSnapshot,
  type GoogleCalendarEventSnapshot,
} from '../api/integrations';
import { fetchLeadById, updateLead } from '../api/leads';
import { fetchStaff, type StaffUser } from '../api/staff';
import { fetchDepartments, type Department } from '../api/departments';
import { buildIcsEvent, icsToBase64 } from './dashboardIcs';
import { loadMeetings, saveMeetings, type DashboardMeeting } from './dashboardMeetings';
import { parseDatetimeLocalValue, toLocalDateKey } from '../utils/calendarLocalDates';
import type { LeadMeetingCalendarEvent } from './flattenLeadMeetings';

type LeadOpt = { id: string; name: string };

type CalendarEntry =
  | { source: 'local'; m: DashboardMeeting }
  | { source: 'lead'; e: LeadMeetingCalendarEvent };

function leadEventCoversDay(e: LeadMeetingCalendarEvent, dayKey: string): boolean {
  const startKey = toLocalDateKey(new Date(e.startsAt));
  const endKey = toLocalDateKey(new Date(e.endsAt || e.startsAt));
  return !!(startKey && endKey && dayKey >= startKey && dayKey <= endKey);
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + delta);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const DashboardCalendarMini: React.FC<{
  locale: string;
  leads: LeadOpt[];
  /** Встречи из лидов (CRM / ИИ) — отображаются вместе с локальными записями */
  leadMeetings?: LeadMeetingCalendarEvent[];
}> = ({ locale, leads, leadMeetings = [] }) => {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [meetings, setMeetings] = useState<DashboardMeeting[]>(() => loadMeetings());
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modal, setModal] = useState<'compose' | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [draft, setDraft] = useState({
    kind: 'meeting' as 'meeting' | 'note',
    title: '',
    body: '',
    startLocal: '',
    endLocal: '',
    meetingUrl: '',
    leadIds: [] as string[],
    staffIds: [] as string[],
    departmentIds: [] as string[],
  });

  type GcalEntry = { loading?: boolean; data?: GoogleCalendarEventSnapshot; error?: string };
  const [gcalDetails, setGcalDetails] = useState<Record<string, GcalEntry>>({});
  const gcalFetchedRef = useRef(new Set<string>());

  const loadGoogleEventDetails = useCallback((cacheKey: string, googleEventId: string) => {
    const gid = googleEventId.trim();
    if (!gid || gcalFetchedRef.current.has(cacheKey)) return;
    gcalFetchedRef.current.add(cacheKey);
    setGcalDetails((prev) => ({ ...prev, [cacheKey]: { loading: true } }));
    void fetchGoogleCalendarEventSnapshot(gid)
      .then((data) => {
        setGcalDetails((prev) => ({ ...prev, [cacheKey]: { data } }));
      })
      .catch((e: unknown) => {
        gcalFetchedRef.current.delete(cacheKey);
        const msg = e instanceof Error ? e.message : String(e);
        setGcalDetails((prev) => ({ ...prev, [cacheKey]: { error: msg } }));
      });
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchStaff().catch(() => []), fetchDepartments().catch(() => [])]).then(
      ([s, d]) => {
        if (!alive) return;
        setStaff(Array.isArray(s) ? s.filter((x) => x.isActive) : []);
        setDepartments(Array.isArray(d) ? d : []);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    saveMeetings(meetings);
  }, [meetings]);

  const monthLabel = useMemo(
    () => cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    [cursor, locale],
  );

  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const startWeekday = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const entriesForDay = useCallback(
    (day: Date | null): CalendarEntry[] => {
      if (!day) return [];
      const dayKey = toLocalDateKey(day);
      if (!dayKey) return [];
      const list: CalendarEntry[] = [];
      for (const m of meetings) {
        const startKey = toLocalDateKey(new Date(m.startsAt));
        const endKey = toLocalDateKey(new Date(m.endsAt || m.startsAt));
        if (startKey && endKey && dayKey >= startKey && dayKey <= endKey) {
          list.push({ source: 'local', m });
        }
      }
      for (const e of leadMeetings) {
        if (leadEventCoversDay(e, dayKey)) list.push({ source: 'lead', e });
      }
      list.sort((a, b) => {
        const ta = new Date(
          a.source === 'local' ? a.m.startsAt : a.e.startsAt,
        ).getTime();
        const tb = new Date(
          b.source === 'local' ? b.m.startsAt : b.e.startsAt,
        ).getTime();
        return ta - tb;
      });
      return list;
    },
    [meetings, leadMeetings],
  );

  const composeDayEntries = useMemo(() => {
    if (!selectedDay) return [];
    return entriesForDay(selectedDay);
  }, [selectedDay, entriesForDay]);

  const openCreate = (day: Date) => {
    setComposeError(null);
    const y = day.getFullYear();
    const mo = day.getMonth();
    const da = day.getDate();
    const s = new Date(y, mo, da, 10, 0, 0, 0);
    const e = new Date(y, mo, da, 11, 0, 0, 0);
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(
        d.getMinutes(),
      )}`;
    setDraft({
      kind: 'meeting',
      title: '',
      body: '',
      startLocal: toLocal(s),
      endLocal: toLocal(e),
      meetingUrl: '',
      leadIds: [],
      staffIds: [],
      departmentIds: [],
    });
    setSelectedDay(day);
    setModal('compose');
  };

  const openCreateNote = (day: Date) => {
    setComposeError(null);
    const y = day.getFullYear();
    const mo = day.getMonth();
    const da = day.getDate();
    const s = new Date(y, mo, da, 10, 0, 0, 0);
    const e = new Date(y, mo, da, 11, 0, 0, 0);
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(
        d.getMinutes(),
      )}`;
    setDraft({
      kind: 'note',
      title: '',
      body: '',
      startLocal: toLocal(s),
      endLocal: toLocal(e),
      meetingUrl: '',
      leadIds: [],
      staffIds: [],
      departmentIds: [],
    });
    setSelectedDay(day);
    setModal('compose');
  };

  const collectEmails = (): string[] => {
    const set = new Set<string>();
    for (const id of draft.staffIds) {
      const u = staff.find((s) => s.id === id);
      if (u?.email) set.add(u.email.trim().toLowerCase());
    }
    for (const depId of draft.departmentIds) {
      const dep = departments.find((d) => d.id === depId);
      dep?.staff?.forEach((s) => {
        if (s.email) set.add(s.email.trim().toLowerCase());
      });
    }
    return [...set];
  };

  const dowLabels = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const x = new Date(2024, 0, 1 + i);
      out.push(x.toLocaleDateString(locale, { weekday: 'short' }));
    }
    return out;
  }, [locale]);

  const submitMeeting = async () => {
    setComposeError(null);
    const leadNamesLine = draft.leadIds
      .map((lid) => leads.find((l) => l.id === lid)?.name || lid)
      .join(', ');

    let start: Date;
    let end: Date;
    if (draft.kind === 'note') {
      const day = selectedDay || new Date(draft.startLocal);
      const y = day.getFullYear();
      const mo = day.getMonth();
      const da = day.getDate();
      start = new Date(y, mo, da, 0, 0, 0, 0);
      end = new Date(y, mo, da, 23, 59, 59, 999);
    } else {
      const s = parseDatetimeLocalValue(draft.startLocal);
      const e = parseDatetimeLocalValue(draft.endLocal);
      if (!s || !e) {
        setComposeError(t('crm.dashboard.calendar.validationTime'));
        return;
      }
      start = s;
      end = e;
    }

    const title =
      draft.title.trim() ||
      (draft.kind === 'note'
        ? t('crm.dashboard.calendar.untitledNote')
        : t('crm.dashboard.calendar.untitledMeeting'));

    const attendeeEmails = collectEmails();
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    let syncedGoogleEventId: string | undefined;
    if (draft.kind === 'meeting') {
      const leadIds = [...new Set(draft.leadIds)];
      if (leadIds.length > 0) {
        const attendeeNames = draft.staffIds
          .map((sid) => staff.find((u) => u.id === sid))
          .filter((u): u is StaffUser => Boolean(u))
          .map((u) => (u.fullName || u.email || '').trim())
          .filter(Boolean);
        const row = {
          id,
          title,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          meetingUrl: draft.meetingUrl.trim(),
          notes: draft.body.trim(),
          attendeeUserIds: [...draft.staffIds],
          attendeeNames,
          closedAt: '',
          notifySentAt: '',
          reminder24hSentAt: '',
          reminder1hSentAt: '',
        };
        try {
          for (const lid of leadIds) {
            const lead = await fetchLeadById(lid);
            const raw = (lead.meta as { meetings?: unknown } | undefined)?.meetings;
            const currentMeetings = Array.isArray(raw) ? [...raw] : [];
            const nextMeetings = [...currentMeetings, row];
            const updated = await updateLead(lid, {
              meta: { ...(lead.meta ?? {}), meetings: nextMeetings },
            });
            const meetingsAfter = (updated.meta as { meetings?: unknown[] } | undefined)?.meetings;
            const savedRow = Array.isArray(meetingsAfter)
              ? meetingsAfter.find(
                  (m) =>
                    m !== null &&
                    typeof m === 'object' &&
                    String((m as Record<string, unknown>).id ?? '') === id,
                )
              : undefined;
            const gid =
              savedRow && typeof savedRow === 'object'
                ? (savedRow as Record<string, unknown>).googleCalendarEventId
                : undefined;
            if (typeof gid === 'string' && gid.trim()) {
              syncedGoogleEventId = gid.trim();
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setComposeError(t('crm.dashboard.calendar.syncToLeadsFailed', { message: msg }));
          return;
        }
      }
    }

    const meeting: DashboardMeeting = {
      id,
      kind: draft.kind,
      title,
      body: draft.body.trim(),
      meetingUrl: draft.kind === 'meeting' ? draft.meetingUrl.trim() : '',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      attendeeEmails,
      leadIds: draft.leadIds,
      departmentIds: draft.departmentIds,
      createdAt: new Date().toISOString(),
      ...(syncedGoogleEventId ? { googleCalendarEventId: syncedGoogleEventId } : {}),
    };
    // Сохраняем в localStorage сразу в этом же колбэке: иначе в dev (Strict Mode)
    // компонент может размонтироваться до useEffect, и запись не попадёт в хранилище.
    setMeetings((prev) => {
      const next = [...prev, meeting];
      saveMeetings(next);
      return next;
    });
    setCursor((c) => {
      const y = start.getFullYear();
      const m = start.getMonth();
      if (c.getFullYear() === y && c.getMonth() === m) return c;
      return new Date(y, m, 1);
    });
    setComposeError(null);
    setModal(null);

    const urlLine =
      meeting.kind === 'meeting' && meeting.meetingUrl
        ? `${t('crm.dashboard.calendar.joinLink')}: ${meeting.meetingUrl}`
        : '';
    const ics = buildIcsEvent({
      uid: id,
      start,
      end,
      title: meeting.title,
      description: [
        meeting.body,
        urlLine,
        draft.leadIds.length ? `${t('crm.dashboard.calendar.leads')}: ${leadNamesLine}` : '',
        `${t('crm.dashboard.calendar.openCrm')}: ${window.location.origin}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      location: meeting.kind === 'meeting' && meeting.meetingUrl ? meeting.meetingUrl : undefined,
    });
    const b64 = icsToBase64(ics);

    try {
      const accounts = await fetchEmailAccounts();
      const account = accounts[0];
      if (!account || !attendeeEmails.length) return;

      const subject =
        meeting.kind === 'note'
          ? `[CRM] ${t('crm.dashboard.calendar.entryNote')}: ${meeting.title}`
          : `[CRM] ${meeting.title}`;
      const timeLine =
        meeting.kind === 'note'
          ? t('crm.dashboard.calendar.allDayNote')
          : `${t('crm.dashboard.calendar.time')}: ${start.toLocaleString(locale)} – ${end.toLocaleString(locale)}`;
      const linkBlock =
        meeting.kind === 'meeting' && meeting.meetingUrl
          ? `<p><a href="${meeting.meetingUrl}">${t('crm.dashboard.calendar.joinLink')}</a></p>`
          : '';
      const htmlBody = `
        <p><strong>${meeting.title}</strong></p>
        <p>${meeting.body.replace(/\n/g, '<br/>')}</p>
        <p>${timeLine}</p>
        ${linkBlock}
        <p><a href="${window.location.origin}">${t('crm.dashboard.calendar.openCrm')}</a></p>
      `;
      await sendEmail({
        accountId: account.id,
        to: attendeeEmails,
        subject,
        htmlBody,
        textBody: [
          meeting.title,
          meeting.body,
          timeLine,
          meeting.meetingUrl ? `${meeting.meetingUrl}` : '',
          window.location.origin,
        ]
          .filter(Boolean)
          .join('\n\n'),
        attachments: [
          {
            filename: meeting.kind === 'note' ? 'note.ics' : 'meeting.ics',
            contentType: 'text/calendar; charset=UTF-8',
            contentBase64: b64,
          },
        ],
      });
    } catch (e) {
      console.warn('Calendar entry saved; email not sent', e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-xl border border-neutral-200 px-2 py-1 text-[11px] hover:bg-neutral-50"
          onClick={() => setCursor((c) => addMonths(c, -1))}
        >
          ‹
        </button>
        <div className="text-xs font-medium text-[#222] capitalize">{monthLabel}</div>
        <button
          type="button"
          className="rounded-xl border border-neutral-200 px-2 py-1 text-[11px] hover:bg-neutral-50"
          onClick={() => setCursor((c) => addMonths(c, 1))}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-[2px] text-[9px] text-neutral-400 text-center mb-1 font-mono uppercase tracking-[0.06em]">
        {dowLabels.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[2px]">
        {grid.map((cell, idx) => {
          if (!cell) {
            return <div key={`e-${idx}`} />;
          }
          const entries = entriesForDay(cell);
          const hasEvents = entries.length > 0;
          const isToday = sameDay(cell, new Date());
          const isDim = cell.getMonth() !== cursor.getMonth();
          return (
            <button
              key={cell.toISOString()}
              type="button"
              onClick={() => openCreate(cell)}
              style={{ aspectRatio: '1/1', position: 'relative' }}
              className={
                'flex flex-col items-center justify-center rounded-[5px] text-[11px] font-mono cursor-pointer transition-colors ' +
                (isToday
                  ? 'bg-[#222] text-white font-medium'
                  : isDim
                  ? 'text-neutral-300 hover:bg-neutral-50'
                  : 'text-neutral-700 hover:bg-neutral-100')
              }
            >
              {cell.getDate()}
              {hasEvents && (
                <span
                  style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: isToday ? '#fff' : '#222' }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Today's events list with colored markers */}
      {(() => {
        const todayEntries = entriesForDay(new Date());
        if (!todayEntries.length) return null;
        return (
          <div className="border-t border-neutral-100 pt-3 flex flex-col gap-1.5">
            {todayEntries.map((ent) => {
              const key = ent.source === 'local' ? ent.m.id : `lm-${ent.e.leadId}-${ent.e.meetingId}`;
              const title = ent.source === 'local' ? ent.m.title : ent.e.title;
              const timeStr = ent.source === 'local'
                ? new Date(ent.m.startsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
                : new Date(ent.e.startsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
              const kind = ent.source === 'local' ? ent.m.kind : 'meeting';
              const markerColor = kind === 'note' ? '#1769d1' : '#1f8a5e';
              return (
                <div key={key} className="flex gap-2.5 items-start">
                  <div style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-[10.5px] text-neutral-400 w-[44px] shrink-0 pt-0.5 tracking-[0.02em]">{timeStr}</div>
                  <div style={{ width: 3, background: markerColor, borderRadius: 2, minHeight: 30, alignSelf: 'stretch' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#222] truncate leading-snug">{title || '—'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => openCreate(selectedDay || new Date())}
          className="rounded-2xl border border-lumiva-accent bg-lumiva-accent text-white text-[11px] font-semibold py-2 hover:opacity-90 transition-opacity"
        >
          + {t('crm.dashboard.calendar.newMeeting')}
        </button>
        <button
          type="button"
          onClick={() => openCreateNote(selectedDay || new Date())}
          className="rounded-2xl border border-neutral-200 bg-white text-[#222] text-[11px] font-semibold py-2 hover:bg-neutral-50"
        >
          + {t('crm.dashboard.calendar.newNote')}
        </button>
      </div>

      {modal &&
        createPortal(
          <div
            className="fixed inset-0 z-[10080] flex items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-sm"
            role="presentation"
            onMouseDown={() => {
              setComposeError(null);
              setModal(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dashboard-calendar-sheet-title"
              className="flex max-h-[min(92vh,760px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xl shadow-neutral-900/10 ring-1 ring-neutral-900/[0.04] sm:max-w-lg"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {modal === 'compose' && selectedDay && (
                <>
                  <header className="shrink-0 border-b border-neutral-100 px-4 pb-3 pt-4 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                          {t('crm.dashboard.calendar.sheetKicker')}
                        </p>
                        <h2
                          id="dashboard-calendar-sheet-title"
                          className="mt-0.5 text-lg font-semibold leading-snug text-[#222] capitalize sm:text-xl"
                        >
                          {selectedDay.toLocaleDateString(locale, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </h2>
                        <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                          {composeDayEntries.length === 0
                            ? t('crm.dashboard.calendar.sheetEmptyHint')
                            : t('crm.dashboard.calendar.sheetHasEvents', {
                                count: composeDayEntries.length,
                              })}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-[#222]"
                        aria-label={t('crm.common.close')}
                        onClick={() => {
                          setComposeError(null);
                          setModal(null);
                        }}
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </header>

                  {composeError ? (
                    <div
                      className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-900 sm:px-5"
                      role="alert"
                    >
                      {composeError}
                    </div>
                  ) : null}

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                    {composeDayEntries.length > 0 && (
                      <section className="mb-6">
                        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                          {t('crm.dashboard.calendar.existingEvents')}
                        </h3>
                        <div className="space-y-2">
                          {composeDayEntries.map((ent) =>
                            ent.source === 'lead' ? (
                              (() => {
                                const gKey = `gcal-lead-${ent.e.leadId}-${ent.e.meetingId}`;
                                const gState = gcalDetails[gKey];
                                const gd = gState?.data;
                                return (
                                  <details
                                    key={`lm-${ent.e.leadId}-${ent.e.meetingId}`}
                                    className="group rounded-xl border border-violet-200 bg-violet-50/80 text-[11px] [&_summary::-webkit-details-marker]:hidden"
                                    onToggle={(ev) => {
                                      const el = ev.currentTarget as HTMLDetailsElement;
                                      if (!el.open || !ent.e.googleCalendarEventId) return;
                                      loadGoogleEventDetails(gKey, ent.e.googleCalendarEventId);
                                    }}
                                  >
                                    <summary className="cursor-pointer list-none px-3 py-2.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 font-medium text-[#222]">{ent.e.title}</div>
                                        <div className="flex shrink-0 items-center gap-1">
                                          <span className="rounded-md bg-violet-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-900">
                                            {t('crm.dashboard.calendar.badgeLead')}
                                          </span>
                                          <svg
                                            className="h-4 w-4 text-violet-600 transition-transform group-open:rotate-180"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            aria-hidden
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </div>
                                      </div>
                                      <div className="mt-1 text-neutral-600">
                                        {new Date(ent.e.startsAt).toLocaleTimeString(locale, {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                        {ent.e.endsAt
                                          ? ` – ${new Date(ent.e.endsAt).toLocaleTimeString(locale, {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}`
                                          : ''}
                                      </div>
                                      <p className="mt-1 text-[9px] text-violet-800/70">
                                        {t('crm.dashboard.calendar.expandHint')}
                                      </p>
                                    </summary>
                                    <div className="space-y-3 border-t border-violet-200/70 px-3 pb-3 pt-1">
                                      <Link
                                        to={`/leads/${ent.e.leadId}`}
                                        className="inline-block text-[11px] font-medium text-violet-700 underline decoration-violet-200 hover:text-violet-900"
                                      >
                                        {ent.e.leadName}
                                      </Link>
                                      {ent.e.attendeeNames && ent.e.attendeeNames.length ? (
                                        <div>
                                          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                                            {t('crm.dashboard.calendar.fieldParticipants')}
                                          </div>
                                          <div className="text-[11px] text-neutral-700">
                                            {ent.e.attendeeNames.join(', ')}
                                          </div>
                                        </div>
                                      ) : null}
                                      {ent.e.meetingUrl ? (
                                        <a
                                          href={ent.e.meetingUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block text-[11px] font-medium text-sky-700 underline hover:text-sky-900"
                                        >
                                          {t('crm.dashboard.calendar.joinLink')}
                                        </a>
                                      ) : null}
                                      {ent.e.notes ? (
                                        <div>
                                          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                                            {t('crm.dashboard.calendar.fieldDescription')}
                                          </div>
                                          <div className="whitespace-pre-wrap text-[11px] text-neutral-700">
                                            {ent.e.notes}
                                          </div>
                                        </div>
                                      ) : null}
                                      <div className="rounded-lg border border-violet-200/80 bg-white/90 px-2.5 py-2">
                                        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                                          {t('crm.dashboard.calendar.googleSectionTitle')}
                                        </div>
                                        {!ent.e.googleCalendarEventId ? (
                                          <p className="text-[10px] leading-snug text-neutral-600">
                                            {t('crm.dashboard.calendar.expandNoGoogle')}
                                          </p>
                                        ) : (
                                          <>
                                            {gState?.loading ? (
                                              <p className="text-[10px] text-neutral-500">
                                                {t('crm.dashboard.calendar.googleLoading')}
                                              </p>
                                            ) : null}
                                            {gState?.error ? (
                                              <p className="text-[10px] text-rose-700">{gState.error}</p>
                                            ) : null}
                                            {gd ? (
                                              <div className="space-y-2">
                                                {gd.description?.trim() ? (
                                                  <div>
                                                    <div className="mb-0.5 text-[9px] font-semibold uppercase text-neutral-400">
                                                      {t('crm.dashboard.calendar.googleDescription')}
                                                    </div>
                                                    <div className="whitespace-pre-wrap text-[11px] text-[#222]">
                                                      {gd.description}
                                                    </div>
                                                  </div>
                                                ) : null}
                                                {gd.meetUri || gd.hangoutLink ? (
                                                  <a
                                                    href={gd.meetUri || gd.hangoutLink || '#'}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex text-[11px] font-semibold text-emerald-700 underline"
                                                  >
                                                    {t('crm.dashboard.calendar.joinMeet')}
                                                  </a>
                                                ) : null}
                                                {gd.htmlLink ? (
                                                  <a
                                                    href={gd.htmlLink}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="block text-[10px] text-sky-700 underline"
                                                  >
                                                    {t('crm.dashboard.calendar.openInGoogle')}
                                                  </a>
                                                ) : null}
                                                {gd.organizerDisplayName || gd.organizerEmail ? (
                                                  <div className="text-[10px] text-neutral-600">
                                                    <span className="font-semibold text-neutral-500">
                                                      {t('crm.dashboard.calendar.organizer')}
                                                    </span>{' '}
                                                    {gd.organizerDisplayName || gd.organizerEmail}
                                                  </div>
                                                ) : null}
                                                {gd.attendees && gd.attendees.length ? (
                                                  <div>
                                                    <div className="mb-0.5 text-[9px] font-semibold uppercase text-neutral-400">
                                                      {t('crm.dashboard.calendar.googleAttendees')}
                                                    </div>
                                                    <ul className="list-inside list-disc space-y-0.5 text-[10px] text-neutral-700">
                                                      {gd.attendees.map((a, i) => (
                                                        <li key={`${a.email || i}-${i}`}>
                                                          {a.displayName || a.email || '—'}
                                                          {a.responseStatus ? ` (${a.responseStatus})` : ''}
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </details>
                                );
                              })()
                            ) : (
                              (() => {
                                const gKey = `gcal-local-${ent.m.id}`;
                                const gState = gcalDetails[gKey];
                                const gd = gState?.data;
                                const leadLabels = ent.m.leadIds
                                  .map((lid) => leads.find((l) => l.id === lid)?.name)
                                  .filter(Boolean);
                                return (
                                  <details
                                    key={ent.m.id}
                                    className="group rounded-xl border border-neutral-200 bg-neutral-50/90 text-[11px] [&_summary::-webkit-details-marker]:hidden"
                                    onToggle={(ev) => {
                                      const el = ev.currentTarget as HTMLDetailsElement;
                                      if (!el.open || !ent.m.googleCalendarEventId) return;
                                      loadGoogleEventDetails(gKey, ent.m.googleCalendarEventId);
                                    }}
                                  >
                                    <summary className="cursor-pointer list-none px-3 py-2.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 font-medium text-[#222]">{ent.m.title}</div>
                                        <div className="flex shrink-0 items-center gap-1">
                                          <span
                                            className={
                                              'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ' +
                                              (ent.m.kind === 'note'
                                                ? 'bg-amber-100 text-amber-900'
                                                : 'bg-sky-100 text-sky-900')
                                            }
                                          >
                                            {ent.m.kind === 'note'
                                              ? t('crm.dashboard.calendar.badgeNote')
                                              : t('crm.dashboard.calendar.badgeMeeting')}
                                          </span>
                                          <svg
                                            className="h-4 w-4 text-neutral-500 transition-transform group-open:rotate-180"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            aria-hidden
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </div>
                                      </div>
                                      {ent.m.kind === 'meeting' ? (
                                        <div className="mt-1 text-neutral-600">
                                          {new Date(ent.m.startsAt).toLocaleTimeString(locale, {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}{' '}
                                          –{' '}
                                          {new Date(ent.m.endsAt).toLocaleTimeString(locale, {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </div>
                                      ) : (
                                        <div className="mt-1 text-neutral-600">
                                          {t('crm.dashboard.calendar.allDayNote')}
                                        </div>
                                      )}
                                      <p className="mt-1 text-[9px] text-neutral-500">
                                        {t('crm.dashboard.calendar.expandHint')}
                                      </p>
                                    </summary>
                                    <div className="space-y-3 border-t border-neutral-200/80 px-3 pb-3 pt-1">
                                      {leadLabels.length ? (
                                        <div>
                                          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                                            {t('crm.dashboard.calendar.leads')}
                                          </div>
                                          <div className="text-[11px] text-neutral-700">{leadLabels.join(', ')}</div>
                                        </div>
                                      ) : null}
                                      {ent.m.attendeeEmails.length ? (
                                        <div>
                                          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                                            {t('crm.dashboard.calendar.fieldParticipants')}
                                          </div>
                                          <div className="text-[11px] text-neutral-700">
                                            {ent.m.attendeeEmails.join(', ')}
                                          </div>
                                        </div>
                                      ) : null}
                                      {ent.m.meetingUrl ? (
                                        <a
                                          href={ent.m.meetingUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block text-[11px] font-medium text-sky-700 underline hover:text-sky-900"
                                        >
                                          {t('crm.dashboard.calendar.joinLink')}
                                        </a>
                                      ) : null}
                                      {ent.m.body ? (
                                        <div>
                                          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                                            {t('crm.dashboard.calendar.fieldDescription')}
                                          </div>
                                          <div className="whitespace-pre-wrap text-[11px] text-neutral-700">
                                            {ent.m.body}
                                          </div>
                                        </div>
                                      ) : null}
                                      {ent.m.kind === 'meeting' ? (
                                        <div className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2">
                                          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                                            {t('crm.dashboard.calendar.googleSectionTitle')}
                                          </div>
                                          {!ent.m.googleCalendarEventId ? (
                                            <p className="text-[10px] leading-snug text-neutral-600">
                                              {t('crm.dashboard.calendar.expandNoGoogle')}
                                            </p>
                                          ) : (
                                            <>
                                              {gState?.loading ? (
                                                <p className="text-[10px] text-neutral-500">
                                                  {t('crm.dashboard.calendar.googleLoading')}
                                                </p>
                                              ) : null}
                                              {gState?.error ? (
                                                <p className="text-[10px] text-rose-700">{gState.error}</p>
                                              ) : null}
                                              {gd ? (
                                                <div className="space-y-2">
                                                  {gd.description?.trim() ? (
                                                    <div>
                                                      <div className="mb-0.5 text-[9px] font-semibold uppercase text-neutral-400">
                                                        {t('crm.dashboard.calendar.googleDescription')}
                                                      </div>
                                                      <div className="whitespace-pre-wrap text-[11px] text-[#222]">
                                                        {gd.description}
                                                      </div>
                                                    </div>
                                                  ) : null}
                                                  {gd.meetUri || gd.hangoutLink ? (
                                                    <a
                                                      href={gd.meetUri || gd.hangoutLink || '#'}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="inline-flex text-[11px] font-semibold text-emerald-700 underline"
                                                    >
                                                      {t('crm.dashboard.calendar.joinMeet')}
                                                    </a>
                                                  ) : null}
                                                  {gd.htmlLink ? (
                                                    <a
                                                      href={gd.htmlLink}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="block text-[10px] text-sky-700 underline"
                                                    >
                                                      {t('crm.dashboard.calendar.openInGoogle')}
                                                    </a>
                                                  ) : null}
                                                  {gd.organizerDisplayName || gd.organizerEmail ? (
                                                    <div className="text-[10px] text-neutral-600">
                                                      <span className="font-semibold text-neutral-500">
                                                        {t('crm.dashboard.calendar.organizer')}
                                                      </span>{' '}
                                                      {gd.organizerDisplayName || gd.organizerEmail}
                                                    </div>
                                                  ) : null}
                                                  {gd.attendees && gd.attendees.length ? (
                                                    <div>
                                                      <div className="mb-0.5 text-[9px] font-semibold uppercase text-neutral-400">
                                                        {t('crm.dashboard.calendar.googleAttendees')}
                                                      </div>
                                                      <ul className="list-inside list-disc space-y-0.5 text-[10px] text-neutral-700">
                                                        {gd.attendees.map((a, i) => (
                                                          <li key={`${a.email || i}-${i}`}>
                                                            {a.displayName || a.email || '—'}
                                                            {a.responseStatus ? ` (${a.responseStatus})` : ''}
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    </div>
                                                  ) : null}
                                                </div>
                                              ) : null}
                                            </>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  </details>
                                );
                              })()
                            ),
                          )}
                        </div>
                      </section>
                    )}

                    <section>
                      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        {t('crm.dashboard.calendar.newEntrySection')}
                      </h3>
                      <div className="mb-4 flex gap-1 rounded-xl bg-neutral-100 p-1">
                        <button
                          type="button"
                          className={
                            'flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ' +
                            (draft.kind === 'meeting'
                              ? 'bg-[#222222] text-white shadow-sm'
                              : 'text-neutral-600 hover:text-[#222]')
                          }
                          onClick={() => {
                            if (draft.kind === 'meeting') return;
                            openCreate(selectedDay);
                          }}
                        >
                          {t('crm.dashboard.calendar.typeMeeting')}
                        </button>
                        <button
                          type="button"
                          className={
                            'flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ' +
                            (draft.kind === 'note'
                              ? 'bg-[#222222] text-white shadow-sm'
                              : 'text-neutral-600 hover:text-[#222]')
                          }
                          onClick={() => {
                            if (draft.kind === 'note') return;
                            openCreateNote(selectedDay);
                          }}
                        >
                          {t('crm.dashboard.calendar.typeNote')}
                        </button>
                      </div>

                      <label className="mb-1.5 block text-[11px] font-medium text-neutral-600">
                        {t('crm.dashboard.calendar.subject')}
                      </label>
                      <input
                        className="mb-4 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-[#222] placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                        value={draft.title}
                        placeholder={t('crm.dashboard.calendar.subjectPlaceholder')}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      />

                      {draft.kind === 'meeting' && (
                        <>
                          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-[11px] font-medium text-neutral-600">
                                {t('crm.dashboard.calendar.start')}
                              </label>
                              <input
                                type="datetime-local"
                                className="w-full rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-[12px] text-[#222] focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                                value={draft.startLocal}
                                onChange={(e) => setDraft((d) => ({ ...d, startLocal: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-[11px] font-medium text-neutral-600">
                                {t('crm.dashboard.calendar.end')}
                              </label>
                              <input
                                type="datetime-local"
                                className="w-full rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-[12px] text-[#222] focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                                value={draft.endLocal}
                                onChange={(e) => setDraft((d) => ({ ...d, endLocal: e.target.value }))}
                              />
                            </div>
                          </div>
                          <label className="mb-1.5 block text-[11px] font-medium text-neutral-600">
                            {t('crm.dashboard.calendar.meetingUrl')}
                          </label>
                          <input
                            className="mb-4 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-[#222] placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                            placeholder="https://"
                            value={draft.meetingUrl}
                            onChange={(e) => setDraft((d) => ({ ...d, meetingUrl: e.target.value }))}
                          />
                        </>
                      )}

                      {draft.kind === 'note' && (
                        <p className="mb-4 text-xs leading-relaxed text-neutral-500">
                          {t('crm.dashboard.calendar.noteDayHint', {
                            date: selectedDay.toLocaleDateString(locale),
                          })}
                        </p>
                      )}

                      <label className="mb-1.5 block text-[11px] font-medium text-neutral-600">
                        {t('crm.dashboard.calendar.notes')}
                      </label>
                      <textarea
                        className="mb-4 min-h-[88px] w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-[#222] placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                        value={draft.body}
                        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                      />

                      <details className="mb-2 rounded-xl border border-neutral-200 bg-neutral-50/60 open:[&>summary>svg]:rotate-180 [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100/80">
                          <span>{t('crm.dashboard.calendar.optionalParticipants')}</span>
                          <svg
                            className="h-4 w-4 shrink-0 text-neutral-400 transition-transform"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                            />
                          </svg>
                        </summary>
                        <div className="space-y-4 border-t border-neutral-200 bg-white px-3 pb-3 pt-3">
                          <div>
                            <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
                              {t('crm.dashboard.calendar.participants')}
                            </div>
                            <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/50 p-2">
                              {staff.map((s) => (
                                <label
                                  key={s.id}
                                  className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-700"
                                >
                                  <input
                                    type="checkbox"
                                    className="rounded border-neutral-300 accent-[#222222] focus:ring-[#222222]/20"
                                    checked={draft.staffIds.includes(s.id)}
                                    onChange={(e) => {
                                      setDraft((d) => ({
                                        ...d,
                                        staffIds: e.target.checked
                                          ? [...d.staffIds, s.id]
                                          : d.staffIds.filter((x) => x !== s.id),
                                      }));
                                    }}
                                  />
                                  <span className="truncate">{s.fullName}</span>
                                  <span className="truncate text-neutral-500">{s.email}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
                              {t('crm.dashboard.calendar.departments')}
                            </div>
                            <div className="max-h-28 space-y-1.5 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/50 p-2">
                              {departments.map((dep) => (
                                <label
                                  key={dep.id}
                                  className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-700"
                                >
                                  <input
                                    type="checkbox"
                                    className="rounded border-neutral-300 accent-[#222222] focus:ring-[#222222]/20"
                                    checked={draft.departmentIds.includes(dep.id)}
                                    onChange={(e) => {
                                      setDraft((d) => ({
                                        ...d,
                                        departmentIds: e.target.checked
                                          ? [...d.departmentIds, dep.id]
                                          : d.departmentIds.filter((x) => x !== dep.id),
                                      }));
                                    }}
                                  />
                                  <span className="truncate">{dep.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="mb-1.5 text-[11px] font-medium text-neutral-500">
                              {t('crm.dashboard.calendar.leads')}
                            </div>
                            <div className="max-h-28 space-y-1.5 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/50 p-2">
                              {leads.slice(0, 80).map((l) => (
                                <label
                                  key={l.id}
                                  className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-700"
                                >
                                  <input
                                    type="checkbox"
                                    className="rounded border-neutral-300 accent-[#222222] focus:ring-[#222222]/20"
                                    checked={draft.leadIds.includes(l.id)}
                                    onChange={(e) => {
                                      setDraft((d) => ({
                                        ...d,
                                        leadIds: e.target.checked
                                          ? [...d.leadIds, l.id]
                                          : d.leadIds.filter((x) => x !== l.id),
                                      }));
                                    }}
                                  />
                                  <span className="truncate">{l.name}</span>
                                </label>
                              ))}
                            </div>
                            {draft.kind === 'meeting' ? (
                              <p className="mt-2 text-[10px] leading-snug text-neutral-500">
                                {t('crm.dashboard.calendar.leadSyncHint')}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </details>
                    </section>
                  </div>

                  <footer className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3 sm:px-5">
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 sm:w-auto sm:min-w-[100px] sm:px-5"
                        onClick={() => {
                          setComposeError(null);
                          setModal(null);
                        }}
                      >
                        {t('crm.common.cancel')}
                      </button>
                      <button
                        type="button"
                        className="w-full flex-1 rounded-xl bg-[#222222] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#333333] active:bg-[#1a1a1a] sm:py-3"
                        onClick={() => void submitMeeting()}
                      >
                        {t('crm.dashboard.calendar.save')}
                      </button>
                    </div>
                  </footer>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
