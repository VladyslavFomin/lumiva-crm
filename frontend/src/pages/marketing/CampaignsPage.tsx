// src/pages/marketing/CampaignsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingTraffic,
  type MarketingTrafficStats,
  type MarketingTrafficRow,
} from '../../api/marketing';

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

type PeriodPreset = '7d' | '30d' | '90d' | 'all';

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
  '90d': '90 дней',
  all: 'Все время',
};

interface CampaignAgg {
  name: string;
  source: string | null;
  medium: string | null;

  cost: number;
  revenue: number;
  clicks: number;
  sessions: number;
  leads: number;

  currency: string;

  roas: number; // revenue / cost
  cpl: number; // cost / leads
  cpc: number; // cost / clicks
}

const CampaignTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as CampaignAgg;

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl max-w-[260px]">
      <div className="font-medium truncate">{label}</div>
      <div className="mt-1 text-slate-300">
        Доход:{' '}
        <span className="font-mono">
          {row.revenue.toLocaleString('ru-RU', {
            maximumFractionDigits: 0,
          })}{' '}
          {row.currency}
        </span>
      </div>
      <div className="mt-0.5 text-slate-400">
        Расход:{' '}
        <span className="font-mono">
          {row.cost.toLocaleString('ru-RU', {
            maximumFractionDigits: 0,
          })}{' '}
          {row.currency}
        </span>
      </div>
      <div className="mt-0.5 text-slate-500">
        Лиды: {row.leads} · Клики: {row.clicks} · Сессии: {row.sessions}
      </div>
      <div className="mt-0.5 text-slate-500">
        ROAS:{' '}
        {row.roas ? `${row.roas.toFixed(2)}×` : '—'} · CPL:{' '}
        {row.cpl ? `${row.cpl.toFixed(2)} ${row.currency}` : '—'}
      </div>
    </div>
  );
};

