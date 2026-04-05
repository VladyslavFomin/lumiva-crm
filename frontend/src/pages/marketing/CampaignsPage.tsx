import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingTraffic,
  normalizeMarketingTrafficStats,
  type MarketingTrafficStats,
} from '../../api/marketing';
import { getLocale } from '../../i18n/utils';
import { marketingDataSourceLabel } from '../../utils/marketingDataSourceLabel';
import {
  formatMarketingChannelDimension,
  sanitizeMarketingDimension,
} from '../../utils/marketingChannelDisplay';
import {
  marketingCard,
  marketingChipActive,
  marketingChipInactive,
  marketingFilterBar,
  marketingFilterLabel,
  marketingH1,
  marketingKicker,
  marketingKpiHint,
  marketingKpiLabel,
  marketingKpiStripeBrand,
  marketingKpiStripeDuo,
  marketingKpiStripeEmerald,
  marketingKpiStripeViolet,
  marketingKpiValue,
  marketingLead,
  marketingMetaLine,
  marketingPageShell,
  marketingSectionSub,
  marketingSectionTitle,
  marketingSelect,
  marketingTableWrap,
  marketingTd,
  marketingTh,
  marketingThead,
  marketingTr,
} from './marketingPageChrome';
import { MarketingChannelBlocks } from './marketingChannelBlocks';
import { MarketingProviderBreakdownTable } from './MarketingProviderBreakdownTable';
import {
  MarketingDisplayCurrencyToolbar,
  useMarketingDisplayCurrencyPrefs,
} from './MarketingDisplayCurrencyToolbar';
import { convertMarketingAmount } from './marketingDisplayCurrencyStorage';

type PeriodPreset = '7d' | '30d' | '90d' | 'all';

interface DateRange {
  from?: string;
  to?: string;
}

