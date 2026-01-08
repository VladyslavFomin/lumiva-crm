// src/pages/analytics/LeadsAnalyticsPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import {
  fetchLeadStats,
  type LeadStats,
} from '../../api/leads';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

// ------ Цвета / словари ------

const STATUS_COLORS: Record<string, string> = {
  new: '#38bdf8',
  in_progress: '#8b5cf6',
  waiting: '#facc15',
  won: '#22c55e',
  lost: '#ef4444',
  default: '#64748b',
};

const CHART_COLORS = [
  '#38bdf8',
  '#8b5cf6',
  '#f97316',
  '#22c55e',
  '#e11d48',
  '#6366f1',
];

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

// локальное расширение LeadStats — чтобы не трогать тип в api/leads.ts
type ExtendedLeadStats = LeadStats & {
  totalToday?: number;
  totalThisWeek?: number;
  totalThisMonth?: number;
};

type StatusChartPoint = {
  code: string;
  label: string;
  count: number;
};

type PeriodId = '7d' | '30d' | '1y' | 'all' | 'custom';


export const LeadsAnalyticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [stats, setStats] = useState<ExtendedLeadStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodId>('all');
  const periodLabels = useMemo<Record<PeriodId, string>>(
    () => ({
      '7d': t('crm.leads.analytics.period.days7'),
      '30d': t('crm.leads.analytics.period.days30'),
      '1y': t('crm.leads.analytics.period.year1'),
      all: t('crm.leads.analytics.period.all'),
      custom: t('crm.leads.analytics.period.custom'),
    }),
    [t],
  );

  // ------ загрузка с учётом периода ------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // предполагаем, что fetchLeadStats умеет принимать range,
        // если нет — просто проигнорирует аргумент
        const res = await (fetchLeadStats as any)(
          period === 'all' || period === 'custom' ? undefined : period,
        );
        if (cancelled) return;
        setStats(res as ExtendedLeadStats);
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;
        setError(e.message || t('crm.leads.analytics.errors.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [period, t]);

  const totalLeads = stats?.total ?? 0;
  const totalWon =
    stats?.byStatus.find((s) => s.status === 'won')?.count ?? 0;
  const totalLost =
    stats?.byStatus.find((s) => s.status === 'lost')?.count ?? 0;
    

  const winRate =
    totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0;

  const totalSourceLeads =
  stats?.bySource.reduce((sum, s) => sum + s.count, 0) ?? 0;

  const sourcesCount = stats?.bySource.length ?? 0;
  const managersCount = stats?.byManager.length ?? 0;

  const totalToday = stats?.totalToday ?? 0;
  const totalThisWeek = stats?.totalThisWeek ?? 0;
  const totalThisMonth = stats?.totalThisMonth ?? 0;

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      new: t('crm.leads.statuses.new'),
      in_progress: t('crm.leads.statuses.inProgress'),
      waiting: t('crm.leads.statuses.waiting'),
      won: t('crm.leads.statuses.won'),
      lost: t('crm.leads.statuses.lost'),
    }),
    [t],
  );

  const statusChartData: StatusChartPoint[] = useMemo(
    () =>
      stats?.byStatus.map((s) => ({
        code: s.status,
        label: statusLabels[s.status] ?? s.status,
        count: s.count,
      })) ?? [],
    [stats, statusLabels],
  );

  const hasData = !!stats && !loading && !error;

  const StatusTooltip: React.FC<any & { total: number }> = ({
    active,
    payload,
    total,
  }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload as { label: string; count: number };
    const percent =
      total > 0
        ? ((item.count / total) * 100).toFixed(1).replace('.0', '')
        : '0';

    return (
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
        <div className="font-medium">{item.label}</div>
        <div className="mt-1 flex items-center gap-2 text-slate-300">
          <span className="font-mono">
            {item.count.toLocaleString(locale)} {t('crm.leads.analytics.tooltips.leads')}
          </span>
          <span className="text-slate-500">· {percent}%</span>
        </div>
      </div>
    );
  };

  const SourceTooltip: React.FC<any & { total: number }> = ({
    active,
    payload,
    label,
    total,
  }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload as { source: string; count: number };
    const percent =
      total > 0
        ? ((item.count / total) * 100).toFixed(1).replace('.0', '')
        : '0';

    return (
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
        <div className="font-medium">
          {label || item.source || t('crm.leads.analytics.tooltips.unknown')}
        </div>
        <div className="mt-1 flex items-center gap-2 text-slate-300">
          <span className="font-mono">
            {item.count.toLocaleString(locale)} {t('crm.leads.analytics.tooltips.leads')}
          </span>
          <span className="text-slate-500">· {percent}%</span>
        </div>
      </div>
    );
  };

  // ------ UI ------

  return (
    <MainLayout>
      <div className="pb-10 space-y-6 md:space-y-8">
        {/* HERO / TOP BAR */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
          <div className="relative z-10 flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-7 md:py-6">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                {t('crm.leads.analytics.hero.kicker')}
              </div>
              <h1 className="text-xl font-semibold text-lumiva-accent md:text-2xl">
                {t('crm.leads.analytics.hero.title')}
              </h1>
              <p className="mt-1 max-w-xl text-xs text-slate-600 md:text-[13px]">
                {t('crm.leads.analytics.hero.subtitle')}
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-2 text-xs md:items-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/70 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-700">
                  {t('crm.leads.analytics.hero.note')}
                </span>
              </div>

              {/* переключатель периодов */}
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
                <span className="text-[11px] text-slate-600 pl-1">
                  {t('crm.leads.analytics.period.label')}
                </span>
                <div className="flex">
                  {(['7d', '30d', '1y', 'all', 'custom'] as PeriodId[]).map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          if (p === 'custom') {
                            // сейчас custom = all; дальше можно повесить date-picker
                            setPeriod('custom');
                            return;
                          }
                          setPeriod(p);
                        }}
                        className={
                          'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                          (period === p
                            ? 'bg-black text-white font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.2)]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                        }
                      >
                        {periodLabels[p]}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* МИНИ-ВИДЖЕТЫ: сегодня / неделя / месяц */}
        {hasData && (
          <section className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 md:gap-4">
            {[
              {
                title: t('crm.leads.analytics.summary.today.title'),
                value: totalToday.toLocaleString(locale),
                note: t('crm.leads.analytics.summary.today.note'),
                accent: 'sky',
              },
              {
                title: t('crm.leads.analytics.summary.week.title'),
                value: totalThisWeek.toLocaleString(locale),
                note: t('crm.leads.analytics.summary.week.note'),
                accent: 'violet',
              },
              {
                title: t('crm.leads.analytics.summary.month.title'),
                value: totalThisMonth.toLocaleString(locale),
                note: t('crm.leads.analytics.summary.month.note'),
                accent: 'emerald',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-white px-4 py-4 md:px-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {item.title}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
                      {item.value}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] text-white ${item.accent === 'sky'
                      ? 'bg-sky-400/90'
                      : item.accent === 'violet'
                        ? 'bg-violet-400/90'
                        : 'bg-emerald-400/90'
                      }`}
                  >
                    {item.note}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* LOADING / ERROR */}
        {loading && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 md:p-5"
              >
                <div className="mb-3 h-3 w-20 rounded-full bg-slate-800" />
                <div className="mb-2 h-7 w-16 rounded-full bg-slate-700" />
                <div className="h-3 w-32 rounded-full bg-slate-800" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* MAIN DASHBOARD */}
        {hasData && stats && (
          <>
            {/* KPI STRIP */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
              {[
                {
                  id: 'total',
                  title: t('crm.leads.analytics.kpis.total.title'),
                  value: totalLeads.toLocaleString(locale),
                  desc: t('crm.leads.analytics.kpis.total.desc'),
                  accent: 'slate',
                },
                {
                  id: 'won',
                  title: t('crm.leads.analytics.kpis.won.title'),
                  value: totalWon.toLocaleString(locale),
                  desc: t('crm.leads.analytics.kpis.won.desc'),
                  accent: 'emerald',
                },
                {
                  id: 'lost',
                  title: t('crm.leads.analytics.kpis.lost.title'),
                  value: totalLost.toLocaleString(locale),
                  desc: t('crm.leads.analytics.kpis.lost.desc'),
                  accent: 'rose',
                },
                {
                  id: 'conversion',
                  title: t('crm.leads.analytics.kpis.conversion.title'),
                  value: `${winRate}%`,
                  desc: t('crm.leads.analytics.kpis.conversion.desc'),
                  accent: 'sky',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        {item.title}
                      </div>
                      <div
                        className={`text-2xl font-semibold md:text-[26px] ${item.accent === 'emerald'
                          ? 'text-emerald-600'
                          : item.accent === 'rose'
                            ? 'text-rose-600'
                            : item.accent === 'sky'
                              ? 'text-sky-600'
                              : 'text-lumiva-accent'
                          }`}
                      >
                        {item.value}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {item.desc}
                      </div>
                    </div>
                    {item.id === 'conversion' && (
                      <div className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
                        <div>
                          {t('crm.leads.analytics.kpis.sources')}{' '}
                          <span className="text-lumiva-accent">
                            {sourcesCount}
                          </span>
                        </div>
                        <div>
                          {t('crm.leads.analytics.kpis.managers')}{' '}
                          <span className="text-lumiva-accent">
                            {managersCount}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>

            {/* STATUSES + SOURCES */}
<section className="grid grid-cols-1 gap-4 xl:grid-cols-2 md:gap-5">
  {/* ПРЕМИУМ ПОНЧИК — распределение по статусам */}
  <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-lumiva-accent">
          {t('crm.leads.analytics.statuses.title')}
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-600">
          {t('crm.leads.analytics.statuses.subtitle')}
        </p>
      </div>
      <div className="text-[11px] text-slate-600">
        {t('crm.leads.analytics.statuses.total')}{' '}
        <span className="text-lumiva-accent">
          {totalLeads.toLocaleString(locale)}
        </span>
      </div>
    </div>

    <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
      {/* сам пончик */}
      <div className="relative h-56 flex-1 md:h-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={statusChartData}
              dataKey="count"
              nameKey="label"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={5}
              cornerRadius={10}
              stroke="#e2e8f0"
              strokeWidth={1.5}
              isAnimationActive
            >
              {statusChartData.map((entry, index) => {
                // новая палитра — более “неон”
                const palette = [
                  '#22d3ee', // cyan
                  '#a855f7', // purple
                  '#fb923c', // orange
                  '#4ade80', // green
                  '#f97373', // soft red
                ];
                const fill = palette[index % palette.length];
                return <Cell key={entry.code} fill={fill} />;
              })}
            </Pie>

            <Tooltip
              content={<StatusTooltip total={totalLeads} />}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* центр пончика */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-white px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 border border-slate-200 shadow-sm">
            {t('crm.leads.analytics.statuses.centerLabel')}
          </div>
          <div className="mt-1 text-xl font-semibold text-lumiva-accent">
            {totalLeads.toLocaleString(locale)}
          </div>
          <div className="mt-1 text-[11px] text-sky-600">
            {t('crm.leads.analytics.statuses.winRate', { value: winRate })}
          </div>
        </div>
      </div>

      {/* легенда справа */}
      <div className="flex-1 space-y-2 text-[11px]">
        {statusChartData.map((s, idx) => {
          const palette = [
            '#22d3ee',
            '#a855f7',
            '#fb923c',
            '#4ade80',
            '#f97373',
          ];
          const color = palette[idx % palette.length];
          const percent =
            totalLeads > 0
              ? ((s.count / totalLeads) * 100).toFixed(1).replace('.0', '')
              : '0';

          return (
            <div
              key={s.code}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 border border-slate-200 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-lumiva-accent">{s.label}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-mono">
                  {s.count.toLocaleString(locale)}
                </span>
                <span className="text-slate-500">{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>

  {/* ПРЕМИУМ КАНАЛЫ ПРИВЛЕЧЕНИЯ */}
  <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-lumiva-accent">
          {t('crm.leads.analytics.sources.title')}
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-600">
          {t('crm.leads.analytics.sources.subtitle')}
        </p>
      </div>
      <div className="text-[11px] text-slate-600">
        {t('crm.leads.analytics.sources.count')}{' '}
        <span className="text-lumiva-accent">
          {stats.bySource.length}
        </span>
      </div>
    </div>

    <div className="h-64 md:h-72">
      <ResponsiveContainer>
        <BarChart
          data={stats.bySource}
          margin={{ top: 10, right: 8, left: -20, bottom: 24 }}
        >
          <defs>
            {stats.bySource.map((_, idx) => (
              <linearGradient
                key={idx}
                id={`leadSourceLux${idx}`}
                x1="0"
                y1="1"
                x2="0"
                y2="0"
              >
                <stop offset="0%" stopColor="#020617" stopOpacity={0.1} />
                <stop
                  offset="35%"
                  stopColor={CHART_COLORS[idx % CHART_COLORS.length]}
                  stopOpacity={0.65}
                />
                <stop
                  offset="100%"
                  stopColor={CHART_COLORS[idx % CHART_COLORS.length]}
                  stopOpacity={1}
                />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#1f2937"
          />
          <XAxis
            dataKey="source"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval={0}
            angle={-20}
            textAnchor="end"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            width={38}
          />
          <Tooltip
            content={<SourceTooltip total={totalSourceLeads} />}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#9ca3af' }}
            formatter={() => t('crm.leads.analytics.sources.legend')}
          />
          <Bar
            dataKey="count"
            radius={[10, 10, 4, 4]}
            barSize={32}
          >
            {stats.bySource.map((_, idx) => (
              <Cell
                key={idx}
                fill={`url(#leadSourceLux${idx})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
</section>
            {/* MANAGERS + COUNTRIES */}
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 md:gap-5">
              {/* Менеджеры */}
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-lumiva-accent">
                      {t('crm.leads.analytics.managers.title')}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {t('crm.leads.analytics.managers.subtitle')}
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {t('crm.leads.analytics.managers.count')}{' '}
                    <span className="text-lumiva-accent">
                      {managersCount}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 pr-3 text-left font-normal">
                          {t('crm.leads.analytics.managers.table.manager')}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {t('crm.leads.analytics.managers.table.leads')}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {t('crm.leads.analytics.managers.table.won')}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {t('crm.leads.analytics.managers.table.lost')}
                        </th>
                        <th className="py-1.5 pl-3 text-right font-normal">
                          {t('crm.leads.analytics.managers.table.winRate')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byManager.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-3 text-center text-slate-500"
                          >
                            {t('crm.leads.analytics.managers.empty')}
                          </td>
                        </tr>
                      )}
                      {stats.byManager.map((m) => {
                        const wr =
                          m.total > 0
                            ? Math.round((m.won / m.total) * 100)
                            : 0;
                        return (
                          <tr
                            key={m.manager}
                            className="border-b border-slate-200 last:border-none hover:bg-slate-100 transition-colors"
                          >
                            <td className="py-1.5 pr-3 text-lumiva-accent">
                              {m.manager}
                            </td>
                            <td className="py-1.5 px-3 text-right text-lumiva-accent">
                              {m.total}
                            </td>
                            <td className="py-1.5 px-3 text-right text-emerald-600">
                              {m.won}
                            </td>
                            <td className="py-1.5 px-3 text-right text-rose-600">
                              {m.lost}
                            </td>
                            <td className="py-1.5 pl-3 text-right text-sky-600">
                              {wr}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Страны */}
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-lumiva-accent">
                      {t('crm.leads.analytics.countries.title')}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {t('crm.leads.analytics.countries.subtitle')}
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {t('crm.leads.analytics.countries.count')}{' '}
                    <span className="text-lumiva-accent">
                      {stats.byCountry.length}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 pr-3 text-left font-normal">
                          {t('crm.leads.analytics.countries.table.country')}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {t('crm.leads.analytics.countries.table.leads')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byCountry.length === 0 && (
                        <tr>
                          <td
                            colSpan={2}
                            className="py-3 text-center text-slate-500"
                          >
                            {t('crm.leads.analytics.countries.empty')}
                          </td>
                        </tr>
                      )}
                      {stats.byCountry.map((c) => (
                        <tr
                          key={`${c.country || 'unknown'}-${c.count}`}
                          className="border-b border-slate-200 last:border-none hover:bg-slate-100 transition-colors"
                        >
                          <td className="py-1.5 pr-3 text-lumiva-accent">
                            {c.country || t('crm.leads.analytics.countries.unknown')}
                          </td>
                          <td className="py-1.5 px-3 text-right text-lumiva-accent">
                            {c.count}
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
