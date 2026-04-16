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

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
      alert(err.message || t('crm.automations.list.errors.deleteFailed'));
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

  const toolbarPlaceholder =
    activeTab === 'history'
      ? t('crm.automations.panel.history.searchPlaceholder')
      : t('crm.automations.panel.searchPlaceholder');

  const searchValue =
    activeTab === 'history' ? execSearch : activeTab === 'automations' ? search : '';
  const setSearchValue =
    activeTab === 'history'
      ? setExecSearch
      : activeTab === 'automations'
        ? setSearch
        : () => {};

  return (
    <MainLayout>
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                {t('crm.automations.panel.kicker')}
              </div>
              <h1 className="text-lg font-semibold text-slate-900">
                {t('crm.automations.list.title')}
              </h1>
              <div className="text-[12px] text-slate-500">
                {t('crm.automations.list.subtitle')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreate}
                className="px-3 py-1.5 text-xs rounded-xl bg-[#222222] text-white font-semibold hover:bg-black transition-colors"
              >
                {t('crm.automations.list.create')}
              </button>
            </div>
          </div>
          <div className="mt-4 border-b border-slate-200">
            <div className="flex flex-wrap gap-4 text-[12px] text-slate-500">
              {(['automations', 'history', 'usage'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 ${
                    activeTab === tab
                      ? 'border-b-2 border-[#222222] text-slate-900 font-semibold'
                      : 'hover:text-slate-700'
                  }`}
                >
                  {t(`crm.automations.panel.tabs.${tab}`)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900">
                {t('crm.automations.panel.integrationsCallout.title')}
              </div>
              <p className="mt-1 text-[11px] text-slate-600 leading-relaxed max-w-2xl">
                {t('crm.automations.panel.integrationsCallout.body')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                to="/integrations-hub"
                className="inline-flex items-center justify-center rounded-full bg-[#222222] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-colors"
              >
                {t('crm.automations.panel.integrationsCallout.ctaHub')}
              </Link>
              <Link
                to="/integrations-hub?tab=connections"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
              >
                {t('crm.automations.panel.integrationsCallout.ctaConnections')}
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 space-y-4">
          {(activeTab === 'automations' || activeTab === 'history') && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-400"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={toolbarPlaceholder}
                  className="text-xs outline-none bg-transparent text-slate-700 w-56 min-w-[140px]"
                />
              </div>
              {activeTab === 'automations' && (
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
                >
                  <option value="">{t('crm.automations.panel.history.allStatuses')}</option>
                  <option value="success">{t('crm.automations.panel.history.statusSuccess')}</option>
                  <option value="error">{t('crm.automations.panel.history.statusError')}</option>
                  <option value="pending">{t('crm.automations.panel.history.statusPending')}</option>
                  <option value="skipped">{t('crm.automations.panel.history.statusSkipped')}</option>
                </select>
              )}
              {activeTab === 'automations' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 4h18" />
                    <path d="M7 12h10" />
                    <path d="M10 20h4" />
                  </svg>
                  {t('crm.automations.panel.filter')}
                </button>
              )}
            </div>
          )}

          {error && activeTab === 'automations' && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {activeTab === 'automations' && loading && (
            <div className="text-xs text-slate-500">{t('crm.automations.list.loading')}</div>
          )}

          {activeTab === 'automations' && !loading && !error && filtered.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              {t('crm.automations.list.empty')}
            </div>
          )}

          {activeTab === 'automations' && !loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((automation) => (
                <div
                  key={automation.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {automation.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] border ${
                            automation.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {automation.isActive
                            ? t('crm.automations.list.active')
                            : t('crm.automations.list.inactive')}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-600">
                        {getTriggerLabel(automation.triggerEvent, t)}
                      </div>
                      {automation.description && (
                        <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {automation.description}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
                        <span>
                          {t('crm.automations.panel.listMeta.runs')}:{' '}
                          <strong className="text-slate-800">{automation.executionCount}</strong>
                        </span>
                        {automation.errorCount > 0 && (
                          <span className="text-rose-600">
                            {t('crm.automations.panel.listMeta.errors')}:{' '}
                            <strong>{automation.errorCount}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDuplicate(automation)}
                        className="text-xs text-slate-600 hover:text-[#222222]"
                      >
                        {t('crm.automations.panel.actions.duplicate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openRunModal(automation)}
                        disabled={runSubmittingId === automation.id}
                        className={`text-xs font-medium ${
                          runSubmittingId === automation.id
                            ? 'text-slate-400 cursor-wait'
                            : 'text-sky-700 hover:text-sky-900 hover:underline'
                        }`}
                      >
                        {runSubmittingId === automation.id
                          ? t('crm.automations.panel.actions.sendNowRunning')
                          : t('crm.automations.panel.actions.sendNow')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(automation)}
                        className={`text-xs ${
                          automation.isActive
                            ? 'text-slate-600 hover:text-[#222222]'
                            : 'text-slate-300 cursor-default'
                        }`}
                        disabled={!automation.isActive}
                      >
                        {t('crm.automations.panel.actions.archive')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpen(automation.id)}
                        className="text-xs font-medium text-[#222222] hover:underline"
                      >
                        {t('crm.automations.panel.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(automation)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          automation.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        aria-pressed={automation.isActive}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            automation.isActive ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(automation.id, e)}
                        className="text-[11px] text-rose-600 hover:text-rose-700"
                      >
                        {t('crm.automations.list.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t('crm.automations.panel.history.title')}
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  {t('crm.automations.panel.history.subtitle')}
                </p>
              </div>
              {execLoading ? (
                <div className="text-xs text-slate-500">{t('crm.automations.list.loading')}</div>
              ) : filteredExecutions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500">
                  {t('crm.automations.panel.history.empty')}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-medium">
                          {t('crm.automations.panel.history.colTime')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('crm.automations.panel.history.colAutomation')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('crm.automations.panel.history.colTrigger')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('crm.automations.panel.history.colStatus')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('crm.automations.panel.history.colEntity')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('crm.automations.panel.history.colActions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExecutions.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleOpen(row.automationId)}
                              className="text-left font-medium text-[#222222] hover:underline truncate max-w-[200px] block"
                            >
                              {row.automation?.name || row.automationId.slice(0, 8)}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate">
                            {getTriggerLabel(row.triggerEvent, t)}
                          </td>
                          <td className="px-3 py-2">
                            {row.status === 'success' && (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
                                {t('crm.automations.panel.history.statusSuccess')}
                              </span>
                            )}
                            {row.status === 'error' && (
                              <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold">
                                {t('crm.automations.panel.history.statusError')}
                              </span>
                            )}
                            {row.status === 'pending' && (
                              <span className="inline-flex rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                                {t('crm.automations.panel.history.statusPending')}
                              </span>
                            )}
                            {row.status === 'skipped' && (
                              <span className="inline-flex rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold">
                                {t('crm.automations.panel.history.statusSkipped')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.entityType ? (
                              <span className="truncate max-w-[140px] block">
                                {row.entityType}
                                {row.entityId ? ` · ${row.entityId.slice(0, 8)}…` : ''}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            <div>{executionActionSummary(row, t)}</div>
                            {row.status === 'error' && row.errorMessage && (
                              <div
                                className="mt-1 text-[10px] text-rose-700 max-w-[280px] leading-snug"
                                title={row.errorMessage}
                              >
                                {t('crm.automations.panel.history.errorHint')}: {row.errorMessage}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {t('crm.automations.panel.usage.title')}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                    {t('crm.automations.panel.usage.subtitle')}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span>{t('crm.automations.panel.usage.period')}</span>
                  <select
                    value={usageDays}
                    onChange={(e) => setUsageDays(Number(e.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-2 py-1.5"
                  >
                    <option value={7}>7</option>
                    <option value={30}>30</option>
                    <option value={90}>90</option>
                  </select>
                </label>
              </div>
              {usageLoading ? (
                <div className="text-xs text-slate-500">{t('crm.automations.list.loading')}</div>
              ) : !usage || usage.executions.total === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500">
                  {t('crm.automations.panel.usage.empty')}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wide">
                        {t('crm.automations.panel.usage.runsTotal')}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {usage.executions.total}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                      <div className="text-[10px] uppercase text-emerald-800 font-semibold tracking-wide">
                        {t('crm.automations.panel.usage.runsSuccess')}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-emerald-900">
                        {usage.executions.success}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                      <div className="text-[10px] uppercase text-rose-800 font-semibold tracking-wide">
                        {t('crm.automations.panel.usage.runsError')}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-rose-900">
                        {usage.executions.error}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wide">
                        {t('crm.automations.panel.usage.automations')}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {usage.automations.total}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {t('crm.automations.panel.usage.activeAutomations')}:{' '}
                        <strong>{usage.automations.active}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h3 className="text-xs font-semibold text-slate-800 mb-3">
                        {t('crm.automations.panel.usage.topTitle')}
                      </h3>
                      <ul className="space-y-2 text-xs">
                        {usage.topAutomations.map((row) => (
                          <li
                            key={row.automationId}
                            className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0"
                          >
                            <button
                              type="button"
                              onClick={() => handleOpen(row.automationId)}
                              className="text-left font-medium text-[#222222] hover:underline truncate"
                            >
                              {row.name}
                            </button>
                            <span className="shrink-0 text-slate-600 tabular-nums">{row.runs}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h3 className="text-xs font-semibold text-slate-800 mb-3">
                        {t('crm.automations.panel.usage.triggersTitle')}
                      </h3>
                      <ul className="space-y-2 text-xs">
                        {usage.byTrigger.map((row) => (
                          <li
                            key={row.triggerEvent}
                            className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0"
                          >
                            <span className="text-slate-700 truncate">
                              {getTriggerLabel(row.triggerEvent, t)}
                            </span>
                            <span className="shrink-0 text-slate-600 tabular-nums">{row.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {runModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="run-automation-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeRunModal();
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-br from-sky-50/80 to-white">
              <h2 id="run-automation-modal-title" className="text-base font-semibold text-slate-900">
                {t('crm.automations.panel.runModal.title')}
              </h2>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{runModal.name}</p>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[min(70vh,520px)] overflow-y-auto">
              {runModalStep === 'ok' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
                  {t('crm.automations.panel.runModal.success')}
                </div>
              )}
              {runModalStep === 'form' && runModalErr && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-950">
                  {runModalErr}
                </div>
              )}
              {runModalStep === 'form' && (
                <>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {t('crm.automations.panel.runModal.hint')}
                  </p>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-medium text-slate-600">
                      {t('crm.automations.panel.runModal.presetLabel')}
                    </label>
                    <select
                      value={runPreset}
                      onChange={(e) =>
                        setRunPreset(e.target.value as NonNullable<RunAutomationNowBody['rangePreset']>)
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                    >
                      <option value="last_7_days">{t('crm.automations.panel.runModal.presets.last7')}</option>
                      <option value="last_30_days">
                        {t('crm.automations.panel.runModal.presets.last30')}
                      </option>
                      <option value="this_month">{t('crm.automations.panel.runModal.presets.thisMonth')}</option>
                      <option value="yesterday">{t('crm.automations.panel.runModal.presets.yesterday')}</option>
                      <option value="custom">{t('crm.automations.panel.runModal.presets.custom')}</option>
                    </select>
                  </div>
                  {runPreset === 'custom' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">{t('crm.automations.panel.runModal.dateFrom')}</label>
                        <input
                          type="date"
                          value={runDateFrom}
                          onChange={(e) => setRunDateFrom(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">{t('crm.automations.panel.runModal.dateTo')}</label>
                        <input
                          type="date"
                          value={runDateTo}
                          onChange={(e) => setRunDateTo(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                  {runPreset !== 'custom' && (
                    <p className="text-[10px] text-slate-500">
                      {t('crm.automations.panel.runModal.rangePreview', { from: runDateFrom, to: runDateTo })}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeRunModal}
                className="px-4 py-2 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-white"
              >
                {runModalStep === 'ok'
                  ? t('crm.automations.panel.runModal.close')
                  : t('crm.automations.panel.runModal.cancel')}
              </button>
              {runModalStep === 'form' && (
                <button
                  type="button"
                  disabled={Boolean(runSubmittingId)}
                  onClick={() => void submitRunModal()}
                  className="px-4 py-2 text-xs rounded-xl bg-[#222222] text-white font-semibold hover:bg-black disabled:opacity-50"
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
