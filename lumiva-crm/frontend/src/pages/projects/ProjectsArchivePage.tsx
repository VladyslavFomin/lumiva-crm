import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  deleteProject,
  fetchProjects,
  unarchiveProject,
} from '../../api/projects';
import type { Project } from './projectTypes';

export const ProjectsArchivePage: React.FC = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProjects({ archived: true })
      .then((res) => {
        if (!alive) return;
        setProjects(res.items);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.projects.errors.loadFailed'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [t]);

  const handleUnarchive = async (id: string) => {
    try {
      await unarchiveProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.errors.loadFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.errors.loadFailed'));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">
            {t('crm.projects.archive.title')}
          </h1>
          <div className="text-[11px] text-slate-500">
            {t('crm.projects.archive.subtitle')}
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          {loading ? (
            <div className="text-xs text-slate-500">
              {t('crm.projects.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-xs border-separate border-spacing-y-1 table-fixed">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-3 py-1 text-left">
                      {t('crm.projects.list.headers.name')}
                    </th>
                    <th className="px-3 py-1 text-left">
                      {t('crm.projects.list.headers.status')}
                    </th>
                    <th className="px-3 py-1 text-left">
                      {t('crm.projects.list.headers.owner')}
                    </th>
                    <th className="px-3 py-1 text-left">
                      {t('crm.projects.list.headers.amount')}
                    </th>
                    <th className="px-3 py-1 text-left">
                      {t('crm.projects.list.headers.created')}
                    </th>
                    <th className="px-3 py-1 text-left">
                      {t('crm.projects.tasks.table.headers.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="bg-slate-950/80">
                      <td className="px-3 py-1.5 text-slate-200">{p.name}</td>
                      <td className="px-3 py-1.5 text-slate-300">{p.status}</td>
                      <td className="px-3 py-1.5 text-slate-300">
                        {p.owner ?? t('crm.projects.common.emptyValue')}
                      </td>
                      <td className="px-3 py-1.5 text-slate-300">
                        {p.amount} {p.currency}
                      </td>
                      <td className="px-3 py-1.5 text-slate-400">{p.createdAt}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUnarchive(p.id)}
                            className="text-[11px] text-sky-300 hover:text-sky-200"
                          >
                            {t('crm.projects.archive.actions.unarchive')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="text-[11px] text-rose-400 hover:text-rose-300"
                          >
                            {t('crm.projects.list.bulk.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!projects.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-3 text-center text-[12px] text-slate-500"
                      >
                        {t('crm.projects.archive.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};



