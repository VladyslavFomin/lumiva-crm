// src/pages/analytics/LeadsRoiPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import {
  fetchLeadRoi,
  type LeadsRoiStats,
  type LeadRoiRow,
  type LeadRoiMode,
} from '../../api/leads';
import { AnalyticsCurrencyControl } from '../../components/AnalyticsCurrencyControl';
import { useMarketingDisplayCurrencyPrefs } from '../marketing/MarketingDisplayCurrencyToolbar';
import { normalizeMarketingDisplayCurrency } from '../marketing/marketingDisplayCurrencyStorage';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

type PeriodPreset = '7d' | '30d' | '1y' | 'all' | 'custom';

interface DateRange {
  from?: string;
  to?: string;
}

const ROI_COLORS = [
  '#22d3ee',
  '#a855f7',
  '#fb923c',
  '#4ade80',
  '#f97373',
  '#6366f1',
];

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const LeadsRoiPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [mode, setMode] = useState<LeadRoiMode>('projects'); // по умолчанию – по проектам
  const [stats, setStats] = useState<LeadsRoiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currenciesPresent = useMemo(
    () => Array.from(new Set(stats?.items?.flatMap((row) => row.sourceCurrencies?.length ? row.sourceCurrencies : [row.currency]) || [])),
    [stats],
  );
  const { state: currencyPrefs, setState: setCurrencyPrefs } =
    useMarketingDisplayCurrencyPrefs(currenciesPresent);
  const reportCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);

  useEffect(() => {
    if (currencyPrefs.currencyMode === 'converted') return;
    setCurrencyPrefs({
      ...currencyPrefs,
      currencyMode: 'converted',
      rates: { ...currencyPrefs.rates, [reportCurrency]: 1 },
    });
  }, [currencyPrefs, reportCurrency, setCurrencyPrefs]);
  const periodLabels = useMemo<Record<PeriodPreset, string>>(
    () => ({
      '7d': t('crm.leads.roi.period.days7'),
      '30d': t('crm.leads.roi.period.days30'),
      '1y': t('crm.leads.roi.period.year1'),
      all: t('crm.leads.roi.period.all'),
      custom: t('crm.leads.roi.period.custom'),
    }),
    [t],
  );
  const modeLabels = useMemo<Record<LeadRoiMode, string>>(
    () => ({
      sales: t('crm.leads.roi.mode.sales'),
      projects: t('crm.leads.roi.mode.projects'),
    }),
    [t],
  );
  const modeDescriptions = useMemo<Record<LeadRoiMode, string>>(
    () => ({
      sales: t('crm.leads.roi.modeDescriptions.sales'),
      projects: t('crm.leads.roi.modeDescriptions.projects'),
    }),
    [t],
  );

  const RoiTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload as LeadRoiRow & { revenueFormatted?: string };

    return (
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
        <div className="font-medium">
          {row.leadName || t('crm.leads.roi.table.unnamed')} ({label})
        </div>
        <div className="mt-1 text-slate-300">
          {t('crm.leads.roi.tooltip.revenue')}{' '}
          <span className="font-mono">
            {row.revenueFormatted ?? row.totalRevenue} {row.currency}
          </span>
        </div>
        <div className="mt-0.5 text-slate-500">
          {t('crm.leads.roi.tooltip.deals', { count: row.dealsCount })}{' '}
          {row.firstDealAt && row.lastDealAt && (
            <>
              · {t('crm.leads.roi.tooltip.period')}{' '}
              {new Date(row.firstDealAt).toLocaleDateString(locale)}–{' '}
              {new Date(row.lastDealAt).toLocaleDateString(locale)}
            </>
          )}
        </div>
        {row.manager && (
          <div className="mt-0.5 text-slate-500">
            {t('crm.leads.roi.tooltip.manager', { name: row.manager })}
          </div>
        )}
      </div>
    );
  };

  // простой пересчёт диапазона при клике по пресетам (без datepicker)
  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);

    if (p === 'all') {
      setRange({});
      return;
    }

    const today = new Date();
    const end = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );

    if (p === '7d') {
      const start = new Date(end);
      start.setUTCDate(end.getUTCDate() - 6);
      setRange({
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      });
    } else if (p === '30d') {
      const start = new Date(end);
      start.setUTCDate(end.getUTCDate() - 29);
      setRange({
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      });
    } else if (p === '1y') {
      const start = new Date(end);
      start.setUTCFullYear(end.getUTCFullYear() - 1);
      setRange({
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      });
    }
  };

  useEffect(() => {
    // при первом рендере — "Все время"
    applyPreset('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // загрузка ROI при изменении диапазона или режима
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchLeadRoi({
      from: range.from,
      to: range.to,
      mode,
      currencyMode: 'converted',
      displayCurrency: reportCurrency,
      rates: { ...currencyPrefs.rates, [reportCurrency]: 1 },
    })
      .then((res) => setStats(res))
      .catch((e: any) => {
        console.error(e);
        setError(e.message || t('crm.leads.roi.errors.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to, mode, reportCurrency, JSON.stringify(currencyPrefs.rates), t]);

  const currency = stats?.currency ?? reportCurrency;

  const topLeads: LeadRoiRow[] = useMemo(() => {
    if (!stats) return [];
    return [...stats.items]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 6);
  }, [stats]);

  const totalRevenueFmt =
    stats?.totalRevenue.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) ?? '0';

  const avgCheckFmt =
    stats?.avgCheck.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) ?? '0';

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + пресеты + режим */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.leads.roi.hero.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-lumiva-accent">
              {t('crm.leads.roi.hero.title')}
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              {modeDescriptions[mode]}
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            {/* Режим: продажи / проекты */}
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-2 py-1 shadow-sm">
              <span className="text-[11px] text-slate-600 pl-1">
                {t('crm.leads.roi.source.label')}
              </span>
              {(Object.keys(modeLabels) as LeadRoiMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={
                    'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                    (mode === m
                      ? 'bg-emerald-500 text-white font-semibold shadow-[0_10px_30px_rgba(16,185,129,0.25)]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                  }
                >
                  {modeLabels[m]}
                </button>
              ))}
            </div>

            {/* Период */}
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] text-slate-600 pl-1">
                {t('crm.leads.roi.period.label')}
              </span>
              {(['7d', '30d', '1y', 'all'] as PeriodPreset[]).map((p) => (
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
                  {periodLabels[p]}
                </button>
              ))}
            </div>

            <AnalyticsCurrencyControl
              state={currencyPrefs}
              onStateChange={setCurrencyPrefs}
            />
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-400">
            {t('crm.leads.roi.loading')}
          </div>
        )}

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {stats && !loading && !error && (
          <>
            {/* KPI блоки */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
              <div className="rounded-3xl bg-white border border-slate-200 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-slate-500 mb-1">
                  {t('crm.leads.roi.kpis.totalRevenue.title')}
                </div>
                <div className="text-2xl font-semibold text-lumiva-accent">
                  {totalRevenueFmt} {currency}
                </div>
                <div className="text-[11px] text-slate-600 mt-2">
                  {t('crm.leads.roi.kpis.totalRevenue.desc', {
                    mode: mode === 'sales'
                      ? t('crm.leads.roi.labels.salesPlural')
                      : t('crm.leads.roi.labels.projectsPlural'),
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-emerald-50 border border-emerald-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-emerald-700 mb-1">
                  {t('crm.leads.roi.kpis.withRevenue.title')}
                </div>
                <div className="text-2xl font-semibold text-emerald-700">
                  {stats.leadsWithRevenue.toLocaleString(locale)}
                </div>
                <div className="text-[11px] text-emerald-700/70 mt-2">
                  {t('crm.leads.roi.kpis.withRevenue.desc', {
                    mode: mode === 'sales'
                      ? t('crm.leads.roi.labels.salesPlural')
                      : t('crm.leads.roi.labels.paidProjects'),
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-sky-50 border border-sky-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-sky-700 mb-1">
                  {t('crm.leads.roi.kpis.avgCheck.title')}
                </div>
                <div className="text-2xl font-semibold text-sky-700">
                  {avgCheckFmt} {currency}
                </div>
                <div className="text-[11px] text-sky-700/70 mt-2">
                  {t('crm.leads.roi.kpis.avgCheck.desc', {
                    mode: mode === 'sales'
                      ? t('crm.leads.roi.labels.saleOrPayment')
                      : t('crm.leads.roi.labels.project'),
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-rose-50 border border-rose-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-rose-700 mb-1">
                  {mode === 'sales'
                    ? t('crm.leads.roi.kpis.deals.titleSales')
                    : t('crm.leads.roi.kpis.deals.titleProjects')}
                </div>
                <div className="text-2xl font-semibold text-rose-700">
                  {stats.dealsCount.toLocaleString(locale)}
                </div>
                <div className="text-[11px] text-rose-700/70 mt-2">
                  {t('crm.leads.roi.kpis.deals.desc', {
                    mode: mode === 'sales'
                      ? t('crm.leads.roi.labels.payments')
                      : t('crm.leads.roi.labels.trackedProjects'),
                  })}
                </div>
              </div>
            </section>

            {/* Топ-лиды + таблица */}
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] md:gap-5">
              {/* Бар-чарт TOP-лидов по доходу */}
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-lumiva-accent">
                      {t('crm.leads.roi.top.title')}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {t('crm.leads.roi.top.subtitle')}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {t('crm.leads.roi.top.shown', { count: topLeads.length })}
                  </span>
                </div>

                <div className="h-64 md:h-72">
                  <ResponsiveContainer>
                    <BarChart
                      data={topLeads}
                      margin={{ top: 10, right: 8, left: -16, bottom: 36 }}
                    >
                      <defs>
                        {topLeads.map((_, idx) => (
                          <linearGradient
                            key={idx}
                            id={`roiLeadGradient${idx}`}
                            x1="0"
                            y1="1"
                            x2="0"
                            y2="0"
                          >
                            <stop
                              offset="0%"
                              stopColor="#020617"
                              stopOpacity={0.1}
                            />
                            <stop
                              offset="40%"
                              stopColor={ROI_COLORS[idx % ROI_COLORS.length]}
                              stopOpacity={0.7}
                            />
                            <stop
                              offset="100%"
                              stopColor={ROI_COLORS[idx % ROI_COLORS.length]}
                              stopOpacity={1}
                            />
                          </linearGradient>
                        ))}
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="leadName"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={38} />
                      <Tooltip content={<RoiTooltip />} />
                      <Bar
                        dataKey="totalRevenue"
                        radius={[10, 10, 4, 4]}
                        barSize={32}
                      >
                        {topLeads.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={`url(#roiLeadGradient${idx})`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Таблица по всем лидам */}
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 text-xs shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-lumiva-accent">
                      {t('crm.leads.roi.table.title')}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {t('crm.leads.roi.table.subtitle', {
                        mode: mode === 'sales'
                          ? t('crm.leads.roi.labels.salesPlural')
                          : t('crm.leads.roi.labels.projectsPlural'),
                      })}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {t('crm.leads.roi.table.count', { count: stats.items.length })}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 pr-3 text-left font-normal">
                          {t('crm.leads.roi.table.columns.lead')}
                        </th>
                        <th className="py-1.5 px-3 text-left font-normal">
                          {t('crm.leads.roi.table.columns.manager')}
                        </th>
                        <th className="py-1.5 px-3 text-left font-normal">
                          {t('crm.leads.roi.table.columns.channel')}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {mode === 'sales'
                            ? t('crm.leads.roi.table.columns.dealsSales')
                            : t('crm.leads.roi.table.columns.dealsProjects')}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {t('crm.leads.roi.table.columns.revenue')}
                        </th>
                        <th className="py-1.5 pl-3 text-right font-normal">
                          {t('crm.leads.roi.table.columns.period')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.items.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-3 text-center text-slate-500"
                          >
                            {t('crm.leads.roi.table.empty')}
                          </td>
                        </tr>
                      )}

                      {stats.items.map((row) => (
                        <tr
                          key={row.leadId}
                          className="border-b border-slate-200 last:border-none hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-1.5 pr-3 text-lumiva-accent">
                            {row.leadName || t('crm.leads.roi.table.unnamed')}
                          </td>
                          <td className="py-1.5 px-3 text-slate-500">
                            {row.manager || t('crm.leads.roi.table.emptyValue')}
                          </td>
                          <td className="py-1.5 px-3 text-slate-500">
                            {row.channel || t('crm.leads.roi.table.unknown')}
                          </td>
                          <td className="py-1.5 px-3 text-right text-lumiva-accent">
                            {row.dealsCount}
                          </td>
                          <td className="py-1.5 px-3 text-right text-sky-700 font-mono">
                            {row.totalRevenue.toLocaleString(locale, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{' '}
                            {row.currency}
                          </td>
                          <td className="py-1.5 pl-3 text-right text-slate-500">
                            {row.firstDealAt && row.lastDealAt ? (
                              <>
                                {new Date(
                                  row.firstDealAt,
                                ).toLocaleDateString(locale)}{' '}
                                —{' '}
                                {new Date(
                                  row.lastDealAt,
                                ).toLocaleDateString(locale)}
                              </>
                            ) : (
                              t('crm.leads.roi.table.emptyValue')
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
};
