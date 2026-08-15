// src/pages/leads/LeadFormPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AiLeadScoreCard } from '../../components/ai/AiLeadScoreCard';
import { AiEnrichPanel } from '../../components/ai/AiEnrichPanel';
import { AiNextActionCard } from '../../components/ai/AiNextActionCard';
import { AiOutreachEmailCard } from '../../components/ai/AiOutreachEmailCard';
import { CalendarEntryModal } from '../../components/CalendarEntryModal';
import { fetchEmailAccounts, sendEmail, type EmailAccount } from '../../api/email';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import { deleteLead } from '../../api/leads';
import {
  fetchLeadById,
  createLead,
  updateLead,
  fetchLeadHistory,
  addLeadComment,
} from '../../api/leads';
import type { Lead, LeadStatus, LeadActivity } from '../../api/leads';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { ccpApi, type CcpClient, type CcpSite } from '../../api/ccp';
import { fetchCompanies, createCompany, type Company } from '../../api/companies';
import { createContact } from '../../api/contacts';
import { CompanySelect } from '../../components/CompanySelect';
import { ContactSelect } from '../../components/ContactSelect';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import {
  fetchProjects,
  fetchProjectActivities,
  type ProjectActivity,
} from '../../api/projects';
import type { Project } from '../projects/projectTypes';
import { fetchSales, type Sale } from '../../api/sales';
import { fetchReservationsByLead, RESERVATION_STATUS_LABELS_RU, type Reservation } from '../../api/bookings';
import { translateSaleStatus } from '../sales/saleStatusI18n';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { saleOrderDisplayNumber } from '../../utils/saleOrderDisplay';
import { extractSaleProductUrl } from '../../utils/saleLinks';

type TabId = 'main' | 'journey' | 'history';

function resolveLocale(lang: string) {
  if (lang === 'tr') return 'tr-TR';
  if (lang === 'en') return 'en-US';
  return 'ru-RU';
}

// статусы — ровно те же строки, что в api/leads.ts (LeadStatus)
const STATUS_OPTIONS: LeadStatus[] = [
  'Новый клиент',
  'В работе',
  'Ожидает ответа',
  'Закрыт (успех)',
  'Закрыт (проигран)',
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
    createdAt: now,
    updatedAt: now,
  } as Lead;
}

