// src/pages/projects/ProjectTasksPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { fetchProject, fetchProjects, updateProject } from '../../api/projects';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { getLocale } from '../../i18n/utils';
import { getStoredUser } from '../../auth/session';
import type { Project, ProjectTask } from './projectTypes';
import {
  isTaskAssigneeSelected,
  normalizeAssigneesToStaffIds,
  resolveStaffForAssigneeEntry,
  taskAssigneesMatchNormalizedLabels,
  toggleTaskAssigneeIds,
} from './taskAssignees';
import { isTextMentioning } from './mentions';

type FlattenedTask = ProjectTask & {
  projectId: string;
  projectName: string;
  projectOwner: string | null;
};
const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}${crypto.randomUUID()}`;
  }
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};
const tasksCacheKey = (projectId: string) => `project_tasks_${projectId}`;
const readTasksCache = (projectId: string): ProjectTask[] | null => {
  try {
    const raw = localStorage.getItem(tasksCacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ProjectTask[];
  } catch {
    return null;
  }
};
const writeTasksCache = (projectId: string, tasks: ProjectTask[]) => {
  try {
    localStorage.setItem(tasksCacheKey(projectId), JSON.stringify(tasks));
  } catch {
    // ignore
  }
};


const STATUS_OPTIONS: ProjectTask['status'][] = [
  'К выполнению',
  'В работе',
  'На проверке',
  'Заблокировано',
  'Отложено',
  'Готово',
];
const PRIORITY_OPTIONS: ProjectTask['priority'][] = ['Обычный', 'Высокий', 'Низкий'];

function isProjectTasksRowDragBlockedTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, button, a[href], [data-no-task-drag]',
    ),
  );
}

export const ProjectTasksPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = getLocale(i18n.language);
  const user = getStoredUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ProjectTask['status'] | ''>('');
  const [filterProjectId, setFilterProjectId] = useState<string>('');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskStatus, setNewTaskStatus] =
    useState<ProjectTask['status']>('К выполнению');
  const [newTaskPriority, setNewTaskPriority] =
    useState<ProjectTask['priority']>('Обычный');
  const [newTaskDeadline, setNewTaskDeadline] = useState<string>('');
  const navigate = useNavigate();
  const lastProjectTasksRef = useRef<Record<string, string>>({});
  const [assigneeMenuTaskId, setAssigneeMenuTaskId] = useState<string | null>(null);
  const [newAssigneesOpen, setNewAssigneesOpen] = useState(false);
  const assigneeMenuRef = useRef<HTMLDivElement | null>(null);
  const newAssigneesRef = useRef<HTMLDivElement | null>(null);
  const [taskDragId, setTaskDragId] = useState<string | null>(null);
  const [taskDragProjectId, setTaskDragProjectId] = useState<string | null>(null);
  const [taskDragOverId, setTaskDragOverId] = useState<string | null>(null);
  const taskStatusLabels = useMemo<Record<ProjectTask['status'], string>>(
    () => ({
      'К выполнению': t('crm.projects.detail.tasks.status.todo'),
      'В работе': t('crm.projects.detail.tasks.status.inProgress'),
      'На проверке': t('crm.projects.detail.tasks.status.review'),
      Заблокировано: t('crm.projects.detail.tasks.status.blocked'),
      Отложено: t('crm.projects.detail.tasks.status.deferred'),
      Готово: t('crm.projects.detail.tasks.status.done'),
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

  const normalize = (value?: string | null) =>
    (value ?? '').toString().trim().toLowerCase();
  const currentStaff = staff.find(
    (u) => u.id === user?.id || u.email === user?.email,
  );
  const currentLabels = useMemo(
    () =>
      [user?.name, user?.email, currentStaff?.fullName]
        .filter(Boolean)
        .map((v) => normalize(v as string)),
    [user, currentStaff],
  );
  const isOwnerRole = user?.role === 'owner';
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

  const projectOwners = (project: Project) =>
    (project.owner ?? '')
      .split(/[,;/]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => normalize(value));

  const isProjectOwner = (project: Project) =>
    projectOwners(project).some((name) => currentLabels.includes(name));

  const isTaskAssignee = (task: ProjectTask) =>
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

  const canViewTask = (task: FlattenedTask, project: Project) =>
    isOwnerRole || isTaskAssignee(task) || isProjectOwner(project);
  const canEditTask = (task: FlattenedTask, project: Project) =>
    isOwnerRole || isTaskAssignee(task) || isProjectOwner(project);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchProjects(), fetchStaff()])
      .then(async ([res, staffUsers]) => {
        if (!alive) return;
        setProjects(res.items);
        setStaff(staffUsers);
        try {
          const detailed = await Promise.all(
            res.items.map((p) => fetchProject(p.id).catch(() => p)),
          );
          if (!alive) return;
          const byId = new Map(detailed.map((p) => [p.id, p]));
          setProjects((prev) =>
            prev.map((p) => {
              const full = byId.get(p.id);
              if (!full) return p;
              const cached = readTasksCache(full.id);
              const source =
                (full.tasks && full.tasks.length > 0) ? full.tasks : cached ?? [];
              if (source.length > 0) writeTasksCache(full.id, source);
              return { ...p, tasks: source };
            }),
          );
        } catch (err) {
          console.error(err);
        }
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.projects.tasks.errors.loadFailed'));
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [t]);

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
        assigneeMenuTaskId &&
        assigneeMenuRef.current &&
        !assigneeMenuRef.current.contains(target)
      ) {
        setAssigneeMenuTaskId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [newAssigneesOpen, assigneeMenuTaskId]);

  const tasks: FlattenedTask[] = useMemo(() => {
    const list: FlattenedTask[] = [];
    projects.forEach((p) => {
      (p.tasks || []).forEach((t) => {
        list.push({
          ...t,
          projectId: p.id,
          projectName: p.name,
          projectOwner: p.owner ?? null,
        });
      });
    });
    return list;
  }, [projects]);

  const projectProgress = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => {
      const total = p.tasks?.length ?? 0;
      const done = p.tasks?.filter((t) => isDoneStatus(t.status)).length ?? 0;
      map.set(p.id, total ? Math.round((done / total) * 100) : 0);
    });
    return map;
  }, [projects]);

  const filteredTasks = useMemo(() => {
    const query = normalize(search);
    return tasks.filter((task) => {
      const project = projects.find((p) => p.id === task.projectId);
      if (!project) return false;
      if (!canViewTask(task, project)) return false;
      if (filterProjectId && task.projectId !== filterProjectId) return false;
      if (filterStatus && task.status !== filterStatus) return false;
      if (!query) return true;
      return (
        normalize(task.title).includes(query) ||
        normalize(task.projectName).includes(query) ||
        (task.assignees || []).some((a) => normalize(a).includes(query))
      );
    });
  }, [tasks, projects, search, filterProjectId, filterStatus, currentLabels]);

  const resolveAssignees = (task: ProjectTask) => {
    const names = task.assignees || [];
    return names.map((entry) => resolveStaffForAssigneeEntry(staff, entry) || entry);
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

  const updateTask = async (
    projectId: string,
    taskId: string,
    patch: Partial<ProjectTask>,
  ) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const targetTask = (project.tasks || []).find((t) => t.id === taskId);
    if (!targetTask) return;
    if (!canEditTask({ ...targetTask, projectId, projectName: project.name, projectOwner: project.owner ?? null }, project)) {
      return;
    }
    const nextTasks = (project.tasks || []).map((t) =>
      t.id === taskId ? { ...t, ...patch } : t,
    );
    lastProjectTasksRef.current[projectId] = JSON.stringify(nextTasks);
    writeTasksCache(projectId, nextTasks);
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, tasks: nextTasks } : p)),
    );
    try {
      const saved = await updateProject(
        { ...project, tasks: nextTasks },
        { includeEmptyTasks: true, excludeStatus: true },
      );
      const resolved = resolveSavedTasks(saved.tasks, nextTasks);
      const snapshot = lastProjectTasksRef.current[projectId];
      if (snapshot && snapshot !== JSON.stringify(resolved)) {
        return;
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...saved, tasks: resolved } : p,
        ),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.tasks.errors.loadFailed'));
    }
  };

  const toggleTaskDone = (projectId: string, taskId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const tsk = project?.tasks?.find((t) => t.id === taskId);
    if (!tsk) return;
    const next: ProjectTask['status'] = isDoneStatus(tsk.status)
      ? 'К выполнению'
      : 'Готово';
    void updateTask(projectId, taskId, { status: next });
  };

  const reorderTasksInProject = async (
    projectId: string,
    fromId: string,
    toId: string,
  ) => {
    if (fromId === toId) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const targetTask = (project.tasks || []).find((t) => t.id === fromId);
    if (!targetTask) return;
    if (
      !canEditTask(
        {
          ...targetTask,
          projectId,
          projectName: project.name,
          projectOwner: project.owner ?? null,
        },
        project,
      )
    ) {
      return;
    }
    const nextTasks = [...(project.tasks || [])];
    const fromIdx = nextTasks.findIndex((t) => t.id === fromId);
    const toIdx = nextTasks.findIndex((t) => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [removed] = nextTasks.splice(fromIdx, 1);
    nextTasks.splice(toIdx, 0, removed);
    lastProjectTasksRef.current[projectId] = JSON.stringify(nextTasks);
    writeTasksCache(projectId, nextTasks);
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, tasks: nextTasks } : p)),
    );
    try {
      const saved = await updateProject(
        { ...project, tasks: nextTasks },
        { includeEmptyTasks: true, excludeStatus: true },
      );
      const resolved = resolveSavedTasks(saved.tasks, nextTasks);
      const snapshot = lastProjectTasksRef.current[projectId];
      if (snapshot && snapshot !== JSON.stringify(resolved)) {
        return;
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...saved, tasks: resolved } : p,
        ),
      );
      writeTasksCache(projectId, resolved);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.tasks.errors.loadFailed'));
    }
  };

  const removeTask = async (projectId: string, taskId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const targetTask = (project.tasks || []).find((t) => t.id === taskId);
    if (!targetTask) return;
    if (
      !canEditTask(
        { ...targetTask, projectId, projectName: project.name, projectOwner: project.owner ?? null },
        project,
      )
    ) {
      return;
    }
    const nextTasks = (project.tasks || []).filter((t) => t.id !== taskId);
    lastProjectTasksRef.current[projectId] = JSON.stringify(nextTasks);
    writeTasksCache(projectId, nextTasks);
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, tasks: nextTasks } : p)),
    );
    try {
      const saved = await updateProject(
        { ...project, tasks: nextTasks },
        { includeEmptyTasks: true, excludeStatus: true },
      );
      const resolved = resolveSavedTasks(saved.tasks, nextTasks);
      const snapshot = lastProjectTasksRef.current[projectId];
      if (snapshot && snapshot !== JSON.stringify(resolved)) {
        return;
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...saved, tasks: resolved } : p,
        ),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.tasks.errors.loadFailed'));
    }
  };

  const createTask = async () => {
    const projectId = newTaskProjectId || projects[0]?.id;
    if (!projectId) return;
    const title = newTaskTitle.trim();
    if (!title) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (!isOwnerRole && !isProjectOwner(project)) return;
    const assignees = normalizeAssigneesToStaffIds(newTaskAssignees, staff);
    const newTask: ProjectTask = {
      id: generateId('t'),
      title,
      assignees,
      status: newTaskStatus,
      priority: newTaskPriority,
      deadline: newTaskDeadline || null,
      checklist: [],
    };
    const nextTasks = [...(project.tasks || []), newTask];
    lastProjectTasksRef.current[projectId] = JSON.stringify(nextTasks);
    writeTasksCache(projectId, nextTasks);
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, tasks: nextTasks } : p)),
    );
    try {
      const saved = await updateProject(
        { ...project, tasks: nextTasks },
        { includeEmptyTasks: true, excludeStatus: true },
      );
      const resolved = resolveSavedTasks(saved.tasks, nextTasks);
      const snapshot = lastProjectTasksRef.current[projectId];
      if (snapshot && snapshot !== JSON.stringify(resolved)) {
        return;
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...saved, tasks: resolved } : p,
        ),
      );
      writeTasksCache(projectId, resolved);
      setNewTaskTitle('');
      setNewTaskAssignees([]);
      setNewTaskStatus('К выполнению');
      setNewTaskPriority('Обычный');
      setNewTaskDeadline('');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.tasks.errors.loadFailed'));
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="projectsTasks" />
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            {t('crm.projects.tasks.kicker')}
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-lumiva-accent">
            {t('crm.projects.tasks.title')}
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            {t('crm.projects.tasks.subtitle')}
          </p>
        </section>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.projects.tasks.filters.search')}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
            />
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-800"
            >
              <option value="">{t('crm.projects.tasks.filters.project')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ProjectTask['status'] | '')}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-800"
            >
              <option value="">{t('crm.projects.tasks.filters.status')}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {taskStatusLabels[status] ?? status}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">
              {t('crm.projects.tasks.newTask.title')}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={newTaskProjectId}
                onChange={(e) => setNewTaskProjectId(e.target.value)}
                className="min-w-[180px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-slate-100 text-slate-800"
              >
                <option value="">{t('crm.projects.tasks.newTask.project')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={t('crm.projects.tasks.newTask.placeholder')}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-300 text-xs bg-slate-100 text-slate-800 placeholder:text-slate-500"
              />
              <div className="relative" ref={newAssigneesRef}>
                <button
                  type="button"
                  onClick={() => setNewAssigneesOpen((prev) => !prev)}
                  className="min-w-[180px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-slate-100 text-slate-800 flex items-center justify-between gap-2"
                >
                  <span>{t('crm.projects.tasks.newTask.assignees')}</span>
                  <span className="text-[10px] text-slate-500">
                    {newTaskAssignees.length}
                  </span>
                </button>
                {newAssigneesOpen && (
                  <div className="absolute z-20 mt-2 w-56 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg p-2">
                    {staffForTasks.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={newTaskAssignees.includes(u.id)}
                          onChange={() =>
                            setNewTaskAssignees((prev) =>
                              prev.includes(u.id)
                                ? prev.filter((id) => id !== u.id)
                                : [...prev, u.id],
                            )
                          }
                        />
                        <span className="text-xs text-slate-700">{u.fullName}</span>
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
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-slate-100 text-slate-800"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {taskStatusLabels[status] ?? status}
                  </option>
                ))}
              </select>
              <select
                value={newTaskPriority}
                onChange={(e) =>
                  setNewTaskPriority(e.target.value as ProjectTask['priority'])
                }
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-slate-100 text-slate-800"
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {taskPriorityLabels[priority] ?? priority}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newTaskDeadline}
                onChange={(e) => setNewTaskDeadline(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-slate-100 text-slate-800"
              />
              <button
                type="button"
                onClick={createTask}
                className="px-3 py-2 text-xs rounded-xl border border-lumiva-accent bg-lumiva-accent text-white font-semibold shadow-sm hover:opacity-90"
              >
                {t('crm.projects.tasks.newTask.add')}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500">{t('crm.projects.tasks.loading')}</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-lumiva-accent">
                  {t('crm.projects.tasks.table.title')}
                </h2>
                <span className="text-[11px] text-slate-500">
                  {t('crm.projects.tasks.table.total', { count: filteredTasks.length })}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                <ul className="divide-y divide-slate-200">
                  {!filteredTasks.length ? (
                    <li className="px-4 py-8 text-center text-xs text-slate-500">
                      {t('crm.projects.tasks.empty')}
                    </li>
                  ) : (
                    filteredTasks.map((task) => {
                      const project = projects.find((p) => p.id === task.projectId);
                      if (!project) return null;
                      const editable = canEditTask(task, project);
                      const assignees = resolveAssignees(task);
                      const projectPercent = projectProgress.get(project.id) ?? 0;
                      const done = isDoneStatus(task.status);
                      const hasMention = isTextMentioning(task.title || '', currentLabels);
                      const ctl =
                        'rounded-lg border border-slate-300 bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-lumiva-accent/25';
                      return (
                        <li
                          key={`${task.projectId}-${task.id}`}
                          draggable={editable}
                          onDragStart={(e) => {
                            if (!editable) {
                              e.preventDefault();
                              return;
                            }
                            if (isProjectTasksRowDragBlockedTarget(e.target)) {
                              e.preventDefault();
                              return;
                            }
                            e.dataTransfer.setData('text/plain', task.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setTaskDragId(task.id);
                            setTaskDragProjectId(task.projectId);
                          }}
                          onDragEnd={() => {
                            setTaskDragId(null);
                            setTaskDragProjectId(null);
                            setTaskDragOverId(null);
                          }}
                          className={`bg-white transition-colors hover:bg-slate-50/90 ${
                            editable ? 'cursor-grab active:cursor-grabbing' : ''
                          } ${
                            taskDragOverId === task.id &&
                            taskDragId &&
                            taskDragId !== task.id &&
                            taskDragProjectId === task.projectId
                              ? 'ring-2 ring-inset ring-lumiva-accent/40'
                              : ''
                          } ${taskDragId === task.id ? 'opacity-60' : ''}`}
                          onDragOver={(e) => {
                            if (!editable || !taskDragId || !taskDragProjectId) return;
                            if (taskDragProjectId !== task.projectId) return;
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
                            if (!editable) return;
                            e.preventDefault();
                            setTaskDragOverId(null);
                            const fromId = taskDragId;
                            const fromProject = taskDragProjectId;
                            setTaskDragId(null);
                            setTaskDragProjectId(null);
                            if (!fromId || !fromProject || fromProject !== task.projectId) return;
                            void reorderTasksInProject(fromProject, fromId, task.id);
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
                              onClick={() => toggleTaskDone(task.projectId, task.id)}
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors disabled:cursor-not-allowed ${
                                done
                                  ? 'border-lumiva-accent bg-lumiva-accent text-white'
                                  : 'border-slate-400 bg-white hover:border-slate-500'
                              }`}
                              aria-pressed={done}
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
                            <div className="min-w-0 flex-1 space-y-2">
                              {editable ? (
                                <input
                                  draggable={false}
                                  value={task.title}
                                  onChange={(e) =>
                                    updateTask(project.id, task.id, {
                                      title: e.target.value,
                                    })
                                  }
                                  className={`w-full cursor-text border-0 bg-transparent text-[13px] font-semibold outline-none ring-0 focus:ring-0 ${
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
                                <div className="text-[10px] text-sky-600">
                                  {t('crm.projects.detail.mentions.inTask')}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  draggable={false}
                                  onClick={() => navigate(`/projects/${project.id}`)}
                                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-lumiva-accent hover:bg-slate-100"
                                >
                                  {project.name}
                                </button>
                                <span className="text-[10px] text-slate-500">
                                  {t('crm.projects.list.headers.progress')}: {projectPercent}%
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {assignees.length ? (
                                    assignees.map((owner) => {
                                      const label =
                                        typeof owner === 'string' ? owner : owner.fullName;
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
                                        assigneeMenuTaskId === task.id ? assigneeMenuRef : null
                                      }
                                    >
                                      <button
                                        type="button"
                                        draggable={false}
                                        onClick={() =>
                                          setAssigneeMenuTaskId((prev) =>
                                            prev === task.id ? null : task.id,
                                          )
                                        }
                                        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-400 bg-slate-100 text-[13px] font-medium text-slate-700 hover:bg-slate-200"
                                        title={t('crm.projects.tasks.newTask.assignees')}
                                      >
                                        +
                                      </button>
                                      {assigneeMenuTaskId === task.id && (
                                        <div
                                          className="absolute z-20 mt-2 w-56 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                                          data-no-task-drag
                                        >
                                          {staffForTasks.map((u) => (
                                            <label
                                              key={u.id}
                                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isTaskAssigneeSelected(task.assignees, u)}
                                                onChange={() =>
                                                  updateTask(project.id, task.id, {
                                                    assignees: normalizeAssigneesToStaffIds(
                                                      toggleTaskAssigneeIds(task.assignees, u),
                                                      staff,
                                                    ),
                                                  })
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
                                    onChange={(e) =>
                                      updateTask(project.id, task.id, {
                                        status: e.target.value as ProjectTask['status'],
                                      })
                                    }
                                    className={ctl}
                                  >
                                    {STATUS_OPTIONS.map((status) => (
                                      <option key={status} value={status}>
                                        {taskStatusLabels[status] ?? status}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                                    {taskStatusLabels[task.status] ?? task.status}
                                  </span>
                                )}
                                {editable ? (
                                  <select
                                    draggable={false}
                                    value={task.priority}
                                    onChange={(e) =>
                                      updateTask(project.id, task.id, {
                                        priority: e.target.value as ProjectTask['priority'],
                                      })
                                    }
                                    className={ctl}
                                  >
                                    {PRIORITY_OPTIONS.map((priority) => (
                                      <option key={priority} value={priority}>
                                        {taskPriorityLabels[priority] ?? priority}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                                    {taskPriorityLabels[task.priority] ?? task.priority}
                                  </span>
                                )}
                                {editable ? (
                                  <input
                                    draggable={false}
                                    type="date"
                                    value={task.deadline || ''}
                                    onChange={(e) =>
                                      updateTask(project.id, task.id, {
                                        deadline: e.target.value || null,
                                      })
                                    }
                                    className={ctl}
                                  />
                                ) : (
                                  <span className="text-[11px] text-slate-600">
                                    {task.deadline
                                      ? new Date(task.deadline).toLocaleDateString(locale)
                                      : t('crm.projects.common.emptyValue')}
                                  </span>
                                )}
                                {editable && (
                                  <button
                                    type="button"
                                    draggable={false}
                                    onClick={() => removeTask(project.id, task.id)}
                                    className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-100"
                                  >
                                    {t('crm.projects.tasks.table.actions.remove')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};
