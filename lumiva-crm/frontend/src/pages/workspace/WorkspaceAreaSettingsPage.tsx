import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import './WorkspaceArea.css';
import { WsAreaBar } from '../../components/workspace/WsAreaBar';
import { fetchCustomObjects, updateCustomObject, type CustomObject } from '../../api/customObjects';
import {
  fetchWorkspaceArea,
  updateWorkspaceArea,
  uploadWorkspaceAreaCover,
  deleteWorkspaceArea,
  readWorkspaceIntegrationBindings,
  fetchWorkspaceAreaMembers,
  addWorkspaceAreaMember,
  updateWorkspaceAreaMemberRole,
  removeWorkspaceAreaMember,
  type WorkspaceArea,
} from '../../api/workspaceAreas';
import { fetchStaff, type StaffUser } from '../../api/staff';
import type { WorkspaceAreaMember, WorkspaceAreaRole } from '../../workspace/workspaceAreaRole';
import { WorkspaceAreaIntegrationsModal } from '../../components/workspace/WorkspaceAreaIntegrationsModal';
import { WorkspaceSourceIcon } from '../../components/workspace/WorkspaceSourceIcon';
import { NAV_ICON_MAP, type NavIconKey } from '../../components/layout/NavSidebarIcons';
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';

type Section = 'profile' | 'people' | 'sources' | 'tables' | 'danger';

const ICON_KEYS = Object.keys(NAV_ICON_MAP) as NavIconKey[];
const ROLES: WorkspaceAreaRole[] = ['owner', 'editor', 'reader', 'own_rows_only'];

