import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchProjects, updateProject, archiveProject, deleteProject } from '../../api/projects';
import { fetchStaff } from '../../api/staff';
import type { Project } from './projectTypes';
import type { StaffUser } from '../../api/staff';

export const ProjectsBulkEditPage: React.FC = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusDraft, setStatusDraft] = useState<Project['status'] | ''>('');
  const [ownerDraftId, setOwnerDraftId] = useState<string>('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchProjects(), fetchStaff()])
      .then(([res, staffUsers]) => {
        if (!alive) return;
        setProjects(res.items);
        setStaff(staffUsers);
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

  const statusOptions: Project['status'][] = [
    'Новый',
    'В работе',
    'На проверке',
    'Заморожен',
    'Выиграно',
    'Проиграно',
  ];

  const ownerOptions = useMemo(
    () =>
      staff
        .filter((u) => u.isActive)
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [staff],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === projects.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(projects.map((p) => p.id));
  };

  const applyStatus = async () => {
    if (!statusDraft || !selectedIds.length) return;
    await Promise.all(
      selectedIds.map((id) => {
        const target = projects.find((p) => p.id === id);
        if (!target) return null;
        return updateProject({ ...target, status: statusDraft }).catch((e) => {
          console.error(e);
          return null;
        });
      }),
    );
    setProjects((prev) =>
      prev.map((p) =>
        selectedIds.includes(p.id) ? { ...p, status: statusDraft } : p,
      ),
    );
    setStatusDraft('');
  };

  const applyOwner = async () => {
    if (!selectedIds.length) return;
    const owner = ownerOptions.find((u) => u.id === ownerDraftId);
    await Promise.all(
      selectedIds.map((id) => {
        const target = projects.find((p) => p.id === id);
        if (!target) return null;
        return updateProject({
          ...target,
          owner: owner ? owner.fullName : null,
          ownerUserId: owner ? owner.id : null,
        }).catch((e) => {
          console.error(e);
          return null;
        });
      }),
    );
    setProjects((prev) =>
      prev.map((p) =>
        selectedIds.includes(p.id)
          ? { ...p, owner: owner ? owner.fullName : null, ownerUserId: owner?.id ?? null }
          : p,
      ),
    );
    setOwnerDraftId('');
  };

  const archiveSelected = async () => {
    if (!selectedIds.length) return;
    await Promise.all(
      selectedIds.map((id) =>
        archiveProject(id).catch((e) => {
          console.error(e);
          return null;
        }),
      ),
    );
    setProjects((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
    setSelectedIds([]);
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    await Promise.all(
      selectedIds.map((id) =>
        deleteProject(id).catch((e) => {
          console.error(e);
          return null;
        }),
      ),
    );
    setProjects((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
    setSelectedIds([]);
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">
            {t('crm.projects.bulkEdit.title')}
          </h1>
          <div className="text-[11px] text-slate-500">
            {t('crm.projects.bulkEdit.subtitle')}
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] text-slate-400">
              {t('crm.projects.list.bulk.selected', { count: selectedIds.length })}
            </div>
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as Project['status'] | '')}
              className="px-3 py-1.5 rounded-full bg-white text-slate-900 text-[12px] border border-slate-200"
            >
              <option value="">{t('crm.projects.list.bulk.status')}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyStatus}
              className="px-3 py-1.5 text-[12px] rounded-full bg-slate-900 text-white border border-slate-700 hover:bg-slate-800"
            >
              {t('crm.projects.bulkEdit.actions.applyStatus')}
            </button>
            <select
              value={ownerDraftId}
              onChange={(e) => setOwnerDraftId(e.target.value)}
              className="px-3 py-1.5 rounded-full bg-white text-slate-900 text-[12px] border border-slate-200"
            >
              <option value="">{t('crm.projects.bulkEdit.owner')}</option>
              <option value="">{t('crm.projects.bulkEdit.ownerEmpty')}</option>
              {ownerOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyOwner}
              className="px-3 py-1.5 text-[12px] rounded-full border border-slate-700 text-slate-200 hover:bg-slate-900"
            >
              {t('crm.projects.bulkEdit.actions.applyOwner')}
            </button>
            <button
              type="button"
              onClick={archiveSelected}
              className="px-3 py-1.5 text-[12px] rounded-full border border-slate-600 text-slate-200 hover:bg-slate-900"
            >
              {t('crm.projects.list.bulk.archive')}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              className="px-3 py-1.5 text-[12px] rounded-full border border-rose-600 text-rose-200 hover:bg-rose-950"
            >
              {t('crm.projects.list.bulk.delete')}
            </button>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500">{t('crm.projects.loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-xs border-separate border-spacing-y-1 table-fixed">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-3 py-1 w-10">
                      <input
                        type="checkbox"
                        checked={projects.length > 0 && selectedIds.length === projects.length}
                        onChange={toggleAll}
                      />
                    </th>
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
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="bg-slate-950/80">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelected(p.id)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-slate-200">{p.name}</td>
                      <td className="px-3 py-1.5 text-slate-300">{p.status}</td>
                      <td className="px-3 py-1.5 text-slate-300">
                        {p.owner ?? t('crm.projects.common.emptyValue')}
                      </td>
                      <td className="px-3 py-1.5 text-slate-300">
                        {p.amount} {p.currency}
                      </td>
                    </tr>
                  ))}
                  {!projects.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-3 text-center text-[12px] text-slate-500"
                      >
                        {t('crm.projects.list.empty')}
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



