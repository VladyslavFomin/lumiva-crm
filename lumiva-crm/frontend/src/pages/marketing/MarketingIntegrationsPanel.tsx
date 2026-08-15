import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  createMarketingIntegration,
  deleteMarketingIntegration,
  fetchGoogleAdsManagedCustomers,
  fetchMarketingIntegrationSetupHints,
  fetchMarketingIntegrations,
  startGa4MarketingOAuth,
  startGoogleAdsMarketingOAuth,
  syncMarketingIntegration,
  updateMarketingIntegration,
  type MarketingIntegrationRow,
  type MarketingIntegrationSetupHints,
} from '../../api/marketing';
import { marketingDataSourceLabel } from '../../utils/marketingDataSourceLabel';
import {
  marketingCard,
  marketingH1,
  marketingKicker,
  marketingPageShell,
  marketingSectionSub,
  marketingSectionTitle,
} from './marketingPageChrome';

export type MarketingIntegrationProviderKey =
  | 'google_ads'
  | 'google_analytics'
  | 'yandex_metrika'
  | 'meta_ads';

type ProviderKey = MarketingIntegrationProviderKey;

const INTEGRATION_CURRENCIES = ['EUR', 'USD', 'GBP', 'TRY'] as const;
type IntegrationCurrencyCode = (typeof INTEGRATION_CURRENCIES)[number];

function normalizeIntegrationCurrency(raw: unknown): IntegrationCurrencyCode {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 8);
  return (INTEGRATION_CURRENCIES as readonly string[]).includes(v)
    ? (v as IntegrationCurrencyCode)
    : 'EUR';
}

function currencyFromRow(row: MarketingIntegrationRow): IntegrationCurrencyCode {
  const s = row.settings && typeof row.settings === 'object' ? row.settings : {};
  return normalizeIntegrationCurrency((s as Record<string, unknown>).currency);
}

const ADS_SYNC_LOOKBACK_MIN = 30;
const ADS_SYNC_LOOKBACK_MAX = 731;
const ADS_SYNC_LOOKBACK_DEFAULT = 730;

function rowSupportsAdsSyncLookback(provider: string): boolean {
  const p = String(provider || '').trim().toLowerCase();
  return p === 'google_ads' || p === 'meta_ads';
}

function configuredAdsSyncLookbackDays(row: MarketingIntegrationRow): number | null {
  const s =
    row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};
  const raw =
    s.syncLookbackDays ?? s.googleAdsSyncLookbackDays ?? s.adsSyncLookbackDays;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(
    Math.max(Math.floor(n), ADS_SYNC_LOOKBACK_MIN),
    ADS_SYNC_LOOKBACK_MAX,
  );
}

type GoogleAdsAccountMode = 'customer' | 'mcc_managed';

function googleAdsAccountModeFromSettings(row: MarketingIntegrationRow): GoogleAdsAccountMode {
  const s =
    row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};
  const m = String(s.googleAdsAccountMode || s.google_ads_account_mode || 'customer')
    .trim()
    .toLowerCase();
  return m === 'mcc_managed' ? 'mcc_managed' : 'customer';
}

function formatGoogleAdsManagedIdList(raw: unknown): string {
  if (!Array.isArray(raw) || !raw.length) return '';
  const ids = raw
    .map((x) => String(x ?? '').replace(/\D/g, '').trim())
    .filter((id) => /^\d{6,15}$/.test(id));
  return [...new Set(ids)].join(', ');
}

/** Пустая строка или только пробелы → синк всех (после исключений). */
function parseManagedIdListField(text: string): string[] | undefined {
  const parts = text.split(/[\s,;]+/).map((x) => x.replace(/\D/g, '').trim()).filter(Boolean);
  const unique = [...new Set(parts)].filter((id) => /^\d{6,15}$/.test(id));
  return unique.length ? unique : undefined;
}

