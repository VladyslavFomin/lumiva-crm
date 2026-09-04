import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchIntegration,
  fetchIntegrations,
  fetchIntegrationHubCatalog,
  fetchIntegrationOauthReadiness,
  startGoogleCalendarOAuth,
  startOutlookCalendarOAuth,
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
import { integrationCatalogDescription, integrationCatalogName } from '../automations/integrationsCatalog';
import { IntegrationConnectionCard } from '../../components/integrations/IntegrationConnectionCard';
import { IntegrationConnectionTestSyncActions } from '../../components/integrations/IntegrationConnectionTestSyncActions';
import { MarketingIntegrationSetupModal } from '../../components/integrations/MarketingIntegrationSetupModal';
import { Ga4MarketingQuickConnectModal } from '../../components/integrations/Ga4MarketingQuickConnectModal';
import { WooCommerceHubSheet } from '../../components/integrations/WooCommerceHubSheet';
import { ShopifyConnectModal } from '../../components/integrations/ShopifyConnectModal';
import { ZapierMakeConnectModal } from '../../components/integrations/ZapierMakeConnectModal';
import {
  IntegrationThirdPartyConnectModal,
  isHubThirdPartyConnectCatalogId,
} from '../../components/integrations/IntegrationThirdPartyConnectModal';
import { GoogleSheetsConnectionSettingsModal } from '../../components/integrations/GoogleSheetsConnectionSettingsModal';
import { SlackConnectModal } from '../../components/integrations/SlackConnectModal';
import { OpenAiConnectModal } from '../../components/integrations/OpenAiConnectModal';
import { OneCConnectModal } from '../../components/integrations/OneCConnectModal';
import { SapConnectModal } from '../../components/integrations/SapConnectModal';
import { JiraConnectModal } from '../../components/integrations/JiraConnectModal';
import { IyzicoConnectModal } from '../../components/integrations/IyzicoConnectModal';
import { PaytrConnectModal } from '../../components/integrations/PaytrConnectModal';
import { YookassaConnectModal } from '../../components/integrations/YookassaConnectModal';
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

const CATALOG_BRAND_COLORS: Record<string, string> = {
  google_ads: '#EA4335',
  meta_ads: '#0866FF',
  google_analytics: '#0F9D58',
  yandex_metrika: '#FC3F1D',
  yandex_direct: '#FFCC00',
  vk_ads: '#0077FF',
  mailchimp: '#FFE01B',
  shopify: '#96BF48',
  woocommerce: '#96588A',
  slack: '#4A154B',
  openai: '#412991',
  google_sheets: '#34A853',
  google_calendar: '#1A73E8',
  telegram: '#26A5E4',
  whatsapp: '#25D366',
  make: '#6D00CC',
  zapier: '#FF4A00',
  '1c': '#E5302A',
  jira: '#0052CC',
  sap: '#0FAAFF',
  sms: '#6366F1',
};

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
  yandex_direct: 'yandex_direct',
  vk_ads: 'vk_ads',
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
  if (catalogId === 'shopify') return c.kind === 'shopify';
  return c.kind === 'third_party_link' && c.linkCatalogId === catalogId;
}

