// src/pages/leads/LeadFormPage.tsx
// Карточка лида. Редизайн 2026-09-28 по макету claude.ai/design lead-detail.html: шапка + воронка статусов +
// полоса ключевых цифр, слева данные лида, в центре единая переписка (WhatsApp/Telegram/почта) с
// комментариями и историей, справа ИИ, чек-лист, встречи и ответственные.
import { CommentMetaLine } from '../../components/ai/aiComments';
import { AiAssigneeGroup } from '../../components/ai/AiAssigneeGroup';
import { AiRecordChat } from '../../components/ai/AiRecordChat';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AiLeadScoreCard, loadCachedLeadScore } from '../../components/ai/AiLeadScoreCard';
import { AiEnrichPanel } from '../../components/ai/AiEnrichPanel';
import { AiNextActionCard } from '../../components/ai/AiNextActionCard';
import { AiOutreachEmailCard } from '../../components/ai/AiOutreachEmailCard';
import { CalendarEntryModal } from '../../components/CalendarEntryModal';
import { readMeetings } from './LeadsCalendarPage';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton, InlineHelpButton } from '../../components/help/PageHelpButton';
import { useTranslation } from 'react-i18next';
import { deleteLead } from '../../api/leads';
import { isForbiddenError } from '../../api/client';
import {
  fetchLeadById,
  createLead,
  updateLead,
  fetchLeadHistory,
  convertLead,
} from '../../api/leads';
import type { Lead, LeadStatus, LeadActivity, LeadComment } from '../../api/leads';
import type { AiLeadScoreResult } from '../../api/ai';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { getStoredUser } from '../../auth/session';
import { usePermission } from '../../hooks/usePermission';
import { splitTextWithMentions, isTextMentioning } from '../projects/mentions';
import { ccpApi, type CcpClient, type CcpSite } from '../../api/ccp';
import { fetchCompanies, createCompany, type Company } from '../../api/companies';
import { createContact, fetchContact } from '../../api/contacts';
import { CompanySelect } from '../../components/CompanySelect';
import { ContactSelect } from '../../components/ContactSelect';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { JiraIssueLinkPanel } from '../../components/integrations/JiraIssueLinkPanel';
import { ExternalLinksPanel } from '../../components/integrations/ExternalLinksPanel';
import {
  fetchProjects,
  fetchProjectActivities,
  type ProjectActivity,
} from '../../api/projects';
import type { Project } from '../projects/projectTypes';
import { fetchSales, type Sale } from '../../api/sales';
import { fetchReservationsByLead, type Reservation } from '../../api/bookings';
import { translateSaleStatus } from '../sales/saleStatusI18n';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { saleOrderDisplayNumber } from '../../utils/saleOrderDisplay';
import { extractSaleProductUrl } from '../../utils/saleLinks';
import { LeadComms, CH_ACCENT, CH_ICON, Ico, type ChannelKey, type CommsActivity, type CommsContacts, type LeadCommsHandle } from './LeadComms';
import './leadDetail.css';

type CenterTab = 'chat' | 'comments' | 'history';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

// статусы — ровно те же строки, что в api/leads.ts (LeadStatus); это данные, а не текст интерфейса
const STATUS_OPTIONS: LeadStatus[] = [
  'Новый клиент',
  'В работе',
  'Ожидает ответа',
  'Закрыт (успех)',
  'Закрыт (проигран)',
];
const FLOW_STATUSES = STATUS_OPTIONS.slice(0, 3);
const STATUS_WON: LeadStatus = 'Закрыт (успех)';
const STATUS_LOST: LeadStatus = 'Закрыт (проигран)';
const STATUS_DOT: Record<string, string> = {
  'Новый клиент': '#2563eb',
  'В работе': '#ea580c',
  'Ожидает ответа': '#d97706',
  'Закрыт (успех)': '#16a34a',
  'Закрыт (проигран)': '#dc2626',
};

const RESERVATION_STATUSES = [
  'draft', 'pending', 'confirmed', 'checked_in', 'in_progress', 'completed',
  'cancelled_by_customer', 'cancelled_by_business', 'rejected', 'no_show',
];

// Заготовка для нового лида
function createEmptyLead(): Lead {
  const now = new Date().toISOString();
  return {
    id: 'new',
    name: '',
    phone: '',
    email: '',
    country: '',
    status: 'Новый клиент', // человекочитаемый статус
    channel: 'manual',
    source: null,
    customFields: {},
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    utmContent: '',
    utmTerm: '',
    assignedTo: null,
    assignedUserId: null,
    assignedUserIds: [],
    assignedToList: [],
    meta: {},
    amount: 0,
    currency: 'TRY',
    tasks: [],
    comments: [],
    commentsCount: 0,
    createdAt: now,
    updatedAt: now,
    myAccessTier: 'owner',
    canViewAnalytics: true,
    canEdit: true,
    canDelete: true,
    canReassign: true,
  } as Lead;
}

/** Поля, изменение которых делает карточку «несохранённой» (комментарии сохраняются сами). */
function editableSnapshot(l: Lead): string {
  return JSON.stringify([
    l.name, l.email, l.phone, l.country, l.status, l.channel, l.companyId ?? null, l.contactId ?? null,
    l.customFields ?? {}, l.meta ?? {}, Number(l.amount) || 0, l.currency, l.tasks,
    [...(l.assignedUserIds ?? [])].sort(),
  ]);
}

const initials = (name?: string | null) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('') || '·';

const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

const CHEV = <path d="M6 9l6 6 6-6" />;
const EXT = (
  <>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </>
);
const MORE = (
  <>
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="19" cy="12" r="1.2" />
  </>
);
const CONV = (
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3 3-5.5 6-5.5" />
    <path d="M15 15h6M18 12v6" />
  </>
);
const PLUS = <path d="M12 5v14M5 12h14" />;

/** Старый сворачиваемый блок — оставлен для внешних потребителей (LeadTelegramThread и др.). */
export function CollapsibleCard({
  title,
  right,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid #e7e7e7`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: open ? 12 : 0 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', minWidth: 0 }}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#888', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span style={{ fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </span>
        </button>
        {right}
      </div>
      {open && children}
    </div>
  );
}

function Sec({
  title,
  right,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cx('ld-sec', !open && 'cl')}>
      <header>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Ico d={CHEV} size={13} />
          <span>{title}</span>
        </button>
        {right}
      </header>
      {open && <div className="ld-sec-b">{children}</div>}
    </section>
  );
}