function rowIsGa4Provider(provider: string): boolean {
  const p = String(provider || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  return (
    p === 'google_analytics' ||
    p === 'ga4' ||
    p === 'google_analytics_4' ||
    p === 'google_analytics_ga4'
  );
}

const PROVIDER_KEYS: ProviderKey[] = ['google_ads', 'meta_ads', 'google_analytics', 'yandex_metrika'];

const PROVIDER_META: Record<ProviderKey, { brand: string; logo: string; ds: string; status: 'live' | 'beta' }> = {
  google_ads:       { brand: '#EA4335', logo: 'G', ds: 'google_ads', status: 'beta' },
  meta_ads:         { brand: '#0866FF', logo: 'M', ds: 'meta_ads',   status: 'beta' },
  google_analytics: { brand: '#0F9D58', logo: 'A', ds: 'ga4',        status: 'live' },
  yandex_metrika:   { brand: '#FC3F1D', logo: 'Я', ds: 'yandex_metrika', status: 'live' },
};

const inputCls =
  'mt-1 w-full rounded-xl border border-[#222222]/16 bg-white px-3 py-2.5 text-[13px] text-[#222222] placeholder:text-[#222222]/35 outline-none transition shadow-[inset_0_1px_2px_rgba(34,34,34,0.04)] focus:border-[#222222] focus:ring-2 focus:ring-[#222222]/10';
const labelCls = 'block text-[11px] font-semibold text-[#222222]/55 tracking-wide';
const formPanel = `${marketingCard} border-l-[4px] border-l-[#222222] shadow-[0_18px_56px_rgba(34,34,34,0.09)]`;
const credentialsShell =
  'rounded-xl border border-[#222222]/10 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]';
const credentialsBlock = `${credentialsShell} space-y-3`;
const credentialsGrid = `${credentialsShell} grid grid-cols-1 sm:grid-cols-2 gap-3`;
const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-[#222222] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40';
const btnSecondary =
  'inline-flex items-center justify-center rounded-xl border border-[#222222]/18 bg-white px-4 py-2.5 text-[11px] font-semibold text-[#222222] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
const btnDanger =
  'text-[11px] font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-40';

export type MarketingIntegrationsPanelVariant = 'standalone' | 'embedded' | 'modal';

export type MarketingIntegrationsPanelProps = {
  variant?: MarketingIntegrationsPanelVariant;
  /** При открытии из каталога / модалки — сразу выбрать провайдера и подставить название. */
  initialProvider?: MarketingIntegrationProviderKey | null;
  /** После создания, синка, смены валюты или удаления — обновить данные в родителе (счётчики в хабе). */
  onMarketingDataChanged?: () => void;
  /** Инкремент с родителя (например после OAuth redirect) — перезагрузить список интеграций. */
  listRefreshSignal?: number;
};

export const MarketingIntegrationsPanel: React.FC<MarketingIntegrationsPanelProps> = ({
  variant = 'standalone',
  initialProvider = null,
  onMarketingDataChanged,
  listRefreshSignal = 0,
}) => {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const embedded = variant === 'embedded';
  const modal = variant === 'modal';
  const [list, setList] = useState<MarketingIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currencySavingId, setCurrencySavingId] = useState<string | null>(null);
  const [lookbackDraft, setLookbackDraft] = useState<Record<string, string>>({});
  const [lookbackSavingId, setLookbackSavingId] = useState<string | null>(null);
  const [googleAdsAccountModeCreate, setGoogleAdsAccountModeCreate] =
    useState<GoogleAdsAccountMode>('customer');
  const [adsModeSavingId, setAdsModeSavingId] = useState<string | null>(null);
  const [managedPreviewIntegrationId, setManagedPreviewIntegrationId] = useState<string | null>(
    null,
  );
  const [managedPreviewBusy, setManagedPreviewBusy] = useState(false);
  const [managedPreviewErr, setManagedPreviewErr] = useState<string | null>(null);
  const [managedPreviewItems, setManagedPreviewItems] = useState<
    Array<{ customerId: string; descriptiveName: string | null }>
  >([]);
  const [mccFilterSavingId, setMccFilterSavingId] = useState<string | null>(null);
  const [mccIncludeDraft, setMccIncludeDraft] = useState<Record<string, string>>({});
  const [mccExcludeDraft, setMccExcludeDraft] = useState<Record<string, string>>({});
  const [lastSyncRows, setLastSyncRows] = useState<number | null>(null);

  const [provider, setProvider] = useState<ProviderKey>('google_ads');
  const [name, setName] = useState('');
  const [primaryId, setPrimaryId] = useState('');
  const [gaJson, setGaJson] = useState('');
  const [adsDev, setAdsDev] = useState('');
  const [adsClientId, setAdsClientId] = useState('');
  const [adsClientSecret, setAdsClientSecret] = useState('');
  const [adsRefresh, setAdsRefresh] = useState('');
  const [adsLoginCustomer, setAdsLoginCustomer] = useState('');
  const [adsSource, setAdsSource] = useState('');
  const [adsMedium, setAdsMedium] = useState('');
  const [integrationCurrency, setIntegrationCurrency] =
    useState<IntegrationCurrencyCode>('EUR');
  const [ymToken, setYmToken] = useState('');
  const [ymGoal, setYmGoal] = useState('');
  const [ymRev, setYmRev] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaConv, setMetaConv] = useState('');
  const [metaRevAct, setMetaRevAct] = useState('');
  const [metaSource, setMetaSource] = useState('');
  const [metaMedium, setMetaMedium] = useState('');

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [setupHints, setSetupHints] = useState<MarketingIntegrationSetupHints | null>(null);
  const [oauthRowId, setOauthRowId] = useState<string | null>(null);
  const [activeAddProvider, setActiveAddProvider] = useState<ProviderKey | null>(null);

  const adsPlatformOAuth = Boolean(setupHints?.googleAds.platformGoogleOAuth);
  const adsPlatformDev = Boolean(setupHints?.googleAds.platformDeveloperToken);
  const adsOAuthWizard = Boolean(setupHints?.googleAds.oauthWizardAvailable);
  const ga4OAuthWizard = Boolean(setupHints?.googleAnalyticsGa4?.oauthWizardAvailable);
  const metaPlatformApp = Boolean(setupHints?.metaAds.platformMetaOAuth);

  const providerOptions = useMemo(
    () =>
      [
        { key: 'google_ads' as const, label: t('crm.marketingIntegrations.providers.google_ads') },
        {
          key: 'google_analytics' as const,
          label: t('crm.marketingIntegrations.providers.google_analytics'),
        },
        {
          key: 'yandex_metrika' as const,
          label: t('crm.marketingIntegrations.providers.yandex_metrika'),
        },
        { key: 'meta_ads' as const, label: t('crm.marketingIntegrations.providers.meta_ads') },
      ] as const,
    [t],
  );

  const refreshList = useCallback(async () => {
    const data = await fetchMarketingIntegrations();
    setList(data);
  }, []);

  const load = useCallback((): Promise<void> => {
    setLoading(true);
    setError(null);
    return fetchMarketingIntegrations()
      .then((data) => {
        setList(data);
      })
      .catch((e: { message?: string }) => {
        setError(e?.message || t('crm.marketingIntegrations.errors.load'));
        throw e;
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  const didInitName = useRef(false);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchMarketingIntegrationSetupHints()
      .then(setSetupHints)
      .catch(() => setSetupHints(null));
  }, []);

  useEffect(() => {
    if (!listRefreshSignal) return;
    void refreshList();
  }, [listRefreshSignal, refreshList]);

  useEffect(() => {
    if (initialProvider) {
      setProvider(initialProvider);
      const o = providerOptions.find((x) => x.key === initialProvider);
      if (o) setName(o.label);
      return;
    }
    if (didInitName.current) return;
    didInitName.current = true;
    setName(t('crm.marketingIntegrations.providers.google_ads'));
  }, [initialProvider, providerOptions, t]);

  const buildCreatePayload = () => {
    const n = name.trim();
    const pid = primaryId.trim();
    const cur = integrationCurrency;
    if (provider === 'google_ads') {
      const settings: Record<string, unknown> = { currency: cur };
      const put = (k: string, v: string) => {
        const tv = v.trim();
        if (tv) settings[k] = tv;
      };
      put('developerToken', adsDev);
      put('clientId', adsClientId);
      put('clientSecret', adsClientSecret);
      put('refreshToken', adsRefresh);
      put('loginCustomerId', adsLoginCustomer);
      put('source', adsSource);
      put('medium', adsMedium);
      if (googleAdsAccountModeCreate === 'mcc_managed') {
        settings.googleAdsAccountMode = 'mcc_managed';
      }
      return {
        provider: 'google_ads',
        kind: 'ads',
        name: n,
        isActive: true,
        primaryId: pid || undefined,
        settings,
      };
    }
    if (provider === 'google_analytics') {
      const j = gaJson.trim();
      return {
        provider: 'google_analytics',
        kind: 'analytics',
        name: n,
        isActive: true,
        primaryId: pid || undefined,
        ga4ServiceAccountJson: j || undefined,
        settings: { currency: cur },
      };
    }
    if (provider === 'yandex_metrika') {
      const settings: Record<string, string> = { currency: cur };
      const put = (k: string, v: string) => {
        const tv = v.trim();
        if (tv) settings[k] = tv;
      };
      put('oauthToken', ymToken);
      put('goalId', ymGoal);
      put('revenueMetric', ymRev);
      return {
        provider: 'yandex_metrika',
        kind: 'analytics',
        name: n,
        isActive: true,
        primaryId: pid || undefined,
        settings,
      };
    }
    const settings: Record<string, string> = { currency: cur };
    const put = (k: string, v: string) => {
      const s = v.trim();
      if (s) settings[k] = s;
    };
    put('accessToken', metaToken);
    put('conversionAction', metaConv);
    put('revenueAction', metaRevAct);
    put('source', metaSource);
    put('medium', metaMedium);
    return {
      provider: 'meta_ads',
      kind: 'ads',
      name: n,
      isActive: true,
      primaryId: pid || undefined,
      settings,
    };
  };

  const defaultMarketingOauthRedirect = '/integrations-hub?tab=marketing';

  const startGoogleAdsOAuthReconnect = async (integrationId: string) => {
    setError(null);
    setOauthRowId(integrationId);
    try {
      const { url } = await startGoogleAdsMarketingOAuth({
        intent: 'reconnect',
        integrationId,
        redirectPath: defaultMarketingOauthRedirect,
      });
      window.location.assign(url);
    } catch (e: unknown) {
      setOauthRowId(null);
      setError(
        e instanceof Error ? e.message : t('crm.marketingIntegrations.oauth.startError'),
      );
    }
  };

  const startGa4OAuthReconnect = async (integrationId: string) => {
    setError(null);
    setOauthRowId(integrationId);
    try {
      const { url } = await startGa4MarketingOAuth({
        intent: 'reconnect',
        integrationId,
        redirectPath: defaultMarketingOauthRedirect,
      });
      window.location.assign(url);
    } catch (e: unknown) {
      setOauthRowId(null);
      setError(
        e instanceof Error ? e.message : t('crm.marketingIntegrations.ga4.oauth.startError'),
      );
    }
  };

  const startGa4OAuthCreate = async () => {
    setCreateError(null);
    const n = name.trim();
    const pid = primaryId.trim();
    if (!n) {
      setCreateError(t('crm.marketingIntegrations.errors.requiredName'));
      return;
    }
    if (!pid) {
      setCreateError(t('crm.marketingIntegrations.errors.requiredGa4PropertyId'));
      return;
    }
    try {
      const { url } = await startGa4MarketingOAuth({
        intent: 'create',
        redirectPath: defaultMarketingOauthRedirect,
        name: n,
        primaryId: pid,
        currency: integrationCurrency,
      });
      window.location.assign(url);
    } catch (e: unknown) {
      setCreateError(
        e instanceof Error ? e.message : t('crm.marketingIntegrations.ga4.oauth.startError'),
      );
    }
  };

  const startGoogleAdsOAuthCreate = async () => {
    setCreateError(null);
    const n = name.trim();
    const pid = primaryId.trim();
    if (!n) {
      setCreateError(t('crm.marketingIntegrations.errors.requiredName'));
      return;
    }
    if (!pid) {
      setCreateError(t('crm.marketingIntegrations.errors.requiredCustomerId'));
      return;
    }
    try {
      const { url } = await startGoogleAdsMarketingOAuth({
        intent: 'create',
        redirectPath: defaultMarketingOauthRedirect,
        name: n,
        primaryId: pid,
        currency: integrationCurrency,
        loginCustomerId: adsLoginCustomer.trim() || undefined,
        source: adsSource.trim() || undefined,
        medium: adsMedium.trim() || undefined,
        googleAdsAccountMode:
          googleAdsAccountModeCreate === 'mcc_managed' ? 'mcc_managed' : undefined,
      });
      window.location.assign(url);
    } catch (e: unknown) {
      setCreateError(
        e instanceof Error ? e.message : t('crm.marketingIntegrations.oauth.startError'),
      );
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const n = name.trim();
    if (!n) {
      setCreateError(t('crm.marketingIntegrations.errors.requiredName'));
      return;
    }
    setCreating(true);
    try {
      await createMarketingIntegration(buildCreatePayload());
      await refreshList();
      setLastSyncRows(null);
      onMarketingDataChanged?.();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : t('crm.marketingIntegrations.errors.create'));
    } finally {
      setCreating(false);
    }
  };

  const onSync = async (id: string) => {
    setSyncingId(id);
    setError(null);
    setLastSyncRows(null);
    try {
      const res = await syncMarketingIntegration(id);
      setLastSyncRows(res.rowsSaved);
      await refreshList();
      onMarketingDataChanged?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('crm.marketingIntegrations.errors.sync');
      setError(msg);
    } finally {
      setSyncingId(null);
    }
  };

  const onRowCurrencyChange = async (row: MarketingIntegrationRow, code: IntegrationCurrencyCode) => {
    setCurrencySavingId(row.id);
    setError(null);
    try {
      await updateMarketingIntegration(row.id, { settings: { currency: code } });
      await refreshList();
      onMarketingDataChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.marketingIntegrations.errors.update'));
    } finally {
      setCurrencySavingId(null);
    }
  };

  const onRowAdsLookbackCommit = async (row: MarketingIntegrationRow) => {
    const draftVal = lookbackDraft[row.id];
    if (draftVal === undefined) return;
    const trimmed = draftVal.trim();
    const configured = configuredAdsSyncLookbackDays(row);
    const effectiveStr = configured !== null ? String(configured) : '';
    if (trimmed === effectiveStr) {
      setLookbackDraft((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }
    if (trimmed !== '') {
      const nRound = Math.round(Number(trimmed));
      if (!Number.isFinite(nRound)) {
        setError(t('crm.marketingIntegrations.errors.invalidLookback'));
        setLookbackDraft((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        return;
      }
    }
    setLookbackSavingId(row.id);
    setError(null);
    try {
      const base: Record<string, unknown> = {
        ...(row.settings &&
        typeof row.settings === 'object' &&
        !Array.isArray(row.settings)
          ? (row.settings as Record<string, unknown>)
          : {}),
      };
      delete base.syncLookbackDays;
      delete base.googleAdsSyncLookbackDays;
      delete base.adsSyncLookbackDays;
      if (trimmed !== '') {
        const nClamped = Math.min(
          Math.max(Math.round(Number(trimmed)), ADS_SYNC_LOOKBACK_MIN),
          ADS_SYNC_LOOKBACK_MAX,
        );
        base.syncLookbackDays = nClamped;
      }
      await updateMarketingIntegration(row.id, { settings: base });
      setLookbackDraft((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await refreshList();
      onMarketingDataChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.marketingIntegrations.errors.update'));
    } finally {
      setLookbackSavingId(null);
    }
  };

  const onRowGoogleAdsAccountMode = async (
    row: MarketingIntegrationRow,
    mode: GoogleAdsAccountMode,
  ) => {
    if (googleAdsAccountModeFromSettings(row) === mode) return;
    setAdsModeSavingId(row.id);
    setError(null);
    try {
      const base: Record<string, unknown> = {
        ...(row.settings &&
        typeof row.settings === 'object' &&
        !Array.isArray(row.settings)
          ? (row.settings as Record<string, unknown>)
          : {}),
      };
      if (mode === 'mcc_managed') base.googleAdsAccountMode = 'mcc_managed';
      else delete base.googleAdsAccountMode;
      await updateMarketingIntegration(row.id, { settings: base });
      setManagedPreviewIntegrationId(null);
      setManagedPreviewErr(null);
      setManagedPreviewItems([]);
      await refreshList();
      onMarketingDataChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.marketingIntegrations.errors.update'));
    } finally {
      setAdsModeSavingId(null);
    }
  };

  const onToggleManagedCustomersPreview = async (rowId: string) => {
    if (managedPreviewIntegrationId === rowId) {
      setManagedPreviewIntegrationId(null);
      setManagedPreviewErr(null);
      setManagedPreviewItems([]);
      return;
    }
    const rowSnap = list.find((r) => r.id === rowId);
    if (
      rowSnap?.settings &&
      typeof rowSnap.settings === 'object' &&
      !Array.isArray(rowSnap.settings)
    ) {
      const s = rowSnap.settings as Record<string, unknown>;
      setMccIncludeDraft((p) => ({
        ...p,
        [rowId]: formatGoogleAdsManagedIdList(s.googleAdsManagedCustomerIds),
      }));
      setMccExcludeDraft((p) => ({
        ...p,
        [rowId]: formatGoogleAdsManagedIdList(s.googleAdsExcludedManagedCustomerIds),
      }));
    }
    setManagedPreviewBusy(true);
    setManagedPreviewErr(null);
    setManagedPreviewIntegrationId(rowId);
    try {
      const r = await fetchGoogleAdsManagedCustomers(rowId);
      setManagedPreviewItems(r.customers);
    } catch (e: unknown) {
      setManagedPreviewErr(
        e instanceof Error
          ? e.message
          : t('crm.marketingIntegrations.form.ads.managedCustomersLoadError'),
      );
      setManagedPreviewItems([]);
    } finally {
      setManagedPreviewBusy(false);
    }
  };

  const onSaveMccSyncFilters = async (row: MarketingIntegrationRow) => {
    const rowId = row.id;
    setMccFilterSavingId(rowId);
    setError(null);
    try {
      const rowSettings =
        row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
          ? (row.settings as Record<string, unknown>)
          : {};
      const includeParsed = parseManagedIdListField(
        mccIncludeDraft[rowId] ??
          formatGoogleAdsManagedIdList(rowSettings.googleAdsManagedCustomerIds),
      );
      const excludeParsed = parseManagedIdListField(
        mccExcludeDraft[rowId] ??
          formatGoogleAdsManagedIdList(rowSettings.googleAdsExcludedManagedCustomerIds),
      );
      const base: Record<string, unknown> = { ...rowSettings };
      if (includeParsed?.length) base.googleAdsManagedCustomerIds = includeParsed;
      else delete base.googleAdsManagedCustomerIds;
      if (excludeParsed?.length) base.googleAdsExcludedManagedCustomerIds = excludeParsed;
      else delete base.googleAdsExcludedManagedCustomerIds;
      await updateMarketingIntegration(rowId, { settings: base });
      await refreshList();
      onMarketingDataChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.marketingIntegrations.errors.update'));
    } finally {
      setMccFilterSavingId(null);
    }
  };

  const onDelete = async (row: MarketingIntegrationRow) => {
    const ok = await showConfirm(t('crm.marketingIntegrations.confirmDelete', { name: row.name }), {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(row.id);
    setError(null);
    try {
      await deleteMarketingIntegration(row.id);
      await refreshList();
      onMarketingDataChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.marketingIntegrations.errors.delete'));
    } finally {
      setDeletingId(null);
    }
  };

  const shellClass = modal
    ? 'w-full max-w-none space-y-5 pb-1'
    : `${marketingPageShell} w-full max-w-none space-y-6 pb-2`;

  return (
    <div className={shellClass}>
      <header
        className={
          modal ? 'border-b border-[#222222]/10 pb-4' : 'border-b border-[#222222]/10 pb-5'
        }
      >
        {modal ? (
          <>
            <h2 className="text-sm font-semibold text-[#222222]">
              {t('crm.integrationsHub.marketingModalPanelLead')}
            </h2>
            <p className="text-[11px] text-[#222222]/60 mt-1.5 max-w-2xl leading-relaxed">
              {t('crm.integrationsHub.marketingModalPanelHint')}
            </p>
          </>
        ) : embedded ? (
          <>
            <h2 className="text-base font-semibold text-[#222222]">
              {t('crm.integrationsHub.marketingBlockTitle')}
            </h2>
            <p className="text-sm text-[#222222]/70 mt-1 max-w-2xl leading-relaxed">
              {t('crm.integrationsHub.marketingBlockSubtitle')}
            </p>
          </>
        ) : (
          <>
            <div className={marketingKicker}>{t('crm.marketingIntegrations.kicker')}</div>
            <h1 className={marketingH1}>{t('crm.marketingIntegrations.title')}</h1>
            <p className="text-sm text-[#222222]/70 mt-1 max-w-2xl leading-relaxed">
              {t('crm.marketingIntegrations.subtitle')}
            </p>
            <p className="text-[11px] text-[#222222]/50 mt-2 max-w-2xl leading-relaxed">
              {t('crm.marketingIntegrations.hint')}
            </p>
          </>
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
          {error}
        </div>
      )}
      {createError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
          {createError}
        </div>
      )}

      {lastSyncRows !== null && (
        <div
          className="rounded-xl border px-3 py-2.5 text-[11px] text-[#222222]"
          style={{
            borderColor: 'rgba(34, 34, 34, 0.14)',
            background: 'rgba(34, 34, 34, 0.045)',
          }}
        >
          {lastSyncRows > 0 ? (
            <span>{t('crm.marketingIntegrations.syncResult', { count: lastSyncRows })}</span>
          ) : (
            <span>{t('crm.marketingIntegrations.syncZero')}</span>
          )}
        </div>
      )}

      {embedded && (
        <div>
          {/* ── CONNECTED SOURCES ── */}
          <div className="flex items-center gap-2.5 mb-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium whitespace-nowrap">
              Подключённые источники · {list.length}
            </span>
            <div className="flex-1 h-px bg-[#f0f0f0]" />
          </div>

          {loading && <p className="text-xs text-[#888] mb-4">Загрузка…</p>}

          {!loading && list.length === 0 && (
            <p className="text-xs text-[#888] italic mb-6">Нет подключённых источников.</p>
          )}

          <div className="flex flex-col gap-3 mb-7">
            {list.map((row) => {
              const pm = PROVIDER_META[row.provider as ProviderKey];
              const brand = pm?.brand ?? '#222';
              const logo = pm?.logo ?? row.provider[0]?.toUpperCase() ?? '?';
              const rowCurrency = currencyFromRow(row);
              const isSyncing = syncingId === row.id;
              const isDeleting = deletingId === row.id;
              return (
                <div key={row.id} className="border border-[#e7e7e7] rounded-[14px] bg-white overflow-hidden">
                  <div className="flex items-center gap-3.5 px-[18px] py-4">
                    {/* brand accent bar */}
                    <div className="w-[3px] self-stretch rounded-[2px] shrink-0 -my-4 -ml-[18px] mr-0.5" style={{ background: brand }} />
                    {/* logo */}
                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold text-[15px] shrink-0" style={{ background: brand }}>
                      {logo}
                    </div>
                    {/* info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[15px] text-[#222] tracking-tight truncate">{row.name}</span>
                        <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded-full border ${row.isActive ? 'text-[#1f8a5e] border-[#c5e3d2] bg-[#eaf4ee]' : 'text-[#888] border-[#e7e7e7] bg-[#fafafa]'}`}>
                          <span className="w-[5px] h-[5px] rounded-full bg-current" />
                          {row.isActive ? 'Synced' : 'Inactive'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-[#888] mt-[3px] flex items-center gap-1.5 flex-wrap">
                        <span>{pm?.ds ?? row.provider}</span>
                        {row.primaryId && <><span className="opacity-30">·</span><span>{row.primaryId}</span></>}
                        <span className="opacity-30">·</span><span>{rowCurrency}</span>
                        {row.provider === 'google_ads' && googleAdsAccountModeFromSettings(row) === 'mcc_managed' && (
                          <><span className="opacity-30">·</span><span>MCC managed</span></>
                        )}
                      </div>
                    </div>
                    {/* controls */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {/* currency mini-select */}
                      <div className="flex flex-col gap-[3px]">
                        <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] text-[#888] pl-0.5">Валюта</span>
                        <select
                          className="appearance-none border border-[#e7e7e7] rounded-lg bg-white px-2.5 py-1.5 font-inherit text-[12px] text-[#222] cursor-pointer h-[34px] pr-6"
                          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23898989' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center' }}
                          value={rowCurrency}
                          disabled={currencySavingId === row.id || isDeleting}
                          onChange={(e) => void onRowCurrencyChange(row, e.target.value as typeof rowCurrency)}
                        >
                          {INTEGRATION_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {/* google ads mode select */}
                      {row.provider === 'google_ads' && (
                        <div className="flex flex-col gap-[3px]">
                          <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] text-[#888] pl-0.5">Режим Google Ads</span>
                          <select
                            className="appearance-none border border-[#e7e7e7] rounded-lg bg-white px-2.5 py-1.5 font-inherit text-[11px] text-[#222] cursor-pointer h-[34px] pr-6"
                            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23898989' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center' }}
                            value={googleAdsAccountModeFromSettings(row)}
                            disabled={adsModeSavingId === row.id || isDeleting}
                            onChange={(e) => void onRowGoogleAdsAccountMode(row, e.target.value as GoogleAdsAccountMode)}
                          >
                            <option value="customer">Один рекламный аккаунт</option>
                            <option value="mcc_managed">Все клиентские счета по…</option>
                          </select>
                        </div>
                      )}
                      {/* sync lookback input */}
                      {rowSupportsAdsSyncLookback(row.provider) && (
                        <div className="flex flex-col gap-[3px]">
                          <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] text-[#888] pl-0.5">Синк, дн.</span>
                          <input
                            type="number"
                            min={ADS_SYNC_LOOKBACK_MIN}
                            max={ADS_SYNC_LOOKBACK_MAX}
                            placeholder={String(ADS_SYNC_LOOKBACK_DEFAULT)}
                            className="border border-[#e7e7e7] rounded-lg bg-white px-2.5 py-1.5 font-inherit text-[12px] text-[#222] h-[34px] w-[72px] outline-none focus:border-[#222]"
                            value={lookbackDraft[row.id] ?? (configuredAdsSyncLookbackDays(row) !== null ? String(configuredAdsSyncLookbackDays(row)) : '')}
                            disabled={lookbackSavingId === row.id || isDeleting}
                            onChange={(e) => setLookbackDraft((p) => ({ ...p, [row.id]: e.target.value }))}
                            onBlur={() => void onRowAdsLookbackCommit(row)}
                          />
                        </div>
                      )}
                      {/* sync button */}
                      <button
                        type="button"
                        disabled={!row.isActive || isSyncing || isDeleting}
                        onClick={() => onSync(row.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-[7px] border border-[#222] bg-[#222] text-white rounded-lg text-[12px] font-medium transition hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 4v5h-5"/></svg>
                        {isSyncing ? 'Синхр…' : 'Синхр.'}
                      </button>
                      {/* Google Ads OAuth reconnect */}
                      {row.provider === 'google_ads' && adsOAuthWizard && (
                        <button
                          type="button"
                          disabled={oauthRowId !== null || isDeleting}
                          onClick={() => void startGoogleAdsOAuthReconnect(row.id)}
                          className="w-[34px] h-[34px] border border-[#e7e7e7] rounded-lg bg-white text-[#555] flex items-center justify-center hover:border-[#222] hover:text-[#222] disabled:opacity-40"
                          title="Обновить доступ Google"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 00-2.1-1.2L14 3h-4l-.4 2.4a7 7 0 00-2.1 1.2L5.1 5.8l-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.8a7 7 0 002.1 1.2L10 21h4l.4-2.4a7 7 0 002.1-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/></svg>
                        </button>
                      )}
                      {/* GA4 OAuth reconnect */}
                      {rowIsGa4Provider(row.provider) && ga4OAuthWizard && (
                        <button
                          type="button"
                          disabled={oauthRowId !== null || isDeleting}
                          onClick={() => void startGa4OAuthReconnect(row.id)}
                          className="w-[34px] h-[34px] border border-[#e7e7e7] rounded-lg bg-white text-[#555] flex items-center justify-center hover:border-[#222] hover:text-[#222] disabled:opacity-40"
                          title="Обновить доступ GA4"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 00-2.1-1.2L14 3h-4l-.4 2.4a7 7 0 00-2.1 1.2L5.1 5.8l-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.8a7 7 0 002.1 1.2L10 21h4l.4-2.4a7 7 0 002.1-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/></svg>
                        </button>
                      )}
                      {/* delete */}
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => onDelete(row)}
                        className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-lg text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Удалить"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/></svg>
                      </button>
                    </div>
                  </div>
                  {/* MCC preview panel */}
                  {row.provider === 'google_ads' && managedPreviewIntegrationId === row.id && (
                    <div className="border-t border-[#e7e7e7] bg-[#fafafa] px-[18px] py-3 text-[11px] text-[#555]">
                      <div className="font-semibold text-[#888] mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em]">Управляемые аккаунты</div>
                      {managedPreviewBusy ? <div className="text-[#888]">…</div>
                        : managedPreviewErr ? <div className="text-red-700">{managedPreviewErr}</div>
                        : managedPreviewItems.length === 0 ? <div className="text-[#888]">{t('crm.marketingIntegrations.form.ads.managedCustomersEmpty')}</div>
                        : (
                          <ul className="max-h-52 overflow-auto space-y-1 font-mono text-[10px] mb-3">
                            {managedPreviewItems.map((c) => (
                              <li key={c.customerId}><span className="font-semibold">{c.customerId}</span>{c.descriptiveName ? ` — ${c.descriptiveName}` : ''}</li>
                            ))}
                          </ul>
                        )}
                      {!managedPreviewBusy && (
                        <div className="mt-2 space-y-3 pt-2 border-t border-[#e7e7e7]">
                          <label className="block">
                            <span className="text-[9.5px] font-semibold text-[#888] uppercase tracking-wide">{t('crm.marketingIntegrations.form.ads.managedSyncIncludeLabel')}</span>
                            <textarea className={`${inputCls} mt-1 min-h-[52px] resize-y font-mono text-[10px]`} rows={2}
                              value={mccIncludeDraft[row.id] ?? formatGoogleAdsManagedIdList((row.settings as Record<string, unknown> | undefined)?.googleAdsManagedCustomerIds)}
                              onChange={(e) => setMccIncludeDraft((p) => ({ ...p, [row.id]: e.target.value }))}
                              disabled={mccFilterSavingId === row.id || syncingId !== null || isDeleting || adsModeSavingId === row.id || oauthRowId !== null}
                            />
                          </label>
                          <label className="block">
                            <span className="text-[9.5px] font-semibold text-[#888] uppercase tracking-wide">{t('crm.marketingIntegrations.form.ads.managedSyncExcludeLabel')}</span>
                            <textarea className={`${inputCls} mt-1 min-h-[52px] resize-y font-mono text-[10px]`} rows={2}
                              value={mccExcludeDraft[row.id] ?? formatGoogleAdsManagedIdList((row.settings as Record<string, unknown> | undefined)?.googleAdsExcludedManagedCustomerIds)}
                              onChange={(e) => setMccExcludeDraft((p) => ({ ...p, [row.id]: e.target.value }))}
                              disabled={mccFilterSavingId === row.id || syncingId !== null || isDeleting || adsModeSavingId === row.id || oauthRowId !== null}
                            />
                          </label>
                          <button type="button" className={`${btnSecondary} px-3 py-2`}
                            disabled={mccFilterSavingId === row.id || syncingId !== null || isDeleting || adsModeSavingId === row.id || oauthRowId !== null}
                            onClick={() => void onSaveMccSyncFilters(row)}
                          >
                            {mccFilterSavingId === row.id ? '…' : t('crm.marketingIntegrations.form.ads.managedSyncFiltersSave')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── PROVIDER CATALOG ── */}
          <div className="flex items-center gap-2.5 mb-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium whitespace-nowrap">
              Доступные источники
            </span>
            <div className="flex-1 h-px bg-[#f0f0f0]" />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            {PROVIDER_KEYS.map((pk) => {
              const pm = PROVIDER_META[pk];
              const connectedCount = list.filter((r) => r.provider === pk).length;
              const isConnected = connectedCount > 0;
              const provLabel = providerOptions.find((o) => o.key === pk)?.label ?? pk;
              const lcClass = pm.status === 'live'
                ? 'text-[#1f8a5e] border-[#c5e3d2] bg-[#eaf4ee]'
                : 'text-[#7a4a09] border-[#f0d9a8] bg-[#fbf2dc]';
              return (
                <div
                  key={pk}
                  className="border border-[#e7e7e7] rounded-[14px] bg-white p-[18px] flex flex-col transition-all duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.16)]"
                  style={isConnected ? { borderTop: `3px solid ${pm.brand}` } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-[42px] h-[42px] rounded-[11px] flex items-center justify-center text-white font-bold text-[16px] shrink-0" style={{ background: pm.brand }}>
                      {pm.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[15px] font-semibold tracking-tight text-[#222] truncate">{provLabel}</span>
                        <span className={`font-mono text-[9px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded-full border shrink-0 ${lcClass}`}>
                          {pm.status}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-[#888] mt-0.5">{pm.ds}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-[#f0f0f0]">
                    <div className="font-mono text-[10.5px] text-[#888]">
                      {isConnected ? <><strong className="text-[#222] font-semibold">{connectedCount}</strong> подключён{connectedCount > 1 ? 'о' : ''}</> : 'Не подключён'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAddProvider(pk);
                        setProvider(pk);
                        const o = providerOptions.find((x) => x.key === pk);
                        if (o) setName(o.label);
                      }}
                      className={isConnected
                        ? 'inline-flex items-center gap-1.5 px-3 py-[6px] rounded-lg border border-[#e7e7e7] text-[12px] font-medium text-[#222] bg-white hover:border-[#222] transition-colors'
                        : 'inline-flex items-center gap-1.5 px-3 py-[6px] rounded-lg bg-[#222] text-white text-[12px] font-medium hover:bg-black transition-colors'
                      }
                    >
                      {isConnected ? 'Ещё аккаунт' : '+ Подключить'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── INLINE ADD FORM ── */}
          {activeAddProvider && (
            <div className="border border-[#e7e7e7] rounded-2xl bg-white overflow-hidden mb-4" id="mk-add-form">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e7e7e7]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-bold text-[14px]" style={{ background: PROVIDER_META[activeAddProvider].brand }}>
                    {PROVIDER_META[activeAddProvider].logo}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-[#222] tracking-tight">{t('crm.marketingIntegrations.form.title')}</div>
                    <div className="font-mono text-[10px] text-[#888]">{providerOptions.find((o) => o.key === activeAddProvider)?.label}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveAddProvider(null)}
                  className="w-8 h-8 rounded-lg bg-[#f5f5f5] border-0 text-[#555] flex items-center justify-center hover:bg-[#e7e7e7]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12"/><path d="M6 18L18 6"/></svg>
                </button>
              </div>
              <div className="px-5 py-5">
                <form onSubmit={onCreate} className="space-y-4">
                  <div>
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.name')}</label>
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off"/>
                  </div>
                  {activeAddProvider === 'google_ads' && (
                    <div>
                      <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.accountModeLabel')}</label>
                      <select className={inputCls} value={googleAdsAccountModeCreate} onChange={(e) => setGoogleAdsAccountModeCreate(e.target.value as GoogleAdsAccountMode)}>
                        <option value="customer">{t('crm.marketingIntegrations.form.ads.accountModeCustomer')}</option>
                        <option value="mcc_managed">{t('crm.marketingIntegrations.form.ads.accountModeMccManaged')}</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.primaryId')}</label>
                    <input className={inputCls} value={primaryId} onChange={(e) => setPrimaryId(e.target.value)} autoComplete="off"
                      placeholder={activeAddProvider === 'google_ads' ? '123-456-7890' : activeAddProvider === 'meta_ads' ? 'act_1234567890' : activeAddProvider === 'google_analytics' ? 'properties/287654901' : '12345678'}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.currencyLabel', { defaultValue: 'Валюта сумм (cost / revenue)' })}</label>
                    <select className={inputCls} value={integrationCurrency} onChange={(e) => setIntegrationCurrency(e.target.value as typeof integrationCurrency)}>
                      {INTEGRATION_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {/* GA4 OAuth */}
                  {activeAddProvider === 'google_analytics' && ga4OAuthWizard && adsPlatformOAuth && (
                    <div className={`${credentialsShell} text-[11px] text-[#222222]/70 leading-relaxed`}>{t('crm.marketingIntegrations.form.ga.oauthWizardBanner')}</div>
                  )}
                  {activeAddProvider === 'google_analytics' && ga4OAuthWizard && adsPlatformOAuth ? (
                    <details className="rounded-xl border border-[#222222]/10 bg-white/70 px-3 py-2"><summary className="cursor-pointer select-none text-[11px] font-semibold text-[#222222]/65">{t('crm.marketingIntegrations.form.ga.manualServiceAccountToggle')}</summary><div className={`${credentialsBlock} mt-3 border-0 shadow-none p-0`}><label className={labelCls}>{t('crm.marketingIntegrations.form.ga.serviceAccount')}</label><textarea className={`${inputCls} min-h-[120px] font-mono text-[12px]`} value={gaJson} onChange={(e) => setGaJson(e.target.value)} spellCheck={false}/></div></details>
                  ) : activeAddProvider === 'google_analytics' ? (
                    <div className={credentialsBlock}><label className={labelCls}>{t('crm.marketingIntegrations.form.ga.serviceAccount')}</label><textarea className={`${inputCls} min-h-[120px] font-mono text-[12px]`} value={gaJson} onChange={(e) => setGaJson(e.target.value)} spellCheck={false}/></div>
                  ) : null}
                  {/* Google Ads creds */}
                  {activeAddProvider === 'google_ads' && (adsPlatformOAuth || adsPlatformDev) && (
                    <div className={`${credentialsShell} text-[11px] text-[#222222]/70 leading-relaxed`}>{t('crm.marketingIntegrations.form.ads.platformManagedBanner')}</div>
                  )}
                  {activeAddProvider === 'google_ads' && (
                    <div className={credentialsGrid}>
                      {!adsPlatformDev && <div className="sm:col-span-2"><label className={labelCls}>{t('crm.marketingIntegrations.form.ads.developerToken')}</label><input type="password" autoComplete="new-password" className={inputCls} value={adsDev} onChange={(e) => setAdsDev(e.target.value)}/></div>}
                      {!adsPlatformOAuth && <><div><label className={labelCls}>{t('crm.marketingIntegrations.form.ads.clientId')}</label><input className={inputCls} value={adsClientId} onChange={(e) => setAdsClientId(e.target.value)}/></div><div><label className={labelCls}>{t('crm.marketingIntegrations.form.ads.clientSecret')}</label><input type="password" className={inputCls} value={adsClientSecret} onChange={(e) => setAdsClientSecret(e.target.value)}/></div></>}
                      {adsOAuthWizard && adsPlatformOAuth ? (
                        <details className="sm:col-span-2 rounded-xl border border-[#222222]/10 bg-white/70 px-3 py-2"><summary className="cursor-pointer select-none text-[11px] font-semibold text-[#222222]/65">{t('crm.marketingIntegrations.oauth.manualRefreshToggle')}</summary><div className="mt-3 space-y-1.5"><label className={labelCls}>{t('crm.marketingIntegrations.form.ads.refreshToken')}</label><input type="password" autoComplete="new-password" className={inputCls} value={adsRefresh} onChange={(e) => setAdsRefresh(e.target.value)}/></div></details>
                      ) : (
                        <div className="sm:col-span-2"><label className={labelCls}>{t('crm.marketingIntegrations.form.ads.refreshToken')}</label><input type="password" autoComplete="new-password" className={inputCls} value={adsRefresh} onChange={(e) => setAdsRefresh(e.target.value)}/></div>
                      )}
                      <div className="sm:col-span-2"><label className={labelCls}>{t('crm.marketingIntegrations.form.ads.loginCustomerId')}</label><input className={inputCls} value={adsLoginCustomer} onChange={(e) => setAdsLoginCustomer(e.target.value)}/></div>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.ads.source')}</label><input className={inputCls} value={adsSource} onChange={(e) => setAdsSource(e.target.value)}/></div>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.ads.medium')}</label><input className={inputCls} value={adsMedium} onChange={(e) => setAdsMedium(e.target.value)}/></div>
                    </div>
                  )}
                  {/* Meta creds */}
                  {activeAddProvider === 'meta_ads' && metaPlatformApp && <div className={`${credentialsShell} text-[11px] text-[#222222]/70 leading-relaxed`}>{t('crm.marketingIntegrations.form.meta.platformAppBanner')}</div>}
                  {activeAddProvider === 'meta_ads' && (
                    <div className={credentialsGrid}>
                      <div className="sm:col-span-2"><label className={labelCls}>{t('crm.marketingIntegrations.form.meta.accessToken')}</label><input type="password" autoComplete="new-password" className={inputCls} value={metaToken} onChange={(e) => setMetaToken(e.target.value)}/></div>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.meta.conversionAction')}</label><input className={inputCls} value={metaConv} onChange={(e) => setMetaConv(e.target.value)}/></div>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.meta.revenueAction')}</label><input className={inputCls} value={metaRevAct} onChange={(e) => setMetaRevAct(e.target.value)}/></div>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.meta.source')}</label><input className={inputCls} value={metaSource} onChange={(e) => setMetaSource(e.target.value)}/></div>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.meta.medium')}</label><input className={inputCls} value={metaMedium} onChange={(e) => setMetaMedium(e.target.value)}/></div>
                    </div>
                  )}
                  {/* Yandex Metrika creds */}
                  {activeAddProvider === 'yandex_metrika' && (
                    <div className={`${credentialsBlock} space-y-3`}>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.ym.token')}</label><input type="password" autoComplete="new-password" className={inputCls} value={ymToken} onChange={(e) => setYmToken(e.target.value)}/></div>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.ym.goalId')}</label><input className={inputCls} value={ymGoal} onChange={(e) => setYmGoal(e.target.value)}/></div>
                      <div><label className={labelCls}>{t('crm.marketingIntegrations.form.ym.revenueMetric')}</label><input className={inputCls} value={ymRev} onChange={(e) => setYmRev(e.target.value)}/></div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap sm:items-center pt-1">
                    {activeAddProvider === 'google_ads' && adsOAuthWizard && (
                      <button type="button" onClick={() => void startGoogleAdsOAuthCreate()} disabled={creating} className={`${btnPrimary} w-full sm:w-auto`}>
                        {t('crm.marketingIntegrations.oauth.connectWithGoogle')}
                      </button>
                    )}
                    {activeAddProvider === 'google_analytics' && ga4OAuthWizard && (
                      <button type="button" onClick={() => void startGa4OAuthCreate()} disabled={creating} className={`${btnPrimary} w-full sm:w-auto`}>
                        {t('crm.marketingIntegrations.ga4.oauth.connectWithGoogle')}
                      </button>
                    )}
                    <button type="submit" disabled={creating}
                      className={`${((activeAddProvider === 'google_ads' && adsOAuthWizard) || (activeAddProvider === 'google_analytics' && ga4OAuthWizard)) ? btnSecondary : btnPrimary} w-full sm:w-auto`}>
                      {creating ? t('crm.marketingIntegrations.actions.creating') : t('crm.marketingIntegrations.actions.create')}
                    </button>
                    <button type="button" onClick={() => setActiveAddProvider(null)} className={`${btnSecondary} w-full sm:w-auto`}>
                      {t('crm.automations.form.builderUi.cancel', { defaultValue: 'Отмена' })}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {!embedded && <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-2 xl:gap-8">
        <section className={`min-w-0 ${formPanel}`}>
          <h2 className={marketingSectionTitle}>{t('crm.marketingIntegrations.form.title')}</h2>
          <p className={`${marketingSectionSub} mb-5`}>{t('crm.marketingIntegrations.form.intro')}</p>
          <form onSubmit={onCreate} className="space-y-4">
            <div>
              <label className={labelCls}>{t('crm.marketingIntegrations.form.provider')}</label>
              <select
                value={provider}
                onChange={(e) => {
                  const v = e.target.value as ProviderKey;
                  setProvider(v);
                  const o = providerOptions.find((x) => x.key === v);
                  if (o) setName(o.label);
                }}
                className={inputCls}
              >
                {providerOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('crm.marketingIntegrations.form.name')}</label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
            {provider === 'google_ads' && (
              <div>
                <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.accountModeLabel')}</label>
                <select
                  className={inputCls}
                  value={googleAdsAccountModeCreate}
                  onChange={(e) =>
                    setGoogleAdsAccountModeCreate(e.target.value as GoogleAdsAccountMode)
                  }
                >
                  <option value="customer">
                    {t('crm.marketingIntegrations.form.ads.accountModeCustomer')}
                  </option>
                  <option value="mcc_managed">
                    {t('crm.marketingIntegrations.form.ads.accountModeMccManaged')}
                  </option>
                </select>
                {googleAdsAccountModeCreate === 'mcc_managed' && (
                  <p className="mt-1.5 text-[10px] text-[#222222]/50 leading-relaxed">
                    {t('crm.marketingIntegrations.form.ads.accountModeMccLead')}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className={labelCls}>{t('crm.marketingIntegrations.form.primaryId')}</label>
              <input
                className={inputCls}
                value={primaryId}
                onChange={(e) => setPrimaryId(e.target.value)}
                placeholder={
                  provider === 'google_ads'
                    ? googleAdsAccountModeCreate === 'mcc_managed'
                      ? t('crm.marketingIntegrations.form.ads.primaryIdPlaceholderMcc')
                      : t('crm.marketingIntegrations.form.primaryIdHintGoogleAds')
                    : provider === 'google_analytics' && ga4OAuthWizard
                      ? t('crm.marketingIntegrations.form.primaryIdHintGa4')
                      : t('crm.marketingIntegrations.form.primaryIdHint')
                }
                autoComplete="off"
              />
            </div>

            <div>
              <label className={labelCls}>
                {t('crm.marketingIntegrations.form.currencyLabel', {
                  defaultValue: 'Валюта сумм (cost / revenue в трафике)',
                })}
              </label>
              <select
                className={inputCls}
                value={integrationCurrency}
                onChange={(e) =>
                  setIntegrationCurrency(e.target.value as IntegrationCurrencyCode)
                }
              >
                {INTEGRATION_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] text-[#222222]/50 leading-relaxed">
                {t('crm.marketingIntegrations.form.currencyHint', {
                  defaultValue:
                    'При синхронизации в CRM пишется эта валюта. На экране «Трафик» значения пересчитываются в валюту отчёта по курсу Frankfurter (ECB).',
                })}
              </p>
            </div>

            {provider === 'google_analytics' && ga4OAuthWizard && adsPlatformOAuth && (
              <div
                className={`${credentialsShell} text-[11px] text-[#222222]/70 leading-relaxed`}
                role="status"
              >
                {t('crm.marketingIntegrations.form.ga.oauthWizardBanner')}
              </div>
            )}

            {provider === 'google_analytics' && ga4OAuthWizard && adsPlatformOAuth ? (
              <details className="rounded-xl border border-[#222222]/10 bg-white/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <summary className="cursor-pointer select-none text-[11px] font-semibold text-[#222222]/65">
                  {t('crm.marketingIntegrations.form.ga.manualServiceAccountToggle')}
                </summary>
                <div className={`${credentialsBlock} mt-3 border-0 shadow-none p-0`}>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ga.serviceAccount')}</label>
                  <textarea
                    className={`${inputCls} min-h-[120px] font-mono text-[12px]`}
                    value={gaJson}
                    onChange={(e) => setGaJson(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              </details>
            ) : (
              provider === 'google_analytics' && (
                <div className={credentialsBlock}>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ga.serviceAccount')}</label>
                  <textarea
                    className={`${inputCls} min-h-[120px] font-mono text-[12px]`}
                    value={gaJson}
                    onChange={(e) => setGaJson(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              )
            )}

            {provider === 'google_ads' && (adsPlatformOAuth || adsPlatformDev) && (
              <div
                className={`${credentialsShell} text-[11px] text-[#222222]/70 leading-relaxed`}
                role="status"
              >
                {t('crm.marketingIntegrations.form.ads.platformManagedBanner')}
              </div>
            )}

            {provider === 'google_ads' && (
              <div className={credentialsGrid}>
                {!adsPlatformDev && (
                  <div className="sm:col-span-2">
                    <label className={labelCls}>
                      {t('crm.marketingIntegrations.form.ads.developerToken')}
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={inputCls}
                      value={adsDev}
                      onChange={(e) => setAdsDev(e.target.value)}
                    />
                  </div>
                )}
                {!adsPlatformOAuth && (
                  <>
                    <div>
                      <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.clientId')}</label>
                      <input
                        className={inputCls}
                        value={adsClientId}
                        onChange={(e) => setAdsClientId(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.clientSecret')}</label>
                      <input
                        type="password"
                        className={inputCls}
                        value={adsClientSecret}
                        onChange={(e) => setAdsClientSecret(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {adsOAuthWizard && adsPlatformOAuth ? (
                  <details className="sm:col-span-2 rounded-xl border border-[#222222]/10 bg-white/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                    <summary className="cursor-pointer select-none text-[11px] font-semibold text-[#222222]/65">
                      {t('crm.marketingIntegrations.oauth.manualRefreshToggle')}
                    </summary>
                    <div className="mt-3 space-y-1.5">
                      <label className={labelCls}>
                        {t('crm.marketingIntegrations.form.ads.refreshToken')}
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        className={inputCls}
                        value={adsRefresh}
                        onChange={(e) => setAdsRefresh(e.target.value)}
                      />
                    </div>
                  </details>
                ) : (
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.refreshToken')}</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={inputCls}
                      value={adsRefresh}
                      onChange={(e) => setAdsRefresh(e.target.value)}
                    />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.loginCustomerId')}</label>
                  <input
                    className={inputCls}
                    value={adsLoginCustomer}
                    onChange={(e) => setAdsLoginCustomer(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.source')}</label>
                  <input className={inputCls} value={adsSource} onChange={(e) => setAdsSource(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.medium')}</label>
                  <input className={inputCls} value={adsMedium} onChange={(e) => setAdsMedium(e.target.value)} />
                </div>
              </div>
            )}

            {provider === 'yandex_metrika' && (
              <div className={`${credentialsBlock} space-y-3`}>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ym.token')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputCls}
                    value={ymToken}
                    onChange={(e) => setYmToken(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ym.goalId')}</label>
                  <input className={inputCls} value={ymGoal} onChange={(e) => setYmGoal(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ym.revenueMetric')}</label>
                  <input className={inputCls} value={ymRev} onChange={(e) => setYmRev(e.target.value)} />
                </div>
              </div>
            )}

            {provider === 'meta_ads' && metaPlatformApp && (
              <div
                className={`${credentialsShell} text-[11px] text-[#222222]/70 leading-relaxed`}
                role="status"
              >
                {t('crm.marketingIntegrations.form.meta.platformAppBanner')}
              </div>
            )}

            {provider === 'meta_ads' && (
              <div className={credentialsGrid}>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.meta.accessToken')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputCls}
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.meta.conversionAction')}</label>
                  <input className={inputCls} value={metaConv} onChange={(e) => setMetaConv(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.meta.revenueAction')}</label>
                  <input className={inputCls} value={metaRevAct} onChange={(e) => setMetaRevAct(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.meta.source')}</label>
                  <input className={inputCls} value={metaSource} onChange={(e) => setMetaSource(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.meta.medium')}</label>
                  <input className={inputCls} value={metaMedium} onChange={(e) => setMetaMedium(e.target.value)} />
                </div>
              </div>
            )}

            <p className="text-[10px] text-[#222222]/50 leading-relaxed">
              {t('crm.marketingIntegrations.form.note')}
            </p>

            <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap sm:items-center">
              {provider === 'google_ads' && adsOAuthWizard && (
                <button
                  type="button"
                  onClick={() => void startGoogleAdsOAuthCreate()}
                  disabled={creating}
                  className={`${btnPrimary} w-full sm:w-auto`}
                >
                  {t('crm.marketingIntegrations.oauth.connectWithGoogle')}
                </button>
              )}
              {provider === 'google_analytics' && ga4OAuthWizard && (
                <button
                  type="button"
                  onClick={() => void startGa4OAuthCreate()}
                  disabled={creating}
                  className={`${btnPrimary} w-full sm:w-auto`}
                >
                  {t('crm.marketingIntegrations.ga4.oauth.connectWithGoogle')}
                </button>
              )}
              <button
                type="submit"
                disabled={creating}
                className={`${
                  (provider === 'google_ads' && adsOAuthWizard) ||
                  (provider === 'google_analytics' && ga4OAuthWizard)
                    ? btnSecondary
                    : btnPrimary
                } w-full sm:w-auto`}
              >
                {creating
                  ? t('crm.marketingIntegrations.actions.creating')
                  : (provider === 'google_ads' && adsOAuthWizard) ||
                      (provider === 'google_analytics' && ga4OAuthWizard)
                    ? t('crm.marketingIntegrations.oauth.createManualSubmit')
                    : t('crm.marketingIntegrations.actions.create')}
              </button>
            </div>
            {provider === 'google_ads' && adsOAuthWizard && (
              <p className="text-[10px] text-[#222222]/50 leading-relaxed max-w-xl">
                {t('crm.marketingIntegrations.oauth.createHint')}
              </p>
            )}
            {provider === 'google_analytics' && ga4OAuthWizard && (
              <p className="text-[10px] text-[#222222]/50 leading-relaxed max-w-xl">
                {t('crm.marketingIntegrations.ga4.oauth.createHint')}
              </p>
            )}
          </form>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="border-b border-[#222222]/10 pb-3">
            <h2 className={marketingSectionTitle}>{t('crm.marketingIntegrations.table.title')}</h2>
            <p className={marketingSectionSub}>{t('crm.marketingIntegrations.table.subtitle')}</p>
            <p className="text-[11px] font-medium text-[#222222]/40 mt-2">
              {t('crm.marketingIntegrations.table.total', { count: list.length })}
            </p>
          </div>

          {loading && (
            <div className="text-[11px] text-[#222222]/50">{t('crm.marketingIntegrations.loading')}</div>
          )}

          {!loading && list.length === 0 && (
            <div
              className={`${marketingCard} border-dashed border-[#222222]/20 bg-slate-50/50 text-[11px] text-[#222222]/55`}
            >
              {t('crm.marketingIntegrations.table.empty')}
            </div>
          )}

          <div className="space-y-3">
            {list.map((row) => (
              <div
                key={row.id}
                className={`${marketingCard} flex flex-wrap items-stretch gap-0 p-0 overflow-hidden shadow-[0_10px_36px_rgba(34,34,34,0.07)] hover:shadow-[0_14px_44px_rgba(34,34,34,0.09)] transition-shadow`}
              >
                <div className="w-1 shrink-0 bg-[#222222]" aria-hidden />
                <div className="min-w-0 flex-1 py-4 pl-4 pr-3">
                  <div className="text-sm font-semibold text-[#222222] truncate">{row.name}</div>
                  <div className="text-[11px] text-[#222222]/50 mt-1 leading-snug">
                    {marketingDataSourceLabel(t, row.provider)} · {row.kind}
                    {row.primaryId ? ` · ${row.primaryId}` : ''} ·{' '}
                    {row.isActive
                      ? t('crm.marketingIntegrations.status.enabled')
                      : t('crm.marketingIntegrations.status.disabled')}
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-end gap-2 sm:gap-3 py-3 pr-4 pl-2 border-t sm:border-t-0 sm:border-l border-[#222222]/10 bg-slate-50/40">
                  <label className="flex min-w-[88px] max-w-[140px] flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-[#222222]/45 px-0.5">
                      {t('crm.marketingIntegrations.table.currencyShort', { defaultValue: 'Валюта' })}
                    </span>
                    <select
                      className="mt-0 w-full rounded-xl border border-[#222222]/16 bg-white px-2.5 py-2 text-[12px] font-medium text-[#222222] outline-none h-10 shadow-[inset_0_1px_2px_rgba(34,34,34,0.04)] focus:border-[#222222] focus:ring-2 focus:ring-[#222222]/10"
                      value={currencyFromRow(row)}
                      disabled={
                        currencySavingId === row.id ||
                        lookbackSavingId === row.id ||
                        adsModeSavingId === row.id ||
                        deletingId !== null
                      }
                      onChange={(e) => {
                        const v = e.target.value as IntegrationCurrencyCode;
                        void onRowCurrencyChange(row, v);
                      }}
                    >
                      {INTEGRATION_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  {row.provider === 'google_ads' && (
                    <label className="flex min-w-[120px] max-w-[174px] flex-col gap-1">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-[#222222]/45 px-0.5">
                        {t('crm.marketingIntegrations.form.ads.accountModeLabel')}
                      </span>
                      <select
                        className="mt-0 w-full rounded-xl border border-[#222222]/16 bg-white px-2 py-2 text-[11px] font-medium text-[#222222] outline-none h-10 shadow-[inset_0_1px_2px_rgba(34,34,34,0.04)] focus:border-[#222222] focus:ring-2 focus:ring-[#222222]/10"
                        value={googleAdsAccountModeFromSettings(row)}
                        disabled={
                          adsModeSavingId === row.id ||
                          currencySavingId === row.id ||
                          lookbackSavingId === row.id ||
                          syncingId !== null ||
                          deletingId !== null
                        }
                        onChange={(e) =>
                          void onRowGoogleAdsAccountMode(
                            row,
                            e.target.value as GoogleAdsAccountMode,
                          )
                        }
                      >
                        <option value="customer">
                          {t('crm.marketingIntegrations.form.ads.accountModeCustomer')}
                        </option>
                        <option value="mcc_managed">
                          {t('crm.marketingIntegrations.form.ads.accountModeMccManaged')}
                        </option>
                      </select>
                    </label>
                  )}
                  {row.provider === 'google_ads' &&
                    googleAdsAccountModeFromSettings(row) === 'mcc_managed' && (
                      <button
                        type="button"
                        className={`${btnSecondary} h-10 shrink-0 self-end px-3 max-w-[9.5rem] text-center leading-snug`}
                        disabled={
                          !row.isActive || oauthRowId !== null || adsModeSavingId === row.id
                        }
                        onClick={() => void onToggleManagedCustomersPreview(row.id)}
                      >
                        {managedPreviewBusy && managedPreviewIntegrationId === row.id
                          ? '…'
                          : managedPreviewIntegrationId === row.id
                            ? t('crm.marketingIntegrations.form.ads.managedCustomersHide')
                            : t('crm.marketingIntegrations.form.ads.managedCustomersButton')}
                      </button>
                    )}
                  {rowSupportsAdsSyncLookback(row.provider) && (
                    <label
                      className="flex min-w-[72px] max-w-[104px] flex-col gap-1"
                      title={t('crm.marketingIntegrations.table.syncLookbackHint', {
                        defaultDays: ADS_SYNC_LOOKBACK_DEFAULT,
                      })}
                    >
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-[#222222]/45 px-0.5">
                        {t('crm.marketingIntegrations.table.syncLookbackShort')}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={ADS_SYNC_LOOKBACK_MIN}
                        max={ADS_SYNC_LOOKBACK_MAX}
                        placeholder={String(ADS_SYNC_LOOKBACK_DEFAULT)}
                        className="mt-0 w-full rounded-xl border border-[#222222]/16 bg-white px-2.5 py-2 text-[12px] font-medium text-[#222222] outline-none h-10 shadow-[inset_0_1px_2px_rgba(34,34,34,0.04)] focus:border-[#222222] focus:ring-2 focus:ring-[#222222]/10"
                        value={
                          lookbackDraft[row.id] ??
                          (configuredAdsSyncLookbackDays(row) !== null
                            ? String(configuredAdsSyncLookbackDays(row))
                            : '')
                        }
                        disabled={
                          lookbackSavingId === row.id ||
                          currencySavingId === row.id ||
                          adsModeSavingId === row.id ||
                          deletingId !== null
                        }
                        onChange={(e) =>
                          setLookbackDraft((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                        onBlur={() => void onRowAdsLookbackCommit(row)}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={
                      !row.isActive ||
                      syncingId !== null ||
                      currencySavingId === row.id ||
                      lookbackSavingId === row.id ||
                      adsModeSavingId === row.id
                    }
                    onClick={() => onSync(row.id)}
                    className="inline-flex h-10 shrink-0 items-center justify-center self-end rounded-xl bg-[#222222] px-4 text-[11px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {syncingId === row.id
                      ? t('crm.marketingIntegrations.actions.syncing')
                      : t('crm.common.sync', { defaultValue: 'Синхронизировать' })}
                  </button>
                  {row.provider === 'google_ads' && adsOAuthWizard && (
                    <button
                      type="button"
                      disabled={
                        oauthRowId !== null || deletingId !== null || adsModeSavingId === row.id
                      }
                      onClick={() => void startGoogleAdsOAuthReconnect(row.id)}
                      className={`${btnSecondary} h-10 shrink-0 self-end px-3`}
                    >
                      {oauthRowId === row.id
                        ? '…'
                        : t('crm.marketingIntegrations.oauth.reconnect')}
                    </button>
                  )}
                  {rowIsGa4Provider(row.provider) && ga4OAuthWizard && (
                    <button
                      type="button"
                      disabled={oauthRowId !== null || deletingId !== null}
                      onClick={() => void startGa4OAuthReconnect(row.id)}
                      className={`${btnSecondary} h-10 shrink-0 self-end px-3`}
                    >
                      {oauthRowId === row.id
                        ? '…'
                        : t('crm.marketingIntegrations.ga4.oauth.reconnect')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() => onDelete(row)}
                    className={`${btnDanger} h-10 shrink-0 self-end px-1`}
                  >
                    {deletingId === row.id ? '…' : t('crm.marketingIntegrations.actions.delete')}
                  </button>
                </div>
                {row.provider === 'google_ads' && managedPreviewIntegrationId === row.id && (
                  <div className="w-full shrink-0 border-t border-[#222222]/10 bg-white/65 px-4 py-3 text-[11px] text-[#222222]/85">
                    <div className="font-semibold text-[#222222]/65 mb-1.5">
                      {t('crm.marketingIntegrations.form.ads.managedCustomersCaption')}
                    </div>
                    {managedPreviewBusy ? (
                      <div className="text-[#222222]/50">…</div>
                    ) : managedPreviewErr ? (
                      <div className="text-red-700">{managedPreviewErr}</div>
                    ) : managedPreviewItems.length === 0 ? (
                      <div className="text-[#222222]/55">
                        {t('crm.marketingIntegrations.form.ads.managedCustomersEmpty')}
                      </div>
                    ) : (
                      <ul className="max-h-52 overflow-auto space-y-1 font-mono text-[10px]">
                        {managedPreviewItems.map((c) => (
                          <li key={c.customerId}>
                            <span className="font-semibold">{c.customerId}</span>
                            {c.descriptiveName ? ` — ${c.descriptiveName}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {googleAdsAccountModeFromSettings(row) === 'mcc_managed' &&
                      !managedPreviewBusy && (
                        <div className="mt-3 space-y-3 border-t border-[#222222]/10 pt-3">
                          <label className="block">
                            <span className="text-[10px] font-semibold text-[#222222]/55 uppercase tracking-wide">
                              {t(
                                'crm.marketingIntegrations.form.ads.managedSyncIncludeLabel',
                              )}
                            </span>
                            <textarea
                              className={`${inputCls} mt-1 min-h-[52px] resize-y font-mono text-[10px]`}
                              rows={2}
                              value={
                                mccIncludeDraft[row.id] ??
                                formatGoogleAdsManagedIdList(
                                  (row.settings as Record<string, unknown> | undefined)
                                    ?.googleAdsManagedCustomerIds,
                                )
                              }
                              onChange={(e) =>
                                setMccIncludeDraft((p) => ({
                                  ...p,
                                  [row.id]: e.target.value,
                                }))
                              }
                              disabled={
                                mccFilterSavingId === row.id ||
                                syncingId !== null ||
                                deletingId !== null ||
                                adsModeSavingId === row.id ||
                                oauthRowId !== null
                              }
                            />
                            <p className="mt-1 text-[10px] leading-relaxed text-[#222222]/45">
                              {t(
                                'crm.marketingIntegrations.form.ads.managedSyncIncludeHint',
                              )}
                            </p>
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-semibold text-[#222222]/55 uppercase tracking-wide">
                              {t(
                                'crm.marketingIntegrations.form.ads.managedSyncExcludeLabel',
                              )}
                            </span>
                            <textarea
                              className={`${inputCls} mt-1 min-h-[52px] resize-y font-mono text-[10px]`}
                              rows={2}
                              value={
                                mccExcludeDraft[row.id] ??
                                formatGoogleAdsManagedIdList(
                                  (row.settings as Record<string, unknown> | undefined)
                                    ?.googleAdsExcludedManagedCustomerIds,
                                )
                              }
                              onChange={(e) =>
                                setMccExcludeDraft((p) => ({
                                  ...p,
                                  [row.id]: e.target.value,
                                }))
                              }
                              disabled={
                                mccFilterSavingId === row.id ||
                                syncingId !== null ||
                                deletingId !== null ||
                                adsModeSavingId === row.id ||
                                oauthRowId !== null
                              }
                            />
                            <p className="mt-1 text-[10px] leading-relaxed text-[#222222]/45">
                              {t(
                                'crm.marketingIntegrations.form.ads.managedSyncExcludeHint',
                              )}
                            </p>
                          </label>
                          <button
                            type="button"
                            className={`${btnSecondary} px-3 py-2`}
                            disabled={
                              mccFilterSavingId === row.id ||
                              syncingId !== null ||
                              deletingId !== null ||
                              adsModeSavingId === row.id ||
                              oauthRowId !== null
                            }
                            onClick={() => void onSaveMccSyncFilters(row)}
                          >
                            {mccFilterSavingId === row.id
                              ? '…'
                              : t(
                                  'crm.marketingIntegrations.form.ads.managedSyncFiltersSave',
                                )}
                          </button>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>}
    </div>
  );
};
