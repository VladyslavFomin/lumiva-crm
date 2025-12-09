// src/pages/analytics/LeadsRoiPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchLeadRoi,
  type LeadsRoiStats,
  type LeadRoiRow,
  type LeadRoiMode,
} from '../../api/leads';

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

const periodLabel: Record<PeriodPreset, string> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '1y': '1 год',
  all: 'Все время',
  custom: 'Произвольно',
};

const modeLabel: Record<LeadRoiMode, string> = {
  sales: 'По продажам',
  projects: 'По проектам',
};

const modeDescription: Record<LeadRoiMode, string> = {
  sales:
    'Сколько денег принесли закрытые сделки по лидам за выбранный период. Основано на данных продаж, связанных с лидами.',
  projects:
    'Сколько денег принесли оплаченные проекты по лидам за выбранный период. Основано на суммах проектов, связанных с лидами.',
};

const RoiTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as LeadRoiRow & { revenueFormatted?: string };

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
      <div className="font-medium">
        {row.leadName || 'Без имени'} ({label})
      </div>
      <div className="mt-1 text-slate-300">
        Доход:{' '}
        <span className="font-mono">
          {row.revenueFormatted ?? row.totalRevenue} {row.currency}
        </span>
      </div>
      <div className="mt-0.5 text-slate-500">
        Сделок: {row.dealsCount}{' '}
        {row.firstDealAt && row.lastDealAt && (
          <>
            · период{' '}
            {new Date(row.firstDealAt).toLocaleDateString('ru-RU')}–{' '}
            {new Date(row.lastDealAt).toLocaleDateString('ru-RU')}
          </>
        )}
      </div>
      {row.manager && (
        <div className="mt-0.5 text-slate-500">Менеджер: {row.manager}</div>
      )}
    </div>
  );
};

export const LeadsRoiPage: React.FC = () => {
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [mode, setMode] = useState<LeadRoiMode>('projects'); // по умолчанию – по проектам
  const [stats, setStats] = useState<LeadsRoiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    })
      .then((res) => setStats(res))
      .catch((e: any) => {
        console.error(e);
        setError(e.message || 'Не удалось загрузить ROI по лидам');
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to, mode]);

  const currency = stats?.currency ?? 'EUR';

  const topLeads: LeadRoiRow[] = useMemo(() => {
    if (!stats) return [];
    return [...stats.items]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 6);
  }, [stats]);

  const totalRevenueFmt =
    stats?.totalRevenue.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) ?? '0';

  const avgCheckFmt =
    stats?.avgCheck.toLocaleString('ru-RU', {
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
              Лиды · ROI
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Доход по лидам (ROI)
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {modeDescription[mode]}
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            {/* Режим: продажи / проекты */}
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 px-2 py-1">
              <span className="text-[11px] text-slate-500 pl-1">Источник</span>
              {(Object.keys(modeLabel) as LeadRoiMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={
                    'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                    (mode === m
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow-[0_0_0_1px_rgba(16,185,129,0.35)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900')
                  }
                >
                  {modeLabel[m]}
                </button>
              ))}
            </div>

            {/* Период */}
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 px-2 py-1">
              <span className="text-[11px] text-slate-500 pl-1">Период</span>
              {(['7d', '30d', '1y', 'all'] as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={
                    'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                    (preset === p
                      ? 'bg-sky-500 text-slate-950 font-semibold shadow-[0_0_0_1px_rgba(56,189,248,0.3)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900')
                  }
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-400">
            Загружаем ROI по лидам…
          </div>
        )}

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {stats && !loading && !error && (
          <>
            {/* KPI блоки */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
              <div className="rounded-3xl bg-gradient-to-br from-slate-950/90 via-slate-900/90 to-slate-950/90 border border-slate-800/80 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-slate-400 mb-1">
                  Общий доход
                </div>
                <div className="text-2xl font-semibold text-slate-50">
                  {totalRevenueFmt} {currency}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Сумма всех {mode === 'sales' ? 'сделок' : 'проектов'} по
                  лидам за период.
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-400/10 to-slate-950 border border-emerald-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-emerald-300 mb-1">
                  Лидов с доходом
                </div>
                <div className="text-2xl font-semibold text-emerald-300">
                  {stats.leadsWithRevenue.toLocaleString('ru-RU')}
                </div>
                <div className="text-[11px] text-emerald-200/70 mt-2">
                  Количество лидов, по которым были{' '}
                  {mode === 'sales' ? 'сделки' : 'оплаченные проекты'}.
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-slate-950 border border-sky-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-sky-300 mb-1">
                  Средний чек
                </div>
                <div className="text-2xl font-semibold text-sky-300">
                  {avgCheckFmt} {currency}
                </div>
                <div className="text-[11px] text-sky-100/70 mt-2">
                  Средний размер{' '}
                  {mode === 'sales' ? 'сделки/оплаты' : 'проекта'} по лидам.
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-fuchsia-500/10 via-rose-500/5 to-slate-950 border border-fuchsia-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-fuchsia-300 mb-1">
                  {mode === 'sales' ? 'Сделок' : 'Проектов'}
                </div>
                <div className="text-2xl font-semibold text-fuchsia-300">
                  {stats.dealsCount.toLocaleString('ru-RU')}
                </div>
                <div className="text-[11px] text-fuchsia-100/70 mt-2">
                  Общее количество{' '}
                  {mode === 'sales'
                    ? 'оплат / закрытых сделок'
                    : 'учтённых проектов'}.
                </div>
              </div>
            </section>

            {/* Топ-лиды + таблица */}
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] md:gap-5">
              {/* Бар-чарт TOP-лидов по доходу */}
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 shadow-[0_24px_70px_rgba(15,23,42,0.9)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-50">
                      Топ лидов по доходу
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Лиды с наибольшим суммарным доходом за выбранный период.
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Показано: {topLeads.length}
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

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#1f2937"
                      />
                      <XAxis
                        dataKey="leadName"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        width={38}
                      />
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
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-50">
                      Лиды и доход
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Детализированный список лидов с суммарным доходом и
                      периодом {mode === 'sales' ? 'сделок' : 'проектов'}.
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Лидов: {stats.items.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400">
                        <th className="py-1.5 pr-3 text-left font-normal">
                          Лид
                        </th>
                        <th className="py-1.5 px-3 text-left font-normal">
                          Менеджер
                        </th>
                        <th className="py-1.5 px-3 text-left font-normal">
                          Канал
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {mode === 'sales' ? 'Сделок' : 'Проектов'}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          Доход
                        </th>
                        <th className="py-1.5 pl-3 text-right font-normal">
                          Период
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
                            Пока нет лидов с доходом за выбранный период.
                          </td>
                        </tr>
                      )}

                      {stats.items.map((row) => (
                        <tr
                          key={row.leadId}
                          className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="py-1.5 pr-3 text-slate-100">
                            {row.leadName || 'Без имени'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-300">
                            {row.manager || '—'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-400">
                            {row.channel || 'unknown'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-100">
                            {row.dealsCount}
                          </td>
                          <td className="py-1.5 px-3 text-right text-sky-300 font-mono">
                            {row.totalRevenue.toLocaleString('ru-RU', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{' '}
                            {row.currency}
                          </td>
                          <td className="py-1.5 pl-3 text-right text-slate-400">
                            {row.firstDealAt && row.lastDealAt ? (
                              <>
                                {new Date(
                                  row.firstDealAt,
                                ).toLocaleDateString('ru-RU')}{' '}
                                —{' '}
                                {new Date(
                                  row.lastDealAt,
                                ).toLocaleDateString('ru-RU')}
                              </>
                            ) : (
                              '—'
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