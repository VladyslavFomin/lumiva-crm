// src/pages/marketing/TrafficPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingTraffic,
  type MarketingTrafficStats,
  type MarketingTrafficRow,
} from '../../api/marketing';
import { getLocale } from '../../i18n/utils';

type PeriodPreset = '7d' | '30d' | '90d' | 'all';

interface DateRange {
  from?: string;
  to?: string;
}

interface ChannelAgg {
  key: string;                // google / cpc
  source: string | null;      // google
  medium: string | null;      // cpc / organic / direct

  sessions: number;
  conversions: number;        // leads
  revenue: number;
  currency: string;

  cr: number;                 // conversions / sessions
  revPerSession: number;      // revenue / sessions
}

export const TrafficPage: React.FC = () => {
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
  const formatNumber = (v: number) =>
    v.toLocaleString(locale, { maximumFractionDigits: 0 });
  const periodLabel: Record<PeriodPreset, string> = {
    '7d': t('crm.marketingTraffic.periods.7d'),
    '30d': t('crm.marketingTraffic.periods.30d'),
    '90d': t('crm.marketingTraffic.periods.90d'),
    all: t('crm.marketingTraffic.periods.all'),
  };

  const baseColumns = useMemo(
    () => [
      { id: 'source', label: t('crm.marketingTraffic.table.headers.source') },
      { id: 'type', label: t('crm.marketingTraffic.table.headers.type') },
      { id: 'sessions', label: t('crm.marketingTraffic.table.headers.sessions') },
      { id: 'conversions', label: t('crm.marketingTraffic.table.headers.conversions') },
      { id: 'cr', label: t('crm.marketingTraffic.table.headers.cr') },
      { id: 'revenue', label: t('crm.marketingTraffic.table.headers.revenue') },
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

  // Пересчёт диапазона по пресетам
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

    const start = new Date(end);
    if (p === '7d') {
      start.setUTCDate(end.getUTCDate() - 6);
    } else if (p === '30d') {
      start.setUTCDate(end.getUTCDate() - 29);
    } else if (p === '90d') {
      start.setUTCDate(end.getUTCDate() - 89);
    }

    setRange({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
  };

  // первый рендер — "Все время"
  useEffect(() => {
    applyPreset('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('marketing_traffic_columns');
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
        'marketing_traffic_columns',
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

  // загрузка данных
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
        setError(e.message || t('crm.marketingTraffic.errors.load'));
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const currency = stats?.currency || 'EUR';

  // Агрегация по источнику/medium
  const channels: ChannelAgg[] = useMemo(() => {
    if (!stats) return [];

    const map = new Map<string, ChannelAgg>();

    (stats.items || []).forEach((row: MarketingTrafficRow) => {
      const r: any = row; // utm-поля храним как any, чтобы не ругался TS

      const source = (r.source as string | undefined) ?? '(unknown)';
      const medium = (r.medium as string | undefined) ?? '(none)';
      const key = `${source} / ${medium}`;

      const current = map.get(key) || {
        key,
        source,
        medium,
        sessions: 0,
        conversions: 0,
        revenue: 0,
        currency: row.currency || currency,
        cr: 0,
        revPerSession: 0,
      };

      const sessions = (r.sessions as number | undefined) || 0;
      const leads = row.leads || 0;

      current.sessions += sessions;
      current.conversions += leads;
      current.revenue += row.revenue || 0;

      map.set(key, current);
    });

    const list = Array.from(map.values());

    list.forEach((ch) => {
      ch.cr = ch.sessions > 0 ? ch.conversions / ch.sessions : 0;
      ch.revPerSession =
        ch.sessions > 0 ? ch.revenue / ch.sessions : 0;
    });

    // сортировка по сессиям
    list.sort((a, b) => b.sessions - a.sessions);

    return list;
  }, [stats, currency]);

  // Глобальные KPI
  const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);
  const totalConversions = channels.reduce(
    (s, c) => s + c.conversions,
    0,
  );
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);

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

  const renderCell = (ch: ChannelAgg, columnId: string) => {
    const type = (() => {
      const m = (ch.medium || '').toLowerCase();
      if (m === 'cpc' || m === 'paid') return t('crm.marketingTraffic.types.paid');
      if (m === 'organic') return t('crm.marketingTraffic.types.organic');
      if (m === 'email') return t('crm.marketingTraffic.types.email');
      if (m === 'social' || m === 'paid_social')
        return t('crm.marketingTraffic.types.social');
      if (m === '(none)' || m === 'direct')
        return t('crm.marketingTraffic.types.direct');
      return m || t('crm.marketingTraffic.types.other');
    })();

    switch (columnId) {
      case 'source':
        return <span className="text-slate-100">{ch.key}</span>;
      case 'type':
        return <span className="text-slate-300">{type}</span>;
      case 'sessions':
        return formatNumber(ch.sessions);
      case 'conversions':
        return formatNumber(ch.conversions);
      case 'cr':
        return ch.sessions > 0
          ? `${(ch.cr * 100).toFixed(1)}%`
          : t('crm.marketingTraffic.common.empty');
      case 'revenue':
        return ch.revenue
          ? `${formatNumber(ch.revenue)} ${ch.currency}`
          : t('crm.marketingTraffic.common.empty');
      default:
        return null;
    }
  };

  const globalCr =
    totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
  const revPerSession =
    totalSessions > 0 ? totalRevenue / totalSessions : 0;

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + пресеты */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingTraffic.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingTraffic.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingTraffic.subtitle')}
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] text-slate-600 pl-1">
                {t('crm.marketingTraffic.periodLabel')}
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
            {t('crm.marketingTraffic.loading')}
          </div>
        )}

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* KPI плашки */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
              <div className="rounded-3xl bg-white border border-slate-200 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-slate-500 mb-1">
                  {t('crm.marketingTraffic.kpi.sessions')}
                </div>
                <div className="text-2xl font-semibold text-slate-900">
                  {formatNumber(totalSessions)}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  {t('crm.marketingTraffic.kpi.sessionsHint')}
                </div>
              </div>

              <div className="rounded-3xl bg-emerald-50 border border-emerald-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-emerald-600 mb-1">
                  {t('crm.marketingTraffic.kpi.conversions')}
                </div>
                <div className="text-2xl font-semibold text-emerald-700">
                  {formatNumber(totalConversions)}
                </div>
                <div className="text-[11px] text-emerald-700/70 mt-2">
                  {t('crm.marketingTraffic.kpi.conversionsHint')}
                </div>
              </div>

              <div className="rounded-3xl bg-sky-50 border border-sky-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-sky-600 mb-1">
                  {t('crm.marketingTraffic.kpi.cr')}
                </div>
                <div className="text-2xl font-semibold text-sky-700">
                  {totalSessions > 0
                    ? `${globalCr.toFixed(1)}%`
                    : t('crm.marketingTraffic.common.empty')}
                </div>
                <div className="text-[11px] text-sky-700/70 mt-2">
                  {t('crm.marketingTraffic.kpi.crHint')}
                </div>
              </div>

              <div className="rounded-3xl bg-rose-50 border border-rose-100 px-4 py-4 flex flex-col justify-between shadow-sm">
                <div className="text-[11px] text-rose-600 mb-1">
                  {t('crm.marketingTraffic.kpi.revPerSession')}
                </div>
                <div className="text-2xl font-semibold text-rose-700">
                  {totalSessions > 0
                    ? `${revPerSession.toFixed(2)} ${currency}`
                    : t('crm.marketingTraffic.common.empty')}
                </div>
                <div className="text-[11px] text-rose-700/70 mt-2">
                  {t('crm.marketingTraffic.kpi.revPerSessionHint')}
                </div>
              </div>
            </section>

            {/* Таблица каналов */}
            <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 md:px-5 md:py-5 text-xs shadow-sm">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {t('crm.marketingTraffic.table.title')}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {t('crm.marketingTraffic.table.subtitle')}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-[11px] table-fixed">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-slate-400">
                      {orderedColumns.map((col) => {
                        const fallback =
                          col.id === 'source'
                            ? 180
                            : col.id === 'type'
                              ? 140
                              : col.id === 'sessions'
                                ? 120
                                : col.id === 'conversions'
                                  ? 130
                                  : col.id === 'cr'
                                    ? 100
                                    : 140;
                        const width = columnWidths[col.id] ?? fallback;
                        const alignRight = !['source', 'type'].includes(col.id);
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
                    {channels.length === 0 && (
                      <tr>
                        <td
                          colSpan={orderedColumns.length}
                          className="py-3 text-center text-slate-500"
                        >
                          {t('crm.marketingTraffic.table.empty')}
                        </td>
                      </tr>
                    )}

                    {channels.map((ch) => (
                      <tr
                        key={ch.key}
                        className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/50 transition-colors"
                      >
                        {orderedColumns.map((col) => {
                          const fallback =
                            col.id === 'source'
                              ? 180
                              : col.id === 'type'
                                ? 140
                                : col.id === 'sessions'
                                  ? 120
                                  : col.id === 'conversions'
                                    ? 130
                                    : col.id === 'cr'
                                      ? 100
                                      : 140;
                          const width = columnWidths[col.id] ?? fallback;
                          const alignRight = !['source', 'type'].includes(col.id);
                          return (
                            <td
                              key={col.id}
                              className={`py-1.5 px-3 ${
                                alignRight ? 'text-right' : 'text-left'
                              }`}
                              style={{ width, minWidth: width }}
                            >
                              {renderCell(ch, col.id)}
                            </td>
                          );
                        })}
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
