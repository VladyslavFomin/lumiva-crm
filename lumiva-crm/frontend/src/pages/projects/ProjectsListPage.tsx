// src/pages/projects/ProjectsListPage.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import type { Project, ProjectStatus, ProjectTask } from './projectTypes';
import {
  archiveProject,
  deleteProject,
  fetchProject,
  fetchProjects,
  updateProject,
} from '../../api/projects';
import { fetchLeadsList } from '../../api/leads';
import type { Lead } from '../../api/leads';
import { fetchCompanies, type Company } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useTranslation } from 'react-i18next';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { AutomationPanel } from '../../components/AutomationPanel';
import { ProjectsViewsBar } from './ProjectsViewsBar';

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
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
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
  const [openAssigneeMenuId, setOpenAssigneeMenuId] = useState<string | null>(
    null,
  );
  const [openNewAssigneesProjectId, setOpenNewAssigneesProjectId] = useState<
    string | null
  >(null);
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const ownerMenuRef = useRef<HTMLDivElement | null>(null);
  const assigneeMenuRef = useRef<HTMLDivElement | null>(null);
  const newAssigneesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const hidden = localStorage.getItem('projects_bulk_hint_hidden');
    if (!hidden) setShowBulkHint(true);
  }, []);

  const navigate = useNavigate();
  const activeViewId = searchParams.get('view');
  const openView = (type: 'table' | 'kanban' | 'calendar', viewId?: string) => {
    const basePath =
      type === 'table'
        ? '/app/projects'
        : type === 'kanban'
          ? '/app/projects/board'
          : '/app/projects/calendar';
    navigate(viewId ? `${basePath}?view=${viewId}` : basePath);
  };
  const handleOpen = (id: string) => navigate(`/app/projects/${id}`);
  const handleCreate = () => navigate('/app/projects/new');
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
  const statusStyles = useMemo(
    () => ({
      Новый: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
      'В работе': 'bg-sky-500/15 text-sky-600 border-sky-500/30',
      'На проверке': 'bg-amber-400/30 text-amber-900 border-amber-400/40',
      Заморожен: 'bg-slate-900 text-white border-slate-900',
      Закрыт: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
      Выиграно: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      Проиграно: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
    }),
    [],
  );
  const statusGroupStyles = useMemo<Record<string, { header: string; badge: string; row: string }>>(
    () => ({
      Новый: { header: 'bg-white border-slate-200', badge: 'bg-rose-100 text-rose-700', row: '' },
      'В работе': { header: 'bg-white border-slate-200', badge: 'bg-sky-100 text-sky-700', row: '' },
      'На проверке': { header: 'bg-white border-slate-200', badge: 'bg-amber-100 text-amber-800', row: '' },
      Заморожен: { header: 'bg-white border-slate-200', badge: 'bg-slate-200 text-slate-700', row: '' },
      Закрыт: { header: 'bg-white border-slate-200', badge: 'bg-slate-100 text-slate-700', row: '' },
      Выиграно: { header: 'bg-white border-slate-200', badge: 'bg-emerald-100 text-emerald-700', row: '' },
      Проиграно: { header: 'bg-white border-slate-200', badge: 'bg-rose-100 text-rose-700', row: '' },
    }),
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
    projects.forEach((p) => {
      Object.keys(p.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [projects]);

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
  const formatStatus = (status?: string | null) => {
    if (!status) return t('crm.projects.common.emptyValue');
    return statusLabels[status as ProjectStatus] ?? status;
  };
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
  const progressColor = (percent: number) => {
    const clamped = Math.min(100, Math.max(0, percent));
    const t = clamped / 100;
    const r = Math.round(239 + (59 - 239) * t);
    const g = Math.round(68 + (130 - 68) * t);
    const b = Math.round(68 + (246 - 68) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };
  const projectPriorityColor = (project: Project) => {
    const priority = String(project.customFields?.priority || '')
      .trim()
      .toLowerCase();
    if (priority.includes('выс')) return '#ef4444';
    if (priority.includes('низ')) return '#22c55e';
    return '#3b82f6';
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

  const formatCustomFields = (project: Project) => {
    if (!activeCustomFields.length) return t('crm.projects.common.emptyValue');
    const values = activeCustomFields
      .map((field) => {
        const raw = project.customFields?.[field.key];
        if (raw === null || raw === undefined || raw === '') return null;
        const display = Array.isArray(raw)
          ? raw.join(', ')
          : typeof raw === 'boolean'
            ? raw
              ? t('crm.projects.list.boolean.yes')
              : t('crm.projects.list.boolean.no')
            : String(raw);
        return `${field.label}: ${display}`;
      })
      .filter(Boolean);
    return values.length ? values.join(' · ') : t('crm.projects.common.emptyValue');
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
        prev.map((p) => (p.id === id ? updated : p)),
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
      if (!ownerMenuRef.current.contains(event.target as Node)) {
        setOwnerEditorId(null);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [ownerEditorId]);

  useEffect(() => {
    if (!openAssigneeMenuId && !openNewAssigneesProjectId) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        openAssigneeMenuId &&
        assigneeMenuRef.current &&
        !assigneeMenuRef.current.contains(target)
      ) {
        setOpenAssigneeMenuId(null);
      }
      if (
        openNewAssigneesProjectId &&
        newAssigneesRef.current &&
        !newAssigneesRef.current.contains(target)
      ) {
        setOpenNewAssigneesProjectId(null);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
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

  const handleColumnDrop = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragColumnId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragColumnId);
      return next;
    });
    setDragColumnId(null);
  };

  useEffect(() => {
    setSelectedProjectIds((prev) =>
      prev.filter((id) => projects.some((p) => p.id === id)),
    );
  }, [projects]);

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
    if (selectedProjectIds.length === projects.length) {
      setSelectedProjectIds([]);
      return;
    }
    setSelectedProjectIds(projects.map((p) => p.id));
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
      assignees: task.assignees ?? [],
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
    const nextTasks = (project.tasks || []).map((t) =>
      t.id === taskId ? { ...t, ...patch } : t,
    );
    updateProjectTasks(projectId, nextTasks);
  };

  const removeTaskRow = (projectId: string, taskId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const nextTasks = (project.tasks || []).filter((t) => t.id !== taskId);
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

  const addTaskRow = (projectId: string) => {
    const draft = getTaskDraft(projectId);
    if (!draft.title.trim()) return;
    const assignees = staffForTasks
      .filter((u) => draft.assigneeIds.includes(u.id))
      .map((u) => u.fullName);
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
    projects.forEach((p) => {
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
  }, [groupMode, projects, statusOptions, t]);

  const totalAmount = useMemo(
    () => projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [projects],
  );

  const renderCustomFieldCell = (project: Project, field: CustomField) => {
    const value = project.customFields?.[field.key];
    const commonClass =
      'w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 outline-none focus:border-slate-400';

    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
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
          className={commonClass}
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

  const renderCell = (project: Project, column: any) => {
    switch (column.id) {
      case 'name':
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (expandedProjectIds.includes(project.id)) {
                  toggleProjectExpanded(project.id);
                  return;
                }
                openProjectTasksPanel(project);
              }}
              className={
                'flex h-8 w-[22px] shrink-0 flex-col items-center justify-center rounded-full border border-slate-400 bg-white ' +
                'shadow-[0_1px_3px_rgba(15,23,42,0.12)] transition hover:border-slate-500 hover:shadow-[0_2px_8px_rgba(15,23,42,0.12)] ' +
                ((project.tasks?.length ?? 0) > 0
                  ? 'opacity-100'
                  : 'opacity-40 group-hover:opacity-100')
              }
              title={t('crm.projects.tasks.title')}
              aria-expanded={expandedProjectIds.includes(project.id)}
            >
              {expandedProjectIds.includes(project.id) ? (
                <svg
                  viewBox="0 0 12 12"
                  className="h-3 w-3"
                  aria-hidden
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    fill="none"
                    stroke="#14532d"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 12 12"
                  className="h-2.5 w-2.5"
                  aria-hidden
                >
                  <path d="M3 2.25L9.25 6L3 9.75V2.25Z" fill="#0f172a" />
                </svg>
              )}
            </button>
            <input
              value={project.name}
              onChange={(e) =>
                setProjects((prev) =>
                  prev.map((proj) =>
                    proj.id === project.id
                      ? { ...proj, name: e.target.value }
                      : proj,
                  ),
                )
              }
              onBlur={(e) =>
                updateProjectInline(project.id, { name: e.target.value })
              }
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-1 rounded-lg bg-transparent border border-transparent text-slate-800 text-xs focus:border-slate-300"
            />
            <div className="flex gap-1">
              {(project.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded-full bg-rose-50 text-[10px] text-rose-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        );
      case 'owner': {
        const owners = resolveOwners(project);
        const ownerEditorOpen = ownerEditorId === project.id;
        const filteredStaff = staff.filter((u) =>
          ownerSearch
            ? u.fullName.toLowerCase().includes(ownerSearch.toLowerCase())
            : true,
        );
        return (
          <div className="relative flex items-center gap-1.5" ref={ownerEditorOpen ? ownerMenuRef : undefined}>
            {owners.length === 0 && (
              <span className="text-[11px] text-slate-500">
                {t('crm.projects.common.emptyValue')}
              </span>
            )}
            {owners.map((owner) => {
              const label = typeof owner === 'string' ? owner : owner.fullName;
              const avatarUrl = typeof owner === 'string' ? null : owner.avatarUrl;
              return (
                <div
                  key={label}
                  className="h-7 w-7 rounded-full border border-slate-800 bg-slate-900 flex items-center justify-center text-[10px] font-semibold text-slate-100"
                  title={label}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={label}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initialsFromName(label)
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openOwnerEditor(project);
              }}
              className="h-7 w-7 rounded-full border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              title={t('crm.projects.list.owner.edit')}
            >
              +
            </button>
            {ownerEditorOpen && (
              <div
                className="absolute left-0 top-9 z-20 w-64 rounded-2xl border border-slate-800 bg-slate-950 shadow-xl p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 px-2 py-1">
                  {t('crm.projects.list.owner.title')}
                </div>
                <input
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  placeholder={t('crm.projects.list.owner.search')}
                  className="w-full px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200 outline-none focus:border-slate-700"
                />
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {filteredStaff.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-200 hover:bg-slate-900/80"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-100">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            initialsFromName(u.fullName)
                          )}
                        </div>
                        <span>{u.fullName}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={ownerDraftIds.includes(u.id)}
                        onChange={() => toggleOwnerDraft(u.id)}
                      />
                    </label>
                  ))}
                  {!filteredStaff.length && (
                    <div className="px-2 py-2 text-[11px] text-slate-500">
                      {t('crm.projects.list.owner.empty')}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900"
                    onClick={() => setOwnerEditorId(null)}
                  >
                    {t('crm.common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] rounded-lg bg-lumiva-accent text-white hover:bg-lumiva-accent-soft"
                    onClick={() => saveOwnerSelection(project)}
                  >
                    {t('crm.common.save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'lead':
        return project.leadName ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-200">
            {project.leadName}
          </span>
        ) : (
          t('crm.projects.common.emptyValue')
        );
      case 'company':
        return project.companyName ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-200">
            {project.companyName}
          </span>
        ) : (
          t('crm.projects.common.emptyValue')
        );
      case 'status':
        return (
          <select
            value={project.status}
            onChange={(e) =>
              updateProjectInline(project.id, {
                status: e.target.value as Project['status'],
              })
            }
            onClick={(e) => e.stopPropagation()}
            className={`w-full px-2 py-1 rounded-full border text-[11px] font-semibold appearance-none ${statusStyles[project.status] ?? 'bg-slate-900 text-slate-200 border-slate-800'}`}
          >
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {statusLabels[st] ?? st}
              </option>
            ))}
          </select>
        );
      case 'progress': {
        const percent = progressValue(project);
        const color = progressColor(percent);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${percent}%`, backgroundColor: color }}
              />
            </div>
            <div className="text-[11px] font-semibold" style={{ color }}>
              {percent}%
            </div>
          </div>
        );
      }
      case 'amount':
        return (
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
            onBlur={(e) =>
              updateProjectInline(project.id, {
                amount: Number(e.target.value || 0),
              })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 rounded-lg bg-transparent border border-transparent text-slate-700 text-xs focus:border-slate-300"
          />
        );
      case 'created':
        return project.createdAt;
      default:
        if (column.field) return renderCustomFieldCell(project, column.field);
        return null;
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    // грузим сразу проекты + лидов + компании
    Promise.all([
      fetchProjects(),
      fetchLeadsList(),
      fetchCompanies({ limit: 100 }),
      fetchStaff(),
    ])
      .then(async ([projRes, leads, companiesRes, staffUsers]) => {
        if (!alive) return;
        const activeLeads = leads.filter((lead) => !Boolean(lead.meta?.deleted));

        const leadsMap: Record<string, Lead> = {};
        activeLeads.forEach((l) => {
          leadsMap[l.id] = l;
        });

        const companiesMap: Record<string, Company> = {};
        companiesRes.items.forEach((c) => {
          companiesMap[c.id] = c;
        });

        setCompanies(companiesRes.items);
        setStaff(staffUsers);

        const enriched = projRes.items.map((p) => {
          const lead = p.leadId ? leadsMap[p.leadId] : undefined;
          const company = lead?.companyId ? companiesMap[lead.companyId] : undefined;
          return {
            ...p,
            // проставляем имя и email лида, если нашли
            leadName: lead?.name ?? p.leadName ?? null,
            leadEmail: lead?.email ?? p.leadEmail ?? null,
            // проставляем компанию
            companyId: lead?.companyId ?? null,
            companyName: company?.name ?? null,
          };
        });

        // Фильтруем по компании, если выбрана
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

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Заголовок + переключатель вида */}
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {t('crm.projects.list.title')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.list.subtitle')}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setAutomationOpen(true)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M4 12h4" />
                <path d="M16 12h4" />
                <path d="M7.8 7.8l2.8 2.8" />
                <path d="M13.4 13.4l2.8 2.8" />
                <path d="M16.2 7.8l-2.8 2.8" />
                <path d="M10.6 13.4l-2.8 2.8" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              {t('crm.automations.panel.button')}
            </button>

            <select
              value={groupMode}
              onChange={(e) =>
                setGroupMode(e.target.value as 'status' | 'owner' | 'company' | 'none')
              }
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700"
            >
              <option value="status">{t('crm.projects.list.groupMode.status')}</option>
              <option value="owner">{t('crm.projects.list.groupMode.owner')}</option>
              <option value="company">{t('crm.projects.list.groupMode.company')}</option>
              <option value="none">{t('crm.projects.list.groupMode.none')}</option>
            </select>

            <div className="relative" ref={columnsMenuRef}>
              <button
                type="button"
                onClick={() => setColumnsOpen((prev) => !prev)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                {t('crm.projects.list.columns.label')}
              </button>
              {columnsOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-10">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 px-2 py-1">
                    {t('crm.projects.list.columns.label')}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {columns.map((col) => {
                      const checked = !hiddenColumns.includes(col.id);
                      const isCore = coreColumnIds.has(col.id);
                      const keyLabel =
                        'field' in col && col.field?.key
                          ? `(${col.field.key})`
                          : undefined;
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] ${
                            isCore ? 'text-slate-400' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span>{col.label}</span>
                            {keyLabel && (
                              <span className="text-[10px] text-slate-500">
                                {keyLabel}
                              </span>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isCore}
                            onChange={(e) => {
                              if (e.target.checked) showColumn(col.id);
                              else hideColumn(col.id);
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setColumnsOpen(false);
                        setCustomFieldsOpen(true);
                      }}
                      className="w-full px-2 py-1.5 text-[11px] rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      {t('crm.projects.list.columns.add')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-xs rounded-xl bg-[#222222] text-white font-semibold hover:bg-black"
            >
              + {t('crm.projects.actions.newProject')}
            </button>
          </div>
        </div>

        <ProjectsViewsBar
          currentType="table"
          activeViewId={activeViewId}
          onOpenView={openView}
          onSettingsChange={() => {}}
        />

        {/* Ошибка */}
        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Лоадер */}
        {loading && (
          <div className="text-[12px] text-slate-400">
            {t('crm.projects.loading')}
          </div>
        )}

        {/* Фильтр по компании */}
        {!loading && (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-[11px] text-slate-500">
                {t('crm.projects.list.filters.companyLabel')}
              </label>
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => setSelectedCompanyId(e.target.value || null)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 sm:w-auto"
              >
                <option value="">{t('crm.projects.list.filters.allCompanies')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Таблица проектов */}
        {!loading && (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="min-w-[760px] w-full text-xs border-separate border-spacing-y-1 table-fixed">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-1 w-10">
                    <label className="inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={projects.length > 0 && selectedProjectIds.length === projects.length}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleAllSelected();
                        }}
                        className="peer sr-only"
                      />
                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border border-slate-300 bg-white text-white transition peer-checked:border-sky-600 peer-checked:bg-sky-600">
                        <svg className="h-3 w-3 opacity-0 peer-checked:opacity-100" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </label>
                  </th>
                  {orderedColumns.map((col) => {
                    const fallback =
                      col.id === 'name'
                        ? 220
                        : col.id === 'owner'
                          ? 160
                          : col.id === 'lead'
                            ? 200
                            : col.id === 'company'
                              ? 200
                              : col.id === 'status'
                                ? 160
                                : col.id === 'progress'
                                  ? 180
                                : col.id === 'amount'
                                  ? 140
                                  : col.id === 'created'
                                    ? 170
                                    : 180;
                    const width = getColumnWidth(col.id, fallback);
                    return (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={(e) => {
                          setDragColumnId(col.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', col.id);
                        }}
                        onDragEnd={() => setDragColumnId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleColumnDrop(col.id)}
                        className="text-left px-3 py-1 relative group"
                        style={{ width, minWidth: width }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="cursor-move">⋮⋮</span>
                          <span>{col.label}</span>
                        </div>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
                          onMouseDown={(e) => startResize(col.id, e)}
                        />
                  </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {groupMode !== 'none'
                  ? groupedProjects.map((group, groupIndex) => {
                      const isCollapsed = collapsedGroups.includes(group.key);
                      const groupAmount = group.items.reduce(
                        (sum, p) => sum + (Number(p.amount) || 0),
                        0,
                      );
                      const groupTone =
                        groupMode === 'status'
                          ? statusGroupStyles[group.key] ?? {
                              header: 'bg-slate-100 border-slate-200',
                              badge: 'bg-slate-200 text-slate-700',
                              row: '',
                            }
                          : {
                              header: 'bg-slate-100 border-slate-200',
                              badge: 'bg-slate-200 text-slate-700',
                              row: '',
                            };
                      return (
                        <React.Fragment key={group.key}>
                          <tr>
                            <td
                              colSpan={orderedColumns.length + 1}
                              className={`px-3 text-slate-700 ${groupIndex === 0 ? 'pt-1 pb-2' : 'pt-3 pb-2'}`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.key)}
                                className={`flex items-center gap-2 text-[12px] font-semibold rounded-xl border px-3 py-2 ${groupTone.header}`}
                              >
                                <span>{isCollapsed ? '▸' : '▾'}</span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${groupTone.badge}`}>{group.label}</span>
                                <span className="text-[11px] font-normal text-slate-400">
                                  {t('crm.projects.list.groupSummary', {
                                    count: group.items.length,
                                    amount: formatAmount(groupAmount),
                                  })}
                                </span>
                              </button>
                            </td>
                          </tr>
                          {!isCollapsed &&
                            group.items.map((p, rowIndex) => {
                              const leftAccent = projectPriorityColor(p);
                              const isFirstRow = rowIndex === 0;
                              const isLastRow = rowIndex === group.items.length - 1;
                              return (
                              <React.Fragment key={p.id}>
                                <tr
                                  className={`group bg-white hover:bg-slate-50 cursor-pointer ${groupTone.row}`}
                                  onClick={() => handleOpen(p.id)}
                                >
                                  <td
                                    className={`px-3 py-1.5 text-slate-600 border-l-4 border-y border-slate-200 ${
                                      isFirstRow ? 'rounded-tl-xl' : ''
                                    } ${isLastRow ? 'rounded-bl-xl' : ''}`}
                                    style={{ borderLeftColor: leftAccent }}
                                  >
                                    <label
                                      className="inline-flex cursor-pointer items-center"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedProjectIds.includes(p.id)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleProjectSelected(p.id);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="peer sr-only"
                                      />
                                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border border-slate-300 bg-white text-white transition peer-checked:border-sky-600 peer-checked:bg-sky-600">
                                        <svg className="h-3 w-3 opacity-0 peer-checked:opacity-100" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                          <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      </span>
                                    </label>
                                  </td>
                                  {orderedColumns.map((col, colIndex) => {
                                    const fallback =
                                      col.id === 'name'
                                        ? 220
                                        : col.id === 'owner'
                                          ? 160
                                          : col.id === 'lead'
                                            ? 200
                                            : col.id === 'company'
                                              ? 200
                                              : col.id === 'status'
                                                ? 160
                                                : col.id === 'progress'
                                                  ? 180
                                                  : col.id === 'amount'
                                                    ? 140
                                                    : col.id === 'created'
                                                      ? 170
                                                      : 180;
                                    const width = getColumnWidth(col.id, fallback);
                                    return (
                                      <td
                                        key={col.id}
                                        className={`px-3 py-1.5 text-slate-700 border-y border-slate-200 ${
                                          colIndex === orderedColumns.length - 1
                                            ? 'border-r border-slate-200'
                                            : ''
                                        } ${
                                          isFirstRow && colIndex === orderedColumns.length - 1
                                            ? 'rounded-tr-xl'
                                            : ''
                                        } ${
                                          isLastRow && colIndex === orderedColumns.length - 1
                                            ? 'rounded-br-xl'
                                            : ''
                                        }`}
                                        style={{ width, minWidth: width }}
                                      >
                                        {renderCell(p, col)}
                                      </td>
                                    );
                                  })}
                                </tr>
                                {expandedProjectIds.includes(p.id) && (
                                  <tr className="bg-slate-50">
                                    <td
                                      colSpan={orderedColumns.length + 1}
                                      className="px-3 pb-3"
                                    >
                                      <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50/30 p-3 pl-5 relative">
                                        <div className="absolute left-2 top-2 bottom-2 w-[3px] rounded-full bg-sky-300/90" />
                                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">
                                          {t('crm.projects.tasks.title')}
                                        </div>
                                        {(p.tasks || []).length === 0 && (
                                          <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-slate-600">
                                            + {t('crm.projects.tasks.newTask.placeholder')}
                                          </div>
                                        )}
                                        <div className="overflow-x-auto">
                                          <table className="min-w-[900px] w-full text-xs">
                                            <thead className="text-slate-500">
                                              <tr>
                                                <th className="px-2 py-1 text-left">
                                                  {t('crm.projects.tasks.table.headers.task')}
                                                </th>
                                                <th className="px-2 py-1 text-left">
                                                  {t('crm.projects.tasks.table.headers.owner')}
                                                </th>
                                                <th className="px-2 py-1 text-left">
                                                  {t('crm.projects.tasks.table.headers.status')}
                                                </th>
                                                <th className="px-2 py-1 text-left">
                                                  {t('crm.projects.tasks.table.headers.priority')}
                                                </th>
                                                <th className="px-2 py-1 text-left">
                                                  {t('crm.projects.tasks.table.headers.deadline')}
                                                </th>
                                                <th className="px-2 py-1 text-left">
                                                  {t('crm.projects.tasks.table.headers.actions')}
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(p.tasks || []).map((task) => (
                                                <tr key={task.id} className="border-t border-slate-200">
                                                  <td className="px-2 py-1">
                                                    <div className="flex items-center gap-2">
                                                      <span className="h-px w-3 bg-sky-300/90" />
                                                      <input
                                                        value={task.title}
                                                        onChange={(e) =>
                                                          updateTaskField(p.id, task.id, {
                                                            title: e.target.value,
                                                          })
                                                        }
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 outline-none"
                                                      />
                                                    </div>
                                                  </td>
                                                  <td className="px-2 py-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      {(task.assignees || []).length ? (
                                                        (task.assignees || []).map((name) => {
                                                          const user =
                                                            staffForTasks.find(
                                                              (u) => u.fullName === name,
                                                            ) || name;
                                                          const label =
                                                            typeof user === 'string'
                                                              ? user
                                                              : user.fullName;
                                                          const avatarUrl =
                                                            typeof user === 'string'
                                                              ? null
                                                              : user.avatarUrl;
                                                          return (
                                                            <div
                                                              key={label}
                                                              className="h-6 w-6 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center text-[10px] text-slate-700"
                                                              title={label}
                                                            >
                                                              {avatarUrl ? (
                                                                <img
                                                                  src={avatarUrl}
                                                                  alt={label}
                                                                  className="h-full w-full rounded-full object-cover"
                                                                />
                                                              ) : (
                                                                label
                                                                  .split(' ')
                                                                  .filter(Boolean)
                                                                  .slice(0, 2)
                                                                  .map((part) => part[0])
                                                                  .join('')
                                                                  .toUpperCase()
                                                              )}
                                                            </div>
                                                          );
                                                        })
                                                      ) : (
                                                        <span className="text-slate-500">
                                                          {t('crm.projects.common.emptyValue')}
                                                        </span>
                                                      )}
                                                      <div
                                                        className="relative"
                                                        ref={
                                                          openAssigneeMenuId ===
                                                          `${p.id}:${task.id}`
                                                            ? assigneeMenuRef
                                                            : null
                                                        }
                                                      >
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenAssigneeMenuId((prev) =>
                                                              prev === `${p.id}:${task.id}`
                                                                ? null
                                                                : `${p.id}:${task.id}`,
                                                            );
                                                          }}
                                                          className="h-6 w-6 rounded-full border border-slate-700 text-[12px] text-slate-300 hover:text-white"
                                                        >
                                                          +
                                                        </button>
                                                        {openAssigneeMenuId ===
                                                          `${p.id}:${task.id}` && (
                                                          <div className="absolute z-20 mt-2 w-56 max-h-64 overflow-auto rounded-xl border border-slate-800/80 bg-slate-950 shadow-lg p-2">
                                                            {staffForTasks.map((u) => (
                                                              <label
                                                                key={u.id}
                                                                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60"
                                                              >
                                                                <input
                                                                  type="checkbox"
                                                                  checked={(task.assignees || []).includes(
                                                                    u.fullName,
                                                                  )}
                                                                  onChange={() =>
                                                                    updateTaskField(p.id, task.id, {
                                                                      assignees: (task.assignees || []).includes(
                                                                        u.fullName,
                                                                      )
                                                                        ? (task.assignees || []).filter(
                                                                            (item) => item !== u.fullName,
                                                                          )
                                                                        : [...(task.assignees || []), u.fullName],
                                                                    })
                                                                  }
                                                                />
                                                                <span className="text-xs text-slate-200">
                                                                  {u.fullName}
                                                                </span>
                                                              </label>
                                                            ))}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </td>
                                                  <td className="px-2 py-1">
                                                    <select
                                                      value={task.status}
                                                      onChange={(e) =>
                                                        updateTaskField(p.id, task.id, {
                                                          status: e.target.value as ProjectTask['status'],
                                                        })
                                                      }
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                                    >
                                                      {TASK_STATUS_OPTIONS.map((status) => (
                                                        <option key={status} value={status}>
                                                          {status}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </td>
                                                  <td className="px-2 py-1">
                                                    <select
                                                      value={task.priority}
                                                      onChange={(e) =>
                                                        updateTaskField(p.id, task.id, {
                                                          priority: e.target.value as ProjectTask['priority'],
                                                        })
                                                      }
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                                    >
                                                      {TASK_PRIORITY_OPTIONS.map((priority) => (
                                                        <option key={priority} value={priority}>
                                                          {priority}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </td>
                                                  <td className="px-2 py-1">
                                                    <input
                                                      type="date"
                                                      value={task.deadline || ''}
                                                      onChange={(e) =>
                                                        updateTaskField(p.id, task.id, {
                                                          deadline: e.target.value || null,
                                                        })
                                                      }
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                                    />
                                                  </td>
                                                  <td className="px-2 py-1">
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeTaskRow(p.id, task.id);
                                                      }}
                                                      className="text-[11px] text-rose-400 hover:text-rose-300"
                                                    >
                                                      {t('crm.projects.tasks.table.actions.remove')}
                                                    </button>
                                                  </td>
                                                </tr>
                                              ))}
                                              <tr className="border-t border-slate-800/60">
                                                <td className="px-2 py-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="h-px w-3 bg-sky-300/90" />
                                                    <input
                                                      value={getTaskDraft(p.id).title}
                                                      onChange={(e) =>
                                                        updateTaskDraft(p.id, { title: e.target.value })
                                                      }
                                                      placeholder={t('crm.projects.tasks.newTask.placeholder')}
                                                      className="w-full px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs text-slate-200 outline-none"
                                                    />
                                                  </div>
                                                </td>
                                                <td className="px-2 py-1">
                                                  <div className="relative" ref={openNewAssigneesProjectId === p.id ? newAssigneesRef : null}>
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenNewAssigneesProjectId((prev) =>
                                                          prev === p.id ? null : p.id,
                                                        );
                                                      }}
                                                      className="min-w-[140px] px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between gap-2"
                                                    >
                                                      <span>{t('crm.projects.tasks.newTask.assignees')}</span>
                                                      <span className="text-[10px] text-slate-500">
                                                        {getTaskDraft(p.id).assigneeIds.length}
                                                      </span>
                                                    </button>
                                                    {openNewAssigneesProjectId === p.id && (
                                                      <div className="absolute z-20 mt-2 w-56 max-h-64 overflow-auto rounded-xl border border-slate-800/80 bg-slate-950 shadow-lg p-2">
                                                        {staffForTasks.map((u) => (
                                                          <label
                                                            key={u.id}
                                                            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60"
                                                          >
                                                            <input
                                                              type="checkbox"
                                                              checked={getTaskDraft(p.id).assigneeIds.includes(u.id)}
                                                              onChange={() => {
                                                                const prevIds = getTaskDraft(p.id).assigneeIds;
                                                                updateTaskDraft(p.id, {
                                                                  assigneeIds: prevIds.includes(u.id)
                                                                    ? prevIds.filter((id) => id !== u.id)
                                                                    : [...prevIds, u.id],
                                                                });
                                                              }}
                                                            />
                                                            <span className="text-xs text-slate-200">
                                                              {u.fullName}
                                                            </span>
                                                          </label>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="px-2 py-1">
                                                  <select
                                                    value={getTaskDraft(p.id).status}
                                                    onChange={(e) =>
                                                      updateTaskDraft(p.id, {
                                                        status: e.target.value as ProjectTask['status'],
                                                      })
                                                    }
                                                    className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                                  >
                                                    {TASK_STATUS_OPTIONS.map((status) => (
                                                      <option key={status} value={status}>
                                                        {status}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </td>
                                                <td className="px-2 py-1">
                                                  <select
                                                    value={getTaskDraft(p.id).priority}
                                                    onChange={(e) =>
                                                      updateTaskDraft(p.id, {
                                                        priority: e.target.value as ProjectTask['priority'],
                                                      })
                                                    }
                                                    className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                                  >
                                                    {TASK_PRIORITY_OPTIONS.map((priority) => (
                                                      <option key={priority} value={priority}>
                                                        {priority}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </td>
                                                <td className="px-2 py-1">
                                                  <input
                                                    type="date"
                                                    value={getTaskDraft(p.id).deadline}
                                                    onChange={(e) =>
                                                      updateTaskDraft(p.id, { deadline: e.target.value })
                                                    }
                                                    className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                                  />
                                                </td>
                                                <td className="px-2 py-1">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      addTaskRow(p.id);
                                                    }}
                                                    className="text-[11px] text-sky-400 hover:text-sky-300"
                                                  >
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
                                )}
                              </React.Fragment>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  : projects.map((p) => (
                      <React.Fragment key={p.id}>
                        <tr
                          className="group bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                          onClick={() => handleOpen(p.id)}
                        >
                          <td className="px-3 py-1.5 text-slate-400">
                            <label
                              className="inline-flex cursor-pointer items-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedProjectIds.includes(p.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleProjectSelected(p.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="peer sr-only"
                              />
                              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border border-slate-300 bg-white text-white transition peer-checked:border-sky-600 peer-checked:bg-sky-600">
                                <svg className="h-3 w-3 opacity-0 peer-checked:opacity-100" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                  <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            </label>
                          </td>
                          {orderedColumns.map((col) => {
                            const fallback =
                              col.id === 'name'
                                ? 220
                                : col.id === 'owner'
                                  ? 160
                                  : col.id === 'lead'
                                    ? 200
                                    : col.id === 'company'
                                      ? 200
                                      : col.id === 'status'
                                        ? 160
                                        : col.id === 'progress'
                                          ? 180
                                          : col.id === 'amount'
                                            ? 140
                                            : col.id === 'created'
                                              ? 170
                                              : 180;
                            const width = getColumnWidth(col.id, fallback);
                            return (
                              <td
                                key={col.id}
                                className="px-3 py-1.5 text-slate-400"
                                style={{ width, minWidth: width }}
                              >
                                {renderCell(p, col)}
                              </td>
                            );
                          })}
                        </tr>
                        {expandedProjectIds.includes(p.id) && (
                          <tr className="bg-slate-950/80">
                            <td
                              colSpan={orderedColumns.length + 1}
                              className="px-3 pb-3"
                            >
                              <div className="mt-2 rounded-2xl border border-sky-900/50 bg-slate-950/80 p-3 pl-5 relative">
                                <div className="absolute left-2 top-2 bottom-2 w-[3px] rounded-full bg-sky-400/80" />
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">
                                  {t('crm.projects.tasks.title')}
                                </div>
                                {(p.tasks || []).length === 0 && (
                                  <div className="mb-2 rounded-lg border border-sky-900/50 bg-sky-950/30 px-2 py-1 text-[11px] text-slate-300">
                                    + {t('crm.projects.tasks.newTask.placeholder')}
                                  </div>
                                )}
                                <div className="overflow-x-auto">
                                  <table className="min-w-[900px] w-full text-xs">
                                    <thead className="text-slate-500">
                                      <tr>
                                        <th className="px-2 py-1 text-left">
                                          {t('crm.projects.tasks.table.headers.task')}
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          {t('crm.projects.tasks.table.headers.owner')}
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          {t('crm.projects.tasks.table.headers.status')}
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          {t('crm.projects.tasks.table.headers.priority')}
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          {t('crm.projects.tasks.table.headers.deadline')}
                                        </th>
                                        <th className="px-2 py-1 text-left">
                                          {t('crm.projects.tasks.table.headers.actions')}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(p.tasks || []).map((task) => (
                                        <tr key={task.id} className="border-t border-slate-800/60">
                                          <td className="px-2 py-1">
                                            <div className="flex items-center gap-2">
                                              <span className="h-px w-3 bg-sky-400/80" />
                                              <input
                                                value={task.title}
                                                onChange={(e) =>
                                                  updateTaskField(p.id, task.id, {
                                                    title: e.target.value,
                                                  })
                                                }
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs text-slate-200 outline-none"
                                              />
                                            </div>
                                          </td>
                                          <td className="px-2 py-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {(task.assignees || []).length ? (
                                                (task.assignees || []).map((name) => {
                                                  const user =
                                                    staffForTasks.find(
                                                      (u) => u.fullName === name,
                                                    ) || name;
                                                  const label =
                                                    typeof user === 'string'
                                                      ? user
                                                      : user.fullName;
                                                  const avatarUrl =
                                                    typeof user === 'string'
                                                      ? null
                                                      : user.avatarUrl;
                                                  return (
                                                    <div
                                                      key={label}
                                                      className="h-6 w-6 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center text-[10px] text-slate-200"
                                                      title={label}
                                                    >
                                                      {avatarUrl ? (
                                                        <img
                                                          src={avatarUrl}
                                                          alt={label}
                                                          className="h-full w-full rounded-full object-cover"
                                                        />
                                                      ) : (
                                                        label
                                                          .split(' ')
                                                          .filter(Boolean)
                                                          .slice(0, 2)
                                                          .map((part) => part[0])
                                                          .join('')
                                                          .toUpperCase()
                                                      )}
                                                    </div>
                                                  );
                                                })
                                              ) : (
                                                <span className="text-slate-500">
                                                  {t('crm.projects.common.emptyValue')}
                                                </span>
                                              )}
                                              <div
                                                className="relative"
                                                ref={
                                                  openAssigneeMenuId ===
                                                  `${p.id}:${task.id}`
                                                    ? assigneeMenuRef
                                                    : null
                                                }
                                              >
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenAssigneeMenuId((prev) =>
                                                      prev === `${p.id}:${task.id}`
                                                        ? null
                                                        : `${p.id}:${task.id}`,
                                                    );
                                                  }}
                                                  className="h-6 w-6 rounded-full border border-slate-700 text-[12px] text-slate-300 hover:text-white"
                                                >
                                                  +
                                                </button>
                                                {openAssigneeMenuId ===
                                                  `${p.id}:${task.id}` && (
                                                  <div className="absolute z-20 mt-2 w-56 max-h-64 overflow-auto rounded-xl border border-slate-800/80 bg-slate-950 shadow-lg p-2">
                                                    {staffForTasks.map((u) => (
                                                      <label
                                                        key={u.id}
                                                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60"
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          checked={(task.assignees || []).includes(
                                                            u.fullName,
                                                          )}
                                                          onChange={() =>
                                                            updateTaskField(p.id, task.id, {
                                                              assignees: (task.assignees || []).includes(
                                                                u.fullName,
                                                              )
                                                                ? (task.assignees || []).filter(
                                                                    (item) => item !== u.fullName,
                                                                  )
                                                                : [...(task.assignees || []), u.fullName],
                                                            })
                                                          }
                                                        />
                                                        <span className="text-xs text-slate-200">
                                                          {u.fullName}
                                                        </span>
                                                      </label>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-2 py-1">
                                            <select
                                              value={task.status}
                                              onChange={(e) =>
                                                updateTaskField(p.id, task.id, {
                                                  status: e.target.value as ProjectTask['status'],
                                                })
                                              }
                                              onClick={(e) => e.stopPropagation()}
                                              className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                            >
                                              {TASK_STATUS_OPTIONS.map((status) => (
                                                <option key={status} value={status}>
                                                  {status}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="px-2 py-1">
                                            <select
                                              value={task.priority}
                                              onChange={(e) =>
                                                updateTaskField(p.id, task.id, {
                                                  priority: e.target.value as ProjectTask['priority'],
                                                })
                                              }
                                              onClick={(e) => e.stopPropagation()}
                                              className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                            >
                                              {TASK_PRIORITY_OPTIONS.map((priority) => (
                                                <option key={priority} value={priority}>
                                                  {priority}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="px-2 py-1">
                                            <input
                                              type="date"
                                              value={task.deadline || ''}
                                              onChange={(e) =>
                                                updateTaskField(p.id, task.id, {
                                                  deadline: e.target.value || null,
                                                })
                                              }
                                              onClick={(e) => e.stopPropagation()}
                                              className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                            />
                                          </td>
                                          <td className="px-2 py-1">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                removeTaskRow(p.id, task.id);
                                              }}
                                              className="text-[11px] text-rose-400 hover:text-rose-300"
                                            >
                                              {t('crm.projects.tasks.table.actions.remove')}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                      <tr className="border-t border-slate-800/60">
                                        <td className="px-2 py-1">
                                          <div className="flex items-center gap-2">
                                            <span className="h-px w-3 bg-sky-400/80" />
                                            <input
                                              value={getTaskDraft(p.id).title}
                                              onChange={(e) =>
                                                updateTaskDraft(p.id, { title: e.target.value })
                                              }
                                              placeholder={t('crm.projects.tasks.newTask.placeholder')}
                                              className="w-full px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs text-slate-200 outline-none"
                                            />
                                          </div>
                                        </td>
                                        <td className="px-2 py-1">
                                          <div className="relative" ref={openNewAssigneesProjectId === p.id ? newAssigneesRef : null}>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenNewAssigneesProjectId((prev) =>
                                                  prev === p.id ? null : p.id,
                                                );
                                              }}
                                              className="min-w-[140px] px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between gap-2"
                                            >
                                              <span>{t('crm.projects.tasks.newTask.assignees')}</span>
                                              <span className="text-[10px] text-slate-500">
                                                {getTaskDraft(p.id).assigneeIds.length}
                                              </span>
                                            </button>
                                            {openNewAssigneesProjectId === p.id && (
                                              <div className="absolute z-20 mt-2 w-56 max-h-64 overflow-auto rounded-xl border border-slate-800/80 bg-slate-950 shadow-lg p-2">
                                                {staffForTasks.map((u) => (
                                                  <label
                                                    key={u.id}
                                                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60"
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      checked={getTaskDraft(p.id).assigneeIds.includes(u.id)}
                                                      onChange={() => {
                                                        const prevIds = getTaskDraft(p.id).assigneeIds;
                                                        updateTaskDraft(p.id, {
                                                          assigneeIds: prevIds.includes(u.id)
                                                            ? prevIds.filter((id) => id !== u.id)
                                                            : [...prevIds, u.id],
                                                        });
                                                      }}
                                                    />
                                                    <span className="text-xs text-slate-200">
                                                      {u.fullName}
                                                    </span>
                                                  </label>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-2 py-1">
                                          <select
                                            value={getTaskDraft(p.id).status}
                                            onChange={(e) =>
                                              updateTaskDraft(p.id, {
                                                status: e.target.value as ProjectTask['status'],
                                              })
                                            }
                                            className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                          >
                                            {TASK_STATUS_OPTIONS.map((status) => (
                                              <option key={status} value={status}>
                                                {status}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="px-2 py-1">
                                          <select
                                            value={getTaskDraft(p.id).priority}
                                            onChange={(e) =>
                                              updateTaskDraft(p.id, {
                                                priority: e.target.value as ProjectTask['priority'],
                                              })
                                            }
                                            className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                          >
                                            {TASK_PRIORITY_OPTIONS.map((priority) => (
                                              <option key={priority} value={priority}>
                                                {priority}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="px-2 py-1">
                                          <input
                                            type="date"
                                            value={getTaskDraft(p.id).deadline}
                                            onChange={(e) =>
                                              updateTaskDraft(p.id, { deadline: e.target.value })
                                            }
                                            className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-200"
                                          />
                                        </td>
                                        <td className="px-2 py-1">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              addTaskRow(p.id);
                                            }}
                                            className="text-[11px] text-sky-400 hover:text-sky-300"
                                          >
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
                        )}
                      </React.Fragment>
                    ))}

                {!projects.length && !error && (
                  <tr>
                    <td
                      colSpan={orderedColumns.length + 1}
                      className="px-3 py-3 text-center text-[12px] text-slate-500"
                    >
                      {t('crm.projects.list.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={orderedColumns.length + 1}
                    className="px-3 py-2 text-[11px] text-slate-500"
                  >
                    {t('crm.projects.list.summary', {
                      count: projects.length,
                      amount: formatAmount(totalAmount),
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        )}

        {selectedProjectIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] sm:w-auto">
            <div className="flex flex-wrap items-center gap-3 rounded-full border border-[#222222] bg-white px-4 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
              <span className="text-[11px] text-[#222222]/70">
                {t('crm.projects.list.bulk.selected', {
                  count: selectedProjectIds.length,
                })}
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={bulkStatus}
                  onChange={(e) =>
                    setBulkStatus(e.target.value as Project['status'] | '')
                  }
                  className="px-3 py-1.5 rounded-full bg-white text-[#222222] text-[12px] border border-[#222222]/40"
                >
                  <option value="">{t('crm.projects.list.bulk.status')}</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status] ?? status}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!bulkStatus) return;
                    applyBulkStatus(bulkStatus);
                    setBulkStatus('');
                  }}
                  className="px-3 py-1.5 text-[12px] rounded-full bg-[#222222] text-white border border-[#222222] hover:bg-black"
                >
                  {t('crm.projects.list.bulk.apply')}
                </button>
              </div>
              <button
                type="button"
                onClick={archiveSelected}
                className="px-3 py-1.5 text-[12px] rounded-full border border-[#222222]/50 text-[#222222] hover:bg-[#222222]/5 flex items-center gap-2"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="4" rx="1" />
                  <rect x="3" y="10" width="18" height="10" rx="1" />
                  <path d="M8 14h8" />
                </svg>
                {t('crm.projects.list.bulk.archive')}
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className="px-3 py-1.5 text-[12px] rounded-full border border-rose-500 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <rect x="6" y="6" width="12" height="14" rx="1" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
                {t('crm.projects.list.bulk.delete')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedProjectIds([])}
                className="px-3 py-1.5 text-[12px] rounded-full border border-[#222222]/40 text-[#222222] hover:bg-[#222222]/5"
              >
                {t('crm.projects.list.bulk.clear')}
              </button>
            </div>
          </div>
        )}

        {showBulkHint && selectedProjectIds.length > 0 && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4">
            <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('projects_bulk_hint_hidden', '1');
                  setShowBulkHint(false);
                }}
                className="absolute right-4 top-4 text-slate-400 hover:text-white"
                aria-label="close"
              >
                ✕
              </button>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center text-lg">
                  ⚡
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">
                    {t('crm.projects.list.bulkHint.title')}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {t('crm.projects.list.bulkHint.subtitle')}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/70 px-3 py-2">
                  <span className="text-sm">🟢</span>
                  {t('crm.projects.list.bulkHint.status')}
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/70 px-3 py-2">
                  <span className="text-sm">🗄</span>
                  {t('crm.projects.list.bulkHint.archive')}
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-rose-700/80 bg-rose-950/30 px-3 py-2 text-rose-200">
                  <span className="text-sm">🗑</span>
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
                  className="px-4 py-2 rounded-full bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-white"
                >
                  {t('crm.projects.list.bulkHint.ok')}
                </button>
              </div>
            </div>
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
