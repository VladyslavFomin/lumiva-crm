// src/pages/automations/AutomationsPage.tsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  fetchAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  runAutomationNow,
  type RunAutomationNowBody,
  fetchAutomationExecutions,
  fetchAutomationUsageStats,
  type Automation,
  type AutomationExecution,
  type AutomationUsageStats,
} from '../../api/automations';
import { getActionLabel, getTriggerLabel } from './automationLabels';
import { useAlertModal } from '../../contexts/AlertModalContext';

// ─── Design tokens ─────────────────────────────────────────────────────────
const INK = '#222';
const FG2 = '#555';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE2 = '#e7e7e7';
const LINE3 = '#f0f0f0';
const BG_MUTED = '#fafafa';
const BG_SOFT = '#f5f5f5';
const FF_DISPLAY = 'inherit';
const FF_MONO = 'inherit';

type TabId = 'automations' | 'history' | 'usage';

function presetBounds(preset: NonNullable<RunAutomationNowBody['rangePreset']>) {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth();
  const d = n.getUTCDate();
  if (preset === 'yesterday') {
    const x = new Date(Date.UTC(y, m, d - 1));
    const day = x.toISOString().slice(0, 10);
    return { from: day, to: day };
  }
  const endDay = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  let start: Date;
  if (preset === 'this_month') {
    start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  } else {
    start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    if (preset === 'last_7_days') {
      start.setUTCDate(start.getUTCDate() - 6);
    } else if (preset === 'last_30_days') {
      start.setUTCDate(start.getUTCDate() - 29);
    }
  }
  return { from: start.toISOString().slice(0, 10), to: endDay };
}

function executionActionSummary(row: AutomationExecution, t: TFunction) {
  const res = row.executionResult;
  if (!Array.isArray(res)) return '—';
  const total = res.length;
  const ok = res.filter((x: any) => x?.success).length;
  return t('crm.automations.panel.history.actionsCount', { ok, total });
}

