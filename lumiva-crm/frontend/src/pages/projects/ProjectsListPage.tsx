// src/pages/projects/ProjectsListPage.tsx

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ProjectsListPage.css';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import type { Project, ProjectFileLink, ProjectStatus, ProjectTask } from './projectTypes';
import {
  archiveProject,
  deleteProject,
  fetchProject,
  fetchProjects,
  updateProject,
} from '../../api/projects';
import { fetchLeadsList, fetchLeadById } from '../../api/leads';
import type { Lead } from '../../api/leads';
import { fetchCompanies, fetchCompany, type Company } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useTranslation } from 'react-i18next';
import {
  createCustomField,
  fetchCustomFields,
  normalizeCustomFieldKey,
  type CustomField,
  type FieldType,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { AutomationPanel } from '../../components/AutomationPanel';
import { ProjectsViewsBar } from './ProjectsViewsBar';
import type { ProjectTable } from '../../api/projectTables';
import type { ProjectsRowDensity } from './projectsViewSettings';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';
import { WorkspaceCrmEntityMultiField } from '../../components/workspace/WorkspaceCrmEntityMultiField';
import { parseCrmEntityIdsFromCell } from '../../workspace/workspaceCrmEntityIds';
import { getFixedPopoverLayout, type FixedPopoverLayout } from '../../utils/tablePopoverFixedPosition';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { postAiGenerateProjectTasks, type AiGeneratedTask, type AiGeneratedField } from '../../api/ai';
import { LottieIcon } from '../../components/LottieIcon';
import { useProjectStatuses, pillStyleFromHex } from './useProjectStatuses';
import { useProjectCurrencyDefinitions } from './useProjectCurrencyDefinitions';
import {
  assigneeEntryDisplayLabel,
  normalizeAssigneesToStaffIds,
  resolveStaffForAssigneeEntry,
} from './taskAssignees';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

type ProjectListColumn =
  | { id: string; label: string }
  | { id: string; label: string; field: CustomField };

const COLUMN_TYPE_OPTIONS: Array<{
  value: FieldType;
  label: string;
  hint: string;
  color: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'text',
    label: 'Текст',
    hint: 'Короткая строка',
    color: '#6366f1',
    icon: <path d="M3 4h10M3 8h10M3 12h6" />,
  },
  {
    value: 'textarea',
    label: 'Многострочный текст',
    hint: 'Длинный текст, заметки',
    color: '#8b5cf6',
    icon: <path d="M3 3.2h10M3 6.5h10M3 9.8h10M3 13h6" />,
  },
  {
    value: 'number',
    label: 'Число',
    hint: 'Сумма, количество',
    color: '#f59e0b',
    icon: <path d="M5 3L4 13M12 3l-1 10M2.5 6h11M2 10h11" />,
  },
  {
    value: 'email',
    label: 'Email',
    hint: 'Электронная почта',
    color: '#0ea5e9',
    icon: (
      <>
        <rect x="2" y="4" width="12" height="8" rx="1" />
        <path d="M2.5 4.7l5.5 4 5.5-4" />
      </>
    ),
  },
  {
    value: 'phone',
    label: 'Телефон',
    hint: 'Номер телефона',
    color: '#10b981',
    icon: (
      <path d="M4 3c-.6 0-1 .4-1 1 0 5 4 9 9 9 .6 0 1-.4 1-1v-1.6c0-.5-.3-.9-.8-1l-1.8-.4c-.4-.1-.8 0-1.1.3l-.6.7c-1.4-.7-2.6-1.8-3.3-3.3l.7-.6c.3-.3.4-.7.3-1.1l-.4-1.8c-.1-.5-.5-.8-1-.8H4z" />
    ),
  },
  {
    value: 'date',
    label: 'Дата',
    hint: 'Дедлайн, событие',
    color: '#f97316',
    icon: (
      <>
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" />
        <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
      </>
    ),
  },
  {
    value: 'datetime',
    label: 'Дата и время',
    hint: 'С точным временем',
    color: '#fb7185',
    icon: (
      <>
        <rect x="2" y="3" width="8" height="9" rx="1" />
        <path d="M2 5.3h8" />
        <circle cx="11.6" cy="11.1" r="3.1" />
        <path d="M11.6 9.6v1.5l1 .8" />
      </>
    ),
  },
  {
    value: 'daterange',
    label: 'Диапазон дат',
    hint: 'Период: с и по',
    color: '#3b82f6',
    icon: (
      <>
        <rect x="1.5" y="3.5" width="7" height="9.5" rx="1.1" />
        <rect x="7.5" y="3.5" width="7" height="9.5" rx="1.1" />
        <path d="M1.5 6.3h7M7.5 6.3h7M4 2v3M12 2v3" />
      </>
    ),
  },
  {
    value: 'boolean',
    label: 'Да / Нет',
    hint: 'Флажок, галочка',
    color: '#22c55e',
    icon: (
      <>
        <rect x="3" y="3" width="10" height="10" rx="2.2" />
        <path d="M5.5 8.1l1.8 1.8L11 6.3" />
      </>
    ),
  },
  {
    value: 'select',
    label: 'Список',
    hint: 'Один вариант из списка',
    color: '#a855f7',
    icon: (
      <>
        <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
        <path d="M6 7.8l2 2 2-2" />
      </>
    ),
  },
  {
    value: 'multiselect',
    label: 'Мульти‑список',
    hint: 'Несколько вариантов',
    color: '#d946ef',
    icon: (
      <>
        <rect x="2.4" y="2.8" width="2.6" height="2.6" rx=".6" />
        <rect x="2.4" y="6.7" width="2.6" height="2.6" rx=".6" />
        <rect x="2.4" y="10.6" width="2.6" height="2.6" rx=".6" />
        <path d="M7 4.1h6M7 8h6M7 11.9h6" />
      </>
    ),
  },
  {
    value: 'url',
    label: 'Ссылка',
    hint: 'URL, веб‑адрес',
    color: '#14b8a6',
    icon: (
      <path d="M6.5 9.5l3-3M5 11l-1.5 1.5a2 2 0 01-2.8-2.8L2.2 8.2M11 5l1.5-1.5a2 2 0 012.8 2.8L13.8 7.8" />
    ),
  },
];

/** Отрисовать иконку типа колонки (из COLUMN_TYPE_OPTIONS) в стандартной 16×16 обвязке. */
const fieldTypeIcon = (type: FieldType, size = 13) => {
  const opt = COLUMN_TYPE_OPTIONS.find((o) => o.value === type);
  if (!opt) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {opt.icon}
    </svg>
  );
};

type LinkProviderId = 'google_drive' | 'onedrive' | 'other';

const LINK_PROVIDER_ICONS: Record<LinkProviderId, React.ReactNode> = {
  google_drive: (
    <svg width="13" height="13" viewBox="0 0 48 48" aria-hidden>
      <path fill="#00ac47" d="M17.5 4 4 27.5l6.9 12L24.4 16z" />
      <path fill="#ffba00" d="M17.5 4h13l13 23.5H30.5z" />
      <path fill="#0066da" d="M10.9 39.5 4 27.5h27l6.9 12z" />
    </svg>
  ),
  onedrive: (
    <svg width="13" height="13" viewBox="0 0 48 48" aria-hidden>
      <path fill="#1490df" d="M11 22.5A8.5 8.5 0 0 0 12 39.4h26.5A7.6 7.6 0 0 0 40 24.7 9.7 9.7 0 0 0 21.3 20 8.5 8.5 0 0 0 11 22.5z" />
    </svg>
  ),
  other: null,
};

/**
 * Ссылки, вставленные в колонке-«Ссылке», сверяем с реальными файлами/ссылками
 * проекта (вкладка «Файлы») — если URL совпадает, берём логотип и подпись оттуда,
 * иначе определяем провайдера по домену.
 */
function detectLinkProvider(
  url: string,
  files?: ProjectFileLink[] | null,
): { provider: LinkProviderId; label: string } {
  const matched = (files || []).find((f) => f.url === url);
  if (matched) {
    const provider: LinkProviderId = matched.provider === 'google_drive' || matched.provider === 'onedrive'
      ? matched.provider
      : 'other';
    return { provider, label: matched.label || url };
  }
  let hostname = '';
  try {
    hostname = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    hostname = '';
  }
  if (/(^|\.)(drive|docs)\.google\.com$/.test(hostname)) {
    return { provider: 'google_drive', label: 'Google Drive' };
  }
  if (/(^|\.)(onedrive\.live\.com|1drv\.ms|.*\.sharepoint\.com)$/.test(hostname)) {
    return { provider: 'onedrive', label: 'OneDrive' };
  }
  return { provider: 'other', label: hostname || url };
}

const toHref = (url: string) =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;

type TaskTableColumnVisibility = {
  owner: boolean;
  status: boolean;
  priority: boolean;
  deadline: boolean;
};

const TASK_TABLE_TEMPLATES: Array<{
  id: string;
  label: string;
  hint: string;
  cols: TaskTableColumnVisibility;
}> = [
  { id: 'full', label: 'Полный набор', hint: 'Задача, ответственный, статус, приоритет, дедлайн', cols: { owner: true, status: true, priority: true, deadline: true } },
  { id: 'status-only', label: 'Только статус', hint: 'Минимум — задача и статус', cols: { owner: false, status: true, priority: false, deadline: false } },
  { id: 'deadlines', label: 'С дедлайнами', hint: 'Фокус на сроках и ответственных', cols: { owner: true, status: false, priority: false, deadline: true } },
  { id: 'kanban', label: 'Канбан-приоритеты', hint: 'Статус и приоритет', cols: { owner: false, status: true, priority: true, deadline: false } },
];

type ProjectBaseColumnId = 'owner' | 'status' | 'progress' | 'amount' | 'lead' | 'company' | 'created';
const PROJECT_BASE_COLUMN_IDS: ProjectBaseColumnId[] = ['owner', 'status', 'progress', 'amount', 'lead', 'company', 'created'];

const PROJECT_TABLE_TEMPLATES: Array<{
  id: string;
  label: string;
  hint: string;
  cols: Record<ProjectBaseColumnId, boolean>;
}> = [
  { id: 'full', label: 'Полный набор', hint: 'Все стандартные колонки проекта', cols: { owner: true, status: true, progress: true, amount: true, lead: true, company: true, created: true } },
  { id: 'sales', label: 'Продажи', hint: 'Ответственный, статус, сумма, лид, компания', cols: { owner: true, status: true, progress: false, amount: true, lead: true, company: true, created: false } },
  { id: 'minimal', label: 'Минимальный', hint: 'Только статус и сумма', cols: { owner: false, status: true, progress: false, amount: true, lead: false, company: false, created: false } },
  { id: 'timeline', label: 'Сроки', hint: 'Статус, этап, дата создания', cols: { owner: false, status: true, progress: true, amount: false, lead: false, company: false, created: true } },
];

/** Ключ открытого попапа «ИИ» на верхней панели, когда ни один проект не развёрнут. */
const AI_TASKS_NO_PROJECT_KEY = '__ai_no_project__';

const TASK_STATUS_OPTIONS: ProjectTask['status'][] = [
  'К выполнению',
  'В работе',
  'На проверке',
  'Заблокировано',
  'Отложено',
  'Готово',
];
const TASK_PRIORITY_OPTIONS: ProjectTask['priority'][] = [
  'Обычный',
  'Высокий',
  'Низкий',
];

