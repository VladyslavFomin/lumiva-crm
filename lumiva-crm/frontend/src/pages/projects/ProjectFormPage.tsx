// src/pages/projects/ProjectFormPage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useTranslation } from 'react-i18next';
import { CalendarEntryModal } from '../../components/CalendarEntryModal';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { fetchEmailAccounts, sendEmail, type EmailAccount } from '../../api/email';

import {
  PROJECT_CATEGORIES,
  createEmptyProject,
  type Project,
  type ProjectStatus,
  type ProjectTask,
  type ProjectComment,
  type ProjectTaskChecklistItem,
  type ProjectFileLink,
  type ProjectFileProvider,
} from './projectTypes';

import {
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  fetchProjectActivities,
  changeProjectStatus,
  type ProjectActivity,
} from '../../api/projects';
import { fetchLeadsList, type Lead } from '../../api/leads';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { getStoredUser } from '../../auth/session';
import { usePermission } from '../../hooks/usePermission';
import { fetchCompanies, type Company } from '../../api/companies';
import { fetchContacts, type Contact } from '../../api/contacts';
import './ProjectDetail.css';
import { StatusPill, Card, Field, DotsMenu } from './ProjectDetailParts';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { DateFieldPicker } from '../../components/DateFieldPicker';
import { JiraIssueLinkPanel } from '../../components/integrations/JiraIssueLinkPanel';
import {
  readProjectTasksCache,
  writeProjectTasksCache,
} from './projectTasksCache';
import { useProjectStatuses } from './useProjectStatuses';
import { useProjectTagDefinitions } from './useProjectTagDefinitions';
import { useProjectCurrencyDefinitions } from './useProjectCurrencyDefinitions';
import {
  isTaskAssigneeSelected,
  normalizeAssigneesToStaffIds,
  resolveStaffForAssigneeEntry,
  taskAssigneesMatchNormalizedLabels,
  toggleTaskAssigneeIds,
} from './taskAssignees';
import { isTextMentioning, splitTextWithMentions } from './mentions';

