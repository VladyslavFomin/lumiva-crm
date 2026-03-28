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
import { sanitizeMarketingDimension } from '../../utils/marketingChannelDisplay';

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
    '7d': t('crm.marketingChannels.periods.7d', { defaultValue: '7 дн.' }),
    '30d': t('crm.marketingChannels.periods.30d', { defaultValue: '30 дн.' }),
    '90d': t('crm.marketingChannels.periods.90d', { defaultValue: '90 дн.' }),
    all: t('crm.marketingChannels.periods.all', { defaultValue: 'Все время' }),
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
          e instanceof Error
            ? e.message
            : t('crm.marketingChannels.errors.load', {
                defaultValue: 'Не удалось загрузить данные',
              }),
        );
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t не должен перезапрашивать трафик
  }, [range.from, range.to, dataSource]);

  const currency = view.currency || 'EUR';
  const providerBreakdown = view.providerBreakdown;
  const totalRows = view.totalRows;
  const totalImpressions = view.totalImpressions;
  const totalCost = view.totalCost;

  const chartConfig = useMemo(() => {
    const items = view.items;
    const byRev = [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const allRevZero = items.length > 0 && items.every((r) => !r.revenue);
    const rows = allRevZero
      ? [...items].sort((a, b) => b.cost - a.cost).slice(0, 6)
      : byRev;
    const metric: 'revenue' | 'cost' = allRevZero ? 'cost' : 'revenue';
    return {
      metric,
      rows: rows.map((r, i) => {
        const name = sanitizeMarketingDimension(r.campaign);
        const short =
          name.length > 22 ? `${name.slice(0, 20)}…` : name || `—${i}`;
        const value = metric === 'revenue' ? r.revenue : r.cost;
        return { key: `${short}-${i}`, name: short, fullName: name, value };
      }),
    };
  }, [view.items]);

  const tableRows = useMemo(() => {
    return [...view.items].sort((a, b) => b.cost - a.cost || b.revenue - a.revenue);
  }, [view.items]);

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingCampaigns.kicker', { defaultValue: 'Маркетинг' })}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingCampaigns.title', { defaultValue: 'Кампании' })}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingCampaigns.subtitle', {
                defaultValue:
                  'Расходы, показы и клики по данным синхронизации (Meta, Метрика, GA4, импорт).',
              })}
            </p>
          </div>
          <div className="flex flex-col items-stretch md:items-end gap-2">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] text-slate-600 pl-1">
                {t('crm.marketingChannels.periodLabel', { defaultValue: 'Период' })}
              </span>
              {(['7d', '30d', '90d', 'all'] as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={
                    'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                    (preset === p
                      ? 'bg-black text-white font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.2)]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                  }
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] text-slate-600 pl-1 whitespace-nowrap">
                {t('crm.marketingTraffic.dataSourceLabel', { defaultValue: 'Источник данных' })}
              </span>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="max-w-[200px] truncate text-[11px] rounded-xl border-0 bg-transparent py-1.5 pr-1 text-slate-800 focus:outline-none"
              >
                <option value="">
                  {t('crm.marketingTraffic.dataSourceAll', { defaultValue: 'Все' })}
                </option>
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
            {t('crm.marketingChannels.loading', { defaultValue: 'Загрузка…' })}
          </div>
        )}
        {error && <div className="text-[11px] text-red-400">{error}</div>}

        {!loading && !error && (
          <>
            {/* Расширенные метрики — те же данные, что и GET /marketing/traffic → providerBreakdown */}
            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 space-y-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {t('crm.marketingTraffic.extendedMetricsTitle', {
                      defaultValue: 'Расширенные метрики провайдеров',
                    })}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t('crm.marketingTraffic.extendedMetricsSubtitle', {
                      defaultValue:
                        'Суммы по полю dataSource в marketing_traffic за выбранный период.',
                    })}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  {t('crm.marketingTraffic.rawRowsLabel', { defaultValue: 'Строк в периоде' })}:{' '}
                  <span className="text-slate-100 font-semibold tabular-nums">
                    {formatNumber(totalRows)}
                  </span>
                  {totalImpressions > 0 && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.impressionsLabel', { defaultValue: 'Показы' })}:{' '}
                      <span className="text-slate-100 font-semibold tabular-nums">
                        {formatNumber(totalImpressions)}
                      </span>
                    </span>
                  )}
                  {totalCost > 0 && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.spendLabel', { defaultValue: 'Расход' })}:{' '}
                      <span className="text-slate-100 font-semibold tabular-nums">
                        {formatMoney(totalCost)} {currency}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              {providerBreakdown.length === 0 && totalRows > 0 ? (
                <div className="text-[11px] text-amber-200/90 rounded-2xl bg-amber-950/40 border border-amber-900/50 px-3 py-2">
                  {t('crm.marketingTraffic.extendedMetricsMismatch', {
                    count: totalRows,
                    defaultValue:
                      'Есть {{count}} строк в выборке, но разбивка по провайдерам пуста. Обновите страницу с очисткой кэша.',
                  })}
                </div>
              ) : providerBreakdown.length === 0 ? (
                <div className="text-[11px] text-slate-500 rounded-2xl bg-slate-900/50 px-3 py-2">
                  {t('crm.marketingTraffic.extendedMetricsEmpty', {
                    defaultValue:
                      'Расширенных метрик пока нет: выполните синхронизацию GA4, Яндекс.Метрики, Meta Ads или Google Ads либо выберите период «Все время».',
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto min-w-0">
                  <table className="w-full min-w-[640px] text-left text-[11px] text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="py-2 pr-3 font-medium">
                          {t('crm.marketingTraffic.table.provider', { defaultValue: 'Провайдер' })}
                        </th>
                        <th className="py-2 pr-3 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.rows', { defaultValue: 'Строк' })}
                        </th>
                        <th className="py-2 pr-3 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' })}
                        </th>
                        <th className="py-2 pr-3 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' })}
                        </th>
                        <th className="py-2 pr-3 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })}
                        </th>
                        <th className="py-2 font-medium text-right tabular-nums">
                          {t('crm.marketingTraffic.table.cost', { defaultValue: 'Расход' })}
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

            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {t('crm.marketingCampaigns.chartTitle', { defaultValue: 'Топ кампаний' })}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {chartConfig.metric === 'revenue'
                      ? t('crm.marketingCampaigns.chartSubtitleRevenue', {
                          defaultValue: 'По выручке за выбранный период',
                        })
                      : t('crm.marketingCampaigns.chartSubtitleCost', {
                          defaultValue: 'По расходу (выручка в данных отсутствует)',
                        })}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  {t('crm.marketingCampaigns.chartShown', { defaultValue: 'Показано' })}:{' '}
                  {chartConfig.rows.length}
                </div>
              </div>
              <div className="h-56 w-full min-w-0">
                {chartConfig.rows.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartConfig.rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} />
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
                              ? t('crm.marketingCampaigns.columns.revenue', { defaultValue: 'Выручка' })
                              : t('crm.marketingCampaigns.columns.cost', { defaultValue: 'Расход' });
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
                    {t('crm.marketingChannels.common.noData', { defaultValue: 'Нет данных' })}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    {t('crm.marketingCampaigns.tableTitle', { defaultValue: 'Список кампаний' })}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t('crm.marketingCampaigns.tableSubtitle', {
                      defaultValue: 'Каналы, расходы, выручка',
                    })}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">
                  {t('crm.marketingCampaigns.tableTotal', { defaultValue: 'Всего' })}: {tableRows.length}
                </div>
              </div>
              <div className="overflow-x-auto min-w-0">
                <table className="w-full min-w-[720px] text-left text-[11px] text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="py-2 pr-3 font-medium">
                        {t('crm.marketingCampaigns.columns.campaign', { defaultValue: 'Кампания' })}
                      </th>
                      <th className="py-2 pr-3 font-medium">
                        {t('crm.marketingCampaigns.columns.source', { defaultValue: 'Источник' })}
                      </th>
                      <th className="py-2 pr-3 font-medium">
                        {t('crm.marketingCampaigns.columns.medium', { defaultValue: 'Medium' })}
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        {t('crm.marketingCampaigns.columns.cost', { defaultValue: 'Расходы' })}
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        {t('crm.marketingCampaigns.columns.impressions', { defaultValue: 'Показы' })}
                      </th>
                      <th className="py-2 font-medium text-right">
                        {t('crm.marketingCampaigns.columns.clicks', { defaultValue: 'Клики' })}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, idx) => (
                      <tr key={`${row.source}-${row.medium}-${row.campaign}-${idx}`} className="border-b border-slate-800/80">
                        <td
                          className="py-2 pr-3 text-slate-100 max-w-[200px] truncate"
                          title={sanitizeMarketingDimension(row.campaign)}
                        >
                          {sanitizeMarketingDimension(row.campaign)}
                        </td>
                        <td className="py-2 pr-3">{sanitizeMarketingDimension(row.source)}</td>
                        <td className="py-2 pr-3">{sanitizeMarketingDimension(row.medium)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatMoney(row.cost)} {currency}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(row.impressions)}</td>
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
