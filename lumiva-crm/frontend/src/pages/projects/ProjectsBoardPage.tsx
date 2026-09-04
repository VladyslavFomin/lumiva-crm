import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { useKanbanSensors } from '../../components/kanban/useKanbanSensors';
import { kanbanCollisionDetection } from '../../components/kanban/kanbanCollisionDetection';
import { useHorizontalWheelScroll } from '../../components/kanban/useHorizontalWheelScroll';
import './ProjectsListPage.css';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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
import type { ProjectsViewSettings } from './projectsViewSettings';
import type { ProjectTable } from '../../api/projectTables';
import { useProjectStatuses } from './useProjectStatuses';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

const DraggableProjectCard: React.FC<{
  id: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ id, className, onClick, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  // The floating DragOverlay (rendered separately, see ProjectsBoardPage) provides the visual
  // feedback while dragging — the source card just steps out of the way. Transforming the
  // source in place (the previous approach) is the wrong dnd-kit pattern for a card that moves
  // between different droppable containers: its DOM parent changes on drop (unmount from the
  // old column, mount in the new one), and the in-place transform resetting to identity at that
  // exact moment could visually read as "snapping back" to the old column for a frame even
  // though the underlying status change had already succeeded.
  const style: React.CSSProperties = { opacity: isDragging ? 0.35 : undefined };
  return (
    <div ref={setNodeRef} style={style} className={className} onClick={onClick} {...listeners} {...attributes}>
      {children}
    </div>
  );
};

