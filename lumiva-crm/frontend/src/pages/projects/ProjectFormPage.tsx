// src/pages/projects/ProjectFormPage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import {
  readProjectTasksCache,
  writeProjectTasksCache,
} from './projectTasksCache';

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

/** Не начинать drag строки с полей, кнопок и зон с data-no-task-drag */
function isProjectTaskRowDragBlockedTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, button, a[href], [data-no-task-drag]',
    ),
  );
}

export const ProjectFormPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<TabId>(() => {
    const q = searchParams.get('tab');
    if (q === 'props' || q === 'tasks' || q === 'comments' || q === 'history') {
      return q;
    }
    return 'props';
  });

  useEffect(() => {
    const q = searchParams.get('tab');
    if (q === 'props' || q === 'tasks' || q === 'comments' || q === 'history') {
      setTab(q);
    }
  }, [searchParams]);

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
      'customFields.projectNotes': t('crm.projects.detail.notes.title'),
    }),
    [t],
  );
  const formatHistoryValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return t('crm.projects.common.emptyValue');
    }
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
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
  const tasksDoneCount = useMemo(
    () => tasks.filter((task) => isDoneStatus(task.status)).length,
    [tasks],
  );
  const tasksCompletionPercent = tasks.length
    ? Math.round((tasksDoneCount / tasks.length) * 100)
    : 0;
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
          const cached = readProjectTasksCache(p.id);
          const source =
            (p.tasks && p.tasks.length > 0) ? p.tasks : cached ?? [];
          const normalizedTasks = normalizeTasks(source);
          setTasks(normalizedTasks);
          writeProjectTasksCache(p.id, normalizedTasks);
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
        setAllLeads(leads.filter((lead) => !Boolean(lead.meta?.deleted)));
        setStaff(users);
        setCompanies(companiesRes.items);
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
        saved = await createProject(payload);
      } else {
        saved = await updateProject(payload, {
          includeEmptyTasks: true,
          includeEmptyComments: true,
        });
      }
      setProject(withLeadPresentation(saved, payload));
      const resolvedTasks = normalizeTasks(resolveSavedTasks(saved.tasks, tasks));
      setTasks(resolvedTasks);
      writeProjectTasksCache(saved.id, resolvedTasks);
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
        setProject(withLeadPresentation(saved, payload));
        const normalized = normalizeTasks(resolved);
        setTasks(normalized);
        writeProjectTasksCache(saved.id, normalized);
        setComments(saved.comments || commentsRef.current);
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
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500">{title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                value={project.name}
                onChange={handleChange('name')}
                placeholder={t('crm.projects.detail.fields.name')}
                className="w-full md:w-[420px] px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-sm text-slate-50 outline-none focus:border-lumiva-accent-soft"
              />
              <span className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-300">
                {statusLabels[project.status]}
              </span>
            </div>
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

          <div className="flex items-center gap-2 self-start">
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
              {t('crm.projects.detail.customFields.configure')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs rounded-xl border border-lumiva-accent bg-lumiva-accent font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
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
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-5 space-y-5">
            {/* Ответственные + лид */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-2 self-start">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    {t('crm.projects.detail.owner.byDepartment')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t('crm.projects.detail.owner.selected', {
                      count: (project.ownerUserIds || []).length,
                    })}
                  </div>
                </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {ownerDepartmentGroups.map((group) => {
                    const groupIds = group.users.map((u) => u.id);
                    const selectedInGroup = groupIds.filter((id) =>
                      (project.ownerUserIds || []).includes(id),
                    ).length;
                    const allChecked = selectedInGroup > 0 && selectedInGroup === groupIds.length;
                    return (
                      <div
                        key={group.department}
                        className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-2"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold text-slate-200 truncate">
                            {group.department}
                          </div>
                          <label className="flex items-center gap-1 text-[10px] text-slate-400">
                            <input
                              type="checkbox"
                              checked={allChecked}
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
                                className="flex items-center gap-2 text-[11px] text-slate-300"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
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

            {/* Описание */}
            <textarea
              value={project.description}
              onChange={handleChange('description')}
              placeholder={t('crm.projects.detail.fields.description')}
              rows={4}
              className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft resize-none"
            />

            {/* Компания (только для чтения, через лид) */}
            {project.leadId && (() => {
              const lead = allLeads.find((l) => l.id === project.leadId);
              const company = lead?.companyId
                ? companies.find((c) => c.id === lead.companyId)
                : null;
              return company ? (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">
                    {t('crm.projects.detail.fields.company')}
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
                      onClick={() => navigate(`/companies/${company.id}`)}
                      className="px-3 py-2 text-xs rounded-xl border border-slate-700 text-slate-400 hover:text-slate-50 hover:border-slate-600 transition-colors"
                    >
                      {t('crm.projects.detail.fields.open')}
                    </button>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Стоимость, дата, статус, категория, срочность */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
              <select
                value={projectPriority}
                onChange={(e) =>
                  setProject((prev) => ({
                    ...prev,
                    customFields: {
                      ...(prev.customFields ?? {}),
                      priority: e.target.value as 'Обычный' | 'Высокий' | 'Низкий',
                    },
                  }))
                }
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              >
                <option value="Низкий">{t('crm.projects.detail.priority.lowUrgency')}</option>
                <option value="Обычный">{t('crm.projects.detail.priority.normalUrgency')}</option>
                <option value="Высокий">{t('crm.projects.detail.priority.highUrgency')}</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.projects.detail.metrics.title')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <div className="text-[10px] text-slate-500">
                      {t('crm.projects.detail.metrics.budget')}
                    </div>
                    <div className="text-sm font-semibold text-slate-100">
                      {new Intl.NumberFormat(locale).format(Number(project.amount) || 0)} {project.currency || 'EUR'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <div className="text-[10px] text-slate-500">
                      {t('crm.projects.detail.metrics.taskProgress')}
                    </div>
                    <div className="text-sm font-semibold text-slate-100">
                      {tasksDoneCount}/{tasks.length} ({tasksCompletionPercent}%)
                    </div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-300">
                  <span>{t('crm.projects.detail.metrics.urgency')}</span>
                  <span
                    className={
                      projectPriority === 'Высокий'
                        ? 'text-rose-400'
                        : projectPriority === 'Низкий'
                          ? 'text-emerald-400'
                          : 'text-sky-400'
                    }
                  >
                    {projectPriority}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all"
                    style={{ width: `${tasksCompletionPercent}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-slate-400">
                  {t('crm.projects.detail.notes.title')}
                </div>
                <textarea
                  value={projectNotes}
                  onChange={(e) =>
                    setProject((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        projectNotes: e.target.value,
                      },
                    }))
                  }
                  rows={5}
                  placeholder={t('crm.projects.detail.notes.placeholder')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft resize-none"
                />
              </div>
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
                <div className="text-xs text-slate-400">
                  {t('crm.projects.detail.customFields.title')}
                </div>
                <button
                  type="button"
                  onClick={() => setCustomFieldsOpen(true)}
                  className="text-[11px] text-lumiva-accent hover:text-lumiva-accent-soft"
                >
                  {t('crm.projects.detail.customFields.configure')}
                </button>
              </div>
              {customFieldsError && (
                <div className="text-[11px] text-red-400">
                  {customFieldsError}
                </div>
              )}
              {customFieldsLoading && (
                <div className="text-[11px] text-slate-500">
                  {t('crm.projects.detail.customFields.loading')}
                </div>
              )}
              {!customFieldsLoading && activeCustomFields.length === 0 && (
                <div className="text-[11px] text-slate-500 italic">
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

        {/* Вкладка Задачи — список в духе Notion */}
        {tab === 'tasks' && (
          <div className="rounded-3xl border border-slate-700/50 bg-slate-900/50 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  {t('crm.projects.detail.tasks.title')}
                </div>
                <div className="mt-1 text-[12px] text-slate-500">
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
                <input
                  type="date"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  disabled={!isProjectOwner}
                  className="rounded-lg border border-slate-300 bg-slate-200/90 px-3 py-2 text-[12px] text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-lumiva-accent/30 disabled:opacity-60"
                />
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
                  const taskMentions = extractMentions(task.title || '');
                  const hasMention =
                    taskMentions.length > 0 && isMentioned(taskMentions);
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
                                            checked={(task.assignees || []).includes(
                                              u.fullName,
                                            )}
                                            onChange={() =>
                                              toggleTaskAssignee(task.id, u.fullName)
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
                              <input
                                draggable={false}
                                type="date"
                                value={task.deadline || ''}
                                onChange={updateTaskDeadline(task.id)}
                                className={taskCtl}
                              />
                            ) : (
                              <span className="text-[11px] text-slate-600">
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
                                  className="h-3.5 w-3.5 rounded border-slate-400 text-lumiva-accent"
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
                                {c.done && (
                                  <span className="shrink-0 text-[10px] text-slate-500">
                                    {c.doneBy} · {c.doneAt}
                                  </span>
                                )}
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
            {!!activities.length && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="text-[10px] text-slate-500">
                    {t('crm.projects.detail.history.summary.events')}
                  </div>
                  <div className="text-sm font-semibold text-slate-100">{activities.length}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="text-[10px] text-slate-500">
                    {t('crm.projects.detail.history.summary.amountChanges')}
                  </div>
                  <div className="text-sm font-semibold text-slate-100">{amountHistory.length}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="text-[10px] text-slate-500">
                    {t('crm.projects.detail.history.summary.lastUpdate')}
                  </div>
                  <div className="text-sm font-semibold text-slate-100">
                    {new Date(activities[0]?.createdAt).toLocaleString(locale)}
                  </div>
                </div>
              </div>
            )}
            {!!amountHistory.length && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 space-y-1.5">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.projects.detail.history.amountTitle')}
                </div>
                {amountHistory.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="text-[11px] text-slate-300">
                    {new Date(entry.at).toLocaleString(locale)} · {entry.actor}: {' '}
                    <span className="text-slate-400">{formatHistoryValue(entry.from)}</span> →{' '}
                    <span className="text-slate-100">{formatHistoryValue(entry.to)}</span>
                  </div>
                ))}
              </div>
            )}
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
                            <span>{formatHistoryValue(change.from)}</span> →{' '}
                            <span>{formatHistoryValue(change.to)}</span>
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
            title={t('crm.projects.detail.customFields.managerTitle')}
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