export const LeadFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  // Гейт на само поле «Сумма» действует только при редактировании — на создании (leads_create
  // уже проверен бэкендом на POST /leads) сумму указывает кто угодно, кто может создать лид.
  // Хук вызывается безусловно (иначе после создания лид-страница переходит из isNew=true в
  // isNew=false без ремонта, и React ловит несовпадение числа хуков между рендерами).
  const canEditAmountPermission = usePermission('leads_edit_amount');
  const canEditAmount = isNew || canEditAmountPermission;

  const { t, i18n } = useTranslation();
  const { showConfirm } = useAlertModal();
  const locale = resolveLocale(i18n.language || 'ru');
  const navigate = useNavigate();

  const [tab, setTab] = useState<CenterTab>('chat');
  const [lead, setLead] = useState<Lead>(createEmptyLead());
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false);
  const [customFieldsError, setCustomFieldsError] = useState<string | null>(null);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.keys(lead.customFields ?? {}).forEach((key) => keys.add(key));
    return Array.from(keys);
  }, [lead.customFields]);

  // «Несохранённые изменения»: снимок последнего сохранённого/загруженного состояния
  const baselineRef = useRef<Lead>(lead);
  const [baselineSnap, setBaselineSnap] = useState<string>(() => editableSnapshot(lead));
  const setBaseline = (l: Lead) => {
    baselineRef.current = l;
    setBaselineSnap(editableSnapshot(l));
  };

  // переписка
  const commsRef = useRef<LeadCommsHandle | null>(null);
  const [unread, setUnread] = useState(0);
  const [lastActivity, setLastActivity] = useState<CommsActivity | null>(null);
  const [chContacts, setChContacts] = useState<CommsContacts>({ whatsapp: null, telegram: null, email: null });
  const [aiScore, setAiScore] = useState<AiLeadScoreResult | null>(null);

  // история лида
  const [history, setHistory] = useState<LeadActivity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  const [leadProjects, setLeadProjects] = useState<Project[]>([]);
  const [leadProjectsLoading, setLeadProjectsLoading] = useState(false);
  const [leadProjectsError, setLeadProjectsError] = useState<string | null>(null);
  const [leadSales, setLeadSales] = useState<Sale[]>([]);
  const [leadReservations, setLeadReservations] = useState<Reservation[]>([]);
  const [projectActivities, setProjectActivities] = useState<ProjectActivity[]>([]);
  const [projectActivitiesLoading, setProjectActivitiesLoading] = useState(false);
  const [projectActivitiesError, setProjectActivitiesError] = useState<string | null>(null);

  // Комментарии лида (упоминания/лайки/ответы — как у проектов)
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const lastCommentsSnapshotRef = useRef<string>('');
  const leadRef = useRef<Lead>(lead);
  useEffect(() => {
    leadRef.current = lead;
  }, [lead]);

  const [ccpClient, setCcpClient] = useState<CcpClient | null>(null);
  const [ccpClientLoading, setCcpClientLoading] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSites, setAccountSites] = useState<CcpSite[]>([]);
  const [accountSiteId, setAccountSiteId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountBalanceEur, setAccountBalanceEur] = useState('');
  const [accountBalanceUsd, setAccountBalanceUsd] = useState('');

  // Модальное окно создания компании
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyCountry, setCompanyCountry] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);

  // Модальное окно конвертации лида в клиента (Contact + Company)
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertPosition, setConvertPosition] = useState('');
  const [convertCity, setConvertCity] = useState('');
  const [convertCompanyName, setConvertCompanyName] = useState('');
  const [convertMarkWon, setConvertMarkWon] = useState(false);

  const [calendarModal, setCalendarModal] = useState<'meeting' | 'note' | null>(null);

  const handleApplyEnrich = useCallback((field: string, value: string) => {
    setLead((prev) => ({ ...prev, [field]: value }));
  }, []);

  const openComposer = (ch: ChannelKey, subject?: string, body?: string) => {
    setTab('chat');
    requestAnimationFrame(() => commsRef.current?.compose({ ch, subject, body }));
  };

  const handleSendOutreach = useCallback((subject: string, body: string) => {
    openComposer('email', subject, body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((current) => (current === msg ? null : current));
    }, 2500);
  };
  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => {
      setError((current) => (current === msg ? null : current));
    }, 3500);
  };

  /** A widget's own fetch 403ing must not surface NestJS's raw "Forbidden resource" — swap in a
   * friendly message pointing at the assignee instead. */
  const friendlyErr = (e: unknown, fallback: string): string =>
    isForbiddenError(e) ? t('crm.errors.inlineForbidden') : ((e as Error)?.message || fallback);

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      'Новый клиент': t('crm.leads.statusValues.new'),
      'В работе': t('crm.leads.statusValues.inProgress'),
      'Ожидает ответа': t('crm.leads.statusValues.waiting'),
      'Закрыт (успех)': t('crm.leads.statusValues.won'),
      'Закрыт (проигран)': t('crm.leads.statusValues.lost'),
    }),
    [t],
  );

  // Отбрасываем битые записи (не объект / без текста) — чтобы поломанные данные
  // не роняли всю страницу при рендере, а просто не показывались.
  const sanitizeComments = (raw: unknown): LeadComment[] => {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (c): c is LeadComment =>
        !!c && typeof c === 'object' && !Array.isArray(c) && typeof (c as LeadComment).id === 'string' && typeof (c as LeadComment).text === 'string',
    );
  };

  const getActivityLabel = (a: LeadActivity): string => {
    switch (a.type) {
      case 'created':
        return t('crm.leads.form.activity.created');
      case 'status_changed':
        return t('crm.leads.form.activity.statusChanged');
      case 'assignee_changed':
        return t('crm.leads.form.activity.assigneeChanged');
      case 'comment':
        return t('crm.leads.form.activity.comment');
      default:
        return a.type;
    }
  };

  const projectActivityLabels = useMemo<Record<string, string>>(
    () => ({
      create: t('crm.projects.detail.history.actions.create'),
      update: t('crm.projects.detail.history.actions.update'),
      status_change: t('crm.projects.detail.history.actions.status'),
      archive: t('crm.projects.detail.history.actions.archive'),
      unarchive: t('crm.projects.detail.history.actions.unarchive'),
      delete: t('crm.projects.detail.history.actions.delete'),
      restore: t('crm.projects.detail.history.actions.restore'),
    }),
    [t],
  );

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    leadProjects.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [leadProjects]);

  const mergedTimeline = useMemo(() => {
    type Row =
      | { kind: 'lead'; activity: LeadActivity }
      | { kind: 'project'; activity: ProjectActivity };
    const rows: Row[] = [
      ...history.map((activity) => ({ kind: 'lead' as const, activity })),
      ...projectActivities.map((activity) => ({ kind: 'project' as const, activity })),
    ];
    rows.sort((a, b) => new Date(b.activity.createdAt).getTime() - new Date(a.activity.createdAt).getTime());
    return rows;
  }, [history, projectActivities]);

  const leadMeetings = useMemo(() => readMeetings(lead), [lead]);
  const sortedLeadMeetings = useMemo(
    () => [...leadMeetings].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [leadMeetings],
  );

  const hasUtmCaptured = useMemo(() => {
    return [lead.utmSource, lead.utmMedium, lead.utmCampaign, lead.utmContent, lead.utmTerm].some(
      (v) => String(v ?? '').trim().length > 0,
    );
  }, [lead]);

  const activeCustomFields = useMemo(() => customFields.filter((field) => field.isActive), [customFields]);

  const getCustomFieldValue = (field: CustomField) => (lead.customFields ?? {})[field.key];

  const setCustomFieldValue = (field: CustomField, value: any) => {
    setLead((prev) => ({
      ...prev,
      customFields: {
        ...(prev.customFields ?? {}),
        [field.key]: value,
      },
    }));
  };

  const renderCustomFieldInput = (field: CustomField) => {
    const value = getCustomFieldValue(field);
    const label = (
      <span className="l">
        {field.label}
        {field.required && <i>*</i>}
      </span>
    );

    if (field.type === 'boolean') {
      return (
        <label key={field.id} className="ld-f w chk">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => setCustomFieldValue(field, e.target.checked)} />
          {field.label}
        </label>
      );
    }

    if (field.type === 'textarea') {
      return (
        <label key={field.id} className="ld-f w">
          {label}
          <textarea value={value ?? ''} onChange={(e) => setCustomFieldValue(field, e.target.value)} placeholder={field.placeholder || ''} rows={3} />
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <label key={field.id} className="ld-f w">
          {label}
          <select value={value ?? ''} onChange={(e) => setCustomFieldValue(field, e.target.value)}>
            <option value="">{field.placeholder || t('crm.leadCard.custom.notSelected')}</option>
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === 'multiselect') {
      const arrayValue = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'string' && value
          ? value.split(',').map((v) => v.trim())
          : [];
      return (
        <label key={field.id} className="ld-f w">
          {label}
          <select
            multiple
            value={arrayValue}
            onChange={(e) => setCustomFieldValue(field, Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    const inputType =
      field.type === 'number'
        ? 'number'
        : field.type === 'email'
          ? 'email'
          : field.type === 'phone'
            ? 'tel'
            : field.type === 'date'
              ? 'date'
              : field.type === 'datetime'
                ? 'datetime-local'
                : field.type === 'url'
                  ? 'url'
                  : 'text';

    return (
      <label key={field.id} className="ld-f w">
        {label}
        <input
          type={inputType}
          className={field.type === 'number' || field.type === 'phone' ? 'mono' : undefined}
          value={value ?? ''}
          onChange={(e) => {
            const next = field.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
            setCustomFieldValue(field, next);
          }}
          placeholder={field.placeholder || ''}
        />
      </label>
    );
  };

  // загрузка компаний (имя компании в шапке)
  useEffect(() => {
    let alive = true;
    fetchCompanies({ limit: 100 })
      .then((data) => {
        if (alive) setCompanies(data.items);
      })
      .catch((e) => console.error('companies load error', e));
    return () => {
      alive = false;
    };
  }, []);

  // загрузка кастомных полей лида
  useEffect(() => {
    let alive = true;
    setCustomFieldsLoading(true);
    setCustomFieldsError(null);
    fetchCustomFields('lead')
      .then((items) => {
        if (!alive) return;
        setCustomFields([...items].sort((a, b) => a.order - b.order));
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setCustomFieldsError(friendlyErr(e, t('crm.leads.form.fields.customFieldsLoading')));
      })
      .finally(() => {
        if (alive) setCustomFieldsLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // значения по умолчанию кастомных полей (не считаем их правкой пользователя)
  useEffect(() => {
    if (!customFields.length || loading) return;
    const apply = (prev: Lead): Lead => {
      const existing = prev.customFields ?? {};
      let changed = false;
      const next: Record<string, any> = { ...existing };
      customFields.forEach((field) => {
        if (next[field.key] !== undefined) return;
        if (field.defaultValue === null || field.defaultValue === undefined) return;
        if (field.type === 'boolean') next[field.key] = field.defaultValue === 'true';
        else if (field.type === 'number') next[field.key] = Number(field.defaultValue);
        else if (field.type === 'multiselect')
          next[field.key] = String(field.defaultValue).split(',').map((v) => v.trim()).filter(Boolean);
        else next[field.key] = field.defaultValue;
        changed = true;
      });
      return changed ? { ...prev, customFields: next } : prev;
    };
    setLead((prev) => apply(prev));
    if (!isNew) setBaseline(apply(baselineRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFields, loading]);

  // загрузка лида + сотрудников + истории
  useEffect(() => {
    let alive = true;
    setError(null);

    if (isNew) {
      const empty = createEmptyLead();
      setLead(empty);
      setBaseline(empty);
      setLoading(false);
      setHistory([]);
      setHistoryError(null);
      setComments([]);
      lastCommentsSnapshotRef.current = '';
    } else {
      setLoading(true);
      setAiScore(loadCachedLeadScore(id as string));

      fetchLeadById(id as string)
        .then((data) => {
          if (!alive) return;
          setLead(data);
          setBaseline(data);
          const cleanComments = sanitizeComments(data.comments);
          setComments(cleanComments);
          lastCommentsSnapshotRef.current = JSON.stringify(cleanComments);
        })
        .catch((e) => {
          console.error(e);
          if (alive) setError(friendlyErr(e, t('crm.leads.form.errors.loadLead')));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });

      setHistoryLoading(true);
      setHistoryError(null);
      fetchLeadHistory(id as string)
        .then((items) => {
          if (alive) setHistory(items ?? []);
        })
        .catch((e) => {
          console.error('lead history load error', e);
          if (!alive) return;
          setHistory([]);
          setHistoryError(friendlyErr(e, t('crm.leads.form.errors.historyLoad')));
        })
        .finally(() => {
          if (alive) setHistoryLoading(false);
        });
    }

    fetchStaff()
      .then((users) => {
        if (alive) setStaff(users);
      })
      .catch((e) => console.error('staff load error', e));

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  // Проекты, привязанные к лиду (API: ?leadId=)
  useEffect(() => {
    if (isNew || !id) {
      setLeadProjects([]);
      setLeadProjectsError(null);
      setLeadProjectsLoading(false);
      return;
    }
    let alive = true;
    setLeadProjectsLoading(true);
    setLeadProjectsError(null);
    fetchProjects({ leadId: id })
      .then((res) => {
        if (alive) setLeadProjects(res.items);
      })
      .catch((e) => {
        console.error('lead projects load error', e);
        if (!alive) return;
        setLeadProjects([]);
        setLeadProjectsError(friendlyErr(e, t('crm.leads.form.errors.projectsLoad')));
      })
      .finally(() => {
        if (alive) setLeadProjectsLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, t]);

  /** Продажи CRM по лиду. Показываем блок, только если у лида реально ЕСТЬ заказы — ошибка загрузки
   * (например 403 без доступа к «Продажам») блок не показывает. */
  useEffect(() => {
    if (isNew || !id) {
      setLeadSales([]);
      return;
    }
    let alive = true;
    fetchSales({ leadId: id, pageSize: 100 })
      .then((res) => {
        if (alive) setLeadSales(res.items);
      })
      .catch((e) => {
        console.error('lead sales load error', e);
        if (alive) setLeadSales([]);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew]);

  /** Брони модуля "Бронирования" по лиду — модуль может быть не включён у тенанта, это не ошибка карточки. */
  useEffect(() => {
    if (isNew || !id) {
      setLeadReservations([]);
      return;
    }
    let alive = true;
    fetchReservationsByLead(id)
      .then((items) => {
        if (alive) setLeadReservations(items);
      })
      .catch(() => {
        if (alive) setLeadReservations([]);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew]);

  // CCP client lookup when lead has ClientCabinet source
  useEffect(() => {
    if (isNew || !lead.email) {
      setCcpClient(null);
      return;
    }
    const src = (lead.source || lead.channel || '').toLowerCase();
    const meta = lead.meta as any;
    const ccpClientId: string | undefined = meta?.ccpClientId;
    if (src !== 'clientcabinet' && !ccpClientId) {
      setCcpClient(null);
      return;
    }
    let alive = true;
    setCcpClientLoading(true);
    const doFetch = async () => {
      try {
        // Prefer direct ID lookup, fallback to email search
        if (ccpClientId) {
          const c = await ccpApi.client(ccpClientId).catch(() => null);
          if (!alive) return;
          if (c) {
            setCcpClient(c);
            return;
          }
        }
        const res = await ccpApi.clients({ search: lead.email, per: 5 });
        if (!alive) return;
        const items: CcpClient[] = Array.isArray(res) ? res : ((res as any)?.items ?? []);
        const match = items.find((cl: any) => cl.email?.toLowerCase() === lead.email?.toLowerCase());
        setCcpClient(match ?? null);
      } catch {
        setCcpClient(null);
      } finally {
        if (alive) setCcpClientLoading(false);
      }
    };
    void doFetch();
    return () => {
      alive = false;
    };
  }, [isNew, lead.source, lead.channel, lead.email, lead.meta]);

  // История по всем проектам этого лида (как на странице проекта)
  useEffect(() => {
    if (isNew || !id || leadProjectsLoading) return;
    if (leadProjects.length === 0) {
      setProjectActivities([]);
      setProjectActivitiesError(null);
      setProjectActivitiesLoading(false);
      return;
    }
    let alive = true;
    setProjectActivitiesLoading(true);
    setProjectActivitiesError(null);
    Promise.all(leadProjects.map((p) => fetchProjectActivities(p.id)))
      .then((chunks) => {
        if (alive) setProjectActivities(chunks.flat());
      })
      .catch((e) => {
        console.error('lead project history load error', e);
        if (!alive) return;
        setProjectActivities([]);
        setProjectActivitiesError(friendlyErr(e, t('crm.leads.form.errors.projectHistoryLoad')));
      })
      .finally(() => {
        if (alive) setProjectActivitiesLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, leadProjects, leadProjectsLoading, t]);

  const dirty = !isNew && !loading && editableSnapshot(lead) !== baselineSnap;

  // предупреждение при закрытии вкладки с несохранёнными правками
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // --- обработчики ---

  const handleChange =
    (field: keyof Lead) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLead((prev) => ({ ...prev, [field]: value }));
    };

  const canEdit = isNew || lead.canEdit !== false;

  const setStatus = (value: LeadStatus) => {
    if (!canEdit) return;
    setLead((prev) => ({ ...prev, status: value }));
    if (value === STATUS_WON && !isNew && !lead.contactId) {
      handleOpenConvert(true);
    }
  };

  const handleOpenConvert = (markWon: boolean) => {
    setConvertError(null);
    setConvertPosition('');
    setConvertCity('');
    setConvertCompanyName('');
    setConvertMarkWon(markWon);
    setConvertModalOpen(true);
  };

  const handleConvertSave = async () => {
    if (!id || isNew) return;
    setConvertBusy(true);
    setConvertError(null);
    try {
      const result = await convertLead(id, {
        position: convertPosition.trim() || undefined,
        city: convertCity.trim() || undefined,
        companyName: convertCompanyName.trim() || undefined,
        markWon: convertMarkWon,
      });
      const patch = {
        contactId: result.lead.contactId,
        companyId: result.lead.companyId,
        status: result.lead.status,
      };
      setLead((prev) => ({ ...prev, ...patch }));
      // конвертация уже сохранена на сервере — не показываем её как несохранённую правку
      setBaseline({ ...baselineRef.current, ...patch });
      showSuccess(t('crm.leads.form.messages.leadConverted'));
      setConvertModalOpen(false);
    } catch (e: any) {
      console.error(e);
      setConvertError(friendlyErr(e, t('crm.leads.form.errors.convertLead')));
    } finally {
      setConvertBusy(false);
    }
  };

  const leadAssignableStaff = useMemo(
    () => staff.filter((u) => u.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName, locale)),
    [staff, locale],
  );

  const leadOwnerDepartmentGroups = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();
    const noDept = t('crm.projects.detail.owner.noDepartment');
    leadAssignableStaff.forEach((u) => {
      const key = (u.department || '').trim() || noDept;
      const list = groups.get(key) || [];
      list.push(u);
      groups.set(key, list);
    });
    return Array.from(groups.entries())
      .map(([department, users]) => ({
        department,
        users: users.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, locale)),
      }))
      .sort((a, b) => {
        if (a.department === noDept) return 1;
        if (b.department === noDept) return -1;
        return a.department.localeCompare(b.department, locale);
      });
  }, [leadAssignableStaff, t, locale]);

  const applyOwners = (prev: Lead, next: string[]): Lead => {
    const selected = staff.filter((u) => next.includes(u.id));
    const names = selected.map((u) => u.fullName);
    return {
      ...prev,
      assignedUserIds: next,
      assignedUserId: next[0] ?? null,
      assignedToList: names,
      assignedTo: names.length ? names.join(', ') : null,
    };
  };

  const toggleLeadOwnerUser = (userId: string, checked: boolean) => {
    setLead((prev) => {
      const current = prev.assignedUserIds ?? [];
      const nextRaw = checked ? (current.includes(userId) ? current : [...current, userId]) : current.filter((x) => x !== userId);
      return applyOwners(prev, Array.from(new Set(nextRaw)));
    });
  };

  const toggleLeadOwnerDepartment = (department: string, checked: boolean) => {
    const group = leadOwnerDepartmentGroups.find((g) => g.department === department);
    if (!group) return;
    const ids = group.users.map((u) => u.id);
    setLead((prev) => {
      const current = prev.assignedUserIds ?? [];
      const next = checked ? Array.from(new Set([...current, ...ids])) : current.filter((x) => !ids.includes(x));
      return applyOwners(prev, next);
    });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLead((prev) => ({ ...prev, amount: Number.isFinite(value) ? value : 0 }));
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setLead((prev) => ({ ...prev, currency: value }));
  };

  const addLeadTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setLead((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { id: crypto.randomUUID(), title, done: false, deadline: null }],
    }));
    setNewTaskTitle('');
  };

  const toggleLeadTask = (taskId: string) => {
    setLead((prev) => ({ ...prev, tasks: prev.tasks.map((x) => (x.id === taskId ? { ...x, done: !x.done } : x)) }));
  };

  const updateLeadTaskTitle = (taskId: string, title: string) => {
    setLead((prev) => ({ ...prev, tasks: prev.tasks.map((x) => (x.id === taskId ? { ...x, title } : x)) }));
  };

  const updateLeadTaskDeadline = (taskId: string, deadline: string) => {
    setLead((prev) => ({ ...prev, tasks: prev.tasks.map((x) => (x.id === taskId ? { ...x, deadline: deadline || null } : x)) }));
  };

  const removeLeadTask = (taskId: string) => {
    setLead((prev) => ({ ...prev, tasks: prev.tasks.filter((x) => x.id !== taskId) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isNew) {
        const saved = await createLead({
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          country: lead.country,
          status: lead.status, // русская строка — в api/leads будет замаплена на код
          source: lead.channel?.trim() || lead.source || 'manual',
          assignedTo: lead.assignedTo ?? undefined,
          assignedToList: lead.assignedToList ?? undefined,
          assignedUserId: lead.assignedUserId ?? undefined,
          assignedUserIds: lead.assignedUserIds ?? undefined,
          contactId: lead.contactId ?? undefined,
          companyId: lead.companyId ?? undefined,
          customFields: lead.customFields ?? {},
          meta: lead.meta ?? {},
          amount: lead.amount,
          currency: lead.currency,
          tasks: lead.tasks,
        });
        setLead(saved);
        setBaseline(saved);
        showSuccess(t('crm.leads.form.messages.leadCreated'));
        navigate(`/leads/${saved.id}`, { replace: true });
      } else {
        const saved = await updateLead(lead.id, {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          country: lead.country,
          status: lead.status,
          source: lead.channel?.trim() || lead.source || undefined,
          assignedTo: lead.assignedTo ?? undefined,
          assignedToList: lead.assignedToList ?? undefined,
          assignedUserId: lead.assignedUserId ?? undefined,
          assignedUserIds: lead.assignedUserIds ?? undefined,
          contactId: lead.contactId ?? undefined,
          companyId: lead.companyId ?? undefined,
          customFields: lead.customFields ?? {},
          meta: lead.meta ?? {},
          amount: lead.amount,
          currency: lead.currency,
          tasks: lead.tasks,
        });
        setLead(saved);
        setBaseline(saved);
        showSuccess(t('crm.leads.form.messages.leadSaved'));

        // после обновления — перезагружаем историю (статус / ответственный) и проекты
        fetchLeadHistory(lead.id)
          .then((items) => setHistory(items ?? []))
          .catch((e) => console.error('history reload error', e));
        fetchProjects({ leadId: lead.id })
          .then((res) => setLeadProjects(res.items))
          .catch((e) => console.error('projects reload error', e));
      }
    } catch (e: any) {
      console.error(e);
      setError(friendlyErr(e, t('crm.leads.form.errors.saveLead')));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setLead(baselineRef.current);
  };

  // Смена/создание компании раньше безусловно сбрасывала выбранный контакт — из-за этого связка
  // «контакт + компания» терялась при сохранении. Контакт сбрасываем, только если он уже состоит
  // в ДРУГОЙ компании; контакт без компании остаётся (бэкенд привяжет его к компании лида).
  const handleCompanyPicked = async (companyId: string | null, company?: Company | null) => {
    const cid = companyId ?? null;
    const currentContactId = lead.contactId;
    let keepContact = true;
    if (currentContactId && cid) {
      try {
        const c = await fetchContact(currentContactId);
        keepContact = !c.companyId || c.companyId === cid;
      } catch {
        keepContact = true;
      }
    }
    if (company && !companies.some((c) => c.id === company.id)) setCompanies((l) => [company, ...l]);
    setLead((prev) => ({
      ...prev,
      companyId: cid,
      contactId: keepContact ? prev.contactId : null,
    }));
  };

  const handleCreateContactFromLead = async () => {
    try {
      const fullName = (lead.name || '').trim();
      const [firstNamePart, ...lastNameParts] = fullName.split(/\s+/).filter(Boolean);
      const firstName = firstNamePart || t('crm.leadCard.contactFallback');
      const lastName = lastNameParts.join(' ') || undefined;

      const created = await createContact({
        firstName,
        lastName,
        email: lead.email?.trim() || undefined,
        phone: lead.phone?.trim() || undefined,
        country: lead.country?.trim() || undefined,
        companyId: lead.companyId || undefined,
        status: 'active',
      });

      const createdName =
        created.fullName || `${created.firstName || ''} ${created.lastName || ''}`.trim() || created.email || '';

      setLead((prev) => ({
        ...prev,
        contactId: created.id,
        name: prev.name || createdName,
        email: prev.email || created.email || '',
        phone: prev.phone || created.phone || '',
      }));
      showSuccess(t('crm.leads.form.messages.contactCreated'));
    } catch (e: any) {
      console.error(e);
      showError(friendlyErr(e, t('crm.leads.form.errors.createContact')));
    }
  };

  // Создание компании из лида
  const handleCreateCompany = () => {
    setCompanyError(null);
    setCompanyModalOpen(true);
    setCompanyName(lead.name || '');
    setCompanyEmail(lead.email || '');
    setCompanyPhone(lead.phone || '');
    setCompanyWebsite('');
    setCompanyCountry(lead.country || '');
    setCompanyCity('');
    setCompanyAddress('');
    setCompanyIndustry('');
    setCompanySize('');
  };

  const handleCompanySave = async () => {
    setCompanyError(null);
    if (!companyName.trim()) {
      setCompanyError(t('crm.companies.form.errors.nameRequired'));
      return;
    }

    setCompanyBusy(true);
    try {
      const newCompany = await createCompany({
        name: companyName.trim(),
        email: companyEmail.trim() || undefined,
        phone: companyPhone.trim() || undefined,
        website: companyWebsite.trim() || undefined,
        country: companyCountry.trim() || undefined,
        city: companyCity.trim() || undefined,
        address: companyAddress.trim() || undefined,
        industry: companyIndustry.trim() || undefined,
        size: companySize.trim() || undefined,
      });
      setCompanies((l) => [newCompany, ...l]);
      setLead((prev) => ({ ...prev, companyId: newCompany.id }));
      showSuccess(t('crm.leads.form.fields.companyCreated'));
      setCompanyModalOpen(false);
    } catch (e: any) {
      console.error(e);
      setCompanyError(friendlyErr(e, t('crm.companies.form.errors.createFailed')));
    } finally {
      setCompanyBusy(false);
    }
  };

  const handleCreateAccount = async () => {
    setAccountError(null);
    setAccountModalOpen(true);
    setAccountName(lead.name || '');
    setAccountEmail(lead.email || '');
    setAccountPassword('');
    setAccountBalanceEur('');
    setAccountBalanceUsd('');

    if (accountSites.length === 0) {
      try {
        const sites = await ccpApi.sites();
        setAccountSites(sites || []);
        if (sites?.length === 1) setAccountSiteId(sites[0].id);
      } catch (e: any) {
        console.error(e);
        setAccountError(t('crm.leads.form.account.errors.loadSites'));
      }
    }
  };

  const parseMoney = (value: string) => {
    const raw = value.trim().replace(/\s+/g, '').replace(',', '.');
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  };

  const handleAccountSave = async () => {
    setAccountError(null);
    if (!accountSiteId) {
      setAccountError(t('crm.leads.form.account.errors.siteRequired'));
      return;
    }
    if (!accountEmail.trim()) {
      setAccountError(t('crm.leads.form.account.errors.emailRequired'));
      return;
    }
    if (!accountPassword.trim()) {
      setAccountError(t('crm.leads.form.account.errors.passwordRequired'));
      return;
    }

    setAccountBusy(true);
    try {
      await ccpApi.createClient(accountSiteId, {
        email: accountEmail.trim(),
        name: accountName.trim() || null,
        password: accountPassword.trim(),
        balanceEur: accountBalanceEur ? parseMoney(accountBalanceEur) : undefined,
        balanceUsd: accountBalanceUsd ? parseMoney(accountBalanceUsd) : undefined,
      });
      showSuccess(t('crm.leads.form.account.messages.created'));
      setAccountModalOpen(false);
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || '');
      setAccountError(/account already exists/i.test(msg) ? t('crm.leads.form.account.errors.exists') : t('crm.leads.form.account.errors.createFailed'));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteLead = async () => {
    if (isNew || !lead?.id || lead.id === 'new') return;

    const ok = await showConfirm(t('crm.leads.form.alerts.deleteConfirm'), {
      title: t('crm.leadCard.confirmDelete.title'),
      confirmLabel: t('crm.leadCard.confirmDelete.ok'),
      cancelLabel: t('crm.common.cancel'),
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteLead(lead.id);
      showSuccess(t('crm.leads.form.messages.leadDeleted'));
      navigate('/leads');
    } catch (e: any) {
      console.error(e);
      const status = e?.statusCode ?? e?.response?.status ?? e?.data?.statusCode ?? e?.data?.status;
      if (status === 403) {
        showError(t('crm.leads.form.errors.deleteForbidden'));
        return;
      }
      showError(e?.message || t('crm.leads.form.errors.deleteLead'));
    }
  };

  // ── Комментарии: упоминания, лайки, ответы (как в карточке проекта) ──────
  const commentUser = useMemo(() => getStoredUser(), []);
  const currentStaffForComments = useMemo(
    () => staff.find((u) => u.id === commentUser?.id || u.email === commentUser?.email),
    [staff, commentUser],
  );
  const currentCommentLabels = useMemo(
    () =>
      [commentUser?.name, commentUser?.email, currentStaffForComments?.fullName]
        .filter(Boolean)
        .map((v) => (v as string).toString().trim().toLowerCase()),
    [commentUser, currentStaffForComments],
  );
  const extractMentions = useCallback((text: string) => {
    const matches = text.matchAll(/@([\p{L}\p{N}._-]+)/gu);
    const result: string[] = [];
    for (const match of matches) {
      if (match[1]) result.push(match[1]);
    }
    return result;
  }, []);
  const renderMentions = (text: string) =>
    splitTextWithMentions(text, staff).map((part, idx) =>
      part.mention ? (
        <span key={`m-${idx}`} className="mention">
          {part.text}
        </span>
      ) : (
        <span key={`t-${idx}`}>{part.text}</span>
      ),
    );
  const isMentioned = useCallback((text: string) => isTextMentioning(text, currentCommentLabels), [currentCommentLabels]);
  const meId = currentStaffForComments?.id || commentUser?.id || commentUser?.email || '';
  const authorName = currentStaffForComments?.fullName || commentUser?.name || commentUser?.email || t('crm.projects.detail.fallbacks.user');

  const addComment = () => {
    if (!newComment.trim()) return;
    const c: LeadComment = {
      id: `cm${Date.now()}`,
      author: authorName,
      createdAt: new Date().toLocaleString(locale),
      text: newComment.trim(),
      mentions: extractMentions(newComment.trim()),
    };
    setComments((prev) => [c, ...prev]);
    setNewComment('');
  };

  const addReply = (parentId: string) => {
    if (!replyText.trim()) return;
    const c: LeadComment = {
      id: `cm${Date.now()}`,
      author: authorName,
      createdAt: new Date().toLocaleString(locale),
      text: replyText.trim(),
      mentions: extractMentions(replyText.trim()),
      parentId,
    };
    setComments((prev) => [...prev, c]);
    setReplyText('');
    setReplyingToId(null);
  };

  const toggleCommentLike = (commentId: string) => {
    if (!meId) return;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const likedBy = c.likedBy || [];
        return { ...c, likedBy: likedBy.includes(meId) ? likedBy.filter((uid) => uid !== meId) : [...likedBy, meId] };
      }),
    );
  };

  // Автосохранение комментариев (новый/ответ/лайк) — независимо от общего сохранения лида
  useEffect(() => {
    if (isNew || loading) return;
    const snapshot = JSON.stringify(comments);
    if (snapshot === lastCommentsSnapshotRef.current) return;
    const timer = window.setTimeout(() => {
      lastCommentsSnapshotRef.current = snapshot;
      if (!leadRef.current.id || leadRef.current.id === 'new') return;
      updateLead(leadRef.current.id, { comments })
        .then((saved) => {
          const nextComments = Array.isArray(saved.comments) ? sanitizeComments(saved.comments) : comments;
          lastCommentsSnapshotRef.current = JSON.stringify(nextComments);
          setComments(nextComments);
        })
        .catch((e: any) => console.error(e));
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, isNew, loading]);

  // ── производные для шапки / полосы ─────────────────────────────
  const shortId = String(lead.id && lead.id !== 'new' ? lead.id : '').slice(0, 8).toUpperCase();
  const companyLabel = lead.companyId
    ? companies.find((c) => c.id === lead.companyId)?.name || (lead as any).companyName || null
    : null;
  const statusIdx = STATUS_OPTIONS.indexOf(lead.status);
  const fmtDuration = (ms: number) => {
    const min = Math.max(1, Math.round(ms / 60000));
    if (min < 60) return t('crm.leadCard.duration.m', { count: min });
    const h = Math.round(min / 60);
    if (h < 24) return t('crm.leadCard.duration.h', { count: h });
    return t('crm.leadCard.duration.d', { count: Math.round(h / 24) });
  };
  const statusSinceIso = useMemo(() => {
    const ch = history
      .filter((a) => a.type === 'status_changed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return ch?.createdAt || lead.createdAt;
  }, [history, lead.createdAt]);
  const statusSince = !isNew && statusSinceIso ? fmtDuration(Date.now() - new Date(statusSinceIso).getTime()) : '';
  const nextTask = lead.tasks.find((x) => !x.done);
  const doneCount = lead.tasks.filter((x) => x.done).length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const soonIso = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const fmtDate = (d: string) => {
    const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  };
  const ownerNames = lead.assignedToList?.length ? lead.assignedToList : lead.assignedTo ? [lead.assignedTo] : [];
  const amountFmt = (Number(lead.amount) || 0).toLocaleString(locale, { maximumFractionDigits: 2 });
  const notesValue = (lead.meta && ((lead.meta as any).comment ?? (lead.meta as any).message)) || '';
  const createdFmt = new Date(lead.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  const lastContactTime = lastActivity
    ? (() => {
        const d = new Date(lastActivity.date);
        const sameDay = d.toDateString() === new Date().toDateString();
        return sameDay
          ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
      })()
    : '';

  const commentCount = comments.length;
  const historyCount = mergedTimeline.length;

  const onMenu = (fn: () => void) => () => {
    setMoreOpen(false);
    fn();
  };

  // ── render ──────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageHelpButton topic="leadCard" />
      {successMessage && (
        <div className="ld-toast" role="status">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="ld-toast er" role="alert">
          {error}
        </div>
      )}

      <div className="ld">
        <button type="button" className="ld-back" onClick={() => navigate('/leads')}>
          ← {t('crm.leads.form.back')}
        </button>

        {/* ── head ─────────────────────────────────────────────── */}
        <div className="ld-head">
          <div className="ld-id">
            <div className="kick">
              {isNew ? (
                <span>{t('crm.leads.form.newLeadKicker')}</span>
              ) : (
                <>
                  <span>
                    {t('crm.leadCard.kicker.lead')} · {shortId}
                  </span>
                  <span>· {t('crm.leadCard.kicker.created', { date: createdFmt })}</span>
                  {lead.channel && <span>· {t('crm.leadCard.kicker.source', { source: lead.channel })}</span>}
                </>
              )}
            </div>
            <h1>{lead.name || t('crm.leads.form.nameFallback')}</h1>
            <div className="sub">
              {companyLabel && (
                <>
                  <Link to={`/companies/${lead.companyId}`}>{companyLabel}</Link>
                  <span className="sep" />
                </>
              )}
              {lead.country && (
                <>
                  <span>{lead.country}</span>
                  <span className="sep" />
                </>
              )}
              <span className="ld-tag" style={{ ['--dot' as string]: STATUS_DOT[lead.status] }}>
                <i />
                {statusLabels[lead.status] ?? lead.status}
              </span>
            </div>
          </div>
          <div className="ld-acts">
            {!isNew && (
              <>
                <button type="button" className="ld-btn gh" onClick={() => openComposer('email')}>
                  {t('crm.leads.form.actions.email')}
                </button>
                <button type="button" className="ld-btn gh" onClick={() => setCalendarModal('meeting')}>
                  {t('crm.leads.form.actions.meeting')}
                </button>
                <button type="button" className="ld-btn gh" onClick={() => setCalendarModal('note')}>
                  {t('crm.leads.form.actions.task')}
                </button>
                <button
                  type="button"
                  className="ld-btn gh"
                  onClick={() => navigate(`/automations/new?leadId=${encodeURIComponent(lead.id)}`)}
                >
                  {t('crm.leads.form.actions.automation')}
                </button>
                {!lead.contactId && (
                  <button type="button" className="ld-btn" onClick={() => handleOpenConvert(false)}>
                    <Ico d={CONV} size={14} />
                    {t('crm.leads.form.actions.convertToClient')}
                  </button>
                )}
              </>
            )}
            {isNew && (
              <button type="button" className="ld-btn" onClick={handleSave} disabled={saving}>
                {saving ? t('crm.leads.form.actions.saving') : t('crm.leads.form.actions.save')}
              </button>
            )}
            <button
              type="button"
              className="ld-ib"
              title={t('crm.leadCard.more')}
              aria-label={t('crm.leadCard.more')}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <Ico d={MORE} size={15} />
            </button>
            {moreOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setMoreOpen(false)} />
                <div className="ld-menu" role="menu">
                  {!isNew && (
                    <>
                      <button type="button" onClick={onMenu(handleCreateCompany)}>
                        {t('crm.leads.form.actions.addCompany')}
                      </button>
                      <button type="button" onClick={onMenu(() => void handleCreateAccount())}>
                        {t('crm.leads.form.actions.addAccount')}
                      </button>
                    </>
                  )}
                  <button type="button" onClick={onMenu(() => setCustomFieldsOpen(true))}>
                    {t('crm.leads.form.actions.configureFields')}
                  </button>
                  <button type="button" onClick={onMenu(() => navigate('/integrations-hub'))}>
                    {t('crm.leads.form.actions.integrations')}
                  </button>
                  {!isNew && lead.canDelete !== false && (
                    <>
                      <hr />
                      <button type="button" className="danger" onClick={onMenu(() => void handleDeleteLead())}>
                        {t('crm.leads.form.actions.delete')}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {loading && <div className="ld-empty">{t('crm.leads.form.loadingLead')}</div>}

        {!loading && (
          <>
            {/* ── status ─────────────────────────────────────────── */}
            <div className="ld-steps">
              <div className="flow">
                {FLOW_STATUSES.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!canEdit}
                    className={cx(lead.status === s && 'on', statusIdx > i && statusIdx < 3 && 'past')}
                    onClick={() => setStatus(s)}
                  >
                    <span className="n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="t">{statusLabels[s]}</span>
                    {lead.status === s && statusSince && <span className="since">{t('crm.leadCard.status.since', { v: statusSince })}</span>}
                  </button>
                ))}
              </div>
              <div className="close">
                <button type="button" disabled={!canEdit} className={cx('won', lead.status === STATUS_WON && 'on')} onClick={() => setStatus(STATUS_WON)}>
                  {t('crm.leadCard.status.won')}
                </button>
                <button type="button" disabled={!canEdit} className={cx('lost', lead.status === STATUS_LOST && 'on')} onClick={() => setStatus(STATUS_LOST)}>
                  {t('crm.leadCard.status.lost')}
                </button>
              </div>
            </div>

            {/* ── strip ──────────────────────────────────────────── */}
            <div className="ld-strip">
              <div>
                <span className="kick">{t('crm.leadCard.strip.amount')}</span>
                <b className="big">
                  {amountFmt} <small>{lead.currency}</small>
                </b>
              </div>
              <div>
                <span className="kick">{t('crm.leadCard.strip.owner')}</span>
                <b className="ell">{ownerNames[0] || t('crm.leadCard.strip.noOwner')}</b>
                {ownerNames.length > 1 && <span className="mut ell">{t('crm.leadCard.strip.moreOwners', { count: ownerNames.length - 1 })}</span>}
              </div>
              <div>
                <span className="kick">{t('crm.leadCard.strip.nextStep')}</span>
                <b className="ell">{nextTask ? nextTask.title : lead.tasks.length ? t('crm.leadCard.strip.allDone') : t('crm.leadCard.strip.noSteps')}</b>
                <span className="mut">
                  {nextTask?.deadline ? t('crm.leadCard.strip.until', { date: fmtDate(nextTask.deadline) }) : nextTask ? t('crm.leadCard.strip.noDeadline') : ' '}
                </span>
              </div>
              <div>
                <span className="kick">{t('crm.leadCard.strip.lastContact')}</span>
                {lastActivity ? (
                  <>
                    <b className="lc" style={{ ['--ch' as string]: CH_ACCENT[lastActivity.ch] }}>
                      <i />
                      {t(`crm.leadCard.comms.ch.${lastActivity.ch}`)} · {lastContactTime}
                    </b>
                    <span className="mut">{lastActivity.dir === 'in' ? t('crm.leadCard.strip.incoming') : t('crm.leadCard.strip.outgoing')}</span>
                  </>
                ) : (
                  <b className="mut">{t('crm.leadCard.strip.noContact')}</b>
                )}
              </div>
              <div>
                <span className="kick">AI Score</span>
                {aiScore?.ok && typeof aiScore.score === 'number' ? (
                  <>
                    <b className="big">
                      {aiScore.score}
                      <small> / 100</small>
                    </b>
                    <span className="mut">{t(`crm.leadCard.strip.priority.${aiScore.priority ?? 'medium'}`)}</span>
                  </>
                ) : (
                  <b className="mut">{t('crm.leadCard.strip.notScored')}</b>
                )}
              </div>
            </div>

            <div className="ld-grid">
              {/* ════ LEFT ════════════════════════════════════════ */}
              <aside className="ld-left">
                <Sec title={t('crm.leadCard.sec.contact')}>
                  <div className="ld-fs">
                    <label className="ld-f w">
                      <span className="l">{t('crm.leads.form.fields.namePlaceholder')}</span>
                      <input value={lead.name} onChange={handleChange('name')} placeholder={t('crm.leads.form.fields.namePlaceholder')} />
                    </label>
                    <label className="ld-f w">
                      <span className="l">{t('crm.leads.form.fields.phonePlaceholder')}</span>
                      <input className="mono" value={lead.phone} onChange={handleChange('phone')} placeholder="+90 …" />
                    </label>
                    <label className="ld-f w">
                      <span className="l">Email</span>
                      <input type="email" value={lead.email} onChange={handleChange('email')} placeholder="email@…" />
                    </label>
                    <label className="ld-f w">
                      <span className="l">{t('crm.leads.form.fields.countryPlaceholder')}</span>
                      <input value={lead.country} onChange={handleChange('country')} placeholder={t('crm.leads.form.fields.countryPlaceholder')} />
                    </label>
                  </div>
                  {!isNew && (
                    <div className="ld-chlinks">
                      {(['whatsapp', 'telegram', 'email'] as ChannelKey[]).map((k) =>
                        chContacts[k] ? (
                          <a
                            key={k}
                            href="#chat"
                            style={{ ['--ch' as string]: CH_ACCENT[k] }}
                            onClick={(e) => {
                              e.preventDefault();
                              openComposer(k);
                            }}
                          >
                            <Ico d={CH_ICON[k]} size={13} />
                            <em>{chContacts[k]}</em>
                          </a>
                        ) : (
                          <span key={k} className="nl" style={{ ['--ch' as string]: CH_ACCENT[k] }}>
                            <Ico d={CH_ICON[k]} size={13} />
                            <em>{t(`crm.leadCard.noChannel.${k}`)}</em>
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </Sec>

                <Sec title={t('crm.leadCard.sec.deal')}>
                  <div className="ld-fs">
                    <label className="ld-f">
                      <span className="l">{t('crm.leads.form.fields.amountLabel')}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mono"
                        value={lead.amount || ''}
                        onChange={handleAmountChange}
                        disabled={!canEditAmount}
                        title={canEditAmount ? undefined : t('crm.leads.form.fields.amountNoPermission') || undefined}
                        placeholder="0"
                      />
                    </label>
                    <label className="ld-f">
                      <span className="l">{t('crm.leads.form.fields.currencyLabel')}</span>
                      <select value={lead.currency} onChange={handleCurrencyChange}>
                        <option value="TRY">TRY · ₺</option>
                        <option value="EUR">EUR · €</option>
                        <option value="USD">USD · $</option>
                        <option value="RUB">RUB · ₽</option>
                      </select>
                    </label>
                    <label className="ld-f w">
                      <span className="l">{t('crm.leads.form.fields.channelPlaceholder')}</span>
                      <input value={lead.channel} onChange={handleChange('channel')} />
                      <span className="h">{t('crm.leads.form.sections.channelJourneyHint')}</span>
                    </label>
                    {!isNew && (
                      <label className="ld-f w">
                        <span className="l">{t('crm.leads.form.fields.createdLabel')}</span>
                        <input className="mono" readOnly value={new Date(lead.createdAt).toLocaleString(locale)} />
                      </label>
                    )}
                  </div>
                </Sec>

                <Sec title={t('crm.leadCard.sec.links')}>
                  <div className="ld-links">
                    <div className="lh">
                      <span className="kick">{t('crm.leads.form.fields.company')}</span>
                      <button type="button" className="lk" onClick={handleCreateCompany}>
                        + {t('crm.leads.form.fields.createCompany')}
                      </button>
                    </div>
                    <CompanySelect
                      value={lead.companyId ?? null}
                      onChange={handleCompanyPicked}
                      placeholder={t('crm.leads.form.fields.companyPlaceholder')}
                      className="w-full"
                      allowCreate={true}
                      onCompanyCreated={(company) => {
                        setCompanies((l) => [company, ...l]);
                        setLead((prev) => ({ ...prev, companyId: company.id }));
                      }}
                    />

                    <div className="lh">
                      <span className="kick">{t('crm.leads.form.fields.contact')}</span>
                      <div>
                        {lead.contactId && (
                          <button type="button" className="lk" onClick={() => navigate(`/contacts/${lead.contactId}`)}>
                            ↗ {t('crm.leads.form.fields.openContact')}
                          </button>
                        )}
                        <button type="button" className="lk" onClick={handleCreateContactFromLead}>
                          + {t('crm.leads.form.fields.createContact')}
                        </button>
                      </div>
                    </div>
                    <ContactSelect
                      value={lead.contactId ?? null}
                      companyId={lead.companyId ?? null}
                      onChange={(contactId, contact) => {
                        setLead((prev) => ({
                          ...prev,
                          contactId,
                          name:
                            prev.name?.trim().length > 0
                              ? prev.name
                              : contact?.fullName || `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || prev.name,
                          email: prev.email?.trim().length > 0 ? prev.email : contact?.email || prev.email,
                          phone: prev.phone?.trim().length > 0 ? prev.phone : contact?.phone || prev.phone,
                          companyId: prev.companyId || contact?.companyId || null,
                        }));
                      }}
                      placeholder={t('crm.leads.form.fields.selectContact')}
                      className="w-full"
                      allowCreate={true}
                    />

                    <div className="lh">
                      <span className="kick">{t('crm.leads.form.sections.projectsTitle')}</span>
                      {!isNew && (
                        <button type="button" className="lk" onClick={() => navigate('/projects')}>
                          {t('crm.leadCard.links.all')} ↗
                        </button>
                      )}
                    </div>
                    {isNew && <div className="ld-empty">{t('crm.leads.form.sections.projectsNeedSave')}</div>}
                    {!isNew && leadProjectsLoading && <div className="ld-empty">{t('crm.leads.form.sections.projectsLoading')}</div>}
                    {leadProjectsError && <div className="ld-err">{leadProjectsError}</div>}
                    {!isNew && !leadProjectsLoading && !leadProjectsError && leadProjects.length === 0 && (
                      <div className="ld-empty">{t('crm.leads.form.sections.projectsEmpty')}</div>
                    )}
                    {leadProjects.map((p) => (
                      <button key={p.id} type="button" className="ld-link" onClick={() => navigate(`/projects/${p.id}`)}>
                        <span className="mono mut">#{String(p.id).slice(0, 6)}</span>
                        <span className="nm">{p.name}</span>
                        <em>{p.status}</em>
                      </button>
                    ))}

                    {leadSales.length > 0 && (
                      <>
                        <div className="lh">
                          <span className="kick">{t('crm.leadCard.links.sales')}</span>
                          <button type="button" className="lk" onClick={() => navigate('/sales')}>
                            {t('crm.leadCard.links.all')} ↗
                          </button>
                        </div>
                        {leadSales.map((s) => {
                          const saleRec = s as unknown as Record<string, unknown>;
                          const productUrl = extractSaleProductUrl(saleRec);
                          const wpUrl = s.wooAdminEditUrl?.trim() || '';
                          return (
                            <div key={s.id} className="ld-link" role="link" tabIndex={0} onClick={() => navigate(`/sales/${s.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/sales/${s.id}`)}>
                              <span className="mono mut">{saleOrderDisplayNumber(saleRec)}</span>
                              <span className="nm" title={translateSaleStatus(t, i18n, s.status)}>
                                {s.hotel || translateSaleStatus(t, i18n, s.status)}
                              </span>
                              <em className="mono">
                                {typeof s.amount === 'number' ? s.amount.toLocaleString(locale, { maximumFractionDigits: 2 }) : '—'} {s.currency || ''}
                              </em>
                              {productUrl && (
                                <a href={productUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={t('crm.leads.form.sections.salesWooColProductLink')}>
                                  <Ico d={EXT} size={12} />
                                </a>
                              )}
                              {wpUrl && (
                                <a href={wpUrl} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 10 }} onClick={(e) => e.stopPropagation()}>
                                  WP
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}

                    {leadReservations.length > 0 && (
                      <>
                        <div className="lh">
                          <span className="kick">{t('crm.leadCard.links.bookings')}</span>
                          <button type="button" className="lk" onClick={() => navigate('/bookings/reservations')}>
                            {t('crm.leadCard.links.all')} ↗
                          </button>
                        </div>
                        {leadReservations.map((r) => (
                          <button key={r.id} type="button" className="ld-link" onClick={() => navigate(`/bookings/reservations/${r.id}`)}>
                            <span className="nm">
                              {new Date(r.startAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                              {r.customFields?.serviceName ? ` · ${r.customFields.serviceName}` : ''}
                            </span>
                            <em>{RESERVATION_STATUSES.includes(r.status) ? t(`crm.leadCard.resStatus.${r.status}`) : r.status}</em>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </Sec>

                {!isNew && (ccpClient || ccpClientLoading) && (
                  <Sec
                    title={t('crm.leadCard.sec.ccp')}
                    right={
                      ccpClient ? (
                        <Link to="/client-accounts" className="lk">
                          {t('crm.leadCard.ccp.goTo')} ↗
                        </Link>
                      ) : undefined
                    }
                  >
                    {ccpClientLoading && <div className="ld-empty">{t('crm.leadCard.loading')}</div>}
                    {ccpClient && !ccpClientLoading && (
                      <>
                        <b style={{ fontWeight: 500 }}>{(ccpClient as any).name || (ccpClient as any).email}</b>
                        <div className="ld-ccp">
                          {(['EUR', 'USD'] as const).map((cur) => (
                            <div key={cur}>
                              <span className="kick">{cur}</span>
                              <b>
                                {Number((ccpClient as any)[cur === 'EUR' ? 'balanceEur' : 'balanceUsd'] || 0).toLocaleString(locale, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </b>
                            </div>
                          ))}
                        </div>
                        <span className="mono mut" style={{ fontSize: 10 }}>
                          WP#{(ccpClient as any).wpUserId} · {(ccpClient as any).email}
                        </span>
                      </>
                    )}
                  </Sec>
                )}

                <Sec
                  title={t('crm.leads.form.fields.customFieldsLabel')}
                  right={
                    <button type="button" className="lk" onClick={() => setCustomFieldsOpen(true)}>
                      {t('crm.leads.form.fields.customFieldsConfigBtn')}
                    </button>
                  }
                >
                  {customFieldsError && <div className="ld-err">{customFieldsError}</div>}
                  {customFieldsLoading && <div className="ld-empty">{t('crm.leads.form.fields.customFieldsLoading')}</div>}
                  {!customFieldsLoading && activeCustomFields.length === 0 && <div className="ld-empty">{t('crm.leads.form.fields.customFieldsEmpty')}</div>}
                  {activeCustomFields.length > 0 && <div className="ld-fs">{activeCustomFields.map((field) => renderCustomFieldInput(field))}</div>}
                </Sec>

                {hasUtmCaptured && (
                  <Sec title={t('crm.leads.form.fields.utmTitle')} defaultOpen={false}>
                    <dl className="ld-kv mono">
                      {(
                        [
                          ['utm_source', lead.utmSource],
                          ['utm_medium', lead.utmMedium],
                          ['utm_campaign', lead.utmCampaign],
                          ['utm_content', lead.utmContent],
                          ['utm_term', lead.utmTerm],
                        ] as const
                      ).map(([key, val]) => (
                        <React.Fragment key={key}>
                          <dt>{key}</dt>
                          <dd className={cx(!String(val ?? '').trim() && 'mut')}>{String(val ?? '').trim() || '—'}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </Sec>
                )}

                <Sec title={t('crm.leads.form.fields.notesLabel')}>
                  <textarea
                    className="ld-notes"
                    rows={4}
                    value={notesValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLead((prev) => ({ ...prev, meta: { ...(prev.meta || {}), comment: val } }));
                    }}
                    placeholder={t('crm.leads.form.fields.notesPlaceholder')}
                  />
                </Sec>

                {!isNew && (
                  <Sec title={t('crm.leadCard.sec.external')} defaultOpen={false}>
                    <ExternalLinksPanel entityType="lead" entityId={lead.id} />
                    <JiraIssueLinkPanel entityType="lead" entityId={lead.id} defaultSummary={lead.name} />
                  </Sec>
                )}
              </aside>

              {/* ════ CENTER ══════════════════════════════════════ */}
              <main className="ld-center">
                <div className="ld-tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={tab === 'chat'} className={cx(tab === 'chat' && 'on')} onClick={() => setTab('chat')}>
                    {t('crm.leadCard.tabs.chat')}
                    {unread > 0 && <b className="u">{unread}</b>}
                  </button>
                  <button type="button" role="tab" aria-selected={tab === 'comments'} className={cx(tab === 'comments' && 'on')} onClick={() => setTab('comments')}>
                    {t('crm.leadCard.tabs.comments')}
                    <span className="c">{commentCount}</span>
                  </button>
                  <button type="button" role="tab" aria-selected={tab === 'history'} className={cx(tab === 'history' && 'on')} onClick={() => setTab('history')}>
                    {t('crm.leadCard.tabs.history')}
                    <span className="c">{historyCount}</span>
                  </button>
                </div>
                <div className="ld-center-b">
                  {isNew ? (
                    <div className="ld-center-empty">
                      <div className="ld-empty">{t('crm.leadCard.saveFirst')}</div>
                    </div>
                  ) : (
                    <>
                      {/* переписка не размонтируется при смене вкладки — держим опрос и позицию прокрутки */}
                      <div style={{ display: tab === 'chat' ? 'contents' : 'none' }}>
                        <LeadComms
                          ref={commsRef}
                          leadId={lead.id}
                          leadEmail={baselineRef.current.email || ''}
                          leadName={lead.name}
                          locale={locale}
                          onActivity={setLastActivity}
                          onUnread={setUnread}
                          onContacts={setChContacts}
                        />
                      </div>

                      {tab === 'comments' && (
                        <div className="ld-pane">
                          <div className="ld-cmts">
                            {comments.length === 0 && <div className="ld-empty">{t('crm.projects.detail.comments.empty')}</div>}
                            {comments
                              .filter((c) => !c.parentId)
                              .map((c) => {
                                const replies = comments.filter((r) => r.parentId === c.id);
                                const liked = !!meId && (c.likedBy || []).includes(meId);
                                return (
                                  <div key={c.id} className={cx('ld-cmt', isMentioned(c.text) && 'me')}>
                                    <span className="av">{initials(c.author)}</span>
                                    <div className="bd">
                                      <div className="hd">
                                        <CommentMetaLine createdAt={c.createdAt} author={c.author} locale={locale} />
                                      </div>
                                      <p>{renderMentions(c.text)}</p>
                                      <div className="ac">
                                        <button type="button" className={cx('lk', liked && 'on')} onClick={() => toggleCommentLike(c.id)}>
                                          {liked ? '♥' : '♡'} {(c.likedBy || []).length > 0 ? (c.likedBy || []).length : ''}
                                        </button>
                                        <button type="button" className="lk" onClick={() => setReplyingToId((prev) => (prev === c.id ? null : c.id))}>
                                          {t('crm.projects.detail.comments.reply')}
                                        </button>
                                      </div>
                                      {replies.length > 0 && (
                                        <div className="reps">
                                          {replies.map((r) => {
                                            const rLiked = !!meId && (r.likedBy || []).includes(meId);
                                            return (
                                              <div key={r.id} className={cx('ld-cmt', isMentioned(r.text) && 'me')}>
                                                <span className="av">{initials(r.author)}</span>
                                                <div className="bd">
                                                  <div className="hd">
                                                    <CommentMetaLine createdAt={r.createdAt} author={r.author} locale={locale} />
                                                  </div>
                                                  <p>{renderMentions(r.text)}</p>
                                                  <div className="ac">
                                                    <button type="button" className={cx('lk', rLiked && 'on')} onClick={() => toggleCommentLike(r.id)}>
                                                      {rLiked ? '♥' : '♡'} {(r.likedBy || []).length > 0 ? (r.likedBy || []).length : ''}
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {replyingToId === c.id && (
                                        <div className="ld-reply">
                                          <input
                                            autoFocus
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') addReply(c.id);
                                            }}
                                            placeholder={t('crm.projects.detail.comments.replyPlaceholder')}
                                          />
                                          <button type="button" className="ld-btn" onClick={() => addReply(c.id)} disabled={!replyText.trim()}>
                                            {t('crm.projects.detail.actions.add')}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                          <div className="ld-cmt-new">
                            {mentionQuery !== null &&
                              mentionQuery.length >= 2 &&
                              (() => {
                                const q = mentionQuery.toLowerCase();
                                const matches = staff.filter((u) => u.fullName?.toLowerCase().includes(q)).slice(0, 6);
                                if (!matches.length) return null;
                                return (
                                  <div className="ld-mentions">
                                    {matches.map((u) => (
                                      <button
                                        key={u.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          const el = commentInputRef.current;
                                          const caret = el?.selectionStart ?? newComment.length;
                                          const before = newComment.slice(0, caret);
                                          const after = newComment.slice(caret);
                                          const replaced = before.replace(/@([\p{L}\p{N}._-]*)$/u, `@${u.fullName} `);
                                          setNewComment(replaced + after);
                                          setMentionQuery(null);
                                          requestAnimationFrame(() => {
                                            el?.focus();
                                            el?.setSelectionRange(replaced.length, replaced.length);
                                          });
                                        }}
                                      >
                                        {u.fullName}
                                        <span>{u.email}</span>
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            <textarea
                              ref={commentInputRef}
                              rows={2}
                              value={newComment}
                              onChange={(e) => {
                                const value = e.target.value;
                                setNewComment(value);
                                const caret = e.target.selectionStart ?? value.length;
                                const match = value.slice(0, caret).match(/@([\p{L}\p{N}._-]*)$/u);
                                setMentionQuery(match ? match[1] : null);
                              }}
                              onBlur={() => window.setTimeout(() => setMentionQuery(null), 150)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  e.preventDefault();
                                  addComment();
                                }
                              }}
                              placeholder={t('crm.projects.detail.comments.newPlaceholder')}
                            />
                            <button type="button" className="ld-btn" onClick={addComment} disabled={!newComment.trim()}>
                              {t('crm.leadCard.comments.send')}
                            </button>
                          </div>
                        </div>
                      )}

                      {tab === 'history' && (
                        <div className="ld-pane">
                          {(historyLoading || (leadProjects.length > 0 && projectActivitiesLoading)) && (
                            <div className="ld-empty">{t('crm.leads.form.sections.historyLoading')}</div>
                          )}
                          {historyError && <div className="ld-err">{historyError}</div>}
                          {projectActivitiesError && <div className="ld-err">{projectActivitiesError}</div>}
                          {!historyLoading && mergedTimeline.length === 0 && <div className="ld-empty">{t('crm.leads.form.sections.historyEmpty')}</div>}
                          {mergedTimeline.length > 0 && (
                            <ol className="ld-hist">
                              {mergedTimeline.map((row) => {
                                if (row.kind === 'lead') {
                                  const a = row.activity;
                                  const k = a.type === 'status_changed' ? 'status' : a.type === 'comment' ? 'comment' : a.type;
                                  const fmtVal = (v?: string | null) => (v && statusLabels[v]) || v;
                                  return (
                                    <li key={`lead-${a.id}`} className={`k-${k}`}>
                                      <span className="dot" />
                                      <div>
                                        <div className="tx">
                                          <b>{getActivityLabel(a)}</b>{' '}
                                          {(a.fromValue || a.toValue) && (
                                            <span>
                                              {a.fromValue && <s>{fmtVal(a.fromValue)}</s>}
                                              {a.fromValue && a.toValue && ' → '}
                                              {a.toValue && fmtVal(a.toValue)}
                                            </span>
                                          )}
                                        </div>
                                        {a.comment && <div className="qt">{a.comment}</div>}
                                        <div className="mt">
                                          {new Date(a.createdAt).toLocaleString(locale)}
                                          {(a.userName || a.userEmail) && ` · ${a.userName || a.userEmail}`}
                                        </div>
                                      </div>
                                    </li>
                                  );
                                }
                                const activity = row.activity;
                                const label = projectActivityLabels[activity.action] ?? activity.action;
                                const actor = activity.actorName || activity.actorEmail || t('crm.projects.detail.fallbacks.user');
                                const pname = projectNameById.get(activity.projectId) ?? String(activity.projectId).slice(0, 8);
                                return (
                                  <li key={`proj-${activity.id}`} className="k-project">
                                    <span className="dot" />
                                    <div>
                                      <div className="tx">
                                        <b>{label}</b>{' '}
                                        <button type="button" onClick={() => navigate(`/projects/${activity.projectId}`)}>
                                          {t('crm.leads.form.timeline.projectScope', { name: pname })}
                                        </button>
                                        {activity.action === 'status_change' && activity.payload && (
                                          <span>
                                            {' '}
                                            {activity.payload.from} → {activity.payload.to}
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt">
                                        {new Date(activity.createdAt).toLocaleString(locale)} · {actor}
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </main>

              {/* ════ RIGHT ═══════════════════════════════════════ */}
              <aside className="ld-right">
                {!isNew && (
                  <div className="ld-ai-block">
                    <div className="ld-card-h" style={{ background: 'transparent', padding: '0 2px' }}>
                      <span className="kick">{t('crm.leads.form.sections.aiTitle')}</span>
                      <InlineHelpButton topic="leadAiTools" />
                    </div>
                    <AiLeadScoreCard leadId={lead.id} onScored={setAiScore} />
                    <AiNextActionCard leadId={lead.id} />
                    <AiOutreachEmailCard leadId={lead.id} leadEmail={lead.email || null} leadName={lead.name || null} onSend={handleSendOutreach} />
                    <AiEnrichPanel entityType="lead" entityId={lead.id} onApply={handleApplyEnrich} />
                  </div>
                )}

                <div className="ld-card">
                  <div className="ld-card-h">
                    <span className="kick">{t('crm.leadCard.tasks.title')}</span>
                    <span className="mono mut">
                      {doneCount} / {lead.tasks.length}
                    </span>
                  </div>
                  {lead.tasks.length > 0 && (
                    <div className="ld-prog">
                      <i style={{ width: `${(doneCount / lead.tasks.length) * 100}%` }} />
                    </div>
                  )}
                  {lead.tasks.length === 0 ? (
                    <div className="ld-empty">{t('crm.leads.form.fields.tasksEmpty')}</div>
                  ) : (
                    <ul className="ld-tasks">
                      {lead.tasks.map((task) => (
                        <li key={task.id} className={cx(task.done && 'dn')}>
                          <input type="checkbox" checked={task.done} onChange={() => toggleLeadTask(task.id)} aria-label={task.title} />
                          <input className="tt" value={task.title} onChange={(e) => updateLeadTaskTitle(task.id, e.target.value)} />
                          <input
                            type="date"
                            className={cx(
                              'dl',
                              !task.done && task.deadline && task.deadline < todayIso && 'over',
                              !task.done && task.deadline && task.deadline >= todayIso && task.deadline <= soonIso && 'soon',
                            )}
                            value={task.deadline ?? ''}
                            onChange={(e) => updateLeadTaskDeadline(task.id, e.target.value)}
                          />
                          <button type="button" className="rm" onClick={() => removeLeadTask(task.id)} aria-label={t('crm.leads.form.actions.removeTask')}>
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="ld-add">
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addLeadTask();
                        }
                      }}
                      placeholder={t('crm.leads.form.fields.tasksAddPlaceholder')}
                    />
                    <button type="button" onClick={addLeadTask} disabled={!newTaskTitle.trim()} aria-label={t('crm.leads.form.actions.addTask')}>
                      <Ico d={PLUS} size={13} />
                    </button>
                  </div>
                </div>

                <div className="ld-card">
                  <div className="ld-card-h">
                    <span className="kick">{t('crm.leads.form.sections.meetingsTitle')}</span>
                    {!isNew && (
                      <button type="button" className="lk" onClick={() => setCalendarModal('meeting')}>
                        + {t('crm.leadCard.meetings.add')}
                      </button>
                    )}
                  </div>
                  {isNew && <div className="ld-empty">{t('crm.leads.form.sections.projectsNeedSave')}</div>}
                  {!isNew && sortedLeadMeetings.length === 0 && <div className="ld-empty">{t('crm.leads.form.sections.meetingsEmpty')}</div>}
                  {!isNew && sortedLeadMeetings.length > 0 && (
                    <ul className="ld-meets">
                      {sortedLeadMeetings.map((meeting) => {
                        const start = new Date(meeting.startsAt);
                        const isPast = start.getTime() < Date.now();
                        const isCancelled = Boolean(meeting.closedAt);
                        const cls = isCancelled ? 'cancel' : isPast ? 'past' : 'up';
                        const badge = isCancelled
                          ? t('crm.leads.form.sections.meetingsCancelled')
                          : isPast
                            ? t('crm.leads.form.sections.meetingsPast')
                            : t('crm.leads.form.sections.meetingsUpcoming');
                        return (
                          <li key={meeting.id} className={cls}>
                            <span className="st">{badge}</span>
                            <b>{meeting.title || t('crm.leads.form.sections.meetingsFallbackTitle')}</b>
                            <span className="mut">
                              {start.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                              {meeting.notifySentAt &&
                                ` · ${t('crm.leads.form.sections.meetingsNotified', { date: new Date(meeting.notifySentAt).toLocaleDateString(locale) })}`}
                            </span>
                            {meeting.attendeeNames && meeting.attendeeNames.length > 0 && (
                              <span className="mut">
                                {t('crm.leads.calendar.labels.team')} {meeting.attendeeNames.join(', ')}
                              </span>
                            )}
                            {meeting.notes && <p>{meeting.notes}</p>}
                            {meeting.meetingUrl && (
                              <a href={meeting.meetingUrl} target="_blank" rel="noreferrer">
                                {t('crm.leads.calendar.actions.link')}
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="ld-card">
                  <div className="ld-card-h">
                    <span className="kick">{t('crm.leadCard.owners.title')}</span>
                    <span className="mono mut">{t('crm.projects.detail.owner.selected', { count: (lead.assignedUserIds ?? []).length })}</span>
                  </div>
                  <div className="ld-owner-list">
                    {leadOwnerDepartmentGroups.map((group) => {
                      const groupIds = group.users.map((u) => u.id);
                      const selectedInGroup = groupIds.filter((uid) => (lead.assignedUserIds ?? []).includes(uid)).length;
                      const allChecked = selectedInGroup > 0 && selectedInGroup === groupIds.length;
                      return (
                        <div key={group.department} className="ld-owners">
                          <div className="dep">
                            <span title={group.department}>{group.department}</span>
                            <label>
                              <input
                                type="checkbox"
                                checked={allChecked}
                                disabled={lead.canReassign === false}
                                onChange={(e) => toggleLeadOwnerDepartment(group.department, e.target.checked)}
                              />
                              {t('crm.projects.detail.owner.wholeDepartment')}
                            </label>
                          </div>
                          {group.users.map((u) => {
                            const checked = (lead.assignedUserIds ?? []).includes(u.id);
                            const isMain = checked && lead.assignedUserId === u.id;
                            return (
                              <label key={u.id} className={cx('p', !checked && 'off')} title={u.email || undefined}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={lead.canReassign === false}
                                  onChange={(e) => toggleLeadOwnerUser(u.id, e.target.checked)}
                                />
                                <span className="av">{initials(u.fullName)}</span>
                                <span className="n">{u.fullName}</span>
                                {isMain && <em>{t('crm.leadCard.owners.main')}</em>}
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  <AiAssigneeGroup entityType="lead" entityId={isNew ? null : lead.id} compact />
                  <AiRecordChat entityType="lead" entityId={isNew ? null : lead.id} />
                </div>
              </aside>
            </div>
          </>
        )}

        {dirty && (
          <div className="ld-savebar">
            <span>{t('crm.leadCard.savebar.dirty')}</span>
            <button type="button" className="ld-btn gh" onClick={handleDiscard} disabled={saving}>
              {t('crm.leadCard.savebar.discard')}
            </button>
            {canEdit && (
              <button type="button" className="ld-btn" onClick={handleSave} disabled={saving}>
                {saving ? t('crm.leads.form.actions.saving') : t('crm.leads.form.actions.save')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ ACCOUNT MODAL ════════════════════════════════════════ */}
      {accountModalOpen &&
        createPortal(
          <div className="ld-modal-bg">
            <div className="ld-modal" style={{ maxWidth: 540 }}>
              <header>
                <div>
                  <h3>{t('crm.leads.form.account.title')}</h3>
                  <p>{t('crm.leads.form.account.subtitle')}</p>
                </div>
                <button type="button" className="x" onClick={() => setAccountModalOpen(false)} aria-label={t('crm.common.cancel')}>
                  ×
                </button>
              </header>
              <div className="bd">
                <div>
                  <label className="fl">{t('crm.leads.form.account.fields.site')}</label>
                  <select value={accountSiteId} onChange={(e) => setAccountSiteId(e.target.value)}>
                    <option value="">{t('crm.leads.form.account.fields.sitePlaceholder')}</option>
                    {accountSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.siteHost || site.siteUrl || site.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="g2">
                  <div>
                    <label className="fl">{t('crm.leads.form.account.fields.name')}</label>
                    <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder={t('crm.leads.form.account.fields.namePlaceholder')} />
                  </div>
                  <div>
                    <label className="fl">{t('crm.leads.form.account.fields.email')}</label>
                    <input type="email" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder={t('crm.leads.form.account.fields.emailPlaceholder')} />
                  </div>
                </div>
                <div>
                  <label className="fl">{t('crm.leads.form.account.fields.password')}</label>
                  <input type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder={t('crm.leads.form.account.fields.passwordPlaceholder')} />
                </div>
                <div className="g2">
                  <div>
                    <label className="fl">{t('crm.leads.form.account.fields.balanceEur')}</label>
                    <input value={accountBalanceEur} onChange={(e) => setAccountBalanceEur(e.target.value)} placeholder={t('crm.leads.form.account.fields.balanceEurPlaceholder')} />
                  </div>
                  <div>
                    <label className="fl">{t('crm.leads.form.account.fields.balanceUsd')}</label>
                    <input value={accountBalanceUsd} onChange={(e) => setAccountBalanceUsd(e.target.value)} placeholder={t('crm.leads.form.account.fields.balanceUsdPlaceholder')} />
                  </div>
                </div>
                {accountError && <div className="er">{accountError}</div>}
                <div className="ft">
                  <button type="button" className="mb gh" onClick={() => setAccountModalOpen(false)} disabled={accountBusy}>
                    {t('crm.common.cancel')}
                  </button>
                  <button type="button" className="mb" onClick={handleAccountSave} disabled={accountBusy}>
                    {accountBusy ? t('crm.common.saving') : t('crm.leads.form.account.actions.create')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ══ COMPANY MODAL ════════════════════════════════════════ */}
      {companyModalOpen &&
        createPortal(
          <div className="ld-modal-bg">
            <div className="ld-modal" style={{ maxWidth: 600 }}>
              <header>
                <h3>{t('crm.companies.form.titleCreate')}</h3>
                <button type="button" className="x" onClick={() => setCompanyModalOpen(false)} aria-label={t('crm.common.cancel')}>
                  ×
                </button>
              </header>
              <div className="bd">
                {companyError && <div className="er">{companyError}</div>}
                <div>
                  <label className="fl">{t('crm.companies.form.fields.name')}</label>
                  <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t('crm.companies.form.fields.name')} />
                </div>
                <div className="g2">
                  <div>
                    <label className="fl">{t('crm.companies.form.fields.email')}</label>
                    <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="email@…" />
                  </div>
                  <div>
                    <label className="fl">{t('crm.companies.form.fields.phone')}</label>
                    <input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder={t('crm.companies.form.fields.phonePlaceholder')} />
                  </div>
                </div>
                <div>
                  <label className="fl">{t('crm.companies.form.fields.website')}</label>
                  <input type="url" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder={t('crm.companies.form.fields.websitePlaceholder')} />
                </div>
                <div className="g2">
                  <div>
                    <label className="fl">{t('crm.companies.form.fields.country')}</label>
                    <input type="text" value={companyCountry} onChange={(e) => setCompanyCountry(e.target.value)} placeholder={t('crm.companies.form.fields.countryPlaceholder')} />
                  </div>
                  <div>
                    <label className="fl">{t('crm.companies.form.fields.city')}</label>
                    <input type="text" value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} placeholder={t('crm.companies.form.fields.cityPlaceholder')} />
                  </div>
                </div>
                <div>
                  <label className="fl">{t('crm.companies.form.fields.address')}</label>
                  <input type="text" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder={t('crm.companies.form.fields.addressPlaceholder')} />
                </div>
                <div className="g2">
                  <div>
                    <label className="fl">{t('crm.companies.form.fields.industry')}</label>
                    <input type="text" value={companyIndustry} onChange={(e) => setCompanyIndustry(e.target.value)} placeholder={t('crm.companies.form.fields.industryPlaceholder')} />
                  </div>
                  <div>
                    <label className="fl">{t('crm.companies.form.fields.size')}</label>
                    <input type="text" value={companySize} onChange={(e) => setCompanySize(e.target.value)} placeholder={t('crm.companies.form.fields.sizePlaceholder')} />
                  </div>
                </div>
                <div className="ft">
                  <button type="button" className="mb gh" onClick={() => setCompanyModalOpen(false)}>
                    {t('crm.companies.form.cancel')}
                  </button>
                  <button type="button" className="mb" onClick={handleCompanySave} disabled={companyBusy || !companyName.trim()}>
                    {companyBusy ? t('crm.companies.form.saving') : t('crm.companies.form.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ══ CONVERT-TO-CLIENT MODAL ══════════════════════════════ */}
      {convertModalOpen &&
        createPortal(
          <div className="ld-modal-bg">
            <div className="ld-modal" style={{ maxWidth: 520 }}>
              <header>
                <div>
                  <h3>{t('crm.leads.form.convert.title')}</h3>
                  <p>{t('crm.leads.form.convert.subtitle')}</p>
                </div>
                <button type="button" className="x" onClick={() => setConvertModalOpen(false)} aria-label={t('crm.common.cancel')}>
                  ×
                </button>
              </header>
              <div className="bd">
                {convertError && <div className="er">{convertError}</div>}
                {lead.contactId ? (
                  <div className="note">{t('crm.leads.form.convert.contactExists')}</div>
                ) : (
                  <div className="g2">
                    <div>
                      <label className="fl">{t('crm.contacts.form.fields.position')}</label>
                      <input type="text" value={convertPosition} onChange={(e) => setConvertPosition(e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">{t('crm.contacts.form.fields.city')}</label>
                      <input type="text" value={convertCity} onChange={(e) => setConvertCity(e.target.value)} />
                    </div>
                  </div>
                )}
                {lead.companyId ? (
                  <div className="note">{t('crm.leads.form.convert.companyExists')}</div>
                ) : (
                  <div>
                    <label className="fl">{t('crm.leads.form.convert.companyName')}</label>
                    <input type="text" value={convertCompanyName} onChange={(e) => setConvertCompanyName(e.target.value)} />
                    <div className="note" style={{ marginTop: 4 }}>
                      {t('crm.leads.form.convert.companyNameHelper')}
                    </div>
                  </div>
                )}
                <label className="chk">
                  <input type="checkbox" checked={convertMarkWon} onChange={(e) => setConvertMarkWon(e.target.checked)} />
                  {t('crm.leads.form.convert.markWon')}
                </label>
                <div className="ft">
                  <button type="button" className="mb gh" onClick={() => setConvertModalOpen(false)}>
                    {t('crm.companies.form.cancel')}
                  </button>
                  <button type="button" className="mb" onClick={handleConvertSave} disabled={convertBusy}>
                    {convertBusy ? t('crm.leads.form.convert.saving') : t('crm.leads.form.convert.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {customFieldsOpen && (
        <CustomFieldsManager
          entityType="lead"
          title={t('crm.leads.form.customFieldsManagerTitle')}
          suggestedKeys={suggestedKeys}
          onClose={() => setCustomFieldsOpen(false)}
          onUpdated={(items) => setCustomFields([...items].sort((a, b) => a.order - b.order))}
        />
      )}

      {calendarModal && (
        <CalendarEntryModal
          initialKind={calendarModal}
          preselectedLeadId={isNew ? undefined : id}
          preselectedLeadName={lead.name || undefined}
          onClose={() => setCalendarModal(null)}
          onSaved={(info) => {
            if (calendarModal === 'meeting' && !info.emailSent) {
              showError(t('crm.leads.form.messages.meetingCreatedEmailFailed'));
            } else {
              showSuccess(calendarModal === 'meeting' ? t('crm.leads.form.messages.meetingCreated') : t('crm.leads.form.messages.noteCreated'));
            }
            // встреча пишется в meta лида на сервере — подтягиваем свежий meta, не трогая правки формы
            if (!isNew && id) {
              fetchLeadById(id)
                .then((fresh) => {
                  // meta с сервера (встречи), но заметку оставляем как в форме / в снимке — иначе правка заметки потеряется
                  setLead((prev) => ({ ...prev, meta: { ...(fresh.meta || {}), comment: (prev.meta as any)?.comment } }));
                  const b = baselineRef.current;
                  setBaseline({ ...b, meta: { ...(fresh.meta || {}), comment: (b.meta as any)?.comment } });
                })
                .catch(() => undefined);
            }
          }}
        />
      )}
    </MainLayout>
  );
};
