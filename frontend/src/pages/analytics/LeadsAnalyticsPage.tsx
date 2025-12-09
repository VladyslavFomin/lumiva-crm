// src/pages/analytics/LeadsAnalyticsPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
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

const STATUS_LABELS: Record<string, string> = {
  new: 'Новые',
  in_progress: 'В работе',
  waiting: 'Ожидают',
  won: 'Успешные',
  lost: 'Проигранные',
};

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

const PERIOD_LABELS: Record<PeriodId, string> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '1y': '1 год',
  all: 'Все время',
  custom: 'Custom',
};
// Премиум-tooltip для пончика
const StatusTooltip: React.FC<any & { total: number }> = ({
  active,
  payload,
  total,
}) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload as { label: string; count: number };
  const percent =
    total > 0 ? ((item.count / total) * 100).toFixed(1).replace('.0', '') : '0';

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
      <div className="font-medium">{item.label}</div>
      <div className="mt-1 flex items-center gap-2 text-slate-300">
        <span className="font-mono">
          {item.count.toLocaleString('ru-RU')} лидов
        </span>
        <span className="text-slate-500">· {percent}%</span>
      </div>
    </div>
  );
};

// Tooltip для каналов
const SourceTooltip: React.FC<any & { total: number }> = ({
  active,
  payload,
  label,
  total,
}) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload as { source: string; count: number };
  const percent =
    total > 0 ? ((item.count / total) * 100).toFixed(1).replace('.0', '') : '0';

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
      <div className="font-medium">{label || item.source || 'unknown'}</div>
      <div className="mt-1 flex items-center gap-2 text-slate-300">
        <span className="font-mono">
          {item.count.toLocaleString('ru-RU')} лидов
        </span>
        <span className="text-slate-500">· {percent}%</span>
      </div>
    </div>
  );
};

