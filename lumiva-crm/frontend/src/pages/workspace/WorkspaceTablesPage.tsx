import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  createCustomObject,
  createCustomObjectField,
  createCustomObjectRecord,
  fetchAllCustomObjectRecords,
  fetchCustomObjectFields,
  fetchCustomObjects,
  updateCustomObject,
  type CustomObject,
} from '../../api/customObjects';
import { fetchWorkspaceAreas } from '../../api/workspaceAreas';
import { parseEnabledViews } from '../../workspace/workspaceEnabledViews';

export const WorkspaceTablesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<CustomObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<CustomObject | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameDescription, setRenameDescription] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [duplicatingObject, setDuplicatingObject] = useState<CustomObject | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateWithRecords, setDuplicateWithRecords] = useState(false);
  const [duplicateWithHistory, setDuplicateWithHistory] = useState(false);

  const loadObjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCustomObjects();
      setItems(res);
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.tablesList.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const areas = await fetchWorkspaceAreas();
        if (!alive) return;
        const first = areas[0];
        if (first?.id) {
          navigate(`/workspace/areas/${first.id}`, { replace: true });
          return;
        }
      } catch {
        /* fallback: legacy list */
      }
      if (!alive) return;
      await loadObjects();
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openRename = (obj: CustomObject) => {
    setRenaming(obj);
    setRenameName(obj.name);
    setRenameDescription(obj.description || '');
    setMenuOpenId(null);
  };

  const saveRename = async () => {
    if (!renaming || !renameName.trim()) return;
    setSavingRename(true);
    setError(null);
    try {
      const updated = await updateCustomObject(renaming.id, {
        name: renameName.trim(),
        description: renameDescription.trim() || undefined,
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setRenaming(null);
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.tablesList.updateError'));
    } finally {
      setSavingRename(false);
    }
  };

  const openDuplicate = (obj: CustomObject) => {
    setDuplicatingObject(obj);
    setDuplicateName(`${obj.name} (copy)`);
    setDuplicateWithRecords(false);
    setDuplicateWithHistory(false);
    setMenuOpenId(null);
  };

  const duplicateTable = async () => {
    if (!duplicatingObject || !duplicateName.trim()) return;
    const obj = duplicatingObject;
    setDuplicatingId(obj.id);
    setError(null);
    try {
      const sourceFields = await fetchCustomObjectFields(obj.id);
      const created = await createCustomObject({
        name: duplicateName.trim(),
        description: obj.description || undefined,
      });
      const activeFields = sourceFields
        .filter((field) => field.isActive)
        .sort((a, b) => a.order - b.order);
      if (activeFields.length > 0) {
        await Promise.all(
          activeFields.map((field) =>
            createCustomObjectField(created.id, {
              key: field.key,
              label: field.label,
              type: field.type,
              required: field.required,
              options: field.options || undefined,
            }),
          ),
        );
      }
      if (duplicateWithRecords) {
        const sourceRecords = await fetchAllCustomObjectRecords(obj.id);
        const idMap = new Map<string, string>();
        for (let i = 0; i < sourceRecords.length; i += 20) {
          const chunk = sourceRecords.slice(i, i + 20);
          const createdChunk = await Promise.all(
            chunk.map((record) =>
              createCustomObjectRecord(created.id, {
                values: { ...(record.values || {}) },
              }),
            ),
          );
          chunk.forEach((sourceRecord, idx) => {
            const createdRecord = createdChunk[idx];
            if (createdRecord?.id) idMap.set(sourceRecord.id, createdRecord.id);
          });
        }
        if (duplicateWithHistory && typeof window !== 'undefined') {
          try {
            const sourceCommentsRaw = localStorage.getItem(`workspace_comments_${obj.id}`);
            const sourceActivityRaw = localStorage.getItem(`workspace_activity_${obj.id}`);
            const sourceComments = sourceCommentsRaw
              ? (JSON.parse(sourceCommentsRaw) as Record<string, any[]>)
              : {};
            const sourceActivity = sourceActivityRaw
              ? (JSON.parse(sourceActivityRaw) as Record<string, any[]>)
              : {};

            const targetComments: Record<string, any[]> = {};
            const targetActivity: Record<string, any[]> = {};
            idMap.forEach((newId, oldId) => {
              if (sourceComments[oldId]?.length) {
                targetComments[newId] = sourceComments[oldId].map((item) => ({
                  ...item,
                  id: crypto.randomUUID(),
                }));
              }
              if (sourceActivity[oldId]?.length) {
                targetActivity[newId] = sourceActivity[oldId].map((item) => ({
                  ...item,
                  id: crypto.randomUUID(),
                }));
              }
            });
            localStorage.setItem(
              `workspace_comments_${created.id}`,
              JSON.stringify(targetComments),
            );
            localStorage.setItem(
              `workspace_activity_${created.id}`,
              JSON.stringify(targetActivity),
            );
          } catch {
            // ignore local storage migration errors
          }
        }
      }
      setDuplicatingObject(null);
      await loadObjects();
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.tablesList.duplicateError'));
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{t('crm.workspace.tablesList.title')}</h1>
            <p className="text-sm text-slate-500">{t('crm.workspace.tablesList.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/workspace/new')}
            className="px-4 py-2 rounded-xl bg-lumiva-accent text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            {t('crm.workspace.tablesList.newTable')}
          </button>
        </div>

        {loading && <div className="text-sm text-slate-500">{t('crm.workspace.common.loading')}</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            {t('crm.workspace.tablesList.empty')}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((obj) => {
            const ev = parseEnabledViews(obj.meta);
            return (
            <div key={obj.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">{obj.name}</div>
                  <div className="text-xs text-slate-500 mt-1">/{obj.slug}</div>
                </div>
                <div className="relative flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {obj.isActive ? t('crm.workspace.common.active') : t('crm.workspace.common.disabled')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMenuOpenId((prev) => (prev === obj.id ? null : obj.id))}
                    className="h-7 w-7 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                    title={t('crm.workspace.tablesList.tableActions')}
                  >
                    ⋯
                  </button>
                  {menuOpenId === obj.id && (
                    <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <button
                        type="button"
                        onClick={() => openRename(obj)}
                        className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                      >
                        {t('crm.workspace.tablesList.renameTable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openDuplicate(obj)}
                        disabled={duplicatingId === obj.id}
                        className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {t('crm.workspace.tablesList.duplicateTable')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {obj.description && (
                <p className="text-sm text-slate-600 mt-3 line-clamp-2">{obj.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/workspace/${obj.id}/table`)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-100 text-xs text-lumiva-accent transition-all duration-200 hover:bg-slate-200"
                >
                  {t('crm.workspace.views.table')}
                </button>
                {ev.kanban && (
                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/${obj.id}/kanban`)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                  >
                    {t('crm.workspace.views.kanban')}
                  </button>
                )}
                {ev.calendar && (
                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/${obj.id}/calendar`)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                  >
                    {t('crm.workspace.views.calendar')}
                  </button>
                )}
                {ev.analytics && (
                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/${obj.id}/analytics`)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                  >
                    {t('crm.workspace.views.analytics')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/workspace/${obj.id}/settings`)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  {t('crm.workspace.views.settings')}
                </button>
              </div>
            </div>
            );
          })}
        </div>

        {renaming && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="text-base font-semibold text-slate-900">{t('crm.workspace.tablesList.editTable')}</div>
              <div className="mt-3 space-y-3">
                <input
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  placeholder={t('crm.workspace.tablesList.tableNamePlaceholder')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={renameDescription}
                  onChange={(e) => setRenameDescription(e.target.value)}
                  placeholder={t('crm.workspace.tablesList.descriptionPlaceholder')}
                  className="w-full min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenaming(null)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
                >
                  {t('crm.common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void saveRename()}
                  disabled={savingRename || !renameName.trim()}
                  className="rounded-xl bg-lumiva-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {savingRename ? t('crm.common.saving') : t('crm.common.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {duplicatingObject && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="text-base font-semibold text-slate-900">{t('crm.workspace.tablesList.duplicateTable')}</div>
              <div className="mt-3 space-y-3">
                <input
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  placeholder={t('crm.workspace.tablesList.newTableNamePlaceholder')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={duplicateWithRecords}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDuplicateWithRecords(checked);
                      if (!checked) setDuplicateWithHistory(false);
                    }}
                  />
                  <span className="text-sm text-slate-700">{t('crm.workspace.tablesList.duplicateWithRecords')}</span>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                    duplicateWithRecords
                      ? 'cursor-pointer border-slate-200 bg-slate-50'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={duplicateWithHistory}
                    disabled={!duplicateWithRecords}
                    onChange={(e) => setDuplicateWithHistory(e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">{t('crm.workspace.tablesList.copyCommentsActivity')}</span>
                </label>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDuplicatingObject(null)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
                >
                  {t('crm.common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void duplicateTable()}
                  disabled={duplicatingId === duplicatingObject.id || !duplicateName.trim()}
                  className="rounded-xl bg-lumiva-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {duplicatingId === duplicatingObject.id ? t('crm.workspace.tablesList.duplicating') : t('crm.workspace.tablesList.duplicate')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

