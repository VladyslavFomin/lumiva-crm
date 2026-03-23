import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  emptyProjectsTrash,
  fetchProjects,
  permanentlyDeleteProject,
  restoreProject,
} from '../../api/projects';
import type { Project } from './projectTypes';

export const ProjectsTrashPage: React.FC = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<
    | { mode: 'single'; project: Project }
    | { mode: 'all' }
    | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProjects({ deleted: true })
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

  const handleRestore = async (id: string) => {
    try {
      await restoreProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.errors.loadFailed'));
    }
  };
  const handlePermanentDelete = async (id: string) => {
    try {
      setActionLoading(true);
      await permanentlyDeleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.errors.loadFailed'));
    } finally {
      setActionLoading(false);
      setConfirmState(null);
    }
  };
  const handleEmptyTrash = async () => {
    try {
      setActionLoading(true);
      await emptyProjectsTrash();
      setProjects([]);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.errors.loadFailed'));
    } finally {
      setActionLoading(false);
      setConfirmState(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">
            {t('crm.projects.trash.title')}
          </h1>
          <div className="text-[11px] text-slate-500">
            {t('crm.projects.trash.subtitle')}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmState({ mode: 'all' })}
            disabled={!projects.length || actionLoading}
            className="px-3 py-1.5 text-xs rounded-xl border border-rose-500/60 text-rose-300 hover:bg-rose-950/50 disabled:opacity-50"
          >
            {t('crm.projects.trash.actions.emptyTrash')}
          </button>
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
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleRestore(p.id)}
                            className="text-[11px] text-sky-300 hover:text-sky-200"
                          >
                            {t('crm.projects.trash.actions.restore')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmState({ mode: 'single', project: p })}
                            className="text-[11px] text-rose-300 hover:text-rose-200"
                          >
                            {t('crm.projects.trash.actions.deletePermanently')}
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
                        {t('crm.projects.trash.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {confirmState && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-50">
                  {confirmState.mode === 'all'
                    ? t('crm.projects.trash.confirm.emptyTitle')
                    : t('crm.projects.trash.confirm.singleTitle')}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {confirmState.mode === 'all'
                    ? t('crm.projects.trash.confirm.emptyDescription')
                    : t('crm.projects.trash.confirm.singleDescription', {
                        name: confirmState.project.name,
                      })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="text-slate-500 hover:text-slate-200 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 rounded-full border border-slate-700 text-slate-300 text-sm hover:bg-slate-800"
                disabled={actionLoading}
              >
                {t('crm.common.cancel')}
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmState.mode === 'all'
                    ? handleEmptyTrash()
                    : handlePermanentDelete(confirmState.project.id)
                }
                className="px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading
                  ? t('crm.projects.trash.confirm.deleting')
                  : t('crm.projects.trash.actions.deletePermanently')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};



