// src/pages/projects/ProjectFormPage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';

import {
  PROJECT_CATEGORIES,
  PROJECT_TAGS,
  createEmptyProject,
  type Project,
  type ProjectStatus,
  type ProjectTask,
  type ProjectComment,
  type ProjectTaskChecklistItem,
} from './projectTypes';

import {
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  fetchProjectActivities,
  type ProjectActivity,
} from '../../api/projects';
import { fetchLeadsList, type Lead } from '../../api/leads';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { getStoredUser } from '../../auth/session';
import { fetchCompanies, type Company } from '../../api/companies';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';

type TabId = 'props' | 'tasks' | 'comments' | 'history';

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

export const ProjectFormPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('props');
  const [project, setProject] = useState<Project>(createEmptyProject());
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Лиды для селекта "Лид"
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  // Сотрудники для "Ответственный"
  const [staff, setStaff] = useState<StaffUser[]>([]);
  // Компании для отображения
  const [companies, setCompanies] = useState<Company[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false);
  const [customFieldsError, setCustomFieldsError] = useState<string | null>(null);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.keys(project.customFields ?? {}).forEach((key) => keys.add(key));
    return Array.from(keys);
  }, [project.customFields]);

  // ---------------- Задачи и комментарии ----------------
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [showMentionsHint, setShowMentionsHint] = useState(false);
  const [mentionTargets, setMentionTargets] = useState<ProjectComment[]>([]);
  const projectRef = useRef<Project>(project);
  const commentsRef = useRef<ProjectComment[]>(comments);
  const lastTasksSnapshotRef = useRef<string>('');
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
  const taskAssigneesRef = useRef<HTMLDivElement | null>(null);
  const newAssigneesRef = useRef<HTMLDivElement | null>(null);

  const statusLabels = useMemo<Record<ProjectStatus, string>>(
    () => ({
      Новый: t('crm.projects.statuses.new'),
      'В работе': t('crm.projects.statuses.inProgress'),
      'На проверке': t('crm.projects.statuses.review'),
      Заморожен: t('crm.projects.statuses.paused'),
      Выиграно: t('crm.projects.statuses.won'),
      Проиграно: t('crm.projects.statuses.lost'),
    }),
    [t],
  );
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
    }),
    [t],
  );
  const user = getStoredUser();
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
  const extractMentions = (text: string) => {
    const matches = text.matchAll(/@([\p{L}\p{N}._-]+)/gu);
    const result: string[] = [];
    for (const match of matches) {
      if (match[1]) result.push(match[1]);
    }
    return result;
  };
  const renderMentions = (text: string) => {
    const parts = text.split(/(@[\p{L}\p{N}._-]+)/gu);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        return (
          <span key={`${part}-${idx}`} className="text-sky-300">
            {part}
          </span>
        );
      }
      return <span key={`${part}-${idx}`}>{part}</span>;
    });
  };
  const isMentioned = (mentions: string[]) => {
    const normalizedMentions = mentions.map((m) => normalizeUser(m));
    return normalizedMentions.some((m) => currentLabels.includes(m));
  };
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
  const staffForTasks = managerStaff.length ? managerStaff : staff;
  const canEditTask = (task: ProjectTask) =>
    isOwnerRole ||
    isProjectOwner ||
    (task.assignees || [])
      .map((value) => normalizeUser(value))
      .some((value) => currentLabels.includes(value));
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
  const resolveAssignees = (task: ProjectTask) =>
    (task.assignees || []).map((name) => staff.find((u) => u.fullName === name) || name);
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
  const tagLabels = useMemo<Record<string, string>>(
    () => ({
      CRM: t('crm.projects.tags.crm'),
      IT: t('crm.projects.tags.it'),
      WEB: t('crm.projects.tags.web'),
      SEO: t('crm.projects.tags.seo'),
      SMM: t('crm.projects.tags.smm'),
      ADS: t('crm.projects.tags.ads'),
    }),
    [t],
  );

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
    let alive = true;

    if (isNew) {
      const empty = createEmptyProject();
      setProject(empty);
      const normalizedTasks = normalizeTasks(empty.tasks || []);
      setTasks(normalizedTasks);
      setComments(empty.comments || []);
      lastTasksSnapshotRef.current = JSON.stringify(normalizedTasks);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);

      fetchProject(id as string)
        .then((p) => {
          if (!alive) return;
          setProject(p);
          const cached = readTasksCache(p.id);
          const source =
            (p.tasks && p.tasks.length > 0) ? p.tasks : cached ?? [];
          const normalizedTasks = normalizeTasks(source);
          setTasks(normalizedTasks);
          writeTasksCache(p.id, normalizedTasks);
          lastTasksSnapshotRef.current = JSON.stringify(normalizedTasks);
          setComments(p.comments || []);
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

    // параллельно — список лидов, сотрудников и компаний
    Promise.all([fetchLeadsList(), fetchStaff(), fetchCompanies({ limit: 100 })])
      .then(([leads, users, companiesRes]) => {
        if (!alive) return;
        setAllLeads(leads);
        setStaff(users);
        setCompanies(companiesRes.items);
      })
      .catch((e) => {
        if (!alive) return;
        console.error('Ошибка загрузки данных для проектов', e);
      });

    return () => {
      alive = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (tab !== 'history' || isNew || !project.id) return;
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
  }, [tab, isNew, project.id, t]);

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
      const mentions = c.mentions ?? extractMentions(c.text || '');
      if (!mentions.length) return false;
      if (!isMentioned(mentions)) return false;
      return !seen.includes(c.id);
    });
    setMentionTargets(targets);
    setShowMentionsHint(targets.length > 0);
  }, [comments, extractMentions, isMentioned, isNew, project.id]);

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

  const title = useMemo(
    () =>
      isNew
        ? t('crm.projects.detail.titleNew')
        : t('crm.projects.detail.titleExisting', { id: project.id }),
    [isNew, project.id],
  );

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
        saved = await createProject(payload);
      } else {
        saved = await updateProject(payload, {
          includeEmptyTasks: true,
          includeEmptyComments: true,
        });
      }
      setProject(saved);
      const resolvedTasks = normalizeTasks(resolveSavedTasks(saved.tasks, tasks));
      setTasks(resolvedTasks);
      writeTasksCache(saved.id, resolvedTasks);
      setComments(saved.comments || []);
      navigate('/app/projects');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.detail.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const persistTasks = useCallback(
    async (nextTasks: ProjectTask[], snapshot: string) => {
      if (isNew || saving) return;
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
        });
        if (saveSeqRef.current !== seq) return;
        if (lastTasksSnapshotRef.current !== snapshot) {
          return;
        }
        const resolved = resolveSavedTasks(saved.tasks, nextTasks);
        setProject(saved);
        const normalized = normalizeTasks(resolved);
        setTasks(normalized);
        writeTasksCache(saved.id, normalized);
        setComments(saved.comments || commentsRef.current);
      } catch (e: any) {
        console.error(e);
        setError(e.message || t('crm.projects.detail.errors.saveFailed'));
      }
    },
    [isNew, saving, t],
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
      navigate('/app/projects');
      return;
    }
    if (!window.confirm(t('crm.projects.detail.confirmDelete'))) return;

    setSaving(true);
    setError(null);
    try {
      await deleteProject(project.id);
      navigate('/app/projects');
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

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ProjectStatus;
    setProject((prev) => ({ ...prev, status: value }));
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

  // выбор ответственных из справочника сотрудников
  const handleOwnerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIds = Array.from(e.target.selectedOptions)
      .map((opt) => opt.value)
      .filter(Boolean);
    const names = staff
      .filter((u) => selectedIds.includes(u.id))
      .map((u) => u.fullName);

    setProject((prev) => ({
      ...prev,
      ownerUserIds: selectedIds,
      ownerUserId: selectedIds[0] ?? null,
      owner: names.length ? names.join(', ') : null,
    }));
  };

  // ---------------- Задачи ----------------

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title || !isProjectOwner) return;
    const assigneesArr = staff
      .filter((u) => newTaskAssignees.includes(u.id))
      .map((u) => u.fullName);

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

  const updateTaskDeadline =
    (taskId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value || null;
      const target = tasks.find((task) => task.id === taskId);
      if (!target || !canEditTask(target)) return;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, deadline: value } : t)),
      );
    };

  const removeTask = (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const toggleAssigneeSelection = (list: string[], name: string) => {
    if (list.includes(name)) {
      return list.filter((item) => item !== name);
    }
    return [...list, name];
  };

  const toggleTaskAssignee = (taskId: string, name: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canEditTask(target)) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, assignees: toggleAssigneeSelection(t.assignees || [], name) }
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
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              checklist: t.checklist.map((c) =>
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
          : t,
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
      author: t('crm.projects.detail.fallbacks.user'),
      createdAt: new Date().toLocaleString(locale),
      text: newComment.trim(),
      mentions,
    };
    setComments((prev) => [c, ...prev]);
    setNewComment('');
  };

  // ---------------- Рендер ----------------

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Верхняя панель проекта */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-slate-500">{title}</div>
            <h1 className="text-lg font-semibold text-slate-50">
              {project.name || t('crm.projects.detail.fallbacks.untitled')}
            </h1>
            {loading && (
              <div className="text-[11px] text-slate-500 mt-1">
                {t('crm.projects.detail.loading')}
              </div>
            )}
            {error && (
              <div className="text-[11px] text-rose-400 mt-1">{error}</div>
            )}
            {showMentionsHint && mentionTargets.length > 0 && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-200">
                <span className="text-sky-300">🔔</span>
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
                  className="ml-2 text-[11px] text-slate-300 hover:text-white"
                >
                  {t('crm.projects.detail.mentions.ok')}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded-xl border border-rose-500/60 text-rose-300 hover:bg-rose-950/60 disabled:opacity-60"
              >
                {t('crm.projects.detail.actions.delete')}
              </button>
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
              className="px-3 py-1.5 text-xs rounded-xl !bg-slate-900 !text-white font-semibold hover:!bg-slate-800 disabled:opacity-60"
              style={{ backgroundColor: '#0f172a', color: '#fff' }}
            >
              {saving
                ? t('crm.projects.detail.actions.saving')
                : t('crm.projects.detail.actions.save')}
            </button>
          </div>
        </div>

        {/* Вкладки */}
        <div className="inline-flex bg-slate-900/70 border border-slate-800/80 rounded-2xl p-1 text-[13px]">
          <button
            type="button"
            onClick={() => setTab('props')}
            className={
              'px-4 py-1.5 rounded-xl ' +
              (tab === 'props'
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:text-slate-100')
            }
          >
            {t('crm.projects.detail.tabs.props')}
          </button>
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={
              'px-4 py-1.5 rounded-xl ' +
              (tab === 'tasks'
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:text-slate-100')
            }
          >
            {t('crm.projects.detail.tabs.tasks')}
          </button>
          <button
            type="button"
            onClick={() => setTab('comments')}
            className={
              'px-4 py-1.5 rounded-xl ' +
              (tab === 'comments'
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:text-slate-100')
            }
          >
            {t('crm.projects.detail.tabs.comments')}
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
            {t('crm.projects.detail.tabs.history')}
          </button>
        </div>

        {/* Контент вкладок */}
        {tab === 'props' && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            {/* Название + ответственный */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={project.name}
                onChange={handleChange('name')}
                placeholder={t('crm.projects.detail.fields.name')}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              />

              <select
                multiple
                value={project.ownerUserIds ?? []}
                onChange={handleOwnerSelect}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft min-h-[44px]"
              >
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                    {u.email ? ` · ${u.email}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Описание + лид */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <textarea
                value={project.description}
                onChange={handleChange('description')}
                placeholder={t('crm.projects.detail.fields.description')}
                rows={4}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft resize-none"
              />

              <div className="space-y-2">
                <select
                  value={project.leadId || ''}
                  onChange={handleLeadChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                >
                  <option value="">
                    {t('crm.projects.detail.fields.leadEmpty')}
                  </option>
                  {allLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {(l.name || t('crm.projects.detail.fields.leadNameFallback')) +
                        (l.email ? ` · ${l.email}` : '')}
                    </option>
                  ))}
                </select>

                <input
                  value={project.leadName || ''}
                  onChange={(e) =>
                    setProject((prev) => ({
                      ...prev,
                      leadName: e.target.value || null,
                    }))
                  }
                  placeholder={t('crm.projects.detail.fields.leadName')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                />
                <input
                  value={project.leadEmail || ''}
                  onChange={(e) =>
                    setProject((prev) => ({
                      ...prev,
                      leadEmail: e.target.value || null,
                    }))
                  }
                  placeholder={t('crm.projects.detail.fields.leadEmail')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                />
              </div>
            </div>

            {/* Компания (только для чтения, через лид) */}
            {project.leadId && (() => {
              const lead = allLeads.find((l) => l.id === project.leadId);
              const company = lead?.companyId
                ? companies.find((c) => c.id === lead.companyId)
                : null;
              return company ? (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">
                    Компания
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={company.name}
                      readOnly
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-700/50 text-sm text-slate-400 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => navigate(`/app/companies/${company.id}`)}
                      className="px-3 py-2 text-xs rounded-xl border border-slate-700 text-slate-400 hover:text-slate-50 hover:border-slate-600 transition-colors"
                    >
                      Открыть
                    </button>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Стоимость, дата, статус, категория */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="number"
                value={project.amount || ''}
                onChange={handleChange('amount')}
                placeholder={t('crm.projects.detail.fields.amount')}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              />
              <input
                value={project.createdAt}
                onChange={handleChange('createdAt')}
                placeholder={t('crm.projects.detail.fields.createdAt')}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              />
              <select
                value={project.status}
                onChange={handleStatusChange}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              >
                {PROJECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {statusLabels[st]}
                  </option>
                ))}
              </select>
              <select
                value={project.category || ''}
                onChange={handleCategoryChange}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              >
                <option value="">
                  {t('crm.projects.detail.fields.category')}
                </option>
                {PROJECT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat] ?? cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Метки */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400">
                {t('crm.projects.detail.fields.tags')}
              </div>
              <div className="flex flex-wrap gap-2">
                {PROJECT_TAGS.map((tag) => {
                  const active = project.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={
                        'px-2 py-0.5 rounded-full text-[11px] border ' +
                        (active
                          ? 'bg-rose-500 text-rose-50 border-rose-500'
                          : 'bg-slate-950/80 text-slate-300 border-slate-700/80')
                      }
                    >
                      #{tagLabels[tag] ?? tag}
                    </button>
                  );
                })}
              </div>
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

            {/* Файлы (ТЗ / смета / договор) */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400">
                {t('crm.projects.detail.files.title')}
              </div>
              <input
                value={project.briefFileName || ''}
                onChange={(e) =>
                  setProject((prev) => ({
                    ...prev,
                    briefFileName: e.target.value || null,
                  }))
                }
                placeholder={t('crm.projects.detail.files.namePlaceholder')}
                className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              />
              <input
                value={project.briefFileUrl || ''}
                onChange={(e) =>
                  setProject((prev) => ({
                    ...prev,
                    briefFileUrl: e.target.value || null,
                  }))
                }
                placeholder={t('crm.projects.detail.files.urlPlaceholder')}
                className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              />
            </div>
          </div>
        )}

        {/* Вкладка Задачи */}
        {tab === 'tasks' && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.projects.detail.tasks.title')}
                </div>
                <div className="text-[11px] text-slate-500">
                  {tasks.filter((task) => isDoneStatus(task.status)).length}/
                  {tasks.length} ·{' '}
                  {tasks.length
                    ? Math.round(
                        (tasks.filter((task) => isDoneStatus(task.status)).length /
                          tasks.length) *
                          100,
                      )
                    : 0}
                  %
                </div>
              </div>
              {!isProjectOwner && (
                <div className="text-[11px] text-slate-500">
                  {t('crm.projects.detail.tasks.readOnly')}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {t('crm.projects.detail.tasks.newTitle')}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
              <input
                placeholder={t('crm.projects.detail.tasks.newTitle')}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                  disabled={!isProjectOwner}
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 text-sm outline-none disabled:opacity-60"
              />
                <div className="relative" ref={newAssigneesRef}>
                  <button
                    type="button"
                    onClick={() => setNewAssigneesOpen((prev) => !prev)}
                    disabled={!isProjectOwner}
                    className="min-w-[180px] px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 text-sm outline-none disabled:opacity-60 flex items-center justify-between gap-2"
                  >
                    <span>{t('crm.projects.detail.tasks.newAssignees')}</span>
                    <span className="text-[10px] text-slate-400">
                      {newTaskAssignees.length}
                    </span>
                  </button>
                  {newAssigneesOpen && (
                    <div className="absolute z-20 mt-2 w-60 max-h-64 overflow-auto rounded-xl border border-slate-800/80 bg-slate-950 shadow-lg p-2">
                      {staffForTasks.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60"
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
                          <span className="text-xs text-slate-200">{u.fullName}</span>
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
                className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 text-sm disabled:opacity-60"
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
                  setNewTaskPriority(
                    e.target.value as ProjectTask['priority'],
                  )
                }
                  disabled={!isProjectOwner}
                  className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 text-sm disabled:opacity-60"
              >
                <option value="Обычный">
                  {taskPriorityLabels.Обычный}
                </option>
                <option value="Высокий">
                  {taskPriorityLabels.Высокий}
                </option>
                <option value="Низкий">{taskPriorityLabels.Низкий}</option>
              </select>
              <input
                type="date"
                value={newTaskDeadline}
                onChange={(e) => setNewTaskDeadline(e.target.value)}
                  disabled={!isProjectOwner}
                  className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 text-sm disabled:opacity-60"
              />
              <button
                type="button"
                onClick={addTask}
                  disabled={!isProjectOwner}
                  className="px-3 py-2 text-xs rounded-xl !bg-slate-900 !text-white font-semibold hover:!bg-slate-800 disabled:opacity-60"
              >
                {t('crm.projects.detail.tasks.add')}
              </button>
                </div>
              </div>

            <div className="space-y-3">
              {tasks.map((task) => {
                const editable = canEditTask(task);
                const assignees = resolveAssignees(task);
                const done = isDoneStatus(task.status);
                const taskMentions = extractMentions(task.title || '');
                const hasMention = taskMentions.length > 0 && isMentioned(taskMentions);
                const checklistTotal = task.checklist.length;
                const checklistDone = task.checklist.filter((c) => c.done).length;
                return (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3"
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex-1 min-w-[220px]">
                        {editable ? (
                    <input
                            value={task.title}
                            onChange={updateTask(task.id, 'title')}
                            className="w-full px-2 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs outline-none"
                    />
                        ) : (
                          <div className="text-sm text-slate-100 font-semibold">
                            {task.title}
                          </div>
                        )}
                        {hasMention && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-sky-300">
                            <span>@</span>
                            {t('crm.projects.detail.mentions.inTask')}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            {assignees.length ? (
                              assignees.map((owner) => {
                                const label =
                                  typeof owner === 'string'
                                    ? owner
                                    : owner.fullName;
                                const avatarUrl =
                                  typeof owner === 'string'
                                    ? null
                                    : owner.avatarUrl;
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
                                        .map((p) => p[0])
                                        .join('')
                                        .toUpperCase()
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <span>{t('crm.projects.common.emptyValue')}</span>
                            )}
                            {editable && (
                              <div
                                className="relative"
                                ref={taskAssigneesMenuId === task.id ? taskAssigneesRef : null}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTaskAssigneesMenuId((prev) =>
                                      prev === task.id ? null : task.id,
                                    )
                                  }
                                  className="h-6 w-6 rounded-full border border-slate-700 text-[12px] text-slate-300 hover:text-white"
                                  title={t('crm.projects.detail.tasks.newAssignees')}
                                >
                                  +
                                </button>
                                {taskAssigneesMenuId === task.id && (
                                  <div className="absolute z-20 mt-2 w-60 max-h-64 overflow-auto rounded-xl border border-slate-800/80 bg-slate-950 shadow-lg p-2">
                                    {staffForTasks.map((u) => (
                                      <label
                                        key={u.id}
                                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-900/60"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={(task.assignees || []).includes(u.fullName)}
                                          onChange={() =>
                                            toggleTaskAssignee(task.id, u.fullName)
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
                            )}
                          </div>
                          {editable ? (
                            <select
                              value={task.status}
                              onChange={updateTask(task.id, 'status')}
                              className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px]"
                            >
                              {TASK_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {taskStatusLabels[status]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{taskStatusLabels[task.status]}</span>
                          )}
                          {editable ? (
                    <select
                              value={task.priority}
                              onChange={updateTask(task.id, 'priority')}
                              className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px]"
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
                            <span>{taskPriorityLabels[task.priority]}</span>
                          )}
                          {editable ? (
                    <input
                      type="date"
                              value={task.deadline || ''}
                              onChange={updateTaskDeadline(task.id)}
                              className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px]"
                    />
                          ) : (
                            <span>
                              {task.deadline
                                ? new Date(task.deadline).toLocaleDateString(locale)
                                : t('crm.projects.common.emptyValue')}
                            </span>
                          )}
                          {checklistTotal > 0 && (
                            <span>
                              {checklistDone}/{checklistTotal}
                            </span>
                          )}
                          {editable && (
                      <button
                        type="button"
                        className="text-[11px] text-sky-400 hover:text-sky-300"
                              onClick={() => addChecklistItem(task.id)}
                      >
                        {t('crm.projects.detail.tasks.checklist')}
                      </button>
                          )}
                          {editable && (
                      <button
                        type="button"
                        className="text-[11px] text-rose-400 hover:text-rose-300"
                              onClick={() => removeTask(task.id)}
                      >
                        {t('crm.projects.detail.actions.remove')}
                      </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {task.checklist.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {task.checklist.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 text-[11px] text-slate-400"
                          >
                            <input
                              type="checkbox"
                              checked={c.done}
                              onChange={() => toggleChecklistDone(task.id, c.id)}
                              className="h-3 w-3"
                              disabled={!editable}
                            />
                            <input
                              value={c.title}
                              onChange={updateChecklistTitle(task.id, c.id)}
                              className="flex-1 px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 outline-none disabled:opacity-60"
                              placeholder={t('crm.projects.detail.tasks.subtask')}
                              disabled={!editable}
                            />
                            {c.done && (
                              <span className="text-slate-500">
                                {c.doneBy} · {c.doneAt}
                              </span>
                            )}
                            {editable && (
                            <button
                              type="button"
                              className="text-rose-400"
                                onClick={() => removeChecklistItem(task.id, c.id)}
                            >
                              ×
                            </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

                {tasks.length === 0 && (
                  <div className="text-[11px] text-slate-500 italic px-1 py-2">
                    {t('crm.projects.detail.tasks.empty')}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Вкладка Комментарии */}
        {tab === 'comments' && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            <div className="space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800/80 px-3 py-2 text-sm text-slate-100"
                >
                  {(() => {
                    const mentions = c.mentions ?? extractMentions(c.text || '');
                    return (
                      <>
                        <div className="text-[11px] text-slate-500 mb-1">
                          {c.createdAt} · {c.author}
                        </div>
                        <div className="whitespace-pre-wrap text-[13px]">
                          {renderMentions(c.text)}
                        </div>
                        {mentions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-400">
                            {mentions.map((m) => (
                              <span
                                key={m}
                                className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900/80 px-2 py-0.5"
                              >
                                @{m}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}

              {comments.length === 0 && (
                <div className="text-[11px] text-slate-500 italic">
                  {t('crm.projects.detail.comments.empty')}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800/80 pt-3 space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('crm.projects.detail.comments.newPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft resize-none"
              />
              <button
                type="button"
                onClick={addComment}
                className="px-3 py-1.5 text-xs rounded-xl !bg-slate-900 !text-white font-semibold hover:!bg-slate-800"
              >
                {t('crm.projects.detail.actions.add')}
              </button>
            </div>

            <div className="border-t border-slate-800/80 pt-3 space-y-2">
              <div className="text-xs text-slate-400">
                {t('crm.projects.detail.comments.draftTitle')}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder={t('crm.projects.detail.comments.draftPlaceholder')}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none"
                />
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-300 hover:bg-slate-900/70"
                >
                  {t('crm.projects.detail.actions.send')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Вкладка История */}
        {tab === 'history' && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            {activitiesLoading && (
              <div className="text-[11px] text-slate-500">
                {t('crm.projects.detail.history.loading')}
              </div>
            )}
            {activitiesError && (
              <div className="text-[11px] text-rose-400">{activitiesError}</div>
            )}
            {!activitiesLoading && !activities.length && (
              <div className="text-[11px] text-slate-500 italic">
                {t('crm.projects.detail.history.empty')}
              </div>
            )}
            <div className="space-y-2">
              {activities.map((activity) => {
                const label = activityLabels[activity.action] ?? activity.action;
                const actor =
                  activity.actorName || activity.actorEmail || t('crm.projects.detail.fallbacks.user');
                const changes = activity.payload?.changes ?? [];
                return (
                  <div
                    key={activity.id}
                    className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                  >
                    <div className="text-[11px] text-slate-500 mb-1">
                      {new Date(activity.createdAt).toLocaleString(locale)} · {actor}
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
                              {activityFieldLabels[change.field] ?? change.field}:
                            </span>{' '}
                            <span>{String(change.from ?? '')}</span> →{' '}
                            <span>{String(change.to ?? '')}</span>
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
        {customFieldsOpen && (
          <CustomFieldsManager
            entityType="project"
            title="Кастомные поля проектов"
            suggestedKeys={suggestedKeys}
            onClose={() => setCustomFieldsOpen(false)}
            onUpdated={(items) => {
              const sorted = [...items].sort((a, b) => a.order - b.order);
              setCustomFields(sorted);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
};
