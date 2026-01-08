// src/pages/projects/ProjectTasksPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchProjects } from '../../api/projects';
import { getLocale } from '../../i18n/utils';
import type { Project, ProjectTask } from './projectTypes';

type FlattenedTask = ProjectTask & {
  projectId: string;
  projectName: string;
  owner: string | null;
};

export const ProjectTasksPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = getLocale(i18n.language);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchProjects()
      .then((res) => {
        if (!alive) return;
        setProjects(res.items);
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
  }, []);

  const tasks: FlattenedTask[] = useMemo(() => {
    const list: FlattenedTask[] = [];
    projects.forEach((p) => {
      (p.tasks || []).forEach((t) => {
        list.push({
          ...t,
          projectId: p.id,
          projectName: p.name,
          owner: p.owner ?? null,
        });
      });
    });
    return list;
  }, [projects]);

  return (
    <MainLayout>
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

        <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lumiva-accent">
              {t('crm.projects.tasks.table.title')}
            </h2>
            <span className="text-[11px] text-slate-500">
              {t('crm.projects.tasks.table.total', { count: tasks.length })}
            </span>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500">{t('crm.projects.tasks.loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.tasks.table.headers.task')}
                    </th>
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.tasks.table.headers.project')}
                    </th>
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.tasks.table.headers.owner')}
                    </th>
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.tasks.table.headers.status')}
                    </th>
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.tasks.table.headers.priority')}
                    </th>
                    <th className="py-1.5 px-2 text-right font-normal">
                      {t('crm.projects.tasks.table.headers.deadline')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-center text-slate-500">
                        {t('crm.projects.tasks.empty')}
                      </td>
                    </tr>
                  )}

                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-1.5 px-2 text-lumiva-accent font-semibold">{task.title}</td>
                      <td
                        className="py-1.5 px-2 text-slate-600 cursor-pointer hover:text-slate-900"
                        onClick={() => navigate(`/app/projects/${task.projectId}`)}
                      >
                        {task.projectName}
                      </td>
                      <td className="py-1.5 px-2 text-slate-600">
                        {(task.assignees && task.assignees.join(', ')) ||
                          task.owner ||
                          t('crm.projects.common.emptyValue')}
                      </td>
                      <td className="py-1.5 px-2 text-slate-600">{task.status}</td>
                      <td className="py-1.5 px-2 text-slate-600">{task.priority}</td>
                      <td className="py-1.5 px-2 text-right text-slate-500">
                        {task.deadline
                          ? new Date(task.deadline).toLocaleDateString(locale)
                          : t('crm.projects.common.emptyValue')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};
