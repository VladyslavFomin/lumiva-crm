// src/pages/companies/CompanyTasksBoardPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchCompanyTasks,
  createCompanyTask,
  updateCompanyTask,
  changeCompanyTaskStatus,
  deleteCompanyTask,
  type CompanyTask,
  type CompanyTaskStatus,
} from '../../api/companies';
import { fetchCompany, type Company } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useTranslation } from 'react-i18next';
import { getLocale } from '../../i18n/utils';

const STATUSES: CompanyTaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'cancelled'];

const STATUS_COLORS: Record<CompanyTaskStatus, string> = {
  todo: '#64748b',
  in_progress: '#8b5cf6',
  review: '#facc15',
  done: '#22c55e',
  cancelled: '#ef4444',
};

export const CompanyTasksBoardPage: React.FC = () => {
  const { t } = useTranslation();
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const locale = getLocale();
  const [company, setCompany] = useState<Company | null>(null);
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [allTasks, setAllTasks] = useState<CompanyTask[]>([]); // Все задачи без фильтров
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  
  // Фильтры
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterAssignedTo, setFilterAssignedTo] = useState<string | null>(null);
  const [filterDueDate, setFilterDueDate] = useState<'overdue' | 'today' | 'week' | 'all' | null>(null);
  
  // Редактирование
  const [editingTask, setEditingTask] = useState<CompanyTask | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPriority, setEditPriority] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editAssignedTo, setEditAssignedTo] = useState<string>('');
  const [editAssignedUserId, setEditAssignedUserId] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  
  // Сотрудники для выбора ответственного
  const [staff, setStaff] = useState<StaffUser[]>([]);

  useEffect(() => {
    if (!companyId) {
      setError(t('crm.companies.details.page.errors.idMissing'));
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchCompany(companyId),
      fetchCompanyTasks(companyId),
      fetchStaff(),
    ])
      .then(([companyData, tasksData, staffData]) => {
        if (!alive) return;
        setCompany(companyData);
        setAllTasks(tasksData);
        setTasks(tasksData);
        setStaff(staffData);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.companies.tasks.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId, t]);

  // Применение фильтров
  useEffect(() => {
    let filtered = [...allTasks];

    // Поиск
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    // Фильтр по приоритету
    if (filterPriority) {
      filtered = filtered.filter((t) => t.priority === filterPriority);
    }

    // Фильтр по ответственному
    if (filterAssignedTo) {
      filtered = filtered.filter((t) => t.assignedUserId === filterAssignedTo);
    }

    // Фильтр по сроку
    if (filterDueDate && filterDueDate !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekLater = new Date(today);
      weekLater.setDate(weekLater.getDate() + 7);

      filtered = filtered.filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        switch (filterDueDate) {
          case 'overdue':
            return due < today && t.status !== 'done';
          case 'today':
            return due >= today && due < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          case 'week':
            return due >= today && due <= weekLater;
          default:
            return true;
        }
      });
    }

    setTasks(filtered);
  }, [allTasks, searchQuery, filterPriority, filterAssignedTo, filterDueDate]);

  const tasksByStatus = (status: CompanyTaskStatus) =>
    tasks.filter((task) => task.status === status);

  const handleDragStart = (taskId: string) => {
    setDragTaskId(taskId);
  };

  const handleDropTo = async (status: CompanyTaskStatus) => {
    if (!dragTaskId) return;

    const taskId = dragTaskId;
    setDragTaskId(null);

    // Оптимистичное обновление
    setAllTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
    );

    try {
      await changeCompanyTaskStatus(taskId, status);
      // Перезагружаем для синхронизации
      if (companyId) {
        fetchCompanyTasks(companyId)
          .then((data) => setAllTasks(data))
          .catch((err) => console.error(err));
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.companies.tasks.errors.statusChangeFailed'));
      // Перезагружаем задачи
      if (companyId) {
        fetchCompanyTasks(companyId)
          .then((data) => setAllTasks(data))
          .catch((err) => console.error(err));
      }
    }
  };

  const handleCreateTask = async () => {
    if (!companyId || !newTaskTitle.trim()) return;

    setCreating(true);
    try {
      const newTask = await createCompanyTask({
        companyId,
        title: newTaskTitle.trim(),
        status: 'todo',
      });
      setAllTasks([...allTasks, newTask]);
      setNewTaskTitle('');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.companies.tasks.errors.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('crm.companies.tasks.deleteConfirm'))) return;

    try {
      await deleteCompanyTask(taskId);
      setAllTasks(allTasks.filter((t) => t.id !== taskId));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.companies.tasks.errors.deleteFailed'));
    }
  };

  const handleEditTask = (task: CompanyTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority || '');
    setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setEditAssignedTo(task.assignedTo || '');
    setEditAssignedUserId(task.assignedUserId || '');
  };

  const handleSaveTask = async () => {
    if (!editingTask) return;

    setSaving(true);
    try {
      const updated = await updateCompanyTask(editingTask.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        priority: editPriority || undefined,
        dueDate: editDueDate || undefined,
        assignedTo: editAssignedTo || undefined,
        assignedUserId: editAssignedUserId || undefined,
      });
      setAllTasks(allTasks.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTask(null);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.companies.tasks.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">{t('crm.common.loading')}</div>
      </MainLayout>
    );
  }

  if (error && !company) {
    return (
      <MainLayout>
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
          {error}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <button
              onClick={() => navigate('/companies')}
              className="text-[11px] text-slate-400 hover:text-slate-200 mb-1"
            >
              {t('crm.companies.analytics.backToList')}
            </button>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.companies.tasks.title')}: {company?.name || t('crm.companies.details.page.noCompany')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.companies.details.tasks.viewBoard')}
            </div>
          </div>
          <button
            onClick={() => companyId && navigate(`/companies/${companyId}/edit`)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-400 hover:text-slate-50 transition-colors"
          >
            {t('crm.companies.details.page.noCompany')}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Фильтры и поиск */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('crm.companies.tasks.filters.search')}
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterPriority || ''}
              onChange={(e) => setFilterPriority(e.target.value || null)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
            >
              <option value="">{t('crm.companies.tasks.filters.priority')}</option>
              <option value="low">{t('crm.companies.tasks.priorities.low')}</option>
              <option value="medium">{t('crm.companies.tasks.priorities.medium')}</option>
              <option value="high">{t('crm.companies.tasks.priorities.high')}</option>
              <option value="urgent">{t('crm.companies.tasks.priorities.urgent')}</option>
            </select>
            <select
              value={filterAssignedTo || ''}
              onChange={(e) => setFilterAssignedTo(e.target.value || null)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
            >
              <option value="">{t('crm.companies.tasks.filters.assignee')}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName || s.email}
                </option>
              ))}
            </select>
            <select
              value={filterDueDate || 'all'}
              onChange={(e) => setFilterDueDate(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
            >
              <option value="all">{t('crm.companies.tasks.filters.dueDate')}</option>
              <option value="overdue">{t('crm.companies.tasks.filters.overdue')}</option>
              <option value="today">{t('crm.companies.tasks.filters.today')}</option>
              <option value="week">{t('crm.companies.tasks.filters.thisWeek')}</option>
            </select>
            {(filterPriority || filterAssignedTo || filterDueDate || searchQuery) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterPriority(null);
                  setFilterAssignedTo(null);
                  setFilterDueDate(null);
                }}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-400 hover:text-slate-50 transition-colors"
              >
                {t('crm.companies.tasks.filters.reset')}
              </button>
            )}
          </div>
        </div>

        {/* Создание задачи */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTask();
                }
              }}
              placeholder={t('crm.companies.tasks.fields.title')}
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
            />
            <button
              onClick={handleCreateTask}
              disabled={creating || !newTaskTitle.trim()}
              className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? t('crm.companies.tasks.actions.creating') : `+ ${t('crm.companies.tasks.create')}`}
            </button>
          </div>
        </div>

        {/* Канбан доска */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          {STATUSES.map((status) => {
            const columnTasks = tasksByStatus(status);
            return (
              <div
                key={status}
                className="flex-1 min-w-[260px] max-w-xs bg-slate-950/80 border border-slate-800/80 rounded-3xl p-3 flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropTo(status)}
              >
                {/* Шапка колонки */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                    />
                    <div className="text-xs text-slate-300 font-medium">
                      {t(`crm.companies.tasks.statuses.${status}`)}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">
                    {columnTasks.length}
                  </div>
                </div>

                {/* Задачи */}
                <div className="flex-1 space-y-2 overflow-y-auto min-h-[200px]">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onClick={() => handleEditTask(task)}
                      className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 cursor-pointer hover:border-slate-700/80 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-xs font-medium text-slate-50 flex-1 line-clamp-2">
                          {task.title}
                        </h3>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTask(task);
                            }}
                            className="text-blue-400 hover:text-blue-300 text-[10px]"
                            title={t('crm.common.edit')}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => handleDeleteTask(task.id, e)}
                            className="text-red-400 hover:text-red-300 text-[10px]"
                            title={t('crm.companies.tasks.delete')}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {task.description && (
                        <div className="text-[10px] text-slate-400 mb-2 line-clamp-2">
                          {task.description}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        {task.dueDate && (() => {
                          const due = new Date(task.dueDate);
                          const now = new Date();
                          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          const isOverdue = due < today && task.status !== 'done';
                          const isToday = due >= today && due < new Date(today.getTime() + 24 * 60 * 60 * 1000);
                          return (
                            <div className={`text-[10px] ${isOverdue ? 'text-red-400 font-semibold' : isToday ? 'text-yellow-400' : 'text-slate-500'}`}>
                              📅 {due.toLocaleDateString(locale, {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                              {isOverdue && ' ⚠️'}
                            </div>
                          );
                        })()}
                        {task.assignedTo && (
                          <div className="text-[10px] text-slate-500">
                            👤 {task.assignedTo}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        {task.priority && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              task.priority === 'urgent'
                                ? 'bg-red-950/50 text-red-400'
                                : task.priority === 'high'
                                ? 'bg-orange-950/50 text-orange-400'
                                : task.priority === 'medium'
                                ? 'bg-yellow-950/50 text-yellow-400'
                                : 'bg-slate-800/50 text-slate-300'
                            }`}
                          >
                            {task.priority === 'urgent'
                              ? t('crm.companies.tasks.priorities.urgent')
                              : task.priority === 'high'
                              ? t('crm.companies.tasks.priorities.high')
                              : task.priority === 'medium'
                              ? t('crm.companies.tasks.priorities.medium')
                              : t('crm.companies.tasks.priorities.low')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Модальное окно редактирования задачи */}
      {editingTask && (
        <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs font-semibold text-slate-50">
                  {t('crm.companies.tasks.edit')}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {t('crm.companies.tasks.actions.editSubtitle')}
                </div>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-white text-xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5">
                  {t('crm.companies.tasks.fields.title')}
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5">
                  {t('crm.companies.tasks.fields.description')}
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1.5">
                    {t('crm.companies.tasks.fields.priority')}
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
                  >
                    <option value="">{t('crm.companies.bulk.noChange')}</option>
                    <option value="low">{t('crm.companies.tasks.priorities.low')}</option>
                    <option value="medium">{t('crm.companies.tasks.priorities.medium')}</option>
                    <option value="high">{t('crm.companies.tasks.priorities.high')}</option>
                    <option value="urgent">{t('crm.companies.tasks.priorities.urgent')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1.5">
                    {t('crm.companies.tasks.fields.dueDate')}
                  </label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5">
                  {t('crm.companies.tasks.fields.assignedTo')}
                </label>
                <select
                  value={editAssignedUserId}
                  onChange={(e) => {
                    setEditAssignedUserId(e.target.value);
                    const selected = staff.find((s) => s.id === e.target.value);
                    setEditAssignedTo(selected?.fullName || selected?.email || '');
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
                >
                  <option value="">{t('crm.companies.tasks.filters.anyAssignee')}</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || s.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-50 transition-colors"
              >
                {t('crm.common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveTask}
                disabled={saving || !editTitle.trim()}
                className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? t('crm.common.saving') : t('crm.common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

