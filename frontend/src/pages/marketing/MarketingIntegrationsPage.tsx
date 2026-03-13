import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingIntegrations,
  createMarketingIntegration,
  updateMarketingIntegration,
  deleteMarketingIntegration,
  syncMarketingIntegration,
  type MarketingIntegration,
} from '../../api/marketing';

export const MarketingIntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MarketingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // форма добавления
  const [provider, setProvider] = useState('google_analytics');
  const [name, setName] = useState('Google Analytics 4');
  const [primaryId, setPrimaryId] = useState('');
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [gaServiceAccount, setGaServiceAccount] = useState('');
  const [gaConversionEvent, setGaConversionEvent] = useState('');
  const [gaRevenueMetric, setGaRevenueMetric] = useState('');
  const [ymToken, setYmToken] = useState('');
  const [ymGoalId, setYmGoalId] = useState('');
  const [ymRevenueMetric, setYmRevenueMetric] = useState('');
  const [adsDeveloperToken, setAdsDeveloperToken] = useState('');
  const [adsClientId, setAdsClientId] = useState('');
  const [adsClientSecret, setAdsClientSecret] = useState('');
  const [adsRefreshToken, setAdsRefreshToken] = useState('');
  const [adsLoginCustomerId, setAdsLoginCustomerId] = useState('');
  const [adsCurrency, setAdsCurrency] = useState('');
  const [adsSource, setAdsSource] = useState('');
  const [adsMedium, setAdsMedium] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaConversionAction, setMetaConversionAction] = useState('');
  const [metaRevenueAction, setMetaRevenueAction] = useState('');
  const [metaCurrency, setMetaCurrency] = useState('');
  const [metaSource, setMetaSource] = useState('');
  const [metaMedium, setMetaMedium] = useState('');

  const providerLabel = (value: string) =>
    t(`crm.marketingIntegrations.providers.${value}`, value);

  const baseColumns = useMemo(
    () => [
      { id: 'name', label: t('crm.marketingIntegrations.table.headers.name') },
      {
        id: 'provider',
        label: t('crm.marketingIntegrations.table.headers.provider'),
      },
      {
        id: 'primaryId',
        label: t('crm.marketingIntegrations.table.headers.primaryId'),
      },
      {
        id: 'status',
        label: t('crm.marketingIntegrations.table.headers.status'),
      },
      {
        id: 'actions',
        label: t('crm.marketingIntegrations.table.headers.actions'),
      },
    ],
    [t],
  );

  const orderedColumns = useMemo(() => {
    if (!baseColumns.length) return [];
    const map = new Map(baseColumns.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : baseColumns.map((col) => col.id);
    const result: typeof baseColumns = [];
    order.forEach((id) => {
      const col = map.get(id);
      if (col) result.push(col);
    });
    baseColumns.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [baseColumns, columnOrder]);

  useEffect(() => {
    setLoading(true);
    fetchMarketingIntegrations()
      .then(setItems)
      .catch((e: any) => {
        console.error(e);
        setError(
          e?.message || t('crm.marketingIntegrations.errors.load'),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('marketing_integrations_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setColumnWidths(parsed.widths);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'marketing_integrations_columns',
        JSON.stringify({ order: columnOrder, widths: columnWidths }),
      );
    } catch {
      // ignore
    }
  }, [columnOrder, columnWidths]);

  useEffect(() => {
    if (!baseColumns.length) return;
    setColumnOrder((prev) => {
      if (!prev.length) return baseColumns.map((c) => c.id);
      const ids = baseColumns.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    });
  }, [baseColumns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const next = Math.max(90, resizing.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.id]: next }));
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  const onCreate = async () => {
    if (!name.trim()) {
      alert(t('crm.marketingIntegrations.errors.requiredName'));
      return;
    }

    const settings: Record<string, any> = {};
    if (provider === 'google_analytics') {
      settings.serviceAccountJson = gaServiceAccount.trim() || null;
      settings.conversionEvent = gaConversionEvent.trim() || null;
      settings.revenueMetric = gaRevenueMetric.trim() || null;
      settings.propertyId = primaryId.trim() || null;
    } else if (provider === 'yandex_metrika') {
      settings.token = ymToken.trim() || null;
      settings.goalId = ymGoalId.trim() || null;
      settings.revenueMetric = ymRevenueMetric.trim() || null;
      settings.counterId = primaryId.trim() || null;
    } else if (provider === 'google_ads') {
      settings.customerId = primaryId.trim() || null;
      settings.developerToken = adsDeveloperToken.trim() || null;
      settings.clientId = adsClientId.trim() || null;
      settings.clientSecret = adsClientSecret.trim() || null;
      settings.refreshToken = adsRefreshToken.trim() || null;
      settings.loginCustomerId = adsLoginCustomerId.trim() || null;
      settings.currency = adsCurrency.trim() || null;
      settings.source = adsSource.trim() || null;
      settings.medium = adsMedium.trim() || null;
    } else if (provider === 'meta_ads') {
      settings.accessToken = metaToken.trim() || null;
      settings.adAccountId = primaryId.trim() || null;
      settings.conversionAction = metaConversionAction.trim() || null;
      settings.revenueAction = metaRevenueAction.trim() || null;
      settings.currency = metaCurrency.trim() || null;
      settings.source = metaSource.trim() || null;
      settings.medium = metaMedium.trim() || null;
    }

    setCreating(true);
    try {
      const created = await createMarketingIntegration({
        provider,
        name: name.trim(),
        primaryId: primaryId || undefined,
        kind: provider.endsWith('_ads') ? 'ads' : 'analytics',
        isActive: true,
        settings,
      });
      setItems((prev) => [created, ...prev]);
      setPrimaryId('');
      setGaServiceAccount('');
      setGaConversionEvent('');
      setGaRevenueMetric('');
      setYmToken('');
      setYmGoalId('');
      setYmRevenueMetric('');
      setAdsDeveloperToken('');
      setAdsClientId('');
      setAdsClientSecret('');
      setAdsRefreshToken('');
      setAdsLoginCustomerId('');
      setAdsCurrency('');
      setAdsSource('');
      setAdsMedium('');
      setMetaToken('');
      setMetaConversionAction('');
      setMetaRevenueAction('');
      setMetaCurrency('');
      setMetaSource('');
      setMetaMedium('');
    } catch (e: any) {
      console.error(e);
      alert(
        e?.message || t('crm.marketingIntegrations.errors.create'),
      );
    } finally {
      setCreating(false);
    }
  };

  const startResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id,
      startX: e.clientX,
      startWidth: columnWidths[id] ?? 160,
    });
  };

  const handleColumnDrop = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragColumnId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragColumnId);
      return next;
    });
    setDragColumnId(null);
  };

  const renderCell = (it: MarketingIntegration, columnId: string) => {
    switch (columnId) {
      case 'name':
        return <span className="text-slate-100">{it.name}</span>;
      case 'provider':
        return <span className="text-slate-300">{providerLabel(it.provider)}</span>;
      case 'primaryId':
        return (
          <span className="text-slate-300">
            {it.primaryId || t('crm.marketingIntegrations.common.empty')}
          </span>
        );
      case 'status':
        return (
          <button
            type="button"
            onClick={() => toggleActive(it)}
            className={
              'px-2 py-0.5 rounded-full text-[10px] border ' +
              (it.isActive
                ? 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10'
                : 'border-slate-600 text-slate-400 bg-slate-800')
            }
          >
            {it.isActive
              ? t('crm.marketingIntegrations.status.enabled')
              : t('crm.marketingIntegrations.status.disabled')}
          </button>
        );
      case 'actions':
        return (
          <div className="space-x-2 text-right">
            {(it.provider === 'google_analytics' ||
              it.provider === 'yandex_metrika') && (
              <button
                type="button"
                onClick={() => sync(it)}
                className="px-2 py-0.5 rounded-xl border border-sky-500/60 text-[10px] text-sky-300 hover:bg-sky-500/10"
                disabled={syncingId === it.id}
              >
                {syncingId === it.id
                  ? t('crm.marketingIntegrations.actions.syncing')
                  : t('crm.marketingIntegrations.actions.sync')}
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(it)}
              className="px-2 py-0.5 rounded-xl border border-rose-500/60 text-[10px] text-rose-300 hover:bg-rose-500/10"
            >
              {t('crm.marketingIntegrations.actions.delete')}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const toggleActive = async (item: MarketingIntegration) => {
    const next = !item.isActive;
    try {
      const updated = await updateMarketingIntegration(item.id, {
        isActive: next,
      });
      setItems((prev) =>
        prev.map((it) => (it.id === updated.id ? updated : it)),
      );
    } catch (e: any) {
      console.error(e);
      alert(
        e?.message || t('crm.marketingIntegrations.errors.update'),
      );
    }
  };

  const remove = async (item: MarketingIntegration) => {
    if (
      !window.confirm(
        t('crm.marketingIntegrations.confirmDelete', { name: item.name }),
      )
    )
      return;
    try {
      await deleteMarketingIntegration(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (e: any) {
      console.error(e);
      alert(
        e?.message || t('crm.marketingIntegrations.errors.delete'),
      );
    }
  };

  const sync = async (item: MarketingIntegration) => {
    setSyncingId(item.id);
    try {
      const res = await syncMarketingIntegration(item.id);
      alert(
        t('crm.marketingIntegrations.syncResult', {
          count: res.updated,
        }),
      );
    } catch (e: any) {
      console.error(e);
      alert(
        e?.message || t('crm.marketingIntegrations.errors.sync'),
      );
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingIntegrations.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingIntegrations.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingIntegrations.subtitle')}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] md:gap-5">
          {/* Форма добавления */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              {t('crm.marketingIntegrations.form.title')}
            </h2>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t('crm.marketingIntegrations.form.provider')}
              </label>
              <select
                value={provider}
                onChange={(e) => {
                  const v = e.target.value;
                  setProvider(v);
                  setName(providerLabel(v));
                }}
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              >
                <option value="google_analytics">
                  {t('crm.marketingIntegrations.providers.google_analytics')}
                </option>
                <option value="yandex_metrika">
                  {t('crm.marketingIntegrations.providers.yandex_metrika')}
                </option>
                <option value="meta_ads">
                  {t('crm.marketingIntegrations.providers.meta_ads')}
                </option>
                <option value="google_ads">
                  {t('crm.marketingIntegrations.providers.google_ads')}
                </option>
                <option value="tiktok_ads">
                  {t('crm.marketingIntegrations.providers.tiktok_ads')}
                </option>
                <option value="other">
                  {t('crm.marketingIntegrations.providers.other')}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t('crm.marketingIntegrations.form.name')}
              </label>
              <input
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t('crm.marketingIntegrations.form.primaryId')}
              </label>
              <input
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={primaryId}
                onChange={(e) => setPrimaryId(e.target.value)}
                placeholder={t('crm.marketingIntegrations.form.primaryIdHint')}
              />
            </div>

            {provider === 'google_analytics' && (
              <>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingIntegrations.form.ga.serviceAccount')}
                  </label>
                  <textarea
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-[11px] text-slate-100 outline-none focus:border-sky-500 min-h-[110px]"
                    value={gaServiceAccount}
                    onChange={(e) => setGaServiceAccount(e.target.value)}
                    placeholder='{"client_email":"...","private_key":"..."}'
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ga.conversionEvent')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={gaConversionEvent}
                      onChange={(e) => setGaConversionEvent(e.target.value)}
                      placeholder="generate_lead"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ga.revenueMetric')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={gaRevenueMetric}
                      onChange={(e) => setGaRevenueMetric(e.target.value)}
                      placeholder="purchaseRevenue"
                    />
                  </div>
                </div>
              </>
            )}

            {provider === 'yandex_metrika' && (
              <>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingIntegrations.form.ym.token')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={ymToken}
                    onChange={(e) => setYmToken(e.target.value)}
                    placeholder="y0_AQAAAA..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ym.goalId')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={ymGoalId}
                      onChange={(e) => setYmGoalId(e.target.value)}
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ym.revenueMetric')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={ymRevenueMetric}
                      onChange={(e) => setYmRevenueMetric(e.target.value)}
                      placeholder="ym:s:purchaseRevenue"
                    />
                  </div>
                </div>
              </>
            )}

            {provider === 'google_ads' && (
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingIntegrations.form.ads.developerToken')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={adsDeveloperToken}
                    onChange={(e) => setAdsDeveloperToken(e.target.value)}
                    placeholder="AAAAA..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ads.clientId')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={adsClientId}
                      onChange={(e) => setAdsClientId(e.target.value)}
                      placeholder="xxxx.apps.googleusercontent.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ads.clientSecret')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={adsClientSecret}
                      onChange={(e) => setAdsClientSecret(e.target.value)}
                      placeholder="GOCSPX-..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ads.refreshToken')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={adsRefreshToken}
                      onChange={(e) => setAdsRefreshToken(e.target.value)}
                      placeholder="1//0g..."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ads.loginCustomerId')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={adsLoginCustomerId}
                      onChange={(e) => setAdsLoginCustomerId(e.target.value)}
                      placeholder="1234567890"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ads.source')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={adsSource}
                      onChange={(e) => setAdsSource(e.target.value)}
                      placeholder="google"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.ads.medium')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={adsMedium}
                      onChange={(e) => setAdsMedium(e.target.value)}
                      placeholder="cpc"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingIntegrations.form.ads.currency')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={adsCurrency}
                    onChange={(e) => setAdsCurrency(e.target.value)}
                    placeholder="EUR"
                  />
                </div>
              </div>
            )}

            {provider === 'meta_ads' && (
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingIntegrations.form.meta.accessToken')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                    placeholder="EAAB..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.meta.conversionAction')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={metaConversionAction}
                      onChange={(e) => setMetaConversionAction(e.target.value)}
                      placeholder="lead"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.meta.revenueAction')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={metaRevenueAction}
                      onChange={(e) => setMetaRevenueAction(e.target.value)}
                      placeholder="purchase"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.meta.source')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={metaSource}
                      onChange={(e) => setMetaSource(e.target.value)}
                      placeholder="facebook"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {t('crm.marketingIntegrations.form.meta.medium')}
                    </label>
                    <input
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                      value={metaMedium}
                      onChange={(e) => setMetaMedium(e.target.value)}
                      placeholder="paid_social"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingIntegrations.form.meta.currency')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={metaCurrency}
                    onChange={(e) => setMetaCurrency(e.target.value)}
                    placeholder="EUR"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              className="mt-2 w-full px-4 py-2 rounded-2xl bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating
                ? t('crm.marketingIntegrations.actions.creating')
                : t('crm.marketingIntegrations.actions.create')}
            </button>

            <p className="mt-3 text-[10px] text-slate-500">
              {t('crm.marketingIntegrations.form.note')}
            </p>
          </div>

          {/* Таблица интеграций */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  {t('crm.marketingIntegrations.table.title')}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {t('crm.marketingIntegrations.table.subtitle')}
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                {t('crm.marketingIntegrations.table.total', {
                  count: items.length,
                })}
              </span>
            </div>

            {loading && (
              <div className="text-[11px] text-slate-400">
                {t('crm.marketingIntegrations.loading')}
              </div>
            )}

            {error && (
              <div className="text-[11px] text-red-400 mb-2">{error}</div>
            )}

            {!loading && !items.length && (
              <div className="text-[11px] text-slate-500">
                {t('crm.marketingIntegrations.table.empty')}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400">
                    {orderedColumns.map((col) => {
                      const fallback =
                        col.id === 'name'
                          ? 200
                          : col.id === 'provider'
                            ? 160
                            : col.id === 'primaryId'
                              ? 180
                              : col.id === 'status'
                                ? 140
                                : 180;
                      const width = columnWidths[col.id] ?? fallback;
                      const alignRight = col.id === 'actions';
                      const alignCenter = col.id === 'status';
                      return (
                        <th
                          key={col.id}
                          draggable
                          onDragStart={(e) => {
                            setDragColumnId(col.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', col.id);
                          }}
                          onDragEnd={() => setDragColumnId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleColumnDrop(col.id)}
                          className={`py-1.5 px-3 font-normal relative group ${
                            alignRight
                              ? 'text-right'
                              : alignCenter
                                ? 'text-center'
                                : 'text-left'
                          }`}
                          style={{ width, minWidth: width }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="cursor-move">⋮⋮</span>
                            <span>{col.label}</span>
                          </div>
                          <div
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
                            onMouseDown={(e) => startResize(col.id, e)}
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/50 transition-colors"
                    >
                      {orderedColumns.map((col) => {
                        const fallback =
                          col.id === 'name'
                            ? 200
                            : col.id === 'provider'
                              ? 160
                              : col.id === 'primaryId'
                                ? 180
                                : col.id === 'status'
                                  ? 140
                                  : 180;
                        const width = columnWidths[col.id] ?? fallback;
                        const alignRight = col.id === 'actions';
                        const alignCenter = col.id === 'status';
                        return (
                          <td
                            key={col.id}
                            className={`py-1.5 px-3 ${
                              alignRight
                                ? 'text-right'
                                : alignCenter
                                  ? 'text-center'
                                  : 'text-left'
                            }`}
                            style={{ width, minWidth: width }}
                          >
                            {renderCell(it, col.id)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};