const DroppableProjectColumn: React.FC<{ id: string; className?: string; children: React.ReactNode }> = ({ id, className, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className || ''}${isOver ? ' over' : ''}`}>
      {children}
    </div>
  );
};

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
  const [resolvedTables, setResolvedTables] = useState<ProjectTable[]>([]);

  const navigate = useNavigate();
  const tableIdParam = searchParams.get('table');
  const defaultTable = useMemo(
    () => resolvedTables.find((tbl) => tbl.slug === 'main') || null,
    [resolvedTables],
  );
  const activeTableId = tableIdParam || defaultTable?.id || '';

  // Данные каждой таблицы уже изолированы на бэкенде (?tableId=), клиентской фильтрации не нужно.
  const visibleProjects = projects;

  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    visibleProjects.forEach((p) => {
      Object.keys(p.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [visibleProjects]);
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
  const { statuses: statusDefs, colorFor: statusColorFor, reload: reloadStatuses } = useProjectStatuses();
  const statuses = useMemo(
    (): { id: ProjectStatus; title: string }[] =>
      statusDefs.map((s) => ({ id: s.value, title: statusLabels[s.value] ?? s.value })),
    [statusDefs, statusLabels],
  );
  const formatAmount = (amount: number, currency?: string) => {
    const formatted = new Intl.NumberFormat(locale).format(amount);
    if (!currency) return formatted;
    return t('crm.projects.common.amountWithCurrency', {
      amount: formatted,
      currency,
    });
  };

  const createProject = () => {
    const q = activeTableId ? `?table=${encodeURIComponent(activeTableId)}` : '';
    navigate(`/projects/new${q}`);
  };
  const openProject = (id: string) => navigate(`/projects/${id}`);
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
    navigate(`/projects/board?table=${tableId}`);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchProjects({ tableId: tableIdParam ?? undefined })
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
  }, [tableIdParam]);

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

  const formatCustomFieldPreviewValue = (field: CustomField, raw: unknown): string | null => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (field.type === 'boolean') {
      return raw === true || raw === 'true'
        ? t('crm.projects.board.boolean.yes')
        : t('crm.projects.board.boolean.no');
    }
    if (field.type === 'select') {
      const opt = field.options?.find((o) => o.value === String(raw));
      return opt?.label ?? String(raw);
    }
    if (field.type === 'multiselect') {
      const arr = Array.isArray(raw) ? raw : [raw];
      return arr
        .map((v) => field.options?.find((o) => o.value === String(v))?.label ?? String(v))
        .join(', ');
    }
    if (field.type === 'daterange' && typeof raw === 'object') {
      const rv = raw as { start?: string; end?: string | null };
      const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale);
      if (rv.start && rv.end) return `${fmt(rv.start)} – ${fmt(rv.end)}`;
      if (rv.start) return `${t('crm.projects.list.datePicker.from', 'с')} ${fmt(rv.start)}`;
      return null;
    }
    if (field.type === 'date') {
      return new Date(`${raw}T00:00:00`).toLocaleDateString(locale);
    }
    if (field.type === 'datetime') {
      return new Date(String(raw)).toLocaleString(locale);
    }
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'object') return null;
    return String(raw);
  };

  const renderCustomPreview = (project: Project) => {
    if (!activeCustomFields.length) return null;
    const textFields = activeCustomFields.filter((field) => field.type !== 'url');
    const urlFields = activeCustomFields.filter((field) => field.type === 'url');

    const rows = textFields
      .map((field) => {
        const display = formatCustomFieldPreviewValue(field, project.customFields?.[field.key]);
        if (display === null) return null;
        return `${field.label}: ${display}`;
      })
      .filter(Boolean)
      .slice(0, 2);

    const links = urlFields
      .map((field) => {
        const raw = project.customFields?.[field.key];
        return raw ? { label: field.label, url: String(raw) } : null;
      })
      .filter((x): x is { label: string; url: string } => x !== null)
      .slice(0, 2);

    if (!rows.length && !links.length) return null;
    return (
      <div className="kb-chips">
        {rows.map((row, idx) => (
          <span key={`t-${idx}`} className="kb-chip">
            {row}
          </span>
        ))}
        {links.map((link, idx) => (
          <a
            key={`l-${idx}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="kb-chip kb-chip-link"
            title={link.url}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 3h7v7" />
              <path d="M10 14L21 3" />
              <path d="M21 14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h6" />
            </svg>
            {link.label}
          </a>
        ))}
      </div>
    );
  };

  const projectsByStatus = (status: ProjectStatus) =>
    visibleProjects.filter((p) => p.status === status);
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

  const suppressCardClickRef = useRef(false);
  const kanbanSensors = useKanbanSensors();
  const { ref: boardScrollRef } = useHorizontalWheelScroll<HTMLDivElement>();
  const activeDragProject = useMemo(() => projects.find((p) => p.id === dragProjectId) ?? null, [projects, dragProjectId]);

  const handleDragStart = (id: string) => {
    setDragProjectId(id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setDragProjectId(null);
    if (delta.x !== 0 || delta.y !== 0) suppressCardClickRef.current = true;
    if (!over) return;
    handleDropTo(String(active.id), over.id as ProjectStatus);
  };

  const handleDropTo = async (id: string, status: ProjectStatus) => {
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
      fetchProjects({ tableId: tableIdParam ?? undefined })
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
      // Quick-edit only ever touches amount/owner/priority — never send its (possibly stale,
      // captured-at-render) `status` snapshot along, or it can silently undo a status change
      // made via drag on the same card moments earlier (out-of-order response race).
      const updated = await updateProject(next, { excludeStatus: true });
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
      <PageHelpButton topic="projects" />
      <div
        className="lv-pt lv-kb w-full pb-8 min-w-0 space-y-5"
        style={{ marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24, width: 'calc(100% + 48px)' }}
      >
        <div className="lv-pt-head">
          <div>
            <h1>{t('crm.projects.board.title')}</h1>
            <div className="sub">{t('crm.projects.board.subtitle')}</div>
          </div>
          <div className="lv-pt-head-actions">
            <button type="button" className="lv-tb-btn" onClick={() => setCustomFieldsOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M1 4h14M1 8h14M1 12h14" />
              </svg>
              {t('crm.projects.list.columns.label')}
            </button>
            <button
              type="button"
              onClick={createProject}
              className="lv-tb-btn"
              style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('crm.projects.actions.newProject')}
            </button>
          </div>
        </div>

        <ProjectsViewsBar
          currentType="kanban"
          activeTableId={activeTableId}
          onOpenType={openType}
          onTableChange={changeTable}
          onSettingsChange={setActiveViewSettings}
          onTablesChange={setResolvedTables}
          projectCount={visibleProjects.length}
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
          <DndContext sensors={kanbanSensors} collisionDetection={kanbanCollisionDetection} onDragStart={(e) => handleDragStart(String(e.active.id))} onDragEnd={handleDragEnd}>
          <div className="kb-board" ref={boardScrollRef}>
            {statuses.map((col) => {
              const columnProjects = projectsByStatus(col.id);
              const columnAccent = statusColorFor(col.id);
              return (
                <DroppableProjectColumn key={col.id} id={col.id} className="kb-col">
                  <div className="kb-col-head">
                    <div className="kb-col-titlerow">
                      <span className="kb-dot" style={{ background: columnAccent }} />
                      <span className="kb-col-title">{col.title}</span>
                      <span className="kb-count">{columnProjects.length}</span>
                    </div>
                  </div>

                  <div className="kb-list">
                    {columnProjects.map((project) => {
                      const percent = progressValue(project);
                      const color = progressColor(percent);
                      const priority = projectPriority(project);
                      return (
                      <DraggableProjectCard
                        key={project.id}
                        id={project.id}
                        onClick={() => {
                          if (suppressCardClickRef.current) { suppressCardClickRef.current = false; return; }
                          openProject(project.id);
                        }}
                        className={`group kb-card${dragProjectId === project.id ? ' dragging' : ''}`}
                      >
                        <div className="kb-card-top">
                          <div className="flex min-w-0 items-center gap-1.5" style={{ flex: 1 }}>
                            <div className="kb-name truncate">
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
                          <span className="kb-id">
                            #{project.id.slice(0, 8)}
                          </span>
                        </div>

                        {(cardFields.includes('amount') || cardFields.includes('created')) && (
                          <div className="kb-val">
                            {cardFields.includes('amount') ? (
                              <span className="n" style={{ fontSize: 13 }}>{formatAmount(project.amount, project.currency)}</span>
                            ) : (
                              <span />
                            )}
                            {cardFields.includes('created') && (
                              <span className="age">{project.createdAt}</span>
                            )}
                          </div>
                        )}
                        {cardFields.includes('progress') && (
                          <div className="flex items-center gap-2" style={{ marginTop: 9 }}>
                            <div className="flex-1 h-1.5 rounded-full bg-surface-active overflow-hidden">
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
                          <div className="kb-chips">
                            {cardFields.includes('owner') && project.owner && (
                              <span className="kb-chip">
                                {project.owner}
                              </span>
                            )}
                            {cardFields.includes('priority') && (
                              <span className="kb-chip">
                                {priority}
                              </span>
                            )}
                            {cardFields.includes('deadline') && nearestDeadline(project) && (
                              <span className="kb-chip">
                                {nearestDeadline(project)}
                              </span>
                            )}
                            {cardFields.includes('tags') && project.category && (
                              <span className="kb-chip">
                                {project.category}
                              </span>
                            )}
                            {cardFields.includes('tags') &&
                              project.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="kb-chip"
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
                      </DraggableProjectCard>
                    );
                    })}

                    {columnProjects.length === 0 && (
                      <div className="kb-empty">
                        {t('crm.projects.board.empty')}
                      </div>
                    )}
                  </div>
                </DroppableProjectColumn>
              );
            })}
          </div>
          <DragOverlay>
            {/* DragOverlay portals to document.body, outside the .lv-kb scope its CSS classes rely on — re-establish it here (a real DOM ancestor, not just a class on the same node). */}
            {activeDragProject ? (
              <div className="lv-kb">
                <div className="kb-card" style={{ cursor: 'grabbing', width: 268, boxShadow: '0 12px 28px rgba(16,24,40,.18)' }}>
                  <div className="kb-card-top">
                    <div className="kb-name truncate">{activeDragProject.name}</div>
                  </div>
                  {activeDragProject.amount > 0 && (
                    <div className="kb-val">
                      <span className="n">{new Intl.NumberFormat(locale).format(activeDragProject.amount)}</span>
                      {activeDragProject.currency && <span className="c">{activeDragProject.currency}</span>}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </DragOverlay>
          </DndContext>
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
