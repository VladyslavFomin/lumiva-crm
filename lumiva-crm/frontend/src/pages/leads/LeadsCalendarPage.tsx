import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import type { Lead } from '../../api/leads';
import { fetchLeads, updateLead } from '../../api/leads';
import { fetchEmailAccounts, sendEmail, type EmailAccount } from '../../api/email';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { ViewNameModal } from '../../components/ViewNameModal';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  createLeadsCustomView,
  deleteLeadsCustomView,
  loadLeadsCustomViews,
  type LeadsCustomView,
  updateLeadsCustomView,
} from './leadsViewsStore';
import { dayKeysFromStartEndStrings, toLocalDateKey } from '../../utils/calendarLocalDates';
import '../projects/ProjectsListPage.css';

type LeadMeeting = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  meetingUrl?: string;
  notes?: string;
  attendeeUserIds?: string[];
  attendeeNames?: string[];
  closedAt?: string;
  notifySentAt?: string;
  reminder24hSentAt?: string;
  reminder1hSentAt?: string;
};

type MeetingDraft = {
  open: boolean;
  leadId: string;
  meetingId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetingUrl: string;
  notes: string;
  attendeeUserIds: string[];
};

const emptyDraft: MeetingDraft = {
  open: false,
  leadId: '',
  title: '',
  startsAt: '',
  endsAt: '',
  meetingUrl: '',
  notes: '',
  attendeeUserIds: [],
};

const toDateKey = (value: string | Date) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalDateKey(d);
};