export const CampaignsPage: React.FC = () => {
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [stats, setStats] = useState<MarketingTrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // простой пересчёт диапазона при клике по пресетам
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
    } else if (p === '90d') {
      const start = new Date(end);
      start.setUTCDate(end.getUTCDate() - 89);
      setRange({
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      });
    }
  };

  useEffect(() => {
    // первый рендер — "Все время"
    applyPreset('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // загрузка трафика при изменении диапазона
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchMarketingTraffic({
      from: range.from,
      to: range.to,
    })
      .then((res) => setStats(res))
      .catch((e: any) => {
        console.error(e);
        setError(e.message || 'Не удалось загрузить данные по кампаниям');
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const currency = stats?.currency ?? 'EUR';

  // Агрегируем по utm_campaign
  const campaigns: CampaignAgg[] = useMemo(() => {
    if (!stats) return [];

    const map = new Map<string, CampaignAgg>();

    (stats.items || []).forEach((row: MarketingTrafficRow) => {
      const r: any = row; // utm-поля живут здесь как any

      const nameRaw =
        (r.campaign as string | undefined) || '(без utm_campaign)';
      const name = String(nameRaw);
      const key = name;

      const current = map.get(key) || {
        name,
        source: (r.source as string | undefined) ?? null,
        medium: (r.medium as string | undefined) ?? null,
        cost: 0,
        revenue: 0,
        clicks: 0,
        sessions: 0,
        leads: 0,
        currency: row.currency || currency,
        roas: 0,
        cpl: 0,
        cpc: 0,
      };

      current.cost += row.cost || 0;
      current.revenue += row.revenue || 0;
      current.clicks += row.clicks || 0;
      current.sessions += (r.sessions as number | undefined) || 0;
      current.leads += row.leads || 0;

      map.set(key, current);
    });

    const list = Array.from(map.values());

    list.forEach((c) => {
      c.roas = c.cost > 0 ? c.revenue / c.cost : 0;
      c.cpl = c.leads > 0 ? c.cost / c.leads : 0;
      c.cpc = c.clicks > 0 ? c.cost / c.clicks : 0;
    });

    // сортируем по выручке
    list.sort((a, b) => b.revenue - a.revenue);

    return list;
  }, [stats, currency]);

  const totalCampaigns = campaigns.length;
  const totalCost = campaigns.reduce((s, c) => s + c.cost, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);

  const totalRoas = totalCost > 0 ? totalRevenue / totalCost : 0;
  const avgCpl = totalLeads > 0 ? totalCost / totalLeads : 0;

  const topCampaigns = campaigns.slice(0, 6);

  const totalCostFmt = totalCost.toLocaleString('ru-RU', {
    maximumFractionDigits: 0,
  });
  const totalRevenueFmt = totalRevenue.toLocaleString('ru-RU', {
    maximumFractionDigits: 0,
  });
  const avgCplFmt = avgCpl.toLocaleString('ru-RU', {
    maximumFractionDigits: 0,
  });

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + пресеты */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              Маркетинг · Кампании
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Эффективность кампаний (по UTM)
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Группировка по utm_campaign: расходы, выручка, лиды, ROAS и CPL.
              Источник данных — сводный трафик из Google / Yandex / CRM.
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            {/* Период */}
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 px-2 py-1">
              <span className="text-[11px] text-slate-500 pl-1">Период</span>
              {(['7d', '30d', '90d', 'all'] as PeriodPreset[]).map((p) => (
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
            Загружаем данные по кампаниям…
          </div>
        )}

        {error && <div className="text-[11px] text-red-400">{error}</div>}

        {stats && !loading && !error && (
          <>
            {/* KPI блоки */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
              <div className="rounded-3xl bg-gradient-to-br from-slate-950/90 via-slate-900/90 to-slate-950/90 border border-slate-800/80 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-slate-400 mb-1">
                  Количество кампаний
                </div>
                <div className="text-2xl font-semibold text-slate-50">
                  {totalCampaigns.toLocaleString('ru-RU')}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Число кампаний, по которым зафиксирован трафик / расходы.
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-slate-950 border border-sky-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-sky-300 mb-1">
                  Расходы по кампаниям
                </div>
                <div className="text-2xl font-semibold text-sky-300">
                  {totalCostFmt} {currency}
                </div>
                <div className="text-[11px] text-sky-100/70 mt-2">
                  Суммарные маркетинговые расходы за выбранный период.
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-400/10 to-slate-950 border border-emerald-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-emerald-300 mb-1">
                  Доход по кампаниям
                </div>
                <div className="text-2xl font-semibold text-emerald-300">
                  {totalRevenueFmt} {currency}
                </div>
                <div className="text-[11px] text-emerald-200/70 mt-2">
                  Атрибутированный доход (по связанным лидам / продажам).
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-fuchsia-500/10 via-rose-500/5 to-slate-950 border border-fuchsia-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-fuchsia-300 mb-1">
                  ROAS &amp; CPL
                </div>
                <div className="text-sm font-semibold text-fuchsia-100">
                  ROAS:{' '}
                  <span className="text-xl">
                    {totalRoas ? totalRoas.toFixed(2) : '—'}×
                  </span>
                </div>
                <div className="text-[11px] text-fuchsia-100/70 mt-1">
                  CPL: {totalLeads > 0 ? `${avgCplFmt} ${currency}` : '—'}
                </div>
                <div className="text-[11px] text-fuchsia-100/60 mt-1">
                  В совокупности по всем кампаниям.
                </div>
              </div>
            </section>

            {/* Топ кампаний + таблица */}
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] md:gap-5">
              {/* Бар-чарт TOP-кампаний по доходу */}
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 shadow-[0_24px_70px_rgba(15,23,42,0.9)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-50">
                      Топ кампаний по доходу
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Кампании с наибольшей суммарной выручкой.
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Показано: {topCampaigns.length}
                  </span>
                </div>

                <div className="h-64 md:h-72">
                  <ResponsiveContainer>
                    <BarChart
                      data={topCampaigns}
                      margin={{ top: 10, right: 8, left: -16, bottom: 40 }}
                    >
                      <defs>
                        {topCampaigns.map((_, idx) => (
                          <linearGradient
                            key={idx}
                            id={`campaignGradient${idx}`}
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
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        width={38}
                      />
                      <Tooltip content={<CampaignTooltip />} />
                      <Bar
                        dataKey="revenue"
                        radius={[10, 10, 4, 4]}
                        barSize={32}
                      >
                        {topCampaigns.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={`url(#campaignGradient${idx})`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Таблица по всем кампаниям */}
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-50">
                      Кампании и эффективность
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Сводка по расходам, доходу и ключевым метрикам.
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Кампаний: {campaigns.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400">
                        <th className="py-1.5 pr-3 text-left font-normal">
                          Кампания
                        </th>
                        <th className="py-1.5 px-3 text-left font-normal">
                          Источник
                        </th>
                        <th className="py-1.5 px-3 text-left font-normal">
                          Medium
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          Расход
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          Доход
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          Лиды
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          ROAS
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          CPL
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-3 text-center text-slate-500"
                          >
                            Пока нет данных по кампаниям за выбранный период.
                          </td>
                        </tr>
                      )}

                      {campaigns.map((c) => (
                        <tr
                          key={c.name}
                          className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="py-1.5 pr-3 text-slate-100 max-w-[220px] truncate">
                            {c.name}
                          </td>
                          <td className="py-1.5 px-3 text-slate-300">
                            {c.source || '—'}
                          </td>
                          <td className="py-1.5 px-3 text-slate-300">
                            {c.medium || '—'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-100 font-mono">
                            {c.cost.toLocaleString('ru-RU', {
                              maximumFractionDigits: 0,
                            })}{' '}
                            {c.currency}
                          </td>
                          <td className="py-1.5 px-3 text-right text-emerald-300 font-mono">
                            {c.revenue.toLocaleString('ru-RU', {
                              maximumFractionDigits: 0,
                            })}{' '}
                            {c.currency}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-100">
                            {c.leads.toLocaleString('ru-RU')}
                          </td>
                          <td className="py-1.5 px-3 text-right text-sky-300">
                            {c.roas ? `${c.roas.toFixed(2)}×` : '—'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-300">
                            {c.cpl
                              ? `${c.cpl.toFixed(2)} ${c.currency}`
                              : '—'}
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