import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  createMarketingIntegration,
  deleteMarketingIntegration,
  fetchMarketingIntegrations,
  syncMarketingIntegration,
  type MarketingIntegrationRow,
} from '../../api/marketing';
import { marketingDataSourceLabel } from '../../utils/marketingDataSourceLabel';

type ProviderKey = 'google_ads' | 'google_analytics' | 'yandex_metrika' | 'meta_ads';

const BRAND = '#222222';

const inputCls =
  'mt-1 w-full rounded-xl border border-[#222222]/18 bg-white px-3 py-2 text-[13px] text-[#222222] placeholder:text-[#222222]/35 outline-none transition focus:border-[#222222] focus:ring-2 focus:ring-[#222222]/10';
const labelCls = 'block text-[11px] font-medium text-[#222222]/65';
const cardCls =
  'rounded-2xl border border-[#222222]/12 bg-white p-5 shadow-[0_14px_48px_rgba(34,34,34,0.06)]';
const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-[#222222] px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40';
const btnDanger =
  'text-[11px] font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-40';

export const MarketingIntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [list, setList] = useState<MarketingIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
  const [adsCurrency, setAdsCurrency] = useState('');
  const [ymToken, setYmToken] = useState('');
  const [ymGoal, setYmGoal] = useState('');
  const [ymRev, setYmRev] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaConv, setMetaConv] = useState('');
  const [metaRevAct, setMetaRevAct] = useState('');
  const [metaSource, setMetaSource] = useState('');
  const [metaMedium, setMetaMedium] = useState('');
  const [metaCurrency, setMetaCurrency] = useState('');

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
    if (didInitName.current) return;
    didInitName.current = true;
    setName(t('crm.marketingIntegrations.providers.google_ads'));
  }, [t]);

  const buildCreatePayload = () => {
    const n = name.trim();
    const pid = primaryId.trim();
    if (provider === 'google_ads') {
      const settings: Record<string, string> = {};
      const put = (k: string, v: string) => {
        const t = v.trim();
        if (t) settings[k] = t;
      };
      put('developerToken', adsDev);
      put('clientId', adsClientId);
      put('clientSecret', adsClientSecret);
      put('refreshToken', adsRefresh);
      put('loginCustomerId', adsLoginCustomer);
      put('source', adsSource);
      put('medium', adsMedium);
      put('currency', adsCurrency);
      return {
        provider: 'google_ads',
        kind: 'ads',
        name: n,
        isActive: true,
        primaryId: pid || undefined,
        settings: Object.keys(settings).length ? settings : undefined,
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
      };
    }
    if (provider === 'yandex_metrika') {
      const settings: Record<string, string> = {};
      const put = (k: string, v: string) => {
        const t = v.trim();
        if (t) settings[k] = t;
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
        settings: Object.keys(settings).length ? settings : undefined,
      };
    }
    const settings: Record<string, string> = {};
    const put = (k: string, v: string) => {
      const s = v.trim();
      if (s) settings[k] = s;
    };
    put('accessToken', metaToken);
    put('conversionAction', metaConv);
    put('revenueAction', metaRevAct);
    put('source', metaSource);
    put('medium', metaMedium);
    put('currency', metaCurrency);
    return {
      provider: 'meta_ads',
      kind: 'ads',
      name: n,
      isActive: true,
      primaryId: pid || undefined,
      settings: Object.keys(settings).length ? settings : undefined,
    };
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('crm.marketingIntegrations.errors.sync');
      setError(msg);
    } finally {
      setSyncingId(null);
    }
  };

  const onDelete = async (row: MarketingIntegrationRow) => {
    if (!window.confirm(t('crm.marketingIntegrations.confirmDelete', { name: row.name }))) return;
    setDeletingId(row.id);
    setError(null);
    try {
      await deleteMarketingIntegration(row.id);
      await refreshList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.marketingIntegrations.errors.delete'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 pb-10 max-w-[1200px]">
        <header>
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-1"
            style={{ color: `${BRAND}99` }}
          >
            {t('crm.marketingIntegrations.kicker')}
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-[#222222]">
            {t('crm.marketingIntegrations.title')}
          </h1>
          <p className="text-sm text-[#222222]/70 mt-1 max-w-2xl">
            {t('crm.marketingIntegrations.subtitle')}
          </p>
          <p className="text-[11px] text-[#222222]/55 mt-2 max-w-2xl">{t('crm.marketingIntegrations.hint')}</p>
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
              <span>
                {t('crm.marketingIntegrations.syncResult', { count: lastSyncRows })}
              </span>
            ) : (
              <span>{t('crm.marketingIntegrations.syncZero')}</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className={`lg:col-span-5 ${cardCls}`}>
            <h2 className="text-sm font-semibold text-[#222222]">
              {t('crm.marketingIntegrations.form.title')}
            </h2>
            <p className="text-[11px] text-[#222222]/60 mt-1 mb-4">
              {t('crm.marketingIntegrations.form.intro')}
            </p>
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
                  placeholder={t('crm.marketingIntegrations.form.primaryIdHint')}
                  autoComplete="off"
                />
              </div>

              {provider === 'google_analytics' && (
                <div>
                  <label className={labelCls}>{t('crm.marketingIntegrations.form.ga.serviceAccount')}</label>
                  <textarea
                    className={`${inputCls} min-h-[120px] font-mono text-[12px]`}
                    value={gaJson}
                    onChange={(e) => setGaJson(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              )}

              {provider === 'google_ads' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.developerToken')}</label>
                    <input className={inputCls} value={adsDev} onChange={(e) => setAdsDev(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.clientId')}</label>
                    <input className={inputCls} value={adsClientId} onChange={(e) => setAdsClientId(e.target.value)} />
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
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.refreshToken')}</label>
                    <input className={inputCls} value={adsRefresh} onChange={(e) => setAdsRefresh(e.target.value)} />
                  </div>
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
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.ads.currency')}</label>
                    <input className={inputCls} value={adsCurrency} onChange={(e) => setAdsCurrency(e.target.value)} />
                  </div>
                </div>
              )}

              {provider === 'yandex_metrika' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.ym.token')}</label>
                    <input className={inputCls} value={ymToken} onChange={(e) => setYmToken(e.target.value)} />
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

              {provider === 'meta_ads' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.meta.accessToken')}</label>
                    <input className={inputCls} value={metaToken} onChange={(e) => setMetaToken(e.target.value)} />
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
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('crm.marketingIntegrations.form.meta.currency')}</label>
                    <input
                      className={inputCls}
                      value={metaCurrency}
                      onChange={(e) => setMetaCurrency(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-[#222222]/50 leading-relaxed">
                {t('crm.marketingIntegrations.form.note')}
              </p>

              <button type="submit" disabled={creating} className={`${btnPrimary} w-full sm:w-auto`}>
                {creating ? t('crm.marketingIntegrations.actions.creating') : t('crm.marketingIntegrations.actions.create')}
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[#222222]">
                {t('crm.marketingIntegrations.table.title')}
              </h2>
              <p className="text-[11px] text-[#222222]/60 mt-0.5">
                {t('crm.marketingIntegrations.table.subtitle')}
              </p>
              <p className="text-[11px] text-[#222222]/45 mt-1">
                {t('crm.marketingIntegrations.table.total', { count: list.length })}
              </p>
            </div>

            {loading && (
              <div className="text-[11px] text-[#222222]/50">{t('crm.marketingIntegrations.loading')}</div>
            )}

            {!loading && list.length === 0 && (
              <div className={`${cardCls} border-dashed text-[11px] text-[#222222]/55`}>
                {t('crm.marketingIntegrations.table.empty')}
              </div>
            )}

            <div className="space-y-2">
              {list.map((row) => (
                <div
                  key={row.id}
                  className={`${cardCls} py-4 flex flex-wrap items-center gap-3 justify-between`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#222222] truncate">{row.name}</div>
                    <div className="text-[11px] text-[#222222]/55 mt-0.5">
                      {marketingDataSourceLabel(t, row.provider)} · {row.kind}
                      {row.primaryId ? ` · ${row.primaryId}` : ''} ·{' '}
                      {row.isActive
                        ? t('crm.marketingIntegrations.status.enabled')
                        : t('crm.marketingIntegrations.status.disabled')}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={!row.isActive || syncingId !== null}
                      onClick={() => onSync(row.id)}
                      className={btnPrimary}
                    >
                      {syncingId === row.id
                        ? t('crm.marketingIntegrations.actions.syncing')
                        : t('crm.common.sync', { defaultValue: 'Синхронизировать' })}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId !== null}
                      onClick={() => onDelete(row)}
                      className={btnDanger}
                    >
                      {deletingId === row.id ? '…' : t('crm.marketingIntegrations.actions.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <p className="text-[10px] text-[#222222]/40 pt-4 border-t border-[#222222]/10">
          CRM UI build: <code className="text-[#222222]/50">{__CRM_FRONT_BUILD__}</code>
          {' · '}
          <code className="text-[#222222]/50">POST /v1/marketing/integrations</code>,{' '}
          <code className="text-[#222222]/50">POST …/sync</code>
        </p>
      </div>
    </MainLayout>
  );
};
