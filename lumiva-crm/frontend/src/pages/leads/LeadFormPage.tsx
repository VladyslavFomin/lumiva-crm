// src/pages/leads/LeadFormPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ccpApi, type CcpSite } from '../../api/ccp';
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
  const [projectActivities, setProjectActivities] = useState<ProjectActivity[]>([]);
  const [projectActivitiesLoading, setProjectActivitiesLoading] = useState(false);
  const [projectActivitiesError, setProjectActivitiesError] = useState<string | null>(null);

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
      'px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft';
    const label = (
      <div className="text-[11px] text-slate-400 mb-1">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
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
              {field.placeholder || 'Выберите значение'}
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
        setCustomFieldsError(e.message || 'Не удалось загрузить кастомные поля');
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

  // выбор ответственных из справочника сотрудников
  const handleAssigneeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIds = Array.from(e.target.selectedOptions)
      .map((opt) => opt.value)
      .filter(Boolean);
    const names = staff
      .filter((u) => selectedIds.includes(u.id))
      .map((u) => u.fullName);

    setLead((prev) => ({
      ...prev,
      assignedUserIds: selectedIds,
      assignedUserId: selectedIds[0] ?? null,
      assignedToList: names,
      assignedTo: names.length ? names.join(', ') : null,
    }));
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
          source: lead.channel || 'manual',
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
        navigate(`/app/leads/${saved.id}`, { replace: true });
      } else {
        const saved = await updateLead(lead.id, {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          country: lead.country,
          status: lead.status,
          source: lead.channel || undefined,
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
    navigate('/app/leads');
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
      showSuccess('Контакт создан и привязан к лиду');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Ошибка создания контакта');
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

  const ok = window.confirm(t('crm.leads.form.alerts.deleteConfirm'));
  if (!ok) return;

  try {
    await deleteLead(lead.id);
    showSuccess(t('crm.leads.form.messages.leadDeleted'));
    navigate('/app/leads');
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
      alert(t('crm.leads.form.alerts.commentRequiresSave'));
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

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Верхняя панель */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-400 hover:text-slate-200 mb-1"
            >
              {t('crm.leads.form.back')}
            </button>
            <div className="text-[11px] text-slate-500">{title}</div>
            <h1 className="text-lg font-semibold text-slate-50">
              {lead.name || t('crm.leads.form.nameFallback')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <>
                <button
                  type="button"
                  onClick={handleCreateCompany}
                  className="px-3 py-1.5 text-xs rounded-xl border border-lumiva-accent-soft text-lumiva-accent hover:bg-slate-900/80"
                >
                  Создать Компанию
                </button>
                <button
                  type="button"
                  onClick={handleCreateAccount}
                  className="px-3 py-1.5 text-xs rounded-xl border border-lumiva-accent-soft text-lumiva-accent hover:bg-slate-900/80"
                >
                  {t('crm.leads.form.actions.createAccount')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteLead}
                  className="px-3 py-1.5 text-xs rounded-xl border border-rose-500/60 text-rose-300 hover:bg-rose-950/60"
                >
                  {t('crm.leads.form.actions.delete')}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setCustomFieldsOpen(true)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80"
            >
              Настроить поля
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {saving ? t('crm.leads.form.actions.saving') : t('crm.leads.form.actions.save')}
            </button>
          </div>
        </div>

        {/* Уведомление об успехе */}
        {successMessage && !error && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg shadow-emerald-900/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Лоадер */}
        {loading && (
          <div className="text-xs text-slate-400">{t('crm.leads.form.loadingLead')}</div>
        )}

        {!loading && (
          <>
            {/* Вкладки */}
            <div className="inline-flex bg-slate-900/70 border border-slate-800/80 rounded-2xl p-1 text-[13px]">
              <button
                type="button"
                onClick={() => setTab('main')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'main'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                {t('crm.leads.form.tabs.main')}
              </button>
              <button
                type="button"
                onClick={() => setTab('journey')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'journey'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                {t('crm.leads.form.tabs.journey')}
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'history'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                {t('crm.leads.form.tabs.history')}
              </button>
            </div>

            {/* Контент вкладок */}
            {tab === 'main' && (
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
                {/* Имя / Контакты */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={lead.name}
                    onChange={handleChange('name')}
                    placeholder={t('crm.leads.form.fields.namePlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                  <input
                    value={lead.email}
                    onChange={handleChange('email')}
                    placeholder={t('crm.leads.form.fields.emailPlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                </div>

                {/* Компания */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] text-slate-400">{t('crm.leads.form.fields.company')}</label>
                    <button
                      type="button"
                      onClick={handleCreateCompany}
                      className="px-2 py-1 text-[10px] rounded-lg border border-lumiva-accent-soft text-lumiva-accent hover:bg-slate-900/80 transition-colors"
                    >
                      + {t('crm.leads.form.fields.createCompany')}
                    </button>
                  </div>
                  <CompanySelect
                    value={lead.companyId ?? null}
                    onChange={(companyId, company) => {
                      const cid = companyId ?? null;
                      setLead((prev) => ({
                        ...prev,
                        companyId: cid,
                        contactId: cid === prev.companyId ? prev.contactId : null,
                        companyName: company?.name || null,
                      }));
                    }}
                    placeholder={t('crm.leads.form.fields.companyPlaceholder')}
                    className="w-full"
                    allowCreate={true}
                    onCompanyCreated={(company) => {
                      setCompanies([company, ...companies]);
                      setLead((prev) => ({
                        ...prev,
                        companyId: company.id,
                        companyName: company.name,
                      }));
                    }}
                  />
                </div>

                {/* Контакт, связанный с лидом */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-[11px] text-slate-400">Контакт</label>
                    <div className="flex items-center gap-1.5">
                      {lead.contactId && (
                        <button
                          type="button"
                          onClick={() => navigate(`/app/contacts/${lead.contactId}`)}
                          className="px-2 py-1 text-[10px] rounded-lg border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-600 transition-colors"
                        >
                          Открыть контакт
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleCreateContactFromLead}
                        className="px-2 py-1 text-[10px] rounded-lg border border-lumiva-accent-soft text-lumiva-accent hover:bg-slate-900/80 transition-colors"
                      >
                        + Создать контакт
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
                            : contact?.fullName ||
                              `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() ||
                              prev.name,
                        email: prev.email?.trim().length > 0 ? prev.email : contact?.email || prev.email,
                        phone: prev.phone?.trim().length > 0 ? prev.phone : contact?.phone || prev.phone,
                        companyId: prev.companyId || contact?.companyId || null,
                      }));
                    }}
                    placeholder="Выберите контакт"
                    className="w-full"
                    allowCreate={true}
                    theme="dark"
                  />
                </div>

                {/* Проекты лида */}
                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                      {t('crm.leads.form.sections.projectsTitle')}
                    </div>
                    {!isNew && (
                      <button
                        type="button"
                        onClick={() => navigate('/app/projects')}
                        className="px-2 py-1 text-[10px] rounded-lg border border-slate-700/80 text-slate-300 hover:bg-slate-900/80"
                      >
                        {t('crm.leads.form.sections.projectsOpenList')}
                      </button>
                    )}
                  </div>
                  {isNew && (
                    <div className="text-[11px] text-slate-500 italic">
                      {t('crm.leads.form.sections.projectsNeedSave')}
                    </div>
                  )}
                  {!isNew && leadProjectsLoading && (
                    <div className="text-[11px] text-slate-500">
                      {t('crm.leads.form.sections.projectsLoading')}
                    </div>
                  )}
                  {!isNew && leadProjectsError && (
                    <div className="text-[11px] text-rose-400">{leadProjectsError}</div>
                  )}
                  {!isNew &&
                    !leadProjectsLoading &&
                    leadProjects.length === 0 && (
                      <div className="text-[11px] text-slate-500">
                        {t('crm.leads.form.sections.projectsEmpty')}
                      </div>
                    )}
                  {!isNew && leadProjects.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {leadProjects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => navigate(`/app/projects/${p.id}`)}
                          className="text-left rounded-xl bg-slate-950/80 border border-slate-800/80 px-3 py-2.5 text-xs hover:border-lumiva-accent-soft hover:bg-slate-900/60 transition-colors"
                        >
                          <div className="font-medium text-slate-100">{p.name}</div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            {t('crm.leads.form.fields.projectStatus', {
                              status: p.status,
                              id: String(p.id).slice(0, 6),
                            })}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Телефон / страна / ответственный */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={lead.phone}
                    onChange={handleChange('phone')}
                    placeholder={t('crm.leads.form.fields.phonePlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />
                  <input
                    value={lead.country}
                    onChange={handleChange('country')}
                    placeholder={t('crm.leads.form.fields.countryPlaceholder')}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  />

                  {/* Ответственный (выбор из сотрудников) */}
                  <select
                    multiple
                    value={lead.assignedUserIds ?? []}
                    onChange={handleAssigneeSelect}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft min-h-[44px]"
                  >
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} {u.email ? `· ${u.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Статус / Канал / дата создания */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={lead.status}
                    onChange={handleStatusChange}
                    className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s] ?? s}
                      </option>
                    ))}
                  </select>
                  <div>
                    <input
                      value={lead.channel}
                      onChange={handleChange('channel')}
                      placeholder={t('crm.leads.form.fields.channelPlaceholder')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">
                      {t('crm.leads.form.sections.channelJourneyHint')}
                    </div>
                  </div>
                  <input
                    disabled
                    value={new Date(lead.createdAt).toLocaleString(locale)}
                    className="px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-500"
                  />
                </div>

                {/* Кастомные поля */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400">Кастомные поля</div>
                    <button
                      type="button"
                      onClick={() => setCustomFieldsOpen(true)}
                      className="text-[11px] text-lumiva-accent hover:text-lumiva-accent-soft"
                    >
                      Настроить
                    </button>
                  </div>
                  {customFieldsError && (
                    <div className="text-[11px] text-red-400">
                      {customFieldsError}
                    </div>
                  )}
                  {customFieldsLoading && (
                    <div className="text-[11px] text-slate-500">
                      Загрузка полей...
                    </div>
                  )}
                  {!customFieldsLoading && activeCustomFields.length === 0 && (
                    <div className="text-[11px] text-slate-500 italic">
                      Полей нет. Добавьте через настройку.
                    </div>
                  )}
                  {activeCustomFields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeCustomFields.map((field) =>
                        renderCustomFieldInput(field),
                      )}
                    </div>
                  )}
                </div>

                {/* Текст лида */}
                <div>
                  <textarea
                    value={
                      (lead.meta && (lead.meta as any).comment) ||
                      (lead.meta && (lead.meta as any).message) ||
                      ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setLead((prev) => ({
                        ...prev,
                        meta: {
                          ...(prev.meta || {}),
                          comment: val,
                        },
                      }));
                    }}
                    placeholder={t('crm.leads.form.fields.notesPlaceholder')}
                    rows={6}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft resize-y min-h-[140px]"
                  />
                </div>
              </div>
            )}

            {tab === 'journey' && (
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4 text-sm text-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-50">
                    {t('crm.leads.form.journey.title')}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t('crm.leads.form.journey.subtitle')}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3 space-y-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    {t('crm.leads.form.journey.acquisitionTitle')}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-slate-500 mb-1">
                        {t('crm.leads.form.journey.channelLabel')}
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm text-slate-200">
                        {lead.channel?.trim() || '—'}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {t('crm.leads.form.journey.channelHint')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2">
                      <div className="text-[11px] font-medium text-slate-200">
                        {t('crm.leads.form.journey.directTitle')}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {t('crm.leads.form.journey.directBody')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                      {t('crm.leads.form.journey.utmTitle')}
                    </div>
                    {!hasUtmCaptured && (
                      <span className="text-[10px] text-slate-500">
                        {t('crm.leads.form.journey.utmEmpty')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(
                      [
                        ['utm_source', lead.utmSource],
                        ['utm_medium', lead.utmMedium],
                        ['utm_campaign', lead.utmCampaign],
                        ['utm_content', lead.utmContent],
                        ['utm_term', lead.utmTerm],
                      ] as const
                    ).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <div className="text-[10px] text-slate-500 font-mono">{key}</div>
                        <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 min-h-[40px]">
                          {String(val ?? '').trim() || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">{t('crm.leads.form.journey.metaHint')}</p>
                </div>

                <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3 space-y-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    {t('crm.leads.form.journey.metaJsonTitle')}
                  </div>
                  <textarea
                    value={JSON.stringify(lead.meta ?? {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const obj = JSON.parse(e.target.value || '{}');
                        setLead((prev) => ({ ...prev, meta: obj }));
                        setError(null);
                      } catch {
                        setError(t('crm.leads.form.errors.metaInvalid'));
                      }
                    }}
                    placeholder={t('crm.leads.form.fields.metaPlaceholder')}
                    rows={10}
                    spellCheck={false}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono text-slate-200 outline-none focus:border-lumiva-accent-soft resize-y min-h-[160px]"
                  />
                  <p className="text-[10px] text-slate-500">
                    {t('crm.leads.form.journey.metaJsonHint')}
                  </p>
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-3 text-sm text-slate-100">
                {isNew && (
                  <div className="text-xs text-slate-400">
                    {t('crm.leads.form.sections.historyEmptyNew')}
                  </div>
                )}

                {!isNew && (
                  <>
                    {(historyError || projectActivitiesError) && (
                      <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2 mb-2 space-y-1">
                        {historyError && <div>{historyError}</div>}
                        {projectActivitiesError && <div>{projectActivitiesError}</div>}
                      </div>
                    )}

                    {(historyLoading ||
                      (leadProjects.length > 0 && projectActivitiesLoading)) && (
                      <div className="text-xs text-slate-400 mb-2">
                        {historyLoading
                          ? t('crm.leads.form.sections.historyLoading')
                          : t('crm.leads.form.timeline.loadingProjectActivities')}
                      </div>
                    )}

                    {!historyLoading &&
                      !(leadProjects.length > 0 && projectActivitiesLoading) &&
                      mergedTimeline.length === 0 && (
                      <div className="text-xs text-slate-500">
                        {t('crm.leads.form.sections.historyEmpty')}
                      </div>
                    )}

                    <div className="space-y-2">
                      {mergedTimeline.map((row) => {
                        if (row.kind === 'lead') {
                          const a = row.activity;
                          return (
                        <div
                          key={`lead-${a.id}`}
                          className="rounded-2xl bg-slate-950/80 border border-slate-800/80 px-3 py-2"
                        >
                          <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-500 mb-1">
                            <span className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-300">
                              {t('crm.leads.form.timeline.leadScope')}
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              <span>{getActivityLabel(a)}</span>
                              <span>
                                {new Date(a.createdAt).toLocaleString(locale)}
                              </span>
                            </span>
                          </div>

                          {(a.userName || a.userEmail) && (
                            <div className="text-[11px] text-slate-400 mb-1">
                              {t('crm.leads.form.sections.user')}: {a.userName || a.userEmail}
                            </div>
                          )}

                          {a.comment && (
                            <div className="text-slate-100">{a.comment}</div>
                          )}

                          {(a.fromValue || a.toValue) && (
                            <div className="text-[11px] text-slate-400 mt-1">
                              {a.fromValue && (
                                <span className="line-through text-slate-500 mr-1">
                                  {a.fromValue}
                                </span>
                              )}
                              {a.toValue && (
                                <span className="text-emerald-300">
                                  {a.toValue}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                          );
                        }

                        const activity = row.activity;
                        const label =
                          projectActivityLabels[activity.action] ?? activity.action;
                        const actor =
                          activity.actorName ||
                          activity.actorEmail ||
                          t('crm.projects.detail.fallbacks.user');
                        const changes = activity.payload?.changes ?? [];
                        const pname =
                          projectNameById.get(activity.projectId) ??
                          String(activity.projectId).slice(0, 8);
                        return (
                          <div
                            key={`proj-${activity.id}`}
                            className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                          >
                            <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-500 mb-1">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/app/projects/${activity.projectId}`)
                                }
                                className="inline-flex items-center rounded-full border border-lumiva-accent-soft/50 bg-slate-900/80 px-2 py-0.5 text-[10px] text-lumiva-accent hover:bg-slate-900"
                              >
                                {t('crm.leads.form.timeline.projectScope', {
                                  name: pname,
                                })}
                              </button>
                              <span>
                                {new Date(activity.createdAt).toLocaleString(locale)} · {actor}
                              </span>
                            </div>
                            <div className="text-[12px] text-slate-200 font-semibold">
                              {label}
                            </div>
                            {activity.action === 'status_change' && activity.payload && (
                              <div className="text-[11px] text-slate-400 mt-1">
                                {activity.payload.from} → {activity.payload.to}
                              </div>
                            )}
                            {changes.length > 0 && (
                              <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                                {changes.map((change: any, idx: number) => (
                                  <div key={`${change.field}-${idx}`}>
                                    <span className="text-slate-300">
                                      {projectActivityFieldLabels[change.field] ??
                                        change.field}
                                      :
                                    </span>{' '}
                                    <span>{formatProjectHistoryValue(change.from)}</span> →{' '}
                                    <span>{formatProjectHistoryValue(change.to)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Добавление комментария */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <div className="text-xs text-slate-400 mb-1">
                        {t('crm.leads.form.sections.addComment')}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder={t('crm.leads.form.fields.commentPlaceholder')}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                        />
                        <button
                          type="button"
                          onClick={handleSendComment}
                          className="px-3 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
                        >
                          {t('crm.leads.form.actions.send')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {accountModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-50">
                  {t('crm.leads.form.account.title')}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {t('crm.leads.form.account.subtitle')}
                </div>
              </div>
              <button
                onClick={() => setAccountModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
                aria-label={t('crm.common.close')}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('crm.leads.form.account.fields.site')}
                </div>
                <select
                  value={accountSiteId}
                  onChange={(e) => setAccountSiteId(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                >
                  <option value="">{t('crm.leads.form.account.fields.sitePlaceholder')}</option>
                  {accountSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.siteHost || site.siteUrl || site.id}
                    </option>
                  ))}
                </select>
                {accountSites.length === 0 ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    {t('crm.leads.form.account.hints.noSites')}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.name')}
                  </div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.namePlaceholder')}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.email')}
                  </div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.emailPlaceholder')}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.password')}
                  </div>
                  <input
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.passwordPlaceholder')}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.balanceEur')}
                  </div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountBalanceEur}
                    onChange={(e) => setAccountBalanceEur(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.balanceEurPlaceholder')}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('crm.leads.form.account.fields.balanceUsd')}
                  </div>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    value={accountBalanceUsd}
                    onChange={(e) => setAccountBalanceUsd(e.target.value)}
                    placeholder={t('crm.leads.form.account.fields.balanceUsdPlaceholder')}
                  />
                </div>
              </div>

              {accountError && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                  {accountError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="px-4 py-2 text-xs rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900"
                disabled={accountBusy}
              >
                {t('crm.common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleAccountSave}
                className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                disabled={accountBusy}
              >
                {accountBusy ? t('crm.common.saving') : t('crm.leads.form.account.actions.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания компании */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs font-semibold text-slate-50">
                  Создать Компанию
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {t('crm.leads.form.fields.companyCreated')}
                </div>
              </div>
              <button
                onClick={() => setCompanyModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
                aria-label="Закрыть"
                type="button"
              >
                ×
              </button>
            </div>

            {companyError && (
              <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
                {companyError}
              </div>
            )}

            <div className="space-y-4">
              {/* Основная информация */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">
                  {t('crm.companies.form.fields.name')}
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder={t('crm.companies.form.fields.name')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Телефон</label>
                  <input
                    type="tel"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">Сайт</label>
                <input
                  type="url"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder="https://example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Страна</label>
                  <input
                    type="text"
                    value={companyCountry}
                    onChange={(e) => setCompanyCountry(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                    placeholder="Страна"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Город</label>
                  <input
                    type="text"
                    value={companyCity}
                    onChange={(e) => setCompanyCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                    placeholder="Город"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">Адрес</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder="Адрес"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Индустрия</label>
                  <input
                    type="text"
                    value={companyIndustry}
                    onChange={(e) => setCompanyIndustry(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                    placeholder="Индустрия"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Размер компании</label>
                  <input
                    type="text"
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                    placeholder="Например: 1-10, 11-50, 51-200"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCompanyModalOpen(false)}
                className="px-4 py-2 text-xs rounded-xl border border-slate-700 text-slate-300 hover:text-slate-50 hover:bg-slate-900 transition-colors"
              >
                {t('crm.companies.form.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCompanySave}
                className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={companyBusy || !companyName.trim()}
              >
                {companyBusy ? t('crm.companies.form.saving') : t('crm.companies.form.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {customFieldsOpen && (
        <CustomFieldsManager
          entityType="lead"
          title="Кастомные поля лидов"
          suggestedKeys={suggestedKeys}
          onClose={() => setCustomFieldsOpen(false)}
          onUpdated={(items) => {
            const sorted = [...items].sort((a, b) => a.order - b.order);
            setCustomFields(sorted);
          }}
        />
      )}
    </MainLayout>
  );
};
