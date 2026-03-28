import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { fetchEmailAccounts, sendEmail } from '../api/email';
import { fetchStaff, type StaffUser } from '../api/staff';
import { fetchDepartments, type Department } from '../api/departments';
import { buildIcsEvent, icsToBase64 } from './dashboardIcs';
import { loadMeetings, saveMeetings, type DashboardMeeting } from './dashboardMeetings';
import { toLocalDateKey } from '../utils/calendarLocalDates';

type LeadOpt = { id: string; name: string };

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
}> = ({ locale, leads }) => {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [meetings, setMeetings] = useState<DashboardMeeting[]>(() => loadMeetings());
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modal, setModal] = useState<'create' | 'day' | null>(null);
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

  const meetingsForDay = useCallback(
    (day: Date | null) => {
      if (!day) return [];
      const dayKey = toLocalDateKey(day);
      return meetings.filter((m) => {
        const startKey = toLocalDateKey(new Date(m.startsAt));
        const endKey = toLocalDateKey(new Date(m.endsAt || m.startsAt));
        return startKey && endKey && dayKey >= startKey && dayKey <= endKey;
      });
    },
    [meetings],
  );

  const openCreate = (day: Date) => {
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
    setModal('create');
  };

  const openCreateNote = (day: Date) => {
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
    setModal('create');
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
      if (!draft.title.trim()) return;
    } else {
      start = new Date(draft.startLocal);
      end = new Date(draft.endLocal);
      if (!draft.title.trim() || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return;
      }
    }

    const attendeeEmails = collectEmails();
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const meeting: DashboardMeeting = {
      id,
      kind: draft.kind,
      title: draft.title.trim(),
      body: draft.body.trim(),
      meetingUrl: draft.kind === 'meeting' ? draft.meetingUrl.trim() : '',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      attendeeEmails,
      leadIds: draft.leadIds,
      departmentIds: draft.departmentIds,
      createdAt: new Date().toISOString(),
    };
    setMeetings((prev) => [...prev, meeting]);
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
          className="rounded-xl border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
          onClick={() => setCursor((c) => addMonths(c, -1))}
        >
          ‹
        </button>
        <div className="text-xs font-medium text-slate-800 capitalize">{monthLabel}</div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
          onClick={() => setCursor((c) => addMonths(c, 1))}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-500 text-center mb-1">
        {dowLabels.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, idx) => {
          if (!cell) {
            return <div key={`e-${idx}`} className="h-9" />;
          }
          const count = meetingsForDay(cell).length;
          const isToday = sameDay(cell, new Date());
          return (
            <button
              key={cell.toISOString()}
              type="button"
              onClick={() => {
                setSelectedDay(cell);
                setModal('day');
              }}
              className={
                'h-9 rounded-xl text-[11px] border transition-colors ' +
                (isToday
                  ? 'border-sky-500 bg-sky-50 text-sky-900 font-semibold'
                  : 'border-slate-100 bg-slate-50/80 hover:bg-slate-100 text-slate-800')
              }
            >
              <div>{cell.getDate()}</div>
              {count > 0 && (
                <div className="mx-auto mt-0.5 h-1 w-1 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

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
          className="rounded-2xl border border-slate-200 bg-white text-slate-800 text-[11px] font-semibold py-2 hover:bg-slate-50"
        >
          + {t('crm.dashboard.calendar.newNote')}
        </button>
      </div>

      {modal &&
        createPortal(
          <div
            className="fixed inset-0 z-[10080] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            role="presentation"
            onMouseDown={() => setModal(null)}
          >
            <div
              role="dialog"
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200/90 bg-white/98 backdrop-blur-md p-5 ring-1 ring-slate-900/[0.08]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {modal === 'day' && selectedDay && (
                <>
                  <div className="text-sm font-semibold text-slate-900 mb-3">
                    {selectedDay.toLocaleDateString(locale, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </div>
                  <div className="space-y-2 mb-4">
                    {meetingsForDay(selectedDay).length === 0 && (
                      <div className="text-[11px] text-slate-500">{t('crm.dashboard.calendar.noEvents')}</div>
                    )}
                    {meetingsForDay(selectedDay).map((m) => (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-slate-200 px-3 py-2 text-[11px]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-slate-900">{m.title}</div>
                          <span
                            className={
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] uppercase ' +
                              (m.kind === 'note'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-sky-100 text-sky-900')
                            }
                          >
                            {m.kind === 'note'
                              ? t('crm.dashboard.calendar.badgeNote')
                              : t('crm.dashboard.calendar.badgeMeeting')}
                          </span>
                        </div>
                        {m.kind === 'meeting' ? (
                          <div className="text-slate-500 mt-0.5">
                            {new Date(m.startsAt).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            –{' '}
                            {new Date(m.endsAt).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        ) : (
                          <div className="text-slate-500 mt-0.5">
                            {t('crm.dashboard.calendar.allDayNote')}
                          </div>
                        )}
                        {m.meetingUrl ? (
                          <a
                            href={m.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-700 underline mt-1 inline-block"
                          >
                            {t('crm.dashboard.calendar.joinLink')}
                          </a>
                        ) : null}
                        {m.body ? (
                          <div className="text-slate-600 mt-1 whitespace-pre-wrap">{m.body}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-2xl bg-lumiva-accent text-white text-[11px] py-2 border border-lumiva-accent hover:opacity-90"
                        onClick={() => openCreate(selectedDay)}
                      >
                        {t('crm.dashboard.calendar.newMeeting')}
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-2xl border border-slate-200 bg-white text-slate-800 text-[11px] font-semibold py-2 hover:bg-slate-50"
                        onClick={() => openCreateNote(selectedDay)}
                      >
                        {t('crm.dashboard.calendar.newNote')}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 px-4 text-[11px] py-2"
                      onClick={() => setModal(null)}
                    >
                      {t('crm.common.close')}
                    </button>
                  </div>
                </>
              )}

              {modal === 'create' && (
                <>
                  <div className="text-sm font-semibold text-slate-900 mb-3">
                    {draft.kind === 'note'
                      ? t('crm.dashboard.calendar.newNote')
                      : t('crm.dashboard.calendar.newMeeting')}
                  </div>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      className={
                        'flex-1 rounded-xl border py-1.5 text-[11px] font-medium ' +
                        (draft.kind === 'meeting'
                          ? 'border-lumiva-accent bg-lumiva-accent text-white'
                          : 'border-slate-200 bg-white text-slate-800')
                      }
                      onClick={() => setDraft((d) => ({ ...d, kind: 'meeting' }))}
                    >
                      {t('crm.dashboard.calendar.typeMeeting')}
                    </button>
                    <button
                      type="button"
                      className={
                        'flex-1 rounded-xl border py-1.5 text-[11px] font-medium ' +
                        (draft.kind === 'note'
                          ? 'border-lumiva-accent bg-lumiva-accent text-white'
                          : 'border-slate-200 bg-white text-slate-800')
                      }
                      onClick={() => setDraft((d) => ({ ...d, kind: 'note' }))}
                    >
                      {t('crm.dashboard.calendar.typeNote')}
                    </button>
                  </div>
                  <label className="block text-[11px] text-slate-600 mb-1">{t('crm.dashboard.calendar.subject')}</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs mb-3"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  />
                  {draft.kind === 'meeting' && (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">{t('crm.dashboard.calendar.start')}</label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-[11px]"
                            value={draft.startLocal}
                            onChange={(e) => setDraft((d) => ({ ...d, startLocal: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">{t('crm.dashboard.calendar.end')}</label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-[11px]"
                            value={draft.endLocal}
                            onChange={(e) => setDraft((d) => ({ ...d, endLocal: e.target.value }))}
                          />
                        </div>
                      </div>
                      <label className="block text-[11px] text-slate-600 mb-1">{t('crm.dashboard.calendar.meetingUrl')}</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs mb-3"
                        placeholder="https://"
                        value={draft.meetingUrl}
                        onChange={(e) => setDraft((d) => ({ ...d, meetingUrl: e.target.value }))}
                      />
                    </>
                  )}
                  {draft.kind === 'note' && selectedDay && (
                    <p className="text-[11px] text-slate-500 mb-3">
                      {t('crm.dashboard.calendar.noteDayHint', {
                        date: selectedDay.toLocaleDateString(locale),
                      })}
                    </p>
                  )}
                  <label className="block text-[11px] text-slate-600 mb-1">{t('crm.dashboard.calendar.notes')}</label>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs mb-3 min-h-[72px]"
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  />

                  <div className="text-[11px] font-medium text-slate-700 mb-1">{t('crm.dashboard.calendar.participants')}</div>
                  <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 p-2 mb-3 space-y-1">
                    {staff.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
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
                        <span className="text-slate-400 truncate">{s.email}</span>
                      </label>
                    ))}
                  </div>

                  <div className="text-[11px] font-medium text-slate-700 mb-1">{t('crm.dashboard.calendar.departments')}</div>
                  <div className="max-h-24 overflow-y-auto rounded-xl border border-slate-200 p-2 mb-3 space-y-1">
                    {departments.map((dep) => (
                      <label key={dep.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
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

                  <div className="text-[11px] font-medium text-slate-700 mb-1">{t('crm.dashboard.calendar.leads')}</div>
                  <div className="max-h-24 overflow-y-auto rounded-xl border border-slate-200 p-2 mb-4 space-y-1">
                    {leads.slice(0, 80).map((l) => (
                      <label key={l.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
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

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-2xl bg-lumiva-accent text-white text-[11px] py-2 border border-lumiva-accent hover:opacity-90"
                      onClick={() => void submitMeeting()}
                    >
                      {t('crm.dashboard.calendar.save')}
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-slate-200 px-4 text-[11px]"
                      onClick={() => setModal(null)}
                    >
                      {t('crm.common.cancel')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
