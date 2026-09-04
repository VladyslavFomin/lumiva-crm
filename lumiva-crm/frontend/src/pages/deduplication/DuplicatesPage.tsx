// src/pages/deduplication/DuplicatesPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  scanDuplicates,
  fetchDuplicateGroups,
  fetchDedupOverview,
  fetchDedupSettings,
  saveDedupSettings,
  fetchDedupHistory,
  ignoreDuplicateGroup,
  undoDuplicateMerge,
  mergeDuplicates,
  type DedupEntityType,
  type DuplicateGroup,
  type DedupOverview,
  type DedupSettings,
  type DuplicatePair,
} from '../../api/deduplication';
import { Ic, UIC, REASON_ICON } from './DuplicatesIcons';
import './duplicates-design.css';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

const ENTITY_TYPES: DedupEntityType[] = ['contact', 'lead', 'company', 'sale', 'segment'];

type FieldDef = { key: string; mono?: boolean };

const FIELD_DEFS: Record<DedupEntityType, FieldDef[]> = {
  contact: [
    { key: 'firstName' },
    { key: 'lastName' },
    { key: 'phone', mono: true },
    { key: 'email' },
    { key: 'position' },
    { key: 'telegram' },
  ],
  lead: [{ key: 'name' }, { key: 'phone', mono: true }, { key: 'email' }],
  company: [{ key: 'name' }, { key: 'phone', mono: true }, { key: 'email' }, { key: 'website' }],
  sale: [
    { key: 'guestName' },
    { key: 'hotel' },
    { key: 'externalId', mono: true },
    { key: 'externalOrderNo', mono: true },
  ],
  segment: [{ key: 'name' }, { key: 'description' }],
};