const toInputDateTime = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const toIcsUtc = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const escapeIcsText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const buildMeetingIcsBase64 = (lead: Lead, meeting: LeadMeeting) => {
  const uid = `${meeting.id}@lumiva-crm`;
  const dtStamp = toIcsUtc(new Date().toISOString());
  const dtStart = toIcsUtc(meeting.startsAt);
  const dtEnd = toIcsUtc(meeting.endsAt || meeting.startsAt);
  const summary = escapeIcsText(meeting.title || `Meeting with ${lead.name || 'lead'}`);
  const description = escapeIcsText(
    [
      meeting.notes || '',
      meeting.meetingUrl ? `Meeting link: ${meeting.meetingUrl}` : '',
      lead.phone ? `Phone: ${lead.phone}` : '',
      lead.email ? `Email: ${lead.email}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  const location = escapeIcsText(meeting.meetingUrl || 'Online');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lumiva CRM//Leads Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(ics)));
};

const meetingProvider = (url?: string) => {
  const value = (url || '').toLowerCase();
  if (value.includes('meet.google.com')) return 'google';
  if (value.includes('teams.microsoft.com')) return 'teams';
  if (value.includes('zoom.us')) return 'zoom';
  return value ? 'other' : 'none';
};

const readMeetings = (lead: Lead): LeadMeeting[] => {
  const raw = (lead.meta as any)?.meetings;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.id === 'string' && typeof item.startsAt === 'string')
    .map((item) => ({
      id: item.id,
      title: String(item.title || ''),
      startsAt: String(item.startsAt),
      endsAt: item.endsAt ? String(item.endsAt) : '',
      meetingUrl: item.meetingUrl ? String(item.meetingUrl) : '',
      notes: item.notes ? String(item.notes) : '',
      attendeeUserIds: Array.isArray(item.attendeeUserIds)
        ? item.attendeeUserIds.map(String)
        : [],
      attendeeNames: Array.isArray(item.attendeeNames)
        ? item.attendeeNames.map(String)
        : [],
      closedAt: item.closedAt ? String(item.closedAt) : '',
      notifySentAt: item.notifySentAt ? String(item.notifySentAt) : '',
      reminder24hSentAt: item.reminder24hSentAt ? String(item.reminder24hSentAt) : '',
      reminder1hSentAt: item.reminder1hSentAt ? String(item.reminder1hSentAt) : '',
    }));
};

const resolveLocale = (lang: string) => {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
};

export const LeadsCalendarPage: React.FC = () => {
  const { i18n, t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const locale = resolveLocale(i18n.language || 'ru');
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = location.pathname;
  const isListTab = path === '/leads' || path === '/leads/list';
  const isKanbanTab = path === '/leads/board';
  const isCalendarTab = path === '/leads/calendar';
  const goList = () => navigate('/leads');
  const goBoard = () => navigate('/leads/board');
  const goCalendarTab = () => navigate('/leads/calendar');
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [staffUsers, setStaffUsers] = React.useState<StaffUser[]>([]);
  const [emailAccounts, setEmailAccounts] = React.useState<EmailAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showArchived, setShowArchived] = React.useState(false);
  const [meetingDraft, setMeetingDraft] = React.useState<MeetingDraft>(emptyDraft);
  const [meetingSaving, setMeetingSaving] = React.useState(false);
  const [upcomingRange, setUpcomingRange] = React.useState<'today' | 'week' | 'month' | 'all'>('week');
  const [upcomingProvider, setUpcomingProvider] = React.useState<'all' | 'google' | 'teams' | 'zoom' | 'other'>('all');
  const [upcomingQuery, setUpcomingQuery] = React.useState('');
  const [customViews, setCustomViews] = React.useState<LeadsCustomView[]>(() => loadLeadsCustomViews());
  const [viewsMenuOpen, setViewsMenuOpen] = React.useState(false);
  const [nameModalOpen, setNameModalOpen] = React.useState(false);
  const [nameModalMode, setNameModalMode] = React.useState<'create' | 'rename'>('create');
  const [nameModalCreateType, setNameModalCreateType] = React.useState<'table' | 'kanban' | 'calendar'>(
    'calendar',
  );
  const viewsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const activeViewId = searchParams.get('view');
  const activeCustomView = customViews.find((view) => view.id === activeViewId) || null;
  const calendarLabel = t('crm.leads.board.viewCalendar');
  const menuCreateTable = t('crm.leads.board.menu.createTable');
  const menuCreateKanban = t('crm.leads.board.menu.createKanban');
  const menuCreateCalendar = t('crm.leads.board.menu.createCalendar');
  const menuRename = t('crm.leads.board.menu.renameView');
  const menuDelete = t('crm.leads.board.menu.deleteView');
  const archivedLabel = t('crm.leads.calendar.filters.showArchived');
  const upcomingTitle = t('crm.leads.calendar.upcoming.title');
  const autoReminderHint = t('crm.leads.calendar.upcoming.autoReminderHint');
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchLeads(), fetchEmailAccounts().catch(() => []), fetchStaff().catch(() => [])])
      .then(([leadItems, accounts, staff]) => {
        if (!alive) return;
        setLeads(leadItems);
        setEmailAccounts(Array.isArray(accounts) ? accounts : []);
        setStaffUsers(Array.isArray(staff) ? staff.filter((u) => u.isActive) : []);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || t('crm.leads.calendar.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  React.useEffect(() => {
    if (!viewsMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (viewsMenuRef.current && !viewsMenuRef.current.contains(target)) {
        setViewsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [viewsMenuOpen]);

  React.useEffect(() => {
    if (!activeCustomView || activeCustomView.type !== 'calendar') return;
    setShowArchived(activeCustomView.settings?.showArchived ?? false);
  }, [activeCustomView?.id]);

  React.useEffect(() => {
    if (!activeCustomView || activeCustomView.type !== 'calendar') return;
    if (activeCustomView.settings?.showArchived === showArchived) return;
    setCustomViews((prev) =>
      updateLeadsCustomView(prev, activeCustomView.id, {
        settings: { ...(activeCustomView.settings ?? {}), showArchived },
      }),
    );
  }, [showArchived, activeCustomView?.id]);

  const openView = (type: 'table' | 'kanban' | 'calendar', viewId?: string) => {
    const basePath =
      type === 'table'
        ? '/leads'
        : type === 'kanban'
          ? '/leads/board'
          : '/leads/calendar';
    navigate(viewId ? `${basePath}?view=${viewId}` : basePath);
  };

  const confirmCreateView = (name: string) => {
    setCustomViews((prev) => {
      const next = createLeadsCustomView(prev, nameModalCreateType, name);
      const created = next[next.length - 1];
      if (created) openView(nameModalCreateType, created.id);
      return next;
    });
    setViewsMenuOpen(false);
  };

  const confirmRenameView = (name: string) => {
    if (!activeCustomView) return;
    setCustomViews((prev) =>
      updateLeadsCustomView(prev, activeCustomView.id, { name: name.trim() }),
    );
    setViewsMenuOpen(false);
  };

  const isArchivedLead = (lead: Lead) => Boolean(lead.meta?.archived);
  const isDeletedLead = (lead: Lead) => Boolean(lead.meta?.deleted);
  const leadsTabBadgeCount = React.useMemo(
    () =>
      leads.filter(
        (lead) => !isDeletedLead(lead) && (showArchived || !isArchivedLead(lead)),
      ).length,
    [leads, showArchived],
  );
  const filteredLeads = React.useMemo(
    () => (showArchived ? leads : leads.filter((lead) => !isArchivedLead(lead))),
    [leads, showArchived],
  );

  const meetingsByDate = React.useMemo(() => {
    const map = new Map<string, Array<{ lead: Lead; meeting: LeadMeeting }>>();
    filteredLeads.forEach((lead) => {
      readMeetings(lead).forEach((meeting) => {
        if (meeting.closedAt) return;
        const keys = dayKeysFromStartEndStrings(meeting.startsAt, meeting.endsAt);
        if (!keys.length) return;
        const seen = new Set<string>();
        keys.forEach((key) => {
          if (seen.has(key)) return;
          seen.add(key);
          const list = map.get(key) ?? [];
          list.push({ lead, meeting });
          map.set(key, list);
        });
      });
    });
    map.forEach((list, key) => {
      map.set(
        key,
        [...list].sort(
          (a, b) => new Date(a.meeting.startsAt).getTime() - new Date(b.meeting.startsAt).getTime(),
        ),
      );
    });
    return map;
  }, [filteredLeads]);

  const allMeetings = React.useMemo(() => {
    const items: Array<{ lead: Lead; meeting: LeadMeeting }> = [];
    filteredLeads.forEach((lead) => {
      readMeetings(lead)
        .filter((meeting) => !meeting.closedAt)
        .forEach((meeting) => items.push({ lead, meeting }));
    });
    return items.sort(
      (a, b) => new Date(a.meeting.startsAt).getTime() - new Date(b.meeting.startsAt).getTime(),
    );
  }, [filteredLeads]);

  const calendarDays = React.useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const firstWeekDay = (first.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - firstWeekDay);
    return Array.from({ length: 42 }, (_, idx) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + idx);
      const key = toDateKey(d);
      return {
        date: d,
        key,
        inCurrentMonth: d.getMonth() === month,
        items: meetingsByDate.get(key) ?? [],
      };
    });
  }, [currentMonth, meetingsByDate]);

  const weekDays = React.useMemo(() => {
    const monday = new Date(Date.UTC(2024, 0, 1));
    return Array.from({ length: 7 }, (_, idx) => {
      const day = new Date(monday);
      day.setUTCDate(monday.getUTCDate() + idx);
      return dayFormatter.format(day);
    });
  }, [dayFormatter]);

  const shiftMonth = (diff: number) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + diff, 1));
  };

  const goToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const openCreateMeeting = (dayKey: string) => {
    const base = new Date(`${dayKey}T10:00:00`);
    const finish = new Date(`${dayKey}T11:00:00`);
    setMeetingDraft({
      open: true,
      leadId: '',
      title: t('crm.leads.calendar.meeting.defaultTitle'),
      startsAt: toInputDateTime(base),
      endsAt: toInputDateTime(finish),
      meetingUrl: '',
      notes: '',
      attendeeUserIds: [],
    });
    setActionError(null);
    setActionMessage(null);
  };

  const openEditMeeting = (lead: Lead, meeting: LeadMeeting) => {
    setMeetingDraft({
      open: true,
      leadId: lead.id,
      meetingId: meeting.id,
      title: meeting.title || '',
      startsAt: toInputDateTime(new Date(meeting.startsAt)),
      endsAt: meeting.endsAt ? toInputDateTime(new Date(meeting.endsAt)) : '',
      meetingUrl: meeting.meetingUrl || '',
      notes: meeting.notes || '',
      attendeeUserIds: meeting.attendeeUserIds || [],
    });
    setActionError(null);
    setActionMessage(null);
  };

  const saveMeeting = async () => {
    if (!meetingDraft.leadId) {
      setActionError(t('crm.leads.calendar.form.selectLead'));
      return;
    }
    if (!meetingDraft.startsAt) {
      setActionError(t('crm.leads.calendar.errors.meetingDateRequired'));
      return;
    }
    const lead = leads.find((item) => item.id === meetingDraft.leadId);
    if (!lead) {
      setActionError(t('crm.leads.calendar.errors.leadNotFound'));
      return;
    }
    const currentMeetings = readMeetings(lead);
    const attendeeNames = staffUsers
      .filter((user) => meetingDraft.attendeeUserIds.includes(user.id))
      .map((user) => user.fullName || user.email);
    const nextMeeting: LeadMeeting = {
      id:
        meetingDraft.meetingId ||
        `meet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      title: meetingDraft.title.trim(),
      startsAt: new Date(meetingDraft.startsAt).toISOString(),
      endsAt: meetingDraft.endsAt ? new Date(meetingDraft.endsAt).toISOString() : '',
      meetingUrl: meetingDraft.meetingUrl.trim(),
      notes: meetingDraft.notes.trim(),
      attendeeUserIds: [...meetingDraft.attendeeUserIds],
      attendeeNames,
      closedAt: currentMeetings.find((m) => m.id === meetingDraft.meetingId)?.closedAt || '',
      notifySentAt: currentMeetings.find((m) => m.id === meetingDraft.meetingId)?.notifySentAt || '',
      reminder24hSentAt:
        currentMeetings.find((m) => m.id === meetingDraft.meetingId)?.reminder24hSentAt || '',
      reminder1hSentAt:
        currentMeetings.find((m) => m.id === meetingDraft.meetingId)?.reminder1hSentAt || '',
    };
    const nextMeetings = meetingDraft.meetingId
      ? currentMeetings.map((item) => (item.id === meetingDraft.meetingId ? nextMeeting : item))
      : [...currentMeetings, nextMeeting];
    const nextMeta = { ...(lead.meta ?? {}), meetings: nextMeetings };
    setMeetingSaving(true);
    try {
      const updated = await updateLead(lead.id, { meta: nextMeta });
      setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMeetingDraft(emptyDraft);
      setActionMessage(t('crm.leads.calendar.messages.meetingSaved'));
      setActionError(null);
    } catch (e: any) {
      setActionError(e?.message || t('crm.leads.calendar.errors.saveMeetingFailed'));
    } finally {
      setMeetingSaving(false);
    }
  };

  const closeMeeting = async () => {
    if (!meetingDraft.meetingId || !meetingDraft.leadId) return;
    const lead = leads.find((item) => item.id === meetingDraft.leadId);
    if (!lead) return;
    const currentMeetings = readMeetings(lead);
    const nextMeetings = currentMeetings.map((item) =>
      item.id === meetingDraft.meetingId ? { ...item, closedAt: new Date().toISOString() } : item,
    );
    setMeetingSaving(true);
    try {
      const updated = await updateLead(lead.id, { meta: { ...(lead.meta ?? {}), meetings: nextMeetings } });
      setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMeetingDraft(emptyDraft);
      setActionMessage(t('crm.leads.calendar.messages.meetingClosed'));
      setActionError(null);
    } catch (e: any) {
      setActionError(e?.message || t('crm.leads.calendar.errors.closeMeetingFailed'));
    } finally {
      setMeetingSaving(false);
    }
  };

  const sendMeetingEmail = async (
    lead: Lead,
    meeting: LeadMeeting,
    kind: 'invite' | 'reminder24h' | 'reminder1h',
  ) => {
    if (meeting.closedAt) return;
    if (!lead.email) {
      setActionError(t('crm.leads.calendar.errors.leadNoEmail'));
      return;
    }
    const attendeeEmails = staffUsers
      .filter((user) => (meeting.attendeeUserIds || []).includes(user.id))
      .map((user) => user.email)
      .filter(Boolean)
      .filter((email) => email !== lead.email);
    const account = emailAccounts.find((item) => item.status === 'active') || emailAccounts[0];
    if (!account) {
      setActionError(t('crm.leads.calendar.errors.noEmailAccount'));
      return;
    }
    const startText = dateTimeFormatter.format(new Date(meeting.startsAt));
    const endText = meeting.endsAt ? dateTimeFormatter.format(new Date(meeting.endsAt)) : '';
    const subjectBase = meeting.title || t('crm.leads.calendar.meeting.defaultTitle');
    const subject =
      kind === 'invite'
        ? t('crm.leads.calendar.email.subjectInvite', { title: subjectBase })
        : kind === 'reminder24h'
          ? t('crm.leads.calendar.email.subjectReminder24h', { title: subjectBase })
          : t('crm.leads.calendar.email.subjectReminder1h', { title: subjectBase });
    const textBody = [
      t('crm.leads.calendar.email.greeting', { name: lead.name || '' }).trim(),
      '',
      kind === 'invite'
        ? t('crm.leads.calendar.email.bodyInvite')
        : kind === 'reminder24h'
          ? t('crm.leads.calendar.email.bodyReminder24h')
          : t('crm.leads.calendar.email.bodyReminder1h'),
      `${t('crm.leads.calendar.email.meetingLabel')} ${subjectBase}`,
      `${t('crm.leads.calendar.email.startLabel')} ${startText}`,
      endText
        ? `${t('crm.leads.calendar.email.endLabel')} ${endText}`
        : '',
      meeting.meetingUrl
        ? `${t('crm.leads.calendar.email.linkLabel')} ${meeting.meetingUrl}`
        : '',
      meeting.notes
        ? `${t('crm.leads.calendar.email.notesLabel')} ${meeting.notes}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      const icsBase64 = buildMeetingIcsBase64(lead, meeting);
      await sendEmail({
        accountId: account.id,
        to: [lead.email],
        cc: attendeeEmails.length ? attendeeEmails : undefined,
        subject,
        textBody,
        leadId: lead.id,
        contactId: lead.contactId || undefined,
        companyId: lead.companyId || undefined,
        attachments: [
          {
            filename: 'meeting.ics',
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
            contentBase64: icsBase64,
          },
        ],
      });
      const currentMeetings = readMeetings(lead);
      const nextMeetings = currentMeetings.map((item) =>
        item.id === meeting.id
          ? {
              ...item,
              notifySentAt: kind === 'invite' ? new Date().toISOString() : item.notifySentAt,
              reminder24hSentAt: kind === 'reminder24h' ? new Date().toISOString() : item.reminder24hSentAt,
              reminder1hSentAt: kind === 'reminder1h' ? new Date().toISOString() : item.reminder1hSentAt,
            }
          : item,
      );
      const updated = await updateLead(lead.id, { meta: { ...(lead.meta ?? {}), meetings: nextMeetings } });
      setLeads((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setActionMessage(
        kind === 'invite'
          ? t('crm.leads.calendar.messages.inviteSent')
          : t('crm.leads.calendar.messages.reminderSent'),
      );
      setActionError(null);
    } catch (e: any) {
      setActionError(e?.message || t('crm.leads.calendar.errors.sendInviteFailed'));
    }
  };

  const sendMeetingInvite = async (lead: Lead, meeting: LeadMeeting) => {
    await sendMeetingEmail(lead, meeting, 'invite');
  };

  const statusDotClass = (status: string) => {
    if (status.includes('Новый')) return 'bg-rose-400';
    if (status.includes('работе')) return 'bg-sky-400';
    if (status.includes('Ожидает')) return 'bg-amber-400';
    if (status.includes('успех')) return 'bg-emerald-400';
    if (status.includes('проигран')) return 'bg-rose-500';
    return 'bg-slate-400';
  };

  const upcomingMeetings = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
    const endOfWeek = startOfToday + 7 * 24 * 60 * 60 * 1000;
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).getTime();
    return allMeetings
      .filter(({ lead, meeting }) => {
        const start = new Date(meeting.startsAt).getTime();
        if (start < Date.now()) return false;
        if (upcomingRange === 'today' && (start < startOfToday || start >= endOfToday)) return false;
        if (upcomingRange === 'week' && (start < startOfToday || start >= endOfWeek)) return false;
        if (upcomingRange === 'month' && (start < startOfToday || start >= endOfMonth)) return false;
        if (upcomingProvider !== 'all' && meetingProvider(meeting.meetingUrl) !== upcomingProvider) return false;
        if (upcomingQuery.trim()) {
          const q = upcomingQuery.trim().toLowerCase();
          const hay = `${lead.name || ''} ${lead.email || ''} ${meeting.title || ''} ${meeting.notes || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice(0, 30);
  }, [allMeetings, upcomingProvider, upcomingQuery, upcomingRange]);

  return (
    <MainLayout>
      <ViewNameModal
        open={nameModalOpen}
        title={
          nameModalMode === 'rename'
            ? t('crm.leads.board.menu.renameViewModalTitle')
            : nameModalCreateType === 'table'
              ? t('crm.leads.board.menu.createTableModalTitle')
              : nameModalCreateType === 'kanban'
                ? t('crm.leads.board.menu.createKanbanModalTitle')
                : t('crm.leads.board.menu.createCalendarModalTitle')
        }
        label={t('crm.leads.board.menu.viewNamePrompt')}
        initialValue={nameModalMode === 'rename' && activeCustomView ? activeCustomView.name : ''}
        confirmLabel={
          nameModalMode === 'rename'
            ? t('crm.common.save')
            : t('crm.leads.board.menu.viewModalConfirmCreate')
        }
        cancelLabel={t('crm.common.cancel')}
        onClose={() => setNameModalOpen(false)}
        onConfirm={(name) => {
          if (nameModalMode === 'rename') confirmRenameView(name);
          else confirmCreateView(name);
        }}
      />
      <div
        className="lv-pt w-full pb-8 min-w-0"
        style={{ marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24, width: 'calc(100% + 48px)' }}
      >
        <div className="lv-pt-head">
          <div>
            <h1>{t('crm.leads.calendar.title')}</h1>
            <div className="sub">{t('crm.leads.calendar.subtitle')}</div>
          </div>
        </div>

        <div className="lv-view-tabs">
          <button type="button" className={`lv-view-tab${isListTab ? ' active' : ''}`} onClick={goList}>
            {t('crm.leads.list.viewList')}
            <span className="badge">{leadsTabBadgeCount}</span>
          </button>
          <button type="button" className={`lv-view-tab${isKanbanTab ? ' active' : ''}`} onClick={goBoard}>
            {t('crm.leads.list.viewKanban')}
          </button>
          <button type="button" className={`lv-view-tab${isCalendarTab ? ' active' : ''}`} onClick={goCalendarTab}>
            {calendarLabel}
          </button>
          {customViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => openView(view.type, view.id)}
              className={`group lv-view-tab${activeCustomView?.id === view.id ? ' active' : ''}`}
            >
              {view.name}
              {activeCustomView?.id === view.id && (
                <span
                  role="button"
                  tabIndex={0}
                  className="lv-view-tab-menu-btn visible"
                  aria-label="menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewsMenuOpen((v) => !v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewsMenuOpen((v) => !v);
                    }
                  }}
                >
                  ⋯
                </span>
              )}
            </button>
          ))}
          <div className="relative" ref={viewsMenuRef}>
            <button type="button" className="lv-view-tabs-add" onClick={() => setViewsMenuOpen((v) => !v)} title="…">
              +
            </button>
            {viewsMenuOpen && (
              <div className="lv-popover" style={{ top: 'calc(100% + 6px)', left: 0, zIndex: 40 }}>
                <div className="lv-popover-title">{t('crm.leads.board.pageTitle')}</div>
                <button
                  type="button"
                  className="lv-st-popover-item"
                  onClick={() => {
                    setNameModalCreateType('table');
                    setNameModalMode('create');
                    setNameModalOpen(true);
                    setViewsMenuOpen(false);
                  }}
                >
                  {menuCreateTable}
                </button>
                <button
                  type="button"
                  className="lv-st-popover-item"
                  onClick={() => {
                    setNameModalCreateType('kanban');
                    setNameModalMode('create');
                    setNameModalOpen(true);
                    setViewsMenuOpen(false);
                  }}
                >
                  {menuCreateKanban}
                </button>
                <button
                  type="button"
                  className="lv-st-popover-item"
                  onClick={() => {
                    setNameModalCreateType('calendar');
                    setNameModalMode('create');
                    setNameModalOpen(true);
                    setViewsMenuOpen(false);
                  }}
                >
                  {menuCreateCalendar}
                </button>
                {activeCustomView ? (
                  <>
                    <div style={{ borderTop: '1px solid var(--line-2)', margin: '6px 0' }} />
                    <button
                      type="button"
                      className="lv-st-popover-item"
                      onClick={() => {
                        setNameModalMode('rename');
                        setNameModalOpen(true);
                        setViewsMenuOpen(false);
                      }}
                    >
                      {menuRename}
                    </button>
                    <button
                      type="button"
                      className="lv-st-popover-item"
                      style={{ color: '#9a1f31' }}
                      onClick={async () => {
                        setViewsMenuOpen(false);
                        const ok = await showConfirm(t('crm.leads.board.deleteViewConfirm', { defaultValue: 'Удалить вид? Действие необратимо.' }), {
                          title: 'Удаление',
                          confirmLabel: 'Удалить',
                          cancelLabel: 'Отмена',
                          danger: true,
                        });
                        if (!ok) return;
                        setCustomViews((prev) => deleteLeadsCustomView(prev, activeCustomView.id));
                        navigate('/leads/calendar');
                      }}
                    >
                      {menuDelete}
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
        {(actionMessage || actionError) && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              actionError ? 'border-red-200 bg-status-error-bg text-status-error' : 'border-green-200 bg-status-success-bg text-status-success'
            }`}
          >
            {actionError || actionMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="btn-secondary btn-secondary-sm"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="btn-secondary btn-secondary-sm"
            >
              →
            </button>
            <button
              type="button"
              onClick={goToday}
              className="btn-secondary btn-secondary-sm"
            >
              {t('crm.leads.calendar.actions.today')}
            </button>
            <button
              type="button"
              onClick={() => openCreateMeeting(toDateKey(new Date().toISOString()))}
              className="rounded-xl border border-[#222222] bg-[#222222] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
            >
              {t('crm.leads.calendar.actions.planMeeting')}
            </button>
          </div>
          <div className="text-sm font-semibold text-[#111827] capitalize">{monthFormatter.format(currentMonth)}</div>
          <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {archivedLabel}
          </label>
        </div>

        <div className="relative card p-3 sm:p-4">
          {loading ? (
            <div className="px-2 py-3 text-xs text-text-tertiary">
              {t('crm.leads.calendar.loading')}
            </div>
          ) : error ? (
            <div className="px-2 py-3 text-xs text-rose-300">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-7 gap-2 pb-2">
                  {weekDays.map((day) => (
                    <div key={day} className="px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-text-tertiary">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((dayCell) => (
                    <div
                      key={dayCell.key}
                      className={`min-h-[150px] rounded-2xl border p-2 ${
                        dayCell.inCurrentMonth
                          ? 'border-border-default bg-white'
                          : 'border-border-default bg-surface-subtle'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className={`text-xs font-semibold ${dayCell.inCurrentMonth ? 'text-[#111827]' : 'text-text-tertiary'}`}>
                          {dayCell.date.getDate()}
                        </div>
                        <button
                          type="button"
                          onClick={() => openCreateMeeting(dayCell.key)}
                          className="rounded-md border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-surface-hover transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <div className="space-y-1">
                        {dayCell.items.slice(0, 3).map(({ lead, meeting }) => (
                          <div
                            key={meeting.id}
                            className="rounded-lg border border-border-default bg-surface-subtle px-2 py-1"
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/leads/${lead.id}`)}
                              className="w-full text-left"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotClass(lead.status)}`} />
                                <span className="truncate text-[11px] text-[#111827]">{meeting.title || lead.name || `#${lead.id.slice(0, 6)}`}</span>
                              </div>
                              <div className="truncate text-[10px] text-text-tertiary">
                                {dateTimeFormatter.format(new Date(meeting.startsAt))} ·{' '}
                                {lead.name || lead.email || lead.phone || t('crm.leads.calendar.fallbacks.lead')}
                              </div>
                              {meeting.attendeeNames && meeting.attendeeNames.length ? (
                                <div className="truncate text-[10px] text-text-tertiary">
                                  {t('crm.leads.calendar.labels.team')}{' '}
                                  {meeting.attendeeNames.join(', ')}
                                </div>
                              ) : null}
                            </button>
                            <div className="mt-1 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditMeeting(lead, meeting)}
                                className="rounded-md border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-surface-hover transition-colors"
                              >
                                {t('crm.leads.calendar.actions.editShort')}
                              </button>
                              <button
                                type="button"
                                onClick={() => sendMeetingInvite(lead, meeting)}
                                className="rounded-md border border-indigo-700/60 px-1.5 py-0.5 text-[10px] text-indigo-200 hover:bg-indigo-900/40"
                              >
                                {meeting.notifySentAt
                                  ? t('crm.leads.calendar.actions.resend')
                                  : t('crm.leads.calendar.actions.notify')}
                              </button>
                              {meeting.meetingUrl ? (
                                <a
                                  href={meeting.meetingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md border border-border-default px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-surface-hover transition-colors"
                                >
                                  {t('crm.leads.calendar.actions.link')}
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {dayCell.items.length > 3 ? (
                          <div className="px-1 text-[10px] text-text-tertiary">+{dayCell.items.length - 3}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {meetingDraft.open ? (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setMeetingDraft(emptyDraft)}
            >
              <div
                className="w-full max-w-xl modal-panel p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[#111827]">
                    {meetingDraft.meetingId
                      ? t('crm.leads.calendar.form.editMeeting')
                      : t('crm.leads.calendar.form.newMeeting')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMeetingDraft(emptyDraft)}
                    className="rounded-full border border-border-default px-2 py-0.5 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
                  >
                    ×
                  </button>
                </div>
                <div className="grid gap-2">
                  <select
                    value={meetingDraft.leadId}
                    onChange={(e) => setMeetingDraft((prev) => ({ ...prev, leadId: e.target.value }))}
                    className="base-input px-3 py-2 text-sm"
                  >
                    <option value="">
                      {t('crm.leads.calendar.form.selectLead')}
                    </option>
                    {filteredLeads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.name || lead.email || lead.phone || `#${lead.id.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>

                  <div className="rounded-xl border border-border-default bg-surface-subtle px-3 py-2">
                    <div className="mb-2 text-[11px] text-text-tertiary">
                      {t('crm.leads.calendar.form.inviteManagers')}
                    </div>
                    <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
                      {staffUsers.length === 0 ? (
                        <div className="text-[11px] text-text-tertiary">
                          {t('crm.leads.calendar.form.noTeamMembers')}
                        </div>
                      ) : (
                        staffUsers.map((user) => (
                          <label key={user.id} className="flex items-center gap-2 text-xs text-[#111827]">
                            <input
                              type="checkbox"
                              checked={meetingDraft.attendeeUserIds.includes(user.id)}
                              onChange={(e) =>
                                setMeetingDraft((prev) => ({
                                  ...prev,
                                  attendeeUserIds: e.target.checked
                                    ? [...prev.attendeeUserIds, user.id]
                                    : prev.attendeeUserIds.filter((id) => id !== user.id),
                                }))
                              }
                            />
                            <span>{user.fullName || user.email}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <input
                    value={meetingDraft.title}
                    onChange={(e) => setMeetingDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={t('crm.leads.calendar.form.meetingTitle')}
                    className="base-input px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={meetingDraft.startsAt}
                      onChange={(e) => setMeetingDraft((prev) => ({ ...prev, startsAt: e.target.value }))}
                      className="base-input px-3 py-2 text-sm"
                    />
                    <input
                      type="datetime-local"
                      value={meetingDraft.endsAt}
                      onChange={(e) => setMeetingDraft((prev) => ({ ...prev, endsAt: e.target.value }))}
                      className="base-input px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    value={meetingDraft.meetingUrl}
                    onChange={(e) => setMeetingDraft((prev) => ({ ...prev, meetingUrl: e.target.value }))}
                    placeholder="https://meet.google.com/... or Zoom/Teams link"
                    className="base-input px-3 py-2 text-sm"
                  />
                  <textarea
                    value={meetingDraft.notes}
                    onChange={(e) => setMeetingDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={t('crm.leads.calendar.form.notesPlaceholder')}
                    rows={3}
                    className="base-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    {meetingDraft.meetingId ? (
                      <button
                        type="button"
                        onClick={closeMeeting}
                        disabled={meetingSaving}
                        className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      >
                        {t('crm.leads.calendar.actions.closeMeeting')}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMeetingDraft(emptyDraft)}
                      className="btn-secondary btn-secondary-sm"
                    >
                      {t('crm.leads.calendar.actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={saveMeeting}
                      disabled={meetingSaving}
                      className="btn-primary btn-secondary-sm disabled:opacity-60"
                    >
                      {meetingSaving
                        ? t('crm.leads.calendar.actions.saving')
                        : t('crm.leads.calendar.actions.saveMeeting')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card p-4">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-[#111827]">{upcomingTitle}</div>
              <div className="text-[11px] text-text-tertiary">{autoReminderHint}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={upcomingRange}
                onChange={(e) => setUpcomingRange(e.target.value as 'today' | 'week' | 'month' | 'all')}
                className="base-select px-2.5 py-1.5 text-xs"
              >
                <option value="today">{t('crm.leads.calendar.actions.today')}</option>
                <option value="week">{t('crm.leads.calendar.filters.rangeWeek')}</option>
                <option value="month">{t('crm.leads.calendar.filters.rangeMonth')}</option>
                <option value="all">{t('crm.leads.calendar.filters.rangeAll')}</option>
              </select>
              <select
                value={upcomingProvider}
                onChange={(e) => setUpcomingProvider(e.target.value as 'all' | 'google' | 'teams' | 'zoom' | 'other')}
                className="base-select px-2.5 py-1.5 text-xs"
              >
                <option value="all">{t('crm.leads.calendar.filters.providerAny')}</option>
                <option value="google">Google Meet</option>
                <option value="teams">Teams</option>
                <option value="zoom">Zoom</option>
                <option value="other">{t('crm.leads.calendar.filters.providerOther')}</option>
              </select>
              <input
                value={upcomingQuery}
                onChange={(e) => setUpcomingQuery(e.target.value)}
                placeholder={t('crm.leads.calendar.filters.search')}
                className="base-select px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            {upcomingMeetings.length === 0 ? (
              <div className="rounded-xl border border-border-default bg-surface-subtle px-3 py-2 text-xs text-text-tertiary">
                {t('crm.leads.calendar.upcoming.empty')}
              </div>
            ) : (
              upcomingMeetings.map(({ lead, meeting }) => (
                <div
                  key={`${lead.id}_${meeting.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border-default bg-white px-3 py-2 lg:flex-row lg:items-center lg:justify-between hover:bg-surface-hover transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[#111827]">
                      {meeting.title || t('crm.leads.calendar.meeting.defaultTitle')}
                    </div>
                    <div className="truncate text-[11px] text-text-tertiary">
                      {dateTimeFormatter.format(new Date(meeting.startsAt))} · {lead.name || lead.email || lead.phone || `#${lead.id.slice(0, 6)}`}
                    </div>
                    {meeting.attendeeNames && meeting.attendeeNames.length ? (
                      <div className="truncate text-[11px] text-text-tertiary">
                        {t('crm.leads.calendar.labels.team')}{' '}
                        {meeting.attendeeNames.join(', ')}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditMeeting(lead, meeting)}
                      className="rounded-md border border-border-default px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-hover transition-colors"
                    >
                      {t('crm.leads.calendar.actions.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendMeetingInvite(lead, meeting)}
                      className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      {t('crm.leads.calendar.actions.sendInvite')}
                    </button>
                    {meeting.meetingUrl ? (
                      <a
                        href={meeting.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-border-default px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-hover transition-colors"
                      >
                        {t('crm.leads.calendar.actions.openLink')}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </div>
      </div>

    </MainLayout>
  );
};


