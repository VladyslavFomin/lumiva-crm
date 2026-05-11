import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchMarketingTrafficByCountry,
  fetchMarketingTrafficDaily,
  type MarketingTrafficCountryRow,
  type MarketingTrafficDailyPoint,
  type MarketingTrafficStats,
} from '../../api/marketing';
import {
  formatMarketingChannelDimension,
  sanitizeMarketingDimension,
} from '../../utils/marketingChannelDisplay';
import { MarketingTrafficWorldMap } from './MarketingTrafficWorldMap';
import {
  aggregateTrafficByInferredCountry,
  type CountryTrafficAgg,
} from './marketingTrafficCountryInference';
import { convertMarketingAmount, type MarketingCurrencyMode } from './marketingDisplayCurrencyStorage';
import {
  marketingCard,
  marketingSectionSub,
  marketingSectionTitle,
  marketingTd,
  marketingTh,
  marketingThNumeric,
  marketingThead,
  marketingTr,
} from './marketingPageChrome';

type Item = MarketingTrafficStats['items'][number];

const PIE_COLORS = [
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0284c7',
  '#0d9488',
  '#16a34a',
  '#64748b',
];

type SortKey = 'campaign' | 'impressions' | 'clicks' | 'sessions' | 'leads' | 'cost' | 'revenue';
type SortDir = 'asc' | 'desc';

/** Оболочка таблиц в модалке: горизонтальный скролл на мобильных (без overflow-hidden). */
const modalTableOuter =
  'min-w-0 w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]';
const modalTableInner =
  'w-max min-w-full rounded-xl border border-[#222222]/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]';
const modalTableDensity =
  '[&_th]:!px-2 [&_th]:!py-2 [&_td]:!px-2 [&_td]:!py-2 sm:[&_th]:!px-3 sm:[&_th]:!py-3 sm:[&_td]:!px-3 sm:[&_td]:!py-2.5 max-sm:[&_th]:!text-[9px] max-sm:[&_td]:!text-[10px]';

function aggregateByKey(
  rows: Item[],
  dim: 'source' | 'medium',
  emptyLabel: string,
): Array<{
  key: string;
  sessions: number;
  clicks: number;
  leads: number;
  impressions: number;
  cost: number;
  revenue: number;
  currency: string;
}> {
  const m = new Map<
    string,
    {
      sessions: number;
      clicks: number;
      leads: number;
      impressions: number;
      cost: number;
      revenue: number;
      cw: Record<string, number>;
    }
  >();
  for (const r of rows) {
    const raw = dim === 'source' ? r.source : r.medium;
    const k = (raw ?? '').trim() || emptyLabel;
    const cur = (r.currency || 'EUR').toUpperCase().slice(0, 8);
    const w = Math.abs(r.revenue || 0) + Math.abs(r.cost || 0) + 0.000_001;
    const p =
      m.get(k) ??
      { sessions: 0, clicks: 0, leads: 0, impressions: 0, cost: 0, revenue: 0, cw: {} };
    p.sessions += r.sessions || 0;
    p.clicks += r.clicks || 0;
    p.leads += r.leads || 0;
    p.impressions += r.impressions || 0;
    p.cost += r.cost || 0;
    p.revenue += r.revenue || 0;
    p.cw[cur] = (p.cw[cur] || 0) + w;
    m.set(k, p);
  }
  const out: Array<{
    key: string;
    sessions: number;
    clicks: number;
    leads: number;
    impressions: number;
    cost: number;
    revenue: number;
    currency: string;
  }> = [];
  for (const [key, p] of m) {
    let maxW = 0;
    let cur = 'EUR';
    for (const [c, w] of Object.entries(p.cw)) {
      if (w > maxW) {
        maxW = w;
        cur = c;
      }
    }
    out.push({
      key,
      sessions: p.sessions,
      clicks: p.clicks,
      leads: p.leads,
      impressions: p.impressions,
      cost: p.cost,
      revenue: p.revenue,
      currency: cur,
    });
  }
  return out.sort((a, b) => b.cost - a.cost || b.sessions - a.sessions);
}