export const AutomationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activeTab, setActiveTab] = useState<TabId>('automations');

  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [execLoading, setExecLoading] = useState(false);
  const [execSearch, setExecSearch] = useState('');
  const [execStatus, setExecStatus] = useState<string>('');

  const [usage, setUsage] = useState<AutomationUsageStats | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageDays, setUsageDays] = useState(30);

  const [runSubmittingId, setRunSubmittingId] = useState<string | null>(null);
  const [runModal, setRunModal] = useState<Automation | null>(null);
  const [runModalStep, setRunModalStep] = useState<'form' | 'ok'>('form');
  const [runModalErr, setRunModalErr] = useState<string | null>(null);
  const [runPreset, setRunPreset] = useState<NonNullable<RunAutomationNowBody['rangePreset']>>(
    'last_7_days',
  );
  const [runDateFrom, setRunDateFrom] = useState('');
  const [runDateTo, setRunDateTo] = useState('');

  // row context menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const pageTemplates = useMemo(() => {
    const ids = ['t1', 't2', 't3', 't4', 't5', 't6'] as const;
    return ids.map((id) => ({
      id,
      tag: t(`crm.automations.panel.pageTemplates.${id}.tag`),
      name: t(`crm.automations.panel.pageTemplates.${id}.name`),
      flow: t(`crm.automations.panel.pageTemplates.${id}.flow`, { returnObjects: true }) as string[],
      featured: id === 't1',
    }));
  }, [t]);

  useEffect(() => {
    if (searchParams.get('woo') === '1') {
      navigate('/integrations-hub?woo=1', { replace: true });
      return;
    }
    if (searchParams.get('tab') === 'integrations') {
      navigate('/integrations-hub', { replace: true });
      return;
    }
    const tab = searchParams.get('tab');
    if (tab === 'history' || tab === 'usage') {
      setActiveTab(tab);
    }
  }, [searchParams, navigate]);

  const loadAutomations = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchAutomations()
      .then(setAutomations)
      .catch((e) => {
        console.error(e);
        setError(e.message || t('crm.automations.list.errors.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    void loadAutomations();
  }, [loadAutomations]);

  useEffect(() => {
    if (!runModal || runPreset === 'custom') return;
    const b = presetBounds(runPreset);
    setRunDateFrom(b.from);
    setRunDateTo(b.to);
  }, [runModal, runPreset]);

  useEffect(() => {
    if (!runModal) return;
    setRunModalErr(null);
  }, [runModal, runPreset, runDateFrom, runDateTo]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    let alive = true;
    setExecLoading(true);
    fetchAutomationExecutions(undefined, 200, execStatus || undefined)
      .then((rows) => {
        if (alive) setExecutions(rows);
      })
      .catch((e) => {
        console.error(e);
        if (alive) setError(e.message || t('crm.automations.list.errors.loadFailed'));
      })
      .finally(() => {
        if (alive) setExecLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeTab, execStatus, t]);

  useEffect(() => {
    if (activeTab !== 'usage') return;
    let alive = true;
    setUsageLoading(true);
    fetchAutomationUsageStats(usageDays)
      .then((u) => {
        if (alive) setUsage(u);
      })
      .catch((e) => {
        console.error(e);
        if (alive) setError(e.message || t('crm.automations.list.errors.loadFailed'));
      })
      .finally(() => {
        if (alive) setUsageLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeTab, usageDays, t]);

  const handleCreate = () => navigate('/app/automations/new');
  const handleOpen = (id: string) => navigate(`/app/automations/${id}`);

  const handleToggle = async (automation: Automation) => {
    const next = !automation.isActive;
    setAutomations((prev) =>
      prev.map((item) => (item.id === automation.id ? { ...item, isActive: next } : item)),
    );
    try {
      await updateAutomation(automation.id, { isActive: next });
    } catch (err: any) {
      console.error(err);
      setAutomations((prev) =>
        prev.map((item) =>
          item.id === automation.id ? { ...item, isActive: automation.isActive } : item,
        ),
      );
    }
  };

  const handleArchive = async (automation: Automation) => {
    if (!automation.isActive) return;
    await handleToggle(automation);
  };

  const openRunModal = (automation: Automation) => {
    setRunModal(automation);
    setRunModalStep('form');
    setRunModalErr(null);
    setRunPreset('last_7_days');
    const b = presetBounds('last_7_days');
    setRunDateFrom(b.from);
    setRunDateTo(b.to);
  };

  const closeRunModal = () => {
    setRunModal(null);
    setRunSubmittingId(null);
    setRunModalErr(null);
  };

  const submitRunModal = async () => {
    if (!runModal) return;
    if (runPreset === 'custom' && (!runDateFrom.trim() || !runDateTo.trim())) {
      setRunModalErr(t('crm.automations.panel.runModal.customDatesRequired'));
      return;
    }
    setRunSubmittingId(runModal.id);
    setRunModalErr(null);
    try {
      const body: RunAutomationNowBody =
        runPreset === 'custom'
          ? { rangePreset: 'custom', dateFrom: runDateFrom, dateTo: runDateTo }
          : { rangePreset: runPreset };
      const res = await runAutomationNow(runModal.id, body);
      if (res.success) {
        setRunModalStep('ok');
        await loadAutomations();
      } else {
        setRunModalErr(
          res.errorMessage || t('crm.automations.panel.actions.sendNowFail'),
        );
      }
    } catch (err: unknown) {
      setRunModalErr(err instanceof Error ? err.message : String(err));
    } finally {
      setRunSubmittingId(null);
    }
  };

  const handleDuplicate = async (automation: Automation) => {
    try {
      const created = await createAutomation({
        name: `${automation.name} ${t('crm.automations.panel.copySuffix')}`,
        description: automation.description ?? undefined,
        triggerEvent: automation.triggerEvent,
        conditions: automation.conditions ?? undefined,
        actions: automation.actions,
        isActive: false,
      });
      setAutomations((prev) => [created, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('crm.automations.list.errors.loadFailed'));
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('crm.automations.list.deleteConfirm'))) return;
    try {
      await deleteAutomation(id);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      showAlert(err.message || t('crm.automations.list.errors.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  const filtered = useMemo(() => {
    const statusFiltered =
      statusFilter === 'all'
        ? automations
        : automations.filter((item) =>
            statusFilter === 'active' ? item.isActive : !item.isActive,
          );
    const query = search.trim().toLowerCase();
    if (!query) return statusFiltered;
    return statusFiltered.filter((item) => {
      const hay = [
        item.name,
        item.description ?? '',
        getTriggerLabel(item.triggerEvent, t),
        ...item.actions.map((a) => getActionLabel(a.type, t)),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [automations, search, statusFilter, t]);

  const filteredExecutions = useMemo(() => {
    const q = execSearch.trim().toLowerCase();
    if (!q) return executions;
    return executions.filter((row) => {
      const name = row.automation?.name || '';
      const blob = [
        name,
        row.triggerEvent,
        getTriggerLabel(row.triggerEvent, t),
        row.status,
        row.errorMessage || '',
        row.entityType || '',
        row.entityId || '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [executions, execSearch, t]);

  const activeCount = automations.filter((a) => a.isActive).length;

  const tabLabels: Record<TabId, string> = {
    automations: t('crm.automations.panel.tabs.automations'),
    history: t('crm.automations.panel.tabs.history'),
    usage: t('crm.automations.panel.tabs.usage'),
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: FF_DISPLAY,
    fontSize: 12,
    border: `1px solid ${LINE2}`,
    borderRadius: 10,
    padding: '6px 10px',
    color: INK,
    background: '#fff',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  return (
    <MainLayout>
      <div style={{ fontFamily: FF_DISPLAY, color: INK }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{
                fontFamily: FF_MONO,
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: FG4,
                marginBottom: 6,
              }}>
                {t('crm.automations.panel.page.kicker', { count: activeCount })}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.2 }}>
                {t('crm.automations.panel.page.title')}
              </h1>
              <p style={{ fontSize: 13, color: FG3, margin: '6px 0 0', lineHeight: 1.5, maxWidth: 480 }}>
                {t('crm.automations.panel.page.subtitle')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                style={{
                  fontFamily: FF_DISPLAY,
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: `1px solid ${LINE2}`,
                  background: '#fff',
                  color: FG2,
                  cursor: 'pointer',
                }}
              >
                {t('crm.automations.panel.page.import')}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                style={{
                  fontFamily: FF_DISPLAY,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: INK,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {t('crm.automations.panel.page.newAutomation')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Templates section ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: FF_MONO,
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: FG4,
            marginBottom: 12,
          }}>
            {t('crm.automations.panel.page.templatesKicker')}
          </div>
          <div
            className="auto-templates"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {pageTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => navigate(`/app/automations/new?template=${tpl.id}`)}
                style={{
                  fontFamily: FF_DISPLAY,
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `1px solid ${tpl.featured ? '#d1e3ff' : LINE2}`,
                  background: tpl.featured ? '#f0f7ff' : BG_MUTED,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{
                    fontFamily: FF_MONO,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: tpl.featured ? '#dbeafe' : LINE3,
                    color: tpl.featured ? '#1d4ed8' : FG3,
                    fontWeight: 600,
                  }}>
                    {tpl.tag}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.4, marginBottom: 8 }}>
                  {tpl.name}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {tpl.flow.map((step, i) => (
                    <React.Fragment key={i}>
                      <span style={{
                        fontFamily: FF_MONO,
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#fff',
                        border: `1px solid ${LINE2}`,
                        color: FG2,
                      }}>
                        {step}
                      </span>
                      {i < tpl.flow.length - 1 && (
                        <span style={{ color: FG4, fontSize: 10, alignSelf: 'center' }}>→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main content card ──────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${LINE2}`, borderRadius: 16, overflow: 'hidden' }}>

          {/* Tabs + toolbar */}
          <div style={{ padding: '0 20px', borderBottom: `1px solid ${LINE3}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0 }}>
                {(['automations', 'history', 'usage'] as TabId[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      fontFamily: FF_MONO,
                      fontSize: 10,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      padding: '14px 16px 12px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === tab ? `2px solid ${INK}` : '2px solid transparent',
                      color: activeTab === tab ? INK : FG3,
                      fontWeight: activeTab === tab ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'color 0.15s',
                    }}
                  >
                    {tabLabels[tab]}
                  </button>
                ))}
              </div>

              {/* Toolbar */}
              {(activeTab === 'automations' || activeTab === 'history') && (
                <div style={{ display: 'flex', gap: 8, padding: '8px 0', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${LINE2}`, borderRadius: 8, padding: '5px 10px', background: '#fff' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FG4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                    </svg>
                    <input
                      value={activeTab === 'history' ? execSearch : search}
                      onChange={(e) => activeTab === 'history' ? setExecSearch(e.target.value) : setSearch(e.target.value)}
                      placeholder={activeTab === 'history' ? t('crm.automations.panel.history.searchPlaceholder') : t('crm.automations.panel.searchPlaceholder')}
                      style={{ fontFamily: FF_DISPLAY, fontSize: 12, outline: 'none', border: 'none', color: INK, width: 180, background: 'transparent' }}
                    />
                  </div>
                  {activeTab === 'automations' && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                      style={selectStyle}
                    >
                      <option value="all">{t('crm.automations.panel.filters.all')}</option>
                      <option value="active">{t('crm.automations.panel.filters.active')}</option>
                      <option value="inactive">{t('crm.automations.panel.filters.inactive')}</option>
                    </select>
                  )}
                  {activeTab === 'history' && (
                    <select
                      value={execStatus}
                      onChange={(e) => setExecStatus(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="">{t('crm.automations.panel.history.allStatuses')}</option>
                      <option value="success">{t('crm.automations.panel.history.statusSuccess')}</option>
                      <option value="error">{t('crm.automations.panel.history.statusError')}</option>
                      <option value="pending">{t('crm.automations.panel.history.statusPending')}</option>
                      <option value="skipped">{t('crm.automations.panel.history.statusSkipped')}</option>
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Automations tab ──────────────────────────────────────────── */}
          {activeTab === 'automations' && (
            <div>
              {error && (
                <div style={{ margin: 16, padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626' }}>
                  {error}
                </div>
              )}
              {loading && (
                <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 12, color: FG4 }}>
                  {t('crm.automations.list.loading')}
                </div>
              )}
              {!loading && !error && filtered.length === 0 && (
                <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: FG3 }}>
                  {t('crm.automations.list.empty')}
                </div>
              )}
              {!loading && !error && filtered.length > 0 && (
                <div className="auto-list-table" style={{ overflowX: 'auto' }}>
                  {/* Header row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 200px 130px 100px 36px',
                    gap: 0,
                    padding: '8px 20px',
                    borderBottom: `1px solid ${LINE3}`,
                    background: BG_MUTED,
                    minWidth: 680,
                  }}>
                    {[
                      '',
                      t('crm.automations.panel.table.colName'),
                      t('crm.automations.panel.table.colLastRun'),
                      t('crm.automations.panel.table.colRuns'),
                      t('crm.automations.panel.table.colStatus'),
                      '',
                    ].map((h, i) => (
                      <div key={i} style={{ fontFamily: FF_MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG4, padding: '0 8px', alignSelf: 'center' }}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {/* Data rows */}
                  {filtered.map((automation) => (
                    <div
                      key={automation.id}
                      className="auto-list-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr 200px 130px 100px 36px',
                        gap: 0,
                        padding: '0 20px',
                        borderBottom: `1px solid ${LINE3}`,
                        minWidth: 680,
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onClick={() => handleOpen(automation.id)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = BG_MUTED; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                    >
                      {/* Icon */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: automation.isActive ? '#f0fdf4' : BG_SOFT, border: `1px solid ${automation.isActive ? '#bbf7d0' : LINE2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={automation.isActive ? '#16a34a' : FG4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                          </svg>
                        </div>
                      </div>

                      {/* Name + flow */}
                      <div style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: INK, lineHeight: 1.3 }}>
                          {automation.name}
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontFamily: FF_MONO, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                            {getTriggerLabel(automation.triggerEvent, t)}
                          </span>
                          {automation.actions.slice(0, 2).map((a, i) => (
                            <React.Fragment key={i}>
                              <span style={{ color: FG4, fontSize: 10 }}>→</span>
                              <span style={{ fontFamily: FF_MONO, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: LINE3, color: FG2, border: `1px solid ${LINE2}` }}>
                                {getActionLabel(a.type, t)}
                              </span>
                            </React.Fragment>
                          ))}
                          {automation.actions.length > 2 && (
                            <span style={{ fontFamily: FF_MONO, fontSize: 10, color: FG4 }}>
                              +{automation.actions.length - 2}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Last run */}
                      <div style={{ padding: '12px 8px', fontSize: 11, color: FG3 }}>
                        {(automation as any).lastExecutedAt
                          ? new Date((automation as any).lastExecutedAt).toLocaleString()
                          : '—'}
                      </div>

                      {/* Run count + errors */}
                      <div style={{ padding: '12px 8px' }}>
                        <div style={{ fontFamily: FF_MONO, fontSize: 12, color: INK, fontWeight: 500 }}>
                          {automation.executionCount}
                        </div>
                        {automation.errorCount > 0 && (
                          <div style={{ fontFamily: FF_MONO, fontSize: 10, color: '#dc2626', marginTop: 2 }}>
                            {t('crm.automations.panel.table.errorsShort', {
                              count: automation.errorCount,
                            })}
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 20, background: automation.isActive ? '#f0fdf4' : BG_SOFT, border: `1px solid ${automation.isActive ? '#bbf7d0' : LINE2}` }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: automation.isActive ? '#16a34a' : FG4, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontFamily: FF_MONO, fontSize: 10, color: automation.isActive ? '#15803d' : FG3, fontWeight: 600 }}>
                            {automation.isActive
                              ? t('crm.automations.panel.table.statusActive')
                              : t('crm.automations.panel.table.statusPaused')}
                          </span>
                        </div>
                      </div>

                      {/* More / context menu */}
                      <div
                        style={{ padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === automation.id ? null : automation.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: FG3, borderRadius: 6, lineHeight: 1 }}
                        >
                          ···
                        </button>
                        {openMenuId === automation.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              zIndex: 50,
                              background: '#fff',
                              border: `1px solid ${LINE2}`,
                              borderRadius: 10,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              minWidth: 160,
                              overflow: 'hidden',
                            }}
                          >
                            {[
                              { label: t('crm.automations.panel.edit'), onClick: () => { handleOpen(automation.id); setOpenMenuId(null); } },
                              { label: t('crm.automations.panel.actions.duplicate'), onClick: () => { void handleDuplicate(automation); setOpenMenuId(null); } },
                              {
                                label: automation.isActive
                                  ? t('crm.automations.panel.table.menuPause')
                                  : t('crm.automations.panel.table.menuActivate'),
                                onClick: () => {
                                  void handleToggle(automation);
                                  setOpenMenuId(null);
                                },
                              },
                              { label: t('crm.automations.panel.actions.sendNow'), onClick: () => { openRunModal(automation); setOpenMenuId(null); } },
                              { label: t('crm.automations.list.delete'), onClick: (e: React.MouseEvent) => { void handleDelete(automation.id, e); setOpenMenuId(null); }, danger: true },
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={item.onClick as any}
                                style={{
                                  fontFamily: FF_DISPLAY,
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '8px 14px',
                                  fontSize: 12,
                                  background: 'none',
                                  border: 'none',
                                  color: (item as any).danger ? '#dc2626' : INK,
                                  cursor: 'pointer',
                                  borderTop: `1px solid ${LINE3}`,
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = BG_MUTED; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── History tab ──────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div>
              {execLoading ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 12, color: FG4 }}>
                  {t('crm.automations.list.loading')}
                </div>
              ) : filteredExecutions.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: FG3 }}>
                  {t('crm.automations.panel.history.empty')}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  {/* Header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr 160px 90px 140px 1fr',
                    padding: '8px 20px',
                    borderBottom: `1px solid ${LINE3}`,
                    background: BG_MUTED,
                    minWidth: 720,
                  }}>
                    {[
                      t('crm.automations.panel.history.colTime'),
                      t('crm.automations.panel.history.colAutomation'),
                      t('crm.automations.panel.history.colTrigger'),
                      t('crm.automations.panel.history.colStatus'),
                      t('crm.automations.panel.history.colEntity'),
                      t('crm.automations.panel.history.colActions'),
                    ].map((h, i) => (
                      <div key={i} style={{ fontFamily: FF_MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG4, padding: '0 8px' }}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {filteredExecutions.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr 160px 90px 140px 1fr',
                        padding: '0 20px',
                        borderBottom: `1px solid ${LINE3}`,
                        minWidth: 720,
                        alignItems: 'center',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = BG_MUTED; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                    >
                      <div style={{ padding: '10px 8px', fontSize: 11, color: FG3, fontFamily: FF_MONO }}>
                        {new Date(row.createdAt).toLocaleString()}
                      </div>
                      <div style={{ padding: '10px 8px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpen(row.automationId)}
                          style={{ fontFamily: FF_DISPLAY, fontSize: 12, fontWeight: 500, color: INK, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                        >
                          {row.automation?.name || row.automationId.slice(0, 8)}
                        </button>
                      </div>
                      <div style={{ padding: '10px 8px', fontSize: 11, color: FG3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getTriggerLabel(row.triggerEvent, t)}
                      </div>
                      <div style={{ padding: '10px 8px' }}>
                        {row.status === 'success' && (
                          <span style={{ fontFamily: FF_MONO, fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>OK</span>
                        )}
                        {row.status === 'error' && (
                          <span style={{ fontFamily: FF_MONO, fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>ERR</span>
                        )}
                        {row.status === 'pending' && (
                          <span style={{ fontFamily: FF_MONO, fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fed7aa' }}>…</span>
                        )}
                        {row.status === 'skipped' && (
                          <span style={{ fontFamily: FF_MONO, fontSize: 10, padding: '2px 7px', borderRadius: 10, background: BG_SOFT, color: FG3, border: `1px solid ${LINE2}` }}>SKIP</span>
                        )}
                      </div>
                      <div style={{ padding: '10px 8px', fontSize: 11, color: FG3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.entityType ? `${row.entityType}${row.entityId ? ` · ${row.entityId.slice(0, 8)}…` : ''}` : '—'}
                      </div>
                      <div style={{ padding: '10px 8px', fontSize: 11, color: FG3 }}>
                        <div>{executionActionSummary(row, t)}</div>
                        {row.status === 'error' && row.errorMessage && (
                          <div style={{ marginTop: 2, fontSize: 10, color: '#dc2626', lineHeight: 1.3 }} title={row.errorMessage}>
                            {row.errorMessage.slice(0, 80)}{row.errorMessage.length > 80 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Usage tab ────────────────────────────────────────────────── */}
          {activeTab === 'usage' && (
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontFamily: FF_DISPLAY, fontSize: 14, fontWeight: 600, color: INK, margin: 0 }}>
                    {t('crm.automations.panel.usage.title')}
                  </h2>
                  <p style={{ fontSize: 12, color: FG3, margin: '4px 0 0', lineHeight: 1.5 }}>
                    {t('crm.automations.panel.usage.subtitle')}
                  </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: FG2 }}>
                  <span>{t('crm.automations.panel.usage.period')}</span>
                  <select
                    value={usageDays}
                    onChange={(e) => setUsageDays(Number(e.target.value))}
                    style={selectStyle}
                  >
                    <option value={7}>{t('crm.automations.panel.usage.dayOption', { count: 7 })}</option>
                    <option value={30}>{t('crm.automations.panel.usage.dayOption', { count: 30 })}</option>
                    <option value={90}>{t('crm.automations.panel.usage.dayOption', { count: 90 })}</option>
                  </select>
                </label>
              </div>

              {usageLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: FG4 }}>
                  {t('crm.automations.list.loading')}
                </div>
              ) : !usage || usage.executions.total === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 13, color: FG3 }}>
                  {t('crm.automations.panel.usage.empty')}
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: t('crm.automations.panel.usage.runsTotal'), value: usage.executions.total, accent: '' },
                      { label: t('crm.automations.panel.usage.runsSuccess'), value: usage.executions.success, accent: '#f0fdf4' },
                      { label: t('crm.automations.panel.usage.runsError'), value: usage.executions.error, accent: '#fef2f2' },
                      { label: t('crm.automations.panel.usage.automations'), value: `${usage.automations.total} / ${usage.automations.active}`, accent: '' },
                    ].map((card, i) => (
                      <div key={i} style={{ padding: '16px', borderRadius: 12, background: card.accent || BG_SOFT, border: `1px solid ${LINE2}` }}>
                        <div style={{ fontFamily: FF_MONO, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: FG3, marginBottom: 8 }}>
                          {card.label}
                        </div>
                        <div style={{ fontFamily: FF_DISPLAY, fontSize: 24, fontWeight: 700, color: INK }}>
                          {card.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ border: `1px solid ${LINE2}`, borderRadius: 12, padding: 16, background: '#fff' }}>
                      <h3 style={{ fontFamily: FF_DISPLAY, fontSize: 12, fontWeight: 600, color: INK, margin: '0 0 12px' }}>
                        {t('crm.automations.panel.usage.topTitle')}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {usage.topAutomations.map((row) => (
                          <div key={row.automationId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${LINE3}` }}>
                            <button
                              type="button"
                              onClick={() => handleOpen(row.automationId)}
                              style={{ fontFamily: FF_DISPLAY, fontSize: 12, fontWeight: 500, color: INK, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}
                            >
                              {row.name}
                            </button>
                            <span style={{ fontFamily: FF_MONO, fontSize: 11, color: FG3 }}>{row.runs}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ border: `1px solid ${LINE2}`, borderRadius: 12, padding: 16, background: '#fff' }}>
                      <h3 style={{ fontFamily: FF_DISPLAY, fontSize: 12, fontWeight: 600, color: INK, margin: '0 0 12px' }}>
                        {t('crm.automations.panel.usage.triggersTitle')}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {usage.byTrigger.map((row) => (
                          <div key={row.triggerEvent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${LINE3}` }}>
                            <span style={{ fontSize: 12, color: FG2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                              {getTriggerLabel(row.triggerEvent, t)}
                            </span>
                            <span style={{ fontFamily: FF_MONO, fontSize: 11, color: FG3 }}>{row.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Run modal ────────────────────────────────────────────────────── */}
      {runModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="run-automation-modal-title"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeRunModal(); }}
        >
          <div style={{ width: '100%', maxWidth: 440, borderRadius: 16, border: `1px solid ${LINE2}`, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden', fontFamily: FF_DISPLAY }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${LINE3}`, background: '#f8fbff' }}>
              <h2 id="run-automation-modal-title" style={{ fontSize: 14, fontWeight: 600, color: INK, margin: 0 }}>
                {t('crm.automations.panel.runModal.title')}
              </h2>
              <p style={{ fontSize: 11, color: FG3, margin: '4px 0 0' }}>{runModal.name}</p>
            </div>
            <div style={{ padding: '20px 24px', maxHeight: 'min(70vh, 520px)', overflowY: 'auto' }}>
              {runModalStep === 'ok' && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, color: '#15803d', marginBottom: 12 }}>
                  {t('crm.automations.panel.runModal.success')}
                </div>
              )}
              {runModalStep === 'form' && runModalErr && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
                  {runModalErr}
                </div>
              )}
              {runModalStep === 'form' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 11, color: FG3, margin: 0, lineHeight: 1.5 }}>
                    {t('crm.automations.panel.runModal.hint')}
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: FG2, marginBottom: 6 }}>
                      {t('crm.automations.panel.runModal.presetLabel')}
                    </label>
                    <select
                      value={runPreset}
                      onChange={(e) => setRunPreset(e.target.value as NonNullable<RunAutomationNowBody['rangePreset']>)}
                      style={{ ...selectStyle, width: '100%' }}
                    >
                      <option value="last_7_days">{t('crm.automations.panel.runModal.presets.last7')}</option>
                      <option value="last_30_days">{t('crm.automations.panel.runModal.presets.last30')}</option>
                      <option value="this_month">{t('crm.automations.panel.runModal.presets.thisMonth')}</option>
                      <option value="yesterday">{t('crm.automations.panel.runModal.presets.yesterday')}</option>
                      <option value="custom">{t('crm.automations.panel.runModal.presets.custom')}</option>
                    </select>
                  </div>
                  {runPreset === 'custom' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: FG3, marginBottom: 5 }}>{t('crm.automations.panel.runModal.dateFrom')}</label>
                        <input type="date" value={runDateFrom} onChange={(e) => setRunDateFrom(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: FG3, marginBottom: 5 }}>{t('crm.automations.panel.runModal.dateTo')}</label>
                        <input type="date" value={runDateTo} onChange={(e) => setRunDateTo(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                  {runPreset !== 'custom' && (
                    <p style={{ fontFamily: FF_MONO, fontSize: 10, color: FG4, margin: 0 }}>
                      {t('crm.automations.panel.runModal.rangePreview', { from: runDateFrom, to: runDateTo })}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${LINE3}`, background: BG_MUTED, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={closeRunModal}
                style={{ fontFamily: FF_DISPLAY, fontSize: 12, padding: '7px 16px', borderRadius: 8, border: `1px solid ${LINE2}`, background: '#fff', color: FG2, cursor: 'pointer' }}
              >
                {runModalStep === 'ok' ? t('crm.automations.panel.runModal.close') : t('crm.automations.panel.runModal.cancel')}
              </button>
              {runModalStep === 'form' && (
                <button
                  type="button"
                  disabled={Boolean(runSubmittingId)}
                  onClick={() => void submitRunModal()}
                  style={{ fontFamily: FF_DISPLAY, fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: INK, color: '#fff', cursor: 'pointer', opacity: runSubmittingId ? 0.5 : 1 }}
                >
                  {runSubmittingId ? t('crm.automations.panel.actions.sendNowRunning') : t('crm.automations.panel.runModal.submit')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
