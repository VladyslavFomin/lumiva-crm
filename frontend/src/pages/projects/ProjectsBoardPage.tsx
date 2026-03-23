import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import type { Project, ProjectStatus } from './projectTypes';
import {
  fetchProject,
  fetchProjects,
  changeProjectStatus,
  updateProject,
} from '../../api/projects';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useTranslation } from 'react-i18next';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { ProjectsViewsBar } from './ProjectsViewsBar';
import { type ProjectsViewSettings } from './projectsViewsStore';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const ProjectsBoardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    ownerUserIds: string[];
    amount: string;
    priority: 'Обычный' | 'Высокий' | 'Низкий';
  } | null>(null);
  const [activeViewSettings, setActiveViewSettings] = useState<ProjectsViewSettings>({
    kanbanCardFields: ['amount', 'created', 'progress', 'tags'],
  });
  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    projects.forEach((p) => {
      Object.keys(p.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [projects]);

  const navigate = useNavigate();
  const activeViewId = searchParams.get('view');
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
  const statuses = useMemo(
    (): { id: ProjectStatus; title: string }[] => [
      { id: 'Новый', title: statusLabels.Новый },
      { id: 'В работе', title: statusLabels['В работе'] },
      { id: 'На проверке', title: statusLabels['На проверке'] },
      { id: 'Заморожен', title: statusLabels.Заморожен },
      { id: 'Выиграно', title: statusLabels.Выиграно },
      { id: 'Проиграно', title: statusLabels.Проиграно },
    ],
    [statusLabels],
  );
  const formatAmount = (amount: number, currency?: string) => {
    const formatted = new Intl.NumberFormat(locale).format(amount);
    if (!currency) return formatted;
    return t('crm.projects.common.amountWithCurrency', {
      amount: formatted,
      currency,
    });
  };

  const createProject = () => navigate('/app/projects/new');
  const openProject = (id: string) => navigate(`/app/projects/${id}`);
  const openView = (type: 'table' | 'kanban' | 'calendar', viewId?: string) => {
    const basePath =
      type === 'table'
        ? '/app/projects'
        : type === 'kanban'
          ? '/app/projects/board'
          : '/app/projects/calendar';
    navigate(viewId ? `${basePath}?view=${viewId}` : basePath);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchProjects()
      .then(async (res) => {
        if (!alive) return;
        setProjects(res.items);
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
              return { ...p, tasks: full.tasks ?? p.tasks };
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
  }, []);

  useEffect(() => {
    let alive = true;
    fetchStaff()
      .then((items) => {
        if (!alive) return;
        setStaff(items);
      })
      .catch((e) => console.error('Ошибка загрузки сотрудников:', e));
    return () => {
      alive = false;
    };
  }, []);

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

  const activeCustomFields = customFields.filter((field) => field.isActive);

  const renderCustomPreview = (project: Project) => {
    if (!activeCustomFields.length) return null;
    const rows = activeCustomFields
      .map((field) => {
        const raw = project.customFields?.[field.key];
        if (raw === null || raw === undefined || raw === '') return null;
        const display = Array.isArray(raw)
          ? raw.join(', ')
          : typeof raw === 'boolean'
            ? raw
              ? t('crm.projects.board.boolean.yes')
              : t('crm.projects.board.boolean.no')
            : String(raw);
        return `${field.label}: ${display}`;
      })
      .filter(Boolean)
      .slice(0, 2);
    if (!rows.length) return null;
    return (
      <div className="mt-2 space-y-0.5">
        {rows.map((row, idx) => (
          <div key={idx} className="text-[10px] text-slate-500 truncate">
            {row}
          </div>
        ))}
      </div>
    );
  };

  const projectsByStatus = (status: ProjectStatus) =>
    projects.filter((p) => p.status === status);
  const isDoneStatus = (status?: string | null) => {
    if (!status) return false;
    const normalized = status.toString().trim().toLowerCase();
    return (
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
  const cardFields = activeViewSettings.kanbanCardFields || [
    'amount',
    'created',
    'progress',
    'tags',
  ];
  const nearestDeadline = (project: Project) => {
    const dates = (project.tasks || [])
      .map((task) => (task.deadline ? new Date(task.deadline) : null))
      .filter(Boolean) as Date[];
    if (!dates.length) return '';
    const min = dates.sort((a, b) => a.getTime() - b.getTime())[0];
    return min.toLocaleDateString(locale);
  };
  const projectPriority = (project: Project): 'Высокий' | 'Обычный' | 'Низкий' => {
    const value = String(project.customFields?.priority || '').trim().toLowerCase();
    if (value.includes('выс')) return 'Высокий';
    if (value.includes('низ')) return 'Низкий';
    return 'Обычный';
  };
  const priorityAccentColor = (priority: 'Высокий' | 'Обычный' | 'Низкий') => {
    if (priority === 'Высокий') return '#ef4444';
    if (priority === 'Низкий') return '#22c55e';
    return '#3b82f6';
  };

  const handleDragStart = (id: string) => {
    setDragProjectId(id);
  };

  const handleDropTo = async (status: ProjectStatus) => {
    if (!dragProjectId) return;

    const id = dragProjectId;
    setDragProjectId(null);

    // оптимистичное обновление
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p)),
    );
    setChanging(id);

    try {
      const updated = await changeProjectStatus(id, status);
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: updated.status } : p)),
      );
    } catch (e: any) {
      // если не удалось — откатить и показать ошибку
      console.error(e);
      setError(e.message || t('crm.projects.errors.statusUpdateFailed'));
      // перезагрузить с сервера
      fetchProjects()
        .then((res) => setProjects(res.items))
        .catch((err) => console.error(err));
    } finally {
      setChanging(null);
    }
  };

  const openQuickEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const ownerIds =
      project.ownerUserIds?.length
        ? project.ownerUserIds
        : project.ownerUserId
          ? [project.ownerUserId]
          : [];
    const priority =
      (project.customFields?.priority as 'Обычный' | 'Высокий' | 'Низкий' | undefined) || 'Обычный';
    setEditingProjectId(project.id);
    setEditDraft({
      ownerUserIds: ownerIds,
      amount: String(Number(project.amount || 0)),
      priority,
    });
  };

  const saveQuickEdit = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editDraft) return;
    const selectedUsers = staff.filter((u) => editDraft.ownerUserIds.includes(u.id));
    const ownerName = selectedUsers.length
      ? selectedUsers.map((u) => u.fullName || u.email).join(', ')
      : null;
    const next: Project = {
      ...project,
      amount: Number(editDraft.amount || 0),
      ownerUserId: editDraft.ownerUserIds[0] || null,
      ownerUserIds: editDraft.ownerUserIds,
      owner: ownerName,
      customFields: {
        ...(project.customFields || {}),
        priority: editDraft.priority,
      },
    };
    try {
      const updated = await updateProject(next);
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, ...updated } : p)));
      setEditingProjectId(null);
      setEditDraft(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('crm.projects.errors.statusUpdateFailed'));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {t('crm.projects.board.title')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.board.subtitle')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCustomFieldsOpen(true)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              {t('crm.projects.list.columns.label')}
            </button>
            <button
              onClick={createProject}
              className="px-3 py-1.5 text-xs rounded-xl bg-[#222222] text-white font-semibold hover:bg-black"
            >
              + {t('crm.projects.actions.newProject')}
            </button>
          </div>
        </div>

        <ProjectsViewsBar
          currentType="kanban"
          activeViewId={activeViewId}
          onOpenView={openView}
          onSettingsChange={setActiveViewSettings}
        />

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-3 py-2">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-[12px] text-slate-400">
            {t('crm.projects.loading')}
          </div>
        )}

        {!loading && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {statuses.map((col) => {
              const columnProjects = projectsByStatus(col.id);
              return (
                <div
                  key={col.id}
                  className="flex-1 min-w-[260px] max-w-xs bg-white border border-slate-200 rounded-3xl p-3 flex flex-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropTo(col.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-700 font-semibold">
                      {col.title}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {columnProjects.length}
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {columnProjects.map((project) => {
                      const percent = progressValue(project);
                      const color = progressColor(percent);
                      const priority = projectPriority(project);
                      const accentColor = priorityAccentColor(priority);
                      return (
                      <div
                        key={project.id}
                        draggable
                        onDragStart={() => handleDragStart(project.id)}
                        onClick={() => openProject(project.id)}
                        className={
                          'group relative cursor-move rounded-2xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors ' +
                          (changing === project.id ? 'opacity-60' : '')
                        }
                        style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
                      >
                        <div className="flex items-start justify-between mb-1 gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <div className="font-medium truncate">
                              {project.name}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => openQuickEdit(project, e)}
                              className="h-5 w-5 shrink-0 rounded-md border border-slate-200 bg-white text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-800 transition"
                              title={t('crm.projects.board.quickEdit.title')}
                            >
                              ✎
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-500 whitespace-nowrap">
                            #{project.id.slice(0, 8)}
                          </div>
                        </div>

                        {(cardFields.includes('amount') || cardFields.includes('created')) && (
                          <div className="flex items-center justify-between mb-1">
                            {cardFields.includes('amount') ? (
                              <span className="text-[11px] text-slate-600">
                                {formatAmount(project.amount, project.currency)}
                              </span>
                            ) : (
                              <span />
                            )}
                            {cardFields.includes('created') && (
                              <span className="text-[10px] text-slate-500">{project.createdAt}</span>
                            )}
                          </div>
                        )}
                        {cardFields.includes('progress') && (
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${percent}%`, backgroundColor: color }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold" style={{ color }}>
                              {percent}%
                            </span>
                          </div>
                        )}
                        {(cardFields.includes('tags') || cardFields.includes('priority') || cardFields.includes('owner') || cardFields.includes('deadline')) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cardFields.includes('owner') && project.owner && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {project.owner}
                              </span>
                            )}
                            {cardFields.includes('priority') && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {priority}
                              </span>
                            )}
                            {cardFields.includes('deadline') && nearestDeadline(project) && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {nearestDeadline(project)}
                              </span>
                            )}
                            {cardFields.includes('tags') && project.category && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {project.category}
                              </span>
                            )}
                            {cardFields.includes('tags') &&
                              project.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-lumiva-accent-soft/10 text-lumiva-accent"
                                >
                                  #{tag}
                                </span>
                              ))}
                          </div>
                        )}
                        {editingProjectId === project.id && editDraft && (
                          <div
                            className="mt-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="grid gap-2">
                              <div className="rounded-lg border border-slate-300 bg-white p-2">
                                <div className="mb-1 text-[10px] font-semibold text-slate-600">
                                  {t('crm.projects.board.quickEdit.owners', {
                                    count: editDraft.ownerUserIds.length,
                                  })}
                                </div>
                                <div className="max-h-28 overflow-y-auto space-y-1">
                                  {staff.map((u) => {
                                    const isSelected = editDraft.ownerUserIds.includes(u.id);
                                    return (
                                      <label
                                        key={u.id}
                                        className="flex items-center gap-2 text-[11px] text-slate-700"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) =>
                                            setEditDraft((prev) => {
                                              if (!prev) return prev;
                                              const nextIds = e.target.checked
                                                ? [...prev.ownerUserIds, u.id]
                                                : prev.ownerUserIds.filter((id) => id !== u.id);
                                              return { ...prev, ownerUserIds: nextIds };
                                            })
                                          }
                                        />
                                        <span className="truncate">{u.fullName || u.email}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                              <input
                                type="number"
                                value={editDraft.amount}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev ? { ...prev, amount: e.target.value } : prev,
                                  )
                                }
                                className="px-2 py-1 text-[11px] rounded-lg border border-slate-300 text-slate-700"
                                placeholder={t('crm.projects.board.quickEdit.amountPlaceholder')}
                              />
                              <select
                                value={editDraft.priority}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          priority: e.target.value as 'Обычный' | 'Высокий' | 'Низкий',
                                        }
                                      : prev,
                                  )
                                }
                                className="px-2 py-1 text-[11px] rounded-lg border border-slate-300 text-slate-700"
                              >
                                <option value="Низкий">
                                  {t('crm.projects.board.quickEdit.priority.low')}
                                </option>
                                <option value="Обычный">
                                  {t('crm.projects.board.quickEdit.priority.normal')}
                                </option>
                                <option value="Высокий">
                                  {t('crm.projects.board.quickEdit.priority.high')}
                                </option>
                              </select>
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProjectId(null);
                                  setEditDraft(null);
                                }}
                                className="px-2 py-1 text-[10px] rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                              >
                                {t('crm.common.cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => saveQuickEdit(project, e)}
                                className="px-2 py-1 text-[10px] rounded-lg bg-[#222222] text-white hover:bg-black"
                              >
                                {t('crm.common.save')}
                              </button>
                            </div>
                          </div>
                        )}
                        {renderCustomPreview(project)}
                      </div>
                    );
                    })}

                    {columnProjects.length === 0 && (
                      <div className="text-[11px] text-slate-500 italic px-1 py-2">
                        {t('crm.projects.board.empty')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {customFieldsOpen && (
          <CustomFieldsManager
            entityType="project"
            title={t('crm.projects.board.customFieldsTitle')}
            suggestedKeys={suggestedKeys}
            onClose={() => setCustomFieldsOpen(false)}
            onUpdated={(items) =>
              setCustomFields([...items].sort((a, b) => a.order - b.order))
            }
          />
        )}
      </div>
    </MainLayout>
  );
};