export const LeadsAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<ExtendedLeadStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodId>('all');

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
        setError(e.message || 'Не удалось загрузить аналитику по лидам');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

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

  const statusChartData: StatusChartPoint[] = useMemo(
    () =>
      stats?.byStatus.map((s) => ({
        code: s.status,
        label: STATUS_LABELS[s.status] ?? s.status,
        count: s.count,
      })) ?? [],
    [stats],
  );

  const hasData = !!stats && !loading && !error;

  // ------ UI ------

  return (
    <MainLayout>
      <div className="pb-10 space-y-6 md:space-y-8">
        {/* HERO / TOP BAR */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 shadow-[0_0_80px_rgba(15,23,42,0.90)]">
          {/* световые пятна */}
          <div className="pointer-events-none absolute -right-40 -top-40 h-72 w-72 rounded-full bg-gradient-to-br from-sky-500/40 via-indigo-500/30 to-emerald-400/10 blur-3xl opacity-80" />
          <div className="pointer-events-none absolute -left-40 bottom-[-120px] h-72 w-72 rounded-full bg-gradient-to-tr from-sky-500/30 via-fuchsia-500/20 to-transparent blur-3xl opacity-60" />

          <div className="relative z-10 flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-7 md:py-6">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Лиды · Аналитика
              </div>
              <h1 className="text-xl font-semibold text-slate-50 md:text-2xl">
                Пульс воронки продаж
              </h1>
              <p className="mt-1 max-w-xl text-xs text-slate-400 md:text-[13px]">
                Современный дашборд по лидам: статусы, источники, эффективность
                менеджеров и география входящих запросов.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-2 text-xs md:items-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/70 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300">
                  Данные по всем лидам арендатора
                </span>
              </div>

              {/* переключатель периодов */}
              <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/70 px-3 py-1.5 border border-slate-800/80">
                <span className="text-[11px] text-slate-500">Период</span>
                <div className="flex overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 text-[11px]">
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
                          'px-2.5 py-1 transition-colors ' +
                          (period === p
                            ? 'bg-sky-500/90 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-100')
                        }
                      >
                        {PERIOD_LABELS[p]}
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
            <div className="relative overflow-hidden rounded-3xl border border-sky-700/50 bg-gradient-to-br from-sky-950/80 via-slate-950 to-slate-950 px-4 py-4 md:px-5">
              <div className="pointer-events-none absolute -right-20 -top-10 h-32 w-32 rounded-full bg-sky-500/30 blur-2xl opacity-80" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-sky-300/90">
                    Сегодня
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-sky-100">
                    {totalToday.toLocaleString('ru-RU')}
                  </div>
                </div>
                <span className="rounded-full bg-sky-500/15 px-2 py-1 text-[10px] text-sky-200">
                  новые обращения
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-violet-700/50 bg-gradient-to-br from-violet-950/80 via-slate-950 to-slate-950 px-4 py-4 md:px-5">
              <div className="pointer-events-none absolute -right-16 -bottom-14 h-32 w-32 rounded-full bg-violet-500/30 blur-2xl opacity-80" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-violet-300/90">
                    Неделя
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-violet-100">
                    {totalThisWeek.toLocaleString('ru-RU')}
                  </div>
                </div>
                <span className="rounded-full bg-violet-500/15 px-2 py-1 text-[10px] text-violet-100">
                  за последние 7 дней
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-emerald-700/50 bg-gradient-to-br from-emerald-950/80 via-slate-950 to-slate-950 px-4 py-4 md:px-5">
              <div className="pointer-events-none absolute -left-16 -bottom-14 h-32 w-32 rounded-full bg-emerald-500/30 blur-2xl opacity-80" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">
                    Месяц
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-100">
                    {totalThisMonth.toLocaleString('ru-RU')}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-100">
                  за последние 30 дней
                </span>
              </div>
            </div>
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
              <div className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-4 py-4 md:px-5 md:py-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-sky-500/70">
                <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-sky-500/20 blur-2xl opacity-70 group-hover:opacity-90" />
                <div className="relative z-10 flex flex-col gap-1.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Всего лидов
                  </div>
                  <div className="text-2xl font-semibold text-slate-50 md:text-[26px]">
                    {totalLeads.toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Все входящие обращения, учитывая статусы и источники.
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-3xl border border-emerald-700/50 bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 px-4 py-4 md:px-5 md:py-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-emerald-400/80">
                <div className="pointer-events-none absolute -right-16 -bottom-20 h-32 w-32 rounded-full bg-emerald-400/25 blur-2xl opacity-80" />
                <div className="relative z-10 flex flex-col gap-1.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">
                    Успешные
                  </div>
                  <div className="text-2xl font-semibold text-emerald-400 md:text-[26px]">
                    {totalWon.toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[11px] text-emerald-200/80">
                    Статус <span className="font-mono text-xs">'won'</span> — закрытые с успехом сделки.
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-3xl border border-rose-800/60 bg-gradient-to-br from-rose-950/50 via-slate-950 to-slate-950 px-4 py-4 md:px-5 md:py-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-rose-500/80">
                <div className="pointer-events-none absolute -left-16 -top-16 h-32 w-32 rounded-full bg-rose-500/20 blur-2xl opacity-80" />
                <div className="relative z-10 flex flex-col gap-1.5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-rose-200/90">
                    Потери
                  </div>
                  <div className="text-2xl font-semibold text-rose-300 md:text-[26px]">
                    {totalLost.toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[11px] text-rose-100/70">
                    Статус <span className="font-mono text-xs">'lost'</span> — сделки, которые не дошли до продажи.
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-4 py-4 md:px-5 md:py-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-sky-500/70">
                <div className="pointer-events-none absolute -right-14 -top-10 h-28 w-28 rounded-full bg-indigo-500/25 blur-2xl opacity-80" />
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Конверсия
                    </div>
                    <div className="text-2xl font-semibold text-sky-400 md:text-[26px]">
                      {winRate}%
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Успешные лиды / все лиды.
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
                    <div>
                      Источники:{' '}
                      <span className="text-slate-100">
                        {sourcesCount}
                      </span>
                    </div>
                    <div>
                      Менеджеры:{' '}
                      <span className="text-slate-100">
                        {managersCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* STATUSES + SOURCES */}
<section className="grid grid-cols-1 gap-4 xl:grid-cols-2 md:gap-5">
  {/* ПРЕМИУМ ПОНЧИК — распределение по статусам */}
  <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 shadow-[0_24px_70px_rgba(15,23,42,0.9)] md:px-5 md:py-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-50">
          Распределение по статусам
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Какой долей в воронке занимает каждый статус лида.
        </p>
      </div>
      <div className="text-[11px] text-slate-500">
        Всего:{' '}
        <span className="text-slate-100">
          {totalLeads.toLocaleString('ru-RU')}
        </span>
      </div>
    </div>

    <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
      {/* сам пончик */}
      <div className="relative h-56 flex-1 md:h-64">
        <ResponsiveContainer>
          <PieChart>
            <defs>
              {/* мягкое свечение под пончиком */}
              <filter id="leadStatusGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow
                  dx="0"
                  dy="6"
                  stdDeviation="10"
                  floodColor="#0f172a"
                  floodOpacity="0.9"
                />
              </filter>
            </defs>

            <Pie
              data={statusChartData}
              dataKey="count"
              nameKey="label"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={5}
              cornerRadius={10}
              stroke="#020617"
              strokeWidth={3}
              // @ts-ignore
              filter="url(#leadStatusGlow)"
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
          <div className="rounded-full bg-slate-950/80 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 border border-slate-800/80">
            Лидов
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-50">
            {totalLeads.toLocaleString('ru-RU')}
          </div>
          <div className="mt-1 text-[11px] text-sky-400">
            Win-rate {winRate}%
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
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900/60 px-3 py-2 border border-slate-800/80"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-slate-100">{s.label}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="font-mono">
                  {s.count.toLocaleString('ru-RU')}
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
  <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 shadow-[0_24px_70px_rgba(15,23,42,0.9)] md:px-5 md:py-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-50">
          Каналы привлечения
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Источники заявок: формы, реклама, органика и другие входы.
        </p>
      </div>
      <div className="text-[11px] text-slate-500">
        Каналов:{' '}
        <span className="text-slate-100">
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
            formatter={() => 'Кол-во лидов'}
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
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-50">
                      Эффективность менеджеров
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Распределение лидов и выигранных сделок по ответственным.
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Менеджеров:{' '}
                    <span className="text-slate-100">
                      {managersCount}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400">
                        <th className="py-1.5 pr-3 text-left font-normal">
                          Менеджер
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          Лидов
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          Успехов
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          Потерь
                        </th>
                        <th className="py-1.5 pl-3 text-right font-normal">
                          Win-rate
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
                            Пока нет данных по менеджерам.
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
                            className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/60 transition-colors"
                          >
                            <td className="py-1.5 pr-3 text-slate-100">
                              {m.manager}
                            </td>
                            <td className="py-1.5 px-3 text-right text-slate-100">
                              {m.total}
                            </td>
                            <td className="py-1.5 px-3 text-right text-emerald-400">
                              {m.won}
                            </td>
                            <td className="py-1.5 px-3 text-right text-rose-400">
                              {m.lost}
                            </td>
                            <td className="py-1.5 pl-3 text-right text-sky-400">
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
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-50">
                      География лидов
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Страны, из которых приходят запросы (по полю country).
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Стран:{' '}
                    <span className="text-slate-100">
                      {stats.byCountry.length}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400">
                        <th className="py-1.5 pr-3 text-left font-normal">
                          Страна
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          Лидов
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
                            Пока ни в одном лиде не указана страна.
                          </td>
                        </tr>
                      )}
                      {stats.byCountry.map((c) => (
                        <tr
                          key={`${c.country || 'unknown'}-${c.count}`}
                          className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/60 transition-colors"
                        >
                          <td className="py-1.5 pr-3 text-slate-100">
                            {c.country || '—'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-100">
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