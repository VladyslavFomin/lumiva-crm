import React, { useEffect, useMemo, useState } from 'react';
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
  marketingKpiAccentCard,
  marketingKpiCard,
  marketingSelect,
} from './marketingPageChrome';

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

  const formatNumber = (v: number) =>
    v.toLocaleString(locale, { maximumFractionDigits: 0 });
  const formatMoney = (v: number) =>
    v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    })
      .then((res) => {
        if (!alive) return;
        setStats(res);
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

  const campaignTotals = useMemo(() => {
    const items = view.items;
    let cost = 0;
    let revenue = 0;
    let leads = 0;
    const activeCampaignKeys = new Set<string>();
    for (const r of items) {
      cost += r.cost || 0;
      revenue += r.revenue || 0;
      leads += r.leads || 0;
      if (r.cost > 0 || r.sessions > 0 || r.impressions > 0 || r.clicks > 0) {
        const c = sanitizeMarketingDimension(r.campaign);
        const s = sanitizeMarketingDimension(r.source);
        const m = sanitizeMarketingDimension(r.medium);
        activeCampaignKeys.add(`${s}|${m}|${c}`);
      }
    }
    const roas = cost > 0 && revenue > 0 ? revenue / cost : null;
    const cpl = leads > 0 ? cost / leads : null;
    return {
      campaignCount: activeCampaignKeys.size,
      cost,
      revenue,
      leads,
      roas,
      cpl,
    };
  }, [view.items]);

  const chartConfig = useMemo(() => {
    const items = view.items;
    const allRevZero = items.length > 0 && items.every((r) => !r.revenue);
    let metric: 'revenue' | 'cost' = allRevZero ? 'cost' : 'revenue';
    let rowsSlice = allRevZero
      ? [...items].sort((a, b) => b.cost - a.cost).slice(0, 6)
      : [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    if (!allRevZero && rowsSlice.length && rowsSlice.every((r) => !r.revenue)) {
      metric = 'cost';
      rowsSlice = [...items].sort((a, b) => b.cost - a.cost).slice(0, 6);
    }
    const rows = rowsSlice.map((r, i) => {
      const name = formatMarketingChannelDimension(t, r.campaign, 'campaign');
      const short = name.length > 22 ? `${name.slice(0, 20)}…` : name || `—${i}`;
      const value = metric === 'revenue' ? r.revenue : r.cost;
      return { key: `${short}-${i}`, name: short, fullName: name, value };
    });
    return { metric, rows };
  }, [view.items, t]);

  const tableRows = useMemo(() => {
    return [...view.items].sort((a, b) => b.cost - a.cost || b.revenue - a.revenue);
  }, [view.items]);

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingCampaigns.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingCampaigns.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingCampaigns.subtitle')}
            </p>
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
                    {marketingDataSourceLabel(t, ds)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-400">
            {t('crm.marketingCampaigns.loading')}
          </div>
        )}
        {error && <div className="text-[11px] text-red-400">{error}</div>}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className={marketingKpiCard}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingCampaigns.kpi.campaigns')}
                </div>
                <div className="text-2xl font-semibold text-slate-50 mt-2 tabular-nums">
                  {formatNumber(campaignTotals.campaignCount)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.marketingCampaigns.kpi.campaignsHint')}
                </div>
              </div>
              <div className={marketingKpiCard}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingCampaigns.kpi.cost')}
                </div>
                <div className="text-2xl font-semibold text-violet-300 mt-2 tabular-nums">
                  {formatMoney(campaignTotals.cost)} {currency}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.marketingCampaigns.kpi.costHint')}
                </div>
              </div>
              <div className={marketingKpiCard}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingCampaigns.kpi.revenue')}
                </div>
                <div className="text-2xl font-semibold text-emerald-300 mt-2 tabular-nums">
                  {formatMoney(campaignTotals.revenue)} {currency}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.marketingCampaigns.kpi.revenueHint')}
                </div>
              </div>
              <div className={marketingKpiAccentCard}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-violet-400/90">
                  {t('crm.marketingCampaigns.kpi.roasCpl')}
                </div>
                <div className="text-lg font-semibold text-slate-50 mt-2 tabular-nums">
                  {t('crm.marketingCampaigns.kpi.roas')}:{' '}
                  {campaignTotals.roas != null ? campaignTotals.roas.toFixed(2) : '—'}
                </div>
                <div className="text-sm font-medium text-rose-300/95 tabular-nums">
                  {t('crm.marketingCampaigns.kpi.cpl')}:{' '}
                  {campaignTotals.cpl != null
                    ? `${formatMoney(campaignTotals.cpl)} ${currency}`
                    : '—'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.marketingCampaigns.kpi.roasCplHint')}
                </div>
              </div>
            </section>

            <section className={`${marketingCard} space-y-3`}>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {t('crm.marketingTraffic.extendedMetricsTitle')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t('crm.marketingTraffic.extendedMetricsSubtitle')}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  {t('crm.marketingTraffic.rawRowsLabel')}:{' '}
                  <span className="text-slate-100 font-semibold tabular-nums">
                    {formatNumber(totalRows)}
                  </span>
                  {totalImpressions > 0 && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.impressionsLabel')}:{' '}
                      <span className="text-slate-100 font-semibold tabular-nums">
                        {formatNumber(totalImpressions)}
                      </span>
                    </span>
                  )}
                  {totalCost > 0 && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.spendLabel')}:{' '}
                      <span className="text-slate-100 font-semibold tabular-nums">
                        {formatMoney(totalCost)} {currency}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              {providerBreakdown.length === 0 && totalRows > 0 ? (
                <div className="text-[11px] text-amber-200/90 rounded-2xl bg-amber-950/40 border border-amber-900/50 px-3 py-2">
                  {t('crm.marketingTraffic.extendedMetricsMismatch', { count: totalRows })}
                </div>
              ) : providerBreakdown.length === 0 ? (
                <div className="text-[11px] text-slate-500 rounded-2xl bg-slate-900/50 px-3 py-2">
                  {t('crm.marketingTraffic.extendedMetricsEmpty')}
                </div>
              ) : (
                <div className="overflow-x-auto min-w-0">
                  <table className="w-full min-w-[640px] text-left text-[11px] text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="py-2 pr-3 font-medium">
                          {t('crm.marketingTraffic.table.provider')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.rows')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.sessions')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.clicks')}
                        </th>
                        <th className="py-2 pr-3 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.impressions')}
                        </th>
                        <th className="py-2 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.cost')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerBreakdown.map((row, idx) => (
                        <tr
                          key={`${row.dataSource}-${row.currency}-${idx}`}
                          className="border-b border-slate-800/80"
                        >
                          <td className="py-2 pr-3 text-slate-100">
                            {marketingDataSourceLabel(t, row.dataSource)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatNumber(row.rowCount)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatNumber(row.sessions)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatNumber(row.clicks)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatNumber(row.impressions)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-slate-100">
                            {formatMoney(row.cost)} {row.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={marketingCard}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {t('crm.marketingCampaigns.top.title')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {chartConfig.metric === 'revenue'
                      ? t('crm.marketingCampaigns.top.subtitle')
                      : t('crm.marketingCampaigns.top.subtitleCost')}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  {t('crm.marketingCampaigns.top.shown', { count: chartConfig.rows.length })}
                </div>
              </div>
              <div className="h-56 w-full min-w-0">
                {chartConfig.rows.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartConfig.rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        interval={0}
                        angle={-24}
                        textAnchor="end"
                        height={52}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip
                        contentStyle={{
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: 12,
                          fontSize: 11,
                        }}
                        formatter={(v: number | string) => {
                          const num = typeof v === 'number' ? v : Number(v);
                          const label =
                            chartConfig.metric === 'revenue'
                              ? t('crm.marketingCampaigns.table.headers.revenue')
                              : t('crm.marketingCampaigns.table.headers.cost');
                          return [`${formatMoney(num)} ${currency}`, label];
                        }}
                        labelFormatter={(_l, payload) =>
                          String((payload?.[0]?.payload as { fullName?: string })?.fullName ?? '')
                        }
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-[11px] text-slate-500 h-full flex items-center justify-center">
                    {t('crm.marketingChannels.common.noData')}
                  </div>
                )}
              </div>
            </section>

            <section className={marketingCard}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {t('crm.marketingCampaigns.table.title')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t('crm.marketingCampaigns.table.subtitle')}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  {t('crm.marketingCampaigns.table.count', { count: tableRows.length })}
                </div>
              </div>
              <div className="overflow-x-auto min-w-0">
                <table className="w-full min-w-[720px] text-left text-[11px] text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="py-2 pr-3 font-medium">
                        {t('crm.marketingCampaigns.table.headers.campaign')}
                      </th>
                      <th className="py-2 pr-3 font-medium">
                        {t('crm.marketingCampaigns.table.headers.source')}
                      </th>
                      <th className="py-2 pr-3 font-medium">
                        {t('crm.marketingCampaigns.table.headers.medium')}
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        {t('crm.marketingCampaigns.table.headers.cost')}
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        {t('crm.marketingCampaigns.table.headers.impressions')}
                      </th>
                      <th className="py-2 font-medium text-right">
                        {t('crm.marketingCampaigns.table.headers.clicks')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, idx) => (
                      <tr
                        key={`${row.source}-${row.medium}-${row.campaign}-${idx}`}
                        className="border-b border-slate-800/80"
                      >
                        <td
                          className="py-2 pr-3 text-slate-100 max-w-[200px] truncate"
                          title={formatMarketingChannelDimension(t, row.campaign, 'campaign')}
                        >
                          {formatMarketingChannelDimension(t, row.campaign, 'campaign')}
                        </td>
                        <td className="py-2 pr-3">
                          {formatMarketingChannelDimension(t, row.source, 'source')}
                        </td>
                        <td className="py-2 pr-3">
                          {formatMarketingChannelDimension(t, row.medium, 'medium')}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatMoney(row.cost)} {currency}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatNumber(row.impressions)}
                        </td>
                        <td className="py-2 text-right tabular-nums">{formatNumber(row.clicks)}</td>
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