export const LeadFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const { t, i18n } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const locale = resolveLocale(i18n.language);
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('main');
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
  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.keys(lead.customFields ?? {}).forEach((key) => keys.add(key));
    return Array.from(keys);
  }, [lead.customFields]);

  // история лида
  const [history, setHistory] = useState<LeadActivity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  const [leadProjects, setLeadProjects] = useState<Project[]>([]);
  const [leadProjectsLoading, setLeadProjectsLoading] = useState(false);
  const [leadProjectsError, setLeadProjectsError] = useState<string | null>(null);
  const [leadSales, setLeadSales] = useState<Sale[]>([]);
  const [leadSalesLoading, setLeadSalesLoading] = useState(false);
  const [leadSalesError, setLeadSalesError] = useState<string | null>(null);
  const [leadReservations, setLeadReservations] = useState<Reservation[]>([]);
  const [leadReservationsLoading, setLeadReservationsLoading] = useState(false);
  const [leadReservationsError, setLeadReservationsError] = useState<string | null>(null);
  const [projectActivities, setProjectActivities] = useState<ProjectActivity[]>([]);
  const [projectActivitiesLoading, setProjectActivitiesLoading] = useState(false);
  const [projectActivitiesError, setProjectActivitiesError] = useState<string | null>(null);

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
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const handleApplyEnrich = useCallback((field: string, value: string) => {
    setLead(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSendOutreach = useCallback((subject: string, body: string, to: string) => {
    setEmailTo(to);
    setEmailSubject(subject);
    setEmailBody(body);
    setEmailOpen(true);
  }, []);

  // аккуратный helper для показа тостов
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

  const statusLabels = useMemo(
    () => ({
      'Новый клиент': t('crm.leads.statusValues.new'),
      'В работе': t('crm.leads.statusValues.inProgress'),
      'Ожидает ответа': t('crm.leads.statusValues.waiting'),
      'Закрыт (успех)': t('crm.leads.statusValues.won'),
      'Закрыт (проигран)': t('crm.leads.statusValues.lost'),
    }),
    [t],
  );

  /** Лид из Woo / из заказа: по source, каналу или meta. */
  const isWooRelatedLead = useMemo(() => {
    const meta = lead.meta as Record<string, unknown> | undefined;
    if (meta?.fromSaleId) return true;
    if (meta?.saleExternalOrderNo || meta?.saleExternalId) return true;
    const norm = (s: string) => s.trim().toLowerCase();
    const src = norm(String(lead.source ?? ''));
    const ch = norm(String(lead.channel ?? ''));
    if (src === 'woocommerce' || ch === 'woocommerce') return true;
    if (ch.includes('woocommerce') || src.includes('woocommerce')) return true;
    return false;
  }, [lead.source, lead.channel, lead.meta]);

  const showLeadSalesSection =
    !isNew &&
    (isWooRelatedLead ||
      leadSales.length > 0 ||
      leadSalesLoading ||
      Boolean(leadSalesError));

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
  const projectActivityFieldLabels = useMemo<Record<string, string>>(
    () => ({
      name: t('crm.projects.detail.fields.name'),
      description: t('crm.projects.detail.fields.description'),
      amount: t('crm.projects.detail.fields.amount'),
      currency: t('crm.projects.detail.fields.currency'),
      status: t('crm.projects.detail.fields.status'),
      category: t('crm.projects.detail.fields.category'),
      ownerName: t('crm.projects.detail.fields.owner'),
      ownerUserId: t('crm.projects.detail.fields.owner'),
      leadId: t('crm.projects.detail.fields.leadName'),
      companyId: t('crm.projects.detail.fields.company'),
      contactId: t('crm.projects.detail.fields.contact'),
      briefFileName: t('crm.projects.detail.files.title'),
      briefFileUrl: t('crm.projects.detail.files.urlPlaceholder'),
      tags: t('crm.projects.detail.fields.tags'),
      tasks: t('crm.projects.detail.history.fields.tasks'),
      'customFields.projectNotes': t('crm.projects.detail.notes.title'),
    }),
    [t],
  );
  const formatProjectHistoryValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return t('crm.projects.common.emptyValue');
    }
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

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
      ...projectActivities.map((activity) => ({
        kind: 'project' as const,
        activity,
      })),
    ];
    rows.sort((a, b) => {
      const ta = new Date(
        a.kind === 'lead' ? a.activity.createdAt : a.activity.createdAt,
      ).getTime();
      const tb = new Date(
        b.kind === 'lead' ? b.activity.createdAt : b.activity.createdAt,
      ).getTime();
      return tb - ta;
    });
    return rows;
  }, [history, projectActivities]);

  const hasUtmCaptured = useMemo(() => {
    return [
      lead.utmSource,
      lead.utmMedium,
      lead.utmCampaign,
      lead.utmContent,
      lead.utmTerm,
    ].some((v) => String(v ?? '').trim().length > 0);
  }, [lead]);

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );

  const renderCustomFieldInput = (field: CustomField) => {
    const value = getCustomFieldValue(field);
    const commonClass =
      'px-3 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm outline-none focus:border-neutral-400 w-full text-neutral-900 placeholder:text-neutral-400';
    const label = (
      <div style={{ fontFamily: 'inherit', fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#888", marginBottom: 6 }}>
        {field.label}
        {field.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
      </div>
    );

    if (field.type === 'boolean') {
      return (
        <label
          key={field.id}
          className="flex items-center gap-2 text-xs text-slate-300"
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setCustomFieldValue(field, e.target.checked)}
          />
          {field.label}
        </label>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.id}>
          {label}
          <textarea
            value={value ?? ''}
            onChange={(e) => setCustomFieldValue(field, e.target.value)}
            placeholder={field.placeholder || ''}
            className={commonClass}
            rows={3}
          />
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.id}>
          {label}
          <select
            value={value ?? ''}
            onChange={(e) => setCustomFieldValue(field, e.target.value)}
            className={commonClass}
          >
            <option value="">
              {field.placeholder || t('crm.leads.form.fields.selectContact')}
            </option>
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'multiselect') {
      const arrayValue = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'string' && value
          ? value.split(',').map((v) => v.trim())
          : [];
      return (
        <div key={field.id}>
          {label}
          <select
            multiple
            value={arrayValue}
            onChange={(e) =>
              setCustomFieldValue(
                field,
                Array.from(e.target.selectedOptions).map((o) => o.value),
              )
            }
            className={commonClass}
          >
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
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
      <div key={field.id}>
        {label}
        <input
          type={inputType}
          value={value ?? ''}
          onChange={(e) => {
            const next =
              field.type === 'number'
                ? e.target.value === ''
                  ? null
                  : Number(e.target.value)
                : e.target.value;
            setCustomFieldValue(field, next);
          }}
          placeholder={field.placeholder || ''}
          className={commonClass}
        />
      </div>
    );
  };

  const getCustomFieldValue = (field: CustomField) =>
    (lead.customFields ?? {})[field.key];

  const setCustomFieldValue = (field: CustomField, value: any) => {
    setLead((prev) => ({
      ...prev,
      customFields: {
        ...(prev.customFields ?? {}),
        [field.key]: value,
      },
    }));
  };

  // загрузка компаний
  useEffect(() => {
    let alive = true;
    setLoadingCompanies(true);
    fetchCompanies({ limit: 100 })
      .then((data) => {
        if (!alive) return;
        setCompanies(data.items);
      })
      .catch((e) => {
        console.error('Ошибка загрузки компаний:', e);
      })
      .finally(() => {
        if (!alive) return;
        setLoadingCompanies(false);
      });
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
        const sorted = [...items].sort((a, b) => a.order - b.order);
        setCustomFields(sorted);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setCustomFieldsError(e.message || t('crm.leads.form.fields.customFieldsLoading'));
      })
      .finally(() => {
        if (!alive) return;
        setCustomFieldsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!customFields.length) return;
    setLead((prev) => {
      const existing = prev.customFields ?? {};
      let changed = false;
      const next: Record<string, any> = { ...existing };
      customFields.forEach((field) => {
        if (next[field.key] !== undefined) return;
        if (field.defaultValue === null || field.defaultValue === undefined)
          return;
        if (field.type === 'boolean') {
          next[field.key] = field.defaultValue === 'true';
        } else if (field.type === 'number') {
          next[field.key] = Number(field.defaultValue);
        } else if (field.type === 'multiselect') {
          next[field.key] = String(field.defaultValue)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        } else {
          next[field.key] = field.defaultValue;
        }
        changed = true;
      });
      if (!changed) return prev;
      return { ...prev, customFields: next };
    });
  }, [customFields]);

  // загрузка лида + сотрудников + истории
  useEffect(() => {
    let alive = true;
    setError(null);

    if (isNew) {
      setLead(createEmptyLead());
      setLoading(false);
      setHistory([]);
      setHistoryError(null);
    } else {
      setLoading(true);

      fetchLeadById(id as string)
        .then((data) => {
          if (!alive) return;
          setLead(data);
        })
        .catch((e) => {
          console.error(e);
          if (!alive) return;
          setError(e.message || t('crm.leads.form.errors.loadLead'));
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
        });

      // история
      setHistoryLoading(true);
      setHistoryError(null);
      fetchLeadHistory(id as string)
        .then((items) => {
          if (!alive) return;
          setHistory(items ?? []);
        })
        .catch((e) => {
          console.error('Ошибка загрузки истории лида', e);
          if (!alive) return;
          setHistory([]);
          setHistoryError(e.message || t('crm.leads.form.errors.historyLoad'));
        })
        .finally(() => {
          if (!alive) return;
          setHistoryLoading(false);
        });
    }

    // Сотрудники
    fetchStaff()
      .then((users) => {
        if (!alive) return;
        setStaff(users);
      })
      .catch((e) => {
        console.error('Ошибка загрузки сотрудников для лида', e);
      });

    return () => {
      alive = false;
    };
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
        if (!alive) return;
        setLeadProjects(res.items);
      })
      .catch((e) => {
        console.error('Ошибка загрузки проектов лида', e);
        if (!alive) return;
        setLeadProjects([]);
        setLeadProjectsError(
          e.message || t('crm.leads.form.errors.projectsLoad'),
        );
      })
      .finally(() => {
        if (!alive) return;
        setLeadProjectsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, t]);

  /** Продажи CRM по лиду — всегда при !isNew (для таблицы и ссылок). */
  useEffect(() => {
    if (isNew || !id) {
      setLeadSales([]);
      setLeadSalesError(null);
      setLeadSalesLoading(false);
      return;
    }
    let alive = true;
    setLeadSalesLoading(true);
    setLeadSalesError(null);
    fetchSales({ leadId: id, pageSize: 100 })
      .then((res) => {
        if (!alive) return;
        setLeadSales(res.items);
      })
      .catch((e) => {
        console.error('Ошибка загрузки продаж лида', e);
        if (!alive) return;
        setLeadSales([]);
        setLeadSalesError(
          (e as Error).message || t('crm.leads.form.errors.salesLoad'),
        );
      })
      .finally(() => {
        if (!alive) return;
        setLeadSalesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, t]);

  /** Брони модуля "Бронирования" по лиду — виден, только если хоть одна бронь есть. */
  useEffect(() => {
    if (isNew || !id) {
      setLeadReservations([]);
      setLeadReservationsError(null);
      setLeadReservationsLoading(false);
      return;
    }
    let alive = true;
    setLeadReservationsLoading(true);
    setLeadReservationsError(null);
    fetchReservationsByLead(id)
      .then((items) => {
        if (!alive) return;
        setLeadReservations(items);
      })
      .catch((e) => {
        // Модуль "Бронирования" может быть не включён у тенанта — не считаем это ошибкой карточки.
        if (!alive) return;
        setLeadReservations([]);
        setLeadReservationsError(null);
      })
      .finally(() => {
        if (!alive) return;
        setLeadReservationsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew]);

  // CCP client lookup when lead has ClientCabinet source
  useEffect(() => {
    if (isNew || !lead.email) { setCcpClient(null); return; }
    const src = (lead.source || lead.channel || '').toLowerCase();
    const meta = lead.meta as any;
    const ccpClientId: string | undefined = meta?.ccpClientId;
    if (src !== 'clientcabinet' && !ccpClientId) { setCcpClient(null); return; }
    let alive = true;
    setCcpClientLoading(true);
    const doFetch = async () => {
      try {
        // Prefer direct ID lookup, fallback to email search
        if (ccpClientId) {
          const c = await ccpApi.client(ccpClientId).catch(() => null);
          if (!alive) return;
          if (c) { setCcpClient(c); return; }
        }
        const res = await ccpApi.clients({ search: lead.email, per: 5 });
        if (!alive) return;
        const items: CcpClient[] = Array.isArray(res) ? res : ((res as any)?.items ?? []);
        const match = items.find(
          (cl: any) => cl.email?.toLowerCase() === lead.email?.toLowerCase()
        );
        setCcpClient(match ?? null);
      } catch { setCcpClient(null); }
      finally { if (alive) setCcpClientLoading(false); }
    };
    void doFetch();
    return () => { alive = false; };
  }, [isNew, lead.source, lead.channel, lead.email, lead.meta]);

  // История по всем проектам этого лида (как на странице проекта)
  useEffect(() => {
    if (isNew || !id || leadProjectsLoading) {
      return;
    }
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
        if (!alive) return;
        setProjectActivities(chunks.flat());
      })
      .catch((e) => {
        console.error('Ошибка загрузки истории проектов лида', e);
        if (!alive) return;
        setProjectActivities([]);
        setProjectActivitiesError(
          e.message || t('crm.leads.form.errors.projectHistoryLoad'),
        );
      })
      .finally(() => {
        if (!alive) return;
        setProjectActivitiesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isNew, leadProjects, leadProjectsLoading, t]);

  const title = useMemo(() => {
    if (isNew) return t('crm.leads.form.titleNew');
    const shortId =
      lead && lead.id ? String(lead.id).slice(0, 8) : '';
    return shortId
      ? t('crm.leads.form.titleId', { id: shortId })
      : t('crm.leads.form.titleDefault');
  }, [isNew, lead, t]);

  // --- обработчики ---

  const handleChange =
    (field: keyof Lead) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLead((prev) => ({ ...prev, [field]: value }));
    };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as LeadStatus;
    setLead((prev) => ({ ...prev, status: value }));
  };

  const leadAssignableStaff = useMemo(
    () =>
      staff
        .filter((u) => u.isActive)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, locale)),
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

  const toggleLeadOwnerUser = (userId: string, checked: boolean) => {
    setLead((prev) => {
      const current = prev.assignedUserIds ?? [];
      const nextRaw = checked
        ? current.includes(userId)
          ? current
          : [...current, userId]
        : current.filter((id) => id !== userId);
      const next = Array.from(new Set(nextRaw));
      const selected = staff.filter((u) => next.includes(u.id));
      const names = selected.map((u) => u.fullName);
      return {
        ...prev,
        assignedUserIds: next,
        assignedUserId: next[0] ?? null,
        assignedToList: names,
        assignedTo: names.length ? names.join(', ') : null,
      };
    });
  };

  const toggleLeadOwnerDepartment = (department: string, checked: boolean) => {
    const group = leadOwnerDepartmentGroups.find((g) => g.department === department);
    if (!group) return;
    const ids = group.users.map((u) => u.id);
    setLead((prev) => {
      const current = prev.assignedUserIds ?? [];
      const next = checked
        ? Array.from(new Set([...current, ...ids]))
        : current.filter((id) => !ids.includes(id));
      const selected = staff.filter((u) => next.includes(u.id));
      const names = selected.map((u) => u.fullName);
      return {
        ...prev,
        assignedUserIds: next,
        assignedUserId: next[0] ?? null,
        assignedToList: names,
        assignedTo: names.length ? names.join(', ') : null,
      };
    });
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
        });
        setLead(saved);
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
        });
        setLead(saved);
        showSuccess(t('crm.leads.form.messages.leadSaved'));

        // после обновления — можно перезагрузить историю,
        // если мы меняли статус / ответственного
        if (!isNew) {
          fetchLeadHistory(lead.id)
            .then((items) => setHistory(items ?? []))
            .catch((e) =>
              console.error('Ошибка обновления истории после сохранения', e),
            );
          fetchProjects({ leadId: lead.id })
            .then((res) => setLeadProjects(res.items))
            .catch((e) =>
              console.error('Ошибка обновления списка проектов лида', e),
            );
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.leads.form.errors.saveLead'));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/leads');
  };

  const handleCreateContactFromLead = async () => {
    try {
      const fullName = (lead.name || '').trim();
      const [firstNamePart, ...lastNameParts] = fullName.split(/\s+/).filter(Boolean);
      const firstName = firstNamePart || 'Контакт';
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
        created.fullName ||
        `${created.firstName || ''} ${created.lastName || ''}`.trim() ||
        created.email ||
        '';

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
      setError(e.message || t('crm.leads.form.errors.createContact'));
    }
  };

  // Создание компании из лида
  const handleCreateCompany = async () => {
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
      
      // Обновляем список компаний
      setCompanies([...companies, newCompany]);
      
      // Привязываем компанию к лиду
      setLead((prev) => ({ ...prev, companyId: newCompany.id, companyName: newCompany.name }));
      
      showSuccess(t('crm.leads.form.fields.companyCreated'));
      setCompanyModalOpen(false);
      
      // Очищаем форму
      setCompanyName('');
      setCompanyEmail('');
      setCompanyPhone('');
      setCompanyWebsite('');
      setCompanyCountry('');
      setCompanyCity('');
      setCompanyAddress('');
      setCompanyIndustry('');
      setCompanySize('');
    } catch (e: any) {
      console.error(e);
      setCompanyError(e.message || t('crm.companies.form.errors.createFailed'));
    } finally {
      setCompanyBusy(false);
    }
  };

  // (пока) заглушка для "Создать аккаунт"
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
        if (sites?.length === 1) {
          setAccountSiteId(sites[0].id);
        }
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
      if (/account already exists/i.test(msg)) {
        setAccountError(t('crm.leads.form.account.errors.exists'));
      } else {
        setAccountError(t('crm.leads.form.account.errors.createFailed'));
      }
    } finally {
      setAccountBusy(false);
    }
  };

  // Удаление
  const handleDeleteLead = async () => {
  if (isNew || !lead?.id || lead.id === 'new') return;

  const ok = await showConfirm(t('crm.leads.form.alerts.deleteConfirm'), {
    title: 'Удаление',
    confirmLabel: 'Удалить',
    cancelLabel: 'Отмена',
    danger: true,
  });
  if (!ok) return;

  try {
    await deleteLead(lead.id);
    showSuccess(t('crm.leads.form.messages.leadDeleted'));
    navigate('/leads');
  } catch (e: any) {
    console.error(e);

    const status =
      e?.statusCode ??
      e?.response?.status ??
      e?.data?.statusCode ??
      e?.data?.status;

    if (status === 403) {
      showError(t('crm.leads.form.errors.deleteForbidden'));
      return;
    }

    showError(e?.message || t('crm.leads.form.errors.deleteLead'));
  }
  };

  const handleSendComment = async () => {
    if (!id || isNew) {
      showAlert(t('crm.leads.form.alerts.commentRequiresSave'), {
        variant: 'info',
      });
      return;
    }
    const text = newComment.trim();
    if (!text) return;

    try {
      await addLeadComment(id, text);
      setNewComment('');
      const items = await fetchLeadHistory(id);
      setHistory(items ?? []);
      showSuccess(t('crm.leads.form.messages.commentAdded'));
    } catch (e: any) {
      console.error(e);
      setHistoryError(e.message || t('crm.leads.form.errors.commentFailed'));
    }
  };

  // ── calendar entry modal ────────────────────────────────────────
  const [calendarModal, setCalendarModal] = useState<'meeting' | 'note' | null>(null);

  // ── email compose state ─────────────────────────────────────────
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailAccountId, setEmailAccountId] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!emailOpen || emailAccounts.length > 0) return;
    fetchEmailAccounts()
      .then(accs => { setEmailAccounts(accs); if (accs.length) setEmailAccountId(accs[0].id); })
      .catch(e => console.error('email accounts load error', e));
  }, [emailOpen]);

  const handleSendEmail = async () => {
    if (!emailAccountId || !emailTo.trim()) { setEmailError(t('crm.leads.form.email.errorNoRecipient')); return; }
    setEmailSending(true); setEmailError(null);
    try {
      await sendEmail({ accountId: emailAccountId, to: [emailTo.trim()], subject: emailSubject.trim() || undefined, textBody: emailBody.trim() || undefined, leadId: isNew ? undefined : id });
      setEmailOpen(false); setEmailTo(''); setEmailSubject(''); setEmailBody('');
      showSuccess(t('crm.leads.form.email.sent'));
    } catch (e: any) { setEmailError(e.message || t('crm.leads.form.email.errorSend')); }
    finally { setEmailSending(false); }
  };

  // ── design tokens ───────────────────────────────────────────────
  const FF  = 'inherit';
  const FM  = 'inherit';
  const INK = "#222";
  const FG2 = "#555";
  const FG3 = "#888";
  const FG4 = "#b5b5b5";
  const LINE  = "#e7e7e7";
  const LINE3 = "#f0f0f0";
  const BG_MUTED = "#fafafa";

  const inpCls = "w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-200 bg-white outline-none focus:border-neutral-400 transition-colors placeholder:text-neutral-400 text-neutral-900";
  const lblCls = "block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" as string;

  const STATUS_DOT: Record<string, string> = {
    'Новый клиент': '#2563eb', 'В работе': '#ea580c',
    'Ожидает ответа': '#d97706', 'Закрыт (успех)': '#16a34a', 'Закрыт (проигран)': '#dc2626',
  };
  const dot = STATUS_DOT[lead.status] ?? FG3;

  const inlineInp: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", color: INK, outline: "none", boxSizing: "border-box" };
  const lblInline: React.CSSProperties = { display: "block", fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3, marginBottom: 6 };

  return (
    <MainLayout>
      {/* toasts */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs text-emerald-700 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{successMessage}
        </div>
      )}
      {error && (
        <div className="fixed top-4 right-4 z-[9999] rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs text-rose-600 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">{error}</div>
      )}

      <div style={{ fontFamily: FF, color: INK }}>
        {/* ── header ─────────────────────────────────────────────── */}
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 20, marginBottom: 28 }}>
          <button type="button" onClick={handleBack}
            style={{ fontFamily: FM, fontSize: 11, color: FG3, letterSpacing: "0.06em", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            ← {t('crm.leads.form.back')}
          </button>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 10, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: FM, fontSize: 10, color: FG4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {isNew ? t('crm.leads.form.newLeadKicker') : `${t('crm.leads.form.idKicker')} · ${String(id || '').slice(0, 8).toUpperCase()}`}
              </div>
              <h1 style={{ fontFamily: FF, fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", color: INK, marginTop: 6, lineHeight: 1.1 }}>
                {lead.name || t('crm.leads.form.nameFallback')}
              </h1>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "4px 10px", borderRadius: 999, border: `1px solid ${LINE}`, background: BG_MUTED, fontSize: 12, color: FG2 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                {statusLabels[lead.status] ?? lead.status}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {!isNew && (
                <>
                  <button type="button" onClick={handleCreateCompany} className="btn-secondary">{t('crm.leads.form.actions.addCompany')}</button>
                  <button type="button" onClick={handleCreateAccount} className="btn-secondary">{t('crm.leads.form.actions.addAccount')}</button>
                  <button type="button" onClick={handleDeleteLead} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{t('crm.leads.form.actions.delete')}</button>
                </>
              )}
              <button type="button" onClick={() => setCustomFieldsOpen(true)} className="btn-secondary">{t('crm.leads.form.actions.configureFields')}</button>
              <button type="button" onClick={handleSave} disabled={saving}
                style={{ padding: "8px 20px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: "#fff", cursor: "pointer", opacity: saving ? 0.65 : 1 }}>
                {saving ? t('crm.leads.form.actions.saving') : t('crm.leads.form.actions.save')}
              </button>
            </div>
          </div>
        </div>

        {loading && <div style={{ fontFamily: FM, fontSize: 11, color: FG4, letterSpacing: "0.08em" }}>{t('crm.leads.form.loadingLead')}</div>}

        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">

            {/* ════ LEFT PANEL ════════════════════════════════════ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Name + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls} style={{ color: FG3 }}>{t('crm.leads.form.fields.namePlaceholder')}</label>
                  <input className={inpCls} value={lead.name} onChange={handleChange('name')} placeholder={t('crm.leads.form.fields.namePlaceholder')} />
                </div>
                <div>
                  <label className={lblCls} style={{ color: FG3 }}>E-mail</label>
                  <input className={inpCls} value={lead.email} type="email" onChange={handleChange('email')} placeholder="email@..." />
                </div>
              </div>

              {/* Company */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3 }}>{t('crm.leads.form.fields.company')}</span>
                  <button type="button" onClick={handleCreateCompany} style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.06em", color: FG3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ {t('crm.leads.form.fields.createCompany')}</button>
                </div>
                <CompanySelect
                  value={lead.companyId ?? null}
                  onChange={(companyId, company) => { const cid = companyId ?? null; setLead(prev => ({ ...prev, companyId: cid, contactId: cid === prev.companyId ? prev.contactId : null, companyName: company?.name || null })); }}
                  placeholder={t('crm.leads.form.fields.companyPlaceholder')}
                  className="w-full" allowCreate={true}
                  onCompanyCreated={company => { setCompanies([company, ...companies]); setLead(prev => ({ ...prev, companyId: company.id, companyName: company.name })); }}
                />
              </div>

              {/* Contact */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3 }}>{t('crm.leads.form.fields.contact')}</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    {lead.contactId && (
                      <button type="button" onClick={() => navigate(`/app/contacts/${lead.contactId}`)} style={{ fontFamily: FM, fontSize: 10, color: FG3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>↗ {t('crm.leads.form.fields.openContact')}</button>
                    )}
                    <button type="button" onClick={handleCreateContactFromLead} style={{ fontFamily: FM, fontSize: 10, color: FG3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ {t('crm.leads.form.fields.createContact')}</button>
                  </div>
                </div>
                <ContactSelect
                  value={lead.contactId ?? null} companyId={lead.companyId ?? null}
                  onChange={(contactId, contact) => { setLead(prev => ({ ...prev, contactId, name: prev.name?.trim().length > 0 ? prev.name : contact?.fullName || `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || prev.name, email: prev.email?.trim().length > 0 ? prev.email : contact?.email || prev.email, phone: prev.phone?.trim().length > 0 ? prev.phone : contact?.phone || prev.phone, companyId: prev.companyId || contact?.companyId || null })); }}
                  placeholder={t('crm.leads.form.fields.selectContact')} className="w-full" allowCreate={true}
                />
              </div>

              {/* Projects */}
              <div style={{ background: BG_MUTED, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3 }}>{t('crm.leads.form.sections.projectsTitle')}</span>
                  {!isNew && <button type="button" onClick={() => navigate('/projects')} style={{ fontFamily: FM, fontSize: 10, color: FG3, background: "none", border: "none", cursor: "pointer" }}>{t('crm.leads.form.sections.projectsOpenList')} ↗</button>}
                </div>
                {isNew && <div style={{ fontSize: 12, color: FG4, fontStyle: "italic" }}>{t('crm.leads.form.sections.projectsNeedSave')}</div>}
                {!isNew && leadProjectsLoading && <div style={{ fontSize: 12, color: FG4 }}>{t('crm.leads.form.sections.projectsLoading')}</div>}
                {!isNew && !leadProjectsLoading && leadProjects.length === 0 && <div style={{ fontSize: 12, color: FG4, fontStyle: "italic" }}>{t('crm.leads.form.sections.projectsEmpty')}</div>}
                {!isNew && leadProjects.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {leadProjects.map(p => (
                      <button key={p.id} type="button" onClick={() => navigate(`/projects/${p.id}`)}
                        style={{ textAlign: "left", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = INK)} onMouseLeave={e => (e.currentTarget.style.borderColor = LINE)}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: INK }}>{p.name}</div>
                        <div style={{ fontFamily: FM, fontSize: 10, color: FG4, marginTop: 2 }}>{p.status} · #{String(p.id).slice(0, 6)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Продажи WooCommerce / CRM */}
              {showLeadSalesSection && (
                <div style={{ background: BG_MUTED, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
                      {t('crm.leads.form.sections.salesWooTitle')}
                    </span>
                    <button type="button" onClick={() => navigate('/app/sales')} style={{ fontFamily: FM, fontSize: 10, color: FG3, background: 'none', border: 'none', cursor: 'pointer' }}>
                      {t('crm.leads.form.sections.salesWooOpenList')} ↗
                    </button>
                  </div>
                  {leadSalesLoading && (
                    <div style={{ fontSize: 12, color: FG4 }}>{t('crm.leads.form.sections.salesWooLoading')}</div>
                  )}
                  {leadSalesError && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{leadSalesError}</div>
                  )}
                  {!leadSalesLoading && !leadSalesError && leadSales.length === 0 && isWooRelatedLead && (
                    <div style={{ fontSize: 12, color: FG4, fontStyle: 'italic' }}>{t('crm.leads.form.sections.salesWooEmpty')}</div>
                  )}
                  {!leadSalesLoading && leadSales.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: INK }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                            <th style={{ textAlign: 'left', padding: '8px 6px', fontFamily: FM, color: FG3, fontWeight: 600, whiteSpace: 'nowrap' }}>{t('crm.leads.form.sections.salesWooColOrderId')}</th>
                            <th style={{ textAlign: 'left', padding: '8px 6px', fontFamily: FM, color: FG3, fontWeight: 600 }}>{t('crm.leads.form.sections.salesWooColProduct')}</th>
                            <th style={{ textAlign: 'left', padding: '8px 6px', fontFamily: FM, color: FG3, fontWeight: 600 }}>{t('crm.leads.form.sections.salesWooColProductLink')}</th>
                            <th style={{ textAlign: 'right', padding: '8px 6px', fontFamily: FM, color: FG3, fontWeight: 600 }}>{t('crm.leads.form.sections.salesWooColAmount')}</th>
                            <th style={{ textAlign: 'left', padding: '8px 6px', fontFamily: FM, color: FG3, fontWeight: 600 }}>{t('crm.leads.form.sections.salesWooColCurrency')}</th>
                            <th style={{ textAlign: 'left', padding: '8px 6px', fontFamily: FM, color: FG3, fontWeight: 600 }}>{t('crm.leads.form.sections.salesWooColStatus')}</th>
                            <th style={{ textAlign: 'center', padding: '8px 6px', fontFamily: FM, color: FG3, fontWeight: 600 }}>{t('crm.leads.form.sections.salesWooColWp')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadSales.map((s) => {
                            const saleRec = s as unknown as Record<string, unknown>;
                            const wpUrl = s.wooAdminEditUrl?.trim() || '';
                            const productUrl = extractSaleProductUrl(saleRec);
                            return (
                              <tr
                                key={s.id}
                                style={{ borderBottom: `1px solid ${LINE3}` }}
                              >
                                <td style={{ padding: '8px 6px', fontFamily: FM, whiteSpace: 'nowrap' }}>
                                  <Link
                                    to={`/app/sales/${s.id}`}
                                    style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                                  >
                                    {saleOrderDisplayNumber(saleRec)}
                                  </Link>
                                </td>
                                <td style={{ padding: '8px 6px', maxWidth: 160 }}>{s.hotel || t('crm.projects.common.emptyValue')}</td>
                                <td style={{ padding: '8px 6px', maxWidth: 120 }} onClick={(e) => e.stopPropagation()}>
                                  {productUrl ? (
                                    <a href={productUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontFamily: FM, fontSize: 10 }}>
                                      {t('crm.leads.form.sections.salesWooProductLinkShort')} ↗
                                    </a>
                                  ) : (
                                    <span style={{ color: FG4 }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: FM }}>{typeof s.amount === 'number' ? s.amount.toLocaleString(locale, { maximumFractionDigits: 2 }) : '—'}</td>
                                <td style={{ padding: '8px 6px', fontFamily: FM }}>{s.currency || '—'}</td>
                                <td style={{ padding: '8px 6px' }}>{translateSaleStatus(t, i18n, s.status)}</td>
                                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                  {wpUrl ? (
                                    <a href={wpUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontFamily: FM }}>
                                      WP ↗
                                    </a>
                                  ) : (
                                    <span style={{ color: FG4 }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Информация о бронировании (модуль "Бронирования") */}
              {!leadReservationsLoading && leadReservations.length > 0 && (
                <div style={{ background: BG_MUTED, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3 }}>
                      Информация о бронировании
                    </span>
                    <button type="button" onClick={() => navigate('/bookings/reservations')} style={{ fontFamily: FM, fontSize: 10, color: FG3, background: 'none', border: 'none', cursor: 'pointer' }}>
                      Открыть все брони ↗
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {leadReservations.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => navigate(`/bookings/reservations/${r.id}`)}
                        style={{ textAlign: 'left', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>
                            {new Date(r.startAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                          <span style={{ fontFamily: FM, fontSize: 10, color: FG3 }}>
                            {RESERVATION_STATUS_LABELS_RU[r.status] ?? r.status}
                          </span>
                        </div>
                        {r.customFields?.serviceName && (
                          <div style={{ fontFamily: FM, fontSize: 10, color: FG4, marginTop: 2 }}>{r.customFields.serviceName}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Phone + Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls} style={{ color: FG3 }}>{t('crm.leads.form.fields.phonePlaceholder')}</label>
                  <input className={inpCls} value={lead.phone} onChange={handleChange('phone')} placeholder={t('crm.leads.form.fields.phonePlaceholder')} />
                </div>
                <div>
                  <label className={lblCls} style={{ color: FG3 }}>{t('crm.leads.form.fields.countryPlaceholder')}</label>
                  <input className={inpCls} value={lead.country} onChange={handleChange('country')} placeholder={t('crm.leads.form.fields.countryPlaceholder')} />
                </div>
              </div>

              {/* Status + Channel + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={lblCls} style={{ color: FG3 }}>{t('crm.leads.form.fields.statusLabel')}</label>
                  <select className={inpCls} value={lead.status} onChange={handleStatusChange}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabels[s] ?? s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lblCls} style={{ color: FG3 }}>{t('crm.leads.form.fields.channelPlaceholder')}</label>
                  <input className={inpCls} value={lead.channel} onChange={handleChange('channel')} placeholder={t('crm.leads.form.fields.channelPlaceholder')} />
                  <div style={{ fontFamily: FM, fontSize: 9.5, color: FG4, marginTop: 4 }}>{t('crm.leads.form.sections.channelJourneyHint')}</div>
                </div>
                <div>
                  <label className={lblCls} style={{ color: FG3 }}>{t('crm.leads.form.fields.createdLabel')}</label>
                  <input disabled className={inpCls + " opacity-50"} value={new Date(lead.createdAt).toLocaleString(locale)} />
                </div>
              </div>

              {/* Custom fields */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3 }}>{t('crm.leads.form.fields.customFieldsLabel')}</span>
                  <button type="button" onClick={() => setCustomFieldsOpen(true)} style={{ fontFamily: FM, fontSize: 10, color: FG3, background: "none", border: "none", cursor: "pointer" }}>{t('crm.leads.form.fields.customFieldsConfigBtn')}</button>
                </div>
                {customFieldsError && <div style={{ fontSize: 11, color: "#ef4444" }}>{customFieldsError}</div>}
                {customFieldsLoading && <div style={{ fontSize: 11, color: FG4 }}>{t('crm.leads.form.fields.customFieldsLoading')}</div>}
                {!customFieldsLoading && activeCustomFields.length === 0 && <div style={{ fontSize: 12, color: FG4, fontStyle: "italic" }}>{t('crm.leads.form.fields.customFieldsEmpty')}</div>}
                {activeCustomFields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeCustomFields.map(field => renderCustomFieldInput(field))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className={lblCls} style={{ color: FG3 }}>{t('crm.leads.form.fields.notesLabel')}</label>
                <textarea className={inpCls + " resize-y min-h-[140px]"} rows={6}
                  value={(lead.meta && (lead.meta as any).comment) || (lead.meta && (lead.meta as any).message) || ''}
                  onChange={e => { const val = e.target.value; setLead(prev => ({ ...prev, meta: { ...(prev.meta || {}), comment: val } })); }}
                  placeholder={t('crm.leads.form.fields.notesPlaceholder')} />
              </div>

              {/* UTM (only if captured) */}
              {hasUtmCaptured && (
                <div style={{ background: BG_MUTED, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3, marginBottom: 12 }}>{t('crm.leads.form.fields.utmTitle')}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {([['utm_source', lead.utmSource], ['utm_medium', lead.utmMedium], ['utm_campaign', lead.utmCampaign], ['utm_content', lead.utmContent], ['utm_term', lead.utmTerm]] as const).map(([key, val]) => (
                      <div key={key}>
                        <div style={{ fontFamily: FM, fontSize: 9.5, color: FG4, marginBottom: 3 }}>{key}</div>
                        <div style={{ fontSize: 12, color: INK, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px", minHeight: 32 }}>{String(val ?? '').trim() || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ════ RIGHT SIDEBAR ═════════════════════════════════ */}
            <div className="lg:sticky lg:top-6" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── CCP account summary (ClientCabinet leads only) ─── */}
              {!isNew && (ccpClient || ccpClientLoading) && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: FG3 }}>
                      Клиентский кабинет
                    </div>
                    {ccpClient && (
                      <Link
                        to="/client-accounts"
                        style={{ fontFamily: FM, fontSize: 10, color: FG3, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = INK)}
                        onMouseLeave={e => (e.currentTarget.style.color = FG3)}
                      >
                        Перейти в счёт ↗
                      </Link>
                    )}
                  </div>
                  {ccpClientLoading && <div style={{ fontSize: 12, color: FG4 }}>Загрузка…</div>}
                  {ccpClient && !ccpClientLoading && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 500, color: INK, marginBottom: 8 }}>
                        {(ccpClient as any).name || (ccpClient as any).email}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                          { label: 'EUR', value: Number((ccpClient as any).balanceEur || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                          { label: 'USD', value: Number((ccpClient as any).balanceUsd || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontFamily: FM, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: FG4, marginBottom: 4 }}>{label}</div>
                            <div style={{ fontFamily: FM, fontSize: 13, fontWeight: 600, color: INK }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontFamily: FM, fontSize: 10, color: FG4, marginTop: 8 }}>
                        WP#{(ccpClient as any).wpUserId} · {(ccpClient as any).email}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* AI Sidebar — only for saved leads */}
              {!isNew && (
                <>
                  <AiLeadScoreCard leadId={lead.id} />
                  <AiNextActionCard leadId={lead.id} />
                  <AiOutreachEmailCard
                    leadId={lead.id}
                    leadEmail={lead.email || null}
                    leadName={lead.name || null}
                    onSend={handleSendOutreach}
                  />
                  <AiEnrichPanel
                    entityType="lead"
                    entityId={lead.id}
                    onApply={handleApplyEnrich}
                  />
                </>
              )}

              {/* Actions */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3, marginBottom: 12 }}>{t('crm.leads.form.sections.actionsTitle')}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { key: 'email', label: t('crm.leads.form.actions.email'), onClick: () => { setEmailTo(lead.email || ''); setEmailOpen(true); }, svg: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></> },
                    { key: 'meeting', label: t('crm.leads.form.actions.meeting'), onClick: () => setCalendarModal('meeting'), svg: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></> },
                    { key: 'task', label: t('crm.leads.form.actions.task'), onClick: () => setCalendarModal('note'), svg: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></> },
                    { key: 'auto', label: t('crm.leads.form.actions.automation'), onClick: () => navigate(lead?.id ? `/app/automations/new?leadId=${encodeURIComponent(lead.id)}` : '/app/automations/new'), svg: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/> },
                  ].map(({ key, label, onClick, svg }) => (
                    <button key={key} type="button" onClick={onClick}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 11, color: FG2, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.color = INK; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = FG2; }}>
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{svg}</svg>
                      {label}
                    </button>
                  ))}
                  <button type="button" onClick={() => navigate('/app/integrations')}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 11, color: FG2, transition: "all 0.15s", gridColumn: "span 2" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.color = INK; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = LINE; e.currentTarget.style.color = FG2; }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7L11 7"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7L13 17"/>
                    </svg>
                    {t('crm.leads.form.actions.integrations')}
                  </button>
                </div>
              </div>

              {/* Assignees — как блок ответственных в карточке проекта */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3, marginBottom: 12 }}>
                  {t('crm.projects.detail.owner.byDepartment')}
                </div>
                <div style={{ fontFamily: FM, fontSize: 10, color: FG4, marginBottom: 8 }}>
                  {t('crm.projects.detail.owner.selected', {
                    count: (lead.assignedUserIds ?? []).length,
                  })}
                </div>
                <div style={{ maxHeight: 208, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
                  {leadOwnerDepartmentGroups.map((group) => {
                    const groupIds = group.users.map((u) => u.id);
                    const selectedInGroup = groupIds.filter((id) =>
                      (lead.assignedUserIds ?? []).includes(id),
                    ).length;
                    const allChecked =
                      selectedInGroup > 0 && selectedInGroup === groupIds.length;
                    return (
                      <div
                        key={group.department}
                        style={{
                          borderRadius: 8,
                          border: `1px solid ${LINE}`,
                          background: BG_MUTED,
                          padding: 8,
                        }}
                      >
                        <div style={{ marginBottom: 6, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: INK, lineHeight: 1.25, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }} title={group.department}>
                            {group.department}
                          </div>
                          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: FG3, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
                            <input
                              type="checkbox"
                              checked={allChecked}
                              onChange={(e) =>
                                toggleLeadOwnerDepartment(group.department, e.target.checked)
                              }
                              style={{ accentColor: "#1769d1", width: 14, height: 14, margin: 0, cursor: "pointer" }}
                            />
                            <span>{t('crm.projects.detail.owner.wholeDepartment')}</span>
                          </label>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {group.users.map((u) => {
                            const checked = (lead.assignedUserIds ?? []).includes(u.id);
                            return (
                              <label
                                key={u.id}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 8,
                                  fontSize: 11,
                                  color: FG2,
                                  cursor: "pointer",
                                  padding: "3px 0",
                                  lineHeight: 1.35,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleLeadOwnerUser(u.id, e.target.checked)}
                                  style={{ accentColor: "#1769d1", width: 14, height: 14, margin: "2px 0 0", flexShrink: 0, cursor: "pointer" }}
                                />
                                <span style={{ minWidth: 0, wordBreak: "break-word" }}>
                                  {u.fullName}
                                  {u.email ? ` · ${u.email}` : ''}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: FG3, marginBottom: 14 }}>{t('crm.leads.form.sections.timelineTitle')}</div>
                {isNew && <div style={{ fontSize: 12, color: FG4, fontStyle: "italic" }}>{t('crm.leads.form.sections.projectsNeedSave')}</div>}
                {!isNew && (historyLoading || (leadProjects.length > 0 && projectActivitiesLoading)) && <div style={{ fontSize: 11, color: FG4 }}>{t('crm.leads.form.sections.historyLoading')}</div>}
                {!isNew && mergedTimeline.length === 0 && !historyLoading && <div style={{ fontSize: 12, color: FG4, fontStyle: "italic" }}>{t('crm.leads.form.sections.historyEmpty')}</div>}
                {(historyError || projectActivitiesError) && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>
                    {historyError && <div>{historyError}</div>}{projectActivitiesError && <div>{projectActivitiesError}</div>}
                  </div>
                )}
                {!isNew && mergedTimeline.length > 0 && (
                  <div style={{ position: "relative", paddingLeft: 20, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                    {/* vertical connector line */}
                    <div style={{ position: "absolute", left: 6, top: 8, bottom: 8, width: 1, background: LINE }} />
                    {mergedTimeline.map((row, idx) => {
                      const isLast = idx === mergedTimeline.length - 1;
                      if (row.kind === 'lead') {
                        const a = row.activity;
                        const isComment = a.type === 'comment';
                        const dotColor = isComment ? '#7c3aed' : '#9ca3af';
                        return (
                          <div key={`lead-${a.id}`} style={{ position: "relative", paddingBottom: isLast ? 0 : 10 }}>
                            <div style={{ position: "absolute", left: -17, top: 3, width: 8, height: 8, borderRadius: "50%", background: dotColor, border: `2px solid #fff`, boxSizing: "border-box", flexShrink: 0 }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                              <span style={{ fontSize: 10, background: BG_MUTED, border: `1px solid ${LINE}`, borderRadius: 999, padding: "1px 7px", color: FG2 }}>{getActivityLabel(a)}</span>
                              <span style={{ fontFamily: FM, fontSize: 9, color: FG4 }}>{new Date(a.createdAt).toLocaleString(locale)}</span>
                              {(a.userName || a.userEmail) && <span style={{ fontSize: 10, color: FG3 }}>· {a.userName || a.userEmail}</span>}
                            </div>
                            {a.comment && <div style={{ fontSize: 12, color: INK, background: "#f9f9fb", border: `1px solid ${LINE}`, borderRadius: 6, padding: "5px 8px", lineHeight: 1.4 }}>{a.comment}</div>}
                            {(a.fromValue || a.toValue) && (
                              <div style={{ fontSize: 11, color: FG3 }}>
                                {a.fromValue && <span style={{ textDecoration: "line-through", marginRight: 4 }}>{a.fromValue}</span>}
                                {a.toValue && <span style={{ color: "#16a34a" }}>→ {a.toValue}</span>}
                              </div>
                            )}
                          </div>
                        );
                      }
                      const activity = row.activity;
                      const label = projectActivityLabels[activity.action] ?? activity.action;
                      const actor = activity.actorName || activity.actorEmail || t('crm.projects.detail.fallbacks.user');
                      const pname = projectNameById.get(activity.projectId) ?? String(activity.projectId).slice(0, 8);
                      return (
                        <div key={`proj-${activity.id}`} style={{ position: "relative", paddingBottom: isLast ? 0 : 10 }}>
                          <div style={{ position: "absolute", left: -17, top: 3, width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", border: `2px solid #fff`, boxSizing: "border-box" }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                            <button type="button" onClick={() => navigate(`/projects/${activity.projectId}`)}
                              style={{ fontSize: 10, background: "#eff6ff", border: `1px solid #bfdbfe`, borderRadius: 999, padding: "1px 7px", color: "#1d4ed8", cursor: "pointer" }}>
                              {t('crm.leads.form.timeline.projectScope', { name: pname })}
                            </button>
                            <span style={{ fontFamily: FM, fontSize: 9, color: FG4 }}>{new Date(activity.createdAt).toLocaleString(locale)}</span>
                            <span style={{ fontSize: 10, color: FG3 }}>· {actor}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: INK }}>{label}</div>
                          {activity.action === 'status_change' && activity.payload && <div style={{ fontSize: 11, color: FG3 }}>{activity.payload.from} → {activity.payload.to}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Comment input */}
                {!isNew && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="flex-1 min-w-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs outline-none focus:border-neutral-400 text-neutral-900"
                        value={newComment} onChange={e => setNewComment(e.target.value)}
                        placeholder={t('crm.leads.form.fields.commentPlaceholder')}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }} />
                      <button type="button" onClick={handleSendComment}
                        style={{ padding: "7px 14px", fontSize: 11, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                        {t('crm.leads.form.actions.send')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ EMAIL COMPOSE MODAL ══════════════════════════════════ */}
      {emailOpen && createPortal(
        <div className="fixed inset-0 z-[8500] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 30px 80px rgba(0,0,0,0.20)", fontFamily: FF }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: `1px solid ${LINE}` }}>
              <h3 style={{ fontFamily: FF, fontSize: 17, fontWeight: 500, color: INK }}>{t('crm.leads.form.email.title')}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setEmailOpen(false)} style={{ padding: "7px 16px", fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: "#fff", color: FG2, cursor: "pointer" }}>{t('crm.common.cancel')}</button>
                <button type="button" onClick={handleSendEmail} disabled={emailSending} style={{ padding: "7px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: "#fff", cursor: "pointer", opacity: emailSending ? 0.65 : 1 }}>{emailSending ? t('crm.leads.form.email.sending') : t('crm.leads.form.email.send')}</button>
              </div>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lblInline}>{t('crm.leads.form.email.title').toUpperCase()}</label>
                {emailAccounts.length === 0
                  ? <div style={{ fontSize: 12, color: FG4, fontStyle: "italic" }}>{t('crm.leads.form.email.noAccounts')} <a href="/app/email/accounts" style={{ color: INK }}>{t('crm.leads.form.email.connectAccounts')}</a></div>
                  : <select value={emailAccountId} onChange={e => setEmailAccountId(e.target.value)} style={inlineInp}>
                      {emailAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.email}{acc.name ? ` · ${acc.name}` : ''}</option>)}
                    </select>
                }
              </div>
              <div>
                <label style={lblInline}>{t('crm.leads.form.email.to').toUpperCase()}</label>
                <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="email@..." style={inlineInp} />
              </div>
              <div>
                <label style={lblInline}>{t('crm.leads.form.email.subject').toUpperCase()}</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} style={inlineInp} />
              </div>
              <div>
                <label style={lblInline}>{t('crm.leads.form.email.body').toUpperCase()}</label>
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: `1px solid ${LINE}`, background: BG_MUTED }}>
                    {(['B','I','U','S'] as const).map(b => (
                      <button key={b} type="button" style={{ width: 28, height: 28, fontSize: 12, fontWeight: b==='B' ? 700 : 400, fontStyle: b==='I' ? 'italic' : 'normal', textDecoration: b==='U' ? 'underline' : b==='S' ? 'line-through' : 'none', border: `1px solid ${LINE}`, borderRadius: 6, background: "#fff", color: FG2, cursor: "pointer" }}>{b}</button>
                    ))}
                    <div style={{ width: 1, background: LINE, margin: "0 4px" }} />
                    {['•','1.'].map(b => <button key={b} type="button" style={{ width: 28, height: 28, fontSize: 11, border: `1px solid ${LINE}`, borderRadius: 6, background: "#fff", color: FG2, cursor: "pointer" }}>{b}</button>)}
                    <div style={{ width: 1, background: LINE, margin: "0 4px" }} />
                    <button type="button" style={{ width: 32, height: 28, fontSize: 11, border: `1px solid ${LINE}`, borderRadius: 6, background: "#fff", color: FG2, cursor: "pointer" }}>H2</button>
                  </div>
                  <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={10}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "none", background: "#fff", color: INK, outline: "none", resize: "vertical", minHeight: 200, boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
              </div>
              {emailError && <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>{emailError}</div>}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ══ ACCOUNT MODAL ════════════════════════════════════════ */}
      {accountModalOpen && createPortal(
        <div className="fixed inset-0 z-[8500] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 540, boxShadow: "0 30px 80px rgba(0,0,0,0.20)", fontFamily: FF }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 24px", borderBottom: `1px solid ${LINE}` }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: INK }}>{t('crm.leads.form.account.title')}</h3>
                <div style={{ fontFamily: FM, fontSize: 11, color: FG3, marginTop: 4 }}>{t('crm.leads.form.account.subtitle')}</div>
              </div>
              <button type="button" onClick={() => setAccountModalOpen(false)} style={{ background: "none", border: "none", fontSize: 20, color: FG3, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lblInline}>{t('crm.leads.form.account.fields.site')}</label>
                <select value={accountSiteId} onChange={e => setAccountSiteId(e.target.value)} style={inlineInp}>
                  <option value="">{t('crm.leads.form.account.fields.sitePlaceholder')}</option>
                  {accountSites.map(site => <option key={site.id} value={site.id}>{site.siteHost || site.siteUrl || site.id}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={lblInline}>{t('crm.leads.form.account.fields.name')}</label><input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder={t('crm.leads.form.account.fields.namePlaceholder')} style={inlineInp} /></div>
                <div><label style={lblInline}>{t('crm.leads.form.account.fields.email')}</label><input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} placeholder={t('crm.leads.form.account.fields.emailPlaceholder')} style={inlineInp} /></div>
              </div>
              <div><label style={lblInline}>{t('crm.leads.form.account.fields.password')}</label><input type="password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} placeholder={t('crm.leads.form.account.fields.passwordPlaceholder')} style={inlineInp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={lblInline}>{t('crm.leads.form.account.fields.balanceEur')}</label><input value={accountBalanceEur} onChange={e => setAccountBalanceEur(e.target.value)} placeholder={t('crm.leads.form.account.fields.balanceEurPlaceholder')} style={inlineInp} /></div>
                <div><label style={lblInline}>{t('crm.leads.form.account.fields.balanceUsd')}</label><input value={accountBalanceUsd} onChange={e => setAccountBalanceUsd(e.target.value)} placeholder={t('crm.leads.form.account.fields.balanceUsdPlaceholder')} style={inlineInp} /></div>
              </div>
              {accountError && <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>{accountError}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setAccountModalOpen(false)} disabled={accountBusy} style={{ padding: "8px 18px", fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: "#fff", color: FG2, cursor: "pointer" }}>{t('crm.common.cancel')}</button>
                <button type="button" onClick={handleAccountSave} disabled={accountBusy} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: "#fff", cursor: "pointer", opacity: accountBusy ? 0.65 : 1 }}>{accountBusy ? t('crm.common.saving') : t('crm.leads.form.account.actions.create')}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ══ COMPANY MODAL ════════════════════════════════════════ */}
      {companyModalOpen && createPortal(
        <div className="fixed inset-0 z-[8500] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 30px 80px rgba(0,0,0,0.20)", fontFamily: FF }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 24px", borderBottom: `1px solid ${LINE}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, color: INK }}>{t('crm.companies.form.titleCreate')}</h3>
              <button type="button" onClick={() => setCompanyModalOpen(false)} style={{ background: "none", border: "none", fontSize: 20, color: FG3, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {companyError && <div style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>{companyError}</div>}
              <div><label style={lblInline}>{t('crm.companies.form.fields.name')}</label><input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={t('crm.companies.form.fields.name')} style={inlineInp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={lblInline}>{t('crm.companies.form.fields.email')}</label><input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="email@..." style={inlineInp} /></div>
                <div><label style={lblInline}>{t('crm.companies.form.fields.phone')}</label><input type="tel" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder={t('crm.companies.form.fields.phonePlaceholder')} style={inlineInp} /></div>
              </div>
              <div><label style={lblInline}>{t('crm.companies.form.fields.website')}</label><input type="url" value={companyWebsite} onChange={e => setCompanyWebsite(e.target.value)} placeholder={t('crm.companies.form.fields.websitePlaceholder')} style={inlineInp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={lblInline}>{t('crm.companies.form.fields.country')}</label><input type="text" value={companyCountry} onChange={e => setCompanyCountry(e.target.value)} placeholder={t('crm.companies.form.fields.countryPlaceholder')} style={inlineInp} /></div>
                <div><label style={lblInline}>{t('crm.companies.form.fields.city')}</label><input type="text" value={companyCity} onChange={e => setCompanyCity(e.target.value)} placeholder={t('crm.companies.form.fields.cityPlaceholder')} style={inlineInp} /></div>
              </div>
              <div><label style={lblInline}>{t('crm.companies.form.fields.address')}</label><input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder={t('crm.companies.form.fields.addressPlaceholder')} style={inlineInp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label style={lblInline}>{t('crm.companies.form.fields.industry')}</label><input type="text" value={companyIndustry} onChange={e => setCompanyIndustry(e.target.value)} placeholder={t('crm.companies.form.fields.industryPlaceholder')} style={inlineInp} /></div>
                <div><label style={lblInline}>{t('crm.companies.form.fields.size')}</label><input type="text" value={companySize} onChange={e => setCompanySize(e.target.value)} placeholder={t('crm.companies.form.fields.sizePlaceholder')} style={inlineInp} /></div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setCompanyModalOpen(false)} style={{ padding: "8px 18px", fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: "#fff", color: FG2, cursor: "pointer" }}>{t('crm.companies.form.cancel')}</button>
                <button type="button" onClick={handleCompanySave} disabled={companyBusy || !companyName.trim()} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: "#fff", cursor: "pointer", opacity: (companyBusy || !companyName.trim()) ? 0.55 : 1 }}>{companyBusy ? t('crm.companies.form.saving') : t('crm.companies.form.save')}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {customFieldsOpen && (
        <CustomFieldsManager entityType="lead" title={t('crm.leads.form.customFieldsManagerTitle')} suggestedKeys={suggestedKeys}
          onClose={() => setCustomFieldsOpen(false)}
          onUpdated={items => { const sorted = [...items].sort((a, b) => a.order - b.order); setCustomFields(sorted); }} />
      )}

      {calendarModal && (
        <CalendarEntryModal
          initialKind={calendarModal}
          preselectedLeadId={isNew ? undefined : id}
          preselectedLeadName={lead.name || undefined}
          onClose={() => setCalendarModal(null)}
          onSaved={() => { showSuccess(calendarModal === 'meeting' ? t('crm.leads.form.messages.meetingCreated') : t('crm.leads.form.messages.noteCreated')); }}
        />
      )}
    </MainLayout>
  );
};
