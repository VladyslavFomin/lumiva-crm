import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import type { Project, ProjectStatus } from './projectTypes';
import {
  fetchProjects,
  changeProjectStatus,
} from '../../api/projects';

const STATUSES: { id: ProjectStatus; title: string }[] = [
  { id: 'Новый', title: 'Новый' },
  { id: 'В работе', title: 'В работе' },
  { id: 'На проверке', title: 'На проверке' },
  { id: 'Заморожен', title: 'Заморожен' },
  { id: 'Закрыт', title: 'Закрыт' },
];

export const ProjectsBoardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);

  const navigate = useNavigate();

  const goTable = () => navigate('/app/projects');
  const createProject = () => navigate('/app/projects/new');
  const openProject = (id: string) => navigate(`/app/projects/${id}`);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchProjects()
      .then((res) => {
        if (!alive) return;
        setProjects(res.items);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setError(e.message || 'Ошибка загрузки проектов');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const projectsByStatus = (status: ProjectStatus) =>
    projects.filter((p) => p.status === status);

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
      setError(e.message || 'Не удалось изменить статус проекта');
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
              Проекты · Канбан
            </h1>
            <div className="text-[11px] text-slate-500">
              Перетаскивайте карточки между колонками, чтобы менять статус проекта
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] overflow-hidden">
              <button
                type="button"
                className="px-3 py-1.5 bg-slate-800 text-slate-50"
              >
                Канбан
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-800/80"
                onClick={goTable}
              >
                Таблица
              </button>
            </div>

            <button
              onClick={createProject}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
            >
              + Новый проект
            </button>
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-2xl px-3 py-2">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-[12px] text-slate-400">Загрузка проектов…</div>
        )}

        {!loading && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {STATUSES.map((col) => {
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
                    {columnProjects.map((project) => (
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
                            € {project.amount.toLocaleString('ru-RU')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {project.createdAt}
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
                      </div>
                    ))}

                    {columnProjects.length === 0 && (
                      <div className="text-[11px] text-slate-500 italic px-1 py-2">
                        Нет проектов
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};