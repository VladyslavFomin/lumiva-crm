// src/pages/marketing/CampaignsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingTraffic,
  type MarketingTrafficStats,
  type MarketingTrafficRow,
} from '../../api/marketing';
import { getLocale } from '../../i18n/utils';

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

const CampaignTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: CampaignAgg }>;
  label?: string;
  locale: string;
  t: (key: string, options?: any) => string;
}> = ({ active, payload, label, locale, t }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as CampaignAgg;

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl max-w-[260px]">
      <div className="font-medium truncate">{label}</div>
      <div className="mt-1 text-slate-300">
        {t('crm.marketingCampaigns.tooltip.revenue')}:{' '}
        <span className="font-mono">
          {row.revenue.toLocaleString(locale, {
            maximumFractionDigits: 0,
          })}{' '}
          {row.currency}
        </span>
      </div>
      <div className="mt-0.5 text-slate-400">
        {t('crm.marketingCampaigns.tooltip.cost')}:{' '}
        <span className="font-mono">
          {row.cost.toLocaleString(locale, {
            maximumFractionDigits: 0,
          })}{' '}
          {row.currency}
        </span>
      </div>
      <div className="mt-0.5 text-slate-500">
        {t('crm.marketingCampaigns.tooltip.leads')}: {row.leads} ·{' '}
        {t('crm.marketingCampaigns.tooltip.clicks')}: {row.clicks} ·{' '}
        {t('crm.marketingCampaigns.tooltip.sessions')}: {row.sessions}
      </div>
      <div className="mt-0.5 text-slate-500">
        {t('crm.marketingCampaigns.tooltip.roas')}:{' '}
        {row.roas ? `${row.roas.toFixed(2)}×` : t('crm.marketingCampaigns.common.empty')} ·{' '}
        {t('crm.marketingCampaigns.tooltip.cpl')}:{' '}
        {row.cpl ? `${row.cpl.toFixed(2)} ${row.currency}` : t('crm.marketingCampaigns.common.empty')}
      </div>
    </div>
  );
};

