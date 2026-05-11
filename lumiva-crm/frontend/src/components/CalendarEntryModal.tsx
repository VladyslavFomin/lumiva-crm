import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { fetchEmailAccounts, sendEmail } from '../api/email';
import { fetchLeadById, updateLead } from '../api/leads';
import { fetchStaff, type StaffUser } from '../api/staff';
import { fetchDepartments, type Department } from '../api/departments';
import { buildIcsEvent, icsToBase64 } from '../dashboard/dashboardIcs';
import { loadMeetings, saveMeetings, type DashboardMeeting } from '../dashboard/dashboardMeetings';
import { parseDatetimeLocalValue } from '../utils/calendarLocalDates';

type LeadOpt = { id: string; name: string };

interface Props {
  initialKind: 'meeting' | 'note';
  preselectedLeadId?: string;
  preselectedLeadName?: string;
  leads?: LeadOpt[];
  onClose: () => void;
  onSaved?: () => void;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toLocalStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export const CalendarEntryModal: React.FC<Props> = ({
  initialKind,
  preselectedLeadId,
  preselectedLeadName,
  leads = [],
  onClose,
  onSaved,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language === 'en' ? 'en-US' : 'ru-RU';

  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0);
  const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0, 0);

  const [draft, setDraft] = useState({
    kind: initialKind,
    title: '',
    body: '',
    startLocal: toLocalStr(s),
    endLocal: toLocalStr(e),
    meetingUrl: '',
    leadIds: preselectedLeadId ? [preselectedLeadId] : [] as string[],
    staffIds: [] as string[],
    departmentIds: [] as string[],
  });

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchStaff().catch(() => []), fetchDepartments().catch(() => [])]).then(
      ([s, d]) => {
        if (!alive) return;
        setStaff(Array.isArray(s) ? s.filter((x) => x.isActive) : []);
        setDepartments(Array.isArray(d) ? d : []);
      },
    );
    return () => { alive = false; };
  }, []);

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

  const submit = async () => {
    setError(null);
    setSaving(true);

    try {
      let start: Date;
      let end: Date;
      if (draft.kind === 'note') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else {
        const s = parseDatetimeLocalValue(draft.startLocal);
        const e = parseDatetimeLocalValue(draft.endLocal);
        if (!s || !e) {
          setError(t('crm.dashboard.calendar.validationTime'));
          setSaving(false);
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
          for (const lid of leadIds) {
            const lead = await fetchLeadById(lid);
            const raw = (lead.meta as { meetings?: unknown } | undefined)?.meetings;
            const cur = Array.isArray(raw) ? [...raw] : [];
            const updated = await updateLead(lid, {
              meta: { ...(lead.meta ?? {}), meetings: [...cur, row] },
            });
            const meetingsAfter = (updated.meta as { meetings?: unknown[] } | undefined)?.meetings;
            const savedRow = Array.isArray(meetingsAfter)
              ? meetingsAfter.find(
                  (m) =>
                    m !== null && typeof m === 'object' &&
                    String((m as Record<string, unknown>).id ?? '') === id,
                )
              : undefined;
            const gid =
              savedRow && typeof savedRow === 'object'
                ? (savedRow as Record<string, unknown>).googleCalendarEventId
                : undefined;
            if (typeof gid === 'string' && gid.trim()) syncedGoogleEventId = gid.trim();
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

      const prev = loadMeetings();
      saveMeetings([...prev, meeting]);

      const urlLine =
        meeting.kind === 'meeting' && meeting.meetingUrl
          ? `${t('crm.dashboard.calendar.joinLink')}: ${meeting.meetingUrl}`
          : '';

      const leadNamesLine = draft.leadIds
        .map((lid) => {
          if (lid === preselectedLeadId) return preselectedLeadName || lid;
          return leads.find((l) => l.id === lid)?.name || lid;
        })
        .join(', ');

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
        ].filter(Boolean).join('\n\n'),
        location: meeting.kind === 'meeting' && meeting.meetingUrl ? meeting.meetingUrl : undefined,
      });
      const b64 = icsToBase64(ics);

      try {
        const accounts = await fetchEmailAccounts();
        const account = accounts[0];
        if (account && attendeeEmails.length) {
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
            textBody: `${meeting.title}\n\n${meeting.body}\n\n${timeLine}\n${meeting.meetingUrl || ''}\n${window.location.origin}`,
            attachments: [{ filename: 'invite.ics', contentType: 'text/calendar', contentBase64: b64 }],
          });
        }
      } catch {
        // email is best-effort
      }

      onSaved?.();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(t('crm.dashboard.calendar.syncToLeadsFailed', { message: msg }));
    } finally {
      setSaving(false);
    }
  };

  const allLeads: LeadOpt[] = preselectedLeadId && !leads.find((l) => l.id === preselectedLeadId)
    ? [{ id: preselectedLeadId, name: preselectedLeadName || preselectedLeadId }, ...leads]
    : leads;

  return createPortal(
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={() => onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(92vh,760px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {t('crm.dashboard.calendar.sheetKicker')}
              </p>
              <h2 className="mt-0.5 text-lg font-semibold leading-snug text-slate-900 sm:text-xl">
                {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                {t('crm.dashboard.calendar.sheetEmptyHint')}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label={t('crm.common.close')}
              onClick={onClose}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {error && (
          <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-900 sm:px-5" role="alert">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('crm.dashboard.calendar.newEntrySection')}
            </h3>

            {/* Type switcher */}
            <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                className={
                  'flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ' +
                  (draft.kind === 'meeting' ? 'bg-[#222222] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900')
                }
                onClick={() => setDraft((d) => ({ ...d, kind: 'meeting' }))}
              >
                {t('crm.dashboard.calendar.typeMeeting')}
              </button>
              <button
                type="button"
                className={
                  'flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ' +
                  (draft.kind === 'note' ? 'bg-[#222222] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900')
                }
                onClick={() => setDraft((d) => ({ ...d, kind: 'note' }))}
              >
                {t('crm.dashboard.calendar.typeNote')}
              </button>
            </div>

            {/* Subject */}
            <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
              {t('crm.dashboard.calendar.subject')}
            </label>
            <input
              className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              value={draft.title}
              placeholder={t('crm.dashboard.calendar.subjectPlaceholder')}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />

            {draft.kind === 'meeting' && (
              <>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
                      {t('crm.dashboard.calendar.start')}
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      value={draft.startLocal}
                      onChange={(e) => setDraft((d) => ({ ...d, startLocal: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
                      {t('crm.dashboard.calendar.end')}
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      value={draft.endLocal}
                      onChange={(e) => setDraft((d) => ({ ...d, endLocal: e.target.value }))}
                    />
                  </div>
                </div>
                <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
                  {t('crm.dashboard.calendar.meetingUrl')}
                </label>
                <input
                  className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  placeholder="https://"
                  value={draft.meetingUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, meetingUrl: e.target.value }))}
                />
              </>
            )}

            {draft.kind === 'note' && (
              <p className="mb-4 text-xs leading-relaxed text-slate-500">
                {t('crm.dashboard.calendar.noteDayHint', {
                  date: new Date().toLocaleDateString(locale),
                })}
              </p>
            )}

            {/* Notes */}
            <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
              {t('crm.dashboard.calendar.notes')}
            </label>
            <textarea
              className="mb-4 min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />

            {/* Participants details */}
            <details className="mb-2 rounded-xl border border-slate-200 bg-slate-50/60 open:[&>summary>svg]:rotate-180 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100/80">
                <span>{t('crm.dashboard.calendar.optionalParticipants')}</span>
                <svg className="h-4 w-4 shrink-0 text-slate-400 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <div className="space-y-4 border-t border-slate-200 bg-white px-3 pb-3 pt-3">
                {/* Staff */}
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-slate-500">{t('crm.dashboard.calendar.participants')}</div>
                  <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2">
                    {staff.map((su) => (
                      <label key={su.id} className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 accent-[#222222] focus:ring-[#222222]/20"
                          checked={draft.staffIds.includes(su.id)}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              staffIds: e.target.checked ? [...d.staffIds, su.id] : d.staffIds.filter((x) => x !== su.id),
                            }))
                          }
                        />
                        <span className="truncate">{su.fullName}</span>
                        <span className="truncate text-slate-500">{su.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Departments */}
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-slate-500">{t('crm.dashboard.calendar.departments')}</div>
                  <div className="max-h-28 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2">
                    {departments.map((dep) => (
                      <label key={dep.id} className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 accent-[#222222] focus:ring-[#222222]/20"
                          checked={draft.departmentIds.includes(dep.id)}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              departmentIds: e.target.checked ? [...d.departmentIds, dep.id] : d.departmentIds.filter((x) => x !== dep.id),
                            }))
                          }
                        />
                        <span className="truncate">{dep.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Leads */}
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-slate-500">{t('crm.dashboard.calendar.leads')}</div>
                  <div className="max-h-28 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2">
                    {allLeads.slice(0, 80).map((l) => (
                      <label key={l.id} className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 accent-[#222222] focus:ring-[#222222]/20"
                          checked={draft.leadIds.includes(l.id)}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              leadIds: e.target.checked ? [...d.leadIds, l.id] : d.leadIds.filter((x) => x !== l.id),
                            }))
                          }
                        />
                        <span className="truncate">{l.name}</span>
                      </label>
                    ))}
                  </div>
                  {draft.kind === 'meeting' && (
                    <p className="mt-2 text-[10px] leading-snug text-slate-500">
                      {t('crm.dashboard.calendar.leadSyncHint')}
                    </p>
                  )}
                </div>
              </div>
            </details>
          </section>
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto sm:min-w-[100px] sm:px-5"
              onClick={onClose}
            >
              {t('crm.common.cancel')}
            </button>
            <button
              type="button"
              className="w-full flex-1 rounded-xl bg-[#222222] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#333333] active:bg-[#1a1a1a] disabled:opacity-60 sm:py-3"
              disabled={saving}
              onClick={() => void submit()}
            >
              {saving ? '...' : t('crm.dashboard.calendar.save')}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
