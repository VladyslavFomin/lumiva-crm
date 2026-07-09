import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { resolvePublicAssetUrl } from '../../api/client';
import { fetchCustomObjects, type CustomObject } from '../../api/customObjects';
import {
  fetchWorkspaceArea,
  updateWorkspaceArea,
  uploadWorkspaceAreaCover,
  deleteWorkspaceArea,
  readWorkspaceIntegrationBindings,
  type WorkspaceArea,
} from '../../api/workspaceAreas';
import { WorkspaceAreaIntegrationsModal } from '../../components/workspace/WorkspaceAreaIntegrationsModal';
import { NAV_ICON_MAP, type NavIconKey } from '../../components/layout/NavSidebarIcons';
import { parseEnabledViews } from '../../workspace/workspaceEnabledViews';
import { readRecentWorkspaceTables, touchRecentWorkspaceTable } from '../../workspace/workspaceRecentTables';
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';

type TabKey = 'recent' | 'content' | 'permissions';

const ICON_KEYS = Object.keys(NAV_ICON_MAP) as NavIconKey[];

export const WorkspaceAreaHomePage: React.FC = () => {
  const { t } = useTranslation();
  const { areaId = '' } = useParams();
  const navigate = useNavigate();
  const [area, setArea] = useState<WorkspaceArea | null>(null);
  const [objects, setObjects] = useState<CustomObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('recent');
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [iconPicker, setIconPicker] = useState(false);
  const [deleteAreaOpen, setDeleteAreaOpen] = useState(false);
  const [deletingArea, setDeletingArea] = useState(false);

  const load = useCallback(async () => {
    if (!areaId || !/^[0-9a-f-]{36}$/i.test(areaId)) return;
    setLoading(true);
    try {
      const [a, obs] = await Promise.all([
        fetchWorkspaceArea(areaId),
        fetchCustomObjects(areaId),
      ]);
      setArea(a);
      setObjects(obs);
      setNameDraft(a.name || '');
      setDescDraft(a.description || '');
    } catch {
      setArea(null);
      setObjects([]);
    } finally {
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const coverResolved = useMemo(
    () => resolvePublicAssetUrl(area?.coverImageUrl || null),
    [area?.coverImageUrl],
  );

  const recentIds = useMemo(() => (areaId ? readRecentWorkspaceTables(areaId) : []), [areaId, objects]);
  const recentObjects = useMemo(() => {
    const map = new Map(objects.map((o) => [o.id, o]));
    return recentIds.map((id) => map.get(id)).filter(Boolean) as CustomObject[];
  }, [recentIds, objects]);

  const AreaIcon = (area?.iconKey && NAV_ICON_MAP[area.iconKey as NavIconKey]) || NAV_ICON_MAP.folder;

  const saveDescription = async () => {
    if (!area) return;
    const next = descDraft.trim();
    if (next === (area.description || '').trim()) return;
    setSavingProfile(true);
    try {
      const updated = await updateWorkspaceArea(area.id, {
        description: next || null,
      });
      setArea(updated);
    } finally {
      setSavingProfile(false);
    }
  };

  const saveName = async () => {
    if (!area) return;
    const next = nameDraft.trim();
    if (!next || next === area.name) return;
    setSavingName(true);
    try {
      const updated = await updateWorkspaceArea(area.id, { name: next });
      setArea(updated);
      setNameDraft(updated.name);
    } catch {
      setNameDraft(area.name);
    } finally {
      setSavingName(false);
    }
  };

  const setAreaIcon = async (key: NavIconKey) => {
    if (!area) return;
    setIconPicker(false);
    const updated = await updateWorkspaceArea(area.id, { iconKey: key });
    setArea(updated);
  };

  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !area) return;
    setCoverUploading(true);
    try {
      const updated = await uploadWorkspaceAreaCover(area.id, f);
      setArea(updated);
    } finally {
      setCoverUploading(false);
    }
  };

  const openTable = (o: CustomObject) => {
    if (areaId) touchRecentWorkspaceTable(areaId, o.id);
    navigate(`/workspace/${o.id}/table`);
  };

  const bindings = readWorkspaceIntegrationBindings(area?.meta);

  const confirmDeleteArea = async () => {
    if (!area) return;
    setDeletingArea(true);
    try {
      await deleteWorkspaceArea(area.id);
      navigate('/workspace');
    } finally {
      setDeletingArea(false);
      setDeleteAreaOpen(false);
    }
  };

  if (!areaId || !/^[0-9a-f-]{36}$/i.test(areaId)) {
    return (
      <MainLayout>
        <div className="p-8 text-slate-600">…</div>
      </MainLayout>
    );
  }

  if (!loading && !area) {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto p-8 text-center text-slate-600">
          {t('crm.workspace.tablesList.loadError')}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="w-full max-w-none -mx-3 md:-mx-6 px-0 pb-16">
        <div className="border-b border-slate-200 bg-white shadow-sm">
          <div
            className="h-40 sm:h-48 w-full bg-slate-100 bg-cover bg-center relative"
            style={{
              backgroundImage: coverResolved
                ? `url(${coverResolved})`
                : 'linear-gradient(135deg,#14532d 0%,#166534 40%,#22c55e 100%)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/15 to-black/10 pointer-events-none" />
            <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1 pointer-events-none">
              <div className="pointer-events-auto flex flex-col items-end gap-1">
                <input
                  id="workspace-area-cover-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => void onCoverFile(e)}
                  disabled={!area || coverUploading}
                />
                <label
                  htmlFor="workspace-area-cover-file"
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md backdrop-blur transition hover:bg-white ${
                    !area || coverUploading ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  {coverUploading
                    ? '…'
                    : area?.coverImageUrl
                      ? t('crm.workspace.area.coverReplace')
                      : t('crm.workspace.area.coverUploadButton')}
                </label>
                <p
                  className={`max-w-[220px] text-right text-[10px] leading-tight drop-shadow ${
                    coverResolved ? 'text-white/95' : 'text-white/90'
                  }`}
                >
                  {t('crm.workspace.area.coverUploadHint')}
                </p>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 lg:px-8 pb-6 -mt-12 sm:-mt-14 relative">
            <div className="flex flex-wrap items-end gap-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIconPicker((v) => !v)}
                  className="flex h-16 w-16 sm:h-[72px] sm:w-[72px] items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg ring-4 ring-white"
                  style={{ backgroundColor: area?.iconColor || '#3b82f6' }}
                  title={t('crm.workspace.area.iconLabel')}
                >
                  <AreaIcon className="!h-9 !w-9 text-white" />
                </button>
                {iconPicker && (
                  <div className="absolute left-0 top-full z-30 mt-2 max-h-48 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="grid grid-cols-4 gap-1">
                      {ICON_KEYS.map((k) => {
                        const Ic = NAV_ICON_MAP[k];
                        return (
                          <button
                            key={k}
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-700"
                            onClick={() => void setAreaIcon(k)}
                          >
                            <Ic className="!h-4 !w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pb-0.5">
                <input
                  className="w-full max-w-3xl border-0 border-b border-transparent bg-transparent text-2xl sm:text-3xl font-semibold tracking-tight text-[#222222] outline-none transition hover:border-slate-200 focus:border-slate-300 focus:ring-0"
                  value={nameDraft}
                  disabled={!area || savingName}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => void saveName()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder={t('crm.workspace.area.namePlaceholder')}
                />
              </div>
              <div className="flex flex-wrap gap-2 pb-0.5">
                <button
                  type="button"
                  onClick={() => setIntegrationsOpen(true)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#222222] shadow-sm hover:bg-slate-50"
                >
                  {t('crm.workspace.area.integrations')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/workspace/new?workspaceAreaId=${areaId}&finish=table&kind=board`)
                  }
                  className="btn-primary"
                >
                  {t('crm.workspace.area.newBoardTable')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/workspace/new?workspaceAreaId=${areaId}&finish=table&kind=data`)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#222222] shadow-sm hover:bg-slate-50"
                >
                  {t('crm.workspace.area.newDataTable')}
                </button>
                {area && area.slug !== 'main' && (
                  <button
                    type="button"
                    onClick={() => setDeleteAreaOpen(true)}
                    className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 shadow-sm hover:bg-rose-50"
                  >
                    {t('crm.workspace.area.deleteArea')}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={() => void saveDescription()}
                placeholder={t('crm.workspace.area.descriptionPlaceholder')}
                className="w-full min-h-[88px] rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-[#222222] placeholder:text-slate-400 outline-none focus:border-slate-300 focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 px-4 sm:px-6 lg:px-8 flex flex-wrap gap-2 border-b border-slate-200 pb-0">
          {(
            [
              ['recent', t('crm.workspace.area.tabRecent')],
              ['content', t('crm.workspace.area.tabContent')],
              ['permissions', t('crm.workspace.area.tabPermissions')],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-t-xl px-4 py-2.5 text-sm font-medium transition ${
                tab === k
                  ? 'bg-white text-[#222222] shadow-sm border border-b-0 border-slate-200 -mb-px'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mx-4 sm:mx-6 lg:mx-8 rounded-b-2xl rounded-tr-2xl border border-slate-200 border-t-0 bg-white p-6 shadow-sm min-h-[240px]">
          {tab === 'permissions' && (
            <div className="space-y-4 max-w-xl">
              <p className="text-sm text-slate-700">{t('crm.workspace.area.permissionsLead')}</p>
              <p className="text-sm text-slate-500">{t('crm.workspace.area.permissionsNote')}</p>
              <Link
                to="/staff/permissions"
                className="btn-primary btn-primary-lg"
              >
                {t('crm.workspace.area.permissionsCta')}
              </Link>
            </div>
          )}
          {tab === 'recent' && (
            <div className="divide-y divide-slate-100">
              {recentObjects.length === 0 && (
                <p className="text-sm text-slate-500 py-6">{t('crm.workspace.gantt.empty')}</p>
              )}
              {recentObjects.map((o) => {
                const Icon =
                  (o.meta?.workspaceNavIcon &&
                    NAV_ICON_MAP[o.meta.workspaceNavIcon as NavIconKey]) ||
                  NAV_ICON_MAP.table;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => openTable(o)}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"
                  >
                    <Icon className="h-5 w-5 text-slate-500" />
                    <span className="flex-1 font-medium text-slate-900">{o.name}</span>
                    <span className="text-slate-400 text-xs">{t('crm.workspace.area.star')}</span>
                  </button>
                );
              })}
            </div>
          )}
          {tab === 'content' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">{t('crm.workspace.area.contentSubtitle')}</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t('crm.workspace.newTable.name')}</th>
                      <th className="px-4 py-3">{t('crm.workspace.area.tableKindColumn')}</th>
                      <th className="px-4 py-3">{t('crm.workspace.views.addView')}</th>
                      <th className="px-4 py-3">{t('crm.workspace.common.created')}</th>
                      <th className="px-4 py-3">{t('crm.workspace.area.integrations')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {objects.map((o) => {
                      const v = parseEnabledViews(o.meta);
                      const views = [
                        v.table && t('crm.workspace.views.table'),
                        v.kanban && t('crm.workspace.views.kanban'),
                        v.calendar && t('crm.workspace.views.calendar'),
                        v.analytics && t('crm.workspace.views.analytics'),
                        v.gantt && t('crm.workspace.views.gantt'),
                      ]
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <tr key={o.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openTable(o)}
                              className="font-medium text-lumiva-accent hover:underline"
                            >
                              {o.name}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                getWorkspaceTableKind(o.meta as Record<string, unknown> | null) ===
                                'board'
                                  ? 'bg-lumiva-accent text-white'
                                  : 'bg-surface-subtle text-text-secondary'
                              }`}
                            >
                              {getWorkspaceTableKind(o.meta as Record<string, unknown> | null) ===
                              'board'
                                ? t('crm.workspace.kindBadge.board')
                                : t('crm.workspace.kindBadge.data')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{views || '—'}</td>
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-slate-400">—</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {objects.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    {t('crm.workspace.tablesList.empty')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {bindings.length > 0 && (
          <div className="mt-6 mx-4 sm:mx-6 lg:mx-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {t('crm.workspace.area.bindingsTitle')}
            </div>
            <ul className="flex flex-wrap gap-2">
              {bindings.map((b) => (
                <li
                  key={b.id}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {b.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {area && integrationsOpen && (
        <WorkspaceAreaIntegrationsModal
          open={integrationsOpen}
          area={area}
          onClose={() => setIntegrationsOpen(false)}
          onSaved={(next) => setArea(next)}
        />
      )}

      {deleteAreaOpen && area && (
        <div className="fixed inset-0 z-[8500] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => !deletingArea && setDeleteAreaOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">{t('crm.workspace.area.deleteArea')}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {t('crm.workspace.area.deleteAreaConfirm', { name: area.name })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingArea}
                onClick={() => setDeleteAreaOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t('crm.common.cancel')}
              </button>
              <button
                type="button"
                disabled={deletingArea}
                onClick={() => void confirmDeleteArea()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingArea ? '…' : t('crm.workspace.area.deleteArea')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