function isHubCatalogConnection(
  c: IntegrationConnectionDto,
  catalogIds: Set<string>,
): boolean {
  if (c.kind === 'woocommerce') return catalogIds.has('woocommerce');
  if (c.kind === 'shopify') return catalogIds.has('shopify');
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
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);

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
  const [outlookCalendarOAuthBusyId, setOutlookCalendarOAuthBusyId] = useState<
    string | null
  >(null);
  const [oauthReadiness, setOauthReadiness] = useState<
    Record<string, { oauthReady: boolean }>
  >({});
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
      const [cat, conn, mkt, readiness] = await Promise.all([
        fetchIntegrationHubCatalog(),
        fetchIntegrations(),
        fetchMarketingIntegrations().catch(() => [] as MarketingIntegrationRow[]),
        fetchIntegrationOauthReadiness().catch(() => ({}) as Record<string, { oauthReady: boolean }>),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
      setConnections(Array.isArray(conn) ? conn : []);
      setMarketingRows(Array.isArray(mkt) ? mkt : []);
      setOauthReadiness(readiness && typeof readiness === 'object' ? readiness : {});
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
    const ocal = searchParams.get('outlookCalendarOAuth');
    const slk = searchParams.get('slackOAuth');
    const hs = searchParams.get('hubspotOAuth');
    const mc = searchParams.get('mailchimpOAuth');
    const jr = searchParams.get('jiraOAuth');
    if (!ads && !ga4 && !gcal && !ocal && !slk && !hs && !mc && !jr) return;
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (ads) n.delete('googleAdsOAuth');
        if (ga4) n.delete('ga4OAuth');
        if (gcal) n.delete('googleCalendarOAuth');
        if (ocal) n.delete('outlookCalendarOAuth');
        if (slk) n.delete('slackOAuth');
        if (hs) n.delete('hubspotOAuth');
        if (mc) n.delete('mailchimpOAuth');
        if (jr) n.delete('jiraOAuth');
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
    if (ocal === 'connected') {
      pushMsg('crm.integrationsHub.outlookCalendar.oauthCallback.connected');
      refresh = true;
    } else if (ocal === 'error') {
      pushMsg('crm.integrationsHub.outlookCalendar.oauthCallback.error');
    }
    if (slk === 'connected') {
      pushMsg('crm.integrationsHub.slack.oauth.callback.connected');
      refresh = true;
    } else if (slk === 'error') {
      pushMsg('crm.integrationsHub.slack.oauth.callback.error');
    }
    if (hs === 'connected') {
      pushMsg('crm.automations.panel.integrations.connectHubspotOauthCallbackConnected');
      refresh = true;
    } else if (hs === 'error') {
      pushMsg('crm.automations.panel.integrations.connectHubspotOauthCallbackError');
    }
    if (mc === 'connected') {
      pushMsg('crm.automations.panel.integrations.connectMailchimpOauthCallbackConnected');
      refresh = true;
    } else if (mc === 'error') {
      pushMsg('crm.automations.panel.integrations.connectMailchimpOauthCallbackError');
    }
    if (jr === 'connected') {
      pushMsg('crm.automations.panel.integrations.connectJiraOauthCallbackConnected');
      refresh = true;
    } else if (jr === 'error') {
      pushMsg('crm.automations.panel.integrations.connectJiraOauthCallbackError');
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

  const handleOutlookCalendarReconnect = useCallback(
    async (connectionId: string) => {
      setActionMsg(null);
      setOutlookCalendarOAuthBusyId(connectionId);
      try {
        const { url } = await startOutlookCalendarOAuth({
          intent: 'reconnect',
          integrationId: connectionId,
          redirectPath: '/integrations-hub?tab=connections',
        });
        window.location.assign(url);
      } catch (e: unknown) {
        setOutlookCalendarOAuthBusyId(null);
        setActionMsg((e as Error)?.message || t('crm.integrationsHub.outlookCalendar.oauthStartError'));
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
    const isConnected = n > 0;
    const caps = capabilityChips(entry.capabilities);
    const name = integrationCatalogName(entry.id, t);
    const description = integrationCatalogDescription(entry.id, t);
    const brandColor = CATALOG_BRAND_COLORS[entry.id];
    const showThirdPartyConnect =
      entry.id !== 'woocommerce' &&
      !marketingProvider &&
      isHubThirdPartyConnectCatalogId(entry.id);
    const oauthNotReady =
      entry.capabilities.oauthPlatformSupported &&
      oauthReadiness[entry.id] !== undefined &&
      !oauthReadiness[entry.id].oauthReady;
    const managedElsewhere: { label: string; to: string } | null =
      entry.id === 'sms'
        ? { label: t('crm.integrationsHub.smsManagedLink'), to: '/app/telephony/sms' }
        : entry.id === 'email'
          ? { label: t('crm.integrationsHub.emailManagedLink'), to: '/app/email' }
          : entry.id === 'telegram'
            ? { label: t('crm.integrationsHub.telegramManagedLink'), to: '/app/telegram' }
            : null;

    const lcClass = entry.lifecycle === 'live'
      ? 'text-[#1f8a5e] border-[#c5e3d2] bg-[#eaf4ee]'
      : entry.lifecycle === 'beta'
        ? 'text-[#7a4a09] border-[#f0d9a8] bg-[#fbf2dc]'
        : 'text-[#888] border-[#e7e7e7] bg-[#fafafa]';

    return (
      <div
        key={entry.id}
        className="rounded-2xl border border-[#e7e7e7] bg-white p-[18px] flex flex-col transition-all duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.16)]"
        style={isConnected && brandColor ? { borderTop: `3px solid ${brandColor}` } : undefined}
      >
        {/* Top: icon + name + badge */}
        <div className="flex items-start gap-3">
          <IntegrationBrandIcon
            catalogId={entry.id}
            label={name}
            size={44}
            className="shrink-0 rounded-xl ring-1 ring-black/[0.04] mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-semibold tracking-tight text-[#222] truncate">
                {name}
              </span>
              <span className={`text-[9px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded-full border shrink-0 ${lcClass}`}>
                {t(`crm.integrationsHub.lifecycle.${entry.lifecycle}`)}
              </span>
              {isConnected ? (
                <span className="text-[9px] font-semibold text-[#1f8a5e] bg-[#eaf4ee] border border-[#c5e3d2] rounded-full px-2 py-[3px] shrink-0">
                  {t('crm.integrationsHub.connectedCount', { count: n })}
                </span>
              ) : null}
              {oauthNotReady ? (
                <span
                  title={t('crm.integrationsHub.oauthNotConfigured')}
                  className="text-[9px] font-semibold text-[#9a5b00] bg-[#fff3de] border border-[#f0d9a8] rounded-full px-2 py-[3px] shrink-0"
                >
                  {t('crm.integrationsHub.oauthNotConfigured')}
                </span>
              ) : null}
            </div>
            <div className="font-mono text-[10px] text-[#888] mt-0.5 tracking-[0.02em]">
              {entry.id.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {/* Description */}
        {description ? (
          <p className="text-[12.5px] text-[#555] leading-[1.5] mt-3 flex-1">{description}</p>
        ) : null}

        {/* Tags: modules + capabilities */}
        {(entry.modules.length > 0 || caps.length > 0) ? (
          <div className="flex flex-wrap gap-1 mt-3">
            {entry.modules.map((m) => (
              <span key={m} className="font-mono text-[9.5px] text-[#555] px-2 py-[3px] border border-[#e7e7e7] rounded-md bg-[#fafafa]">
                {t(`crm.integrationsHub.module.${m}`)}
              </span>
            ))}
            {caps.map(({ key }) => (
              <span key={key} className="font-mono text-[9.5px] text-[#555] px-2 py-[3px] border border-[#e7e7e7] rounded-md bg-[#fafafa]">
                {t(`crm.integrationsHub.cap.${key}`)}
              </span>
            ))}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-[#f0f0f0]">
          <div className="font-mono text-[10.5px] text-[#888]">
            {isConnected
              ? <><span className="text-[#222] font-semibold">{n}</span> {t('crm.integrationsHub.connectedCount', { count: n }).split(':')[1]?.trim() ?? ''}</>
              : t('crm.integrationsHub.notConnected')}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {entry.id === 'woocommerce' ? (
              <button
                type="button"
                onClick={() => setWooSheetOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222] text-white text-[12px] font-medium rounded-lg transition hover:bg-black"
              >
                {t('crm.integrationsHub.wooOpenSheet')}
              </button>
            ) : null}
            {entry.id === 'shopify' ? (
              <>
                <button
                  type="button"
                  onClick={() => setShopifyModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222] text-white text-[12px] font-medium rounded-lg transition hover:bg-black"
                >
                  {t('crm.integrationsHub.connectCatalog')}
                </button>
                {countForCatalogId('shopify') > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab('connections')}
                    className="inline-flex items-center px-3 py-1.5 border border-[#e7e7e7] text-[#222] text-[12px] font-medium rounded-lg bg-white transition hover:border-[#222]"
                  >
                    {t('crm.integrationsHub.viewConnectionsCount', { count: countForCatalogId('shopify') })}
                  </button>
                ) : null}
              </>
            ) : null}
            {managedElsewhere ? (
              <Link
                to={managedElsewhere.to}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222] text-white text-[12px] font-medium rounded-lg transition hover:bg-black"
              >
                {managedElsewhere.label}
              </Link>
            ) : null}
            {marketingProvider ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (marketingProvider === 'google_analytics' && n === 0) {
                      setGa4QuickConnectOpen(true);
                    } else {
                      setMarketingModal({ catalogId: entry.id, provider: marketingProvider });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222] text-white text-[12px] font-medium rounded-lg transition hover:bg-black"
                >
                  {n > 0 ? t('crm.integrationsHub.marketingSetup') : t('crm.integrationsHub.connectCatalog')}
                </button>
                <button
                  type="button"
                  onClick={() => { setMarketingModal(null); setTab('marketing'); }}
                  className="inline-flex items-center px-3 py-1.5 border border-[#e7e7e7] text-[#222] text-[12px] font-medium rounded-lg bg-white transition hover:border-[#222]"
                >
                  {t('crm.integrationsHub.marketingOpenTab')}
                </button>
              </>
            ) : null}
            {showThirdPartyConnect ? (
              <>
                <button
                  type="button"
                  onClick={() => setConnectCatalogId(entry.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#222] text-white text-[12px] font-medium rounded-lg transition hover:bg-black"
                >
                  {t('crm.integrationsHub.connectCatalog')}
                </button>
                {connN > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab('connections')}
                    className="inline-flex items-center px-3 py-1.5 border border-[#e7e7e7] text-[#222] text-[12px] font-medium rounded-lg bg-white transition hover:border-[#222]"
                  >
                    {t('crm.integrationsHub.viewConnectionsCount', { count: connN })}
                  </button>
                ) : null}
                {entry.id === 'mailchimp' && connN > 0 ? (
                  <Link
                    to="/automations/new?action=send_mailchimp"
                    className="inline-flex items-center px-3 py-1.5 border border-[#e7e7e7] text-[#222] text-[12px] font-medium rounded-lg bg-white transition hover:border-[#222]"
                  >
                    {t('crm.integrationsHub.mailchimpSetupScenario')}
                  </Link>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div>
        {/* ── PAGE HEADER ── */}
        <div className="flex items-end justify-between gap-5 pb-5 border-b border-[#e7e7e7] mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#222]" />
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#888]">
                {t('crm.integrationsHub.title')}
              </span>
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[#222] leading-tight">
              {activeTab === 'marketing'
                ? t('crm.integrationsHub.navMarketingIntegrationTab')
                : activeTab === 'connections'
                  ? t('crm.integrationsHub.tabs.connections')
                  : t('crm.integrationsHub.tabs.catalog')}
            </h1>
            <p className="text-[13px] text-[#888] mt-1.5 max-w-[560px] leading-[1.45]">
              {t('crm.integrationsHub.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-[7px] border border-[#e7e7e7] rounded-lg text-[12.5px] font-medium text-[#222] bg-white hover:border-[#222] transition-colors disabled:opacity-50"
            >
              {t('crm.integrationsHub.refresh')}
            </button>
            <Link
              to="/automations"
              className="inline-flex items-center gap-1.5 px-3 py-[7px] border border-[#e7e7e7] rounded-lg text-[12.5px] font-medium text-[#222] bg-white hover:border-[#222] transition-colors"
            >
              {t('crm.integrationsHub.openAutomationsScenarios')}
            </Link>
          </div>
        </div>

        {/* ── MODULE TABS (underline style) ── */}
        <div className="flex border-b border-[#e7e7e7] mb-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([
            { id: 'catalog' as HubTab, label: t('crm.integrationsHub.tabs.catalog'), count: catalog.length },
            { id: 'connections' as HubTab, label: t('crm.integrationsHub.tabs.connections'), count: connections.length },
            { id: 'marketing' as HubTab, label: t('crm.integrationsHub.navMarketingIntegrationTab'), count: marketingRows.length },
          ]).map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                'inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] border-b-[1.5px] -mb-px whitespace-nowrap transition-colors',
                activeTab === id
                  ? 'text-[#222] border-[#222] font-medium'
                  : 'text-[#888] border-transparent hover:text-[#222] font-normal',
              ].join(' ')}
            >
              {label}
              <span className="font-mono text-[10px] bg-[#f5f5f5] text-[#888] px-1.5 py-0.5 rounded leading-none">
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* ── SUMMARY STRIP ── */}
        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#e7e7e7] rounded-xl bg-white overflow-hidden mb-[22px]">
            {[
              {
                label: t('crm.integrationsHub.tabs.connections'),
                value: hubConnections.length,
                unit: `/ ${catalog.length}`,
                sub: hubConnections.length > 0 ? `● ${hubConnections.length}` : '—',
                green: hubConnections.length > 0,
              },
              {
                label: t('crm.integrationsHub.tabs.catalog'),
                value: catalog.length,
                unit: '',
                sub: t('crm.integrationsHub.catalogFilterAll'),
                green: false,
              },
              {
                label: t('crm.integrationsHub.navMarketingIntegrationTab'),
                value: marketingRows.length,
                unit: '',
                sub: 'rows',
                green: false,
              },
              {
                label: t('crm.integrationsHub.connectionsHeading'),
                value: connections.length,
                unit: '',
                sub: 'total',
                green: false,
              },
            ].map((kpi, i) => (
              <div key={i} className={`px-4 py-4 ${i < 3 ? 'border-r border-[#e7e7e7]' : ''}`}>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#888] font-medium">
                  {kpi.label}
                </div>
                <div className="text-[26px] font-semibold tracking-tight text-[#222] mt-2.5 leading-none">
                  {kpi.value}
                  {kpi.unit ? <span className="text-[12px] text-[#888] font-medium ml-1">{kpi.unit}</span> : null}
                </div>
                <div className={`font-mono text-[10px] mt-1.5 ${kpi.green ? 'text-[#1f8a5e]' : 'text-[#888]'}`}>
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>
        )}

        {actionMsg && (
          <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-xs text-[#222] mb-4">
            {actionMsg}
          </div>
        )}
        {loading && (
          <p className="text-xs text-[#888] mb-4">{t('crm.automations.list.loading')}</p>
        )}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 mb-4">
            {error}
          </div>
        )}

        {/* ── CATALOG TAB ── */}
        {!loading && !error && activeTab === 'catalog' && (
          <section>
            {/* Module filter chips */}
            <div className="flex flex-wrap items-center gap-1.5 mb-6">
              {MODULE_FILTER_CHIPS.map((m) => {
                const on = moduleFilter === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCatalogModule(m)}
                    className={[
                      'px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors',
                      on
                        ? 'bg-[#222] text-white border-[#222]'
                        : 'bg-white text-[#555] border-[#e7e7e7] hover:border-[#222]',
                    ].join(' ')}
                  >
                    {m === 'all' ? t('crm.integrationsHub.catalogFilterAll') : t(`crm.integrationsHub.module.${m}`)}
                  </button>
                );
              })}
            </div>

            {catalogByCategory.length === 0 ? (
              <p className="text-sm text-[#888]">{t('crm.integrationsHub.catalogEmptyFilter')}</p>
            ) : (
              catalogByCategory.map(({ key: catKey, entries }) => (
                <div key={catKey} className="mb-7">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium whitespace-nowrap">
                      {t(`crm.integrationsHub.catalogCategory.${catKey}`)}
                    </span>
                    <div className="flex-1 h-px bg-[#f0f0f0]" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {entries.map((entry) => renderCatalogEntry(entry))}
                  </div>
                </div>
              ))
            )}

            <p className="text-xs text-[#555] leading-relaxed mt-4">
              {t('crm.integrationsHub.wooChannelsHint')}{' '}
              <Link
                to="/app/sales/channels"
                className="font-semibold text-[#222] underline decoration-slate-300 underline-offset-2 hover:decoration-[#222]"
              >
                {t('crm.integrationsHub.wooChannelsLink')}
              </Link>
            </p>
          </section>
        )}

        {/* ── CONNECTIONS TAB ── */}
        {!loading && !error && activeTab === 'connections' && (
          <section className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-[#222]">
                {t('crm.integrationsHub.connectionsHeading')}
              </h2>
              {connections.length === 0 ? (
                <p className="text-xs text-[#888] mt-1 max-w-2xl leading-relaxed">
                  {t('crm.integrationsHub.connectionsEmpty')}
                </p>
              ) : null}
            </div>

            <div className="max-w-4xl space-y-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium whitespace-nowrap">
                    {t('crm.integrationsHub.wpLumivaSectionTitle')}
                  </span>
                  <div className="flex-1 h-px bg-[#f0f0f0]" />
                </div>
                <details className="mt-2 rounded-xl border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[11px] text-[#555]">
                  <summary className="cursor-pointer select-none font-semibold text-[#222] list-none [&::-webkit-details-marker]:hidden">
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
                      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e7e7e7] bg-white"
                    >
                      <div className="space-y-2 border-b border-[#e7e7e7] bg-[#fafafa] px-3 py-3 sm:px-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                            <IntegrationBrandIcon
                              catalogId={catId}
                              label={integrationCatalogName(catId, t)}
                              size={36}
                              className="shrink-0 ring-1 ring-black/[0.04]"
                            />
                            <div className="min-w-0 text-sm font-semibold text-[#222] leading-tight">
                              {integrationCatalogName(catId, t)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setConnectCatalogId(catId)}
                            className="shrink-0 rounded-lg bg-[#222] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-black"
                          >
                            {t('crm.integrationsHub.wpLumivaConnectNew')}
                          </button>
                        </div>
                        <details className="rounded-lg border border-[#e7e7e7] bg-white px-2.5 py-1.5 text-[10px] text-[#555]">
                          <summary className="cursor-pointer select-none font-semibold text-[#222] list-none [&::-webkit-details-marker]:hidden">
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
                                        'rounded-lg border px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ' +
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
                          <p className="text-xs text-[#888] italic">
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
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium whitespace-nowrap">
                    {t('crm.integrationsHub.otherHubConnectionsHeading')}
                  </span>
                  <div className="flex-1 h-px bg-[#f0f0f0]" />
                </div>
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
                              className="w-full rounded-lg border border-[#e7e7e7] bg-white px-3 py-2 text-[11px] font-medium text-[#222] hover:bg-[#fafafa] disabled:opacity-50"
                            >
                              {googleCalendarOAuthBusyId === c.id
                                ? t('crm.integrationsHub.googleCalendar.oauthBusy')
                                : t('crm.integrationsHub.googleCalendar.reconnectGoogle')}
                            </button>
                          )}
                          {c.linkCatalogId === 'outlook' && (
                            <button
                              type="button"
                              disabled={
                                outlookCalendarOAuthBusyId === c.id ||
                                testingId === c.id ||
                                syncingId === c.id
                              }
                              onClick={() => void handleOutlookCalendarReconnect(c.id)}
                              className="w-full rounded-lg border border-[#e7e7e7] bg-white px-3 py-2 text-[11px] font-medium text-[#222] hover:bg-[#fafafa] disabled:opacity-50"
                            >
                              {outlookCalendarOAuthBusyId === c.id
                                ? t('crm.integrationsHub.outlookCalendar.oauthBusy')
                                : t('crm.integrationsHub.outlookCalendar.reconnectMicrosoft')}
                            </button>
                          )}
                          {c.linkCatalogId === 'google_sheets' && (
                            <button
                              type="button"
                              onClick={() => setGoogleSheetsSettingsId(c.id)}
                              className="w-full rounded-lg border border-[#e7e7e7] bg-white px-3 py-2 text-[11px] font-medium text-[#222] hover:bg-[#fafafa]"
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
                            className="inline-block text-[10px] font-semibold text-[#222] underline decoration-slate-300 underline-offset-2 hover:decoration-[#222]"
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
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium whitespace-nowrap">
                    {t('crm.integrationsHub.otherConnectionsHeading')}
                  </span>
                  <div className="flex-1 h-px bg-[#f0f0f0]" />
                </div>
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
                        <div className="text-[10px] text-[#888] mt-0.5">
                          {t('crm.integrationsHub.kind')}: {c.kind}
                          {c.linkCatalogId ? ` · ${c.linkCatalogId}` : ''}
                        </div>
                      }
                      lastSyncVariant="hub"
                      showLastSyncStatus
                      showSalesIntegrationsLink={
                        c.kind === 'woocommerce' || c.kind === 'shopify' || c.kind === 'manual-import'
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
                              className="w-full rounded-lg border border-[#e7e7e7] bg-white px-3 py-2 text-[11px] font-medium text-[#222] hover:bg-[#fafafa] disabled:opacity-50"
                            >
                              {googleCalendarOAuthBusyId === c.id
                                ? t('crm.integrationsHub.googleCalendar.oauthBusy')
                                : t('crm.integrationsHub.googleCalendar.reconnectGoogle')}
                            </button>
                          )}
                          {c.linkCatalogId === 'outlook' && (
                            <button
                              type="button"
                              disabled={
                                outlookCalendarOAuthBusyId === c.id ||
                                testingId === c.id ||
                                syncingId === c.id
                              }
                              onClick={() => void handleOutlookCalendarReconnect(c.id)}
                              className="w-full rounded-lg border border-[#e7e7e7] bg-white px-3 py-2 text-[11px] font-medium text-[#222] hover:bg-[#fafafa] disabled:opacity-50"
                            >
                              {outlookCalendarOAuthBusyId === c.id
                                ? t('crm.integrationsHub.outlookCalendar.oauthBusy')
                                : t('crm.integrationsHub.outlookCalendar.reconnectMicrosoft')}
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
                            className="inline-block text-[10px] font-semibold text-[#222] underline decoration-slate-300 underline-offset-2 hover:decoration-[#222]"
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

        {/* ── MARKETING TAB ── */}
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

      <ShopifyConnectModal
        open={shopifyModalOpen}
        onClose={() => setShopifyModalOpen(false)}
        onCreated={() => { void load({ quiet: true }); }}
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

      {connectCatalogId === 'slack' ? (
        <SlackConnectModal
          open
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : connectCatalogId === 'openai' ? (
        <OpenAiConnectModal
          open
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : connectCatalogId === '1c' ? (
        <OneCConnectModal
          open
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : connectCatalogId === 'sap' ? (
        <SapConnectModal
          open
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : connectCatalogId === 'jira' ? (
        <JiraConnectModal
          open
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : connectCatalogId === 'iyzico' ? (
        <IyzicoConnectModal
          open
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : connectCatalogId === 'paytr' ? (
        <PaytrConnectModal
          open
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : connectCatalogId === 'yookassa' ? (
        <YookassaConnectModal
          open
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : (connectCatalogId === 'zapier' || connectCatalogId === 'make') ? (
        <ZapierMakeConnectModal
          open
          catalogId={connectCatalogId}
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      ) : (
        <IntegrationThirdPartyConnectModal
          open={Boolean(connectCatalogId)}
          catalogId={connectCatalogId ?? ''}
          onClose={() => setConnectCatalogId(null)}
          onCreated={() => void load({ quiet: true })}
        />
      )}

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
