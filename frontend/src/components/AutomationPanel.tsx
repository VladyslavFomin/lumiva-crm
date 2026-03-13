// src/components/AutomationPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchAutomations,
  createAutomation,
  updateAutomation,
  type Automation,
} from '../api/automations';
import { getActionLabel, getTriggerLabel } from '../pages/automations/automationLabels';

type EntityType = 'lead' | 'project' | 'sale';

const ENTITY_PREFIX: Record<EntityType, string> = {
  lead: 'lead.',
  project: 'project.',
  sale: 'sale.',
};

const ENTITY_TITLE_KEYS: Record<EntityType, string> = {
  lead: 'crm.automations.panel.titleLeads',
  project: 'crm.automations.panel.titleProjects',
  sale: 'crm.automations.panel.titleSales',
};

interface AutomationPanelProps {
  open: boolean;
  onClose: () => void;
  entityType: EntityType;
}

export const AutomationPanel: React.FC<AutomationPanelProps> = ({
  open,
  onClose,
  entityType,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'all',
  );
  const [activeTab, setActiveTab] = useState<
    'automations' | 'history' | 'integrations' | 'usage'
  >('automations');
  const [automations, setAutomations] = useState<Automation[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchAutomations()
      .then((items) => {
        if (!alive) return;
        setAutomations(items);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.automations.list.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, entityType, t]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setStatusFilter('all');
    setActiveTab('automations');
  }, [open, entityType]);

  const filtered = useMemo(() => {
    const prefix = ENTITY_PREFIX[entityType];
    const base = automations.filter((item) => item.triggerEvent.startsWith(prefix));
    const statusFiltered =
      statusFilter === 'all'
        ? base
        : base.filter((item) => (statusFilter === 'active' ? item.isActive : !item.isActive));
    const query = search.trim().toLowerCase();
    if (!query) return statusFiltered;
    return statusFiltered.filter((item) => {
      const hay = [
        item.name,
        item.description ?? '',
        getTriggerLabel(item.triggerEvent),
        ...item.actions.map((a) => getActionLabel(a.type)),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [automations, entityType, search]);

  const handleCreate = () => {
    navigate(`/app/automations/new?entity=${entityType}`);
    onClose();
  };

  const handleOpen = (id: string) => {
    navigate(`/app/automations/${id}`);
    onClose();
  };

  const handleToggle = async (automation: Automation) => {
    const next = !automation.isActive;
    setAutomations((prev) =>
      prev.map((item) => (item.id === automation.id ? { ...item, isActive: next } : item)),
    );
    try {
      await updateAutomation(automation.id, { isActive: next });
    } catch (e: any) {
      console.error(e);
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
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.automations.list.errors.loadFailed'));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-transparent backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-full sm:max-w-3xl bg-white text-slate-900 shadow-2xl">
        <div className="h-full overflow-y-auto">
          <div className="border-b border-slate-200">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                  {t('crm.automations.panel.kicker')}
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t(ENTITY_TITLE_KEYS[entityType])}
                </h2>
                <div className="text-[12px] text-slate-500">
                  {t('crm.automations.panel.subtitle')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="px-3 py-1.5 rounded-lg bg-lumiva-accent text-slate-950 text-xs font-semibold border border-lumiva-accent shadow-sm hover:bg-lumiva-accent-soft"
                >
                  {t('crm.automations.list.create')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 hover:text-slate-700"
                  aria-label={t('crm.common.close')}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="px-5 pb-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 flex items-center justify-between gap-3">
                <span>{t('crm.automations.panel.banner')}</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.location.href = '/app/automations';
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  {t('crm.automations.panel.bannerLink')}
                </button>
              </div>
            </div>
            <div className="px-5">
              <div className="flex flex-wrap gap-4 text-[12px] text-slate-500 border-b border-slate-200">
                {(['automations', 'history', 'integrations', 'usage'] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`pb-3 ${
                        activeTab === tab
                          ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
                          : 'hover:text-slate-700'
                      }`}
                    >
                      {t(`crm.automations.panel.tabs.${tab}`)}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('crm.automations.panel.searchPlaceholder')}
                  className="text-xs outline-none bg-transparent text-slate-700 w-56"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
              >
                <option value="all">{t('crm.automations.panel.filters.all')}</option>
                <option value="active">{t('crm.automations.panel.filters.active')}</option>
                <option value="inactive">
                  {t('crm.automations.panel.filters.inactive')}
                </option>
              </select>
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
            </div>

            {error && (
              <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            {loading && (
              <div className="text-xs text-slate-500">
                {t('crm.automations.list.loading')}
              </div>
            )}

            {!loading && activeTab !== 'automations' && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                {t('crm.automations.panel.comingSoon')}
              </div>
            )}

            {!loading && activeTab === 'automations' && filtered.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                {t('crm.automations.list.empty')}
              </div>
            )}

            {!loading && activeTab === 'automations' && filtered.length > 0 && (
              <div className="space-y-3">
                {filtered.map((automation) => (
                  <div
                    key={automation.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {automation.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] border ${
                              automation.isActive
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {automation.isActive
                              ? t('crm.automations.list.active')
                              : t('crm.automations.list.inactive')}
                          </span>
                        </div>
                        <div className="text-[12px] text-slate-500">
                          {getTriggerLabel(automation.triggerEvent)}
                        </div>
                        {automation.description && (
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            {automation.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(automation)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          {t('crm.automations.panel.actions.duplicate')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(automation)}
                          className={`text-xs ${
                            automation.isActive
                              ? 'text-slate-500 hover:text-slate-700'
                              : 'text-slate-300 cursor-default'
                          }`}
                          disabled={!automation.isActive}
                        >
                          {t('crm.automations.panel.actions.archive')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpen(automation.id)}
                          className="text-xs text-slate-600 hover:text-slate-900"
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

