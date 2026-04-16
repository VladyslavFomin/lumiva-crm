import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchIntegration,
  fetchIntegrations,
  fetchIntegrationHubCatalog,
  startGoogleCalendarOAuth,
  syncIntegration,
  testIntegration,
  updateIntegration,
  type IntegrationConnectionDto,
  type IntegrationHubCatalogEntry,
  type IntegrationHubCrmModule,
} from '../../api/integrations';
import {
  fetchMarketingIntegrations,
  type MarketingIntegrationRow,
} from '../../api/marketing';
import { IntegrationBrandIcon } from '../automations/IntegrationBrandIcon';
import { integrationCatalogName } from '../automations/integrationsCatalog';
import { IntegrationConnectionCard } from '../../components/integrations/IntegrationConnectionCard';
import { IntegrationConnectionTestSyncActions } from '../../components/integrations/IntegrationConnectionTestSyncActions';
import { MarketingIntegrationSetupModal } from '../../components/integrations/MarketingIntegrationSetupModal';
import { Ga4MarketingQuickConnectModal } from '../../components/integrations/Ga4MarketingQuickConnectModal';
import { WooCommerceHubSheet } from '../../components/integrations/WooCommerceHubSheet';
import {
  IntegrationThirdPartyConnectModal,
  isHubThirdPartyConnectCatalogId,
} from '../../components/integrations/IntegrationThirdPartyConnectModal';
import { GoogleSheetsConnectionSettingsModal } from '../../components/integrations/GoogleSheetsConnectionSettingsModal';
import {
  MarketingIntegrationsPanel,
  type MarketingIntegrationProviderKey,
} from '../marketing/MarketingIntegrationsPanel';

type HubTab = 'catalog' | 'connections' | 'marketing';

type ModuleFilterChip = 'all' | IntegrationHubCrmModule;

const CATALOG_CATEGORY_ORDER: IntegrationHubCrmModule[] = [
  'sales',
  'marketing',
  'leads',
  'projects',
  'workspace',
  'calendar',
  'automations',
];

/** Фильтр каталога по модулю CRM без «marketing» — отдельная вкладка «Реклама и счётчики». */
const CATALOG_MODULE_FILTER_ORDER = CATALOG_CATEGORY_ORDER.filter((m) => m !== 'marketing');

function primaryCatalogCategory(entry: IntegrationHubCatalogEntry): IntegrationHubCrmModule {
  const m = new Set(entry.modules);
  for (const c of CATALOG_CATEGORY_ORDER) {
    if (m.has(c)) return c;
  }
  return 'automations';
}

const MARKETING_HUB_CATALOG: Partial<Record<string, MarketingIntegrationProviderKey>> = {
  google_ads: 'google_ads',
  meta_ads: 'meta_ads',
  google_analytics: 'google_analytics',
  yandex_metrika: 'yandex_metrika',
};

function marketingProviderForCatalog(id: string): MarketingIntegrationProviderKey | null {
  return MARKETING_HUB_CATALOG[id] ?? null;
}

function marketingRowsForCatalog(id: string, rows: MarketingIntegrationRow[]): number {
  const p = marketingProviderForCatalog(id);
  if (!p) return 0;
  return rows.filter((r) => r.provider === p).length;
}

function lifecycleBadgeClass(lifecycle: IntegrationHubCatalogEntry['lifecycle']): string {
  switch (lifecycle) {
    case 'live':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200';
    case 'beta':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'planned':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-amber-50 text-amber-900 border-amber-200';
  }
}

function connectionMatchesCatalogId(c: IntegrationConnectionDto, catalogId: string): boolean {
  if (catalogId === 'woocommerce') return c.kind === 'woocommerce';
  return c.kind === 'third_party_link' && c.linkCatalogId === catalogId;
}

function isHubCatalogConnection(
  c: IntegrationConnectionDto,
  catalogIds: Set<string>,
): boolean {
  if (c.kind === 'woocommerce') return catalogIds.has('woocommerce');
  return Boolean(
    c.kind === 'third_party_link' && c.linkCatalogId && catalogIds.has(c.linkCatalogId),
  );
}

/** WordPress + Lumiva Wizard: на вкладке «Подключения» всегда показываем блок с возможностью добавить сайт. */
const WP_LUMIVA_CATALOG_IDS = [
  'wordpress_cf7',
  'lumiva_client_cabinet',
  'lumiva_online_chat',
] as const;