function topNPieByCost(rows: Item[], n: number, t: TFunction, otherLabel: string) {
  const sorted = [...rows].sort((a, b) => b.cost - a.cost);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const otherCost = rest.reduce((s, r) => s + (r.cost || 0), 0);
  const otherImp = rest.reduce((s, r) => s + (r.impressions || 0), 0);
  const data: { name: string; value: number; impressions: number }[] = top.map((r) => ({
    name: formatMarketingChannelDimension(t, sanitizeMarketingDimension(r.campaign), 'campaign'),
    value: r.cost || 0,
    impressions: r.impressions || 0,
  }));
  if (otherCost > 0 || otherImp > 0) {
    data.push({ name: '__other__', value: otherCost, impressions: otherImp });
  }
  return data.map((d, i) => ({
    ...d,
    name: d.name === '__other__' ? otherLabel : d.name,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));
}

function topNPieByMetric(
  agg: Array<{ key: string; sessions: number; clicks: number; impressions: number }>,
  metric: 'sessions' | 'clicks' | 'impressions',
  n: number,
  otherLabel: string,
) {
  const sorted = [...agg].sort((a, b) => b[metric] - a[metric]);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const other = rest.reduce((s, r) => s + r[metric], 0);
  const data = top.map((r, i) => ({
    name: r.key.length > 28 ? `${r.key.slice(0, 26)}…` : r.key,
    value: r[metric],
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));
  if (other > 0) {
    data.push({
      name: otherLabel,
      value: other,
      fill: PIE_COLORS[data.length % PIE_COLORS.length],
    });
  }
  return data;
}

function PieSideLegend(props: {
  rows: { name: string; value: number; fill: string }[];
  total: number;
  formatValue: (n: number) => string;
}) {
  const { rows, total, formatValue } = props;
  if (!rows.length) {
    return (
      <div className="text-[10px] text-[#222222]/45 py-4 text-center flex-1">—</div>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5 min-w-0 w-full flex-1 text-[9px] sm:text-[10px] max-h-[200px] sm:max-h-[228px] overflow-y-auto pr-1">
      {rows.map((e, idx) => {
        const pct = total > 0 ? (e.value / total) * 100 : 0;
        return (
          <li key={`${e.name}-${idx}`} className="flex items-start gap-2">
            <span
              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/5"
              style={{ backgroundColor: e.fill }}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-[#111827] block leading-snug break-words" title={e.name}>
                {e.name}
              </span>
              <span className="text-[#64748b] tabular-nums break-all sm:break-normal">
                {formatValue(e.value)} · {pct.toFixed(1)}%
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export type MarketingChannelAnalyticsModalProps = {
  open: boolean;
  onClose: () => void;
  dataSourceKey: string;
  channelTitle: string;
  rows: Item[];
  dateFrom?: string;
  dateTo?: string;
  currencyMode: MarketingCurrencyMode;
  displayCurrency: string;
  rates: Record<string, number>;
  formatNumber: (n: number) => string;
  formatMoney: (n: number) => string;
  t: TFunction;
};

export const MarketingChannelAnalyticsModal: React.FC<MarketingChannelAnalyticsModalProps> = ({
  open,
  onClose,
  dataSourceKey,
  channelTitle,
  rows,
  dateFrom,
  dateTo,
  currencyMode,
  displayCurrency,
  rates,
  formatNumber,
  formatMoney,
  t,
}) => {
  const { i18n } = useTranslation();
  const [series, setSeries] = useState<MarketingTrafficDailyPoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [geoRows, setGeoRows] = useState<MarketingTrafficCountryRow[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const onlyUnattributed = dataSourceKey === 'unknown';

  const provCur = useMemo(() => {
    const cw: Record<string, number> = {};
    for (const r of rows) {
      const w = Math.abs(r.revenue) + Math.abs(r.cost) + 0.000_001;
      const c = (r.currency || 'EUR').toUpperCase().slice(0, 8);
      cw[c] = (cw[c] || 0) + w;
    }
    let best = 'EUR';
    let max = 0;
    for (const [c, w] of Object.entries(cw)) {
      if (w > max) {
        max = w;
        best = c;
      }
    }
    return best;
  }, [rows]);

  const fmtMoneyCell = useCallback(
    (amount: number, fromCur?: string | null) => {
      const cur = (fromCur && String(fromCur).trim()) || 'EUR';
      const c = convertMarketingAmount(amount, cur, currencyMode, displayCurrency, rates);
      if (c.missingRate && currencyMode === 'converted') {
        return `${formatMoney(c.value)} ${c.currency}*`;
      }
      return `${formatMoney(c.value)} ${c.currency}`;
    },
    [currencyMode, displayCurrency, rates, formatMoney],
  );

  const aggTotals = useMemo(() => {
    let sessions = 0;
    let clicks = 0;
    let leads = 0;
    let revenue = 0;
    let cost = 0;
    let impressions = 0;
    for (const r of rows) {
      sessions += r.sessions || 0;
      clicks += r.clicks || 0;
      leads += r.leads || 0;
      revenue += r.revenue || 0;
      cost += r.cost || 0;
      impressions += r.impressions || 0;
    }
    const ctr =
      impressions > 0 && clicks !== impressions ? (clicks / impressions) * 100 : null;
    const costC = convertMarketingAmount(cost, provCur, currencyMode, displayCurrency, rates);
    const revC = convertMarketingAmount(revenue, provCur, currencyMode, displayCurrency, rates);
    const cpc = clicks > 0 && costC.value > 0 ? costC.value / clicks : null;
    const roas = costC.value > 0 && revC.value > 0 ? revC.value / costC.value : null;
    return {
      sessions,
      clicks,
      leads,
      revenue,
      cost,
      impressions,
      ctr,
      cpc,
      roas,
      costC,
      revC,
    };
  }, [rows, provCur, currencyMode, displayCurrency, rates]);

  const bySource = useMemo(
    () =>
      aggregateByKey(
        rows,
        'source',
        t('crm.marketingChannelAnalytics.dimEmpty', { defaultValue: '(не задано)' }),
      ),
    [rows, t],
  );

  const byMedium = useMemo(
    () =>
      aggregateByKey(
        rows,
        'medium',
        t('crm.marketingChannelAnalytics.dimEmpty', { defaultValue: '(не задано)' }),
      ),
    [rows, t],
  );

  const pieCostByCampaign = useMemo(
    () =>
      topNPieByCost(
        rows,
        7,
        t,
        t('crm.marketingChannelAnalytics.other', { defaultValue: 'Прочие' }),
      ),
    [rows, t],
  );
  const pieSessionsBySource = useMemo(
    () =>
      topNPieByMetric(
        bySource.map((r) => ({
          key: r.key,
          sessions: r.sessions,
          clicks: r.clicks,
          impressions: r.impressions,
        })),
        'sessions',
        6,
        t('crm.marketingChannelAnalytics.other', { defaultValue: 'Прочие' }),
      ),
    [bySource, t],
  );

  const pieImpressionsByMedium = useMemo(
    () =>
      topNPieByMetric(
        byMedium.map((r) => ({
          key: r.key,
          sessions: r.sessions,
          clicks: r.clicks,
          impressions: r.impressions,
        })),
        'impressions',
        6,
        t('crm.marketingChannelAnalytics.other', { defaultValue: 'Прочие' }),
      ),
    [byMedium, t],
  );

  const pieCostTotal = useMemo(
    () => pieCostByCampaign.reduce((s, x) => s + x.value, 0),
    [pieCostByCampaign],
  );
  const pieSessionsTotal = useMemo(
    () => pieSessionsBySource.reduce((s, x) => s + x.value, 0),
    [pieSessionsBySource],
  );
  const pieImprTotal = useMemo(
    () => pieImpressionsByMedium.reduce((s, x) => s + x.value, 0),
    [pieImpressionsByMedium],
  );

  const trafficByCountryInferred = useMemo(
    () => aggregateTrafficByInferredCountry(rows).byCountry,
    [rows],
  );

  const trafficByCountryFromApi = useMemo(() => {
    const m = new Map<string, CountryTrafficAgg>();
    for (const r of geoRows) {
      const iso = (r.country ?? '').trim().toUpperCase();
      if (!iso || iso.length !== 2 || !/^[A-Z]{2}$/.test(iso)) continue;
      const cur = m.get(iso) ?? { iso2: iso, sessions: 0, impressions: 0, clicks: 0 };
      cur.sessions += r.sessions || 0;
      cur.impressions += r.impressions || 0;
      cur.clicks += r.clicks || 0;
      m.set(iso, cur);
    }
    return m;
  }, [geoRows]);

  const mapUsesApi = trafficByCountryFromApi.size > 0;
  const mapByCountry = mapUsesApi ? trafficByCountryFromApi : trafficByCountryInferred;

  const mapTitle = mapUsesApi
    ? t('crm.marketingChannelAnalytics.mapTitleGa4', {
        defaultValue: 'География (данные из Google Analytics)',
      })
    : undefined;
  const mapHint = mapUsesApi
    ? t('crm.marketingChannelAnalytics.mapHintGa4', {
        defaultValue:
          'Страна — из поля countryId при синке GA4. Интенсивность по сессиям. Это агрегаты веб-аналитики, не список отдельных людей в CRM.',
      })
    : undefined;
  const emptyMapMsg = mapUsesApi
    ? undefined
    : geoLoading
      ? undefined
      : trafficByCountryInferred.size === 0
        ? t('crm.marketingChannelAnalytics.mapEmptyNoInfer', {
            defaultValue:
              'Нет гео в БД за период и не удалось сопоставить страну по названию кампании. Для каналов GA4 выполните синхронизацию интеграции после обновления.',
          })
        : undefined;

  const regionLocale = useMemo(() => {
    const l = (i18n.language || 'ru').split('-')[0].toLowerCase();
    if (l === 'ru' || l === 'en' || l === 'tr') return l;
    return 'en';
  }, [i18n.language]);

  const regionNames = useMemo(
    () => new Intl.DisplayNames([regionLocale], { type: 'region' }),
    [regionLocale],
  );

  const countryLabel = useCallback(
    (code: string | null) => {
      if (!code || !String(code).trim()) {
        return t('crm.marketingChannelAnalytics.geoUnknownCountry', {
          defaultValue: 'Страна не определена',
        });
      }
      const u = String(code).trim().toUpperCase();
      if (u.length === 2 && /^[A-Z]{2}$/.test(u)) {
        try {
          return regionNames.of(u) || u;
        } catch {
          return u;
        }
      }
      return String(code);
    },
    [regionNames, t],
  );

  const geoTableRows = useMemo(() => {
    if (geoRows.length > 0) {
      return [...geoRows].sort((a, b) => (b.sessions || 0) - (a.sessions || 0));
    }
    return [...trafficByCountryInferred.entries()]
      .map(([iso2, a]) => ({
        country: iso2,
        sessions: a.sessions,
        clicks: a.clicks,
        impressions: a.impressions,
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [geoRows, trafficByCountryInferred]);

  const barTopCampaigns = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 12)
      .map((r) => ({
        name: formatMarketingChannelDimension(
          t,
          sanitizeMarketingDimension(r.campaign),
          'campaign',
        ).slice(0, 36),
        impressions: r.impressions || 0,
        clicks: r.clicks || 0,
      }));
  }, [rows, t]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const list = [...rows];
    list.sort((a, b) => {
      let va = 0;
      let vb = 0;
      switch (sortKey) {
        case 'campaign':
          return (
            dir *
            formatMarketingChannelDimension(t, sanitizeMarketingDimension(a.campaign), 'campaign')
              .localeCompare(
                formatMarketingChannelDimension(t, sanitizeMarketingDimension(b.campaign), 'campaign'),
              )
          );
        case 'impressions':
          va = a.impressions || 0;
          vb = b.impressions || 0;
          break;
        case 'clicks':
          va = a.clicks || 0;
          vb = b.clicks || 0;
          break;
        case 'sessions':
          va = a.sessions || 0;
          vb = b.sessions || 0;
          break;
        case 'leads':
          va = a.leads || 0;
          vb = b.leads || 0;
          break;
        case 'cost':
          va = a.cost || 0;
          vb = b.cost || 0;
          break;
        case 'revenue':
          va = a.revenue || 0;
          vb = b.revenue || 0;
          break;
        default:
          return 0;
      }
      return dir * (va - vb);
    });
    return list;
  }, [rows, sortKey, sortDir, t]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setSeriesLoading(true);
    setSeriesError(null);
    fetchMarketingTrafficDaily({
      from: dateFrom,
      to: dateTo,
      ...(onlyUnattributed ? { onlyUnattributed: true } : { dataSource: dataSourceKey }),
    })
      .then((res) => {
        if (!alive) return;
        setSeries(Array.isArray(res.series) ? res.series : []);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setSeriesError(e instanceof Error ? e.message : 'Error');
        setSeries([]);
      })
      .finally(() => {
        if (alive) setSeriesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, dateFrom, dateTo, dataSourceKey, onlyUnattributed]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setGeoLoading(true);
    setGeoError(null);
    fetchMarketingTrafficByCountry({
      from: dateFrom,
      to: dateTo,
      ...(onlyUnattributed ? { onlyUnattributed: true } : { dataSource: dataSourceKey }),
    })
      .then((res) => {
        if (!alive) return;
        setGeoRows(Array.isArray(res.rows) ? res.rows : []);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setGeoError(e instanceof Error ? e.message : 'Error');
        setGeoRows([]);
      })
      .finally(() => {
        if (alive) setGeoLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, dateFrom, dateTo, dataSourceKey, onlyUnattributed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const periodLabel =
    dateFrom && dateTo
      ? `${dateFrom} — ${dateTo}`
      : dateFrom
        ? `${dateFrom} — …`
        : dateTo
          ? `… — ${dateTo}`
          : t('crm.marketingChannelAnalytics.periodAll', { defaultValue: 'Весь доступный период' });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'campaign' ? 'asc' : 'desc');
    }
  };

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[8500] flex items-center justify-center p-2 sm:p-6 bg-[#0f172a]/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mch-analytics-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col w-full min-w-0 max-w-[min(1720px,calc(100vw-16px))] sm:max-w-[min(1720px,calc(100vw-24px))] max-h-[min(940px,96dvh)] rounded-2xl border border-[#222222]/12 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.18)] overflow-hidden">
        <div className="shrink-0 flex items-start justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 border-b border-[#222222]/10 bg-gradient-to-r from-slate-50/90 to-white">
          <div className="min-w-0">
            <div
              id="mch-analytics-title"
              className="text-[15px] sm:text-[17px] font-semibold tracking-tight text-[#111827]"
            >
              {channelTitle}
            </div>
            <div className="text-[11px] text-[#222222]/55 mt-1 font-mono truncate">{dataSourceKey}</div>
            <div className="text-[10px] text-[#222222]/45 mt-1">{periodLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-[#222222]/15 bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-[11px] font-semibold text-[#222222] hover:bg-slate-50"
          >
            {t('crm.marketingChannelAnalytics.close', { defaultValue: 'Закрыть' })}
          </button>
        </div>

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:px-5 sm:py-5 space-y-6 sm:space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
            {(
              [
                {
                  k: 'impressions',
                  label: t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' }),
                  v: formatNumber(aggTotals.impressions),
                },
                {
                  k: 'clicks',
                  label: t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' }),
                  v: formatNumber(aggTotals.clicks),
                  color: 'text-violet-700',
                },
                {
                  k: 'sessions',
                  label: t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' }),
                  v: formatNumber(aggTotals.sessions),
                },
                {
                  k: 'leads',
                  label: t('crm.marketingChannels.kpi.leads'),
                  v: formatNumber(aggTotals.leads),
                  color: 'text-amber-800',
                },
                {
                  k: 'ctr',
                  label: 'CTR',
                  v: aggTotals.ctr != null ? `${aggTotals.ctr.toFixed(2)}%` : '—',
                },
                {
                  k: 'cpc',
                  label: 'CPC',
                  v:
                    aggTotals.cpc != null && aggTotals.cpc > 0
                      ? `${formatMoney(aggTotals.cpc)} ${aggTotals.costC.currency}`
                      : '—',
                },
              ] as const
            ).map((cell) => (
              <div
                key={cell.k}
                className="rounded-xl border border-[#222222]/10 bg-white px-2 py-1.5 sm:px-3 sm:py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] min-w-0"
              >
                <div className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-[#222222]/45 leading-tight">
                  {cell.label}
                </div>
                <div
                  className={`text-[12px] sm:text-[14px] font-semibold tabular-nums mt-0.5 break-all sm:break-normal ${'color' in cell && cell.color ? cell.color : 'text-[#111827]'}`}
                >
                  {cell.v}
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-[#222222]/10 bg-white px-2 py-1.5 sm:px-3 sm:py-2 col-span-2 sm:col-span-1 lg:col-span-2 min-w-0">
              <div className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-[#222222]/45 leading-tight">
                {t('crm.marketingCampaigns.table.headers.cost')}
              </div>
              <div className="text-[12px] sm:text-[14px] font-semibold tabular-nums mt-0.5 break-all sm:break-normal">
                {fmtMoneyCell(aggTotals.cost, provCur)}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/40 px-2 py-1.5 sm:px-3 sm:py-2 col-span-2 sm:col-span-1 lg:col-span-2 min-w-0">
              <div className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-[#222222]/45 leading-tight">
                {t('crm.marketingCampaigns.table.headers.revenue')}
              </div>
              <div className="text-[12px] sm:text-[14px] font-semibold tabular-nums text-emerald-800 mt-0.5 break-all sm:break-normal">
                {fmtMoneyCell(aggTotals.revenue, provCur)}
              </div>
            </div>
            <div className="rounded-xl border border-[#222222]/10 bg-white px-2 py-1.5 sm:px-3 sm:py-2 min-w-0">
              <div className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-[#222222]/45 leading-tight">
                ROAS
              </div>
              <div className="text-[12px] sm:text-[14px] font-semibold tabular-nums text-emerald-800 mt-0.5">
                {aggTotals.roas != null && aggTotals.roas > 0 ? aggTotals.roas.toFixed(2) : '—'}
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#222222]/45">
              {t('crm.marketingChannelAnalytics.sectionTrend', { defaultValue: 'Динамика по дням' })}
            </h3>
            {seriesLoading && (
              <div className="text-[12px] text-[#222222]/50 py-8 text-center rounded-xl border border-dashed border-[#222222]/15">
                {t('crm.marketingChannelAnalytics.loadingSeries', { defaultValue: 'Загрузка ряда…' })}
              </div>
            )}
            {!seriesLoading && seriesError && (
              <div className="text-[12px] text-amber-800 py-3 px-3 rounded-xl bg-amber-50 border border-amber-200/80">
                {seriesError}
              </div>
            )}
            {!seriesLoading && !seriesError && series.length === 0 && (
              <div className="text-[12px] text-[#222222]/50 py-6 text-center rounded-xl border border-[#222222]/10">
                {t('crm.marketingChannelAnalytics.emptySeries', {
                  defaultValue: 'Нет дневных данных за выбранный фильтр.',
                })}
              </div>
            )}
            {!seriesLoading && series.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
                <div className={`${marketingCard} p-3 min-h-[260px] min-w-0`}>
                  <div className="text-[11px] font-semibold text-[#222222]/70 mb-2">
                    {t('crm.marketingChannelAnalytics.chartSessionsClicks', {
                      defaultValue: 'Сессии и клики',
                    })}
                  </div>
                  <div className="h-[220px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickMargin={6} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            fontSize: 11,
                            border: '1px solid rgba(34,34,34,0.1)',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey="sessions"
                          name={t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' })}
                          stroke="#0f172a"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="clicks"
                          name={t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' })}
                          stroke="#7c3aed"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className={`${marketingCard} p-3 min-h-[260px] min-w-0`}>
                  <div className="text-[11px] font-semibold text-[#222222]/70 mb-2">
                    {t('crm.marketingChannelAnalytics.chartCostRevenue', {
                      defaultValue: 'Расход и выручка (сырые суммы по дням)',
                    })}
                  </div>
                  <div className="h-[220px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickMargin={6} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            fontSize: 11,
                            border: '1px solid rgba(34,34,34,0.1)',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey="cost"
                          name={t('crm.marketingCampaigns.table.headers.cost')}
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name={t('crm.marketingCampaigns.table.headers.revenue')}
                          stroke="#16a34a"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className={`${marketingCard} p-3 min-h-[260px] min-w-0 lg:col-span-2`}>
                  <div className="text-[11px] font-semibold text-[#222222]/70 mb-2">
                    {t('crm.marketingChannelAnalytics.chartImpressions', { defaultValue: 'Показы' })}
                  </div>
                  <div className="h-[200px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickMargin={6} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            fontSize: 11,
                            border: '1px solid rgba(34,34,34,0.1)',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="impressions"
                          name={t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })}
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#222222]/45">
              {t('crm.marketingChannelAnalytics.sectionBreakdown', { defaultValue: 'Структура расходов и трафика' })}
            </h3>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
              <div className={`${marketingCard} p-3 min-h-0 min-w-0 sm:min-h-[280px]`}>
                <div className="text-[11px] font-semibold text-[#222222]/70 mb-2">
                  {t('crm.marketingChannelAnalytics.pieCostCampaign', {
                    defaultValue: 'Расход по кампаниям',
                  })}
                </div>
                <div className="flex flex-col items-stretch gap-3 min-h-0 sm:flex-row sm:items-stretch sm:min-h-[240px]">
                  <div className="h-[200px] w-[200px] max-w-full mx-auto shrink-0 sm:mx-0 sm:h-[228px] sm:w-[min(44%,210px)] sm:min-w-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                          data={pieCostByCampaign}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={72}
                          paddingAngle={2}
                        >
                          {pieCostByCampaign.map((e, i) => (
                            <Cell key={i} fill={e.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => fmtMoneyCell(v, provCur)}
                          contentStyle={{ fontSize: 11, borderRadius: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <PieSideLegend
                    rows={pieCostByCampaign}
                    total={pieCostTotal}
                    formatValue={(n) => fmtMoneyCell(n, provCur)}
                  />
                </div>
              </div>
              <div className={`${marketingCard} p-3 min-h-0 min-w-0 sm:min-h-[280px]`}>
                <div className="text-[11px] font-semibold text-[#222222]/70 mb-2">
                  {t('crm.marketingChannelAnalytics.pieSessionsSource', {
                    defaultValue: 'Сессии по source',
                  })}
                </div>
                <div className="flex flex-col items-stretch gap-3 min-h-0 sm:flex-row sm:items-stretch sm:min-h-[240px]">
                  <div className="h-[200px] w-[200px] max-w-full mx-auto shrink-0 sm:mx-0 sm:h-[228px] sm:w-[min(44%,210px)] sm:min-w-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                          data={pieSessionsBySource}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={72}
                          paddingAngle={2}
                        >
                          {pieSessionsBySource.map((e, i) => (
                            <Cell key={i} fill={e.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => formatNumber(v)}
                          contentStyle={{ fontSize: 11, borderRadius: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <PieSideLegend
                    rows={pieSessionsBySource}
                    total={pieSessionsTotal}
                    formatValue={(n) => formatNumber(n)}
                  />
                </div>
              </div>
              <div className={`${marketingCard} p-3 min-h-0 min-w-0 sm:min-h-[280px]`}>
                <div className="text-[11px] font-semibold text-[#222222]/70 mb-2">
                  {t('crm.marketingChannelAnalytics.pieImprMedium', {
                    defaultValue: 'Показы по medium',
                  })}
                </div>
                <div className="flex flex-col items-stretch gap-3 min-h-0 sm:flex-row sm:items-stretch sm:min-h-[240px]">
                  <div className="h-[200px] w-[200px] max-w-full mx-auto shrink-0 sm:mx-0 sm:h-[228px] sm:w-[min(44%,210px)] sm:min-w-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                          data={pieImpressionsByMedium}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={72}
                          paddingAngle={2}
                        >
                          {pieImpressionsByMedium.map((e, i) => (
                            <Cell key={i} fill={e.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => formatNumber(v)}
                          contentStyle={{ fontSize: 11, borderRadius: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <PieSideLegend
                    rows={pieImpressionsByMedium}
                    total={pieImprTotal}
                    formatValue={(n) => formatNumber(n)}
                  />
                </div>
              </div>
            </div>
            <div className={`${marketingCard} p-3 min-h-[260px] min-w-0 mt-4`}>
              <div className="text-[11px] font-semibold text-[#222222]/70 mb-2">
                {t('crm.marketingChannelAnalytics.barTopImpressions', {
                  defaultValue: 'Топ кампаний по показам',
                })}
              </div>
              <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barTopCampaigns}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={72}
                      tick={{ fontSize: 7, fill: '#64748b' }}
                      tickFormatter={(v: string) =>
                        v.length > 14 ? `${v.slice(0, 12)}…` : v
                      }
                    />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                    <Bar dataKey="impressions" fill="#6366f1" radius={[0, 6, 6, 0]} name="Показы" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#222222]/45">
              {t('crm.marketingChannelAnalytics.sectionGeo', { defaultValue: 'География' })}
            </h3>
            <MarketingTrafficWorldMap
              byCountry={mapByCountry}
              formatNumber={formatNumber}
              t={t}
              mapTitle={mapTitle}
              mapHint={mapHint}
              emptyMessage={emptyMapMsg}
              loading={geoLoading}
            />
            {geoError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                {geoError}
              </div>
            )}
            {!geoLoading && geoTableRows.length > 0 && (
              <>
                <div className={marketingSectionTitle}>
                  {t('crm.marketingChannelAnalytics.geoTableTitle', {
                    defaultValue: 'Сессии и просмотры по странам',
                  })}
                </div>
                <p className={marketingSectionSub}>
                  {t('crm.marketingChannelAnalytics.geoTableHint', {
                    defaultValue:
                      'Как в отчёте Geo в Google Analytics: сессии и просмотры по стране. Отдельных пользователей CRM здесь нет — только агрегаты веб-аналитики.',
                  })}
                </p>
                <div className={`${modalTableOuter} ${modalTableDensity}`}>
                  <div className={`${modalTableInner} max-h-[min(340px,45vh)] overflow-y-auto`}>
                    <table className="w-full min-w-[420px] text-left text-[10px] sm:text-[11px] border-separate border-spacing-0">
                      <thead className={`${marketingThead} sticky top-0 z-[1]`}>
                        <tr>
                          <th className={marketingTh}>
                            {t('crm.marketingChannelAnalytics.geoColCountry', { defaultValue: 'Страна' })}
                          </th>
                          <th className={`${marketingThNumeric} whitespace-nowrap`}>
                            {t('crm.marketingTraffic.table.sessions')}
                          </th>
                          <th className={`${marketingThNumeric} whitespace-nowrap`}>
                            {t('crm.marketingTraffic.table.clicks')}
                          </th>
                          <th className={`${marketingThNumeric} whitespace-nowrap`}>
                            {t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {geoTableRows.map((r, idx) => (
                          <tr key={`${r.country ?? 'none'}-${idx}`} className={marketingTr}>
                            <td className={`${marketingTd} font-medium max-w-[140px] sm:max-w-none truncate`} title={countryLabel(r.country)}>
                              {countryLabel(r.country)}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {formatNumber(r.sessions || 0)}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {formatNumber(r.clicks || 0)}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {formatNumber(r.impressions || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
            <div className="space-y-2">
              <div className={marketingSectionTitle}>
                {t('crm.marketingChannels.topSources')}
              </div>
              <div className={`${modalTableOuter} ${modalTableDensity}`}>
                <div className={`${modalTableInner} max-h-[240px] overflow-y-auto`}>
                  <table className="w-full min-w-[480px] text-left text-[10px] sm:text-[11px]">
                    <thead className={marketingThead}>
                      <tr>
                        <th className={marketingTh}>Source</th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingTraffic.table.sessions')}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingTraffic.table.clicks')}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingCampaigns.table.headers.cost')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySource.map((r) => (
                        <tr key={r.key} className={marketingTr}>
                          <td className={`${marketingTd} max-w-[120px] sm:max-w-[180px] truncate`} title={r.key}>
                            {r.key}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                            {formatNumber(r.sessions)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                            {formatNumber(r.clicks)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                            {fmtMoneyCell(r.cost, r.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className={marketingSectionTitle}>
                {t('crm.marketingChannels.topMediums')}
              </div>
              <div className={`${modalTableOuter} ${modalTableDensity}`}>
                <div className={`${modalTableInner} max-h-[240px] overflow-y-auto`}>
                  <table className="w-full min-w-[480px] text-left text-[10px] sm:text-[11px]">
                    <thead className={marketingThead}>
                      <tr>
                        <th className={marketingTh}>Medium</th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingTraffic.table.sessions')}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingTraffic.table.clicks')}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingCampaigns.table.headers.cost')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {byMedium.map((r) => (
                        <tr key={r.key} className={marketingTr}>
                          <td className={`${marketingTd} max-w-[120px] sm:max-w-[180px] truncate`} title={r.key}>
                            {r.key}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                            {formatNumber(r.sessions)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                            {formatNumber(r.clicks)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                            {fmtMoneyCell(r.cost, r.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <div className={marketingSectionTitle}>
              {t('crm.marketingChannelAnalytics.fullTable', { defaultValue: 'Все кампании в выборке' })}
            </div>
            <p className={marketingSectionSub}>
              {t('crm.marketingChannelAnalytics.fullTableHint', {
                defaultValue: 'Сортировка по столбцам. Данные соответствуют агрегату за период на странице трафика.',
              })}
            </p>
            <div className={`${modalTableOuter} ${modalTableDensity}`}>
              <div className={`${modalTableInner} max-h-[min(420px,50vh)] overflow-y-auto`}>
                <table className="w-full min-w-[640px] sm:min-w-[720px] text-left text-[10px] sm:text-[11px] border-separate border-spacing-0">
                  <thead className={`${marketingThead} sticky top-0 z-[1]`}>
                    <tr>
                      <th className={`${marketingTh} min-w-[100px] max-w-[160px] sm:max-w-[220px]`}>
                        <button
                          type="button"
                          onClick={() => toggleSort('campaign')}
                          className="font-semibold text-left w-full min-w-0 hover:text-[#111827] inline-flex items-center gap-0.5 whitespace-normal leading-tight"
                        >
                          <span className="break-words">
                            {t('crm.marketingCampaigns.table.headers.campaign')}
                            {sortKey === 'campaign' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </span>
                        </button>
                      </th>
                      {(
                        [
                          ['impressions', t('crm.marketingChannelBlocks.thImpressions', { defaultValue: 'Показы' })],
                          ['clicks', t('crm.marketingChannelBlocks.thClicks', { defaultValue: 'Клики' })],
                          ['sessions', t('crm.marketingChannelBlocks.thSessions', { defaultValue: 'Сессии' })],
                          ['leads', t('crm.marketingChannelBlocks.thLeads', { defaultValue: 'Лиды' })],
                          ['cost', t('crm.marketingChannelBlocks.thCost', { defaultValue: 'Расход' })],
                          ['revenue', t('crm.marketingChannelBlocks.thRevenue', { defaultValue: 'Выручка' })],
                        ] as const
                      ).map(([k, label]) => (
                        <th key={k} className={`${marketingThNumeric} whitespace-nowrap`}>
                          <button
                            type="button"
                            onClick={() => toggleSort(k)}
                            className="font-semibold w-full min-w-0 hover:text-[#111827] inline-flex items-center justify-end gap-0.5 whitespace-nowrap"
                          >
                            {label}
                            {sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, idx) => {
                      const campLabel = formatMarketingChannelDimension(
                        t,
                        sanitizeMarketingDimension(row.campaign),
                        'campaign',
                      );
                      return (
                        <tr
                          key={`${row.campaign}-${row.source}-${row.medium}-${idx}`}
                          className={marketingTr}
                        >
                          <td
                            className={`${marketingTd} max-w-[100px] sm:max-w-[220px] font-medium align-top`}
                            title={campLabel}
                          >
                            <span className="line-clamp-2 sm:line-clamp-none sm:truncate block">
                              {campLabel}
                            </span>
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap align-top`}>
                            {formatNumber(row.impressions || 0)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap align-top`}>
                            {formatNumber(row.clicks || 0)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap align-top`}>
                            {formatNumber(row.sessions || 0)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap align-top`}>
                            {formatNumber(row.leads || 0)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums font-medium whitespace-nowrap align-top`}>
                            {fmtMoneyCell(row.cost || 0, row.currency)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums text-emerald-800/90 whitespace-nowrap align-top`}>
                            {fmtMoneyCell(row.revenue || 0, row.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section
            className={`${marketingCard} border-dashed border-amber-200/90 bg-amber-50/35 p-4 space-y-2`}
          >
            <div className="text-[12px] font-semibold text-amber-950">
              {t('crm.marketingChannelAnalytics.roadmapTitle', {
                defaultValue: 'Страницы и воронка (в разработке)',
              })}
            </div>
            <p className="text-[11px] text-amber-950/85 leading-relaxed">
              {t('crm.marketingChannelAnalytics.roadmapBody', {
                defaultValue:
                  'Гео по сессиям для каналов GA4 подтягивается при синке (countryId). Отчёты по URL страниц, городам и шагам воронки — в планах после расширения схемы и импорта.',
              })}
            </p>
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