function initials(name: string | undefined | null, fallback: string): string {
  const n = (name || '').trim();
  if (!n) return (fallback || '?').slice(0, 1).toUpperCase();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function sortByRank(list: CustomObject[]): CustomObject[] {
  return [...list].sort((a, b) => {
    const ka = getWorkspaceTableKind(a.meta) === 'board' ? 0 : 1;
    const kb = getWorkspaceTableKind(b.meta) === 'board' ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const ra = typeof a.meta?.sidebarRank === 'number' ? a.meta.sidebarRank : null;
    const rb = typeof b.meta?.sidebarRank === 'number' ? b.meta.sidebarRank : null;
    if (ra !== null && rb !== null) return ra - rb;
    if (ra !== null) return -1;
    if (rb !== null) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export const WorkspaceAreaSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { areaId = '' } = useParams();
  const navigate = useNavigate();

  const [area, setArea] = useState<WorkspaceArea | null>(null);
  const [objects, setObjects] = useState<CustomObject[]>([]);
  const [members, setMembers] = useState<WorkspaceAreaMember[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('profile');
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const [addStaffId, setAddStaffId] = useState('');
  const [addRole, setAddRole] = useState<WorkspaceAreaRole>('editor');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);

  const [reorderBusy, setReorderBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [deletingArea, setDeletingArea] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState('');

  const load = useCallback(async () => {
    if (!areaId || !/^[0-9a-f-]{36}$/i.test(areaId)) return;
    setLoading(true);
    try {
      const [a, obs, mem, staffList] = await Promise.all([
        fetchWorkspaceArea(areaId),
        fetchCustomObjects(areaId),
        fetchWorkspaceAreaMembers(areaId).catch(() => [] as WorkspaceAreaMember[]),
        fetchStaff().catch(() => [] as StaffUser[]),
      ]);
      setArea(a);
      setObjects(obs);
      setMembers(mem);
      setStaff(staffList);
      setNameDraft(a.name || '');
      setDescDraft(a.description || '');
    } catch {
      setArea(null);
    } finally {
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isArchived = Boolean(area?.meta?.archivedAt);
  const bindings = useMemo(() => readWorkspaceIntegrationBindings(area?.meta), [area?.meta]);
  const sortedObjects = useMemo(() => sortByRank(objects), [objects]);
  const availableStaff = useMemo(
    () => staff.filter((s) => !members.some((m) => m.staffUserId === s.id)),
    [staff, members],
  );
  const ownerCount = useMemo(() => members.filter((m) => m.role === 'owner').length, [members]);

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

  const saveDescription = async () => {
    if (!area) return;
    const next = descDraft.trim();
    if (next === (area.description || '').trim()) return;
    setSavingDesc(true);
    try {
      setArea(await updateWorkspaceArea(area.id, { description: next || null }));
    } finally {
      setSavingDesc(false);
    }
  };

  const setAreaIcon = async (key: NavIconKey) => {
    if (!area) return;
    setArea(await updateWorkspaceArea(area.id, { iconKey: key }));
  };

  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !area) return;
    setCoverUploading(true);
    try {
      setArea(await uploadWorkspaceAreaCover(area.id, f));
    } finally {
      setCoverUploading(false);
    }
  };

  const addMember = async () => {
    if (!area || !addStaffId) return;
    setAddingMember(true);
    setAddMemberError(null);
    try {
      const created = await addWorkspaceAreaMember(area.id, { staffUserId: addStaffId, role: addRole });
      setMembers((prev) => [...prev, created]);
      setAddStaffId('');
      setAddRole('editor');
    } catch (e: any) {
      setAddMemberError(e?.message || String(e));
    } finally {
      setAddingMember(false);
    }
  };

  const changeMemberRole = async (m: WorkspaceAreaMember, role: WorkspaceAreaRole) => {
    if (!area) return;
    setMemberBusyId(m.id);
    try {
      const updated = await updateWorkspaceAreaMemberRole(area.id, m.id, role);
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } finally {
      setMemberBusyId(null);
    }
  };

  const removeMember = async (m: WorkspaceAreaMember) => {
    if (!area) return;
    setMemberBusyId(m.id);
    try {
      await removeWorkspaceAreaMember(area.id, m.id);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } finally {
      setMemberBusyId(null);
    }
  };

  const moveTable = async (id: string, dir: 'up' | 'down') => {
    const idx = sortedObjects.findIndex((o) => o.id === id);
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= sortedObjects.length) return;
    const a = sortedObjects[idx];
    const b = sortedObjects[j];
    const rankA = typeof a.meta?.sidebarRank === 'number' ? a.meta.sidebarRank : idx * 10;
    const rankB = typeof b.meta?.sidebarRank === 'number' ? b.meta.sidebarRank : j * 10;
    setReorderBusy(true);
    try {
      await updateCustomObject(a.id, { meta: { ...(a.meta || {}), sidebarRank: rankB } });
      await updateCustomObject(b.id, { meta: { ...(b.meta || {}), sidebarRank: rankA } });
      setObjects(await fetchCustomObjects(areaId));
    } finally {
      setReorderBusy(false);
    }
  };

  const toggleArchive = async () => {
    if (!area) return;
    setArchiveBusy(true);
    try {
      const updated = await updateWorkspaceArea(area.id, {
        meta: { archivedAt: isArchived ? null : new Date().toISOString() },
      });
      setArea(updated);
    } finally {
      setArchiveBusy(false);
    }
  };

  const confirmDeleteArea = async () => {
    if (!area || deleteNameInput.trim() !== area.name) return;
    setDeletingArea(true);
    try {
      await deleteWorkspaceArea(area.id);
      navigate('/workspace/areas');
    } finally {
      setDeletingArea(false);
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

  const SIDE_ITEMS: { key: Section; label: string; icon: NavIconKey }[] = [
    { key: 'profile', label: t('crm.workspace.areaSettings.sectionProfile'), icon: 'folder' },
    { key: 'people', label: t('crm.workspace.areaSettings.sectionPeople'), icon: 'contacts' },
    { key: 'sources', label: t('crm.workspace.areaSettings.sectionSources'), icon: 'tools' },
    { key: 'tables', label: t('crm.workspace.areaSettings.sectionTables'), icon: 'table' },
  ];

  return (
    <MainLayout>
      <div className="ws-page max-w-6xl mx-auto">
        {area && (
          <WsAreaBar
            areaId={area.id}
            areaName={area.name}
            areaIconKey={area.iconKey}
            current={t('crm.workspace.areasList.settings')}
          />
        )}

        <div className="page-head">
          <div>
            <h1>{t('crm.workspace.areaSettings.title')}</h1>
            <div className="sub">{area?.name}</div>
          </div>
        </div>

        <div className="ws-cols">
          <div className="ws-side">
            {SIDE_ITEMS.map((it) => {
              const Icon = NAV_ICON_MAP[it.icon];
              return (
                <button
                  key={it.key}
                  type="button"
                  className={section === it.key ? 'on' : ''}
                  onClick={() => setSection(it.key)}
                >
                  <Icon className="!h-[14px] !w-[14px]" />
                  {it.label}
                </button>
              );
            })}
            {area && area.slug !== 'main' && (
              <>
                <div className="gt">{t('crm.workspace.areaSettings.dangerGroup')}</div>
                <button
                  type="button"
                  className={section === 'danger' ? 'on' : ''}
                  onClick={() => setSection('danger')}
                  style={section !== 'danger' ? { color: '#9c2338' } : undefined}
                >
                  <NAV_ICON_MAP.tools className="!h-[14px] !w-[14px]" />
                  {t('crm.workspace.areaSettings.sectionDanger')}
                </button>
              </>
            )}
          </div>

          <div>
            {section === 'profile' && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.areaSettings.sectionProfile')}</h2>
                    <div className="s">{t('crm.workspace.areaSettings.profileHint')}</div>
                  </div>
                </div>
                <div className="ws-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="ws-field" style={{ minWidth: 220 }}>
                    <label>{t('crm.workspace.area.namePlaceholder')}</label>
                    <input
                      className="ws-input"
                      value={nameDraft}
                      disabled={!area || savingName}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => void saveName()}
                    />
                  </div>
                  <div className="ws-field">
                    <label>{t('crm.workspace.area.descriptionPlaceholder')}</label>
                    <textarea
                      className="ws-input"
                      rows={3}
                      value={descDraft}
                      disabled={!area || savingDesc}
                      onChange={(e) => setDescDraft(e.target.value)}
                      onBlur={() => void saveDescription()}
                    />
                  </div>
                  <div className="ws-field">
                    <label>{t('crm.workspace.area.iconLabel')}</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ICON_KEYS.map((k) => {
                        const Ic = NAV_ICON_MAP[k];
                        return (
                          <button
                            key={k}
                            type="button"
                            className={`ws-pick${area?.iconKey === k ? ' on' : ''}`}
                            style={{ flex: '0 0 auto', minWidth: 0, padding: 9, justifyContent: 'center' }}
                            onClick={() => void setAreaIcon(k)}
                          >
                            <Ic className="!h-[15px] !w-[15px]" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="ws-field">
                    <label>{t('crm.workspace.area.coverUploadLabel')}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        id="workspace-area-settings-cover-file"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        onChange={(e) => void onCoverFile(e)}
                        disabled={!area || coverUploading}
                      />
                      <label htmlFor="workspace-area-settings-cover-file" className="btn btn-sm" style={{ cursor: 'pointer' }}>
                        {coverUploading ? '…' : area?.coverImageUrl ? t('crm.workspace.area.coverReplace') : t('crm.workspace.area.coverUploadButton')}
                      </label>
                      <span className="ws-note">{t('crm.workspace.area.coverUploadHint')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === 'people' && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.areaSettings.sectionPeople')}</h2>
                    <div className="s">{t('crm.workspace.areaSettings.peopleHint')}</div>
                  </div>
                </div>
                <div className="ws-sec-body">
                  {members.map((m) => {
                    const lastOwner = m.role === 'owner' && ownerCount <= 1;
                    return (
                      <div className="ws-mrow" key={m.id}>
                        <span className="ws-ava">{initials(m.staffUser?.fullName, m.staffUser?.email || '?')}</span>
                        <span style={{ minWidth: 0 }}>
                          <span className="nm">{m.staffUser?.fullName || m.staffUser?.email || '—'}</span>
                          <div className="ml">{m.staffUser?.email}</div>
                        </span>
                        <span className="sp" />
                        <select
                          className="ws-input"
                          style={{ width: 170 }}
                          value={m.role}
                          disabled={memberBusyId === m.id || lastOwner}
                          onChange={(e) => void changeMemberRole(m, e.target.value as WorkspaceAreaRole)}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(`crm.workspace.areaSettings.roles.${r}`)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="tb-icon-btn"
                          disabled={memberBusyId === m.id || lastOwner}
                          title={lastOwner ? t('crm.workspace.areaSettings.lastOwnerHint') : undefined}
                          onClick={() => void removeMember(m)}
                        >
                          {t('crm.common.remove', { defaultValue: 'Убрать' })}
                        </button>
                      </div>
                    );
                  })}
                  {members.length === 0 && <div className="ws-note" style={{ padding: '10px 0' }}>{t('crm.workspace.areaSettings.noMembers')}</div>}

                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-3)' }}>
                    <div className="ws-k" style={{ marginBottom: 8 }}>{t('crm.workspace.areaSettings.addMemberTitle')}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div className="ws-field" style={{ minWidth: 220 }}>
                        <label>{t('crm.workspace.areaSettings.pickStaff')}</label>
                        <select className="ws-input" value={addStaffId} onChange={(e) => setAddStaffId(e.target.value)}>
                          <option value="">{t('crm.workspace.areaSettings.pickStaffPlaceholder')}</option>
                          {availableStaff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName} ({s.email})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ws-field" style={{ width: 170 }}>
                        <label>{t('crm.workspace.areaSettings.roleLabel')}</label>
                        <select className="ws-input" value={addRole} onChange={(e) => setAddRole(e.target.value as WorkspaceAreaRole)}>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(`crm.workspace.areaSettings.roles.${r}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!addStaffId || addingMember}
                        onClick={() => void addMember()}
                      >
                        {addingMember ? '…' : t('crm.workspace.areaSettings.addMemberBtn')}
                      </button>
                    </div>
                    {availableStaff.length === 0 && staff.length > 0 && (
                      <p className="ws-note" style={{ marginTop: 8 }}>{t('crm.workspace.areaSettings.allStaffAdded')}</p>
                    )}
                    {addMemberError && <p className="ws-note" style={{ marginTop: 8, color: '#9c2338' }}>{addMemberError}</p>}
                  </div>

                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-3)' }}>
                    <div className="ws-k" style={{ marginBottom: 8 }}>{t('crm.workspace.areaSettings.roleMatrixTitle')}</div>
                    <table className="ws-bind">
                      <thead>
                        <tr>
                          <th>{t('crm.workspace.areaSettings.capabilityCol')}</th>
                          {ROLES.map((r) => (
                            <th key={r}>{t(`crm.workspace.areaSettings.roles.${r}`)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['view', 'yes', 'yes', 'yes', 'own'],
                            ['editRows', 'yes', 'yes', 'no', 'own'],
                            ['pushRows', 'yes', 'yes', 'no', 'no'],
                            ['editColumns', 'yes', 'no', 'no', 'no'],
                            ['connectSources', 'yes', 'no', 'no', 'no'],
                            ['deleteTables', 'yes', 'no', 'no', 'no'],
                          ] as const
                        ).map(([capKey, ...vals]) => (
                          <tr key={capKey}>
                            <td className="col">{t(`crm.workspace.areaSettings.capability.${capKey}`)}</td>
                            {vals.map((v, i) => (
                              <td key={i} style={{ color: v === 'no' ? 'var(--fg-4)' : 'var(--fg-2)' }}>
                                {t(`crm.workspace.areaSettings.capabilityVal.${v}`)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {section === 'sources' && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.areaSettings.sectionSources')}</h2>
                    <div className="s">{t('crm.workspace.area.integrationsLead')}</div>
                  </div>
                </div>
                <div className="ws-sec-body">
                  {bindings.length === 0 && <div className="ws-note">{t('crm.workspace.area.sourcesEmpty')}</div>}
                  {bindings.map((b) => (
                    <div className="ws-mrow" key={b.id}>
                      <span className="ws-ava">
                        <WorkspaceSourceIcon catalogKey={b.catalogKey} className="!h-[13px] !w-[13px]" />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="nm">{b.label}</span>
                        <div className="ml">{b.catalogKey}</div>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="ws-sec-foot">
                  <button type="button" className="btn btn-sm" onClick={() => setIntegrationsOpen(true)}>
                    {t('crm.workspace.area.sourcesManage')}
                  </button>
                </div>
              </div>
            )}

            {section === 'tables' && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.areaSettings.sectionTables')}</h2>
                    <div className="s">{t('crm.workspace.areaSettings.tablesHint')}</div>
                  </div>
                </div>
                <div className="ws-sec-body">
                  {sortedObjects.map((o, i) => (
                    <div className="ws-fieldrow" key={o.id} style={{ gridTemplateColumns: '20px 1fr auto' }}>
                      <span className="drag">⋮⋮</span>
                      <span className="lb">
                        {o.name}
                        <span className="kk">{getWorkspaceTableKind(o.meta) === 'board' ? t('crm.workspace.kindBadge.shortBoard') : t('crm.workspace.kindBadge.shortData')}</span>
                      </span>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="tb-icon-btn" disabled={reorderBusy || i === 0} onClick={() => void moveTable(o.id, 'up')}>
                          ↑
                        </button>
                        <button
                          type="button"
                          className="tb-icon-btn"
                          disabled={reorderBusy || i === sortedObjects.length - 1}
                          onClick={() => void moveTable(o.id, 'down')}
                        >
                          ↓
                        </button>
                      </span>
                    </div>
                  ))}
                  {sortedObjects.length === 0 && <div className="ws-note">{t('crm.workspace.tablesList.empty')}</div>}
                </div>
              </div>
            )}

            {section === 'danger' && (
              <div className="ws-sec danger">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.areaSettings.sectionDanger')}</h2>
                  </div>
                </div>
                <div className="ws-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="ws-mrow" style={{ border: '1px solid var(--line-2)', borderRadius: 9, padding: 11 }}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="nm">{isArchived ? t('crm.workspace.areaSettings.archivedLabel') : t('crm.workspace.areaSettings.archiveLabel')}</span>
                      <div className="ml">{t('crm.workspace.areaSettings.archiveHint')}</div>
                    </span>
                    <button type="button" className="btn btn-sm" disabled={archiveBusy} onClick={() => void toggleArchive()}>
                      {archiveBusy ? '…' : isArchived ? t('crm.workspace.areaSettings.unarchiveBtn') : t('crm.workspace.areaSettings.archiveBtn')}
                    </button>
                  </div>
                  <div style={{ border: '1px solid #f0d3d8', borderRadius: 9, padding: 11, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span>
                      <span className="nm" style={{ color: '#9c2338' }}>{t('crm.workspace.area.deleteArea')}</span>
                      <div className="ml">{t('crm.workspace.areaSettings.deleteHint')}</div>
                    </span>
                    <div className="ws-field">
                      <label>{t('crm.workspace.areaSettings.deleteConfirmLabel')}</label>
                      <input
                        className="ws-input"
                        value={deleteNameInput}
                        onChange={(e) => setDeleteNameInput(e.target.value)}
                        placeholder={area?.name}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: '#9c2338', borderColor: '#f0d3d8', alignSelf: 'flex-start' }}
                      disabled={deletingArea || deleteNameInput.trim() !== area?.name}
                      onClick={() => void confirmDeleteArea()}
                    >
                      {t('crm.workspace.area.deleteArea')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {area && integrationsOpen && (
        <WorkspaceAreaIntegrationsModal
          open={integrationsOpen}
          area={area}
          onClose={() => setIntegrationsOpen(false)}
          onSaved={(next) => setArea(next)}
        />
      )}
    </MainLayout>
  );
};