function hubWpCatalogHidesSync(
  catalogId: string | null | undefined,
): boolean {
  return catalogId === 'lumiva_client_cabinet' || catalogId === 'lumiva_online_chat';
}

export const IntegrationsHubPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [googleSheetsSettingsId, setGoogleSheetsSettingsId] = useState<string | null>(null);
  const rawTab = searchParams.get('tab') || '';
  const rawModule = searchParams.get('module') || '';
  const moduleFilter: ModuleFilterChip =
    rawModule &&
    rawModule !== 'marketing' &&
    (CATALOG_MODULE_FILTER_ORDER as readonly string[]).includes(rawModule)
      ? (rawModule as IntegrationHubCrmModule)
      : 'all';

  const activeTab: HubTab =
    rawTab === 'marketing'
      ? 'marketing'
      : rawTab === 'connections'
        ? 'connections'
        : 'catalog';

  const setTab = (tab: HubTab) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (tab === 'catalog') {
        n.delete('tab');
      } else {
        n.set('tab', tab);
      }
      return n;
    }, { replace: true });
  };

  const [wooSheetOpen, setWooSheetOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('module') !== 'marketing') return;
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete('module');
      return n;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (rawTab === 'store') {
      setWooSheetOpen(true);
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.delete('tab');
        return n;
      }, { replace: true });
    }
  }, [rawTab, setSearchParams]);

  useEffect(() => {
    if (searchParams.get('woo') === '1') {
      setWooSheetOpen(true);
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.delete('woo');
        return n;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [catalog, setCatalog] = useState<IntegrationHubCatalogEntry[]>([]);
  const [connections, setConnections] = useState<IntegrationConnectionDto[]>([]);
  const [marketingRows, setMarketingRows] = useState<MarketingIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [googleCalendarOAuthBusyId, setGoogleCalendarOAuthBusyId] = useState<
    string | null
  >(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [marketingModal, setMarketingModal] = useState<{
    catalogId: string;
    provider: MarketingIntegrationProviderKey;
  } | null>(null);
  const [connectCatalogId, setConnectCatalogId] = useState<string | null>(null);
  const [ga4QuickConnectOpen, setGa4QuickConnectOpen] = useState(false);
  const [marketingPanelRefreshSignal, setMarketingPanelRefreshSignal] = useState(0);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    const quiet = Boolean(opts?.quiet);
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const [cat, conn, mkt] = await Promise.all([
        fetchIntegrationHubCatalog(),
        fetchIntegrations(),
        fetchMarketingIntegrations().catch(() => [] as MarketingIntegrationRow[]),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
      setConnections(Array.isArray(conn) ? conn : []);
      setMarketingRows(Array.isArray(mkt) ? mkt : []);
    } catch (e) {
      if (!quiet) {
        setError((e as Error)?.message || t('crm.integrationsHub.loadError'));
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ads = searchParams.get('googleAdsOAuth');
    const ga4 = searchParams.get('ga4OAuth');
    const gcal = searchParams.get('googleCalendarOAuth');
    if (!ads && !ga4 && !gcal) return;
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (ads) n.delete('googleAdsOAuth');
        if (ga4) n.delete('ga4OAuth');
        if (gcal) n.delete('googleCalendarOAuth');
        return n;
      },
      { replace: true },
    );
    const pushMsg = (key: string) =>
      setActionMsg((prev) => (prev ? `${prev}\n${t(key)}` : t(key)));
    let refresh = false;
    if (ads === 'connected') {
      pushMsg('crm.marketingIntegrations.oauth.callback.connected');
      refresh = true;
    } else if (ads === 'error') {
      pushMsg('crm.marketingIntegrations.oauth.callback.error');
    }
    if (ga4 === 'connected') {
      pushMsg('crm.marketingIntegrations.ga4.oauth.callback.connected');
      refresh = true;
    } else if (ga4 === 'error') {
      pushMsg('crm.marketingIntegrations.ga4.oauth.callback.error');
    }
    if (gcal === 'connected') {
      pushMsg('crm.integrationsHub.googleCalendar.oauthCallback.connected');
      refresh = true;
    } else if (gcal === 'error') {
      pushMsg('crm.integrationsHub.googleCalendar.oauthCallback.error');
    }
    if (refresh) {
      setMarketingPanelRefreshSignal((x) => x + 1);
      void load({ quiet: true });
    }
  }, [searchParams, setSearchParams, load, t]);

  const catalogIds = useMemo(() => new Set(catalog.map((e) => e.id)), [catalog]);

  const hubConnections = useMemo(
    () => connections.filter((c) => isHubCatalogConnection(c, catalogIds)),
    [connections, catalogIds],
  );

  const otherConnections = useMemo(
    () => connections.filter((c) => !hubConnections.some((h) => h.id === c.id)),
    [connections, hubConnections],
  );

  const hubWpByCatalog = useMemo(() => {
    const m = new Map<string, IntegrationConnectionDto[]>();
    for (const id of WP_LUMIVA_CATALOG_IDS) {
      m.set(id, []);
    }
    for (const c of hubConnections) {
      if (c.kind !== 'third_party_link' || !c.linkCatalogId) continue;
      if (!m.has(c.linkCatalogId)) continue;
      m.get(c.linkCatalogId)!.push(c);
    }
    return m;
  }, [hubConnections]);

  const hubRestConnections = useMemo(
    () =>
      hubConnections.filter((c) => {
        if (c.kind === 'third_party_link' && c.linkCatalogId) {
          return !(WP_LUMIVA_CATALOG_IDS as readonly string[]).includes(c.linkCatalogId);
        }
        return true;
      }),
    [hubConnections],
  );

  const countForCatalogId = useCallback(
    (id: string) => connections.filter((c) => connectionMatchesCatalogId(c, id)).length,
    [connections],
  );

  const capabilityChips = useCallback(
    (caps: IntegrationHubCatalogEntry['capabilities']) => {
      const items: { key: string; on: boolean }[] = [
        { key: 'outboundAutomation', on: caps.outboundAutomationActions },
        { key: 'salesImport', on: caps.salesImport },
        { key: 'workspaceSync', on: caps.workspaceTableSync },
        { key: 'calendar', on: caps.calendarSync },
        { key: 'leadCapture', on: caps.leadCapture },
      ];
      return items.filter((x) => x.on);
    },
    [],
  );

  const handleTest = async (id: string) => {
    setTestingId(id);
    setActionMsg(null);
    try {
      const r = await testIntegration(id);
      setActionMsg(
        r.ok ? r.message || 'OK' : r.message || t('crm.integrationsHub.testFailed'),
      );
    } catch (e) {
      setActionMsg((e as Error).message);
    } finally {
      setTestingId(null);
    }
  };

  const handleGoogleCalendarReconnect = useCallback(
    async (connectionId: string) => {
      setActionMsg(null);
      setGoogleCalendarOAuthBusyId(connectionId);
      try {
        const { url } = await startGoogleCalendarOAuth({
          intent: 'reconnect',
          integrationId: connectionId,
          redirectPath: '/integrations-hub?tab=connections',
        });
        window.location.assign(url);
      } catch (e: unknown) {
        setGoogleCalendarOAuthBusyId(null);
        setActionMsg((e as Error)?.message || t('crm.integrationsHub.googleCalendar.oauthStartError'));
      }
    },
    [t],
  );

  const handleSync = async (id: string) => {
    setSyncingId(id);
    setActionMsg(null);
    try {
      const r = await syncIntegration(id);
      const c = r.created ?? 0;
      const u = r.updated ?? 0;
      const tail =
        c > 0 || u > 0 ? ` (+${c}/${u})` : '';
      setActionMsg(
        (r.message ||
          (r.ok ? t('crm.integrationsHub.syncOk') : t('crm.integrationsHub.syncFail'))) + tail,
      );
      await load();
    } catch (e) {
      setActionMsg((e as Error).message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggleIntegrationEnabled = async (c: IntegrationConnectionDto) => {
    setTogglingId(c.id);
    setActionMsg(null);
    try {
      await updateIntegration(c.id, { isEnabled: !c.isEnabled });
      await load({ quiet: true });
      setActionMsg(t('crm.integrationsHub.toggleSaved'));
    } catch (e) {
      setActionMsg((e as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  const fetchCf7PasteUrl = useCallback(async (connectionId: string) => {
    try {
      const row = await fetchIntegration(connectionId);
      return row.siteFormInboundWebhookPasteUrl || row.siteFormInboundWebhookUrl || null;
    } catch {
      return null;
    }
  }, []);

  const sortedCatalog = useMemo(() => {
    const order: Record<IntegrationHubCatalogEntry['lifecycle'], number> = {
      live: 0,
      beta: 1,
      planned: 2,
      in_development: 3,
    };
    return [...catalog].sort((a, b) => {
      const d = order[a.lifecycle] - order[b.lifecycle];
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
  }, [catalog]);

  const catalogFilteredByModule = useMemo(() => {
    if (moduleFilter === 'all') return sortedCatalog;
    return sortedCatalog.filter((e) => e.modules.includes(moduleFilter));
  }, [sortedCatalog, moduleFilter]);

  const catalogByCategory = useMemo(() => {
    const buckets = new Map<IntegrationHubCrmModule, IntegrationHubCatalogEntry[]>();
    for (const c of CATALOG_CATEGORY_ORDER) buckets.set(c, []);
    for (const e of catalogFilteredByModule) {
      const k = primaryCatalogCategory(e);
      buckets.get(k)!.push(e);
    }
    return CATALOG_CATEGORY_ORDER.filter((k) => (buckets.get(k) ?? []).length > 0).map((k) => ({
      key: k,
      entries: buckets.get(k) as IntegrationHubCatalogEntry[],
    }));
  }, [catalogFilteredByModule]);

  const MODULE_FILTER_CHIPS: ModuleFilterChip[] = ['all', ...CATALOG_MODULE_FILTER_ORDER];

  const hubChip = (on: boolean, size: 'nav' | 'filter') => {
    const pad = size === 'nav' ? 'px-4 py-2 text-xs' : 'px-3 py-1.5 text-[10px]';
    return `${pad} rounded-full font-semibold transition-all duration-200 active:scale-[0.98] ${
      on
        ? 'bg-[#222222] text-white shadow-md shadow-slate-900/15'
        : 'border border-slate-200/90 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50/90 hover:shadow-md'
    }`;
  };

  const setCatalogModule = (m: ModuleFilterChip) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete('tab');
      if (m === 'all') n.delete('module');
      else n.set('module', m);
      return n;
    }, { replace: true });
  };

  const catalogCardHover =
    'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/[0.06]';

  const renderCatalogEntry = (entry: IntegrationHubCatalogEntry) => {
    const marketingProvider = marketingProviderForCatalog(entry.id);
    const connN = countForCatalogId(entry.id);
    const n = marketingProvider ? marketingRowsForCatalog(entry.id, marketingRows) : connN;
    const caps = capabilityChips(entry.capabilities);
    const showThirdPartyConnect =
      entry.id !== 'woocommerce' &&
      !marketingProvider &&
      isHubThirdPartyConnectCatalogId(entry.id);
    return (
      <div key={entry.id} className={catalogCardHover}>
        <div className="flex items-start gap-3">
          <IntegrationBrandIcon
            catalogId={entry.id}
            label={integrationCatalogName(entry.id, t)}
            size={44}
            className="mt-0.5 ring-1 ring-black/[0.04]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 truncate">
                {integrationCatalogName(entry.id, t)}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide rounded-full border px-2 py-0.5 shrink-0 ${lifecycleBadgeClass(entry.lifecycle)}`}
              >
                {t(`crm.integrationsHub.lifecycle.${entry.lifecycle}`)}
              </span>
              {n > 0 ? (
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  {t('crm.integrationsHub.connectedCount', { count: n })}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-[10px] text-slate-500 font-medium uppercase tracking-wide">
              {t('crm.integrationsHub.modulesLabel')}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.modules.map((m) => (
                <span
                  key={m}
                  className="rounded-md bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px]"
                >
                  {t(`crm.integrationsHub.module.${m}`)}
                </span>
              ))}
            </div>
            {caps.length > 0 ? (
              <>
                <div className="mt-2 text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                  {t('crm.integrationsHub.capabilitiesLabel')}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {caps.map(({ key }) => (
                    <span
                      key={key}
                      className="rounded-md border border-slate-200 text-slate-700 px-2 py-0.5 text-[10px]"
                    >
                      {t(`crm.integrationsHub.cap.${key}`)}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            {entry.id === 'woocommerce' ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setWooSheetOpen(true)}
                  className="rounded-full bg-[#222222] px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-black hover:shadow-md active:scale-[0.98]"
                >
                  {t('crm.integrationsHub.wooOpenSheet')}
                </button>
              </div>
            ) : null}
            {marketingProvider ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (marketingProvider === 'google_analytics' && n === 0) {
                      setGa4QuickConnectOpen(true);
                    } else {
                      setMarketingModal({
                        catalogId: entry.id,
                        provider: marketingProvider,
                      });
                    }
                  }}
                  className="rounded-full bg-[#222222] px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-black hover:shadow-md active:scale-[0.98]"
                >
                  {n > 0
                    ? t('crm.integrationsHub.marketingSetup')
                    : t('crm.integrationsHub.connectCatalog')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarketingModal(null);
                    setTab('marketing');
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                >
                  {t('crm.integrationsHub.marketingOpenTab')}
                </button>
              </div>
            ) : null}
            {showThirdPartyConnect ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setConnectCatalogId(entry.id)}
                  className="rounded-full bg-[#222222] px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-black hover:shadow-md active:scale-[0.98]"
                >
                  {t('crm.integrationsHub.connectCatalog')}
                </button>
                {connN > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab('connections')}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                  >
                    {t('crm.integrationsHub.viewConnectionsCount', { count: connN })}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {t('crm.integrationsHub.title')}
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              {t('crm.integrationsHub.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-full border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {t('crm.integrationsHub.refresh')}
            </button>
            <Link
              to="/automations"
              className="inline-flex items-center justify-center rounded-full border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md active:scale-[0.98]"
            >
              {t('crm.integrationsHub.openAutomationsScenarios')}
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('catalog')}
              className={hubChip(activeTab === 'catalog', 'nav')}
            >
              {t('crm.integrationsHub.tabs.catalog')}
            </button>
            <button
              type="button"
              onClick={() => setTab('connections')}
              className={hubChip(activeTab === 'connections', 'nav')}
            >
              {t('crm.integrationsHub.tabs.connections')}
            </button>
            <button
              type="button"
              onClick={() => setTab('marketing')}
              className={hubChip(activeTab === 'marketing', 'nav')}
            >
              {t('crm.integrationsHub.navMarketingIntegrationTab')}
            </button>
            <span
              className="hidden h-6 w-px shrink-0 bg-slate-200 sm:block"
              aria-hidden
            />
            {MODULE_FILTER_CHIPS.map((m) => {
              const on = activeTab === 'catalog' && moduleFilter === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCatalogModule(m)}
                  className={hubChip(on, 'filter')}
                >
                  {m === 'all'
                    ? t('crm.integrationsHub.catalogFilterAll')
                    : t(`crm.integrationsHub.module.${m}`)}
                </button>
              );
            })}
          </div>
        </div>

        {actionMsg && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
            {actionMsg}
          </div>
        )}

        {loading && (
          <p className="text-xs text-slate-500">{t('crm.automations.list.loading')}</p>
        )}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </div>
        )}

        {!loading && !error && activeTab === 'catalog' && (
          <section className="space-y-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {t('crm.integrationsHub.catalogHeading')}
              </h2>
              <p className="text-[10px] text-slate-500 max-w-xl leading-snug sm:text-right">
                {t('crm.integrationsHub.openAutomationsIntegrationsHint')}
              </p>
            </div>
            {catalogByCategory.length === 0 ? (
              <p className="text-sm text-slate-500">{t('crm.integrationsHub.catalogEmptyFilter')}</p>
            ) : (
              catalogByCategory.map(({ key: catKey, entries }) => (
                <div key={catKey} className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    {t(`crm.integrationsHub.catalogCategory.${catKey}`)}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {entries.map((entry) => renderCatalogEntry(entry))}
                  </div>
                </div>
              ))
            )}
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('crm.integrationsHub.wooChannelsHint')}{' '}
              <Link
                to="/app/sales/channels"
                className="font-semibold text-[#222222] underline decoration-slate-300 underline-offset-2 hover:decoration-[#222222]"
              >
                {t('crm.integrationsHub.wooChannelsLink')}
              </Link>
            </p>
          </section>
        )}

        {!loading && !error && activeTab === 'connections' && (
          <section className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {t('crm.integrationsHub.connectionsHeading')}
              </h2>
              {connections.length === 0 ? (
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  {t('crm.integrationsHub.connectionsEmpty')}
                </p>
              ) : null}
            </div>

            <div className="max-w-4xl space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                  {t('crm.integrationsHub.wpLumivaSectionTitle')}
                </h3>
                <details className="mt-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
                  <summary className="cursor-pointer select-none font-semibold text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                    <span className="underline decoration-slate-300 underline-offset-2">
                      {t('crm.integrationsHub.wpLumivaSectionHintsSummary')}
                    </span>
                  </summary>
                  <p className="mt-2 leading-relaxed pl-0.5">
                    {t('crm.integrationsHub.wpLumivaSectionSubtitle')}
                  </p>
                </details>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {WP_LUMIVA_CATALOG_IDS.map((catId) => {
                  const rows = hubWpByCatalog.get(catId) ?? [];
                  return (
                    <div
                      key={catId}
                      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
                    >
                      <div className="space-y-2 border-b border-slate-200/90 bg-slate-50/95 px-3 py-3 sm:px-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                            <IntegrationBrandIcon
                              catalogId={catId}
                              label={integrationCatalogName(catId, t)}
                              size={36}
                              className="shrink-0 ring-1 ring-black/[0.04]"
                            />
                            <div className="min-w-0 text-sm font-semibold text-slate-900 leading-tight">
                              {integrationCatalogName(catId, t)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setConnectCatalogId(catId)}
                            className="shrink-0 rounded-full bg-[#222222] px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-black hover:shadow-md active:scale-[0.98] sm:px-4 sm:py-2 sm:text-[11px]"
                          >
                            {t('crm.integrationsHub.wpLumivaConnectNew')}
                          </button>
                        </div>
                        <details className="rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[10px] text-slate-600">
                          <summary className="cursor-pointer select-none font-semibold text-slate-800 list-none [&::-webkit-details-marker]:hidden">
                            <span className="underline decoration-slate-300 underline-offset-2">
                              {t('crm.integrationsHub.wpLumivaCatalogHintsSummary')}
                            </span>
                          </summary>
                          <p className="mt-1.5 leading-snug">
                            {t(`crm.integrationsHub.wpLumivaCatalogHint.${catId}`)}
                          </p>
                        </details>
                      </div>
                      <div className="p-2.5 sm:p-3">
                        {rows.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2.5">
                            {rows.map((c) => (
                              <IntegrationConnectionCard
                                key={c.id}
                                cardClassName="w-full min-w-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300/90"
                                connection={c}
                                t={t}
                                fetchCf7PasteUrl={fetchCf7PasteUrl}
                                connectorSubtitle={false}
                                lastSyncVariant="hub"
                                showLastSyncStatus
                                footer={
                                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                    <button
                                      type="button"
                                      disabled={togglingId === c.id}
                                      onClick={() => void handleToggleIntegrationEnabled(c)}
                                      className={
                                        'rounded-full border px-3 py-1.5 text-[10px] font-semibold transition disabled:opacity-50 ' +
                                        (c.isEnabled
                                          ? 'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100')
                                      }
                                    >
                                      {togglingId === c.id
                                        ? t('crm.integrationsHub.toggleBusy')
                                        : c.isEnabled
                                          ? t('crm.integrationsHub.connectionTurnOff')
                                          : t('crm.integrationsHub.connectionTurnOn')}
                                    </button>
                                    <IntegrationConnectionTestSyncActions
                                      connectionId={c.id}
                                      testingId={testingId}
                                      syncingId={syncingId}
                                      onTest={handleTest}
                                      onSync={handleSync}
                                      t={t}
                                      showSync={!hubWpCatalogHidesSync(c.linkCatalogId)}
                                    />
                                  </div>
                                }
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">
                            {t('crm.integrationsHub.wpLumivaEmptyRow')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {hubRestConnections.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                  {t('crm.integrationsHub.otherHubConnectionsHeading')}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {hubRestConnections.map((c) => (
                    <IntegrationConnectionCard
                      key={c.id}
                      cardClassName="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300/90"
                      connection={c}
                      t={t}
                      fetchCf7PasteUrl={fetchCf7PasteUrl}
                      connectorSubtitle={
                        c.kind === 'woocommerce' ||
                        (c.kind === 'third_party_link' && c.linkCatalogId)
                          ? 'plainCatalog'
                          : false
                      }
                      lastSyncVariant="hub"
                      showLastSyncStatus
                      footer={
                        <div className="space-y-2">
                          {c.linkCatalogId === 'google_calendar' && (
                            <button
                              type="button"
                              disabled={
                                googleCalendarOAuthBusyId === c.id ||
                                testingId === c.id ||
                                syncingId === c.id
                              }
                              onClick={() => void handleGoogleCalendarReconnect(c.id)}
                              className="w-full rounded-full border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {googleCalendarOAuthBusyId === c.id
                                ? t('crm.integrationsHub.googleCalendar.oauthBusy')
                                : t('crm.integrationsHub.googleCalendar.reconnectGoogle')}
                            </button>
                          )}
                          {c.linkCatalogId === 'google_sheets' && (
                            <button
                              type="button"
                              onClick={() => setGoogleSheetsSettingsId(c.id)}
                              className="w-full rounded-full border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              {t('crm.integrationsHub.googleSheetsImportSettings')}
                            </button>
                          )}
                          <IntegrationConnectionTestSyncActions
                            connectionId={c.id}
                            testingId={testingId}
                            syncingId={syncingId}
                            onTest={handleTest}
                            onSync={handleSync}
                            t={t}
                          />
                          <Link
                            to="/app/sales/integrations"
                            className="inline-block text-[10px] font-semibold text-[#222222] underline decoration-slate-300 underline-offset-2 hover:decoration-[#222222]"
                          >
                            {t('crm.integrationsHub.editConnectionKeys')}
                          </Link>
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {otherConnections.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-600 mb-2">
                  {t('crm.integrationsHub.otherConnectionsHeading')}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {otherConnections.map((c) => (
                    <IntegrationConnectionCard
                      key={c.id}
                      cardClassName="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300/80"
                      connection={c}
                      t={t}
                      fetchCf7PasteUrl={fetchCf7PasteUrl}
                      surfaceTone="whiteDashed"
                      connectorSubtitle={false}
                      metaLine={
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {t('crm.integrationsHub.kind')}: {c.kind}
                          {c.linkCatalogId ? ` · ${c.linkCatalogId}` : ''}
                        </div>
                      }
                      lastSyncVariant="hub"
                      showLastSyncStatus
                      showSalesIntegrationsLink={
                        c.kind === 'woocommerce' || c.kind === 'manual-import'
                      }
                      footer={
                        <div className="space-y-2">
                          {c.linkCatalogId === 'google_calendar' && (
                            <button
                              type="button"
                              disabled={
                                googleCalendarOAuthBusyId === c.id ||
                                testingId === c.id ||
                                syncingId === c.id
                              }
                              onClick={() => void handleGoogleCalendarReconnect(c.id)}
                              className="w-full rounded-full border border-slate-300 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {googleCalendarOAuthBusyId === c.id
                                ? t('crm.integrationsHub.googleCalendar.oauthBusy')
                                : t('crm.integrationsHub.googleCalendar.reconnectGoogle')}
                            </button>
                          )}
                          <IntegrationConnectionTestSyncActions
                            connectionId={c.id}
                            testingId={testingId}
                            syncingId={syncingId}
                            onTest={handleTest}
                            onSync={handleSync}
                            t={t}
                          />
                          <Link
                            to="/app/sales/integrations"
                            className="inline-block text-[10px] font-semibold text-[#222222] underline decoration-slate-300 underline-offset-2 hover:decoration-[#222222]"
                          >
                            {t('crm.integrationsHub.editConnectionKeys')}
                          </Link>
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {!loading && !error && activeTab === 'marketing' && (
          <MarketingIntegrationsPanel
            variant="embedded"
            listRefreshSignal={marketingPanelRefreshSignal}
            onMarketingDataChanged={() => void load({ quiet: true })}
          />
        )}
      </div>

      <WooCommerceHubSheet
        open={wooSheetOpen}
        onClose={() => setWooSheetOpen(false)}
        onCreated={() => void load({ quiet: true })}
      />

      {marketingModal ? (
        <MarketingIntegrationSetupModal
          open
          catalogId={marketingModal.catalogId}
          provider={marketingModal.provider}
          onClose={() => setMarketingModal(null)}
          onDataChanged={() => void load({ quiet: true })}
        />
      ) : null}

      <Ga4MarketingQuickConnectModal
        open={ga4QuickConnectOpen}
        onClose={() => setGa4QuickConnectOpen(false)}
      />

      <IntegrationThirdPartyConnectModal
        open={Boolean(connectCatalogId)}
        catalogId={connectCatalogId ?? ''}
        onClose={() => setConnectCatalogId(null)}
        onCreated={() => void load({ quiet: true })}
      />

      {googleSheetsSettingsId ? (
        <GoogleSheetsConnectionSettingsModal
          open
          connectionId={googleSheetsSettingsId}
          onClose={() => setGoogleSheetsSettingsId(null)}
          onSaved={() => void load({ quiet: true })}
        />
      ) : null}
    </MainLayout>
  );
};
