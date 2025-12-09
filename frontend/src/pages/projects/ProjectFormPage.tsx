// src/pages/projects/ProjectFormPage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';

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

export const ProjectFormPage: React.FC = () => {
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
          setError(e.message || 'Ошибка загрузки проекта');
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
    () => (isNew ? 'Новый проект' : `Проект #${project.id}`),
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
      setError(e.message || 'Ошибка сохранения проекта');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) {
      navigate('/app/projects');
      return;
    }
    if (!window.confirm('Удалить проект?')) return;

    setSaving(true);
    setError(null);
    try {
      await deleteProject(project.id);
      navigate('/app/projects');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Ошибка при удалении проекта');
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
                      doneBy: !c.done ? 'Vlad' : undefined,
                      doneAt: !c.done
                        ? new Date().toLocaleDateString('ru-RU')
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
      author: 'Vlad Fomin',
      createdAt: new Date().toLocaleString('ru-RU'),
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
              {project.name || 'Без названия'}
            </h1>
            {loading && (
              <div className="text-[11px] text-slate-500 mt-1">
                Загрузка данных проекта…
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
                Удалить проект
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs rounded-xl bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 disabled:opacity-60"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
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
            Свойства
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
            Задачи
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
            Комментарии
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
                placeholder="Название проекта"
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              />

              <select
                value={project.ownerUserId || ''}
                onChange={handleOwnerSelect}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              >
                <option value="">Ответственный не назначен</option>
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
                placeholder="Описание проекта"
                rows={4}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft resize-none"
              />

              <div className="space-y-2">
                <select
                  value={project.leadId || ''}
                  onChange={handleLeadChange}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
                >
                  <option value="">Без лида</option>
                  {allLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {(l.name || 'Без имени') +
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
                  placeholder="Имя лида (можно подправить вручную)"
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
                  placeholder="Email лида"
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
                placeholder="Сумма"
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              />
              <input
                value={project.createdAt}
                onChange={handleChange('createdAt')}
                placeholder="Создан: 24.09.2025, 03:00:00"
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              />
              <select
                value={project.status}
                onChange={handleStatusChange}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              >
                {PROJECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <select
                value={project.category || ''}
                onChange={handleCategoryChange}
                className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft"
              >
                <option value="">Категория</option>
                {PROJECT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Метки */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Метки</div>
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
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Файлы (ТЗ / смета / договор) */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400">
                Файлы (ТЗ, смета, договор и т.д.)
              </div>
              <input
                value={project.briefFileName || ''}
                onChange={(e) =>
                  setProject((prev) => ({
                    ...prev,
                    briefFileName: e.target.value || null,
                  }))
                }
                placeholder="Название файла / тип документа (например, ТЗ по сайту)"
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
                placeholder="Ссылка на файл (Google Drive / Dropbox / медиа WP)"
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
                placeholder="Новая задача: заголовок"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none"
              />
              <input
                placeholder="Исполнители (через запятую)…"
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
                <option value="К выполнению">К выполнению</option>
                <option value="В работе">В работе</option>
                <option value="Готово">Готово</option>
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
                <option value="Обычный">Обычный</option>
                <option value="Высокий">Высокий</option>
                <option value="Низкий">Низкий</option>
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
                className="px-3 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
              >
                Добавить
              </button>
            </div>

            {/* Список задач */}
            <div className="mt-2 border-t border-slate-800/80 pt-3">
              <div className="grid grid-cols-12 text-[11px] text-slate-500 mb-2 px-1">
                <div className="col-span-4">Задача</div>
                <div className="col-span-2">Исполнители</div>
                <div className="col-span-2">Статус</div>
                <div className="col-span-2">Приоритет</div>
                <div className="col-span-1">Дедлайн</div>
                <div className="col-span-1 text-right">Чек-лист</div>
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
                      <option value="К выполнению">К выполнению</option>
                      <option value="В работе">В работе</option>
                      <option value="Готово">Готово</option>
                    </select>
                    <select
                      value={t.priority}
                      onChange={updateTask(t.id, 'priority')}
                      className="col-span-2 px-2 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs outline-none"
                    >
                      <option value="Обычный">Обычный</option>
                      <option value="Высокий">Высокий</option>
                      <option value="Низкий">Низкий</option>
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
                        Чек-лист
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-rose-400 hover:text-rose-300"
                        onClick={() => removeTask(t.id)}
                      >
                        Удалить
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
                              placeholder="Подзадача…"
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
                    Задач пока нет
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
                  Комментариев пока нет
                </div>
              )}
            </div>

            <div className="border-t border-slate-800/80 pt-3 space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Новый комментарий… можно использовать @имя менеджера"
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none focus:border-lumiva-accent-soft resize-none"
              />
              <button
                type="button"
                onClick={addComment}
                className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
              >
                Добавить
              </button>
            </div>

            <div className="border-t border-slate-800/80 pt-3 space-y-2">
              <div className="text-xs text-slate-400">
                Черновик с @упоминаниями
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Черновик сообщения…"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-sm outline-none"
                />
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-300 hover:bg-slate-900/70"
                >
                  Отправить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};