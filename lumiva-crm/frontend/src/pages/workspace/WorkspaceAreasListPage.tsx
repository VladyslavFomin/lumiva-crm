import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import './WorkspaceArea.css';
import {
  createWorkspaceArea,
  fetchWorkspaceAreas,
  fetchWorkspaceAreaSummary,
  type WorkspaceArea,
  type WorkspaceAreaSummary,
} from '../../api/workspaceAreas';
import { NAV_ICON_MAP, NavIconFolder, NavIconPlus, type NavIconKey } from '../../components/layout/NavSidebarIcons';

const LS_KEY = 'lumiva_workspace_area_id';

export const WorkspaceAreasListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<WorkspaceArea[]>([]);
  const [summaries, setSummaries] = useState<Record<string, WorkspaceAreaSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  const currentAreaId = useMemo(() => {
    try {
      return localStorage.getItem(LS_KEY);
    } catch {
      return null;
    }
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchWorkspaceAreas();
      setAreas(list);
      const pairs = await Promise.all(
        list.map(async (a) => {
          try {
            return [a.id, await fetchWorkspaceAreaSummary(a.id)] as const;
          } catch {
            return null;
          }
        }),
      );
      const map: Record<string, WorkspaceAreaSummary> = {};
      pairs.forEach((p) => {
        if (p) map[p[0]] = p[1];
      });
      setSummaries(map);
    } catch (e: any) {
      setError(e?.message || t('crm.workspace.areasList.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openArea = (id: string) => {
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {
      /* ignore */
    }
    navigate(`/workspace/areas/${id}`);
  };

  const submitCreate = async () => {
    if (!newName.trim()) return;
    setSavingNew(true);
    try {
      const created = await createWorkspaceArea({
        name: newName.trim(),
        iconKey: 'folder',
        iconColor: '#6366f1',
      });
      setNewName('');
      setCreating(false);
      openArea(created.id);
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <MainLayout>
      <div className="ws-page max-w-6xl mx-auto">
        <div className="page-head">
          <div>
            <h1>{t('crm.workspace.areasList.title')}</h1>
            <div className="sub">{t('crm.workspace.areasList.subtitle')}</div>
          </div>
        </div>

        {loading && <div className="text-sm" style={{ color: 'var(--fg-3)' }}>{t('crm.workspace.common.loading')}</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}

        {!loading && !error && (
          <div className="ws-areas">
            {areas.map((area) => {
              const Icon =
                area.iconKey && area.iconKey in NAV_ICON_MAP ? NAV_ICON_MAP[area.iconKey as NavIconKey] : NavIconFolder;
              const summary = summaries[area.id];
              const isCurrent = currentAreaId === area.id;
              return (
                <div className="ws-areacard" key={area.id}>
                  <div className="top">
                    <span className="ic" style={{ background: area.iconColor || 'var(--ink)' }}>
                      <Icon className="!h-[17px] !w-[17px]" />
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="nm" style={{ display: 'block' }}>{area.name}</span>
                      <span className="sl">/{area.slug}</span>
                    </span>
                    {isCurrent && <span className="ws-badge board">{t('crm.workspace.areasList.current')}</span>}
                  </div>
                  {area.description && <div className="ds">{area.description}</div>}
                  {summary && (
                    <div className="st">
                      <div>
                        <span className="k">{t('crm.workspace.areasList.sources')}</span>
                        <span className="v">{summary.sourceCount}</span>
                      </div>
                      <div>
                        <span className="k">{t('crm.workspace.areasList.tables')}</span>
                        <span className="v">{summary.tableCount}</span>
                      </div>
                      <div>
                        <span className="k">{t('crm.workspace.areasList.rows')}</span>
                        <span className="v">{new Intl.NumberFormat().format(summary.recordCount)}</span>
                      </div>
                      <div>
                        <span className="k">{t('crm.workspace.areasList.people')}</span>
                        <span className="v">{summary.memberCount}</span>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="tb-icon-btn"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => openArea(area.id)}
                    >
                      {t('crm.workspace.areasList.open')}
                    </button>
                    <button
                      type="button"
                      className="tb-icon-btn"
                      title={t('crm.workspace.areasList.settings')}
                      onClick={() => navigate(`/workspace/areas/${area.id}/settings`)}
                    >
                      <NAV_ICON_MAP.settings className="!h-[13px] !w-[13px]" />
                    </button>
                  </div>
                </div>
              );
            })}

            {creating ? (
              <div className="ws-areacard">
                <div className="ws-field">
                  <label>{t('crm.workspace.areasList.newAreaNameLabel')}</label>
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitCreate();
                      if (e.key === 'Escape') setCreating(false);
                    }}
                    className="ws-input"
                    placeholder={t('crm.workspace.areasList.newAreaPlaceholder')}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="tb-icon-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCreating(false)}>
                    {t('crm.common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: 8, flex: 1, justifyContent: 'center' }}
                    disabled={!newName.trim() || savingNew}
                    onClick={() => void submitCreate()}
                  >
                    {savingNew ? t('crm.common.saving') : t('crm.workspace.areasList.create')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="ws-areacard add" onClick={() => setCreating(true)}>
                <NavIconPlus className="!h-4 !w-4" />
                {t('crm.workspace.areasList.createArea')}
              </button>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