const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}${crypto.randomUUID()}`;
  }
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

const TASK_STATUS_OPTIONS: ProjectTask['status'][] = [
  'К выполнению',
  'В работе',
  'На проверке',
  'Заблокировано',
  'Отложено',
  'Готово',
];

// фиксированный набор статусов проекта
const PROJECT_STATUSES: ProjectStatus[] = [
  'Новый',
  'В работе',
  'На проверке',
  'Заморожен',
  'Выиграно',
  'Проиграно',
];

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

function toNumberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/** Сравнение old/new для скрытия ложных диффов (1000 vs 1000.00, порядок в списках и т.д.) */
function historyComparable(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (field === 'amount') {
    const n = toNumberValue(value);
    return n !== null ? String(n) : String(value).trim();
  }
  if (field === 'tags' || field === 'ownerUserIds') {
    const arr = Array.isArray(value)
      ? value.map((v) => String(v).trim()).filter(Boolean)
      : String(value)
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    return [...arr].sort().join('|');
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter(Boolean)
      .sort()
      .join('|');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

function historyValuesEqual(field: string, from: unknown, to: unknown): boolean {
  return historyComparable(field, from) === historyComparable(field, to);
}

/** Не начинать drag строки с полей, кнопок и зон с data-no-task-drag */
function isProjectTaskRowDragBlockedTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, button, a[href], [data-no-task-drag]',
    ),
  );
}

/** Токены и классы в духе страницы лида (LeadFormPage) */
const FF = 'inherit';
const FM = 'inherit';
const INK = '#222';
const FG2 = '#555';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const LINE3 = '#f0f0f0';
const BG_MUTED = '#fafafa';
const inpCls =
  'w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-200 bg-white outline-none focus:border-neutral-400 transition-colors placeholder:text-neutral-400 text-neutral-900';
const lblCls = 'block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5';

export const ProjectFormPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  // На создании оба гейта неактуальны — сумму/владельца указывает тот, кто вообще может
  // создать проект (projects_manage), проверено бэкендом на POST /projects.
  // Хуки должны вызываться безусловно (иначе после создания isNew:true -> false
  // ломает порядок хуков и валит React #311), поэтому isNew применяется уже к результату.
  const canEditAmountPermission = usePermission('projects_edit_amount');
  const canEditOwnerPermission = usePermission('projects_edit_owner');
  const canEditAmount = isNew || canEditAmountPermission;
  const canEditOwner = isNew || canEditOwnerPermission;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableFromQuery = searchParams.get('table');
  const { showConfirm } = useAlertModal();

  const [project, setProject] = useState<Project>(createEmptyProject());
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((current) => (current === msg ? null : current));
    }, 2500);
  };
  const showErrorToast = (msg: string) => {
    setError(msg);
    setTimeout(() => {
      setError((current) => (current === msg ? null : current));
    }, 3500);
  };

  const [calendarModal, setCalendarModal] = useState<'meeting' | 'note' | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailAccountId, setEmailAccountId] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Лиды для селекта "Лид"
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  // Сотрудники для "Ответственный"
  const [staff, setStaff] = useState<StaffUser[]>([]);
  // Компании для отображения
  const [companies, setCompanies] = useState<Company[]>([]);
  // Контакты для селекта "Контакт"
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState<'props' | 'tasks' | 'comments' | 'history'>('props');
  const [editName, setEditName] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false);
  const [customFieldsError, setCustomFieldsError] = useState<string | null>(null);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.keys(project.customFields ?? {}).forEach((key) => keys.add(key));
    return Array.from(keys);
  }, [project.customFields]);

  // ---------------- Файлы (ссылки на ТЗ / смету / договор и т.д.) ----------------
  const [fileAddOpen, setFileAddOpen] = useState(false);
  const [fileAddStep, setFileAddStep] = useState<'provider' | 'form'>('provider');
  const [fileAddProvider, setFileAddProvider] = useState<ProjectFileProvider>('other');
  const [fileAddLabel, setFileAddLabel] = useState('');
  const [fileAddUrl, setFileAddUrl] = useState('');
  const fileAddRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!fileAddOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fileAddRef.current && !fileAddRef.current.contains(e.target as Node)) setFileAddOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [fileAddOpen]);

  // Список ссылок для отображения: новый массив files + старая одиночная запись (для совместимости)
  const displayedFiles: ProjectFileLink[] = useMemo(() => {
    const list = project.files ?? [];
    if (list.length === 0 && project.briefFileUrl) {
      return [{
        id: '__legacy__',
        label: project.briefFileName || project.briefFileUrl,
        url: project.briefFileUrl,
        provider: 'other',
        createdAt: project.createdAt || '',
      }];
    }
    return list;
  }, [project.files, project.briefFileName, project.briefFileUrl, project.createdAt]);

  const openFileAdd = () => {
    setFileAddStep('provider');
    setFileAddProvider('other');
    setFileAddLabel('');
    setFileAddUrl('');
    setFileAddOpen(true);
  };

  const chooseFileProvider = (provider: ProjectFileProvider) => {
    setFileAddProvider(provider);
    setFileAddStep('form');
  };

  const submitFileAdd = () => {
    const url = fileAddUrl.trim();
    if (!url) return;
    const label = fileAddLabel.trim() || url;
    const newLink: ProjectFileLink = {
      id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      label,
      url,
      provider: fileAddProvider,
      createdAt: new Date().toISOString(),
    };
    setProject((prev) => ({
      ...prev,
      files: [...(prev.files ?? []), newLink],
      // once the new list is used, the legacy single-file fields are no longer the source of truth
      briefFileName: prev.files?.length ? prev.briefFileName : null,
      briefFileUrl: prev.files?.length ? prev.briefFileUrl : null,
    }));
    setFileAddOpen(false);
  };

  const removeFileLink = (id: string) => {
    if (id === '__legacy__') {
      setProject((prev) => ({ ...prev, briefFileName: null, briefFileUrl: null }));
      return;
    }
    setProject((prev) => ({ ...prev, files: (prev.files ?? []).filter((f) => f.id !== id) }));
  };

  const FILE_PROVIDERS: Array<{ id: ProjectFileProvider; label: string; icon: React.ReactNode }> = [
    {
      id: 'google_drive',
      label: 'Google Drive',
      icon: (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#00ac47" d="M17.5 4 4 27.5l6.9 12L24.4 16z" />
          <path fill="#ffba00" d="M17.5 4h13l13 23.5H30.5z" />
          <path fill="#0066da" d="M10.9 39.5 4 27.5h27l6.9 12z" />
        </svg>
      ),
    },
    {
      id: 'onedrive',
      label: 'OneDrive',
      icon: (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#1490df" d="M11 22.5A8.5 8.5 0 0 0 12 39.4h26.5A7.6 7.6 0 0 0 40 24.7 9.7 9.7 0 0 0 21.3 20 8.5 8.5 0 0 0 11 22.5z" />
        </svg>
      ),
    },
    {
      id: 'other',
      label: 'Другое',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
        </svg>
      ),
    },
  ];

  const fileProviderIcon = (provider: ProjectFileProvider, size = 16) => {
    const opt = FILE_PROVIDERS.find((p) => p.id === provider) || FILE_PROVIDERS[2];
    return <span style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>{opt.icon}</span>;
  };

  // ---------------- Задачи и комментарии ----------------
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [showMentionsHint, setShowMentionsHint] = useState(false);
  const [mentionTargets, setMentionTargets] = useState<ProjectComment[]>([]);
  const projectRef = useRef<Project>(project);
  const commentsRef = useRef<ProjectComment[]>(comments);
  const tasksRef = useRef<ProjectTask[]>([]);
  const lastTasksSnapshotRef = useRef<string>('');
  const lastCommentsSnapshotRef = useRef<string>('');
  const saveSeqRef = useRef(0);

  // Поля для "Новой задачи" в верхней строке
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskStatus, setNewTaskStatus] =
    useState<ProjectTask['status']>('К выполнению');
  const [newTaskPriority, setNewTaskPriority] =
    useState<ProjectTask['priority']>('Обычный');
  const [newTaskDeadline, setNewTaskDeadline] = useState<string>('');
  const [taskAssigneesMenuId, setTaskAssigneesMenuId] = useState<string | null>(null);
  const [newAssigneesOpen, setNewAssigneesOpen] = useState(false);
  const [taskDragId, setTaskDragId] = useState<string | null>(null);
  const [taskDragOverId, setTaskDragOverId] = useState<string | null>(null);
  const taskAssigneesRef = useRef<HTMLDivElement | null>(null);
  const newAssigneesRef = useRef<HTMLDivElement | null>(null);

  const statusLabels = useMemo<Record<ProjectStatus, string>>(
    () => ({
      Новый: t('crm.projects.statuses.new'),
      'В работе': t('crm.projects.statuses.inProgress'),
      'На проверке': t('crm.projects.statuses.review'),
      Заморожен: t('crm.projects.statuses.paused'),
      Закрыт: t('crm.projects.statuses.closed'),
      Выиграно: t('crm.projects.statuses.won'),
      Проиграно: t('crm.projects.statuses.lost'),
    }),
    [t],
  );
  const { statuses: statusDefs, colorFor: statusColorFor } = useProjectStatuses();
  const availableStatuses: ProjectStatus[] = statusDefs.length
    ? statusDefs.map((s) => s.value)
    : PROJECT_STATUSES;
  const statusPillOptions = availableStatuses.map((st) => ({
    value: st,
    label: statusLabels[st] ?? st,
    color: statusColorFor(st),
  }));
  const { tags: tagDefs, colorFor: tagColorFor } = useProjectTagDefinitions();
  const { currencies: currencyDefs, defaultCode: defaultCurrencyCode } = useProjectCurrencyDefinitions();
  useEffect(() => {
    if (!isNew || !currencyDefs.length) return;
    setProject((prev) => (prev.currency === 'EUR' ? { ...prev, currency: defaultCurrencyCode() } : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, currencyDefs]);
  const taskStatusLabels = useMemo<Record<ProjectTask['status'], string>>(
    () => ({
      'К выполнению': t('crm.projects.detail.tasks.status.todo'),
      'В работе': t('crm.projects.detail.tasks.status.inProgress'),
      'На проверке': t('crm.projects.detail.tasks.status.review'),
      Заблокировано: t('crm.projects.detail.tasks.status.blocked'),
      Отложено: t('crm.projects.detail.tasks.status.deferred'),
      'Готово': t('crm.projects.detail.tasks.status.done'),
    }),
    [t],
  );
  const taskPriorityLabels = useMemo<Record<ProjectTask['priority'], string>>(
    () => ({
      Обычный: t('crm.projects.detail.tasks.priority.normal'),
      Высокий: t('crm.projects.detail.tasks.priority.high'),
      Низкий: t('crm.projects.detail.tasks.priority.low'),
    }),
    [t],
  );
  const activityLabels = useMemo<Record<string, string>>(
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
  const activityFieldLabels = useMemo<Record<string, string>>(
    () => {
      const map: Record<string, string> = {
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
        ownerUserIds: t('crm.projects.detail.history.managerField'),
        tasks: t('crm.projects.detail.history.fields.tasks'),
        'customFields.projectNotes': t('crm.projects.detail.notes.title'),
      };
      // Ключи кастомных полей резолвим динамически по схеме — не хардкодить каждый ключ.
      customFields.forEach((field) => {
        map[`customFields.${field.key}`] = field.label;
      });
      return map;
    },
    [t, customFields],
  );
  const formatCustomFieldHistoryValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') {
      return t('crm.projects.common.emptyValue');
    }
    const schema = customFields.find((f) => f.key === key);
    if (!schema) return formatHistoryValue(value);
    if (schema.type === 'boolean') {
      return value === true || value === 'true'
        ? t('crm.projects.list.boolean.yes', 'Да')
        : t('crm.projects.list.boolean.no', 'Нет');
    }
    if (schema.type === 'select') {
      const opt = schema.options?.find((o) => o.value === String(value));
      return opt?.label ?? String(value);
    }
    if (schema.type === 'multiselect') {
      const arr = Array.isArray(value) ? value : [value];
      return arr
        .map((v) => schema.options?.find((o) => o.value === String(v))?.label ?? String(v))
        .join(', ');
    }
    if (schema.type === 'daterange' && typeof value === 'object') {
      const rv = value as { start?: string; end?: string | null };
      const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale);
      if (rv.start && rv.end) return `${fmt(rv.start)} – ${fmt(rv.end)}`;
      if (rv.start) return `${t('crm.projects.list.datePicker.from', 'с')} ${fmt(rv.start)}`;
      return formatHistoryValue(value);
    }
    if (schema.type === 'date') {
      return new Date(`${value}T00:00:00`).toLocaleDateString(locale);
    }
    if (schema.type === 'datetime') {
      return new Date(String(value)).toLocaleString(locale);
    }
    return formatHistoryValue(value);
  };
  const formatHistoryValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return t('crm.projects.common.emptyValue');
    }
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  // getStoredUser() parses localStorage fresh every call — memoize so downstream
  // useMemo/useCallback/useEffect chains (mentions tracking) get a stable reference.
  const user = useMemo(() => getStoredUser(), []);
  const normalizeUser = (value?: string | null) =>
    (value ?? '').toString().trim().toLowerCase();
  const currentStaff = useMemo(
    () => staff.find((u) => u.id === user?.id || u.email === user?.email),
    [staff, user],
  );
  const currentLabels = useMemo(
    () =>
      [user?.name, user?.email, currentStaff?.fullName]
        .filter(Boolean)
        .map((v) => normalizeUser(v as string)),
    [user, currentStaff],
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
        <span key={`m-${idx}`} className="text-sky-600 font-medium">
          {part.text}
        </span>
      ) : (
        <span key={`t-${idx}`}>{part.text}</span>
      ),
    );
  // Сравниваем "@<полное ФИО или email>" подстрокой, а не токенизацией по пробелу —
  // иначе "@Иван Петров" обрежется на первом слове и никогда не совпадёт с ФИО целиком.
  const isMentioned = useCallback(
    (text: string) => isTextMentioning(text, currentLabels),
    [currentLabels],
  );
  const projectOwnerNames = useMemo(() => {
    const ownerIds = project.ownerUserIds?.length
      ? project.ownerUserIds
      : project.ownerUserId
        ? [project.ownerUserId]
        : [];
    const namesFromIds = ownerIds
      .map((id) => staff.find((u) => u.id === id)?.fullName)
      .filter(Boolean) as string[];
    const namesFromText = (project.owner ?? '')
      .split(/[,;/]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const names = namesFromIds.length ? namesFromIds : namesFromText;
    return names.map((value) => normalizeUser(value));
  }, [project.owner, project.ownerUserId, project.ownerUserIds, staff]);
  const isOwnerRole = user?.role === 'owner';
  const isProjectOwner = isOwnerRole
    ? true
    : (project.ownerUserIds?.includes(currentStaff?.id || '') ?? false) ||
      projectOwnerNames.some((name) => currentLabels.includes(name));
  const managerStaff = useMemo(
    () =>
      staff
        .filter(
          (u) =>
            u.isActive &&
            (u.role === 'owner' || u.role === 'manager' || u.role === 'sales'),
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [staff],
  );
  const ownerAssignableStaff = useMemo(() => {
    if (managerStaff.length) return managerStaff;
    return staff.filter((u) => u.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [managerStaff, staff]);
  const ownerDepartmentGroups = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();
    ownerAssignableStaff.forEach((u) => {
      const key = (u.department || '').trim() || t('crm.projects.detail.owner.noDepartment');
      const list = groups.get(key) || [];
      list.push(u);
      groups.set(key, list);
    });
    return Array.from(groups.entries())
      .map(([department, users]) => ({
        department,
        users: users.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)),
      }))
      .sort((a, b) => {
        if (a.department === t('crm.projects.detail.owner.noDepartment')) return 1;
        if (b.department === t('crm.projects.detail.owner.noDepartment')) return -1;
        return a.department.localeCompare(b.department, locale);
      });
  }, [ownerAssignableStaff, t, locale]);
  const projectNotes = useMemo(
    () => String(project.customFields?.projectNotes ?? ''),
    [project.customFields],
  );
  const projectPriority = useMemo(() => {
    const raw = String(project.customFields?.priority || '').trim();
    if (raw === 'Высокий' || raw === 'Низкий' || raw === 'Обычный') return raw;
    return 'Обычный';
  }, [project.customFields]);
  const amountHistory = useMemo(() => {
    return activities.flatMap((activity) => {
      const changes = Array.isArray((activity.payload as any)?.changes)
        ? ((activity.payload as any).changes as Array<any>)
        : [];
      return changes
        .filter((change) => change?.field === 'amount')
        .filter((change) => !historyValuesEqual('amount', change.from, change.to))
        .map((change) => ({
          id: `${activity.id}-${change.field}`,
          actor:
            activity.actorName ||
            activity.actorEmail ||
            t('crm.projects.detail.fallbacks.user'),
          at: activity.createdAt,
          from: change.from,
          to: change.to,
        }));
    });
  }, [activities, t]);
  const staffForTasks = managerStaff.length ? managerStaff : staff;
  const canEditTask = (task: ProjectTask) =>
    isOwnerRole ||
    isProjectOwner ||
    taskAssigneesMatchNormalizedLabels(task.assignees, staff, currentLabels);
  const isDoneStatus = (status?: string | null) => {
    if (!status) return false;
    const normalized = status.toString().trim().toLowerCase();
    return (
      normalized.includes('выполн') ||
      normalized.includes('готов') ||
      normalized.includes('done') ||
      normalized.includes('complete') ||
      normalized.includes('completed') ||
      normalized.includes('finished')
    );
  };
  const tasksDoneCount = useMemo(
    () => tasks.filter((task) => isDoneStatus(task.status)).length,
    [tasks],
  );
  const tasksCompletionPercent = tasks.length
    ? Math.round((tasksDoneCount / tasks.length) * 100)
    : 0;
  const nearestDeadlineTask = useMemo(() => {
    const withDeadline = tasks.filter((task) => !isDoneStatus(task.status) && task.deadline);
    if (!withDeadline.length) return null;
    return [...withDeadline].sort(
      (a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime(),
    )[0];
  }, [tasks]);
  const isTaskDeadlineLate = (task: ProjectTask) =>
    Boolean(task.deadline) && !isDoneStatus(task.status) && new Date(task.deadline as string).getTime() < Date.now();
  const selectedContact = useMemo(
    () => (project.contactId ? contacts.find((c) => c.id === project.contactId) || null : null),
    [contacts, project.contactId],
  );
  const linkedCompany = useMemo(() => {
    if (project.companyId) return companies.find((c) => c.id === project.companyId) || null;
    const lead = project.leadId ? allLeads.find((l) => l.id === project.leadId) : null;
    return lead?.companyId ? companies.find((c) => c.id === lead.companyId) || null : null;
  }, [companies, allLeads, project.companyId, project.leadId]);
  const resolveAssignees = (task: ProjectTask) =>
    (task.assignees || []).map(
      (entry) => resolveStaffForAssigneeEntry(staff, entry) || entry,
    );
  const normalizeTasks = (list: ProjectTask[]) =>
    list.map((task) => ({
      ...task,
      id: task.id || generateId('t'),
      assignees: task.assignees ?? [],
      checklist: (task.checklist ?? []).map((item) => ({
        ...item,
        id: item.id || generateId('c'),
        done: Boolean(item.done),
      })),
    }));
  const resolveSavedTasks = (
    savedTasks: ProjectTask[] | undefined,
    fallback: ProjectTask[],
  ) => {
    if (!Array.isArray(savedTasks) || savedTasks.length === 0) return fallback;
    if (savedTasks.some((task) => !task.id)) return fallback;
    if (savedTasks.length < fallback.length) return fallback;
    const savedIds = new Set(savedTasks.map((task) => task.id));
    const hasAllLocal = fallback.every((task) => savedIds.has(task.id));
    if (!hasAllLocal) return fallback;
    return savedTasks;
  };
  const categoryLabels = useMemo<Record<string, string>>(
    () => ({
      Аналитика: t('crm.projects.categories.analytics'),
      Разработка: t('crm.projects.categories.development'),
      Маркетинг: t('crm.projects.categories.marketing'),
      Реклама: t('crm.projects.categories.ads'),
      SEO: t('crm.projects.categories.seo'),
      SMM: t('crm.projects.categories.smm'),
    }),
    [t],
  );

  const formatHistoryFieldValue = (field: string, value: unknown) => {
    if (field.startsWith('customFields.')) {
      return formatCustomFieldHistoryValue(field.slice('customFields.'.length), value);
    }
    if (field === 'ownerUserIds') {
      const ids = Array.isArray(value)
        ? value.map((v) => String(v).trim()).filter(Boolean)
        : String(value ?? '')
            .split(/[,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
      if (ids.length === 0) return t('crm.projects.common.emptyValue');
      const names = ids
        .map((id) => staff.find((u) => u.id === id)?.fullName?.trim())
        .filter(Boolean) as string[];
      return names.length ? names.join(', ') : t('crm.projects.common.emptyValue');
    }
    if (field === 'ownerUserId') {
      const id = String(value ?? '').trim();
      if (!id) return t('crm.projects.common.emptyValue');
      return staff.find((u) => u.id === id)?.fullName?.trim() || t('crm.projects.common.emptyValue');
    }
    if (field === 'status') {
      const s = String(value ?? '');
      return statusLabels[s as ProjectStatus] ?? formatHistoryValue(value);
    }
    if (field === 'amount') {
      if (value === null || value === undefined || value === '') return t('crm.projects.common.emptyValue');
      const n = toNumberValue(value);
      if (n !== null) return n.toLocaleString(locale);
      return formatHistoryValue(value);
    }
    if (field === 'category') {
      const s = String(value ?? '');
      return categoryLabels[s] ?? formatHistoryValue(value);
    }
    if (field === 'tags') {
      const parts = Array.isArray(value)
        ? value.map((v) => String(v).trim()).filter(Boolean)
        : String(value ?? '')
            .split(/[,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
      return parts.join(', ');
    }
    return formatHistoryValue(value);
  };

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );

  const getCustomFieldValue = (field: CustomField) =>
    (project.customFields ?? {})[field.key];

  const setCustomFieldValue = (field: CustomField, value: any) => {
    setProject((prev) => ({
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
      <label className={lblCls} style={{ color: FG3 }}>
        {field.label}
        {field.required && <span className="text-rose-500 ml-1">*</span>}
      </label>
    );

    if (field.type === 'boolean') {
      return (
        <label
          key={field.id}
          className="flex items-center gap-2 text-xs text-neutral-700"
        >
          <input
            type="checkbox"
            className="lv-checkbox-input"
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
            className={inpCls + ' resize-y min-h-[80px]'}
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
            className={inpCls}
          >
            <option value="">
              {field.placeholder || t('crm.projects.detail.customFields.selectValue')}
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
            className={inpCls + ' min-h-[72px]'}
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

    if (field.type === 'date' || field.type === 'datetime' || field.type === 'daterange') {
      return (
        <div key={field.id}>
          {label}
          <DateFieldPicker
            type={field.type}
            value={value ?? null}
            onChange={(next) => setCustomFieldValue(field, next)}
            placeholder={field.placeholder || undefined}
          />
        </div>
      );
    }

    // email/phone привязанные к лиду/компании (meta.source) — то же значение, что и в таблице,
    // только для чтения: вводить его вручную тут не нужно, оно всегда из привязанной записи.
    if ((field.type === 'email' || field.type === 'phone') && (field.meta?.source === 'lead' || field.meta?.source === 'company')) {
      const lead = field.meta.source === 'lead' && project.leadId ? allLeads.find((l) => l.id === project.leadId) : null;
      const computed =
        (field.meta.source === 'lead'
          ? (field.type === 'email' ? lead?.email : lead?.phone)
          : (field.type === 'email' ? linkedCompany?.email : linkedCompany?.phone)) || '';
      return (
        <div key={field.id}>
          {label}
          <div className={inpCls + ' bg-neutral-50 text-neutral-500 cursor-default'}>
            {computed || t('crm.projects.common.emptyValue')}
          </div>
        </div>
      );
    }

    // email/phone без явного источника и url — те же данные, что и в таблице проектов: если
    // значение ещё не задано вручную, подставляем реальные данные проекта (лид/компания/файлы)
    // вместо пустого поля — дублировать их отдельным вводом незачем. Поле остаётся редактируемым:
    // подстановка — это только отображение, в customFields она не пишется, пока пользователь сам
    // не отредактирует поле.
    let autoValue: string | undefined;
    if (field.type === 'email') autoValue = project.leadEmail || linkedCompany?.email || undefined;
    else if (field.type === 'phone') {
      const lead = project.leadId ? allLeads.find((l) => l.id === project.leadId) : null;
      autoValue = lead?.phone || linkedCompany?.phone || undefined;
    } else if (field.type === 'url') {
      autoValue = project.files?.[0]?.url || undefined;
    }
    const effectiveValue = value ?? autoValue ?? '';

    const inputType =
      field.type === 'number'
        ? 'number'
        : field.type === 'email'
          ? 'email'
          : field.type === 'phone'
            ? 'tel'
            : field.type === 'url'
              ? 'url'
              : 'text';

    return (
      <div key={field.id}>
        {label}
        <input
          type={inputType}
          value={field.type === 'number' ? (value ?? '') : effectiveValue}
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
          className={inpCls}
        />
      </div>
    );
  };

  // ---------------- Загрузка проекта ----------------
  useEffect(() => {
    // если проект не загружен или ещё нет списка сотрудников — выходим
    if (!project || !project.id) return;
    if (!project.owner || project.ownerUserIds?.length) return;
    if (!staff.length) return;

    const rawOwners = project.owner
      .split(/[,;/]+/)
      .map((name) => name.trim())
      .filter(Boolean);
    const matchedIds = rawOwners
      .map((name) => staff.find((u) => u.fullName === name)?.id)
      .filter((id): id is string => Boolean(id));

    if (matchedIds.length) {
      setProject((prev) => ({
        ...prev,
        ownerUserIds: matchedIds,
        ownerUserId: matchedIds[0],
      }));
    }
  }, [project.id, project.owner, project.ownerUserIds, staff]);
  
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  
  useEffect(() => {
    let alive = true;

    if (isNew) {
      const empty = createEmptyProject();
      setProject(empty);
      const normalizedTasks = normalizeTasks(empty.tasks || []);
      setTasks(normalizedTasks);
      setComments(empty.comments || []);
      lastTasksSnapshotRef.current = JSON.stringify(normalizedTasks);
      lastCommentsSnapshotRef.current = JSON.stringify(empty.comments || []);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);

      fetchProject(id as string)
        .then((p) => {
          if (!alive) return;
          setProject(p);
          const cached = readProjectTasksCache(p.id);
          const source =
            (p.tasks && p.tasks.length > 0) ? p.tasks : cached ?? [];
          const normalizedTasks = normalizeTasks(source);
          setTasks(normalizedTasks);
          writeProjectTasksCache(p.id, normalizedTasks);
          lastTasksSnapshotRef.current = JSON.stringify(normalizedTasks);
          setComments(p.comments || []);
          lastCommentsSnapshotRef.current = JSON.stringify(p.comments || []);
        })
        .catch((e: any) => {
          if (!alive) return;
          console.error(e);
          setError(e.message || t('crm.projects.detail.errors.loadFailed'));
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
        });
    }

    // параллельно — список лидов, сотрудников, компаний и контактов
    Promise.all([
      fetchLeadsList(),
      fetchStaff(),
      fetchCompanies({ limit: 100 }),
      fetchContacts({ limit: 500 }),
    ])
      .then(([leads, users, companiesRes, contactsRes]) => {
        if (!alive) return;
        setAllLeads(leads.filter((lead) => !Boolean(lead.meta?.deleted)));
        setStaff(users);
        setCompanies(companiesRes.items);
        setContacts(contactsRes.items);
      })
      .catch((e) => {
        if (!alive) return;
        console.error('Project form data load error', e);
      });

    return () => {
      alive = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (isNew || !project.id) return;
    let alive = true;
    setActivitiesLoading(true);
    setActivitiesError(null);
    fetchProjectActivities(project.id)
      .then((items) => {
        if (!alive) return;
        setActivities(items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        console.error(e);
        setActivitiesError(e.message || t('crm.projects.detail.history.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setActivitiesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isNew, project.id, t]);

  useEffect(() => {
    let alive = true;
    setCustomFieldsLoading(true);
    setCustomFieldsError(null);
    fetchCustomFields('project')
      .then((items) => {
        if (!alive) return;
        const sorted = [...items].sort((a, b) => a.order - b.order);
        setCustomFields(sorted);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setCustomFieldsError(
          e.message || t('crm.projects.detail.customFields.loadFailed'),
        );
      })
      .finally(() => {
        if (!alive) return;
        setCustomFieldsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    if (!customFields.length) return;
    setProject((prev) => {
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

  useEffect(() => {
    if (!project.id || isNew) return;
    const key = `project_mentions_seen_${project.id}`;
    let seen: string[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) seen = JSON.parse(raw);
    } catch {
      // ignore
    }
    const targets = comments.filter((c) => {
      if (!isMentioned(c.text || '')) return false;
      return !seen.includes(c.id);
    });
    setMentionTargets(targets);
    setShowMentionsHint(targets.length > 0);
  }, [comments, isMentioned, isNew, project.id]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        newAssigneesOpen &&
        newAssigneesRef.current &&
        !newAssigneesRef.current.contains(target)
      ) {
        setNewAssigneesOpen(false);
      }
      if (
        taskAssigneesMenuId &&
        taskAssigneesRef.current &&
        !taskAssigneesRef.current.contains(target)
      ) {
        setTaskAssigneesMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [newAssigneesOpen, taskAssigneesMenuId]);

  const withLeadPresentation = useCallback(
    (nextProject: Project, source?: Project): Project => {
      if (!nextProject.leadId) {
        return {
          ...nextProject,
          leadName: null,
          leadEmail: null,
        };
      }
      const lead = allLeads.find((item) => item.id === nextProject.leadId);
      return {
        ...nextProject,
        leadName: source?.leadName ?? lead?.name ?? null,
        leadEmail: source?.leadEmail ?? lead?.email ?? null,
      };
    },
    [allLeads],
  );

  useEffect(() => {
    if (!project.leadId || !allLeads.length) return;
    const lead = allLeads.find((item) => item.id === project.leadId);
    if (!lead) return;
    setProject((prev) => {
      if (prev.leadId !== lead.id) return prev;
      const nextName = prev.leadName || lead.name || null;
      const nextEmail = prev.leadEmail || lead.email || null;
      if (nextName === prev.leadName && nextEmail === prev.leadEmail) return prev;
      return {
        ...prev,
        leadName: nextName,
        leadEmail: nextEmail,
      };
    });
  }, [allLeads, project.leadId]);

  // ---------------- Сохранение / удаление ----------------

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Project = {
        ...project,
        tasks,
        comments,
      };

      let saved: Project;
      if (isNew) {
        saved = await createProject(payload, { tableId: tableFromQuery || undefined });
      } else {
        saved = await updateProject(payload, {
          includeEmptyTasks: true,
          includeEmptyComments: true,
        });
      }
      setProject(withLeadPresentation(saved, payload));
      const resolvedTasks = normalizeTasks(resolveSavedTasks(saved.tasks, tasks));
      setTasks(resolvedTasks);
      // keep the auto-save debounce from re-PATCHing immediately after this manual save
      lastTasksSnapshotRef.current = JSON.stringify(resolvedTasks);
      writeProjectTasksCache(saved.id, resolvedTasks);
      setComments(saved.comments || []);
      lastCommentsSnapshotRef.current = JSON.stringify(saved.comments || []);
      if (isNew) {
        navigate(`/projects/${saved.id}`);
        showSuccess(t('crm.projects.detail.messages.created'));
      } else {
        showSuccess(t('crm.projects.detail.messages.saved'));
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.detail.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Статус меняется мгновенно (как на канбан-доске), а не только при клике на общий "Сохранить" —
  // раньше StatusPill только обновлял локальный state, и если пользователь не нажимал "Сохранить"
  // отдельно, смена статуса выглядела так, будто она вообще не применяется.
  const handleStatusChange = async (value: string) => {
    if (isNew || !project.id || project.id === 'new') {
      setProject((prev) => ({ ...prev, status: value as ProjectStatus }));
      return;
    }
    const prevStatus = project.status;
    if (prevStatus === value) return;
    setProject((prev) => ({ ...prev, status: value as ProjectStatus }));
    try {
      const updated = await changeProjectStatus(project.id, value as ProjectStatus);
      setProject((prev) => ({ ...prev, status: updated.status }));
    } catch (e: any) {
      console.error(e);
      setProject((prev) => ({ ...prev, status: prevStatus }));
      setError(e.message || t('crm.projects.detail.errors.saveFailed'));
    }
  };

  const persistTasks = useCallback(
    async (nextTasks: ProjectTask[], snapshot: string) => {
      if (isNew || saving) return;
      // projectRef can briefly lag behind the just-created project's real id right after
      // handleSave() navigates away from /projects/new — never PATCH against the "new" placeholder.
      if (!projectRef.current.id || projectRef.current.id === 'new') return;
      const payload: Project = {
        ...projectRef.current,
        tasks: nextTasks,
        comments: commentsRef.current,
      };
      const seq = (saveSeqRef.current += 1);
      try {
        const saved = await updateProject(payload, {
          includeEmptyTasks: true,
          includeEmptyComments: true,
          excludeStatus: true,
        });
        if (saveSeqRef.current !== seq) return;
        if (lastTasksSnapshotRef.current !== snapshot) {
          return;
        }
        const resolved = resolveSavedTasks(saved.tasks, nextTasks);
        setProject(withLeadPresentation(saved, payload));
        const normalized = normalizeTasks(resolved);
        setTasks(normalized);
        writeProjectTasksCache(saved.id, normalized);
        const nextComments = saved.comments || commentsRef.current;
        setComments(nextComments);
        lastCommentsSnapshotRef.current = JSON.stringify(nextComments);
      } catch (e: any) {
        console.error(e);
        setError(e.message || t('crm.projects.detail.errors.saveFailed'));
      }
    },
    [isNew, saving, t, withLeadPresentation],
  );

  useEffect(() => {
    if (isNew || loading) return;
    const snapshot = JSON.stringify(tasks);
    if (snapshot === lastTasksSnapshotRef.current) return;
    const timer = window.setTimeout(() => {
      lastTasksSnapshotRef.current = snapshot;
      persistTasks(tasks, snapshot);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [tasks, isNew, loading, persistTasks]);

  const handleDelete = async () => {
    if (isNew) {
      navigate('/projects');
      return;
    }
    const ok = await showConfirm(t('crm.projects.detail.confirmDelete'), {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      await deleteProject(project.id);
      navigate('/projects');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.detail.errors.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Свойства ----------------

  const handleChange =
    (field: keyof Project) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (field === 'amount') {
        const num = Number(value.replace(/\s/g, '') || 0);
        setProject((prev) => ({ ...prev, amount: num }));
      } else {
        setProject((prev) => ({ ...prev, [field]: value }));
      }
    };

  const toggleTag = (tag: string) => {
    setProject((prev) => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists
          ? prev.tags.filter((t) => t !== tag)
          : [...prev.tags, tag],
      };
    });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setProject((prev) => ({ ...prev, category: value }));
  };

  const handleLeadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const leadId = e.target.value || null;
    const lead = allLeads.find((l) => l.id === leadId);

    setProject((prev) => ({
      ...prev,
      leadId,
      leadName: lead ? lead.name : null,
      leadEmail: lead ? lead.email : null,
    }));
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const contactId = e.target.value || null;
    setProject((prev) => ({ ...prev, contactId }));
  };

  const setOwnerIds = (selectedIds: string[]) => {
    const uniqIds = Array.from(new Set(selectedIds));
    const names = ownerAssignableStaff
      .filter((u) => uniqIds.includes(u.id))
      .map((u) => u.fullName || u.email);
    setProject((prev) => ({
      ...prev,
      ownerUserIds: uniqIds,
      ownerUserId: uniqIds[0] ?? null,
      owner: names.length ? names.join(', ') : null,
    }));
  };
  const toggleOwnerUser = (userId: string, checked: boolean) => {
    const current = project.ownerUserIds || [];
    const next = checked
      ? [...current, userId]
      : current.filter((id) => id !== userId);
    setOwnerIds(next);
  };
  const toggleOwnerDepartment = (department: string, checked: boolean) => {
    const group = ownerDepartmentGroups.find((item) => item.department === department);
    if (!group) return;
    const ids = group.users.map((u) => u.id);
    const current = project.ownerUserIds || [];
    const next = checked
      ? Array.from(new Set([...current, ...ids]))
      : current.filter((id) => !ids.includes(id));
    setOwnerIds(next);
  };

  // ---------------- Задачи ----------------

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title || !isProjectOwner) return;
    const assigneesArr = normalizeAssigneesToStaffIds(newTaskAssignees, staff);

    const newTask: ProjectTask = {
      id: generateId('t'),
      title,
      assignees: assigneesArr,
      status: newTaskStatus,
      priority: newTaskPriority,
      deadline: newTaskDeadline || null,
      checklist: [],
    };

    setTasks((prev) => [...prev, newTask]);

    setNewTaskTitle('');
    setNewTaskAssignees([]);
    setNewTaskStatus('К выполнению');
    setNewTaskPriority('Обычный');
    setNewTaskDeadline('');
  };

  const updateTask =
    (taskId: string, field: keyof ProjectTask) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      const target = tasks.find((task) => task.id === taskId);
      if (!target || !canEditTask(target)) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                [field]:
                  field === 'assignees'
                    ? value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean)
                    : value,
              }
            : t,
        ),
      );
    };

  const setTaskStatus = (taskId: string, status: ProjectTask['status']) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
      );
    };

  const toggleTaskDone = (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    const next: ProjectTask['status'] = isDoneStatus(target.status)
      ? 'К выполнению'
      : 'Готово';
    setTaskStatus(taskId, next);
  };

  const reorderTasks = (fromId: string, toId: string) => {
    if (fromId === toId || !isProjectOwner) return;
    setTasks((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === fromId);
      const toIdx = prev.findIndex((t) => t.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });
  };


  const removeTask = (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const toggleTaskAssignee = (taskId: string, user: StaffUser) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              assignees: normalizeAssigneesToStaffIds(
                toggleTaskAssigneeIds(t.assignees, user),
                staff,
              ),
            }
          : t,
      ),
    );
  };

  // чек-лист в задаче
  const addChecklistItem = (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    const newItem: ProjectTaskChecklistItem = {
      id: generateId('c'),
      title: '',
      done: false,
    };
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, checklist: [...t.checklist, newItem] } : t,
      ),
    );
  };

  const updateChecklistTitle =
    (taskId: string, itemId: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const target = tasks.find((task) => task.id === taskId);
      if (!target || !canEditTask(target)) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                checklist: t.checklist.map((c) =>
                  c.id === itemId ? { ...c, title: value } : c,
                ),
              }
            : t,
        ),
      );
    };

  const toggleChecklistDone = (taskId: string, itemId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              checklist: task.checklist.map((c) =>
                c.id === itemId
                  ? {
                      ...c,
                      done: !c.done,
                      doneBy: !c.done
                        ? t('crm.projects.detail.fallbacks.user')
                        : undefined,
                      doneAt: !c.done
                        ? new Date().toLocaleDateString(locale)
                        : undefined,
                    }
                  : c,
              ),
            }
          : task,
      ),
    );
  };

  const removeChecklistItem = (taskId: string, itemId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, checklist: t.checklist.filter((c) => c.id !== itemId) }
          : t,
      ),
    );
  };

  // ---------------- Комментарии ----------------

  const addComment = () => {
    if (!newComment.trim()) return;
    const mentions = extractMentions(newComment.trim());
    const c: ProjectComment = {
      id: `cm${Date.now()}`,
      author: currentStaff?.fullName || user?.name || user?.email || t('crm.projects.detail.fallbacks.user'),
      createdAt: new Date().toLocaleString(locale),
      text: newComment.trim(),
      mentions,
    };
    setComments((prev) => [c, ...prev]);
    setNewComment('');
  };

  const addReply = (parentId: string) => {
    if (!replyText.trim()) return;
    const mentions = extractMentions(replyText.trim());
    const c: ProjectComment = {
      id: `cm${Date.now()}`,
      author: currentStaff?.fullName || user?.name || user?.email || t('crm.projects.detail.fallbacks.user'),
      createdAt: new Date().toLocaleString(locale),
      text: replyText.trim(),
      mentions,
      parentId,
    };
    setComments((prev) => [...prev, c]);
    setReplyText('');
    setReplyingToId(null);
  };

  const toggleCommentLike = (commentId: string) => {
    const me = currentStaff?.id || user?.id || user?.email;
    if (!me) return;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const likedBy = c.likedBy || [];
        return {
          ...c,
          likedBy: likedBy.includes(me)
            ? likedBy.filter((id) => id !== me)
            : [...likedBy, me],
        };
      }),
    );
  };

  // Автосохранение комментариев (новый комментарий/ответ/лайк) — независимо от задач,
  // иначе они сохраняются только при следующем сохранении проекта. Снапшот выставляется
  // при загрузке (см. lastCommentsSnapshotRef.current = ... рядом с каждым setComments
  // из сети), поэтому здесь мы не пере-инициализируем его лениво — иначе первая же
  // загрузка реальных комментариев с сервера воспринималась бы как "изменение".
  useEffect(() => {
    if (isNew || loading) return;
    const snapshot = JSON.stringify(comments);
    if (snapshot === lastCommentsSnapshotRef.current) return;
    const timer = window.setTimeout(() => {
      lastCommentsSnapshotRef.current = snapshot;
      if (!projectRef.current.id || projectRef.current.id === 'new') return;
      updateProject(
        { ...projectRef.current, tasks: tasksRef.current, comments },
        { includeEmptyTasks: true, includeEmptyComments: true, excludeStatus: true },
      )
        .then((saved) => {
          const nextComments = saved.comments || comments;
          lastCommentsSnapshotRef.current = JSON.stringify(nextComments);
          setComments(nextComments);
        })
        .catch((e: any) => {
          console.error(e);
        });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [comments, isNew, loading]);

  const handleBack = () => {
    navigate('/projects');
  };

  useEffect(() => {
    if (!emailOpen || emailAccounts.length > 0) return;
    fetchEmailAccounts()
      .then((accs) => {
        setEmailAccounts(accs);
        if (accs.length) setEmailAccountId(accs[0].id);
      })
      .catch((e) => console.error('email accounts load error', e));
  }, [emailOpen, emailAccounts.length]);

  const handleSendEmail = async () => {
    if (!emailAccountId || !emailTo.trim()) {
      setEmailError(t('crm.leads.form.email.errorNoRecipient'));
      return;
    }
    setEmailSending(true);
    setEmailError(null);
    try {
      await sendEmail({
        accountId: emailAccountId,
        to: [emailTo.trim()],
        subject: emailSubject.trim() || undefined,
        textBody: emailBody.trim() || undefined,
        leadId: project.leadId || undefined,
      });
      setEmailOpen(false);
      setEmailTo('');
      setEmailSubject('');
      setEmailBody('');
      showSuccess(t('crm.leads.form.email.sent'));
    } catch (e: any) {
      setEmailError(e.message || t('crm.leads.form.email.errorSend'));
    } finally {
      setEmailSending(false);
    }
  };

  const inlineInp: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 13,
    borderRadius: 10,
    border: `1px solid ${LINE}`,
    background: '#fff',
    color: INK,
    outline: 'none',
    boxSizing: 'border-box',
  };
  const lblInline: React.CSSProperties = {
    display: 'block',
    fontFamily: FM,
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: FG3,
    marginBottom: 6,
  };

  // ---------------- Рендер ----------------

  return (
    <MainLayout>
      <PageHelpButton topic="projectCard" />
      {successMessage && (
        <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs text-emerald-700 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="fixed top-4 right-4 z-[9999] rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs text-rose-600 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          {error}
        </div>
      )}

      <div className="pd-wrap">
        {/* header */}
        <div className="pd-head">
          <div className="pd-head-main">
            <button type="button" className="pd-kick" onClick={handleBack}>
              <span className="bar" style={{ background: statusColorFor(project.status) }} />
              {isNew
                ? t('crm.projects.detail.titleNew')
                : `${t('crm.projects.detail.back')} / ${t('crm.projects.detail.idKicker')} ${String(id || '').slice(0, 8).toUpperCase()}`}
            </button>
            <div className="pd-title">
              {editName ? (
                <input
                  className="pd-title-input"
                  autoFocus
                  value={project.name}
                  onChange={handleChange('name')}
                  onBlur={() => setEditName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditName(false)}
                />
              ) : (
                <h1 onClick={() => setEditName(true)}>
                  {project.name || t('crm.projects.detail.fallbacks.untitled')}
                </h1>
              )}
              <StatusPill
                big
                value={project.status}
                label={statusLabels[project.status] ?? project.status}
                color={statusColorFor(project.status)}
                options={statusPillOptions}
                onChange={handleStatusChange}
              />
            </div>
            <div className="pd-sub">
              {project.category && <span>{categoryLabels[project.category] ?? project.category}</span>}
              {project.category && <span className="dot" />}
              {linkedCompany && (
                <>
                  <span>
                    {t('crm.projects.detail.fields.company')}{' '}
                    <a
                      href={`/companies/${linkedCompany.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/companies/${linkedCompany.id}`);
                      }}
                    >
                      {linkedCompany.name}
                    </a>
                  </span>
                  <span className="dot" />
                </>
              )}
              {project.leadName && (
                <>
                  <span>
                    {t('crm.projects.detail.fields.leadName')} {project.leadName}
                  </span>
                  <span className="dot" />
                </>
              )}
              {!isNew && project.createdAt && (
                <span>
                  {t('crm.projects.detail.fields.createdAt')} {project.createdAt}
                </span>
              )}
            </div>
            {loading && (
              <div style={{ fontFamily: FM, fontSize: 11, color: FG4, marginTop: 8 }}>
                {t('crm.projects.detail.loading')}
              </div>
            )}
            {showMentionsHint && mentionTargets.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: `1px solid ${LINE}`,
                  background: BG_MUTED,
                  fontSize: 11,
                  color: FG2,
                }}
              >
                <span aria-hidden>🔔</span>
                {t('crm.projects.detail.mentions.notice', {
                  count: mentionTargets.length,
                })}
                <button
                  type="button"
                  onClick={() => {
                    const key = `project_mentions_seen_${project.id}`;
                    const seen = mentionTargets.map((c) => c.id);
                    localStorage.setItem(key, JSON.stringify(seen));
                    setShowMentionsHint(false);
                  }}
                  style={{
                    fontFamily: FM,
                    fontSize: 10,
                    color: FG3,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {t('crm.projects.detail.mentions.ok')}
                </button>
              </div>
            )}
          </div>
          <div className="pd-head-actions">
            {!isNew && project.updatedAt && (
              <span className="pd-saved">
                {t('crm.projects.detail.fields.updatedAt', 'Изменено')} {project.updatedAt}
              </span>
            )}
            {!isNew && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  navigate(`/projects/board${tableFromQuery ? `?table=${tableFromQuery}` : ''}`)
                }
              >
                {t('crm.projects.detail.actions.toBoard', 'В канбан')}
              </button>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
              {saving
                ? t('crm.projects.detail.actions.saving')
                : t('crm.projects.detail.actions.save')}
            </button>
            <DotsMenu
              items={[
                {
                  key: 'fields',
                  label: t('crm.projects.detail.customFields.configure'),
                  onClick: () => setCustomFieldsOpen(true),
                },
                ...(!isNew
                  ? [
                      {
                        key: 'delete',
                        label: t('crm.projects.detail.actions.delete'),
                        onClick: handleDelete,
                        danger: true,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </div>

        {!loading && (
          <>
            {/* metric strip */}
            <div className="pd-strip">
              <div className="pd-metric">
                <div className="l">{t('crm.projects.detail.metrics.budget')}</div>
                <div className="v">
                  <input
                    type="number"
                    className={'amt-input' + (canEditAmount ? '' : ' opacity-50 cursor-not-allowed')}
                    value={project.amount || ''}
                    onChange={handleChange('amount')}
                    disabled={!canEditAmount}
                    title={canEditAmount ? undefined : t('crm.projects.detail.fields.amountNoPermission') || undefined}
                  />
                  <span className="cur">{project.currency || 'EUR'}</span>
                </div>
              </div>
              <div className="pd-metric">
                <div className="l">{t('crm.projects.detail.metrics.taskProgress')}</div>
                <div className="v">
                  {tasksCompletionPercent}%<small>{tasksDoneCount} / {tasks.length}</small>
                </div>
                <div className="pd-bar">
                  <i style={{ width: `${tasksCompletionPercent}%` }} />
                </div>
              </div>
              <div className="pd-metric">
                <div className="l">{t('crm.projects.detail.metrics.urgency')}</div>
                <div className="v" style={{ fontSize: 16 }}>
                  {projectPriority === 'Высокий'
                    ? t('crm.projects.detail.priority.highUrgency')
                    : projectPriority === 'Низкий'
                      ? t('crm.projects.detail.priority.lowUrgency')
                      : t('crm.projects.detail.priority.normalUrgency')}
                </div>
                <div className="pd-urg">
                  {(['Низкий', 'Обычный', 'Высокий'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={projectPriority === u ? 'on' : undefined}
                      onClick={() =>
                        setProject((prev) => ({
                          ...prev,
                          customFields: { ...(prev.customFields ?? {}), priority: u },
                        }))
                      }
                    >
                      {u === 'Высокий'
                        ? t('crm.projects.detail.priority.highUrgency')
                        : u === 'Низкий'
                          ? t('crm.projects.detail.priority.lowUrgency')
                          : t('crm.projects.detail.priority.normalUrgency')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pd-metric">
                <div className="l">{t('crm.projects.detail.metrics.nearestDeadline', 'Ближайший дедлайн')}</div>
                <div className="v" style={{ fontSize: 16 }}>
                  {nearestDeadlineTask
                    ? new Date(nearestDeadlineTask.deadline as string).toLocaleDateString(locale)
                    : '—'}
                </div>
                {nearestDeadlineTask && (
                  <div className="pd-sub" style={{ marginTop: 6, fontSize: 11.5 }}>
                    {nearestDeadlineTask.title}
                  </div>
                )}
              </div>
            </div>

            {/* tabs */}
            <div className="pd-tabs">
              {(
                [
                  ['props', t('crm.projects.detail.tabs.props', 'Свойства'), null],
                  ['tasks', t('crm.projects.detail.tabs.tasks'), tasks.length],
                  ['comments', t('crm.projects.detail.tabs.comments'), comments.length],
                  ['history', t('crm.projects.detail.tabs.history'), activities.length],
                ] as const
              ).map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  className={tab === id ? 'pd-tab on' : 'pd-tab'}
                  onClick={() => setTab(id)}
                >
                  {label}
                  {n != null && <span className="n">{n}</span>}
                </button>
              ))}
            </div>

          <div className="pd-body">
            <div style={{ minWidth: 0 }}>
            {tab === 'props' && (
              <>
              {/* Название в форме */}
              <div style={{ marginBottom: 20 }}>
                <label className={lblCls} style={{ color: FG3 }}>
                  {t('crm.projects.detail.fields.name')}
                </label>
                <input
                  className={inpCls}
                  value={project.name}
                  onChange={handleChange('name')}
                  placeholder={t('crm.projects.detail.fields.name')}
                />
              </div>

              {!isNew && project.id && (
                <div style={{ marginBottom: 20 }}>
                  <JiraIssueLinkPanel entityType="project" entityId={project.id} defaultSummary={project.name} />
                </div>
              )}

          <Card title={t('crm.projects.detail.tabs.props', 'Свойства')}>
            <div className="pd-fields">
              <Field label={t('crm.projects.detail.fields.description')} wide>
                <textarea
                  value={project.description}
                  onChange={handleChange('description')}
                  placeholder={t('crm.projects.detail.fields.description')}
                  className="pd-area"
                />
              </Field>
              <Field label={t('crm.projects.detail.fields.category')}>
                <select value={project.category || ''} onChange={handleCategoryChange} className="pd-select">
                  <option value="">{t('crm.projects.detail.fields.category')}</option>
                  {PROJECT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {categoryLabels[cat] ?? cat}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('crm.projects.detail.fields.currency')}>
                <select
                  value={project.currency || 'EUR'}
                  onChange={(e) => setProject((prev) => ({ ...prev, currency: e.target.value }))}
                  className="pd-select"
                >
                  {(currencyDefs.length ? currencyDefs.map((c) => c.code) : [project.currency || 'EUR']).map(
                    (code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label={t('crm.projects.detail.fields.lead')}>
                <select value={project.leadId || ''} onChange={handleLeadChange} className="pd-select">
                  <option value="">{t('crm.projects.detail.fields.leadEmpty')}</option>
                  {allLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {(l.name || t('crm.projects.detail.fields.leadNameFallback')) +
                        (l.email ? ` · ${l.email}` : '')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('crm.projects.detail.fields.leadEmail')}>
                <input
                  className="pd-input"
                  value={project.leadEmail || ''}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, leadEmail: e.target.value || null }))
                  }
                  placeholder={t('crm.projects.detail.fields.leadEmail')}
                />
              </Field>
              <Field label={t('crm.projects.detail.fields.company')}>
                {linkedCompany ? (
                  <div className="pd-linkline">
                    <span>{linkedCompany.name}</span>
                    <button
                      type="button"
                      className="go"
                      onClick={() => navigate(`/companies/${linkedCompany.id}`)}
                    >
                      {t('crm.projects.detail.fields.open')}
                    </button>
                  </div>
                ) : (
                  <span className="pd-empty">{t('crm.projects.common.emptyValue')}</span>
                )}
              </Field>
              <Field label={t('crm.projects.detail.fields.contact')}>
                <select value={project.contactId || ''} onChange={handleContactChange} className="pd-select">
                  <option value="">{t('crm.projects.detail.fields.contactEmpty', 'Без контакта')}</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email) +
                        (c.email ? ` · ${c.email}` : '')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('crm.projects.detail.fields.tags')} wide>
                <div className="pd-chips">
                  {tagDefs.map((tag) => {
                    const active = project.tags.includes(tag.value);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.value)}
                        className="pd-chip"
                        style={
                          active
                            ? { background: tagColorFor(tag.value), color: '#fff', borderColor: tagColorFor(tag.value) }
                            : undefined
                        }
                      >
                        #{tag.value}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Card>

          <Card title={t('crm.projects.detail.notes.title')} hint={t('crm.projects.detail.notes.hint', 'видно только команде')} pad>
            <textarea
              className="pd-area"
              style={{ minHeight: 96, border: `1px solid ${LINE}`, margin: 0, width: '100%' }}
              value={projectNotes}
              onChange={(e) =>
                setProject((prev) => ({
                  ...prev,
                  customFields: { ...(prev.customFields ?? {}), projectNotes: e.target.value },
                }))
              }
              placeholder={t('crm.projects.detail.notes.placeholder')}
            />
          </Card>

            {/* Кастомные поля */}
            <Card
              title={t('crm.projects.detail.customFields.title')}
              action={
                <button type="button" className="btn btn-sm" onClick={() => setCustomFieldsOpen(true)}>
                  {t('crm.projects.detail.customFields.configure')}
                </button>
              }
              pad
            >
              {customFieldsError && (
                <div className="text-[11px] text-red-600">
                  {customFieldsError}
                </div>
              )}
              {customFieldsLoading && (
                <div className="text-[11px]" style={{ color: FG4 }}>
                  {t('crm.projects.detail.customFields.loading')}
                </div>
              )}
              {!customFieldsLoading && activeCustomFields.length === 0 && (
                <div className="text-[11px] italic" style={{ color: FG4 }}>
                  {t('crm.projects.detail.customFields.empty')}
                </div>
              )}
              {activeCustomFields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeCustomFields.map((field) =>
                    renderCustomFieldInput(field),
                  )}
                </div>
              )}
            </Card>
              </>
            )}
            {tab === 'tasks' && (
          <div
            className="rounded-3xl p-4 sm:p-5 space-y-4"
            style={{ border: `1px solid ${LINE}`, background: BG_MUTED }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', color: FG3 }}>
                  {t('crm.projects.detail.tasks.title')}
                </div>
                <div className="mt-1 text-[12px]" style={{ color: FG3 }}>
                  {tasks.filter((task) => isDoneStatus(task.status)).length}/
                  {tasks.length}
                  {tasks.length > 0 && (
                    <>
                      {' '}
                      ·{' '}
                      {Math.round(
                        (tasks.filter((task) => isDoneStatus(task.status)).length /
                          tasks.length) *
                          100,
                      )}
                      %
                    </>
                  )}
                </div>
              </div>
              {!isProjectOwner && (
                <div className="text-[11px] text-slate-500">
                  {t('crm.projects.detail.tasks.readOnly')}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-300/90 bg-slate-50 p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t('crm.projects.detail.tasks.newTitle')}
              </div>
              <div className="mt-2 flex gap-2">
                <div
                  className="mt-1.5 h-5 w-5 shrink-0 rounded border-2 border-slate-300 bg-white opacity-40"
                  aria-hidden
                />
                <input
                  placeholder={t('crm.projects.detail.tasks.newTitle')}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  disabled={!isProjectOwner}
                  className="flex-1 min-w-0 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/90 pt-3 pl-0 sm:pl-7">
                <div className="relative" ref={newAssigneesRef}>
                  <button
                    type="button"
                    onClick={() => setNewAssigneesOpen((prev) => !prev)}
                    disabled={!isProjectOwner}
                    className="min-w-[160px] rounded-lg border border-slate-300 bg-slate-200/90 px-3 py-2 text-left text-[12px] font-medium text-slate-800 shadow-sm outline-none hover:bg-slate-200 disabled:opacity-60 flex items-center justify-between gap-2"
                  >
                    <span>{t('crm.projects.detail.tasks.newAssignees')}</span>
                    <span className="text-[10px] text-slate-600">
                      {newTaskAssignees.length}
                    </span>
                  </button>
                  {newAssigneesOpen && (
                    <div className="absolute z-20 mt-2 w-60 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                      {staffForTasks.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
                        >
                          <input
                            type="checkbox"
                            className="lv-checkbox-input"
                            checked={newTaskAssignees.includes(u.id)}
                            onChange={() =>
                              setNewTaskAssignees((prev) =>
                                prev.includes(u.id)
                                  ? prev.filter((id) => id !== u.id)
                                  : [...prev, u.id],
                              )
                            }
                          />
                          <span className="text-xs text-slate-800">{u.fullName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={newTaskStatus}
                  onChange={(e) =>
                    setNewTaskStatus(e.target.value as ProjectTask['status'])
                  }
                  disabled={!isProjectOwner}
                  className="rounded-lg border border-slate-300 bg-slate-200/90 px-3 py-2 text-[12px] font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-lumiva-accent/30 disabled:opacity-60"
                >
                  {TASK_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {taskStatusLabels[status]}
                    </option>
                  ))}
                </select>
                <select
                  value={newTaskPriority}
                  onChange={(e) =>
                    setNewTaskPriority(e.target.value as ProjectTask['priority'])
                  }
                  disabled={!isProjectOwner}
                  className="rounded-lg border border-slate-300 bg-slate-200/90 px-3 py-2 text-[12px] font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-lumiva-accent/30 disabled:opacity-60"
                >
                  <option value="Обычный">{taskPriorityLabels.Обычный}</option>
                  <option value="Высокий">{taskPriorityLabels.Высокий}</option>
                  <option value="Низкий">{taskPriorityLabels.Низкий}</option>
                </select>
                <div style={{ width: 150 }}>
                  <DateFieldPicker
                    type="date"
                    value={newTaskDeadline || null}
                    onChange={(v) => setNewTaskDeadline((v as string) || '')}
                    disabled={!isProjectOwner}
                  />
                </div>
                <button
                  type="button"
                  onClick={addTask}
                  disabled={!isProjectOwner}
                  className="rounded-lg border border-lumiva-accent bg-lumiva-accent px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                >
                  {t('crm.projects.detail.tasks.add')}
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-300/90 bg-white shadow-sm">
              <ul className="divide-y divide-slate-200">
                {tasks.map((task) => {
                  const editable = canEditTask(task);
                  const assignees = resolveAssignees(task);
                  const done = isDoneStatus(task.status);
                  const hasMention = isMentioned(task.title || '');
                  const checklistTotal = task.checklist.length;
                  const checklistDone = task.checklist.filter((c) => c.done).length;
                  const taskCtl =
                    'rounded-lg border border-slate-300 bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-lumiva-accent/25 disabled:opacity-60';
                  return (
                    <li
                      key={task.id}
                      draggable={isProjectOwner}
                      onDragStart={(e) => {
                        if (!isProjectOwner) {
                          e.preventDefault();
                          return;
                        }
                        if (isProjectTaskRowDragBlockedTarget(e.target)) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.setData('text/plain', task.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setTaskDragId(task.id);
                      }}
                      onDragEnd={() => {
                        setTaskDragId(null);
                        setTaskDragOverId(null);
                      }}
                      className={`bg-white transition-colors hover:bg-slate-50/90 ${
                        isProjectOwner ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${
                        taskDragOverId === task.id &&
                        taskDragId &&
                        taskDragId !== task.id
                          ? 'ring-2 ring-inset ring-lumiva-accent/40'
                          : ''
                      } ${taskDragId === task.id ? 'opacity-60' : ''}`}
                      onDragOver={(e) => {
                        if (!isProjectOwner || !taskDragId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setTaskDragOverId(task.id);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setTaskDragOverId(null);
                        }
                      }}
                      onDrop={(e) => {
                        if (!isProjectOwner) return;
                        e.preventDefault();
                        const fromId = e.dataTransfer.getData('text/plain');
                        setTaskDragOverId(null);
                        setTaskDragId(null);
                        if (fromId) reorderTasks(fromId, task.id);
                      }}
                    >
                      <div className="flex items-start gap-2 px-3 py-3 sm:gap-3 sm:px-4">
                        <div
                          className="pointer-events-none mt-0.5 shrink-0 select-none pt-1 text-slate-400"
                          aria-hidden
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            aria-hidden
                          >
                            <circle cx="4" cy="4" r="1.25" />
                            <circle cx="4" cy="8" r="1.25" />
                            <circle cx="4" cy="12" r="1.25" />
                            <circle cx="9" cy="4" r="1.25" />
                            <circle cx="9" cy="8" r="1.25" />
                            <circle cx="9" cy="12" r="1.25" />
                          </svg>
                        </div>
                        <button
                          type="button"
                          draggable={false}
                          disabled={!editable}
                          onClick={() => toggleTaskDone(task.id)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors disabled:cursor-not-allowed ${
                            done
                              ? 'border-lumiva-accent bg-lumiva-accent text-white'
                              : 'border-slate-400 bg-white hover:border-slate-500'
                          }`}
                          aria-pressed={done}
                          title={taskStatusLabels[task.status]}
                        >
                          {done && (
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 12 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M2 6l3 3 5-6" />
                            </svg>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          {editable ? (
                            <input
                              draggable={false}
                              value={task.title}
                              onChange={updateTask(task.id, 'title')}
                              className={`w-full cursor-text border-0 bg-transparent text-[13px] font-medium outline-none ring-0 focus:ring-0 ${
                                done
                                  ? 'text-slate-400 line-through decoration-slate-400'
                                  : 'text-slate-900'
                              }`}
                            />
                          ) : (
                            <div
                              className={`text-sm font-semibold ${
                                done ? 'text-slate-400 line-through' : 'text-slate-900'
                              }`}
                            >
                              {task.title}
                            </div>
                          )}
                          {hasMention && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-sky-600">
                              <span>@</span>
                              {t('crm.projects.detail.mentions.inTask')}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {assignees.length ? (
                                assignees.map((owner) => {
                                  const label =
                                    typeof owner === 'string'
                                      ? owner
                                      : owner.fullName;
                                  const avatarUrl =
                                    typeof owner === 'string' ? null : owner.avatarUrl;
                                  return (
                                    <div
                                      key={label}
                                      className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-medium text-slate-700"
                                      title={label}
                                    >
                                      {avatarUrl ? (
                                        <img
                                          draggable={false}
                                          src={avatarUrl}
                                          alt={label}
                                          className="h-full w-full rounded-full object-cover"
                                        />
                                      ) : (
                                        label
                                          .split(' ')
                                          .filter(Boolean)
                                          .slice(0, 2)
                                          .map((p) => p[0])
                                          .join('')
                                          .toUpperCase()
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-[11px] text-slate-500">
                                  {t('crm.projects.common.emptyValue')}
                                </span>
                              )}
                              {editable && (
                                <div
                                  className="relative"
                                  ref={
                                    taskAssigneesMenuId === task.id
                                      ? taskAssigneesRef
                                      : null
                                  }
                                >
                                  <button
                                    type="button"
                                    draggable={false}
                                    onClick={() =>
                                      setTaskAssigneesMenuId((prev) =>
                                        prev === task.id ? null : task.id,
                                      )
                                    }
                                    className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-400 bg-slate-100 text-[13px] font-medium text-slate-700 hover:bg-slate-200"
                                    title={t('crm.projects.detail.tasks.newAssignees')}
                                  >
                                    +
                                  </button>
                                  {taskAssigneesMenuId === task.id && (
                                    <div
                                      className="absolute z-20 mt-2 w-60 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                                      data-no-task-drag
                                    >
                                      {staffForTasks.map((u) => (
                                        <label
                                          key={u.id}
                                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
                                        >
                                          <input
                                            type="checkbox"
                                            className="lv-checkbox-input"
                                            checked={isTaskAssigneeSelected(task.assignees, u)}
                                            onChange={() =>
                                              toggleTaskAssignee(task.id, u)
                                            }
                                          />
                                          <span className="text-xs text-slate-800">
                                            {u.fullName}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {editable ? (
                              <select
                                draggable={false}
                                value={task.status}
                                onChange={updateTask(task.id, 'status')}
                                className={taskCtl}
                              >
                                {TASK_STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {taskStatusLabels[status]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                                {taskStatusLabels[task.status]}
                              </span>
                            )}
                            {editable ? (
                              <select
                                draggable={false}
                                value={task.priority}
                                onChange={updateTask(task.id, 'priority')}
                                className={taskCtl}
                              >
                                <option value="Обычный">
                                  {taskPriorityLabels.Обычный}
                                </option>
                                <option value="Высокий">
                                  {taskPriorityLabels.Высокий}
                                </option>
                                <option value="Низкий">
                                  {taskPriorityLabels.Низкий}
                                </option>
                              </select>
                            ) : (
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                                {taskPriorityLabels[task.priority]}
                              </span>
                            )}
                            {editable ? (
                              <div style={{ width: 150 }}>
                                <DateFieldPicker
                                  type="date"
                                  value={task.deadline || null}
                                  onChange={(v) => {
                                    if (!canEditTask(task)) return;
                                    setTasks((prev) =>
                                      prev.map((t) => (t.id === task.id ? { ...t, deadline: (v as string) || null } : t)),
                                    );
                                  }}
                                />
                              </div>
                            ) : (
                              <span className={`pd-due${isTaskDeadlineLate(task) ? ' late' : ''}`}>
                                {task.deadline
                                  ? new Date(task.deadline).toLocaleDateString(locale)
                                  : t('crm.projects.common.emptyValue')}
                              </span>
                            )}
                            {checklistTotal > 0 && (
                              <span className="rounded-md border border-slate-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                                {checklistDone}/{checklistTotal}
                              </span>
                            )}
                            {editable && (
                              <button
                                type="button"
                                draggable={false}
                                className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-100"
                                onClick={() => addChecklistItem(task.id)}
                              >
                                {t('crm.projects.detail.tasks.checklist')}
                              </button>
                            )}
                            {editable && (
                              <button
                                type="button"
                                draggable={false}
                                className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-100"
                                onClick={() => removeTask(task.id)}
                              >
                                {t('crm.projects.detail.actions.remove')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {task.checklist.length > 0 && (
                        <div
                          className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 sm:px-4 sm:pl-[4.25rem]"
                          data-no-task-drag
                        >
                          <div className="space-y-1.5">
                            {task.checklist.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]"
                              >
                                <input
                                  type="checkbox"
                                  draggable={false}
                                  checked={c.done}
                                  onChange={() => toggleChecklistDone(task.id, c.id)}
                                  className="lv-checkbox-input"
                                  disabled={!editable}
                                />
                                <input
                                  draggable={false}
                                  value={c.title}
                                  onChange={updateChecklistTitle(task.id, c.id)}
                                  className="min-w-0 flex-1 border-0 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
                                  placeholder={t('crm.projects.detail.tasks.subtask')}
                                  disabled={!editable}
                                />
                                {editable && (
                                  <button
                                    type="button"
                                    draggable={false}
                                    className="shrink-0 rounded border border-transparent px-1.5 text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                                    onClick={() => removeChecklistItem(task.id, c.id)}
                                    aria-label={t('crm.projects.detail.actions.remove')}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {tasks.length === 0 && (
                <div className="px-4 py-8 text-center text-[12px] text-slate-500 italic">
                  {t('crm.projects.detail.tasks.empty')}
                </div>
              )}
            </div>
          </div>
            )}

            {tab === 'comments' && (
          <div
            className="rounded-3xl p-4 space-y-4"
            style={{ border: `1px solid ${LINE}`, background: '#fff' }}
          >
            <div className="space-y-3">
              {comments
                .filter((c) => !c.parentId)
                .map((c) => {
                  const replies = comments.filter((r) => r.parentId === c.id);
                  const me = currentStaff?.id || user?.id || user?.email || '';
                  const liked = !!me && (c.likedBy || []).includes(me);
                  const renderCommentBody = (comment: ProjectComment) => {
                    const mentions = comment.mentions ?? extractMentions(comment.text || '');
                    return (
                      <>
                        <div className="text-[11px] mb-1" style={{ color: FG3 }}>
                          {comment.createdAt} · {comment.author}
                        </div>
                        <div className="whitespace-pre-wrap text-[13px]">
                          {renderMentions(comment.text)}
                        </div>
                        {mentions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1 text-[11px]" style={{ color: FG3 }}>
                            {mentions.map((m) => (
                              <span
                                key={m}
                                className="inline-flex items-center rounded-full px-2 py-0.5 bg-white"
                                style={{ border: `1px solid ${LINE}` }}
                              >
                                @{m}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  };
                  return (
                    <div key={c.id}>
                      <div
                        className="rounded-2xl px-3 py-2 text-sm"
                        style={{ border: `1px solid ${LINE}`, background: BG_MUTED, color: INK }}
                      >
                        {renderCommentBody(c)}
                        <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: FG3 }}>
                          <button
                            type="button"
                            onClick={() => toggleCommentLike(c.id)}
                            className="inline-flex items-center gap-1"
                            style={{ color: liked ? '#dc2626' : FG3, cursor: 'pointer' }}
                          >
                            <span aria-hidden>{liked ? '♥' : '♡'}</span>
                            {(c.likedBy || []).length > 0 && (c.likedBy || []).length}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReplyingToId((prev) => (prev === c.id ? null : c.id))
                            }
                            style={{ color: FG3, cursor: 'pointer' }}
                          >
                            {t('crm.projects.detail.comments.reply', 'Ответить')}
                          </button>
                        </div>
                      </div>

                      {replies.length > 0 && (
                        <div className="mt-2 ml-5 space-y-2" style={{ borderLeft: `2px solid ${LINE}`, paddingLeft: 12 }}>
                          {replies.map((r) => {
                            const rLiked = !!me && (r.likedBy || []).includes(me);
                            return (
                              <div
                                key={r.id}
                                className="rounded-2xl px-3 py-2 text-sm"
                                style={{ border: `1px solid ${LINE}`, background: '#fff', color: INK }}
                              >
                                {renderCommentBody(r)}
                                <button
                                  type="button"
                                  onClick={() => toggleCommentLike(r.id)}
                                  className="mt-2 inline-flex items-center gap-1 text-[11px]"
                                  style={{ color: rLiked ? '#dc2626' : FG3, cursor: 'pointer' }}
                                >
                                  <span aria-hidden>{rLiked ? '♥' : '♡'}</span>
                                  {(r.likedBy || []).length > 0 && (r.likedBy || []).length}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {replyingToId === c.id && (
                        <div className="mt-2 ml-5 flex gap-2">
                          <input
                            autoFocus
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addReply(c.id)}
                            placeholder={t('crm.projects.detail.comments.replyPlaceholder', 'Ответ...')}
                            className={inpCls + ' flex-1'}
                          />
                          <button
                            type="button"
                            onClick={() => addReply(c.id)}
                            style={{
                              padding: '6px 14px',
                              fontSize: 12,
                              fontWeight: 500,
                              borderRadius: 8,
                              border: `1px solid ${INK}`,
                              background: INK,
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            {t('crm.projects.detail.actions.add')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {comments.length === 0 && (
                <div className="text-[11px] italic" style={{ color: FG4 }}>
                  {t('crm.projects.detail.comments.empty')}
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-2 relative" style={{ borderColor: LINE }}>
              <textarea
                ref={commentInputRef}
                value={newComment}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewComment(value);
                  const caret = e.target.selectionStart ?? value.length;
                  const before = value.slice(0, caret);
                  const match = before.match(/@([\p{L}\p{N}._-]*)$/u);
                  setMentionQuery(match ? match[1] : null);
                }}
                onBlur={() => window.setTimeout(() => setMentionQuery(null), 150)}
                placeholder={t('crm.projects.detail.comments.newPlaceholder')}
                rows={3}
                className={inpCls + ' resize-y min-h-[80px]'}
              />
              {mentionQuery !== null && (() => {
                const q = mentionQuery.toLowerCase();
                const matches = staff
                  .filter((u) => u.fullName?.toLowerCase().includes(q))
                  .slice(0, 6);
                if (!matches.length) return null;
                return (
                  <div
                    className="absolute z-20 mt-1 w-64 max-h-56 overflow-auto rounded-xl bg-white shadow-lg p-1"
                    style={{ border: `1px solid ${LINE}`, top: '100%' }}
                  >
                    {matches.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          const el = commentInputRef.current;
                          const caret = el?.selectionStart ?? newComment.length;
                          const before = newComment.slice(0, caret);
                          const after = newComment.slice(caret);
                          const replaced = before.replace(/@([\p{L}\p{N}._-]*)$/u, `@${u.fullName} `);
                          const next = replaced + after;
                          setNewComment(next);
                          setMentionQuery(null);
                          requestAnimationFrame(() => {
                            el?.focus();
                            const pos = replaced.length;
                            el?.setSelectionRange(pos, pos);
                          });
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-slate-50"
                      >
                        <span className="font-medium" style={{ color: INK }}>{u.fullName}</span>
                        <span className="text-[10px]" style={{ color: FG4 }}>{u.email}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={addComment}
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: `1px solid ${INK}`,
                  background: INK,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {t('crm.projects.detail.actions.add')}
              </button>
            </div>

          </div>
            )}

            {tab === 'history' && (
          <div
            className="rounded-3xl p-4 space-y-4"
            style={{ border: `1px solid ${LINE}`, background: '#fff' }}
          >
            {!!activities.length && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-xl px-3 py-2 bg-white" style={{ border: `1px solid ${LINE}` }}>
                  <div className="text-[10px]" style={{ color: FG3 }}>
                    {t('crm.projects.detail.history.summary.events')}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: INK }}>
                    {activities.length}
                  </div>
                </div>
                <div className="rounded-xl px-3 py-2 bg-white" style={{ border: `1px solid ${LINE}` }}>
                  <div className="text-[10px]" style={{ color: FG3 }}>
                    {t('crm.projects.detail.history.summary.amountChanges')}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: INK }}>
                    {amountHistory.length}
                  </div>
                </div>
                <div className="rounded-xl px-3 py-2 bg-white" style={{ border: `1px solid ${LINE}` }}>
                  <div className="text-[10px]" style={{ color: FG3 }}>
                    {t('crm.projects.detail.history.summary.lastUpdate')}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: INK }}>
                    {new Date(activities[0]?.createdAt).toLocaleString(locale)}
                  </div>
                </div>
              </div>
            )}
            {!!amountHistory.length && (
              <div
                className="rounded-2xl p-3 space-y-1.5"
                style={{ border: `1px solid ${LINE}`, background: BG_MUTED }}
              >
                <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', color: FG3 }}>
                  {t('crm.projects.detail.history.amountTitle')}
                </div>
                {amountHistory.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="text-[11px]" style={{ color: FG2 }}>
                    {new Date(entry.at).toLocaleString(locale)} · {entry.actor}:{' '}
                    <span style={{ color: FG3 }}>{formatHistoryFieldValue('amount', entry.from)}</span> →{' '}
                    <span style={{ color: INK }}>{formatHistoryFieldValue('amount', entry.to)}</span>
                  </div>
                ))}
              </div>
            )}
            {activitiesLoading && (
              <div className="text-[11px]" style={{ color: FG4 }}>
                {t('crm.projects.detail.history.loading')}
              </div>
            )}
            {activitiesError && (
              <div className="text-[11px] text-rose-600">{activitiesError}</div>
            )}
            {!activitiesLoading && !activities.length && (
              <div className="text-[11px] italic" style={{ color: FG4 }}>
                {t('crm.projects.detail.history.empty')}
              </div>
            )}
            <div className="space-y-2">
              {activities.map((activity) => {
                const label = activityLabels[activity.action] ?? activity.action;
                const actor =
                  activity.actorName || activity.actorEmail || t('crm.projects.detail.fallbacks.user');
                const changesRaw = activity.payload?.changes ?? [];
                const changes = changesRaw.filter(
                  (c: { field?: string; from?: unknown; to?: unknown }) =>
                    c?.field &&
                    !historyValuesEqual(c.field, c.from, c.to) &&
                    !(activity.action === 'status_change' && c.field === 'status'),
                );
                const statusPayload = activity.payload as { from?: unknown; to?: unknown } | undefined;
                const showStatusDiff =
                  activity.action === 'status_change' &&
                  statusPayload &&
                  !historyValuesEqual('status', statusPayload.from, statusPayload.to);
                return (
                  <div
                    key={activity.id}
                    className="rounded-2xl px-3 py-2 text-sm"
                    style={{ border: `1px solid ${LINE}`, background: BG_MUTED, color: INK }}
                  >
                    <div className="text-[11px] mb-1" style={{ color: FG3 }}>
                      {new Date(activity.createdAt).toLocaleString(locale)} · {actor}
                    </div>
                    <div className="text-[12px] font-semibold">{label}</div>
                    {showStatusDiff && (
                      <div className="text-[11px] mt-1" style={{ color: FG3 }}>
                        {formatHistoryFieldValue('status', statusPayload.from)} →{' '}
                        {formatHistoryFieldValue('status', statusPayload.to)}
                      </div>
                    )}
                    {changes.length > 0 && (
                      <div className="mt-2 space-y-1 text-[11px]" style={{ color: FG2 }}>
                        {changes.map((change: any, idx: number) => (
                          <div key={`${change.field}-${idx}`}>
                            <span style={{ color: FG3 }}>
                              {activityFieldLabels[change.field] ?? change.field}:
                            </span>{' '}
                            <span>{formatHistoryFieldValue(change.field, change.from)}</span> →{' '}
                            <span>{formatHistoryFieldValue(change.field, change.to)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
            )}
            </div>

            <div className="pd-rail">
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 12 }}>
                  {t('crm.leads.form.sections.actionsTitle')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    {
                      key: 'email',
                      label: t('crm.leads.form.actions.email'),
                      onClick: () => {
                        setEmailTo(project.leadEmail || '');
                        setEmailOpen(true);
                      },
                      svg: (
                        <>
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="M3 7l9 6 9-6" />
                        </>
                      ),
                    },
                    {
                      key: 'meeting',
                      label: t('crm.leads.form.actions.meeting'),
                      onClick: () => setCalendarModal('meeting'),
                      svg: (
                        <>
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M3 10h18M8 2v4M16 2v4" />
                        </>
                      ),
                    },
                    {
                      key: 'task',
                      label: t('crm.leads.form.actions.task'),
                      onClick: () => setCalendarModal('note'),
                      svg: (
                        <>
                          <path d="M9 11l3 3L22 4" />
                          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                        </>
                      ),
                    },
                    {
                      key: 'auto',
                      label: t('crm.leads.form.actions.automation'),
                      onClick: () => navigate('/automations'),
                      svg: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
                    },
                  ].map(({ key, label, onClick, svg }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={onClick}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        padding: '12px 8px',
                        border: `1px solid ${LINE}`,
                        borderRadius: 10,
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: 11,
                        color: FG2,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = INK;
                        e.currentTarget.style.color = INK;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = LINE;
                        e.currentTarget.style.color = FG2;
                      }}
                    >
                      <svg
                        width={18}
                        height={18}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {svg}
                      </svg>
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => navigate('/integrations-hub')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '12px 8px',
                      border: `1px solid ${LINE}`,
                      borderRadius: 10,
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: FG2,
                      transition: 'all 0.15s',
                      gridColumn: 'span 2',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = INK;
                      e.currentTarget.style.color = INK;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = LINE;
                      e.currentTarget.style.color = FG2;
                    }}
                  >
                    <svg
                      width={18}
                      height={18}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7L11 7" />
                      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7L13 17" />
                    </svg>
                    {t('crm.leads.form.actions.integrations')}
                  </button>
                </div>
              </div>

              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontFamily: FM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 12 }}>
                  {t('crm.projects.detail.owner.byDepartment')}
                </div>
                <div style={{ fontFamily: FM, fontSize: 10, color: FG4, marginBottom: 8 }}>
                  {t('crm.projects.detail.owner.selected', {
                    count: (project.ownerUserIds || []).length,
                  })}
                </div>
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {ownerDepartmentGroups.map((group) => {
                    const groupIds = group.users.map((u) => u.id);
                    const selectedInGroup = groupIds.filter((id) =>
                      (project.ownerUserIds || []).includes(id),
                    ).length;
                    const allChecked = selectedInGroup > 0 && selectedInGroup === groupIds.length;
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
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div style={{ fontSize: 11, fontWeight: 600, color: INK }} className="truncate">
                            {group.department}
                          </div>
                          <label className="flex items-center gap-1 text-[10px]" style={{ color: FG3 }}>
                            <input
                              type="checkbox"
                              className="lv-checkbox-input"
                              checked={allChecked}
                              disabled={!canEditOwner}
                              onChange={(e) =>
                                toggleOwnerDepartment(group.department, e.target.checked)
                              }
                            />
                            {t('crm.projects.detail.owner.wholeDepartment')}
                          </label>
                        </div>
                        <div className="space-y-1">
                          {group.users.map((u) => {
                            const checked = (project.ownerUserIds || []).includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className="flex items-center gap-2 text-[11px]"
                                style={{ color: FG2 }}
                              >
                                <input
                                  type="checkbox"
                                  className="lv-checkbox-input"
                                  checked={checked}
                                  disabled={!canEditOwner}
                                  onChange={(e) => toggleOwnerUser(u.id, e.target.checked)}
                                />
                                <span className="truncate">
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

              <div className="pd-rail-card">
                <h4>{t('crm.projects.detail.relations.title', 'Связи')}</h4>
                <div className="pd-rail-body">
                  <div className="pd-kv">
                    <span className="k">{t('crm.projects.detail.fields.company')}</span>
                    <span className="v">
                      {linkedCompany ? (
                        <a
                          href={`/companies/${linkedCompany.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/companies/${linkedCompany.id}`);
                          }}
                        >
                          {linkedCompany.name}
                        </a>
                      ) : (
                        t('crm.projects.common.emptyValue')
                      )}
                    </span>
                  </div>
                  <div className="pd-kv">
                    <span className="k">{t('crm.projects.detail.fields.contact')}</span>
                    <span className="v">
                      {selectedContact ? (
                        <a
                          href={`/contacts/${selectedContact.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/contacts/${selectedContact.id}`);
                          }}
                        >
                          {selectedContact.fullName ||
                            [selectedContact.firstName, selectedContact.lastName].filter(Boolean).join(' ') ||
                            selectedContact.email}
                        </a>
                      ) : (
                        t('crm.projects.common.emptyValue')
                      )}
                    </span>
                  </div>
                  <div className="pd-kv">
                    <span className="k">{t('crm.projects.detail.fields.lead')}</span>
                    <span className="v">{project.leadName || t('crm.projects.common.emptyValue')}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="k">{t('crm.projects.detail.fields.leadEmail')}</span>
                    <span className="v">{project.leadEmail || t('crm.projects.common.emptyValue')}</span>
                  </div>
                </div>
              </div>

              <div className="pd-rail-card">
                <h4>{t('crm.projects.detail.files.title')}</h4>
                <div className="pd-rail-body" style={{ gap: 0 }}>
                  {displayedFiles.map((f) => (
                    <div key={f.id} className="pd-file">
                      {fileProviderIcon(f.provider, 14)}
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="nm"
                        title={f.url}
                      >
                        {f.label}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeFileLink(f.id)}
                        style={{ background: 'none', border: 0, color: FG4, cursor: 'pointer', flexShrink: 0 }}
                        aria-label={t('crm.projects.detail.actions.remove')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="relative" ref={fileAddRef} style={{ marginTop: 10 }}>
                    <button type="button" className="pd-addrow" onClick={openFileAdd}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      {t('crm.projects.detail.files.addLink', 'Добавить ссылку')}
                    </button>
                    {fileAddOpen && fileAddStep === 'provider' && (
                      <div
                        className="absolute z-30 mt-1.5 rounded-xl border bg-white p-1.5 shadow-lg"
                        style={{ borderColor: LINE, left: 0, right: 0, width: 'auto' }}
                      >
                        {FILE_PROVIDERS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => chooseFileProvider(p.id)}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-neutral-800 hover:bg-neutral-50 transition-colors text-left"
                          >
                            {p.icon}
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {fileAddOpen && fileAddStep === 'form' && (
                      <div
                        className="absolute z-30 mt-1.5 rounded-xl border bg-white p-3 shadow-lg space-y-2"
                        style={{ borderColor: LINE, left: 0, right: 0, width: 'auto' }}
                      >
                        <div className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                          <button
                            type="button"
                            onClick={() => setFileAddStep('provider')}
                            className="text-neutral-400 hover:text-neutral-700"
                            aria-label="Назад"
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 3.5L5 8l5 4.5" /></svg>
                          </button>
                          {fileProviderIcon(fileAddProvider)}
                          {FILE_PROVIDERS.find((p) => p.id === fileAddProvider)?.label}
                        </div>
                        <input
                          autoFocus
                          value={fileAddUrl}
                          onChange={(e) => setFileAddUrl(e.target.value)}
                          placeholder={t('crm.projects.detail.files.urlPlaceholder', 'Ссылка на файл')}
                          className={inpCls}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitFileAdd(); }}
                        />
                        <input
                          value={fileAddLabel}
                          onChange={(e) => setFileAddLabel(e.target.value)}
                          placeholder={t('crm.projects.detail.files.namePlaceholder', 'Название (например, ТЗ по сайту)')}
                          className={inpCls}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitFileAdd(); }}
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setFileAddOpen(false)}
                            className="text-xs text-neutral-500 hover:text-neutral-800 px-2 py-1.5"
                          >
                            {t('crm.common.cancel', 'Отмена')}
                          </button>
                          <button
                            type="button"
                            onClick={submitFileAdd}
                            disabled={!fileAddUrl.trim()}
                            className="text-xs font-medium text-white bg-neutral-900 rounded-lg px-3 py-1.5 disabled:opacity-40"
                          >
                            {t('crm.common.add', 'Добавить')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pd-rail-card">
                <h4>{t('crm.projects.detail.fields.tags')}</h4>
                <div className="pd-rail-body">
                  <div className="pd-chips">
                    {project.tags.map((tag) => (
                      <span key={tag} className="pd-chip">
                        #{tag}
                      </span>
                    ))}
                    {project.tags.length === 0 && (
                      <span className="pd-empty">{t('crm.projects.common.emptyValue')}</span>
                    )}
                  </div>
                  {!isNew && (
                    <>
                      <div className="pd-kv">
                        <span className="k">{t('crm.projects.detail.fields.createdAt')}</span>
                        <span className="v">{project.createdAt}</span>
                      </div>
                      {project.updatedAt && (
                        <div className="pd-kv">
                          <span className="k">{t('crm.projects.detail.fields.updatedAt', 'Изменено')}</span>
                          <span className="v">{project.updatedAt}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
          </>
        )}
      </div>

        {customFieldsOpen && (
          <CustomFieldsManager
            entityType="project"
            title={t('crm.projects.detail.customFields.managerTitle')}
            suggestedKeys={suggestedKeys}
            onClose={() => setCustomFieldsOpen(false)}
            onUpdated={(items) => {
              const sorted = [...items].sort((a, b) => a.order - b.order);
              setCustomFields(sorted);
            }}
          />
        )}

        {emailOpen && createPortal(
          <div
            className="fixed inset-0 z-[8500] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                width: '100%',
                maxWidth: 560,
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 30px 80px rgba(0,0,0,0.20)',
                fontFamily: FF,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '18px 24px',
                  borderBottom: `1px solid ${LINE}`,
                }}
              >
                <h3 style={{ fontFamily: FF, fontSize: 17, fontWeight: 500, color: INK }}>
                  {t('crm.leads.form.email.title')}
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEmailOpen(false)}
                    style={{
                      padding: '7px 16px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: `1px solid ${LINE}`,
                      background: '#fff',
                      color: FG2,
                      cursor: 'pointer',
                    }}
                  >
                    {t('crm.common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={emailSending}
                    style={{
                      padding: '7px 16px',
                      fontSize: 13,
                      fontWeight: 500,
                      borderRadius: 8,
                      border: `1px solid ${INK}`,
                      background: INK,
                      color: '#fff',
                      cursor: 'pointer',
                      opacity: emailSending ? 0.65 : 1,
                    }}
                  >
                    {emailSending ? t('crm.leads.form.email.sending') : t('crm.leads.form.email.send')}
                  </button>
                </div>
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={lblInline}>{t('crm.leads.form.email.title').toUpperCase()}</label>
                  {emailAccounts.length === 0 ? (
                    <div style={{ fontSize: 12, color: FG4, fontStyle: 'italic' }}>
                      {t('crm.leads.form.email.noAccounts')}{' '}
                      <a href="/email" style={{ color: INK }}>
                        {t('crm.leads.form.email.connectAccounts')}
                      </a>
                    </div>
                  ) : (
                    <select
                      value={emailAccountId}
                      onChange={(e) => setEmailAccountId(e.target.value)}
                      style={inlineInp}
                    >
                      {emailAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.email}
                          {acc.name ? ` · ${acc.name}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label style={lblInline}>{t('crm.leads.form.email.to').toUpperCase()}</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="email@..."
                    style={inlineInp}
                  />
                </div>
                <div>
                  <label style={lblInline}>{t('crm.leads.form.email.subject').toUpperCase()}</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    style={inlineInp}
                  />
                </div>
                <div>
                  <label style={lblInline}>{t('crm.leads.form.email.body').toUpperCase()}</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={10}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 13,
                      border: `1px solid ${LINE}`,
                      borderRadius: 10,
                      background: '#fff',
                      color: INK,
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: 200,
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                {emailError && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#ef4444',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                    }}
                  >
                    {emailError}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

        {calendarModal && (
          <CalendarEntryModal
            initialKind={calendarModal}
            preselectedLeadId={project.leadId || undefined}
            preselectedLeadName={project.leadName || undefined}
            onClose={() => setCalendarModal(null)}
            onSaved={() => {
              showSuccess(
                calendarModal === 'meeting'
                  ? t('crm.leads.form.messages.meetingCreated')
                  : t('crm.leads.form.messages.noteCreated'),
              );
            }}
          />
        )}
    </MainLayout>
  );
};
