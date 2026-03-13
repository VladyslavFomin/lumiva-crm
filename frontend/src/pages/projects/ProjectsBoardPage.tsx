import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import type { Project, ProjectStatus } from './projectTypes';
import {
  fetchProject,
  fetchProjects,
  changeProjectStatus,
} from '../../api/projects';
import { useTranslation } from 'react-i18next';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const ProjectsBoardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    projects.forEach((p) => {
      Object.keys(p.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [projects]);

  const navigate = useNavigate();
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

  const goTable = () => navigate('/app/projects');
  const createProject = () => navigate('/app/projects/new');
  const openProject = (id: string) => navigate(`/app/projects/${id}`);

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
              ? 'Да'
              : 'Нет'
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

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.projects.board.title')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.board.subtitle')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] overflow-hidden">
              <button
                type="button"
                className="px-3 py-1.5 bg-slate-800 text-slate-50"
              >
                {t('crm.projects.views.kanban')}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-800/80"
                onClick={goTable}
              >
                {t('crm.projects.views.table')}
              </button>
            </div>

            <button
              onClick={() => setCustomFieldsOpen(true)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80"
            >
              {t('crm.projects.list.columns.label')}
            </button>
            <button
              onClick={createProject}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
            >
              + {t('crm.projects.actions.newProject')}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-2xl px-3 py-2">
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
                  className="flex-1 min-w-[260px] max-w-xs bg-slate-950/80 border border-slate-800/80 rounded-3xl p-3 flex flex-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropTo(col.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-300 font-medium">
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
                      return (
                      <div
                        key={project.id}
                        draggable
                        onDragStart={() => handleDragStart(project.id)}
                        onClick={() => openProject(project.id)}
                        className={
                          'cursor-move rounded-2xl bg-slate-900/90 border border-slate-800/80 px-3 py-2 text-xs text-slate-100 hover:border-lumiva-accent-soft hover:bg-slate-900 transition-colors ' +
                          (changing === project.id ? 'opacity-60' : '')
                        }
                      >
                        <div className="flex items-start justify-between mb-1 gap-2">
                          <div className="font-medium truncate">
                            {project.name}
                          </div>
                          <div className="text-[10px] text-slate-500 whitespace-nowrap">
                            #{project.id.slice(0, 8)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-slate-400">
                            {formatAmount(project.amount, project.currency)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {project.createdAt}
                          </span>
                        </div>
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

                        <div className="flex flex-wrap gap-1 mt-1">
                          {project.category && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300">
                              {project.category}
                            </span>
                          )}
                          {project.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] px-1.5 py-0.5 rounded-full bg-lumiva-accent-soft/10 text-lumiva-accent"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
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
            title="Кастомные поля проектов"
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
