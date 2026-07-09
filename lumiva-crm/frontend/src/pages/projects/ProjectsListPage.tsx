// src/pages/projects/ProjectsListPage.tsx

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ProjectsListPage.css';
import { MainLayout } from '../../layout/MainLayout';
import type { Project, ProjectStatus, ProjectTask } from './projectTypes';
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
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { AutomationPanel } from '../../components/AutomationPanel';
import { ProjectsViewsBar } from './ProjectsViewsBar';
import {
  filterProjectsForCustomView,
  loadProjectsViewsState,
} from './projectsViewsStore';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';
import { WorkspaceCrmEntityMultiField } from '../../components/workspace/WorkspaceCrmEntityMultiField';
import { parseCrmEntityIdsFromCell } from '../../workspace/workspaceCrmEntityIds';
import { getFixedPopoverLayout, type FixedPopoverLayout } from '../../utils/tablePopoverFixedPosition';
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
  const activeViewId = searchParams.get('view');
  const activeCustomView = useMemo(() => {
    if (!activeViewId) return null;
    return loadProjectsViewsState().customViews.find((v) => v.id === activeViewId) ?? null;
  }, [activeViewId]);

  const visibleProjects = useMemo(
    () => filterProjectsForCustomView(projects, activeCustomView),
    [projects, activeCustomView],
  );

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

  const openView = (type: 'table' | 'kanban' | 'calendar', viewId?: string) => {
    const basePath =
      type === 'table'
        ? '/projects'
        : type === 'kanban'
          ? '/projects/board'
          : '/projects/calendar';
    navigate(viewId ? `${basePath}?view=${viewId}` : basePath);
  };
  const handleOpen = (id: string) => navigate(`/projects/${id}`);
  const handleCreate = () => {
    const q = activeViewId ? `?view=${encodeURIComponent(activeViewId)}` : '';
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
  const statusOptions: Project['status'][] = [
    'Новый',
    'В работе',
    'На проверке',
    'Заморожен',
    'Закрыт',
    'Выиграно',
    'Проиграно',
  ];
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
  const coreColumnIds = useMemo(
    () =>
      new Set([
        'name',
        'owner',
        'lead',
        'company',
        'status',
        'amount',
        'created',
        'progress',
      ]),
    [],
  );

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

  const updateProjectInline = async (
    id: string,
    patch: Partial<Project>,
  ) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    try {
      const updated = await updateProject(
        { ...target, ...patch },
        patch.tasks !== undefined ? { includeEmptyTasks: true } : undefined,
      );
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
        { includeEmptyTasks: true },
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

  const totalAmount = useMemo(
    () => filteredProjects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [filteredProjects],
  );

  const activeCount = useMemo(
    () => filteredProjects.filter((p) => p.status === 'В работе').length,
    [filteredProjects],
  );

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
            className="w-3.5 h-3.5 rounded border-slate-300"
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

  const colorBarStyle = (status: string): React.CSSProperties => {
    const map: Record<string, string> = {
      'Новый': '#1769d1', 'В работе': '#3b6cb6', 'На проверке': '#c08319',
      'Заморожен': '#777', 'Закрыт': '#9a9a9a', 'Выиграно': '#1f8a5e', 'Проиграно': '#cc2f47',
    };
    return { background: map[status] ?? '#9a9a9a' };
  };

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
              <span className="dot" />
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
      case 'amount':
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
          </div>
        );
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
      fetchProjects(),
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
  }, [selectedCompanyId]);

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

  // Task drawer component
  const renderTaskDrawer = (p: Project) => (
    <tr className="lv-drawer-row">
      <td colSpan={orderedColumns.length + 1}>
        <div className="lv-drawer">
          <div className="lv-drawer-head">
            <span className="lv-drawer-title">{t('crm.projects.tasks.title')} · {(p.tasks || []).length}</span>
            <div className="lv-drawer-actions">
              <button type="button" className="lv-tb-btn" style={{ fontSize: 11 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
                {t('crm.common.template', 'Шаблон')}
              </button>
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
                  <th>{t('crm.projects.tasks.table.headers.owner')}</th>
                  <th>{t('crm.projects.tasks.table.headers.status')}</th>
                  <th>{t('crm.projects.tasks.table.headers.priority')}</th>
                  <th>{t('crm.projects.tasks.table.headers.deadline')}</th>
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
                            taskAssigneePopoverLayout &&
                            createPortal(
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
                                    autoFocus
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
                              </div>,
                              document.body,
                            )}
                        </div>
                      </td>
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
                      <td style={{ width: '12%' }}>
                        <input
                          type="date"
                          className="lv-task-input"
                          value={task.deadline || ''}
                          onChange={(e) => updateTaskField(p.id, task.id, { deadline: e.target.value || null })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
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
                      newTaskAssigneesPopoverLayout &&
                      createPortal(
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
                              autoFocus
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
                        </div>,
                        document.body,
                      )}
                  </td>
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
                  <td style={{ width: '12%' }}>
                    <input type="date" className="lv-task-input" value={getTaskDraft(p.id).deadline} onChange={(e) => updateTaskDraft(p.id, { deadline: e.target.value })} />
                  </td>
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
                className={[isDragging ? 'lv-col-dragging-td' : '', isDropTarget ? 'lv-col-drop-target-td' : '', (col.id === 'owner' || col.id === 'lead') ? 'lv-td-popover' : ''].filter(Boolean).join(' ')}
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
          activeViewId={activeViewId}
          onOpenView={openView}
          onSettingsChange={() => {}}
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
                {columnsOpen && (
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
                              style={{ width: 14, height: 14, flexShrink: 0 }}
                            />
                          </label>
                        );
                      })}
                    </div>
                    <div className="lv-popover-foot">
                      <button type="button" className="lv-popover-link" onClick={() => { setColumnsOpen(false); setCustomFieldsOpen(true); }}>
                        {t('crm.projects.list.columns.add')}
                      </button>
                      <button type="button" className="lv-tb-btn" onClick={() => setColumnsOpen(false)}>
                        {t('crm.common.done', 'Готово')}
                      </button>
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
                <table className="lv-proj-table">
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
                            className={[isDragging ? 'lv-col-dragging' : '', isDropTarget ? 'lv-col-drop-target' : ''].filter(Boolean).join(' ')}
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
                          const groupAmount = group.items.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
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
                                      <span className={statusCls(group.key)} style={{ cursor: 'default', pointerEvents: 'none' }}>
                                        <span className="dot" />
                                        {statusLabels[group.key as ProjectStatus] ?? group.label}
                                      </span>
                                    ) : (
                                      <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--ink)' }}>{group.label}</span>
                                    )}
                                    <span className="lv-group-meta">
                                      {t('crm.projects.list.groupSummary', {
                                        count: group.items.length,
                                        amount: formatAmount(groupAmount),
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
                          {t('crm.projects.list.empty')}
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
                  <span><span className="lbl">{t('crm.projects.list.summary.amount', 'Сумма')}:</span><strong>{formatAmount(totalAmount)}</strong></span>
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
                <span className={statusCls(st)} style={{ pointerEvents: 'none' }}>
                  <span className="dot" />
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