function recordTitle(r: Record<string, any>, type: DedupEntityType): string {
  if (type === 'contact') return [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || r.id.slice(0, 8);
  if (type === 'lead') return r.name || r.email || r.id.slice(0, 8);
  if (type === 'company') return r.name || r.id.slice(0, 8);
  if (type === 'sale') return r.guestName || r.externalOrderNo || r.id.slice(0, 8);
  return r.name || r.id.slice(0, 8);
}

function scoreClass(score: number): string {
  return score >= 90 ? 'hi' : score >= 75 ? 'md' : 'lo';
}

const GroupCard: React.FC<{
  group: DuplicateGroup;
  open: boolean;
  toggle: () => void;
  checked: boolean;
  onCheck: () => void;
  defaultMasterRule: 'oldest' | 'newest';
  onMerge: (masterId: string, picks: Record<string, string>) => Promise<void>;
  onIgnore: () => void;
  t: (k: string, o?: any) => string;
}> = ({ group, open, toggle, checked, onCheck, defaultMasterRule, onMerge, onIgnore, t }) => {
  const fields = FIELD_DEFS[group.entityType];
  const sortedByAge = useMemo(
    () =>
      [...group.records].sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return defaultMasterRule === 'newest' ? db - da : da - db;
      }),
    [group.records, defaultMasterRule],
  );
  const [masterId, setMasterId] = useState(sortedByAge[0]?.id);
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const p: Record<string, string> = {};
    fields.forEach((f) => {
      const withValue = group.records.find((r) => r[f.key]);
      p[f.key] = withValue ? withValue.id : group.records[0].id;
    });
    return p;
  });
  const [merging, setMerging] = useState(false);

  const cols = `168px repeat(${group.records.length}, minmax(0,1fr))`;
  const conflicts = fields.filter((f) => new Set(group.records.map((r) => r[f.key]).filter(Boolean)).size > 1);
  const master = group.records.find((r) => r.id === masterId) || group.records[0];

  const handleMerge = async () => {
    setMerging(true);
    try {
      await onMerge(masterId, picks);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className={cx('du-group', open && 'open')}>
      <div className="du-ghead" onClick={toggle}>
        <div
          className={cx('du-check', checked && 'on')}
          onClick={(e) => {
            e.stopPropagation();
            onCheck();
          }}
        >
          <Ic d={UIC.check} size={11} sw={2.4} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="du-gn">
            {recordTitle(group.records[0], group.entityType)}
            <span className={cx('du-score', scoreClass(group.score))}>
              {t('crm.deduplication.page.matchPct', { score: group.score })}
            </span>
          </div>
          <div className="du-gm">
            {t('crm.deduplication.page.groupMeta', { count: group.records.length, conflicts: conflicts.length })}
          </div>
        </div>
        <div className="du-why">
          {group.reasons.map((r) => (
            <span key={r} className="du-tag">
              <Ic d={UIC[REASON_ICON[r] || 'wand']} size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
              {t(`crm.deduplication.page.reasons.${r}`, { defaultValue: r })}
            </span>
          ))}
        </div>
        <Ic d={open ? UIC.chev : UIC.chevR} size={14} />
      </div>

      {open && (
        <div className="du-cmp">
          <div className="du-cmp-grid">
            <div className="du-cols" style={{ gridTemplateColumns: cols }}>
              <div className="du-col-head" />
              {group.records.map((r) => (
                <div key={r.id} className={cx('du-col-head', masterId === r.id && 'master')}>
                  <div className="du-cn">{recordTitle(r, group.entityType)}</div>
                  <div className="du-cm">
                    ID {r.id.slice(0, 8)} · {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                  <button className={cx('du-pick', masterId === r.id && 'on')} onClick={() => setMasterId(r.id)}>
                    {masterId === r.id ? t('crm.deduplication.page.primaryOn') : t('crm.deduplication.page.primaryOff')}
                  </button>
                </div>
              ))}
            </div>

            {fields.map((f) => {
              const isConflict = new Set(group.records.map((r) => r[f.key]).filter(Boolean)).size > 1;
              return (
                <div key={f.key} className="du-frow" style={{ gridTemplateColumns: cols }}>
                  <div className="du-fk">{t(`crm.deduplication.entityFields.${group.entityType}.${f.key}`)}</div>
                  {group.records.map((r) => {
                    const v = r[f.key];
                    const chosen = picks[f.key] === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={cx('du-fv', isConflict && 'conflict', chosen && 'chosen', !v && 'empty')}
                        onClick={() => v && setPicks({ ...picks, [f.key]: r.id })}
                      >
                        {v ? (
                          <>
                            <span className={cx('du-radio', chosen && 'on')} />
                            <span className={f.mono ? 'mono' : ''}>{String(v)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {conflicts.length > 0 && (
            <div className="du-alert warn">
              <Ic d={UIC.flag} size={13} />
              <div>
                {t('crm.deduplication.page.conflictHint', {
                  fields: conflicts.map((c) => t(`crm.deduplication.entityFields.${group.entityType}.${c.key}`).toLowerCase()).join(', '),
                })}
              </div>
            </div>
          )}

          <div className="du-result">
            <Ic d={UIC.merge} size={16} />
            <div>
              <div className="t">{t('crm.deduplication.page.resultTitle', { name: recordTitle(master, group.entityType) })}</div>
              <div className="d">{t('crm.deduplication.page.resultDesc', { count: group.records.length - 1 })}</div>
            </div>
            <div className="sp" />
            <button className="btn btn-sm ghost" onClick={onIgnore}>
              {t('crm.deduplication.notDuplicateBtn')}
            </button>
            <button className="btn btn-sm" disabled={merging} onClick={handleMerge}>
              <Ic d={UIC.merge} size={13} />
              {merging ? t('crm.deduplication.page.merging') : t('crm.deduplication.mergeBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const DuplicatesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertModal();
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';

  const [entityType, setEntityType] = useState<DedupEntityType>('contact');
  const [tab, setTab] = useState<'queue' | 'settings' | 'history'>('queue');

  const [overview, setOverview] = useState<DedupOverview | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; found: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [openGid, setOpenGid] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [settings, setSettings] = useState<DedupSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [history, setHistory] = useState<DuplicatePair[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const groupId = (g: DuplicateGroup) => g.ids.slice().sort().join('-');

  const loadQueue = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchDuplicateGroups(entityType), fetchDedupOverview(entityType)])
      .then(([g, o]) => {
        setGroups(g.groups);
        setOverview(o);
        setOpenGid((prev) => prev ?? (g.groups[0] ? groupId(g.groups[0]) : null));
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setChecked(new Set());
    setOpenGid(null);
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  useEffect(() => {
    if (tab !== 'settings' || settings) return;
    fetchDedupSettings()
      .then(setSettings)
      .catch((e: any) => setError(e.message));
  }, [tab, settings]);

  useEffect(() => {
    if (tab !== 'history') return;
    setHistoryLoading(true);
    fetchDedupHistory({ entityType, limit: 50 })
      .then((res) => setHistory(res.items))
      .catch((e: any) => setError(e.message))
      .finally(() => setHistoryLoading(false));
  }, [tab, entityType]);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    setError(null);
    try {
      const result = await scanDuplicates(entityType);
      setScanResult(result);
      loadQueue();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleMergeGroup = async (group: DuplicateGroup, masterId: string, picks: Record<string, string>) => {
    try {
      for (const loser of group.records.filter((r) => r.id !== masterId)) {
        const fieldMap: Record<string, 'winner' | 'loser'> = {};
        Object.entries(picks).forEach(([field, sourceId]) => {
          if (sourceId === loser.id) fieldMap[field] = 'loser';
        });
        await mergeDuplicates({ entityType, winnerId: masterId, loserId: loser.id, fieldMap });
      }
      loadQueue();
    } catch (e: any) {
      showAlert(e.message || t('crm.deduplication.page.mergeError'), { variant: 'error' });
    }
  };

  const handleIgnoreGroup = async (group: DuplicateGroup) => {
    try {
      await ignoreDuplicateGroup(group.ids);
      loadQueue();
    } catch (e: any) {
      showAlert(e.message || t('crm.deduplication.page.mergeError'), { variant: 'error' });
    }
  };

  const handleBulkMergeByRule = async () => {
    const targets = groups.filter((g) => checked.has(groupId(g)));
    for (const group of targets) {
      const sorted = [...group.records].sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return (settings?.masterRule ?? 'oldest') === 'newest' ? db - da : da - db;
      });
      const master = sorted[0];
      const picks: Record<string, string> = {};
      FIELD_DEFS[entityType].forEach((f) => {
        const withValue = group.records.find((r) => r[f.key]);
        if (withValue) picks[f.key] = withValue.id;
      });
      await handleMergeGroup(group, master.id, picks);
    }
    setChecked(new Set());
  };

  const handleBulkIgnore = async () => {
    const targets = groups.filter((g) => checked.has(groupId(g)));
    for (const group of targets) await handleIgnoreGroup(group);
    setChecked(new Set());
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    setSettingsSaved(false);
    try {
      const saved = await saveDedupSettings({
        masterRule: settings.masterRule,
        fillEmptyFields: settings.fillEmptyFields,
        autoMergeThreshold: settings.autoMergeThreshold,
      });
      setSettings(saved);
      setSettingsSaved(true);
    } catch (e: any) {
      showAlert(e.message, { variant: 'error' });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleUndo = async (pairId: string) => {
    try {
      await undoDuplicateMerge(pairId);
      setHistory((prev) => prev.filter((p) => p.id !== pairId));
    } catch (e: any) {
      showAlert(e.message || t('crm.deduplication.page.undoError'), { variant: 'error' });
    }
  };

  const ruleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    groups.forEach((g) => g.reasons.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1)));
    return counts;
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter((g) => g.records.some((r) => recordTitle(r, entityType).toLowerCase().includes(q)));
  }, [groups, search, entityType]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <MainLayout>
      <PageHelpButton topic="duplicates" />
      <div className="px-scope">
        <div className="du-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.deduplication.page.kicker')}
            </div>
            <h1>{t('crm.deduplication.title')}</h1>
            <p className="sub">{t('crm.deduplication.page.heroSub')}</p>
          </div>
          <div className="du-hero-r">
            <button className="btn btn-sm" disabled={scanning} onClick={handleScan}>
              <Ic d={UIC.scan} size={13} />
              {scanning ? t('crm.deduplication.scanningBtn') : t('crm.deduplication.scanBtn')}
            </button>
          </div>
        </div>

        <div className="du-seg" style={{ marginBottom: 16 }}>
          {ENTITY_TYPES.map((et) => (
            <button key={et} className={cx(entityType === et && 'on')} onClick={() => setEntityType(et)}>
              {t(`crm.deduplication.tabs.${et}`)}
            </button>
          ))}
        </div>

        {error && (
          <div className="du-alert err" style={{ margin: '0 0 14px' }}>
            {error}
          </div>
        )}
        {scanResult && (
          <div className="du-alert" style={{ margin: '0 0 14px' }}>
            {t('crm.deduplication.scanResultFormat', { scanned: scanResult.scanned, found: scanResult.found })}
          </div>
        )}

        {overview && (
          <div className="du-kpis">
            <div className="du-kpi">
              <div className="l">{t('crm.deduplication.page.kpi.groups')}</div>
              <div className="v">{overview.groupsCount}</div>
              <div className="d">{t('crm.deduplication.page.kpi.groupsDesc', { count: overview.recordsInvolved })}</div>
            </div>
            <div className="du-kpi">
              <div className="l">{t('crm.deduplication.page.kpi.highConfidence')}</div>
              <div className="v">{overview.groupsHighConfidence}</div>
              <div className="d">{t('crm.deduplication.page.kpi.highConfidenceDesc')}</div>
            </div>
            <div className="du-kpi">
              <div className="l">{t('crm.deduplication.page.kpi.merged')}</div>
              <div className="v">{overview.mergedTotal}</div>
            </div>
            <div className="du-kpi">
              <div className="l">{t('crm.deduplication.page.kpi.rate')}</div>
              <div className="v">{overview.duplicateRatePct}%</div>
              <div className="d">{t('crm.deduplication.page.kpi.rateDesc', { total: overview.entityTotal })}</div>
            </div>
          </div>
        )}

        <div className="du-tabs">
          <div className={cx('du-tab', tab === 'queue' && 'active')} onClick={() => setTab('queue')}>
            {t('crm.deduplication.page.tabs.queue')}
            <span className="n">{groups.length}</span>
          </div>
          <div className={cx('du-tab', tab === 'settings' && 'active')} onClick={() => setTab('settings')}>
            {t('crm.deduplication.page.tabs.settings')}
          </div>
          <div className={cx('du-tab', tab === 'history' && 'active')} onClick={() => setTab('history')}>
            {t('crm.deduplication.page.tabs.history')}
          </div>
        </div>

        {tab === 'queue' ? (
          loading ? (
            <div className="text-xs" style={{ color: 'var(--fg-3)' }}>
              {t('crm.deduplication.loading')}
            </div>
          ) : (
            <div className="du-layout">
              <div className="du-card">
                <div className="du-card-head">
                  <div>
                    <h3>
                      <Ic d={UIC.scan} size={15} />
                      {t('crm.deduplication.page.rules.title')}
                    </h3>
                    <div className="sub">{t('crm.deduplication.page.rules.subtitle', { count: groups.length })}</div>
                  </div>
                </div>
                <div className="du-card-body tight">
                  {['phone', 'email', 'name_company', 'fuzzy_name'].map((r) => (
                    <div key={r} className="du-rule">
                      <Ic d={UIC[REASON_ICON[r] || 'wand']} size={14} style={{ marginTop: 2, color: 'var(--fg-3)' }} />
                      <div style={{ minWidth: 0 }}>
                        <div className="t">{t(`crm.deduplication.page.reasons.${r}`)}</div>
                        <div className="d">{t(`crm.deduplication.page.reasonHints.${r}`)}</div>
                      </div>
                      <span className="c">{ruleCounts.get(r) ?? 0}</span>
                    </div>
                  ))}
                </div>
                <div className="du-card-foot">
                  <span>{t('crm.deduplication.page.rules.footnote')}</span>
                </div>
              </div>

              <div className="du-card">
                <div className="du-toolbar">
                  <div className="du-search">
                    <Ic d={UIC.search} size={13} />
                    <input
                      placeholder={t('crm.deduplication.page.searchPlaceholder') || ''}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {filteredGroups.length > 0 && (
                    <>
                      <div
                        className={cx('du-check', checked.size === filteredGroups.length && 'on')}
                        onClick={() =>
                          setChecked(checked.size === filteredGroups.length ? new Set() : new Set(filteredGroups.map(groupId)))
                        }
                        style={{ marginLeft: 4 }}
                      >
                        <Ic d={UIC.check} size={11} sw={2.4} />
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.deduplication.page.selectAll')}</span>
                    </>
                  )}
                </div>

                {filteredGroups.length === 0 ? (
                  <div className="du-card-body" style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
                    {groups.length === 0 ? t('crm.deduplication.emptyTitle') : t('crm.staff.permissions.noResults', { q: search })}
                  </div>
                ) : (
                  <div className="du-card-body tight">
                    {filteredGroups.map((g) => {
                      const gid = groupId(g);
                      return (
                        <GroupCard
                          key={gid}
                          group={g}
                          open={openGid === gid}
                          toggle={() => setOpenGid(openGid === gid ? null : gid)}
                          checked={checked.has(gid)}
                          onCheck={() =>
                            setChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(gid)) next.delete(gid);
                              else next.add(gid);
                              return next;
                            })
                          }
                          defaultMasterRule={settings?.masterRule ?? 'oldest'}
                          onMerge={(masterId, picks) => handleMergeGroup(g, masterId, picks)}
                          onIgnore={() => handleIgnoreGroup(g)}
                          t={t}
                        />
                      );
                    })}
                  </div>
                )}

                {checked.size > 0 ? (
                  <div className="du-bulk">
                    <Ic d={UIC.merge} size={16} />
                    <div className="t">{t('crm.deduplication.page.selectedCount', { count: checked.size })}</div>
                    <div className="sp" />
                    <button className="btn btn-sm ghost" onClick={() => setChecked(new Set())}>
                      {t('crm.deduplication.page.clearSelection')}
                    </button>
                    <button className="btn btn-sm ghost" onClick={handleBulkIgnore}>
                      {t('crm.deduplication.notDuplicateBtn')}
                    </button>
                    <button className="btn btn-sm" onClick={handleBulkMergeByRule}>
                      <Ic d={UIC.merge} size={13} />
                      {t('crm.deduplication.page.bulkMerge')}
                    </button>
                  </div>
                ) : (
                  overview && (
                    <div className="du-card-foot">
                      <span>{t('crm.deduplication.page.footnote', { groups: overview.groupsCount, records: overview.recordsInvolved })}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )
        ) : tab === 'settings' ? (
          <div className="du-layout" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
            <div className="du-card">
              <div className="du-card-head">
                <div>
                  <h3>
                    <Ic d={UIC.shield} size={15} />
                    {t('crm.deduplication.page.settingsCard.title')}
                  </h3>
                  <div className="sub">{t('crm.deduplication.page.settingsCard.subtitle')}</div>
                </div>
              </div>
              {!settings ? (
                <div className="du-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {t('crm.deduplication.loading')}
                </div>
              ) : (
                <>
                  <div className="du-card-body">
                    <div className="du-set">
                      <div>
                        <div className="t">{t('crm.deduplication.page.settingsCard.masterRule')}</div>
                        <div className="d">{t('crm.deduplication.page.settingsCard.masterRuleHint')}</div>
                      </div>
                      <select
                        className="du-select"
                        value={settings.masterRule}
                        onChange={(e) => setSettings({ ...settings, masterRule: e.target.value as 'oldest' | 'newest' })}
                      >
                        <option value="oldest">{t('crm.deduplication.page.settingsCard.oldest')}</option>
                        <option value="newest">{t('crm.deduplication.page.settingsCard.newest')}</option>
                      </select>
                    </div>
                    <div className="du-set">
                      <div>
                        <div className="t">{t('crm.deduplication.page.settingsCard.fillEmpty')}</div>
                        <div className="d">{t('crm.deduplication.page.settingsCard.fillEmptyHint')}</div>
                      </div>
                      <button
                        type="button"
                        className={cx('du-switch', settings.fillEmptyFields && 'on')}
                        onClick={() => setSettings({ ...settings, fillEmptyFields: !settings.fillEmptyFields })}
                      >
                        <i />
                      </button>
                    </div>
                    <div className="du-set">
                      <div>
                        <div className="t">{t('crm.deduplication.page.settingsCard.autoMerge')}</div>
                        <div className="d">{t('crm.deduplication.page.settingsCard.autoMergeHint')}</div>
                      </div>
                      <select
                        className="du-select"
                        value={settings.autoMergeThreshold ?? ''}
                        onChange={(e) =>
                          setSettings({ ...settings, autoMergeThreshold: e.target.value ? Number(e.target.value) : null })
                        }
                      >
                        <option value="">{t('crm.deduplication.page.settingsCard.autoMergeOff')}</option>
                        <option value="100">{t('crm.deduplication.page.settingsCard.autoMerge100')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="du-card-foot">
                    <span>
                      {settingsSaved ? t('crm.deduplication.page.settingsCard.saved') : t('crm.deduplication.page.settingsCard.hint')}
                    </span>
                    <button className="btn btn-sm btn-primary" disabled={settingsSaving} onClick={handleSaveSettings}>
                      <Ic d={UIC.check} size={13} />
                      {settingsSaving ? t('crm.staff.permissions.saving') : t('crm.deduplication.page.settingsCard.save')}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="du-card">
              <div className="du-card-head">
                <div>
                  <h3>
                    <Ic d={UIC.clock} size={15} />
                    {t('crm.deduplication.page.impactCard.title')}
                  </h3>
                </div>
              </div>
              <div className="du-card-body">
                {overview && (
                  <>
                    <div className="du-kv">
                      <span className="k">{t('crm.deduplication.page.impactCard.merged')}</span>
                      <span className="v">{overview.mergedTotal}</span>
                    </div>
                    <div className="du-kv">
                      <span className="k">{t('crm.deduplication.page.impactCard.rate')}</span>
                      <span className="v">{overview.duplicateRatePct}%</span>
                    </div>
                  </>
                )}
                <div className="du-alert" style={{ margin: '12px 0 0' }}>
                  <Ic d={UIC.shield} size={13} />
                  <div>{t('crm.deduplication.page.impactCard.autoMergeNote')}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="du-card">
            <div className="du-card-head">
              <div>
                <h3>
                  <Ic d={UIC.clock} size={15} />
                  {t('crm.deduplication.page.historyCard.title')}
                </h3>
                <div className="sub">{t('crm.deduplication.page.historyCard.subtitle')}</div>
              </div>
            </div>
            <div className="du-card-body tight">
              {historyLoading ? (
                <div className="du-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {t('crm.deduplication.loading')}
                </div>
              ) : history.length === 0 ? (
                <div className="du-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {t('crm.deduplication.page.historyCard.empty')}
                </div>
              ) : (
                history.map((h) => {
                  const canUndo = h.status === 'merged' && !!h.snapshot && h.entityType !== 'sale' && h.entityType !== 'segment';
                  return (
                    <div key={h.id} className="du-hist">
                      <span className="t">{h.resolvedAt ? fmtDate(h.resolvedAt) : fmtDate(h.createdAt)}</span>
                      <span className="m">
                        {h.status === 'merged'
                          ? t('crm.deduplication.page.historyCard.mergedLine')
                          : h.status === 'undone'
                            ? t('crm.deduplication.page.historyCard.undoneLine')
                            : t('crm.deduplication.page.historyCard.ignoredLine')}
                      </span>
                      <span style={{ color: 'var(--fg-3)' }}>{t(`crm.deduplication.tabs.${h.entityType}`)}</span>
                      <span style={{ textAlign: 'right' }}>
                        {canUndo ? (
                          <button className="btn btn-sm" onClick={() => handleUndo(h.id)}>
                            {t('crm.deduplication.page.historyCard.undo')}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--fg-3)' }}>—</span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