const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}${crypto.randomUUID()}`;
  }
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

const tasksCacheKey = (projectId: string) => `project_tasks_${projectId}`;
const readTasksCache = (projectId: string) => {
  try {
    const raw = localStorage.getItem(tasksCacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Project['tasks'];
  } catch {
    return null;
  }
};
const writeTasksCache = (projectId: string, tasks: Project['tasks']) => {
  try {
    localStorage.setItem(tasksCacheKey(projectId), JSON.stringify(tasks ?? []));
  } catch {
    // ignore
  }
};


export const ProjectsListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const locale = resolveLocale(i18n.language);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsSearch, setColumnsSearch] = useState('');
  const [addColumnStep, setAddColumnStep] = useState<'closed' | 'type' | 'name'>('closed');
  const [addColumnTypeSearch, setAddColumnTypeSearch] = useState('');
  const [addColumnType, setAddColumnType] = useState<FieldType>('text');
  const [addColumnLabel, setAddColumnLabel] = useState('');
  const [addColumnOptionsText, setAddColumnOptionsText] = useState('');
  /** Источник значения для новой колонки email/phone: ручной ввод либо из привязанного лида/компании. */
  const [addColumnSource, setAddColumnSource] = useState<'manual' | 'lead' | 'company'>('manual');
  const [addColumnBusy, setAddColumnBusy] = useState(false);
  const [addColumnError, setAddColumnError] = useState<string | null>(null);
  /** Ключ `cf:<projectId>:<fieldId>` ссылочной/email/телефонной ячейки, сейчас открытой на редактирование. */
  const [linkLikeEditKey, setLinkLikeEditKey] = useState<string | null>(null);
  const linkCellAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [linkCellPopoverLayout, setLinkCellPopoverLayout] = useState<FixedPopoverLayout | null>(null);
  const addColumnLabelRef = useRef<HTMLInputElement | null>(null);
  const [ownerEditorId, setOwnerEditorId] = useState<string | null>(null);
  const [ownerDraftIds, setOwnerDraftIds] = useState<string[]>([]);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [groupMode, setGroupMode] = useState<'status' | 'owner' | 'company' | 'none'>('status');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<Project['status'] | ''>('');
  const [showBulkHint, setShowBulkHint] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskDrafts, setTaskDrafts] = useState<
    Record<
      string,
      {
        title: string;
        assigneeIds: string[];
        status: ProjectTask['status'];
        priority: ProjectTask['priority'];
        deadline: string;
      }
    >
  >({});
  const [openAssigneeMenuId, setOpenAssigneeMenuId] = useState<string | null>(null);
  const [openNewAssigneesProjectId, setOpenNewAssigneesProjectId] = useState<string | null>(null);
  /** Шаблоны колонок для таблицы задач внутри карточки проекта — общие для всех проектов, хранятся локально. */
  const [taskColumnVisibility, setTaskColumnVisibility] = useState<TaskTableColumnVisibility>(
    TASK_TABLE_TEMPLATES[0].cols,
  );
  /** Попап «Шаблон» — общий для шаблонов колонок таблицы проектов и (если развёрнут проект) колонок его задач. */
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  /** Генерация задач ИИ по текстовому описанию — черновик открыт для одного проекта за раз. */
  const [aiTasksOpenFor, setAiTasksOpenFor] = useState<string | null>(null);
  const [aiTasksPrompt, setAiTasksPrompt] = useState('');
  const [aiTasksBusy, setAiTasksBusy] = useState(false);
  const [aiTasksError, setAiTasksError] = useState<string | null>(null);
  /** Пояснение ИИ, когда результат намеренно пуст (например «валюта уже стандартное поле») — не ошибка. */
  const [aiTasksNote, setAiTasksNote] = useState<string | null>(null);
  const [aiTasksSuggestions, setAiTasksSuggestions] = useState<AiGeneratedTask[] | null>(null);
  const [aiTasksSelected, setAiTasksSelected] = useState<boolean[]>([]);
  /** Колонки проекта, которые ИИ предложил создать/заполнить вместе с задачами (те же черновик/выбор). */
  const [aiFieldsSuggestions, setAiFieldsSuggestions] = useState<AiGeneratedField[] | null>(null);
  const [aiFieldsSelected, setAiFieldsSelected] = useState<boolean[]>([]);
  /** Куда реально запишется значение: '' = создать новую колонку, иначе — key уже существующей. Изначально следует предположению ИИ (existingKey), но пользователь может переключить. */
  const [aiFieldsTarget, setAiFieldsTarget] = useState<string[]>([]);
  /** Проект для кнопки «ИИ» в тулбаре, когда ни один ряд не развёрнут — выбирается прямо в попапе. */
  const [aiTasksPickedProjectId, setAiTasksPickedProjectId] = useState<string | null>(null);
  const [aiTasksPickerSearch, setAiTasksPickerSearch] = useState('');
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Column drag ghost state
  const [colGhost, setColGhost] = useState<{
    colId: string;
    label: string;
    rows: string[];
    x: number;
    y: number;
  } | null>(null);

  // Status popover state
  const [statusOpenId, setStatusOpenId] = useState<string | null>(null);
  const [statusPopoverPos, setStatusPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const statusPopoverRef = useRef<HTMLDivElement | null>(null);

  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const ownerMenuRef = useRef<HTMLDivElement | null>(null);
  const ownerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [ownerPopoverLayout, setOwnerPopoverLayout] = useState<FixedPopoverLayout | null>(null);
  /** Якорь «+» у задачи — позиция fixed-поповера (сам список в portal в document.body из‑за overflow:hidden у таблицы). */
  const taskAssigneeAnchorRef = useRef<HTMLButtonElement | null>(null);
  const newTaskAssigneesAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [taskAssigneePopoverLayout, setTaskAssigneePopoverLayout] = useState<FixedPopoverLayout | null>(null);
  const [newTaskAssigneesPopoverLayout, setNewTaskAssigneesPopoverLayout] = useState<FixedPopoverLayout | null>(null);
  /** Черновик исполнителей задачи — как у столбца «ответственный» проекта (поиск + Сохранить). */
  const [taskAssigneeSearch, setTaskAssigneeSearch] = useState('');
  const [taskAssigneeDraftIds, setTaskAssigneeDraftIds] = useState<string[]>([]);
  const [newTaskAssigneeDraftIds, setNewTaskAssigneeDraftIds] = useState<string[] | null>(null);
  /** Кастомный date/datetime/daterange‑пикер — общий для custom‑field колонок и дедлайна задач, вместо нативного <input type="date">. */
  const dateCellAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [dateCellEditor, setDateCellEditor] = useState<{ key: string } | null>(null);
  const [dateCellPopoverLayout, setDateCellPopoverLayout] = useState<FixedPopoverLayout | null>(null);
  const [dateCellViewDate, setDateCellViewDate] = useState(new Date());
  const [dateCellSelectedDate, setDateCellSelectedDate] = useState<Date | null>(null);
  const [dateCellRangeEnd, setDateCellRangeEnd] = useState<Date | null>(null);
  const [dateCellTimeDraft, setDateCellTimeDraft] = useState('12:00');
  /** Меню статуса/приоритета задачи в раскрытой строке проекта */
  const [taskDrawerMenu, setTaskDrawerMenu] = useState<{
    kind: 'status' | 'priority';
    projectId: string;
    taskId: string;
    top: number;
    left: number;
  } | null>(null);
  const taskDrawerFieldPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const hidden = localStorage.getItem('projects_bulk_hint_hidden');
    if (!hidden) setShowBulkHint(true);
  }, []);

  const navigate = useNavigate();
  const { showConfirm } = useAlertModal();
  const [resolvedTables, setResolvedTables] = useState<ProjectTable[]>([]);
  const tableIdParam = searchParams.get('table');
  const defaultTable = useMemo(
    () => resolvedTables.find((tbl) => tbl.slug === 'main') || null,
    [resolvedTables],
  );
  const activeTableId = tableIdParam || defaultTable?.id || '';
  const [density, setDensity] = useState<ProjectsRowDensity>('comfortable');

  // Данные каждой таблицы уже изолированы на бэкенде (?tableId=), клиентской фильтрации не нужно.
  const visibleProjects = projects;

  // Filtered projects based on search + company
  const filteredProjects = useMemo(() => {
    let result = visibleProjects;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.leadName?.toLowerCase().includes(q) ||
          p.companyName?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [visibleProjects, searchQuery]);

  /** Проект, на который действуют тулбарные «Шаблон»/«ИИ» для задач — последний развёрнутый ряд. */
  const activeTaskProject = useMemo(() => {
    const lastId = expandedProjectIds[expandedProjectIds.length - 1];
    return lastId ? projects.find((p) => p.id === lastId) ?? null : null;
  }, [expandedProjectIds, projects]);

  const openType = (type: 'table' | 'kanban' | 'calendar') => {
    const basePath =
      type === 'table'
        ? '/projects'
        : type === 'kanban'
          ? '/projects/board'
          : '/projects/calendar';
    navigate(activeTableId ? `${basePath}?table=${activeTableId}` : basePath);
  };
  const changeTable = (tableId: string) => {
    navigate(`/projects?table=${tableId}`);
  };
  const handleOpen = (id: string) => navigate(`/projects/${id}`);
  const handleCreate = () => {
    const q = activeTableId ? `?table=${encodeURIComponent(activeTableId)}` : '';
    navigate(`/projects/new${q}`);
  };
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
  const { currencies: currencyDefs } = useProjectCurrencyDefinitions();
  const statusOptions: Project['status'][] = useMemo(
    () => (statusDefs.length ? statusDefs.map((s) => s.value) : [
      'Новый', 'В работе', 'На проверке', 'Заморожен', 'Закрыт', 'Выиграно', 'Проиграно',
    ]),
    [statusDefs],
  );
  const statusPillStyle = (status: string) => pillStyleFromHex(statusColorFor(status));
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
  const coreColumnIds = useMemo(() => new Set(['name']), []);

  const baseColumns = useMemo((): ProjectListColumn[] => [
    { id: 'name', label: t('crm.projects.list.headers.name') },
    { id: 'owner', label: t('crm.projects.list.headers.owner') },
    { id: 'status', label: t('crm.projects.list.headers.status') },
    { id: 'progress', label: t('crm.projects.list.headers.progress') },
    { id: 'amount', label: t('crm.projects.list.headers.amount') },
    { id: 'lead', label: t('crm.projects.list.headers.lead') },
    { id: 'company', label: t('crm.projects.list.headers.company') },
    { id: 'created', label: t('crm.projects.list.headers.created') },
  ], [t]);

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );
  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    visibleProjects.forEach((p) => {
      Object.keys(p.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [visibleProjects]);

  const columns = useMemo((): ProjectListColumn[] => {
    const customCols: ProjectListColumn[] = activeCustomFields.map((field) => ({
      id: `cf:${field.id}`,
      label: field.label,
      field,
    }));
    return [...baseColumns, ...customCols];
  }, [activeCustomFields, baseColumns]);

  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumns.includes(col.id)),
    [columns, hiddenColumns],
  );

  const orderedColumns = useMemo(() => {
    if (!visibleColumns.length) return [];
    const map = new Map(visibleColumns.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : visibleColumns.map((col) => col.id);
    const result: typeof columns = [];
    order.forEach((id) => {
      const col = map.get(id);
      if (col) result.push(col);
    });
    visibleColumns.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [visibleColumns, columnOrder]);

  const getColumnWidth = (id: string, fallback: number) =>
    columnWidths[id] ?? fallback;

  const formatAmount = (amount: number, currency?: string) => {
    const formatted = new Intl.NumberFormat(locale).format(amount);
    if (!currency) return formatted;
    return t('crm.projects.common.amountWithCurrency', {
      amount: formatted,
      currency,
    });
  };
  const resolveOwners = (project: Project) => {
    if (project.ownerUserIds?.length && staff.length) {
      const byIds = project.ownerUserIds
        .map((id) => staff.find((u) => u.id === id) || null)
        .filter(Boolean) as StaffUser[];
      if (byIds.length) return byIds.slice(0, 3);
    }
    if (project.ownerUserId && staff.length) {
      const ownerById = staff.find((u) => u.id === project.ownerUserId);
      if (ownerById) return [ownerById];
    }
    if (!project.owner) return [];
    const rawOwners = project.owner
      .split(/[,;/]+/)
      .map((name) => name.trim())
      .filter(Boolean);
    return rawOwners
      .map((name) => staff.find((u) => u.fullName === name) || name)
      .slice(0, 3);
  };
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
  const staffForTasks = managerStaff.length ? managerStaff : staff;

  const filteredStaffForTaskAssignees = useMemo(
    () =>
      staffForTasks.filter((u) =>
        taskAssigneeSearch.trim()
          ? u.fullName.toLowerCase().includes(taskAssigneeSearch.trim().toLowerCase())
          : true,
      ),
    [staffForTasks, taskAssigneeSearch],
  );

  const toggleTaskAssigneeDraftId = useCallback((userId: string) => {
    setTaskAssigneeDraftIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }, []);

  const toggleNewTaskAssigneeDraftId = useCallback((userId: string) => {
    setNewTaskAssigneeDraftIds((prev) => {
      const list = prev ?? [];
      return list.includes(userId)
        ? list.filter((id) => id !== userId)
        : [...list, userId];
    });
  }, []);

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
  const progressValue = (project: Project) => {
    const total = project.tasks?.length ?? 0;
    if (!total) return 0;
    const done = project.tasks.filter((t) => isDoneStatus(t.status)).length;
    return Math.round((done / total) * 100);
  };
  const initialsFromName = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
    return `${first}${second}`.toUpperCase();
  };
  const openOwnerEditor = (project: Project) => {
    const matchedIds = project.ownerUserIds?.length
      ? project.ownerUserIds
      : (project.owner ?? '')
          .split(/[,;/]+/)
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => staff.find((u) => u.fullName === name)?.id)
          .filter((id): id is string => Boolean(id));
    setOwnerDraftIds(matchedIds);
    setOwnerSearch('');
    setOwnerEditorId(project.id);
  };
  const toggleOwnerDraft = (id: string) => {
    setOwnerDraftIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };
  const saveOwnerSelection = (project: Project) => {
    const selected = staff.filter((u) => ownerDraftIds.includes(u.id));
    const names = selected.map((u) => u.fullName);
    updateProjectInline(project.id, {
      owner: names.length ? names.join(', ') : null,
      ownerUserId: selected.length ? selected[0].id : null,
      ownerUserIds: selected.length ? selected.map((u) => u.id) : [],
    });
    setOwnerEditorId(null);
  };
  const hideColumn = (id: string) => {
    if (coreColumnIds.has(id)) return;
    setHiddenColumns((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setColumnOrder((prev) => prev.filter((colId) => colId !== id));
  };
  const showColumn = (id: string) => {
    setHiddenColumns((prev) => prev.filter((colId) => colId !== id));
    setColumnOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const openAddColumnTypePicker = () => {
    setAddColumnError(null);
    setAddColumnTypeSearch('');
    setAddColumnStep('type');
  };
  const chooseAddColumnType = (type: FieldType) => {
    setAddColumnType(type);
    setAddColumnLabel('');
    setAddColumnOptionsText('');
    setAddColumnSource('manual');
    setAddColumnError(null);
    setAddColumnStep('name');
    requestAnimationFrame(() => addColumnLabelRef.current?.focus());
  };
  const cancelAddColumn = () => {
    setAddColumnStep('closed');
    setAddColumnError(null);
  };
  const submitAddColumn = async () => {
    const label = addColumnLabel.trim();
    if (!label) {
      setAddColumnError(t('crm.projects.list.columns.labelRequired', 'Введите название колонки'));
      return;
    }
    const needsOptions = addColumnType === 'select' || addColumnType === 'multiselect';
    const options = needsOptions
      ? addColumnOptionsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((optLabel) => ({ value: normalizeCustomFieldKey(optLabel) || optLabel, label: optLabel }))
      : undefined;
    if (needsOptions && (!options || options.length === 0)) {
      setAddColumnError(t('crm.projects.list.columns.optionsRequired', 'Добавьте варианты через запятую'));
      return;
    }
    const baseKey = normalizeCustomFieldKey(label) || 'field';
    const existingKeys = new Set(customFields.map((f) => f.key));
    let key = `cf_${baseKey}`;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `cf_${baseKey}_${suffix}`;
      suffix += 1;
    }
    const supportsSource = addColumnType === 'email' || addColumnType === 'phone';
    setAddColumnBusy(true);
    setAddColumnError(null);
    try {
      const created = await createCustomField({
        entityType: 'project',
        key,
        label,
        type: addColumnType,
        options,
        order: customFields.length,
        isActive: true,
        meta: supportsSource && addColumnSource !== 'manual' ? { source: addColumnSource } : undefined,
      });
      setCustomFields((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setAddColumnStep('closed');
    } catch (e: any) {
      setAddColumnError(e?.message || t('crm.projects.list.columns.createFailed', 'Не удалось создать колонку'));
    } finally {
      setAddColumnBusy(false);
    }
  };

  const updateProjectInline = async (
    id: string,
    patch: Partial<Project>,
  ) => {
    // target читаем из `prev` внутри самого функционального апдейтера — React
    // гарантированно применяет его к самому свежему стейту, даже если перед этим
    // в этом же тике уже была другая правка того же проекта. Раньше target брался
    // из `projects` по замыканию, который на этот момент мог быть ещё старым —
    // и тогда `{...target, ...patch}` затирал на бэкенде более свежие поля.
    let target: Project | undefined;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        target = { ...p, ...patch };
        return target;
      }),
    );
    if (!target) return;
    try {
      // Only let this specific inline edit's own status field (if any) reach the server —
      // every other inline edit (name/amount/tags/custom fields/tasks/...) sends the full local
      // Project snapshot, and if one of those happens to resolve while a real status change from
      // elsewhere (the kanban, the status pill) is also in flight, its stale local `status` could
      // silently win the race and overwrite the fresh one moments later.
      const updated = await updateProject(target, {
        includeEmptyTasks: patch.tasks !== undefined,
        excludeStatus: patch.status === undefined,
      });
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const lead = updated.leadId
            ? leads.find((l) => l.id === updated.leadId)
            : null;
          const cid = updated.companyId ?? lead?.companyId ?? null;
          const comp = cid ? companies.find((c) => c.id === cid) : null;
          return {
            ...updated,
            leadName: lead?.name ?? p.leadName,
            leadEmail: lead?.email ?? p.leadEmail,
            companyId: cid,
            companyName: comp?.name ?? p.companyName,
          };
        }),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.errors.loadFailed'));
    }
  };

  const applyBulkStatus = async (status: Project['status']) => {
    const ids = [...selectedProjectIds];
    if (!ids.length) return;
    setProjects((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, status } : p)),
    );
    await Promise.all(
      ids.map((id) => {
        const target = projects.find((p) => p.id === id);
        if (!target) return null;
        return updateProject({ ...target, status }).catch((e) => {
          console.error(e);
          return null;
        });
      }),
    );
  };

  const archiveSelected = async () => {
    const ids = [...selectedProjectIds];
    if (!ids.length) return;
    await Promise.all(
      ids.map((id) =>
        archiveProject(id).catch((e) => {
          console.error(e);
          return null;
        }),
      ),
    );
    setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
    setSelectedProjectIds([]);
  };

  const deleteSelected = async () => {
    const ids = [...selectedProjectIds];
    if (!ids.length) return;
    await Promise.all(
      ids.map((id) =>
        deleteProject(id).catch((e) => {
          console.error(e);
          return null;
        }),
      ),
    );
    setProjects((prev) => prev.filter((p) => !ids.includes(p.id)));
    setSelectedProjectIds([]);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('projects_table_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setColumnWidths(parsed.widths);
        if (Array.isArray(parsed.hidden)) setHiddenColumns(parsed.hidden);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setHiddenColumns((prev) => prev.filter((id) => !coreColumnIds.has(id)));
  }, [coreColumnIds]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('project_task_table_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        setTaskColumnVisibility((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('project_task_table_columns', JSON.stringify(taskColumnVisibility));
    } catch {
      // ignore
    }
  }, [taskColumnVisibility]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'projects_table_columns',
        JSON.stringify({
          order: columnOrder,
          widths: columnWidths,
          hidden: hiddenColumns,
        }),
      );
    } catch {
      // ignore
    }
  }, [columnOrder, columnWidths, hiddenColumns]);

  useEffect(() => {
    if (!visibleColumns.length) return;
    setColumnOrder((prev) => {
      if (!prev.length) return visibleColumns.map((c) => c.id);
      const ids = visibleColumns.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    });
  }, [visibleColumns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const next = Math.max(90, resizing.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.id]: next }));
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (!columnsOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!columnsMenuRef.current) return;
      if (!columnsMenuRef.current.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [columnsOpen]);

  useEffect(() => {
    if (!columnsOpen) setAddColumnStep('closed');
  }, [columnsOpen]);

  useEffect(() => {
    if (!ownerEditorId) return;
    const handleClick = (event: MouseEvent) => {
      if (!ownerMenuRef.current) return;
      const t = event.target as Node;
      if (ownerMenuRef.current.contains(t)) return;
      if ((event.target as Element)?.closest?.('[data-lv-owner-popover-anchor]')) return;
      setOwnerEditorId(null);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [ownerEditorId]);

  useLayoutEffect(() => {
    if (!ownerEditorId) {
      setOwnerPopoverLayout(null);
      return;
    }
    const el = ownerAnchorRef.current;
    if (!el) return;
    const apply = () =>
      setOwnerPopoverLayout(
        getFixedPopoverLayout(el.getBoundingClientRect(), { popoverWidth: 320, maxScroll: 280 }),
      );
    apply();
    window.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [ownerEditorId, ownerSearch]);

  useLayoutEffect(() => {
    if (!openAssigneeMenuId) {
      setTaskAssigneePopoverLayout(null);
      return;
    }
    const btn = taskAssigneeAnchorRef.current;
    if (!btn) return;
    const apply = () =>
      setTaskAssigneePopoverLayout(
        getFixedPopoverLayout(btn.getBoundingClientRect(), { popoverWidth: 320, maxScroll: 280 }),
      );
    apply();
    window.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [openAssigneeMenuId]);

  useLayoutEffect(() => {
    if (!openNewAssigneesProjectId) {
      setNewTaskAssigneesPopoverLayout(null);
      return;
    }
    const btn = newTaskAssigneesAnchorRef.current;
    if (!btn) return;
    const apply = () =>
      setNewTaskAssigneesPopoverLayout(
        getFixedPopoverLayout(btn.getBoundingClientRect(), { popoverWidth: 320, maxScroll: 280 }),
      );
    apply();
    window.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [openNewAssigneesProjectId]);

  useLayoutEffect(() => {
    if (!dateCellEditor) {
      setDateCellPopoverLayout(null);
      return;
    }
    const btn = dateCellAnchorRef.current;
    if (!btn) return;
    const apply = () =>
      setDateCellPopoverLayout(
        getFixedPopoverLayout(btn.getBoundingClientRect(), { popoverWidth: 280, maxScroll: 420 }),
      );
    apply();
    window.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [dateCellEditor]);

  useEffect(() => {
    if (!dateCellEditor) return;
    const handleClick = (event: MouseEvent) => {
      const t = event.target as Element;
      if (t?.closest?.('[data-lv-date-popover]') || t?.closest?.('[data-lv-date-popover-anchor]')) return;
      setDateCellEditor(null);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [dateCellEditor]);

  useLayoutEffect(() => {
    if (!linkLikeEditKey) {
      setLinkCellPopoverLayout(null);
      return;
    }
    const btn = linkCellAnchorRef.current;
    if (!btn) return;
    const apply = () =>
      setLinkCellPopoverLayout(
        getFixedPopoverLayout(btn.getBoundingClientRect(), { popoverWidth: 280, maxScroll: 260 }),
      );
    apply();
    window.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [linkLikeEditKey]);

  useEffect(() => {
    if (!linkLikeEditKey) return;
    const handleClick = (event: MouseEvent) => {
      const t = event.target as Element;
      if (t?.closest?.('[data-lv-linkpick-popover]') || t?.closest?.('[data-lv-linkpick-anchor]')) return;
      setLinkLikeEditKey(null);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [linkLikeEditKey]);

  useEffect(() => {
    if (!templateMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const t = event.target as Element;
      if (t?.closest?.('[data-lv-task-template-popover]') || t?.closest?.('[data-lv-task-template-anchor]')) return;
      setTemplateMenuOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [templateMenuOpen]);

  useEffect(() => {
    if (!aiTasksOpenFor) return;
    const handleClick = (event: MouseEvent) => {
      const t = event.target as Element;
      if (t?.closest?.('[data-lv-ai-tasks-popover]') || t?.closest?.('[data-lv-ai-tasks-anchor]')) return;
      setAiTasksOpenFor(null);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [aiTasksOpenFor]);

  useEffect(() => {
    if (!statusOpenId) return;
    const close = () => { setStatusOpenId(null); setStatusPopoverPos(null); };
    const handleClick = (event: MouseEvent) => {
      if (!statusPopoverRef.current) return;
      if (!statusPopoverRef.current.contains(event.target as Node)) close();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', close, true);
    };
  }, [statusOpenId]);

  useEffect(() => {
    if (!taskDrawerMenu) return;
    const close = () => setTaskDrawerMenu(null);
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (taskDrawerFieldPopoverRef.current?.contains(t)) return;
      if ((ev.target as Element)?.closest?.('.lv-task-field-trigger')) return;
      close();
    };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', close, true);
    };
  }, [taskDrawerMenu]);

  useEffect(() => {
    if (!openAssigneeMenuId && !openNewAssigneesProjectId) return;
    const handleClick = (event: MouseEvent) => {
      const el = event.target as Element | null;
      if (
        openAssigneeMenuId &&
        !el?.closest?.('[data-lv-owner-popover-anchor]') &&
        !el?.closest?.('[data-lv-task-assignee-popover]')
      ) {
        setOpenAssigneeMenuId(null);
      }
      if (
        openNewAssigneesProjectId &&
        !el?.closest?.('[data-lv-task-assignees-anchor]') &&
        !el?.closest?.('[data-lv-new-task-assignees-popover]')
      ) {
        setOpenNewAssigneesProjectId(null);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [openAssigneeMenuId, openNewAssigneesProjectId]);

  useEffect(() => {
    if (!openAssigneeMenuId) setTaskAssigneeDraftIds([]);
  }, [openAssigneeMenuId]);

  useEffect(() => {
    if (!openNewAssigneesProjectId) setNewTaskAssigneeDraftIds(null);
  }, [openNewAssigneesProjectId]);

  useEffect(() => {
    if (!openAssigneeMenuId && !openNewAssigneesProjectId) setTaskAssigneeSearch('');
  }, [openAssigneeMenuId, openNewAssigneesProjectId]);

  const startResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id,
      startX: e.clientX,
      startWidth: columnWidths[id] ?? 170,
    });
  };

  const reorderColumns = useCallback((dragId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }, []);

  const columnDrag = useWorkspaceStyleColumnDrag(reorderColumns, 'light', {
    useBuiltInDragImage: false,
  });
  const { draggingColumnKey: dragColId, columnDragOverKey: dropColId } = columnDrag;

  useEffect(() => {
    if (!dragColId) {
      setColGhost(null);
      return;
    }
    const col = orderedColumns.find((c) => c.id === dragColId);
    if (!col) return;
    const previewRows = filteredProjects.slice(0, 4).map((p) => ghostPreview(p, dragColId));
    const onMove = (e: MouseEvent) => {
      setColGhost({
        colId: dragColId,
        label: col.label,
        rows: previewRows,
        x: e.clientX + 16,
        y: e.clientY + 4,
      });
    };
    window.addEventListener('dragover', onMove);
    return () => window.removeEventListener('dragover', onMove);
  }, [dragColId]);

  const exportCsv = () => {
    const cols = orderedColumns.map((c) => c.label);
    const rows = filteredProjects.map((p) =>
      orderedColumns.map((c) => {
        switch (c.id) {
          case 'name': return p.name ?? '';
          case 'owner': return resolveOwners(p).map((o) => typeof o === 'string' ? o : o.fullName).join(', ');
          case 'lead': return p.leadName ?? '';
          case 'company': return p.companyName ?? '';
          case 'status': return p.status ?? '';
          case 'progress': return `${progressValue(p)}%`;
          case 'amount': return String(p.amount ?? 0);
          case 'created': return p.createdAt ? String(p.createdAt).slice(0, 10) : '';
          default: {
            const col = c as any;
            if (col.field) return String(p.customFields?.[col.field.key] ?? '');
            return '';
          }
        }
      }),
    );
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [cols.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ghostPreview = (project: Project, colId: string): string => {
    switch (colId) {
      case 'name': return project.name || '—';
      case 'status': return project.status || '—';
      case 'owner': {
        const owners = resolveOwners(project);
        if (!owners.length) return '—';
        const first = owners[0];
        return typeof first === 'string' ? first : first.fullName;
      }
      case 'lead': return project.leadName || '—';
      case 'company': return project.companyName || '—';
      case 'amount': return project.amount ? String(project.amount) : '—';
      case 'progress': return `${progressValue(project)}%`;
      case 'created': return project.createdAt ? String(project.createdAt).slice(0, 10) : '—';
      default: return '—';
    }
  };

  useEffect(() => {
    setSelectedProjectIds((prev) =>
      prev.filter((id) => visibleProjects.some((p) => p.id === id)),
    );
  }, [visibleProjects]);

  const toggleProjectExpanded = (id: string) => {
    setExpandedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };
  const openProjectTasksPanel = (project: Project) => {
    if (!(project.tasks || []).length) {
      updateTaskDraft(project.id, getTaskDraft(project.id));
    }
    setExpandedProjectIds((prev) =>
      prev.includes(project.id) ? prev : [...prev, project.id],
    );
  };

  const toggleProjectSelected = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAllSelected = () => {
    if (selectedProjectIds.length === filteredProjects.length) {
      setSelectedProjectIds([]);
      return;
    }
    setSelectedProjectIds(filteredProjects.map((p) => p.id));
  };

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

  const normalizeTasks = (list: ProjectTask[]) =>
    list.map((task) => ({
      ...task,
      id: task.id || generateId('t'),
      assignees: normalizeAssigneesToStaffIds(task.assignees ?? [], staffForTasks),
      checklist: task.checklist ?? [],
    }));

  const updateProjectTasks = async (
    projectId: string,
    nextTasks: ProjectTask[],
  ) => {
    const target = projects.find((p) => p.id === projectId);
    if (!target) return;
    const normalized = normalizeTasks(nextTasks);
    writeTasksCache(projectId, normalized);
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, tasks: normalized } : p)),
    );
    try {
      const updated = await updateProject(
        { ...target, tasks: normalized },
        { includeEmptyTasks: true, excludeStatus: true },
      );
      const resolved = resolveSavedTasks(updated.tasks, normalized);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...updated, tasks: resolved } : p,
        ),
      );
      writeTasksCache(projectId, resolved);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.errors.loadFailed'));
    }
  };

  const updateTaskField = (
    projectId: string,
    taskId: string,
    patch: Partial<ProjectTask>,
  ) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const nextTasks = (project.tasks || []).map((task) =>
      task.id === taskId ? { ...task, ...patch } : task,
    );
    updateProjectTasks(projectId, nextTasks);
  };

  const removeTaskRow = (projectId: string, taskId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const nextTasks = (project.tasks || []).filter((task) => task.id !== taskId);
    updateProjectTasks(projectId, nextTasks);
  };

  const getTaskDraft = (projectId: string) =>
    taskDrafts[projectId] ?? {
      title: '',
      assigneeIds: [],
      status: 'К выполнению' as ProjectTask['status'],
      priority: 'Обычный' as ProjectTask['priority'],
      deadline: '',
    };

  const updateTaskDraft = (
    projectId: string,
    patch: Partial<(typeof taskDrafts)[string]>,
  ) => {
    setTaskDrafts((prev) => ({
      ...prev,
      [projectId]: { ...getTaskDraft(projectId), ...patch },
    }));
  };

  const saveTaskAssigneesFromDraft = (projectId: string, taskId: string) => {
    updateTaskField(projectId, taskId, {
      assignees: normalizeAssigneesToStaffIds(taskAssigneeDraftIds, staffForTasks),
    });
    setOpenAssigneeMenuId(null);
  };

  const saveNewTaskAssigneesFromDraft = (projectId: string) => {
    if (newTaskAssigneeDraftIds == null) return;
    updateTaskDraft(projectId, {
      assigneeIds: normalizeAssigneesToStaffIds(newTaskAssigneeDraftIds, staffForTasks),
    });
    setOpenNewAssigneesProjectId(null);
  };

  const addTaskRow = (projectId: string) => {
    const draft = getTaskDraft(projectId);
    if (!draft.title.trim()) return;
    const assignees = normalizeAssigneesToStaffIds(draft.assigneeIds, staffForTasks);
    const nextTask: ProjectTask = {
      id: generateId('t'),
      title: draft.title.trim(),
      assignees,
      status: draft.status,
      priority: draft.priority,
      deadline: draft.deadline || null,
      checklist: [],
    };
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    updateProjectTasks(projectId, [...(project.tasks || []), nextTask]);
    updateTaskDraft(projectId, {
      title: '',
      assigneeIds: [],
      status: 'К выполнению',
      priority: 'Обычный',
      deadline: '',
    });
    setOpenNewAssigneesProjectId(null);
  };

  const applyTaskTemplate = (template: (typeof TASK_TABLE_TEMPLATES)[number]) => {
    setTaskColumnVisibility(template.cols);
    setTemplateMenuOpen(false);
  };

  const applyProjectColumnTemplate = (template: (typeof PROJECT_TABLE_TEMPLATES)[number]) => {
    setHiddenColumns((prev) => {
      const customHidden = prev.filter((id) => !PROJECT_BASE_COLUMN_IDS.includes(id as ProjectBaseColumnId));
      const baseHidden = PROJECT_BASE_COLUMN_IDS.filter((id) => !template.cols[id]);
      return [...customHidden, ...baseHidden];
    });
    setTemplateMenuOpen(false);
  };

  const openAiTasksFor = (projectId: string) => {
    setTemplateMenuOpen(false);
    setAiTasksError(null);
    setAiTasksNote(null);
    setAiTasksSuggestions(null);
    setAiTasksSelected([]);
    setAiFieldsSuggestions(null);
    setAiFieldsSelected([]);
    setAiFieldsTarget([]);
    setAiTasksPickedProjectId(null);
    setAiTasksPickerSearch('');
    setAiTasksOpenFor((prev) => (prev === projectId ? null : projectId));
  };

  const runAiTasksGenerate = async (project: Project) => {
    const prompt = aiTasksPrompt.trim();
    if (!prompt) return;
    setAiTasksBusy(true);
    setAiTasksError(null);
    setAiTasksNote(null);
    try {
      const res = await postAiGenerateProjectTasks({ projectName: project.name, prompt });
      const tasks = res.tasks ?? [];
      const fields = res.fields ?? [];
      if (!res.ok) {
        setAiTasksError(
          res.error === 'provider_error' && res.message
            ? res.message
            : t('crm.projects.tasks.ai.noResult', 'Не удалось ничего распознать в запросе. Попробуйте переформулировать.'),
        );
        return;
      }
      if (!tasks.length && !fields.length) {
        // Не ошибка: ИИ понял запрос, но действовать не нужно (поле уже стандартное и т.п.).
        setAiTasksNote(res.note || t('crm.projects.tasks.ai.nothingToAdd', 'Добавлять нечего — такое поле уже есть в таблице.'));
        return;
      }
      setAiTasksSuggestions(tasks.length ? tasks : null);
      setAiTasksSelected(tasks.map(() => true));
      setAiFieldsSuggestions(fields.length ? fields : null);
      setAiFieldsSelected(fields.map(() => true));
      setAiFieldsTarget(fields.map((f) => f.existingKey ?? ''));
    } catch (e: any) {
      setAiTasksError(e?.message || t('crm.projects.tasks.ai.error', 'Ошибка при обращении к ИИ'));
    } finally {
      setAiTasksBusy(false);
    }
  };

  const toggleAiTaskSelected = (idx: number) => {
    setAiTasksSelected((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const toggleAiFieldSelected = (idx: number) => {
    setAiFieldsSelected((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const setAiFieldTarget = (idx: number, key: string) => {
    setAiFieldsTarget((prev) => prev.map((v, i) => (i === idx ? key : v)));
  };

  const insertAiTasks = async (project: Project) => {
    const chosenTasks = (aiTasksSuggestions ?? []).filter((_, i) => aiTasksSelected[i]);
    const chosenFields = (aiFieldsSuggestions ?? [])
      .map((f, i) => ({ f, target: aiFieldsTarget[i] || null }))
      .filter((_, i) => aiFieldsSelected[i]);
    if (!chosenTasks.length && !chosenFields.length) return;

    if (chosenTasks.length) {
      const newTasks: ProjectTask[] = chosenTasks.map((t) => ({
        id: generateId('t'),
        title: t.title,
        assignees: [],
        status: 'К выполнению',
        priority: t.priority,
        deadline: t.deadline,
        checklist: [],
      }));
      updateProjectTasks(project.id, [...(project.tasks || []), ...newTasks]);
    }

    if (chosenFields.length) {
      // Новые колонки создаём по одной (ключ каждой следующей зависит от уже созданных —
      // как в submitAddColumn), затем одним апдейтом записываем все значения проекту.
      let liveFields = customFields;
      const nextCustomFields: Record<string, any> = { ...(project.customFields ?? {}) };
      for (const { f, target } of chosenFields) {
        // target — явный выбор пользователя в попапе (переиспользовать существующую колонку
        // или завести новую); по умолчанию совпадает с догадкой ИИ (existingKey), но пользователь
        // мог его переключить, поэтому именно target, а не f.existingKey, определяет итог.
        let key = target;
        let effectiveType = f.type;
        if (key) {
          const existing = liveFields.find((cf) => cf.key === key);
          if (existing) effectiveType = existing.type;
        } else {
          const baseKey = normalizeCustomFieldKey(f.label) || 'field';
          const existingKeys = new Set(liveFields.map((cf) => cf.key));
          key = `cf_${baseKey}`;
          let suffix = 2;
          while (existingKeys.has(key)) {
            key = `cf_${baseKey}_${suffix}`;
            suffix += 1;
          }
          try {
            const created = await createCustomField({
              entityType: 'project',
              key,
              label: f.label,
              type: f.type,
              options: f.options?.length
                ? f.options.map((optLabel) => ({ value: normalizeCustomFieldKey(optLabel) || optLabel, label: optLabel }))
                : undefined,
              order: liveFields.length,
              isActive: true,
            });
            liveFields = [...liveFields, created];
          } catch {
            continue; // не удалось создать колонку — пропускаем значение, остальные поля не теряем
          }
        }
        // Пустой value — пользователь просто попросил завести колонку, без значения для этого
        // проекта; колонка уже создана/выбрана выше, писать в customFields нечего.
        if (f.value) {
          nextCustomFields[key] = effectiveType === 'multiselect' ? f.value.split(',').map((v) => v.trim()).filter(Boolean) : f.value;
        }
      }
      setCustomFields(liveFields);
      await updateProjectInline(project.id, { customFields: nextCustomFields });
    }

    setAiTasksOpenFor(null);
    setAiTasksPrompt('');
    setAiTasksSuggestions(null);
    setAiTasksSelected([]);
    setAiFieldsSuggestions(null);
    setAiFieldsSelected([]);
    setAiFieldsTarget([]);
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupKey) ? prev.filter((item) => item !== groupKey) : [...prev, groupKey],
    );
  };

  const getPrimaryOwnerLabel = (project: Project) => {
    const owners = resolveOwners(project);
    if (!owners.length) return t('crm.projects.common.emptyValue');
    const first = owners[0];
    return typeof first === 'string' ? first : first.fullName;
  };

  const groupedProjects = useMemo(() => {
    if (groupMode === 'none') return [];
    const map = new Map<string, Project[]>();
    filteredProjects.forEach((p) => {
      const key =
        groupMode === 'status'
          ? p.status || t('crm.projects.common.emptyValue')
          : groupMode === 'company'
            ? p.companyName || t('crm.projects.common.emptyValue')
            : getPrimaryOwnerLabel(p) || t('crm.projects.common.emptyValue');
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(p);
    });

    const orderedKeys =
      groupMode === 'status'
        ? [
            ...statusOptions,
            ...Array.from(map.keys()).filter((k) => !statusOptions.includes(k as Project['status'])),
          ]
        : Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'ru'));

    return orderedKeys
      .filter((key) => map.get(key)?.length)
      .map((key) => ({ key, label: key, items: map.get(key) ?? [] }));
  }, [groupMode, filteredProjects, statusOptions, t]);

  /** Суммировать в разных валютах напрямую нельзя — считаем отдельно по каждой и не схлопываем в одно число. */
  const sumsByCurrency = (items: Project[]) => {
    const map = new Map<string, number>();
    items.forEach((p) => {
      const cur = p.currency || 'EUR';
      map.set(cur, (map.get(cur) ?? 0) + (Number(p.amount) || 0));
    });
    return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
  };

  const totalAmountsByCurrency = useMemo(
    () => sumsByCurrency(filteredProjects),
    [filteredProjects],
  );

  const activeCount = useMemo(
    () => filteredProjects.filter((p) => p.status === 'В работе').length,
    [filteredProjects],
  );

  const dateCellWeekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const monday = new Date(2024, 0, 1); // 2024-01-01 was a Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return fmt.format(d).replace(/\.$/, '');
    });
  }, [locale]);

  const dateCellMonthLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => {
      const label = fmt.format(new Date(2024, i, 1));
      return label.charAt(0).toUpperCase() + label.slice(1);
    });
  }, [locale]);

  const toIsoDateOnly = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const formatDateCellDisplay = (value: any, type: 'date' | 'datetime' | 'daterange') => {
    if (type === 'daterange') {
      const start = value?.start ? new Date(`${value.start}T00:00:00`) : null;
      const end = value?.end ? new Date(`${value.end}T00:00:00`) : null;
      const fmtDay = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
      const fmtFull = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
      if (start && end) {
        return start.getFullYear() === end.getFullYear()
          ? `${fmtDay(start)} – ${fmtFull(end)}`
          : `${fmtFull(start)} – ${fmtFull(end)}`;
      }
      if (start) return `${t('crm.projects.list.datePicker.from', 'с')} ${fmtFull(start)}`;
      if (end) return `${t('crm.projects.list.datePicker.to', 'по')} ${fmtFull(end)}`;
      return null;
    }
    if (!value) return null;
    const d = type === 'datetime' ? new Date(value) : new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const datePart = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    if (type !== 'datetime') return datePart;
    const timePart = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${datePart}, ${timePart}`;
  };

  const pluralizeDays = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'день';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня';
    return 'дней';
  };

  const formatDateRangeDaysHint = (value: any): string | null => {
    if (!value?.start || !value?.end) return null;
    const start = new Date(`${value.start}T00:00:00`);
    const end = new Date(`${value.end}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const days = Math.round(Math.abs(end.getTime() - start.getTime()) / 86400000) + 1;
    return `${days} ${pluralizeDays(days)}`;
  };

  const isDateInRange = (day: Date, start: Date | null, end: Date | null) => {
    if (!start || !end) return false;
    const time = day.getTime();
    const lo = Math.min(start.getTime(), end.getTime());
    const hi = Math.max(start.getTime(), end.getTime());
    return time > lo && time < hi;
  };

  const buildDateCellWeeks = (viewDate: Date) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-start
    const gridStart = new Date(year, month, 1 - startOffset);
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + w * 7 + d);
        week.push(day);
      }
      weeks.push(week);
    }
    return weeks;
  };

  const openDateCell = (cellKey: string, type: 'date' | 'datetime' | 'daterange', raw: any) => {
    let selected: Date | null = null;
    let rangeEnd: Date | null = null;
    let time = '12:00';
    if (type === 'daterange') {
      if (raw?.start) {
        const d = new Date(`${raw.start}T00:00:00`);
        if (!Number.isNaN(d.getTime())) selected = d;
      }
      if (raw?.end) {
        const d = new Date(`${raw.end}T00:00:00`);
        if (!Number.isNaN(d.getTime())) rangeEnd = d;
      }
    } else if (raw) {
      const d = type === 'datetime' ? new Date(raw) : new Date(`${raw}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        selected = d;
        time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }
    setDateCellViewDate(selected || new Date());
    setDateCellSelectedDate(selected);
    setDateCellRangeEnd(rangeEnd);
    setDateCellTimeDraft(time);
    setDateCellEditor({ key: cellKey });
  };

  const commitDateCellValue = (
    type: 'date' | 'datetime',
    day: Date | null,
    onCommit: (value: string | null) => void,
    timeOverride?: string,
  ) => {
    let value: string | null = null;
    if (day) {
      value = type === 'datetime' ? `${toIsoDateOnly(day)}T${timeOverride ?? dateCellTimeDraft}` : toIsoDateOnly(day);
    }
    onCommit(value);
  };

  const commitDateRangeValue = (
    onCommit: (value: { start: string; end: string | null } | null) => void,
    start: Date | null,
    end: Date | null,
  ) => {
    onCommit(start ? { start: toIsoDateOnly(start), end: end ? toIsoDateOnly(end) : null } : null);
  };

  const pickDateCellDay = (
    type: 'date' | 'datetime' | 'daterange',
    day: Date,
    onCommit: (value: any) => void,
  ) => {
    if (type === 'daterange') {
      if (!dateCellSelectedDate || dateCellRangeEnd) {
        setDateCellSelectedDate(day);
        setDateCellRangeEnd(null);
      } else if (day.getTime() < dateCellSelectedDate.getTime()) {
        setDateCellRangeEnd(dateCellSelectedDate);
        setDateCellSelectedDate(day);
      } else {
        setDateCellRangeEnd(day);
      }
      return;
    }
    setDateCellSelectedDate(day);
    if (type !== 'datetime') {
      commitDateCellValue(type, day, onCommit);
      setDateCellEditor(null);
    }
  };

  /** Общий рендер триггера + попапа date/datetime/daterange‑пикера — переиспользуется для custom‑field колонок и дедлайна задач. */
  const renderDateCellPicker = (
    cellKey: string,
    type: 'date' | 'datetime' | 'daterange',
    value: any,
    onCommit: (value: any) => void,
  ) => {
    const isOpen = dateCellEditor?.key === cellKey;
    const display = formatDateCellDisplay(value, type);
    const weeks = buildDateCellWeeks(dateCellViewDate);
    const today = new Date();
    const currentMonth = dateCellViewDate.getMonth();
    return (
      <div
        className={type === 'daterange' ? 'relative lv-datepick-wrap-center' : 'relative'}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          ref={isOpen ? dateCellAnchorRef : undefined}
          data-lv-date-popover-anchor
          className={type === 'daterange' ? 'lv-datepick-trigger lv-datepick-pill' : 'lv-datepick-trigger'}
          onClick={() => (isOpen ? setDateCellEditor(null) : openDateCell(cellKey, type, value))}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, opacity: 0.55 }}>
            <rect x="2.5" y="3.5" width="11" height="10" rx="1.2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
          </svg>
          <span className={display ? '' : 'placeholder'}>{display || t('crm.projects.list.datePicker.empty', '—')}</span>
          {type === 'daterange' && formatDateRangeDaysHint(value) && (
            <span className="lv-datepick-pill-hint">{formatDateRangeDaysHint(value)}</span>
          )}
        </button>
        {isOpen && dateCellPopoverLayout && (
          <div
            data-lv-date-popover
            className="lv-popover lv-datepick-popover"
            style={dateCellPopoverLayout.style}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lv-datepick-nav">
              <select
                className="lv-datepick-select"
                value={currentMonth}
                onChange={(e) => {
                  const next = new Date(dateCellViewDate);
                  next.setDate(1);
                  next.setMonth(Number(e.target.value));
                  setDateCellViewDate(next);
                }}
              >
                {dateCellMonthLabels.map((label, idx) => (
                  <option key={label} value={idx}>{label}</option>
                ))}
              </select>
              <select
                className="lv-datepick-select"
                value={dateCellViewDate.getFullYear()}
                onChange={(e) => {
                  const next = new Date(dateCellViewDate);
                  next.setDate(1);
                  next.setFullYear(Number(e.target.value));
                  setDateCellViewDate(next);
                }}
              >
                {Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="lv-datepick-arrows">
                <button
                  type="button"
                  className="lv-datepick-arrow"
                  onClick={() => {
                    const next = new Date(dateCellViewDate);
                    next.setDate(1);
                    next.setMonth(next.getMonth() - 1);
                    setDateCellViewDate(next);
                  }}
                  aria-label="Предыдущий месяц"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 3.5L5 8l5 4.5" /></svg>
                </button>
                <button
                  type="button"
                  className="lv-datepick-arrow"
                  onClick={() => {
                    const next = new Date(dateCellViewDate);
                    next.setDate(1);
                    next.setMonth(next.getMonth() + 1);
                    setDateCellViewDate(next);
                  }}
                  aria-label="Следующий месяц"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 3.5L11 8l-5 4.5" /></svg>
                </button>
              </div>
            </div>
            {type === 'daterange' && (
              <div className="lv-datepick-range-hint">
                <span className={dateCellSelectedDate && !dateCellRangeEnd ? 'active' : ''}>
                  {t('crm.projects.list.datePicker.from', 'с')} {dateCellSelectedDate ? formatDateCellDisplay(toIsoDateOnly(dateCellSelectedDate), 'date') : '—'}
                </span>
                <span className={dateCellSelectedDate && !dateCellRangeEnd ? '' : 'active'}>
                  {t('crm.projects.list.datePicker.to', 'по')} {dateCellRangeEnd ? formatDateCellDisplay(toIsoDateOnly(dateCellRangeEnd), 'date') : '—'}
                </span>
              </div>
            )}
            <div className="lv-datepick-weekdays">
              {dateCellWeekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="lv-datepick-grid">
              {weeks.flat().map((day, idx) => {
                const isOtherMonth = day.getMonth() !== currentMonth;
                const isToday = isSameDay(day, today);
                const isSelected = dateCellSelectedDate ? isSameDay(day, dateCellSelectedDate) : false;
                const isRangeEnd = type === 'daterange' && dateCellRangeEnd ? isSameDay(day, dateCellRangeEnd) : false;
                const isBetween = type === 'daterange' && isDateInRange(day, dateCellSelectedDate, dateCellRangeEnd);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={[
                      'lv-datepick-day',
                      isOtherMonth ? 'other-month' : '',
                      isToday ? 'today' : '',
                      isSelected || isRangeEnd ? 'selected' : '',
                      isBetween ? 'in-range' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => pickDateCellDay(type, day, onCommit)}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            {type === 'datetime' && (
              <div className="lv-datepick-time">
                <span>{t('crm.projects.list.datePicker.time', 'Время')}</span>
                <input
                  type="time"
                  value={dateCellTimeDraft}
                  onChange={(e) => setDateCellTimeDraft(e.target.value)}
                />
              </div>
            )}
            <div className="lv-datepick-foot">
              <button
                type="button"
                className="lv-popover-link"
                onClick={() => {
                  setDateCellSelectedDate(null);
                  setDateCellRangeEnd(null);
                  if (type === 'daterange') commitDateRangeValue(onCommit, null, null);
                  else commitDateCellValue(type === 'datetime' ? 'datetime' : 'date', null, onCommit);
                  setDateCellEditor(null);
                }}
              >
                {t('crm.projects.list.datePicker.clear', 'Очистить')}
              </button>
              <button
                type="button"
                className="lv-popover-link"
                onClick={() => {
                  const now = new Date();
                  setDateCellViewDate(now);
                  if (type === 'date') {
                    setDateCellSelectedDate(now);
                    commitDateCellValue('date', now, onCommit);
                    setDateCellEditor(null);
                  } else if (type === 'datetime') {
                    setDateCellSelectedDate(now);
                  }
                }}
              >
                {t('crm.projects.list.datePicker.today', 'Сегодня')}
              </button>
              {(type === 'datetime' || type === 'daterange') && (
                <button
                  type="button"
                  className="lv-tb-btn active"
                  onClick={() => {
                    if (type === 'daterange') commitDateRangeValue(onCommit, dateCellSelectedDate, dateCellRangeEnd);
                    else commitDateCellValue('datetime', dateCellSelectedDate, onCommit);
                    setDateCellEditor(null);
                  }}
                >
                  {t('crm.common.done', 'Готово')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCustomFieldCell = (project: Project, field: CustomField) => {
    const value = project.customFields?.[field.key];
    const commonClass =
      'w-full bg-transparent border-0 outline-none text-[12.5px] text-[#222] focus:shadow-[inset_0_0_0_1.5px_#222222]';

    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => {
              const next = {
                ...(project.customFields ?? {}),
                [field.key]: e.target.checked,
              };
              updateProjectInline(project.id, { customFields: next });
            }}
            onClick={(e) => e.stopPropagation()}
            className="lv-checkbox-input"
          />
          {Boolean(value)
            ? t('crm.projects.list.boolean.yes')
            : t('crm.projects.list.boolean.no')}
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <select
          className="w-full bg-transparent border-0 outline-none text-[12.5px] text-[#222] focus:shadow-[inset_0_0_0_1.5px_#222222] rounded"
          value={value ?? ''}
          onChange={(e) => {
            const next = {
              ...(project.customFields ?? {}),
              [field.key]: e.target.value || null,
            };
            updateProjectInline(project.id, { customFields: next });
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">—</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'multiselect') {
      const arrayValue = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'string' && value
          ? value.split(',').map((v) => v.trim())
          : [];
      return (
        <select
          multiple
          className={commonClass}
          value={arrayValue}
          onChange={(e) => {
            const nextValue = Array.from(e.target.selectedOptions).map((o) => o.value);
            const next = {
              ...(project.customFields ?? {}),
              [field.key]: nextValue,
            };
            updateProjectInline(project.id, { customFields: next });
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'date' || field.type === 'datetime' || field.type === 'daterange') {
      return renderDateCellPicker(`cf:${project.id}:${field.id}`, field.type, value, (next) => {
        updateProjectInline(project.id, { customFields: { ...(project.customFields ?? {}), [field.key]: next } });
      });
    }

    // email/phone привязанные к реальному лиду/компании — только чтение, без ручного ввода.
    if ((field.type === 'email' || field.type === 'phone') && field.meta?.source && field.meta.source !== 'manual') {
      const source = field.meta.source;
      const lead = source === 'lead' && project.leadId ? leads.find((l) => l.id === project.leadId) : null;
      const company = source === 'company' && project.companyId ? companies.find((c) => c.id === project.companyId) : null;
      const computed = source === 'lead'
        ? (field.type === 'email' ? lead?.email : lead?.phone)
        : (field.type === 'email' ? company?.email : company?.phone);
      const strComputed = (computed ?? '').toString().trim();
      const sourceLabel = source === 'lead'
        ? t('crm.projects.list.columns.sourceLead', 'Из лида')
        : t('crm.projects.list.columns.sourceCompany', 'Из компании');
      if (!strComputed) {
        return (
          <span className="lv-cell-computed-empty" title={sourceLabel}>—</span>
        );
      }
      const href = field.type === 'email' ? `mailto:${strComputed}` : `tel:${strComputed}`;
      return (
        <div className="lv-cell-linklike" onClick={(e) => e.stopPropagation()}>
          <a href={href} className="lv-cell-pill lv-cell-pill-readonly" title={sourceLabel}>
            <span className="lv-link-chip-icon">{fieldTypeIcon(field.type)}</span>
            <span className="lv-link-chip-text">{strComputed}</span>
          </a>
        </div>
      );
    }

    if (field.type === 'email' || field.type === 'phone') {
      const cellKey = `cf:${project.id}:${field.id}`;
      const strValue = typeof value === 'string' ? value.trim() : '';
      const isEditing = linkLikeEditKey === cellKey;

      if (!isEditing) {
        if (!strValue) {
          // Ничего не введено вручную — прежде чем показать пустую ячейку,
          // пробуем реальные данные проекта: сначала привязанного лида, потом компанию.
          const lead = project.leadId ? leads.find((l) => l.id === project.leadId) : null;
          const company = project.companyId ? companies.find((c) => c.id === project.companyId) : null;
          const autoValue = (
            (field.type === 'email' ? lead?.email : lead?.phone) ||
            (field.type === 'email' ? company?.email : company?.phone) ||
            ''
          ).toString().trim();
          if (autoValue) {
            const autoHref = field.type === 'email' ? `mailto:${autoValue}` : `tel:${autoValue}`;
            const autoSourceLabel = (field.type === 'email' ? lead?.email : lead?.phone)
              ? t('crm.projects.list.columns.sourceLeadAuto', 'Автоматически из лида')
              : t('crm.projects.list.columns.sourceCompanyAuto', 'Автоматически из компании');
            return (
              <div className="lv-cell-linklike" onClick={(e) => { e.stopPropagation(); setLinkLikeEditKey(cellKey); }}>
                <a href={autoHref} className="lv-cell-pill lv-cell-pill-auto" title={autoSourceLabel} onClick={(e) => e.stopPropagation()}>
                  <span className="lv-link-chip-icon">{fieldTypeIcon(field.type)}</span>
                  <span className="lv-link-chip-text">{autoValue}</span>
                </a>
              </div>
            );
          }
          return (
            <button
              type="button"
              className="lv-cell-empty"
              onClick={(e) => { e.stopPropagation(); setLinkLikeEditKey(cellKey); }}
            >
              —
            </button>
          );
        }
        const href = field.type === 'email' ? `mailto:${strValue}` : `tel:${strValue}`;
        return (
          <div className="lv-cell-linklike" onClick={(e) => { e.stopPropagation(); setLinkLikeEditKey(cellKey); }}>
            <a href={href} className="lv-cell-pill" onClick={(e) => e.stopPropagation()}>
              <span className="lv-link-chip-icon">{fieldTypeIcon(field.type)}</span>
              <span className="lv-link-chip-text">{strValue}</span>
            </a>
          </div>
        );
      }

      return (
        <input
          ref={(el) => el?.focus()}
          className="lv-cell-inline-input"
          type={field.type === 'email' ? 'email' : 'tel'}
          defaultValue={strValue}
          placeholder={field.type === 'email' ? 'email@example.com' : '+7 900 000-00-00'}
          onBlur={(e) => {
            const next = { ...(project.customFields ?? {}), [field.key]: e.target.value };
            updateProjectInline(project.id, { customFields: next });
            setLinkLikeEditKey(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setLinkLikeEditKey(null);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    // «Ссылка»: значение выбирается из реальных файлов/ссылок проекта (вкладка «Файлы»),
    // либо вставляется вручную — ссылка на существующий файл ищется по совпадению url.
    if (field.type === 'url') {
      const cellKey = `cf:${project.id}:${field.id}`;
      const strValue = typeof value === 'string' ? value.trim() : '';
      const isOpen = linkLikeEditKey === cellKey;
      const projectFiles = project.files ?? [];
      // Ничего не выбрано вручную — по умолчанию берём первую реальную ссылку проекта
      // (вкладка «Файлы»), а не пустую ячейку. Явный ручной выбор всегда в приоритете.
      const isAuto = !strValue && projectFiles.length > 0;
      const effectiveValue = strValue || (isAuto ? projectFiles[0].url : '');
      const meta = effectiveValue ? detectLinkProvider(effectiveValue, project.files) : null;

      const commitLink = (url: string) => {
        const next = { ...(project.customFields ?? {}), [field.key]: url };
        updateProjectInline(project.id, { customFields: next });
        setLinkLikeEditKey(null);
      };

      return (
        <div className="relative lv-cell-linklike" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            ref={isOpen ? linkCellAnchorRef : undefined}
            data-lv-linkpick-anchor
            className={effectiveValue ? 'lv-cell-linklike-trigger' : 'lv-cell-empty'}
            onClick={() => setLinkLikeEditKey(isOpen ? null : cellKey)}
          >
            {effectiveValue ? (
              <span className={`lv-cell-pill${isAuto ? ' lv-cell-pill-auto' : ''}`} title={isAuto ? t('crm.projects.list.columns.sourceFilesAuto', 'Автоматически из файлов проекта') : meta!.label}>
                <span className="lv-link-chip-icon">{LINK_PROVIDER_ICONS[meta!.provider] ?? fieldTypeIcon('url')}</span>
                {t('crm.projects.list.linkChip.label', 'Ссылка')}
              </span>
            ) : '—'}
          </button>
          {effectiveValue && (
            <a
              href={toHref(effectiveValue)}
              target="_blank"
              rel="noreferrer"
              className="lv-link-open-btn"
              title={t('crm.projects.list.linkChip.open', 'Открыть ссылку')}
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6.5 3.5H4a1.5 1.5 0 00-1.5 1.5v7A1.5 1.5 0 004 13.5h7A1.5 1.5 0 0012.5 12V9.5M9 3h4v4M12.5 3.5L7 9" />
              </svg>
            </a>
          )}
          {isOpen && linkCellPopoverLayout && (
            <div
              data-lv-linkpick-popover
              className="lv-popover lv-linkpick-popover"
              style={linkCellPopoverLayout.style}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="lv-popover-title">{t('crm.projects.list.columns.linkPickTitle', 'Ссылки проекта')}</div>
              {projectFiles.length > 0 ? (
                <div className="lv-popover-list" style={{ maxHeight: linkCellPopoverLayout.scrollMaxHeight, padding: 0 }}>
                  {projectFiles.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`lv-popover-item${f.url === effectiveValue ? ' active' : ''}`}
                      onClick={() => commitLink(f.url)}
                    >
                      <span className="lv-link-chip-icon">{LINK_PROVIDER_ICONS[f.provider] ?? fieldTypeIcon('url')}</span>
                      <span className="lv-linkpick-item-label">{f.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="lv-linkpick-empty-hint">
                  {t('crm.projects.list.columns.linkPickEmpty', 'В проекте пока нет прикреплённых ссылок — добавьте их во вкладке «Файлы», либо вставьте адрес вручную ниже.')}
                </div>
              )}
              <div className="lv-linkpick-manual">
                <input
                  type="url"
                  className="lv-coltype-input"
                  placeholder={t('crm.projects.list.columns.linkPickManual', 'Или вставьте ссылку вручную')}
                  defaultValue={strValue}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitLink((e.target as HTMLInputElement).value.trim()); }}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== strValue) commitLink(v);
                  }}
                />
              </div>
              {strValue && (
                <button type="button" className="lv-linkpick-clear" onClick={() => commitLink('')}>
                  {t('crm.projects.list.columns.linkPickClear', 'Очистить')}
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    const inputType = field.type === 'number' ? 'number' : 'text';

    return (
      <input
        className={commonClass}
        type={inputType}
        value={value ?? ''}
        onChange={(e) => {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === project.id
                ? {
                    ...p,
                    customFields: {
                      ...(p.customFields ?? {}),
                      [field.key]: e.target.value,
                    },
                  }
                : p,
            ),
          );
        }}
        onBlur={(e) => {
          const next = {
            ...(project.customFields ?? {}),
            [field.key]:
              field.type === 'number'
                ? e.target.value === ''
                  ? null
                  : Number(e.target.value)
                : e.target.value,
          };
          updateProjectInline(project.id, { customFields: next });
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const statusCls = (status: string) => {
    switch (status) {
      case 'Новый':       return 'lv-st lv-st-new';
      case 'В работе':   return 'lv-st lv-st-progress';
      case 'На проверке': return 'lv-st lv-st-review';
      case 'Заморожен':  return 'lv-st lv-st-paused';
      case 'Закрыт':     return 'lv-st lv-st-closed';
      case 'Выиграно':   return 'lv-st lv-st-won';
      case 'Проиграно':  return 'lv-st lv-st-lost';
      default:           return 'lv-st lv-st-closed';
    }
  };

  const taskStatusCls = (status: ProjectTask['status']) => {
    switch (status) {
      case 'К выполнению':
        return 'lv-st lv-st-new';
      case 'В работе':
        return 'lv-st lv-st-progress';
      case 'На проверке':
        return 'lv-st lv-st-review';
      case 'Заблокировано':
        return 'lv-st lv-st-lost';
      case 'Отложено':
        return 'lv-st lv-st-paused';
      case 'Готово':
        return 'lv-st lv-st-won';
      default:
        return 'lv-st lv-st-closed';
    }
  };

  const taskPriorityCls = (priority: ProjectTask['priority']) => {
    switch (priority) {
      case 'Высокий':
        return 'lv-st lv-st-lost';
      case 'Низкий':
        return 'lv-st lv-st-won';
      case 'Обычный':
      default:
        return 'lv-st lv-st-closed';
    }
  };

  const colorBarStyle = (status: string): React.CSSProperties => ({
    background: statusColorFor(status),
  });

  const renderCell = (project: Project, column: any) => {
    switch (column.id) {
      case 'name': {
        const isExpanded = expandedProjectIds.includes(project.id);
        return (
          <div className="lv-cell-name">
            <div className="lv-color-bar" style={colorBarStyle(project.status)} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isExpanded) { toggleProjectExpanded(project.id); return; }
                openProjectTasksPanel(project);
              }}
              className={`lv-task-toggle${isExpanded ? ' expanded' : ''}`}
              title={t('crm.projects.tasks.title')}
              aria-expanded={isExpanded}
            >
              <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden>
                <path d="M4.5 3L7.5 6L4.5 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span
              className="lv-name-text"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateProjectInline(project.id, { name: e.currentTarget.textContent ?? project.name })}
              onClick={(e) => e.stopPropagation()}
            >
              {project.name}
            </span>
            {(project.tags || []).length > 0 && (
              <span className="lv-cell-tags">
                {(project.tags || []).map((tag) => (
                  <span key={tag} className="lv-cell-tag">#{tag}</span>
                ))}
              </span>
            )}
          </div>
        );
      }
      case 'owner': {
        const owners = resolveOwners(project);
        const ownerEditorOpen = ownerEditorId === project.id;
        const filteredStaff = staff.filter((u) =>
          ownerSearch ? u.fullName.toLowerCase().includes(ownerSearch.toLowerCase()) : true,
        );
        return (
          <div className="relative" ref={ownerEditorOpen ? ownerMenuRef : undefined}>
            <div className="lv-owners" onClick={(e) => e.stopPropagation()}>
              {owners.map((owner, idx) => {
                const label = typeof owner === 'string' ? owner : owner.fullName;
                const avatarUrl = typeof owner === 'string' ? null : owner.avatarUrl;
                return (
                  <div key={label} className={`lv-ava${idx === 0 ? ' dark' : ''}`} title={label}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initialsFromName(label)}
                  </div>
                );
              })}
              <button
                ref={ownerEditorOpen ? ownerAnchorRef : undefined}
                type="button"
                data-lv-owner-popover-anchor
                onClick={(e) => { e.stopPropagation(); openOwnerEditor(project); }}
                className="lv-owner-add"
                title={t('crm.projects.list.owner.edit')}
              >+</button>
            </div>
            {ownerEditorOpen && ownerPopoverLayout && (
              <div
                className="lv-owner-popover lv-owner-popover--fixed"
                style={ownerPopoverLayout.style}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="lv-popover-title">{t('crm.projects.list.owner.title')}</div>
                <div className="lv-popover-search">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>
                  <input
                    autoFocus
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    placeholder={t('crm.projects.list.owner.search')}
                  />
                </div>
                <div className="lv-owner-pop-list" style={{ maxHeight: ownerPopoverLayout.scrollMaxHeight }}>
                  {filteredStaff.map((u) => (
                    <div
                      key={u.id}
                      className={`lv-owner-pop-item${ownerDraftIds.includes(u.id) ? ' on' : ''}`}
                      onClick={() => toggleOwnerDraft(u.id)}
                    >
                      <div className="ava">
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt={u.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initialsFromName(u.fullName)}
                      </div>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.fullName}</span>
                      <span className="check">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l4 4 10-10"/></svg>
                      </span>
                    </div>
                  ))}
                  {!filteredStaff.length && (
                    <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.projects.list.owner.empty')}</div>
                  )}
                </div>
                <div className="lv-owner-pop-foot">
                  <button type="button" className="lv-tb-btn" onClick={() => setOwnerEditorId(null)}>{t('crm.common.cancel')}</button>
                  <button type="button" className="lv-tb-btn" style={{ background: '#222', color: '#fff', borderColor: '#222' }} onClick={() => saveOwnerSelection(project)}>{t('crm.common.save')}</button>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'lead':
        return (
          <WorkspaceCrmEntityMultiField
            entity="lead"
            rawValue={project.leadId}
            leads={leads}
            projects={[]}
            companies={companies}
            variant="table"
            onCommit={(serialized) => {
              const ids = parseCrmEntityIdsFromCell(serialized);
              const id = ids[0] ?? null;
              void (async () => {
                let lead = id ? leads.find((l) => l.id === id) : null;
                if (id && !lead) {
                  try {
                    lead = await fetchLeadById(id);
                    setLeads((prev) =>
                      prev.some((l) => l.id === id) ? prev : [...prev, lead!],
                    );
                  } catch {
                    lead = null;
                  }
                }
                await updateProjectInline(project.id, {
                  leadId: id,
                  leadName: lead?.name ?? null,
                  leadEmail: lead?.email ?? null,
                });
              })();
            }}
          />
        );
      case 'company':
        return (
          <WorkspaceCrmEntityMultiField
            entity="company"
            rawValue={project.companyId ?? ''}
            leads={[]}
            projects={[]}
            companies={companies}
            variant="table"
            onCommit={(serialized) => {
              const ids = parseCrmEntityIdsFromCell(serialized);
              const cid = ids[0] ?? null;
              void (async () => {
                let comp = cid ? companies.find((c) => c.id === cid) : null;
                if (cid && !comp) {
                  try {
                    comp = await fetchCompany(cid);
                    setCompanies((prev) =>
                      prev.some((c) => c.id === cid) ? prev : [...prev, comp!],
                    );
                  } catch {
                    comp = null;
                  }
                }
                await updateProjectInline(project.id, {
                  companyId: cid,
                  companyName: comp?.name ?? null,
                });
              })();
            }}
          />
        );
      case 'status': {
        const isOpen = statusOpenId === project.id;
        return (
          <div>
            <button
              type="button"
              className={statusCls(project.status)}
              style={statusPillStyle(project.status)}
              onClick={(e) => {
                e.stopPropagation();
                if (isOpen) {
                  setStatusOpenId(null);
                  setStatusPopoverPos(null);
                } else {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setStatusPopoverPos({ top: rect.bottom + 6, left: rect.left });
                  setStatusOpenId(project.id);
                }
              }}
            >
              <span className="dot" style={{ background: statusPillStyle(project.status).dot }} />
              {statusLabels[project.status as ProjectStatus] ?? project.status}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
        );
      }
      case 'progress': {
        const percent = progressValue(project);
        const isDone = percent === 100;
        return (
          <div className="lv-cell-progress">
            <div className="lv-progress-track">
              <div className={`lv-progress-fill${percent === 0 ? ' zero' : ''}`} style={{ width: `${percent}%` }} />
            </div>
            <span className={`lv-progress-pct${isDone ? ' done' : ''}`}>{percent}%</span>
          </div>
        );
      }
      case 'amount': {
        const currencyCode = project.currency || 'EUR';
        const currencyOptions = currencyDefs.length ? currencyDefs.map((c) => c.code) : ['EUR', 'USD', 'TRY'];
        if (!currencyOptions.includes(currencyCode)) currencyOptions.push(currencyCode);
        return (
          <div className="lv-cell-amount">
            <input
              type="number"
              value={project.amount}
              onChange={(e) =>
                setProjects((prev) =>
                  prev.map((proj) =>
                    proj.id === project.id
                      ? { ...proj, amount: Number(e.target.value || 0) }
                      : proj,
                  ),
                )
              }
              onBlur={(e) => updateProjectInline(project.id, { amount: Number(e.target.value || 0) })}
              onClick={(e) => e.stopPropagation()}
            />
            <select
              className="lv-cell-amount-currency"
              value={currencyCode}
              onChange={(e) => updateProjectInline(project.id, { currency: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            >
              {currencyOptions.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
        );
      }
      case 'created': {
        const dateStr = project.createdAt ? String(project.createdAt) : null;
        if (!dateStr) return <span className="lv-cell-date">—</span>;
        const [datePart, timePart] = dateStr.split('T');
        return (
          <span className="lv-cell-date">
            {datePart}{timePart && <span className="time"> {timePart.slice(0, 5)}</span>}
          </span>
        );
      }
      default:
        if (column.field) return renderCustomFieldCell(project, column.field);
        return null;
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchProjects({ tableId: tableIdParam ?? undefined }),
      fetchLeadsList(),
      fetchCompanies({ limit: 500 }),
      fetchStaff(),
    ])
      .then(async ([projRes, leadsData, companiesRes, staffUsers]) => {
        if (!alive) return;
        const activeLeads = leadsData.filter((lead) => !Boolean(lead.meta?.deleted));

        const leadsMap: Record<string, Lead> = {};
        activeLeads.forEach((l) => {
          leadsMap[l.id] = l;
        });

        const companiesMap: Record<string, Company> = {};
        companiesRes.items.forEach((c) => {
          companiesMap[c.id] = c;
        });

        setCompanies(companiesRes.items);
        setLeads(activeLeads);
        setStaff(staffUsers);

        const enriched = projRes.items.map((p) => {
          const lead = p.leadId ? leadsMap[p.leadId] : undefined;
          const companyId = p.companyId ?? lead?.companyId ?? null;
          const company = companyId ? companiesMap[companyId] : undefined;
          return {
            ...p,
            leadName: lead?.name ?? p.leadName ?? null,
            leadEmail: lead?.email ?? p.leadEmail ?? null,
            companyId,
            companyName: company?.name ?? p.companyName ?? null,
          };
        });

        let filtered = enriched;
        if (selectedCompanyId) {
          filtered = enriched.filter((p) => p.companyId === selectedCompanyId);
        }

        setProjects(filtered);
        try {
          const detailed = await Promise.all(
            filtered.map((p) => fetchProject(p.id).catch(() => p)),
          );
          if (!alive) return;
          const byId = new Map(detailed.map((p) => [p.id, p]));
          setProjects((prev) =>
            prev.map((p) => {
              const full = byId.get(p.id);
              if (!full) return p;
              const cached = readTasksCache(full.id);
              const source =
                full.tasks && full.tasks.length > 0 ? full.tasks : cached ?? [];
              if (source.length > 0) writeTasksCache(full.id, source);
              return { ...p, tasks: source };
            }),
          );
        } catch (err) {
          console.error(err);
        }
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setError(e.message || t('crm.projects.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedCompanyId, tableIdParam]);

  useEffect(() => {
    let alive = true;
    fetchCustomFields('project')
      .then((items) => {
        if (!alive) return;
        setCustomFields([...items].sort((a, b) => a.order - b.order));
      })
      .catch((e) => console.error('Ошибка загрузки кастомных полей:', e));
    return () => {
      alive = false;
    };
  }, []);

  const colFallbackWidth = (id: string) => {
    if (id === 'name') return 300;
    if (id === 'owner') return 160;
    if (id === 'lead') return 200;
    if (id === 'company') return 200;
    if (id === 'status') return 160;
    if (id === 'progress') return 180;
    if (id === 'amount') return 140;
    if (id === 'created') return 170;
    return 180;
  };

  const toggleTaskDrawerFieldMenu = (
    e: React.MouseEvent,
    kind: 'status' | 'priority',
    projectId: string,
    taskId: string,
  ) => {
    e.stopPropagation();
    setOpenAssigneeMenuId(null);
    setOpenNewAssigneesProjectId(null);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTaskDrawerMenu((prev) =>
      prev &&
      prev.kind === kind &&
      prev.projectId === projectId &&
      prev.taskId === taskId
        ? null
        : { kind, projectId, taskId, top: rect.bottom + 6, left: rect.left },
    );
  };

  // Кнопки «Шаблон» / «ИИ» для задач — живут в общем тулбаре страницы, рядом с «Экспорт»,
  // и действуют на текущий развёрнутый проект (последний открытый в expandedProjectIds).
  const renderTaskTemplateAndAiButtons = (p: Project | null) => {
    // Для кнопки «ИИ» (в отличие от «Шаблон») не обязательно разворачивать строку проекта —
    // можно выбрать его прямо в попапе, чтобы не заставлять пользователя лишний раз кликать.
    const aiProject = p ?? (aiTasksPickedProjectId ? projects.find((pr) => pr.id === aiTasksPickedProjectId) ?? null : null);
    const aiPickerList = aiTasksPickerSearch.trim()
      ? filteredProjects.filter((pr) => pr.name.toLowerCase().includes(aiTasksPickerSearch.trim().toLowerCase()))
      : filteredProjects;
    return (
    <>
      <div className="relative">
        <button
          type="button"
          data-lv-task-template-anchor
          className={`lv-tb-btn${templateMenuOpen ? ' active' : ''}`}
          onClick={() => {
            setAiTasksOpenFor(null);
            setTemplateMenuOpen((prev) => !prev);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
          {t('crm.common.template', 'Шаблон')}
        </button>
        {templateMenuOpen && (
          <div data-lv-task-template-popover className="lv-popover" style={{ top: 'calc(100% + 6px)', right: 0, left: 'auto', minWidth: 240 }}>
            <div className="lv-popover-title">{t('crm.projects.list.templates.tableTitle', 'Шаблон колонок таблицы')}</div>
            <div className="lv-popover-list">
              {PROJECT_TABLE_TEMPLATES.map((tpl) => {
                const isActive = PROJECT_BASE_COLUMN_IDS.every(
                  (id) => tpl.cols[id] === !hiddenColumns.includes(id),
                );
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`lv-popover-item${isActive ? ' active' : ''}`}
                    onClick={() => applyProjectColumnTemplate(tpl)}
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                  >
                    <span style={{ fontWeight: 500 }}>{tpl.label}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tpl.hint}</span>
                  </button>
                );
              })}
            </div>
            <div className="lv-popover-title" style={{ marginTop: 4 }}>
              {t('crm.projects.tasks.templates.title', 'Шаблон колонок задач')}{p ? ` · ${p.name}` : ''}
            </div>
            {p ? (
              <div className="lv-popover-list">
                {TASK_TABLE_TEMPLATES.map((tpl) => {
                  const isActive =
                    taskColumnVisibility.owner === tpl.cols.owner &&
                    taskColumnVisibility.status === tpl.cols.status &&
                    taskColumnVisibility.priority === tpl.cols.priority &&
                    taskColumnVisibility.deadline === tpl.cols.deadline;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      className={`lv-popover-item${isActive ? ' active' : ''}`}
                      onClick={() => applyTaskTemplate(tpl)}
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                    >
                      <span style={{ fontWeight: 500 }}>{tpl.label}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{tpl.hint}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '4px 10px 8px', fontSize: 11, color: 'var(--fg-3)' }}>
                {t('crm.projects.tasks.templates.needProject', 'Разверните проект, чтобы настроить колонки его задач')}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          data-lv-ai-tasks-anchor
          className={`lv-tb-btn${aiTasksOpenFor === (p ? p.id : AI_TASKS_NO_PROJECT_KEY) ? ' active' : ''}`}
          onClick={() => openAiTasksFor(p ? p.id : AI_TASKS_NO_PROJECT_KEY)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/></svg>
          {t('crm.projects.tasks.ai.button', 'ИИ')}
        </button>
        {aiTasksOpenFor === (p ? p.id : AI_TASKS_NO_PROJECT_KEY) && (
          <div data-lv-ai-tasks-popover className="lv-popover" style={{ top: 'calc(100% + 6px)', right: 0, left: 'auto', minWidth: 320, maxWidth: 360 }}>
            <div className="lv-popover-title">{t('crm.projects.tasks.ai.title', 'Создать задачи с ИИ')}{aiProject ? ` · ${aiProject.name}` : ''}</div>
            {!aiProject ? (
              <div style={{ padding: '0 4px 8px' }}>
                <div className="lv-popover-search">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-4)' }} aria-hidden>
                    <circle cx="5.5" cy="5.5" r="4.5" /><path d="M9.5 9.5L13 13" />
                  </svg>
                  <input
                    autoFocus
                    type="text"
                    value={aiTasksPickerSearch}
                    onChange={(e) => setAiTasksPickerSearch(e.target.value)}
                    placeholder={t('crm.projects.tasks.ai.pickProjectSearch', 'Выберите проект...')}
                  />
                </div>
                <div className="lv-popover-list" style={{ maxHeight: 220 }}>
                  {aiPickerList.map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      className="lv-popover-item"
                      onClick={() => setAiTasksPickedProjectId(pr.id)}
                    >
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.name}</span>
                    </button>
                  ))}
                  {!aiPickerList.length && (
                    <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.projects.list.owner.empty', 'Ничего не найдено')}</div>
                  )}
                </div>
              </div>
            ) : (
            <div style={{ padding: '0 4px 8px' }}>
              {p ? null : (
                <button type="button" className="lv-popover-link" style={{ marginBottom: 6 }} onClick={() => setAiTasksPickedProjectId(null)}>
                  {t('crm.projects.tasks.ai.changeProject', '← сменить проект')}
                </button>
              )}
              <textarea
                autoFocus
                value={aiTasksPrompt}
                onChange={(e) => setAiTasksPrompt(e.target.value)}
                placeholder={t('crm.projects.tasks.ai.placeholder', 'Опишите, какие задачи нужны, например: подготовить лендинг, собрать ТЗ и назначить дизайнера')}
                rows={3}
                style={{ width: '100%', resize: 'vertical', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', outline: 0 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); runAiTasksGenerate(aiProject); }
                }}
              />
              {aiTasksError && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>{aiTasksError}</div>}
              {aiTasksNote && <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 6 }}>{aiTasksNote}</div>}
              {!aiTasksSuggestions && !aiFieldsSuggestions && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="button"
                    className="lv-tb-btn active"
                    disabled={aiTasksBusy || !aiTasksPrompt.trim()}
                    onClick={() => runAiTasksGenerate(aiProject)}
                  >
                    {aiTasksBusy ? t('crm.projects.tasks.ai.generating', 'Генерирую…') : t('crm.projects.tasks.ai.generate', 'Сгенерировать')}
                  </button>
                </div>
              )}
            </div>
            )}
            {(aiTasksSuggestions || aiFieldsSuggestions) && (
              <>
                {aiTasksSuggestions && aiTasksSuggestions.length > 0 && (
                  <div className="lv-popover-list" style={{ maxHeight: 240 }}>
                    {aiTasksSuggestions.map((task, idx) => (
                      <label key={idx} className="lv-popover-item" style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={aiTasksSelected[idx] ?? false}
                          onChange={() => toggleAiTaskSelected(idx)}
                          className="lv-checkbox-input"
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--ink)' }}>{task.title}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                            {task.priority}{task.deadline ? ` · ${task.deadline}` : ''}
                          </div>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {aiFieldsSuggestions && aiFieldsSuggestions.length > 0 && (
                  <>
                    <div className="lv-popover-title" style={{ borderTop: '1px solid var(--line-3)', marginTop: 2 }}>
                      {t('crm.projects.tasks.ai.fieldsTitle', 'Колонки таблицы')}
                    </div>
                    <div className="lv-popover-list" style={{ maxHeight: 220 }}>
                      {aiFieldsSuggestions.map((f, idx) => (
                        <div key={idx} className="lv-popover-item" style={{ cursor: 'default', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={aiFieldsSelected[idx] ?? false}
                              onChange={() => toggleAiFieldSelected(idx)}
                              className="lv-checkbox-input"
                            />
                            <span className="lv-link-chip-icon">{fieldTypeIcon(f.type)}</span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--ink)' }}>{f.label}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.value || t('crm.projects.tasks.ai.emptyColumn', 'без значения — просто создать колонку')}
                              </div>
                            </span>
                          </label>
                          <select
                            value={aiFieldsTarget[idx] ?? ''}
                            onChange={(e) => setAiFieldTarget(idx, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginLeft: 25, marginTop: 2, fontSize: 10.5, color: 'var(--fg-2)', border: '1px solid var(--line-2)', borderRadius: 5, padding: '2px 5px', background: '#fff', maxWidth: 200 }}
                          >
                            <option value="">{t('crm.projects.tasks.ai.createNewColumn', '+ Новая колонка')} «{f.label}»</option>
                            {customFields.map((cf) => (
                              <option key={cf.id} value={cf.key}>{t('crm.projects.tasks.ai.useExistingColumn', 'Использовать')}: {cf.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="lv-popover-foot">
                  <button type="button" className="lv-popover-link" onClick={() => { setAiTasksSuggestions(null); setAiTasksSelected([]); setAiFieldsSuggestions(null); setAiFieldsSelected([]); setAiFieldsTarget([]); }}>
                    {t('crm.projects.tasks.ai.retry', 'Заново')}
                  </button>
                  <button
                    type="button"
                    className="lv-tb-btn active"
                    disabled={!aiTasksSelected.some(Boolean) && !aiFieldsSelected.some(Boolean)}
                    onClick={() => { if (aiProject) insertAiTasks(aiProject); }}
                  >
                    {t('crm.projects.tasks.ai.add', 'Добавить')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
    );
  };

  // Task drawer component
  const renderTaskDrawer = (p: Project) => (
    <tr className="lv-drawer-row">
      <td colSpan={orderedColumns.length + 1}>
        <div className="lv-drawer">
          <div className="lv-drawer-head">
            <span className="lv-drawer-title">{t('crm.projects.tasks.title')} · {(p.tasks || []).length}</span>
            <div className="lv-drawer-actions">
              <button type="button" className="lv-tb-btn" style={{ fontSize: 11 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>
                {t('crm.projects.list.export', 'Экспорт')}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="lv-task-table">
              <thead>
                <tr>
                  <th>{t('crm.projects.tasks.table.headers.task')}</th>
                  {taskColumnVisibility.owner && <th>{t('crm.projects.tasks.table.headers.owner')}</th>}
                  {taskColumnVisibility.status && <th>{t('crm.projects.tasks.table.headers.status')}</th>}
                  {taskColumnVisibility.priority && <th>{t('crm.projects.tasks.table.headers.priority')}</th>}
                  {taskColumnVisibility.deadline && <th>{t('crm.projects.tasks.table.headers.deadline')}</th>}
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {(p.tasks || []).map((task) => {
                  const priCls = task.priority === 'Высокий' ? 'high' : task.priority === 'Низкий' ? 'low' : 'normal';
                  return (
                    <tr key={task.id}>
                      <td style={{ width: '38%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`lv-task-pri ${priCls}`}><span className="bar" /></span>
                          <input
                            className="lv-task-input"
                            value={task.title}
                            onChange={(e) => updateTaskField(p.id, task.id, { title: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </td>
                      {taskColumnVisibility.owner && (
                      <td style={{ width: '18%' }}>
                        <div className="lv-owners">
                          {(task.assignees || []).map((entry) => {
                            const u = resolveStaffForAssigneeEntry(staffForTasks, entry);
                            const key = u?.id ?? entry;
                            const label = assigneeEntryDisplayLabel(staffForTasks, entry);
                            return (
                              <div key={key} className="lv-ava" title={label}>
                                {u?.avatarUrl
                                  ? <img src={u.avatarUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : initialsFromName(label)}
                              </div>
                            );
                          })}
                          <div className="relative">
                            <button
                              ref={
                                openAssigneeMenuId === `${p.id}:${task.id}`
                                  ? taskAssigneeAnchorRef
                                  : undefined
                              }
                              type="button"
                              data-lv-owner-popover-anchor
                              className="lv-owner-add"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTaskDrawerMenu(null);
                                const key = `${p.id}:${task.id}`;
                                setOpenAssigneeMenuId((prev) => {
                                  if (prev === key) return null;
                                  setTaskAssigneeSearch('');
                                  setTaskAssigneeDraftIds(
                                    normalizeAssigneesToStaffIds(task.assignees ?? [], staffForTasks),
                                  );
                                  return key;
                                });
                              }}
                            >
                              +
                            </button>
                          </div>
                          {openAssigneeMenuId === `${p.id}:${task.id}` &&
                            taskAssigneePopoverLayout && (
                              <div
                                data-lv-task-assignee-popover
                                className="lv-owner-popover lv-owner-popover--fixed"
                                style={taskAssigneePopoverLayout.style}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="lv-popover-title">{t('crm.projects.list.owner.title')}</div>
                                <div className="lv-popover-search">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>
                                  <input
                                    value={taskAssigneeSearch}
                                    onChange={(e) => setTaskAssigneeSearch(e.target.value)}
                                    placeholder={t('crm.projects.list.owner.search')}
                                  />
                                </div>
                                <div className="lv-owner-pop-list" style={{ maxHeight: taskAssigneePopoverLayout.scrollMaxHeight }}>
                                  {filteredStaffForTaskAssignees.map((u) => (
                                    <div
                                      key={u.id}
                                      className={`lv-owner-pop-item${taskAssigneeDraftIds.includes(u.id) ? ' on' : ''}`}
                                      onClick={() => toggleTaskAssigneeDraftId(u.id)}
                                    >
                                      <div className="ava">
                                        {u.avatarUrl
                                          ? <img src={u.avatarUrl} alt={u.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          : initialsFromName(u.fullName)}
                                      </div>
                                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.fullName}</span>
                                      <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l4 4 10-10"/></svg></span>
                                    </div>
                                  ))}
                                  {!filteredStaffForTaskAssignees.length && (
                                    <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.projects.list.owner.empty')}</div>
                                  )}
                                </div>
                                <div className="lv-owner-pop-foot">
                                  <button type="button" className="lv-tb-btn" onClick={() => setOpenAssigneeMenuId(null)}>{t('crm.common.cancel')}</button>
                                  <button type="button" className="lv-tb-btn" style={{ background: '#222', color: '#fff', borderColor: '#222' }} onClick={() => saveTaskAssigneesFromDraft(p.id, task.id)}>{t('crm.common.save')}</button>
                                </div>
                              </div>
                            )}
                        </div>
                      </td>
                      )}
                      {taskColumnVisibility.status && (
                      <td style={{ width: '14%' }}>
                        <button
                          type="button"
                          className={`${taskStatusCls(task.status)} lv-task-field-trigger`}
                          onClick={(e) => toggleTaskDrawerFieldMenu(e, 'status', p.id, task.id)}
                        >
                          <span className="dot" />
                          {taskStatusLabels[task.status]}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                      </td>
                      )}
                      {taskColumnVisibility.priority && (
                      <td style={{ width: '12%' }}>
                        <button
                          type="button"
                          className={`${taskPriorityCls(task.priority)} lv-task-field-trigger`}
                          onClick={(e) => toggleTaskDrawerFieldMenu(e, 'priority', p.id, task.id)}
                        >
                          <span className="dot" />
                          {taskPriorityLabels[task.priority]}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                      </td>
                      )}
                      {taskColumnVisibility.deadline && (
                      <td style={{ width: '12%' }}>
                        {renderDateCellPicker(`task:${p.id}:${task.id}`, 'date', task.deadline, (next) => {
                          updateTaskField(p.id, task.id, { deadline: next });
                        })}
                      </td>
                      )}
                      <td style={{ width: 60 }}>
                        <button type="button" className="lv-task-action danger" onClick={(e) => { e.stopPropagation(); removeTaskRow(p.id, task.id); }} title={t('crm.projects.tasks.table.actions.remove')}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M8 6V4h8v2"/><rect x="6" y="6" width="12" height="14" rx="1"/></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {/* New task row */}
                <tr className="lv-task-new">
                  <td style={{ width: '38%' }}>
                    <input
                      className="lv-task-input"
                      value={getTaskDraft(p.id).title}
                      onChange={(e) => updateTaskDraft(p.id, { title: e.target.value })}
                      placeholder={t('crm.projects.tasks.newTask.placeholder')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTaskRow(p.id); } }}
                    />
                  </td>
                  {taskColumnVisibility.owner && (
                  <td style={{ width: '18%' }}>
                    <div className="relative">
                      <button
                        ref={
                          openNewAssigneesProjectId === p.id ? newTaskAssigneesAnchorRef : undefined
                        }
                        type="button"
                        className="lv-task-cell"
                        data-lv-task-assignees-anchor
                        onClick={(e) => {
                          e.stopPropagation();
                          setTaskDrawerMenu(null);
                          setOpenNewAssigneesProjectId((prev) => {
                            if (prev === p.id) return null;
                            setTaskAssigneeSearch('');
                            setNewTaskAssigneeDraftIds([...getTaskDraft(p.id).assigneeIds]);
                            return p.id;
                          });
                        }}
                      >
                        {getTaskDraft(p.id).assigneeIds.length > 0 ? `${getTaskDraft(p.id).assigneeIds.length} выбрано` : t('crm.projects.tasks.newTask.assignees')}
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                    </div>
                    {openNewAssigneesProjectId === p.id &&
                      newTaskAssigneeDraftIds != null &&
                      newTaskAssigneesPopoverLayout && (
                        <div
                          data-lv-new-task-assignees-popover
                          className="lv-owner-popover lv-owner-popover--fixed"
                          style={newTaskAssigneesPopoverLayout.style}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="lv-popover-title">{t('crm.projects.list.owner.title')}</div>
                          <div className="lv-popover-search">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>
                            <input
                              value={taskAssigneeSearch}
                              onChange={(e) => setTaskAssigneeSearch(e.target.value)}
                              placeholder={t('crm.projects.list.owner.search')}
                            />
                          </div>
                          <div className="lv-owner-pop-list" style={{ maxHeight: newTaskAssigneesPopoverLayout.scrollMaxHeight }}>
                            {filteredStaffForTaskAssignees.map((u) => (
                              <div
                                key={u.id}
                                className={`lv-owner-pop-item${newTaskAssigneeDraftIds.includes(u.id) ? ' on' : ''}`}
                                onClick={() => toggleNewTaskAssigneeDraftId(u.id)}
                              >
                                <div className="ava">
                                  {u.avatarUrl
                                    ? <img src={u.avatarUrl} alt={u.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : initialsFromName(u.fullName)}
                                </div>
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.fullName}</span>
                                <span className="check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l4 4 10-10"/></svg></span>
                              </div>
                            ))}
                            {!filteredStaffForTaskAssignees.length && (
                              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.projects.list.owner.empty')}</div>
                            )}
                          </div>
                          <div className="lv-owner-pop-foot">
                            <button type="button" className="lv-tb-btn" onClick={() => setOpenNewAssigneesProjectId(null)}>{t('crm.common.cancel')}</button>
                            <button type="button" className="lv-tb-btn" style={{ background: '#222', color: '#fff', borderColor: '#222' }} onClick={() => saveNewTaskAssigneesFromDraft(p.id)}>{t('crm.common.save')}</button>
                          </div>
                        </div>
                      )}
                  </td>
                  )}
                  {taskColumnVisibility.status && (
                  <td style={{ width: '14%' }}>
                    <button
                      type="button"
                      className={`${taskStatusCls(getTaskDraft(p.id).status)} lv-task-field-trigger`}
                      onClick={(e) => toggleTaskDrawerFieldMenu(e, 'status', p.id, '__new__')}
                    >
                      <span className="dot" />
                      {taskStatusLabels[getTaskDraft(p.id).status]}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                  </td>
                  )}
                  {taskColumnVisibility.priority && (
                  <td style={{ width: '12%' }}>
                    <button
                      type="button"
                      className={`${taskPriorityCls(getTaskDraft(p.id).priority)} lv-task-field-trigger`}
                      onClick={(e) => toggleTaskDrawerFieldMenu(e, 'priority', p.id, '__new__')}
                    >
                      <span className="dot" />
                      {taskPriorityLabels[getTaskDraft(p.id).priority]}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                  </td>
                  )}
                  {taskColumnVisibility.deadline && (
                  <td style={{ width: '12%' }}>
                    {renderDateCellPicker(`newtask:${p.id}`, 'date', getTaskDraft(p.id).deadline || null, (next) => {
                      updateTaskDraft(p.id, { deadline: next || '' });
                    })}
                  </td>
                  )}
                  <td style={{ width: 60 }}>
                    <button type="button" className="lv-task-action" onClick={(e) => { e.stopPropagation(); addTaskRow(p.id); }} style={{ fontWeight: 500, color: getTaskDraft(p.id).title.trim() ? 'var(--ink)' : 'var(--fg-4)' }}>
                      {t('crm.projects.detail.tasks.add')}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );

  const renderProjectRow = (p: Project) => {
    const isExpanded = expandedProjectIds.includes(p.id);
    const isSelected = selectedProjectIds.includes(p.id);

    return (
      <React.Fragment key={p.id}>
        <tr className={`lv-proj-row${isSelected ? ' selected' : ''}${isExpanded ? ' expanded' : ''}`} onClick={() => handleOpen(p.id)}>
          <td className="lv-col-check" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`lv-checkbox${isSelected ? ' checked' : ''}`}
              onClick={() => toggleProjectSelected(p.id)}
              role="checkbox"
              aria-checked={isSelected}
            >
              {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l4 4 10-10"/></svg>}
            </button>
          </td>
          {orderedColumns.map((col) => {
            const width = getColumnWidth(col.id, colFallbackWidth(col.id));
            const isDragging = dragColId === col.id;
            const isDropTarget = dropColId === col.id && !isDragging;
            return (
              <td
                key={col.id}
                className={[isDragging ? 'lv-col-dragging-td' : '', isDropTarget ? 'lv-col-drop-target-td' : '', (col.id === 'owner' || col.id === 'lead') ? 'lv-td-popover' : '', ('field' in col || col.id === 'amount') ? 'lv-tcol-field' : ''].filter(Boolean).join(' ')}
                style={{ width, minWidth: width, maxWidth: width, padding: '10px 14px', borderBottom: '1px solid var(--line-3)', verticalAlign: 'middle', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {renderCell(p, col)}
              </td>
            );
          })}
        </tr>
        {isExpanded && renderTaskDrawer(p)}
      </React.Fragment>
    );
  };

  // Columns popover filtered list
  const filteredColumnsForPopover = useMemo(() => {
    if (!columnsSearch.trim()) return columns;
    const q = columnsSearch.toLowerCase();
    return columns.filter((c) => c.label.toLowerCase().includes(q));
  }, [columns, columnsSearch]);

  return (
    <MainLayout>
      <PageHelpButton topic="projects" />
      <div className="lv-pt w-full pb-8 min-w-0" style={{ marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24, width: 'calc(100% + 48px)' }}>

        {/* Page Head */}
        <div className="lv-pt-head">
          <div>
            <h1>{t('crm.projects.list.title')}</h1>
            <div className="sub">{t('crm.projects.list.subtitle')}</div>
          </div>
          <div className="lv-pt-head-actions">
            <button type="button" className="lv-tb-btn" onClick={() => setAutomationOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
              {t('crm.automations.panel.button')}
            </button>
            <button type="button" onClick={handleCreate} className="lv-tb-btn" style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14"/></svg>
              {t('crm.projects.actions.newProject')}
            </button>
          </div>
        </div>

        {/* View Tabs + Custom views (unified bar) */}
        <ProjectsViewsBar
          currentType="table"
          activeTableId={activeTableId}
          onOpenType={openType}
          onTableChange={changeTable}
          onSettingsChange={(s) => setDensity(s.density || 'comfortable')}
          onTablesChange={setResolvedTables}
          projectCount={filteredProjects.length}
        />

        {/* Error */}
        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-[8px] px-3 py-2 mb-[14px]">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-[12px] text-slate-400 mb-[14px]">
            {t('crm.projects.loading')}
          </div>
        )}

        {!loading && (
          <>
            {/* Toolbar */}
            <div className="lv-toolbar">
              {/* Search */}
              <div className="lv-tb-search" style={{ flex: '1 1 180px', maxWidth: 300 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-4)', flexShrink: 0 }} aria-hidden>
                  <circle cx="6.5" cy="6.5" r="5.5" /><path d="M11 11l3.5 3.5" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('crm.projects.list.search', 'Поиск...')}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--fg-3)', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                )}
              </div>

              <div className="lv-toolbar-divider" />

              {/* Group by */}
              <label className="lv-tb-select">
                <span className="lbl">{t('crm.projects.list.groupMode.label', 'Группировка')}:</span>
                <select
                  value={groupMode}
                  onChange={(e) => setGroupMode(e.target.value as 'status' | 'owner' | 'company' | 'none')}
                >
                  <option value="status">{t('crm.projects.list.groupMode.status')}</option>
                  <option value="owner">{t('crm.projects.list.groupMode.owner')}</option>
                  <option value="company">{t('crm.projects.list.groupMode.company')}</option>
                  <option value="none">{t('crm.projects.list.groupMode.none')}</option>
                </select>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-3)', flexShrink: 0 }} aria-hidden><path d="M6 9l6 6 6-6"/></svg>
              </label>

              {/* Company filter */}
              <label className="lv-tb-select">
                <span className="lbl">{t('crm.projects.list.filters.companyLabel')}:</span>
                <select
                  value={selectedCompanyId || ''}
                  onChange={(e) => setSelectedCompanyId(e.target.value || null)}
                  style={{ maxWidth: 140 }}
                >
                  <option value="">{t('crm.projects.list.filters.allCompanies')}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-3)', flexShrink: 0 }} aria-hidden><path d="M6 9l6 6 6-6"/></svg>
              </label>

              <div className="lv-toolbar-spacer" />

              {/* Task template / AI — действуют на текущий развёрнутый проект */}
              {renderTaskTemplateAndAiButtons(activeTaskProject)}

              {/* Export */}
              <button type="button" className="lv-tb-btn" title={t('crm.projects.list.export', 'Экспорт')} onClick={exportCsv}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M8 1v9M5 7l3 3 3-3" />
                </svg>
                {t('crm.projects.list.export', 'Экспорт')}
              </button>

              {/* Columns */}
              <div style={{ position: 'relative' }} ref={columnsMenuRef}>
                <button type="button" className={`lv-tb-btn${columnsOpen ? ' active' : ''}`} onClick={() => setColumnsOpen((prev) => !prev)}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M1 4h14M1 8h14M1 12h14" />
                  </svg>
                  {t('crm.projects.list.columns.label')}
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--fg-4)', marginLeft: 2 }}>{visibleColumns.length}/{columns.length}</span>
                </button>
                {columnsOpen && addColumnStep === 'closed' && (
                  <div className="lv-popover" style={{ top: 'calc(100% + 6px)', right: 0 }}>
                    <div className="lv-popover-title">{t('crm.projects.list.columns.label')}</div>
                    <div className="lv-popover-search">
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-4)' }} aria-hidden>
                        <circle cx="5.5" cy="5.5" r="4.5" /><path d="M9.5 9.5L13 13" />
                      </svg>
                      <input
                        type="text"
                        value={columnsSearch}
                        onChange={(e) => setColumnsSearch(e.target.value)}
                        placeholder={t('crm.projects.list.columns.search', 'Поиск колонки...')}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="lv-popover-list">
                      {filteredColumnsForPopover.map((col) => {
                        const checked = !hiddenColumns.includes(col.id);
                        const isCore = coreColumnIds.has(col.id);
                        return (
                          <label key={col.id} className="lv-popover-item" style={{ cursor: 'pointer' }}>
                            <span style={{ color: 'var(--fg-4)', fontSize: 11, fontFamily: 'var(--ff-mono)', userSelect: 'none', opacity: isCore ? 0.3 : 1 }}>⋮⋮</span>
                            <span style={{ flex: 1, color: 'var(--ink)' }}>{col.label}</span>
                            {isCore && (
                              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--fg-4)', border: '1px solid var(--line-2)', borderRadius: 3, padding: '1px 4px' }}>Core</span>
                            )}
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isCore}
                              onChange={(e) => {
                                if (e.target.checked) showColumn(col.id);
                                else hideColumn(col.id);
                              }}
                              className="lv-checkbox-input"
                            />
                          </label>
                        );
                      })}
                    </div>
                    <div className="lv-popover-foot">
                      <button type="button" className="lv-popover-link" onClick={openAddColumnTypePicker}>
                        + {t('crm.projects.list.columns.add')}
                      </button>
                      <button
                        type="button"
                        className="lv-popover-link"
                        onClick={() => { setColumnsOpen(false); setCustomFieldsOpen(true); }}
                      >
                        {t('crm.projects.list.columns.manageAll', 'Все поля…')}
                      </button>
                      <button type="button" className="lv-tb-btn" onClick={() => setColumnsOpen(false)}>
                        {t('crm.common.done', 'Готово')}
                      </button>
                    </div>
                  </div>
                )}

                {columnsOpen && addColumnStep === 'type' && (
                  <div className="lv-popover lv-coltype-popover" style={{ top: 'calc(100% + 6px)', right: 0 }}>
                    <div className="lv-popover-title lv-coltype-title">
                      <button type="button" className="lv-coltype-back" onClick={() => setAddColumnStep('closed')} aria-label="Назад">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 3.5L5 8l5 4.5" /></svg>
                      </button>
                      {t('crm.projects.list.columns.chooseType', 'Тип новой колонки')}
                    </div>
                    <div className="lv-popover-search">
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-4)' }} aria-hidden>
                        <circle cx="5.5" cy="5.5" r="4.5" /><path d="M9.5 9.5L13 13" />
                      </svg>
                      <input
                        type="text"
                        autoFocus
                        value={addColumnTypeSearch}
                        onChange={(e) => setAddColumnTypeSearch(e.target.value)}
                        placeholder={t('crm.projects.list.columns.searchType', 'Найти тип колонки...')}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="lv-coltype-grid">
                      {COLUMN_TYPE_OPTIONS.filter((opt) =>
                        opt.label.toLowerCase().includes(addColumnTypeSearch.trim().toLowerCase()),
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className="lv-coltype-item"
                          onClick={() => chooseAddColumnType(opt.value)}
                          title={opt.hint}
                        >
                          <span className="lv-coltype-icon" style={{ background: `${opt.color}1a`, color: opt.color }}>
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              {opt.icon}
                            </svg>
                          </span>
                          <span className="lv-coltype-label">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {columnsOpen && addColumnStep === 'name' && (
                  <div className="lv-popover lv-coltype-popover" style={{ top: 'calc(100% + 6px)', right: 0 }}>
                    <div className="lv-popover-title lv-coltype-title">
                      <button type="button" className="lv-coltype-back" onClick={() => setAddColumnStep('type')} aria-label="Назад">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 3.5L5 8l5 4.5" /></svg>
                      </button>
                      {t('crm.projects.list.columns.nameColumn', 'Название колонки')}
                    </div>
                    <div className="lv-coltype-namestep">
                      {(() => {
                        const opt = COLUMN_TYPE_OPTIONS.find((o) => o.value === addColumnType)!;
                        return (
                          <div className="lv-coltype-selected">
                            <span className="lv-coltype-icon" style={{ background: `${opt.color}1a`, color: opt.color }}>
                              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                {opt.icon}
                              </svg>
                            </span>
                            <span>{opt.label}</span>
                          </div>
                        );
                      })()}
                      <input
                        ref={addColumnLabelRef}
                        type="text"
                        className="lv-coltype-input"
                        value={addColumnLabel}
                        onChange={(e) => setAddColumnLabel(e.target.value)}
                        placeholder={t('crm.projects.list.columns.labelPlaceholder', 'Например: Приоритет')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (addColumnType !== 'select' && addColumnType !== 'multiselect')) submitAddColumn();
                        }}
                      />
                      {(addColumnType === 'select' || addColumnType === 'multiselect') && (
                        <input
                          type="text"
                          className="lv-coltype-input"
                          value={addColumnOptionsText}
                          onChange={(e) => setAddColumnOptionsText(e.target.value)}
                          placeholder={t('crm.projects.list.columns.optionsPlaceholder', 'Варианты через запятую')}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitAddColumn(); }}
                        />
                      )}
                      {(addColumnType === 'email' || addColumnType === 'phone') && (
                        <div className="lv-coltype-source">
                          <div className="lv-coltype-source-label">
                            {t('crm.projects.list.columns.sourceLabel', 'Откуда брать значение')}
                          </div>
                          <div className="lv-coltype-source-opts">
                            {([
                              ['manual', t('crm.projects.list.columns.sourceManual', 'Ручной ввод')],
                              ['lead', t('crm.projects.list.columns.sourceLead', 'Из лида')],
                              ['company', t('crm.projects.list.columns.sourceCompany', 'Из компании')],
                            ] as const).map(([value, srcLabel]) => (
                              <button
                                key={value}
                                type="button"
                                className={`lv-coltype-source-opt${addColumnSource === value ? ' active' : ''}`}
                                onClick={() => setAddColumnSource(value)}
                              >
                                {srcLabel}
                              </button>
                            ))}
                          </div>
                          {addColumnSource !== 'manual' && (
                            <div className="lv-coltype-source-hint">
                              {t(
                                'crm.projects.list.columns.sourceHint',
                                'Ячейка станет только для чтения и будет автоматически показывать значение из привязанного {{entity}} — если проект ни к чему не привязан, будет пусто.',
                                { entity: addColumnSource === 'lead' ? t('crm.projects.list.columns.sourceEntityLead', 'лида') : t('crm.projects.list.columns.sourceEntityCompany', 'компании') },
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {addColumnError && <div className="lv-coltype-error">{addColumnError}</div>}
                      <div className="lv-coltype-actions">
                        <button type="button" className="lv-popover-link" onClick={cancelAddColumn}>
                          {t('crm.common.cancel', 'Отмена')}
                        </button>
                        <button type="button" className="lv-tb-btn active" disabled={addColumnBusy} onClick={submitAddColumn}>
                          {addColumnBusy ? t('crm.common.saving', 'Сохранение…') : t('crm.common.create', 'Создать')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filter strip */}
            {(searchQuery || selectedCompanyId) && (
              <div className="lv-filter-strip">
                {searchQuery && (
                  <span className="lv-filter-chip">
                    <span className="key">{t('crm.projects.list.search', 'Поиск')}:</span>
                    <span className="val">«{searchQuery}»</span>
                    <button type="button" className="x" onClick={() => setSearchQuery('')}>×</button>
                  </span>
                )}
                {selectedCompanyId && (
                  <span className="lv-filter-chip">
                    <span className="key">{t('crm.projects.list.filters.companyLabel')}:</span>
                    <span className="val">{companies.find((c) => c.id === selectedCompanyId)?.name ?? selectedCompanyId}</span>
                    <button type="button" className="x" onClick={() => setSelectedCompanyId(null)}>×</button>
                  </span>
                )}
              </div>
            )}

            {/* Table */}
            <div className="lv-proj-wrap">
              <div className="lv-proj-scroll">
                <table className={`lv-proj-table lv-density-${density}`}>
                  <thead>
                    <tr>
                      <th className="lv-col-check">
                        <button
                          type="button"
                          className={`lv-checkbox${filteredProjects.length > 0 && selectedProjectIds.length === filteredProjects.length ? ' checked' : selectedProjectIds.length > 0 ? ' indet' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleAllSelected(); }}
                          role="checkbox"
                          aria-checked={filteredProjects.length > 0 && selectedProjectIds.length === filteredProjects.length}
                        >
                          {(selectedProjectIds.length > 0) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l4 4 10-10"/></svg>}
                        </button>
                      </th>
                      {orderedColumns.map((col) => {
                        const width = getColumnWidth(col.id, colFallbackWidth(col.id));
                        const isDragging = dragColId === col.id;
                        const isDropTarget = dropColId === col.id && !isDragging;
                        return (
                          <th
                            key={col.id}
                            {...(() => {
                              const props = columnDrag.getThProps(col.id, typeof col.label === 'string' ? col.label : String(col.label), '');
                              const { className: _cls, ...rest } = props as any;
                              return rest;
                            })()}
                            style={{ width, minWidth: width }}
                            className={[isDragging ? 'lv-col-dragging' : '', isDropTarget ? 'lv-col-drop-target' : '', ('field' in col || col.id === 'amount') ? 'lv-tcol-field' : ''].filter(Boolean).join(' ')}
                          >
                            <span className="lv-th-inner">
                              <span className="lv-th-grip">⋮⋮</span>
                              {col.label}
                            </span>
                            <span
                              className="lv-th-resize"
                              onMouseDown={(e) => startResize(col.id, e)}
                            />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {groupMode !== 'none'
                      ? groupedProjects.map((group) => {
                          const isCollapsed = collapsedGroups.includes(group.key);
                          const groupAmountLabel = sumsByCurrency(group.items)
                            .map((s) => formatAmount(s.amount, s.currency))
                            .join(' + ') || formatAmount(0);
                          return (
                            <React.Fragment key={group.key}>
                              <tr className="lv-proj-group-row">
                                <td colSpan={orderedColumns.length + 1}>
                                  <div className="lv-proj-group-inner">
                                    <button
                                      type="button"
                                      className={`lv-group-toggle${isCollapsed ? ' collapsed' : ''}`}
                                      onClick={() => toggleGroup(group.key)}
                                    >
                                      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                                        <path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                    {groupMode === 'status' ? (
                                      <span
                                        className={statusCls(group.key)}
                                        style={{ ...statusPillStyle(group.key), cursor: 'default', pointerEvents: 'none' }}
                                      >
                                        <span className="dot" style={{ background: statusPillStyle(group.key).dot }} />
                                        {statusLabels[group.key as ProjectStatus] ?? group.label}
                                      </span>
                                    ) : (
                                      <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--ink)' }}>{group.label}</span>
                                    )}
                                    <span className="lv-group-meta">
                                      {t('crm.projects.list.groupSummary', {
                                        count: group.items.length,
                                        amount: groupAmountLabel,
                                      })}
                                    </span>
                                    <button type="button" className="lv-group-add" onClick={handleCreate}>
                                      + {t('crm.projects.actions.newProject')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {!isCollapsed && group.items.map((p) => renderProjectRow(p))}
                            </React.Fragment>
                          );
                        })
                      : filteredProjects.map((p) => renderProjectRow(p))}

                    {!filteredProjects.length && !error && (
                      <tr>
                        <td colSpan={orderedColumns.length + 1} style={{ padding: '32px 14px', textAlign: 'center', fontSize: 12, color: 'var(--fg-3)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <LottieIcon name="empty-pulse" size={72} />
                            <span style={{ marginTop: 4 }}>{t('crm.projects.list.empty')}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="lv-proj-foot">
                <div className="lv-proj-foot-stats">
                  <span><span className="lbl">{t('crm.projects.list.summary.count', 'Всего')}:</span><strong>{filteredProjects.length}</strong></span>
                  <span>
                    <span className="lbl">{t('crm.projects.list.summary.amount', 'Сумма')}:</span>
                    <strong>
                      {totalAmountsByCurrency.length
                        ? totalAmountsByCurrency.map((s, i) => (
                            <React.Fragment key={s.currency}>
                              {i > 0 && ' + '}
                              {formatAmount(s.amount, s.currency)}
                            </React.Fragment>
                          ))
                        : formatAmount(0)}
                    </strong>
                  </span>
                  <span><span className="lbl">{t('crm.projects.list.summary.active', 'Активных')}:</span><strong>{activeCount}</strong></span>
                </div>
                <div style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>
                  {t('crm.projects.list.summary.updated', 'Обновлено только что')}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bulk action bar */}
        {selectedProjectIds.length > 0 && (
          <div className="lv-bulk-bar">
            <div className="lv-bulk-count"><strong>{selectedProjectIds.length}</strong> {t('crm.projects.list.bulk.selected', { count: selectedProjectIds.length })}</div>
            <div className="lv-bulk-divider" />
            <button type="button" className="lv-bulk-btn" style={{ position: 'relative' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h16v4H4z"/><path d="M4 8l2 12h12l2-12"/><path d="M10 12h4"/></svg>
              {t('crm.projects.list.bulk.status')}
              <select
                value={bulkStatus}
                onChange={(e) => { const val = e.target.value as Project['status'] | ''; if (val) { applyBulkStatus(val as Project['status']); setBulkStatus(''); } }}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">—</option>
                {statusOptions.map((st) => (
                  <option key={st} value={st}>{statusLabels[st] ?? st}</option>
                ))}
              </select>
            </button>
            <div className="lv-bulk-divider" />
            <button type="button" className="lv-bulk-btn" onClick={archiveSelected}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="10" rx="1" /><path d="M8 14h8" />
              </svg>
              {t('crm.projects.list.bulk.archive')}
            </button>
            <button type="button" className="lv-bulk-btn danger" onClick={deleteSelected}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18M8 6V4h8v2" /><rect x="6" y="6" width="12" height="14" rx="1" /><path d="M10 11v6M14 11v6" />
              </svg>
              {t('crm.projects.list.bulk.delete')}
            </button>
            <div className="lv-bulk-divider" />
            <button type="button" className="lv-bulk-close" onClick={() => setSelectedProjectIds([])}>×</button>
          </div>
        )}

        {/* Bulk hint modal */}
        {showBulkHint && selectedProjectIds.length > 0 && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
            <div className="relative w-full max-w-xl modal-panel p-6">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('projects_bulk_hint_hidden', '1');
                  setShowBulkHint(false);
                }}
                className="absolute right-4 top-4 text-text-tertiary hover:text-[#111827] text-[18px] leading-none"
                aria-label="close"
              >
                ×
              </button>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-[10px] bg-surface-subtle border border-border-default flex items-center justify-center text-lg flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-[#111827]">
                    {t('crm.projects.list.bulkHint.title')}
                  </div>
                  <div className="mt-1 text-[13px] text-text-secondary">
                    {t('crm.projects.list.bulkHint.subtitle')}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] text-text-secondary">
                <div className="flex items-center gap-2 rounded-[8px] border border-border-default bg-surface-subtle px-3 py-2">
                  <span>🟢</span>
                  {t('crm.projects.list.bulkHint.status')}
                </div>
                <div className="flex items-center gap-2 rounded-[8px] border border-border-default bg-surface-subtle px-3 py-2">
                  <span>🗄</span>
                  {t('crm.projects.list.bulkHint.archive')}
                </div>
                <div className="flex items-center gap-2 rounded-[8px] border border-red-200 bg-status-error-bg px-3 py-2 text-status-error">
                  <span>🗑</span>
                  {t('crm.projects.list.bulkHint.delete')}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('projects_bulk_hint_hidden', '1');
                    setShowBulkHint(false);
                  }}
                  className="btn-primary btn-secondary-sm"
                >
                  {t('crm.projects.list.bulkHint.ok')}
                </button>
              </div>
            </div>
          </div>
        )}

        {taskDrawerMenu && (
          <div
            ref={taskDrawerFieldPopoverRef}
            className="lv-st-popover"
            style={{
              position: 'fixed',
              top: taskDrawerMenu.top,
              left: taskDrawerMenu.left,
              zIndex: 70,
              maxHeight: 'min(280px, 70vh)',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {taskDrawerMenu.kind === 'status'
              ? TASK_STATUS_OPTIONS.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className="lv-st-popover-item"
                    onClick={() => {
                      if (taskDrawerMenu.taskId === '__new__') {
                        updateTaskDraft(taskDrawerMenu.projectId, { status: st });
                      } else {
                        updateTaskField(taskDrawerMenu.projectId, taskDrawerMenu.taskId, {
                          status: st,
                        });
                      }
                      setTaskDrawerMenu(null);
                    }}
                  >
                    <span className={taskStatusCls(st)} style={{ pointerEvents: 'none' }}>
                      <span className="dot" />
                      {taskStatusLabels[st]}
                    </span>
                  </button>
                ))
              : TASK_PRIORITY_OPTIONS.map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    className="lv-st-popover-item"
                    onClick={() => {
                      if (taskDrawerMenu.taskId === '__new__') {
                        updateTaskDraft(taskDrawerMenu.projectId, { priority: pr });
                      } else {
                        updateTaskField(taskDrawerMenu.projectId, taskDrawerMenu.taskId, {
                          priority: pr,
                        });
                      }
                      setTaskDrawerMenu(null);
                    }}
                  >
                    <span className={taskPriorityCls(pr)} style={{ pointerEvents: 'none' }}>
                      <span className="dot" />
                      {taskPriorityLabels[pr]}
                    </span>
                  </button>
                ))}
          </div>
        )}

        {/* Status popover (fixed, outside table layout) */}
        {statusOpenId && statusPopoverPos && (
          <div
            ref={statusPopoverRef}
            className="lv-st-popover"
            style={{ position: 'fixed', top: statusPopoverPos.top, left: statusPopoverPos.left, zIndex: 60 }}
            onClick={(e) => e.stopPropagation()}
          >
            {statusOptions.map((st) => (
              <button
                key={st}
                type="button"
                className="lv-st-popover-item"
                onClick={() => {
                  const proj = projects.find((p) => p.id === statusOpenId);
                  if (proj) updateProjectInline(proj.id, { status: st });
                  setStatusOpenId(null);
                  setStatusPopoverPos(null);
                }}
              >
                <span className={statusCls(st)} style={{ ...statusPillStyle(st), pointerEvents: 'none' }}>
                  <span className="dot" style={{ background: statusPillStyle(st).dot }} />
                  {statusLabels[st] ?? st}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Column drag ghost */}
        {colGhost && (
          <div
            className="lv-col-ghost"
            style={{ left: colGhost.x, top: colGhost.y, minWidth: 140, maxWidth: 220 }}
          >
            <div className="lv-col-ghost-head">
              <span style={{ fontSize: 11 }}>⋮⋮</span>
              {colGhost.label}
            </div>
            {colGhost.rows.map((row, i) => (
              <div key={i} className="lv-col-ghost-row">{row}</div>
            ))}
            {filteredProjects.length > 4 && (
              <div className="lv-col-ghost-row" style={{ color: 'var(--fg-3)', fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                +{filteredProjects.length - 4} ещё
              </div>
            )}
          </div>
        )}

        {customFieldsOpen && (
          <CustomFieldsManager
            entityType="project"
            title={t('crm.projects.list.customFieldsTitle')}
            suggestedKeys={suggestedKeys}
            onClose={() => setCustomFieldsOpen(false)}
            onUpdated={(items) =>
              setCustomFields([...items].sort((a, b) => a.order - b.order))
            }
          />
        )}
        <AutomationPanel
          open={automationOpen}
          onClose={() => setAutomationOpen(false)}
          entityType="project"
        />
      </div>
    </MainLayout>
  );
};