export const CampaignsPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [stats, setStats] = useState<MarketingTrafficStats | null>(null);
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
  const periodLabel: Record<PeriodPreset, string> = {
    '7d': t('crm.marketingCampaigns.periods.7d'),
    '30d': t('crm.marketingCampaigns.periods.30d'),
    '90d': t('crm.marketingCampaigns.periods.90d'),
    all: t('crm.marketingCampaigns.periods.all'),
  };

  const baseColumns = useMemo(
    () => [
      { id: 'campaign', label: t('crm.marketingCampaigns.table.headers.campaign') },
      { id: 'source', label: t('crm.marketingCampaigns.table.headers.source') },
      { id: 'medium', label: t('crm.marketingCampaigns.table.headers.medium') },
      { id: 'cost', label: t('crm.marketingCampaigns.table.headers.cost') },
      { id: 'revenue', label: t('crm.marketingCampaigns.table.headers.revenue') },
      { id: 'leads', label: t('crm.marketingCampaigns.table.headers.leads') },
      { id: 'roas', label: t('crm.marketingCampaigns.table.headers.roas') },
      { id: 'cpl', label: t('crm.marketingCampaigns.table.headers.cpl') },
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

  const getColumnWidth = (id: string, fallback: number) =>
    columnWidths[id] ?? fallback;

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem('marketing_campaigns_columns');
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
        'marketing_campaigns_columns',
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

  const renderCell = (row: CampaignAgg, columnId: string) => {
    switch (columnId) {
      case 'campaign':
        return (
          <span className="text-slate-100 max-w-[220px] truncate inline-block">
            {row.name}
          </span>
        );
      case 'source':
        return row.source || t('crm.marketingCampaigns.common.empty');
      case 'medium':
        return row.medium || t('crm.marketingCampaigns.common.empty');
      case 'cost':
        return (
          <span className="text-slate-100 font-mono">
            {row.cost.toLocaleString(locale, { maximumFractionDigits: 0 })}{' '}
            {row.currency}
          </span>
        );
      case 'revenue':
        return (
          <span className="text-emerald-300 font-mono">
            {row.revenue.toLocaleString(locale, { maximumFractionDigits: 0 })}{' '}
            {row.currency}
          </span>
        );
      case 'leads':
        return row.leads.toLocaleString(locale);
      case 'roas':
        return row.roas ? `${row.roas.toFixed(2)}×` : t('crm.marketingCampaigns.common.empty');
      case 'cpl':
        return row.cpl
          ? `${row.cpl.toFixed(2)} ${row.currency}`
          : t('crm.marketingCampaigns.common.empty');
      default:
        return null;
    }
  };

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
        setError(e.message || t('crm.marketingCampaigns.errors.load'));
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
        (r.campaign as string | undefined) || t('crm.marketingCampaigns.common.noCampaign');
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
  }, [stats, currency, t]);

  const totalCampaigns = campaigns.length;
  const totalCost = campaigns.reduce((s, c) => s + c.cost, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);

  const totalRoas = totalCost > 0 ? totalRevenue / totalCost : 0;
  const avgCpl = totalLeads > 0 ? totalCost / totalLeads : 0;

  const topCampaigns = campaigns.slice(0, 6);

  const totalCostFmt = totalCost.toLocaleString(locale, {
    maximumFractionDigits: 0,
  });
  const totalRevenueFmt = totalRevenue.toLocaleString(locale, {
    maximumFractionDigits: 0,
  });
  const avgCplFmt = avgCpl.toLocaleString(locale, {
    maximumFractionDigits: 0,
  });

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + пресеты */}
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
            {/* Период */}
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] text-slate-600 pl-1">
                {t('crm.marketingCampaigns.periodLabel')}
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
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-400">
            {t('crm.marketingCampaigns.loading')}
          </div>
        )}

        {error && <div className="text-[11px] text-red-400">{error}</div>}

        {stats && !loading && !error && (
          <>
            {/* KPI блоки */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
              <div className="rounded-3xl bg-white border border-slate-200 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-slate-500 mb-1">
                  {t('crm.marketingCampaigns.kpi.campaigns')}
                </div>
                <div className="text-2xl font-semibold text-slate-900">
                  {totalCampaigns.toLocaleString(locale)}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  {t('crm.marketingCampaigns.kpi.campaignsHint')}
                </div>
              </div>

              <div className="rounded-3xl bg-sky-50 border border-sky-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-sky-600 mb-1">
                  {t('crm.marketingCampaigns.kpi.cost')}
                </div>
                <div className="text-2xl font-semibold text-sky-700">
                  {totalCostFmt} {currency}
                </div>
                <div className="text-[11px] text-sky-700/70 mt-2">
                  {t('crm.marketingCampaigns.kpi.costHint')}
                </div>
              </div>

              <div className="rounded-3xl bg-emerald-50 border border-emerald-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-emerald-600 mb-1">
                  {t('crm.marketingCampaigns.kpi.revenue')}
                </div>
                <div className="text-2xl font-semibold text-emerald-700">
                  {totalRevenueFmt} {currency}
                </div>
                <div className="text-[11px] text-emerald-700/70 mt-2">
                  {t('crm.marketingCampaigns.kpi.revenueHint')}
                </div>
              </div>

              <div className="rounded-3xl bg-rose-50 border border-rose-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-rose-600 mb-1">
                  {t('crm.marketingCampaigns.kpi.roasCpl')}
                </div>
                <div className="text-sm font-semibold text-rose-700">
                  {t('crm.marketingCampaigns.kpi.roas')}:{' '}
                  <span className="text-xl">
                    {totalRoas ? totalRoas.toFixed(2) : t('crm.marketingCampaigns.common.empty')}×
                  </span>
                </div>
                <div className="text-[11px] text-rose-700/70 mt-1">
                  {t('crm.marketingCampaigns.kpi.cpl')}:{' '}
                  {totalLeads > 0
                    ? `${avgCplFmt} ${currency}`
                    : t('crm.marketingCampaigns.common.empty')}
                </div>
                <div className="text-[11px] text-rose-700/60 mt-1">
                  {t('crm.marketingCampaigns.kpi.roasCplHint')}
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
                      {t('crm.marketingCampaigns.top.title')}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {t('crm.marketingCampaigns.top.subtitle')}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {t('crm.marketingCampaigns.top.shown', {
                      count: topCampaigns.length,
                    })}
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
                      <Tooltip
                        content={
                          <CampaignTooltip locale={locale} t={t} />
                        }
                      />
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
                      {t('crm.marketingCampaigns.table.title')}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {t('crm.marketingCampaigns.table.subtitle')}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {t('crm.marketingCampaigns.table.count', {
                      count: campaigns.length,
                    })}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px] table-fixed">
                    <thead>
                      <tr className="border-b border-slate-800/80 text-slate-400">
                        {orderedColumns.map((col) => {
                          const fallback =
                            col.id === 'campaign'
                              ? 220
                              : col.id === 'source'
                                ? 140
                                : col.id === 'medium'
                                  ? 140
                                  : col.id === 'cost'
                                    ? 120
                                    : col.id === 'revenue'
                                      ? 130
                                      : col.id === 'leads'
                                        ? 90
                                        : col.id === 'roas'
                                          ? 90
                                          : 120;
                          const width = getColumnWidth(col.id, fallback);
                          const alignRight =
                            ['cost', 'revenue', 'leads', 'roas', 'cpl'].includes(
                              col.id,
                            );
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
                                alignRight ? 'text-right' : 'text-left'
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
                      {campaigns.length === 0 && (
                        <tr>
                          <td
                            colSpan={orderedColumns.length}
                            className="py-3 text-center text-slate-500"
                          >
                            {t('crm.marketingCampaigns.table.empty')}
                          </td>
                        </tr>
                      )}

                      {campaigns.map((c) => (
                        <tr
                          key={c.name}
                          className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/50 transition-colors"
                        >
                          {orderedColumns.map((col) => {
                            const fallback =
                              col.id === 'campaign'
                                ? 220
                                : col.id === 'source'
                                  ? 140
                                  : col.id === 'medium'
                                    ? 140
                                    : col.id === 'cost'
                                      ? 120
                                      : col.id === 'revenue'
                                        ? 130
                                        : col.id === 'leads'
                                          ? 90
                                          : col.id === 'roas'
                                            ? 90
                                            : 120;
                            const width = getColumnWidth(col.id, fallback);
                            const alignRight =
                              ['cost', 'revenue', 'leads', 'roas', 'cpl'].includes(
                                col.id,
                              );
                            return (
                              <td
                                key={col.id}
                                className={`py-1.5 px-3 text-slate-300 ${
                                  alignRight ? 'text-right' : 'text-left'
                                }`}
                                style={{ width, minWidth: width }}
                              >
                                {renderCell(c, col.id)}
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
          </>
        )}
      </div>
    </MainLayout>
  );
};
