import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createMarketingIntegration,
  deleteMarketingIntegration,
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
  const embedded = variant === 'embedded';
  const modal = variant === 'modal';
  const [list, setList] = useState<MarketingIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currencySavingId, setCurrencySavingId] = useState<string | null>(null);
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
      const settings: Record<string, string> = { currency: cur };
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

  const onDelete = async (row: MarketingIntegrationRow) => {
    if (!window.confirm(t('crm.marketingIntegrations.confirmDelete', { name: row.name }))) return;
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

      <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-2 xl:gap-8">
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
            <div>
              <label className={labelCls}>{t('crm.marketingIntegrations.form.primaryId')}</label>
              <input
                className={inputCls}
                value={primaryId}
                onChange={(e) => setPrimaryId(e.target.value)}
                placeholder={
                  provider === 'google_ads' && adsPlatformOAuth
                    ? t('crm.marketingIntegrations.form.primaryIdHintGoogleAds')
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
                      disabled={currencySavingId === row.id || deletingId !== null}
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
                  <button
                    type="button"
                    disabled={!row.isActive || syncingId !== null || currencySavingId === row.id}
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
                      disabled={oauthRowId !== null || deletingId !== null}
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
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