export const CampaignsPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [dataSource, setDataSource] = useState('');
  const [stats, setStats] = useState<MarketingTrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideUnattributedChannel, setHideUnattributedChannel] = useState(false);

  const formatNumber = useCallback(
    (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 0 }),
    [locale],
  );
  const formatMoney = useCallback(
    (v: number) =>
      v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [locale],
  );

  const periodLabel: Record<PeriodPreset, string> = {
    '7d': t('crm.marketingCampaigns.periods.7d'),
    '30d': t('crm.marketingCampaigns.periods.30d'),
    '90d': t('crm.marketingCampaigns.periods.90d'),
    all: t('crm.marketingCampaigns.periods.all'),
  };

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);
    setDataSource('');
    if (p === 'all') {
      setRange({});
      return;
    }
    const today = new Date();
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const start = new Date(end);
    if (p === '7d') start.setUTCDate(end.getUTCDate() - 6);
    if (p === '30d') start.setUTCDate(end.getUTCDate() - 29);
    if (p === '90d') start.setUTCDate(end.getUTCDate() - 89);
    setRange({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
  };

  useEffect(() => {
    applyPreset('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = useMemo(
    () => normalizeMarketingTrafficStats(stats ?? {}),
    [stats],
  );
  const deferredItemsForBlocks = useDeferredValue(view.items);

  const dataSourceOptions = useMemo(() => {
    const list = [...(view.dataSources ?? [])];
    if (dataSource && !list.includes(dataSource)) list.push(dataSource);
    return list.sort((a, b) => a.localeCompare(b));
  }, [view.dataSources, dataSource]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchMarketingTraffic({
      from: range.from,
      to: range.to,
      dataSource: dataSource || undefined,
      itemsLimit: 70_000,
    })
      .then((res) => {
        if (!alive) return;
        startTransition(() => setStats(res));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        console.error(e);
        setError(
          e instanceof Error ? e.message : t('crm.marketingCampaigns.errors.load'),
        );
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, dataSource]);

  const currency = view.currency || 'EUR';
  const providerBreakdown = view.providerBreakdown;
  const totalRows = view.totalRows;
  const totalImpressions = view.totalImpressions;
  const totalCost = view.totalCost;

  const { state: curPrefs, setState: setCurPrefs } = useMarketingDisplayCurrencyPrefs(
    view.currenciesPresent ?? [],
  );

  const fmtCell = useCallback(
    (amount: number, fromCur: string) => {
      const c = convertMarketingAmount(
        amount,
        fromCur,
        curPrefs.currencyMode,
        curPrefs.displayCurrency,
        curPrefs.rates,
      );
      if (c.missingRate && curPrefs.currencyMode === 'converted') {
        return `${formatMoney(c.value)} ${c.currency}*`;
      }
      return `${formatMoney(c.value)} ${c.currency}`;
    },
    [curPrefs, formatMoney],
  );

  const campaignTotals = useMemo(() => {
    const items = view.items;
    let costC = 0;
    let revC = 0;
    let leads = 0;
    let miss = false;
    const activeCampaignKeys = new Set<string>();
    const splitCost = new Map<string, number>();
    const splitRev = new Map<string, number>();

    for (const r of items) {
      const co = convertMarketingAmount(
        r.cost || 0,
        r.currency,
        curPrefs.currencyMode,
        curPrefs.displayCurrency,
        curPrefs.rates,
      );
      const re = convertMarketingAmount(
        r.revenue || 0,
        r.currency,
        curPrefs.currencyMode,
        curPrefs.displayCurrency,
        curPrefs.rates,
      );
      if (co.missingRate || re.missingRate) miss = true;
      costC += co.value;
      revC += re.value;
      leads += r.leads || 0;

      if (curPrefs.currencyMode === 'native' && view.currency === 'MIXED') {
        const cc = (r.currency || 'EUR').toUpperCase().slice(0, 8);
        splitCost.set(cc, (splitCost.get(cc) || 0) + (r.cost || 0));
        splitRev.set(cc, (splitRev.get(cc) || 0) + (r.revenue || 0));
      }

      if (r.cost > 0 || r.sessions > 0 || r.impressions > 0 || r.clicks > 0) {
        const c = sanitizeMarketingDimension(r.campaign);
        const s = sanitizeMarketingDimension(r.source);
        const m = sanitizeMarketingDimension(r.medium);
        activeCampaignKeys.add(`${s}|${m}|${c}`);
      }
    }

    const ratiosOk = view.currency !== 'MIXED' || curPrefs.currencyMode === 'converted';
    const roas = ratiosOk && costC > 0 && revC > 0 ? revC / costC : null;
    const cpl = ratiosOk && leads > 0 ? costC / leads : null;
    const labelCur =
      curPrefs.currencyMode === 'converted' ? curPrefs.displayCurrency : view.currency === 'MIXED' ? null : currency;

    const costParts =
      curPrefs.currencyMode === 'native' && view.currency === 'MIXED'
        ? [...splitCost.entries()].sort((a, b) => b[1] - a[1])
        : null;
    const revParts =
      curPrefs.currencyMode === 'native' && view.currency === 'MIXED'
        ? [...splitRev.entries()].sort((a, b) => b[1] - a[1])
        : null;

    return {
      campaignCount: activeCampaignKeys.size,
      costC,
      revC,
      leads,
      roas,
      cpl,
      labelCur,
      miss,
      costParts,
      revParts,
    };
  }, [view.items, view.currency, curPrefs, currency]);

  const engagementTotals = useMemo(() => {
    let imp = 0;
    let clk = 0;
    let sess = 0;
    let leads = 0;
    for (const r of view.items) {
      imp += r.impressions || 0;
      clk += r.clicks || 0;
      sess += r.sessions || 0;
      leads += r.leads || 0;
    }
    const ctr = imp > 0 && clk !== imp ? (clk / imp) * 100 : null;
    const cpc =
      clk > 0 && campaignTotals.costC > 0 ? campaignTotals.costC / clk : null;
    return { imp, clk, sess, leads, ctr, cpc };
  }, [view.items, campaignTotals.costC]);

  const chartConfig = useMemo(() => {
    const items = view.items;
    const hasImpr = items.some((r) => (r.impressions || 0) > 0);
    const hasClk = items.some((r) => (r.clicks || 0) > 0);
    let metric: 'impressions' | 'clicks' | 'revenue' | 'cost';
    let rowsSlice: typeof items;
    if (hasImpr) {
      metric = 'impressions';
      rowsSlice = [...items].sort((a, b) => b.impressions - a.impressions).slice(0, 6);
    } else if (hasClk) {
      metric = 'clicks';
      rowsSlice = [...items].sort((a, b) => b.clicks - a.clicks).slice(0, 6);
    } else {
      const allRevZero = items.length > 0 && items.every((r) => !r.revenue);
      metric = allRevZero ? 'cost' : 'revenue';
      rowsSlice = allRevZero
        ? [...items].sort((a, b) => b.cost - a.cost).slice(0, 6)
        : [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
      if (!allRevZero && rowsSlice.length && rowsSlice.every((r) => !r.revenue)) {
        metric = 'cost';
        rowsSlice = [...items].sort((a, b) => b.cost - a.cost).slice(0, 6);
      }
    }
    const rows = rowsSlice.map((r, i) => {
      const name = formatMarketingChannelDimension(t, r.campaign, 'campaign');
      const short = name.length > 22 ? `${name.slice(0, 20)}…` : name || `—${i}`;
      const value =
        metric === 'impressions'
          ? r.impressions
          : metric === 'clicks'
            ? r.clicks
            : metric === 'cost'
              ? r.cost
              : r.revenue;
      return {
        key: `${short}-${i}`,
        name: short,
        fullName: name,
        value,
        rowCurrency: r.currency || 'EUR',
      };
    });
    return { metric, rows };
  }, [view.items, t]);

  const spendSummary = useMemo(() => {
    if (totalCost <= 0) return null;
    if (curPrefs.currencyMode === 'native') {
      return providerBreakdown
        .filter((p) => p.cost > 0)
        .map((p) => `${formatMoney(p.cost)} ${p.currency}`)
        .join(' · ');
    }
    let sum = 0;
    let miss = false;
    for (const p of providerBreakdown) {
      const c = convertMarketingAmount(
        p.cost,
        p.currency,
        'converted',
        curPrefs.displayCurrency,
        curPrefs.rates,
      );
      if (c.missingRate) miss = true;
      sum += c.value;
    }
    return `${formatMoney(sum)} ${curPrefs.displayCurrency}${miss ? '*' : ''}`;
  }, [totalCost, providerBreakdown, curPrefs, formatMoney]);

  const tableRows = useMemo(() => {
    return [...view.items].sort((a, b) => b.cost - a.cost || b.revenue - a.revenue);
  }, [view.items]);

  return (
    <MainLayout>
      <div className={`${marketingPageShell} space-y-5 md:space-y-6 pb-2`}>
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className={marketingKicker}>{t('crm.marketingCampaigns.kicker')}</div>
            <h1 className={marketingH1}>{t('crm.marketingCampaigns.title')}</h1>
            <p className={marketingLead}>{t('crm.marketingCampaigns.subtitle')}</p>
          </div>
          <div className="flex flex-col items-stretch md:items-end gap-2">
            <div className={`${marketingFilterBar} w-full md:w-auto md:justify-end`}>
              <span className={marketingFilterLabel}>{t('crm.marketingCampaigns.periodLabel')}</span>
              {(['7d', '30d', '90d', 'all'] as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={preset === p ? marketingChipActive : marketingChipInactive}
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>
            <div className={`${marketingFilterBar} items-center w-full md:w-auto md:justify-end`}>
              <span className={marketingFilterLabel}>
                {t('crm.marketingTraffic.dataSourceLabel')}
              </span>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className={marketingSelect}
              >
                <option value="">{t('crm.marketingTraffic.dataSourceAll')}</option>
                {dataSourceOptions.map((ds) => (
                  <option key={ds} value={ds}>
                    {marketingDataSourceLabel(t, ds, view.dataSourceLabels)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-[#222222]/50">{t('crm.marketingCampaigns.loading')}</div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <MarketingDisplayCurrencyToolbar
              currenciesPresent={view.currenciesPresent ?? []}
              state={curPrefs}
              onStateChange={setCurPrefs}
            />

            <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              <div className={marketingKpiStripeBrand}>
                <div className={marketingKpiLabel}>{t('crm.marketingCampaigns.kpi.campaigns')}</div>
                <div className={marketingKpiValue}>{formatNumber(campaignTotals.campaignCount)}</div>
                <div className={marketingKpiHint}>{t('crm.marketingCampaigns.kpi.campaignsHint')}</div>
              </div>
              <div className={marketingKpiStripeEmerald}>
                <div className={marketingKpiLabel}>
                  {t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })}
                </div>
                <div className={`${marketingKpiValue} text-emerald-700`}>
                  {formatNumber(engagementTotals.imp)}
                </div>
                <div className={marketingKpiHint}>
                  {t('crm.marketingCampaigns.kpi.impressionsHint', {
                    defaultValue: 'Показы рекламы и охват по данным каналов',
                  })}
                </div>
              </div>
              <div className={marketingKpiStripeViolet}>
                <div className={marketingKpiLabel}>
                  {t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' })}
                </div>
                <div className={`${marketingKpiValue} text-violet-700`}>
                  {formatNumber(engagementTotals.clk)}
                </div>
                <div className={marketingKpiHint}>
                  {t('crm.marketingCampaigns.kpi.clicksHint', {
                    defaultValue: 'Клики и просмотры страниц (зависит от источника)',
                  })}
                </div>
              </div>
              <div className={marketingKpiStripeBrand}>
                <div className={marketingKpiLabel}>
                  {t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' })}
                </div>
                <div className={marketingKpiValue}>{formatNumber(engagementTotals.sess)}</div>
                <div className={marketingKpiHint}>
                  {t('crm.marketingCampaigns.kpi.sessionsHint', {
                    defaultValue: 'Визиты / сессии из аналитики',
                  })}
                </div>
              </div>
              <div className={marketingKpiStripeDuo}>
                <div className={marketingKpiLabel}>{t('crm.marketingCampaigns.kpi.cost')}</div>
                <div className={`${marketingKpiValue} text-[#222222] text-left leading-tight`}>
                  {campaignTotals.costParts ? (
                    <span className="block text-base sm:text-lg font-semibold break-words">
                      {campaignTotals.costParts.map(([c, v]) => (
                        <span key={c} className="inline-block mr-2">
                          {formatMoney(v)} {c}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <>
                      {formatMoney(campaignTotals.costC)}
                      {campaignTotals.labelCur ? ` ${campaignTotals.labelCur}` : ''}
                      {campaignTotals.miss && curPrefs.currencyMode === 'converted' ? '*' : ''}
                    </>
                  )}
                </div>
                <div className={marketingKpiHint}>{t('crm.marketingCampaigns.kpi.costHint')}</div>
              </div>
            </section>

            <section className={`${marketingCard} px-4 py-3`}>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[#222222]/85">
                <span className="font-medium">
                  {t('crm.marketingChannels.kpi.leads')}:{' '}
                  <span className="tabular-nums text-violet-700">{formatNumber(engagementTotals.leads)}</span>
                </span>
                <span className="font-medium">
                  {t('crm.marketingChannelBlocks.ctr', { defaultValue: 'CTR' })}:{' '}
                  <span className="tabular-nums">
                    {engagementTotals.ctr != null ? `${engagementTotals.ctr.toFixed(2)}%` : '—'}
                  </span>
                </span>
                <span className="font-medium">
                  {t('crm.marketingChannelBlocks.cpc', { defaultValue: 'CPC' })}:{' '}
                  <span className="tabular-nums">
                    {engagementTotals.cpc != null && engagementTotals.cpc > 0
                      ? `${formatMoney(engagementTotals.cpc)} ${
                          campaignTotals.labelCur || curPrefs.displayCurrency
                        }${campaignTotals.miss && curPrefs.currencyMode === 'converted' ? '*' : ''}`
                      : '—'}
                  </span>
                </span>
                {campaignTotals.roas != null && (
                  <span className="font-medium">
                    {t('crm.marketingCampaigns.kpi.roas')}:{' '}
                    <span className="tabular-nums">{campaignTotals.roas.toFixed(2)}</span>
                  </span>
                )}
                {campaignTotals.cpl != null && campaignTotals.labelCur && (
                  <span className="font-medium">
                    {t('crm.marketingCampaigns.kpi.cpl')}:{' '}
                    <span className="tabular-nums text-rose-600">
                      {formatMoney(campaignTotals.cpl)} {campaignTotals.labelCur}
                      {campaignTotals.miss && curPrefs.currencyMode === 'converted' ? '*' : ''}
                    </span>
                  </span>
                )}
              </div>
            </section>

            <section className={`${marketingCard} space-y-4`}>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className={marketingSectionTitle}>
                    {t('crm.marketingTraffic.summaryStripTitle', { defaultValue: 'Сводка периода' })}
                  </div>
                  <div className={marketingSectionSub}>
                    {t('crm.marketingTraffic.summaryStripSubtitle', {
                      defaultValue:
                        'Таблица — сводка по каждому источнику данных за период. Валюта — как на панели выше. Карточки по каналам и графики — ниже.',
                    })}
                  </div>
                </div>
                <div className={marketingMetaLine}>
                  {t('crm.marketingTraffic.rawRowsLabel')}:{' '}
                  <span className="font-semibold tabular-nums text-[#222222]">{formatNumber(totalRows)}</span>
                  {totalImpressions > 0 && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.impressionsLabel')}:{' '}
                      <span className="font-semibold tabular-nums text-[#222222]">
                        {formatNumber(totalImpressions)}
                      </span>
                    </span>
                  )}
                  {spendSummary && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.spendLabel')}:{' '}
                      <span className="font-semibold tabular-nums text-[#222222]">{spendSummary}</span>
                    </span>
                  )}
                </div>
              </div>
              <MarketingProviderBreakdownTable
                rows={providerBreakdown}
                dataSourceLabels={view.dataSourceLabels}
                currencyMode={curPrefs.currencyMode}
                displayCurrency={curPrefs.displayCurrency}
                rates={curPrefs.rates}
                formatNumber={formatNumber}
                formatMoney={formatMoney}
                t={t}
              />
            </section>

            <MarketingChannelBlocks
              items={deferredItemsForBlocks}
              t={t}
              currencyMode={curPrefs.currencyMode}
              displayCurrency={curPrefs.displayCurrency}
              rates={curPrefs.rates}
              formatNumber={formatNumber}
              formatMoney={formatMoney}
              dataSourceLabels={view.dataSourceLabels}
              trafficDateFrom={range.from}
              trafficDateTo={range.to}
              title={t('crm.marketingChannelBlocks.titleCampaigns', { defaultValue: 'Кампании по каналам' })}
              subtitle={t('crm.marketingChannelBlocks.subtitleCampaigns', {
                defaultValue:
                  'Колонка «без канала интеграции» — строки в CRM без data source (часто импорт/аналитика без UTM). Не суммируйте её с Meta/Google Ads: это другой срез, цифры могут пересекаться.',
              })}
              unattributedControl={{
                hidden: hideUnattributedChannel,
                onChange: setHideUnattributedChannel,
              }}
            />

            <section className={marketingCard}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
                <div>
                  <div className={marketingSectionTitle}>{t('crm.marketingCampaigns.top.title')}</div>
                  <div className={marketingSectionSub}>
                    {chartConfig.metric === 'impressions'
                      ? t('crm.marketingCampaigns.top.subtitleImpressions', {
                          defaultValue: 'Топ кампаний по показам',
                        })
                      : chartConfig.metric === 'clicks'
                        ? t('crm.marketingCampaigns.top.subtitleClicks', {
                            defaultValue: 'Топ кампаний по кликам / просмотрам',
                          })
                        : chartConfig.metric === 'revenue'
                          ? t('crm.marketingCampaigns.top.subtitle')
                          : t('crm.marketingCampaigns.top.subtitleCost')}
                  </div>
                </div>
                <div className={marketingMetaLine}>
                  {t('crm.marketingCampaigns.top.shown', { count: chartConfig.rows.length })}
                </div>
              </div>
              <div
                className={`${marketingTableWrap} h-60 w-full min-w-0 p-3 bg-gradient-to-b from-slate-50/50 to-white`}
              >
                {chartConfig.rows.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartConfig.rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        interval={0}
                        angle={-28}
                        textAnchor="end"
                        height={54}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid rgba(34,34,34,0.12)',
                          borderRadius: 12,
                          fontSize: 11,
                          boxShadow: '0 12px 40px rgba(34,34,34,0.12)',
                        }}
                        formatter={(v: number | string, _name, item) => {
                          const num = typeof v === 'number' ? v : Number(v);
                          if (chartConfig.metric === 'impressions' || chartConfig.metric === 'clicks') {
                            const label =
                              chartConfig.metric === 'impressions'
                                ? t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })
                                : t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' });
                            return [formatNumber(num), label];
                          }
                          const label =
                            chartConfig.metric === 'revenue'
                              ? t('crm.marketingCampaigns.table.headers.revenue')
                              : t('crm.marketingCampaigns.table.headers.cost');
                          const cur = String(
                            (item as { payload?: { rowCurrency?: string } })?.payload?.rowCurrency ||
                              currency,
                          );
                          return [fmtCell(num, cur), label];
                        }}
                        labelFormatter={(_l, payload) =>
                          String((payload?.[0]?.payload as { fullName?: string })?.fullName ?? '')
                        }
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-[11px] text-[#222222]/45 h-full flex items-center justify-center">
                    {t('crm.marketingChannels.common.noData')}
                  </div>
                )}
              </div>
            </section>

            <section className={marketingCard}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
                <div>
                  <div className={marketingSectionTitle}>{t('crm.marketingCampaigns.table.title')}</div>
                  <div className={marketingSectionSub}>{t('crm.marketingCampaigns.table.subtitle')}</div>
                </div>
                <div className={marketingMetaLine}>
                  {t('crm.marketingCampaigns.table.count', { count: tableRows.length })}
                </div>
              </div>
              <div className={`${marketingTableWrap} overflow-x-auto min-w-0`}>
                <table className="w-full min-w-[880px] text-left">
                  <thead className={marketingThead}>
                    <tr>
                      <th className={marketingTh}>{t('crm.marketingCampaigns.table.headers.campaign')}</th>
                      <th className={marketingTh}>{t('crm.marketingCampaigns.table.headers.source')}</th>
                      <th className={marketingTh}>{t('crm.marketingCampaigns.table.headers.medium')}</th>
                      <th className={`${marketingTh} text-right tabular-nums`}>
                        {t('crm.marketingCampaigns.table.headers.impressions')}
                      </th>
                      <th className={`${marketingTh} text-right tabular-nums`}>
                        {t('crm.marketingCampaigns.table.headers.clicks')}
                      </th>
                      <th className={`${marketingTh} text-right tabular-nums`}>
                        {t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' })}
                      </th>
                      <th className={`${marketingTh} text-right`}>
                        {t('crm.marketingCampaigns.table.headers.cost')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, idx) => (
                      <tr key={`${row.source}-${row.medium}-${row.campaign}-${idx}`} className={marketingTr}>
                        <td
                          className={`${marketingTd} max-w-[200px] truncate font-medium text-[#222222]`}
                          title={formatMarketingChannelDimension(t, row.campaign, 'campaign')}
                        >
                          {formatMarketingChannelDimension(t, row.campaign, 'campaign')}
                        </td>
                        <td className={marketingTd}>
                          {formatMarketingChannelDimension(t, row.source, 'source')}
                        </td>
                        <td className={marketingTd}>
                          {formatMarketingChannelDimension(t, row.medium, 'medium')}
                        </td>
                        <td className={`${marketingTd} text-right tabular-nums`}>
                          {formatNumber(row.impressions || 0)}
                        </td>
                        <td className={`${marketingTd} text-right tabular-nums`}>
                          {formatNumber(row.clicks || 0)}
                        </td>
                        <td className={`${marketingTd} text-right tabular-nums`}>
                          {formatNumber(row.sessions || 0)}
                        </td>
                        <td className={`${marketingTd} text-right tabular-nums font-medium text-[#222222]`}>
                          {fmtCell(row.cost || 0, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
};
