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
          <h1 className="page-title">
            {t('crm.projects.archive.title')}
          </h1>
          <div className="page-subtitle">
            {t('crm.projects.archive.subtitle')}
          </div>
        </div>

        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="card p-4">
          {loading ? (
            <div className="text-xs text-text-tertiary">
              {t('crm.projects.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-xs border-separate border-spacing-y-1 table-fixed">
                <thead className="text-text-tertiary">
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
                    <tr key={p.id} className="bg-white hover:bg-surface-hover transition-colors">
                      <td className="px-3 py-1.5 text-[#111827]">{p.name}</td>
                      <td className="px-3 py-1.5 text-text-secondary">{p.status}</td>
                      <td className="px-3 py-1.5 text-text-secondary">
                        {p.owner ?? t('crm.projects.common.emptyValue')}
                      </td>
                      <td className="px-3 py-1.5 text-text-secondary">
                        {p.amount} {p.currency}
                      </td>
                      <td className="px-3 py-1.5 text-text-tertiary">{p.createdAt}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUnarchive(p.id)}
                            className="btn-secondary btn-secondary-sm"
                          >
                            {t('crm.projects.archive.actions.unarchive')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="btn-danger btn-secondary-sm"
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
                        className="px-3 py-3 text-center text-xs text-text-tertiary"
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



