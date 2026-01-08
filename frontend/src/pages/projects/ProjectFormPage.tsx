// src/pages/projects/ProjectFormPage.tsx

import React, { useEffect, useMemo, useState } from 'react';
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
} from '../../api/projects';
import { fetchLeadsList, type Lead } from '../../api/leads';
import { fetchStaff, type StaffUser } from '../../api/staff';

type TabId = 'props' | 'tasks' | 'comments';

// фиксированный набор статусов проекта
const PROJECT_STATUSES: ProjectStatus[] = [
  'Новый',
  'В работе',
  'На проверке',
  'Заморожен',
  'Закрыт',
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

  // ---------------- Задачи и комментарии ----------------
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState('');

  // Поля для "Новой задачи" в верхней строке
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState('');
  const [newTaskStatus, setNewTaskStatus] =
    useState<ProjectTask['status']>('К выполнению');
  const [newTaskPriority, setNewTaskPriority] =
    useState<ProjectTask['priority']>('Обычный');
  const [newTaskDeadline, setNewTaskDeadline] = useState<string>('');

  const statusLabels = useMemo<Record<ProjectStatus, string>>(
    () => ({
      Новый: t('crm.projects.statuses.new'),
      'В работе': t('crm.projects.statuses.inProgress'),
      'На проверке': t('crm.projects.statuses.review'),
      Заморожен: t('crm.projects.statuses.paused'),
      Закрыт: t('crm.projects.statuses.closed'),
    }),
    [t],
  );
  const taskStatusLabels = useMemo<Record<ProjectTask['status'], string>>(
    () => ({
      'К выполнению': t('crm.projects.detail.tasks.status.todo'),
      'В работе': t('crm.projects.detail.tasks.status.inProgress'),
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

  // ---------------- Загрузка проекта ----------------
  useEffect(() => {
    // если проект не загружен или ещё нет списка сотрудников — выходим
    if (!project || !project.id) return;
    if (!project.owner && project.ownerUserId) return; // уже всё ок
    if (!project.owner || project.ownerUserId) return; // либо нет имени, либо id уже есть
    if (!staff.length) return;

    const match = staff.find(
      (u) => u.fullName && u.fullName.trim() === project.owner,
    );

    if (match) {
      setProject((prev) => ({
        ...prev,
        ownerUserId: match.id,
      }));
    }
  }, [project.id, project.owner, project.ownerUserId, staff]);
  
  useEffect(() => {
    let alive = true;

    if (isNew) {
      const empty = createEmptyProject();
      setProject(empty);
      setTasks(empty.tasks || []);
      setComments(empty.comments || []);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);

      fetchProject(id as string)
        .then((p) => {
          if (!alive) return;
          setProject(p);
          setTasks(p.tasks || []);
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

    // параллельно — список лидов
    fetchLeadsList()
      .then((items) => {
        if (!alive) return;
        setAllLeads(items);
      })
      .catch((e) => {
        if (!alive) return;
        console.error('Ошибка загрузки лидов для проектов', e);
      });

    // и список сотрудников для "Ответственный"
    fetchStaff()
      .then((users) => {
        if (!alive) return;
        setStaff(users);
      })
      .catch((e) => {
        if (!alive) return;
        console.error('Ошибка загрузки сотрудников для проектов', e);
      });

    return () => {
      alive = false;
    };
  }, [id, isNew]);

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
        saved = await updateProject(payload);
      }
      setProject(saved);
      setTasks(saved.tasks || []);
      setComments(saved.comments || []);
      navigate('/app/projects');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.detail.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

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

  // выбор ответственного из справочника сотрудников
  const handleOwnerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value || null;
    const user = staff.find((u) => u.id === userId);

    setProject((prev) => ({
      ...prev,
      ownerUserId: userId,
      owner: user ? user.fullName : null,
    }));
  };

  // ---------------- Задачи ----------------

  const addTask = () => {
    const title = newTaskTitle.trim();
    const assigneesArr = newTaskAssignees
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const newTask: ProjectTask = {
      id: `t${Date.now()}`,
      title,
      assignees: assigneesArr,
      status: newTaskStatus,
      priority: newTaskPriority,
      deadline: newTaskDeadline || null,
      checklist: [],
    };

    setTasks((prev) => [...prev, newTask]);

    setNewTaskTitle('');
    setNewTaskAssignees('');
    setNewTaskStatus('К выполнению');
    setNewTaskPriority('Обычный');
    setNewTaskDeadline('');
  };

  const updateTask =
    (taskId: string, field: keyof ProjectTask) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
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

  const updateTaskDeadline =
    (taskId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value || null;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, deadline: value } : t)),
      );
    };

  const removeTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // чек-лист в задаче
  const addChecklistItem = (taskId: string) => {
    const newItem: ProjectTaskChecklistItem = {
      id: `c${Date.now()}`,
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
    const c: ProjectComment = {
      id: `cm${Date.now()}`,
      author: t('crm.projects.detail.fallbacks.user'),
      createdAt: new Date().toLocaleString(locale),
      text: newComment.trim(),
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
                value={project.ownerUserId || ''}
                onChange={handleOwnerSelect}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              >
                <option value="">
                  {t('crm.projects.detail.fields.ownerEmpty')}
                </option>
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
            <div className="flex flex-wrap gap-3 items-center">
              <input
                placeholder={t('crm.projects.detail.tasks.newTitle')}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none"
              />
              <input
                placeholder={t('crm.projects.detail.tasks.newAssignees')}
                value={newTaskAssignees}
                onChange={(e) => setNewTaskAssignees(e.target.value)}
                className="min-w-[220px] px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none"
              />
              <select
                value={newTaskStatus}
                onChange={(e) =>
                  setNewTaskStatus(e.target.value as ProjectTask['status'])
                }
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm"
              >
                <option value="К выполнению">
                  {taskStatusLabels['К выполнению']}
                </option>
                <option value="В работе">
                  {taskStatusLabels['В работе']}
                </option>
                <option value="Готово">{taskStatusLabels['Готово']}</option>
              </select>
              <select
                value={newTaskPriority}
                onChange={(e) =>
                  setNewTaskPriority(
                    e.target.value as ProjectTask['priority'],
                  )
                }
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm"
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
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm"
              />
              <button
                type="button"
                onClick={addTask}
                className="px-3 py-2 text-xs rounded-xl !bg-slate-900 !text-white font-semibold hover:!bg-slate-800"
              >
                {t('crm.projects.detail.tasks.add')}
              </button>
            </div>

            {/* Список задач */}
            <div className="mt-2 border-t border-slate-800/80 pt-3">
              <div className="grid grid-cols-12 text-[11px] text-slate-500 mb-2 px-1">
                <div className="col-span-4">
                  {t('crm.projects.detail.tasks.headers.task')}
                </div>
                <div className="col-span-2">
                  {t('crm.projects.detail.tasks.headers.assignees')}
                </div>
                <div className="col-span-2">
                  {t('crm.projects.detail.tasks.headers.status')}
                </div>
                <div className="col-span-2">
                  {t('crm.projects.detail.tasks.headers.priority')}
                </div>
                <div className="col-span-1">
                  {t('crm.projects.detail.tasks.headers.deadline')}
                </div>
                <div className="col-span-1 text-right">
                  {t('crm.projects.detail.tasks.headers.checklist')}
                </div>
              </div>

              <div className="space-y-2">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-12 gap-2 items-start bg-slate-950/80 rounded-2xl px-2 py-2"
                  >
                    <input
                      value={t.title}
                      onChange={updateTask(t.id, 'title')}
                      className="col-span-4 px-2 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs outline-none"
                    />
                    <input
                      value={t.assignees.join(', ')}
                      onChange={updateTask(t.id, 'assignees')}
                      className="col-span-2 px-2 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs outline-none"
                    />
                    <select
                      value={t.status}
                      onChange={updateTask(t.id, 'status')}
                      className="col-span-2 px-2 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs outline-none"
                    >
                      <option value="К выполнению">
                        {taskStatusLabels['К выполнению']}
                      </option>
                      <option value="В работе">
                        {taskStatusLabels['В работе']}
                      </option>
                      <option value="Готово">
                        {taskStatusLabels['Готово']}
                      </option>
                    </select>
                    <select
                      value={t.priority}
                      onChange={updateTask(t.id, 'priority')}
                      className="col-span-2 px-2 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs outline-none"
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
                    <input
                      type="date"
                      value={t.deadline || ''}
                      onChange={updateTaskDeadline(t.id)}
                      className="col-span-1 px-2 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs outline-none"
                    />

                    <div className="col-span-1 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="text-[11px] text-sky-400 hover:text-sky-300"
                        onClick={() => addChecklistItem(t.id)}
                      >
                        {t('crm.projects.detail.tasks.checklist')}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-rose-400 hover:text-rose-300"
                        onClick={() => removeTask(t.id)}
                      >
                        {t('crm.projects.detail.actions.remove')}
                      </button>
                    </div>

                    {t.checklist.length > 0 && (
                      <div className="col-span-12 mt-1 pl-2 space-y-1">
                        {t.checklist.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 text-[11px]"
                          >
                            <input
                              type="checkbox"
                              checked={c.done}
                              onChange={() => toggleChecklistDone(t.id, c.id)}
                              className="h-3 w-3"
                            />
                            <input
                              value={c.title}
                              onChange={updateChecklistTitle(t.id, c.id)}
                              className="flex-1 px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 outline-none"
                              placeholder={t('crm.projects.detail.tasks.subtask')}
                            />
                            {c.done && (
                              <span className="text-slate-500">
                                {c.doneBy} · {c.doneAt}
                              </span>
                            )}
                            <button
                              type="button"
                              className="text-rose-400"
                              onClick={() =>
                                removeChecklistItem(t.id, c.id)
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {tasks.length === 0 && (
                  <div className="text-[11px] text-slate-500 italic px-1 py-2">
                    {t('crm.projects.detail.tasks.empty')}
                  </div>
                )}
              </div>
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
                  <div className="text-[11px] text-slate-500 mb-1">
                    {c.createdAt} · {c.author}
                  </div>
                  <div className="whitespace-pre-wrap text-[13px]">
                    {c.text}
                  </div>
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
      </div>
    </MainLayout>
  );
};
