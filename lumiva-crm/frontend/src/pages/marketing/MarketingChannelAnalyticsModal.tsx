import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { DateRangePicker, fromIsoDate, lastDays, toIsoDate, type DateRangePreset } from '../../components/ui/DateRangePicker';
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
  fetchMarketingFxRates,
  fetchMarketingTraffic,
  fetchMarketingTrafficByCountry,
  fetchMarketingTrafficDaily,
  type MarketingTrafficCountryRow,
  type MarketingTrafficCountryDetail,
  type MarketingTrafficDailyPoint,
  type MarketingTrafficStats,
} from '../../api/marketing';
import {
  formatMarketingChannelDimension,
  sanitizeMarketingDimension,
} from '../../utils/marketingChannelDisplay';
import { MarketingTrafficWorldMap } from './MarketingTrafficWorldMap';
import { marketingProviderFamilyLabel } from '../../utils/marketingDataSourceLabel';
import {
  aggregateTrafficByInferredCountry,
  type CountryTrafficAgg,
} from './marketingTrafficCountryInference';
import {
  convertMarketingAmount,
  MARKETING_ALLOWED_CURRENCIES,
  type MarketingCurrencyMode,
} from './marketingDisplayCurrencyStorage';
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
import { marketingChannelCardTheme } from './marketingChannelCardTheme';

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

/** Доля расхода: полоска + процент (таблицы «По кабинетам» и стран). */
function ShareCell({ share, muted }: { share: number; muted?: boolean }) {
  const w = Math.max(0, Math.min(100, share));
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 rounded-full bg-[#222222]/8 overflow-hidden">
        <div
          className={`h-full rounded-full ${muted ? 'bg-[#0866FF]/45' : 'bg-[#0866FF]'}`}
          style={{ width: `${w.toFixed(1)}%` }}
        />
      </div>
      <span className={`tabular-nums w-12 text-right ${muted ? 'text-[#222222]/60' : ''}`}>{share.toFixed(1)}%</span>
    </div>
  );
}

/** Поиск без учёта турецких букв (как на сервере): İ/ı→i, ş→s, ç→c, ğ→g, ö→o, ü→u. */
function foldTr(v: string): string {
  return v
    .toLocaleLowerCase('tr')
    .replace(/\u0307/g, '')
    .replace(/[ışçğöüâîû]/g, (ch) => 'iscgouaiu'['ışçğöüâîû'.indexOf(ch)]);
}

type SortKey = 'campaign' | 'account' | 'impressions' | 'clicks' | 'sessions' | 'leads' | 'cost' | 'revenue';
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
  /** Кабинет Meta Ads, выбранный при открытии ('' / undefined — все). Внутри окна его можно сменить. */
  integrationId?: string;
  /** Сообщить карточке о смене кабинета внутри окна, чтобы выбор совпадал. */
  onIntegrationChange?: (integrationId: string) => void;
  /** integrationId → название подключения: таблица «По кабинетам» и колонка «Кабинет». */
  integrationLabels?: Record<string, string>;
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
  integrationId,
  onIntegrationChange,
  integrationLabels: integrationLabelsProp,
  channelTitle,
  rows: rowsProp,
  dateFrom: dateFromProp,
  dateTo: dateToProp,
  currencyMode: currencyModeProp,
  displayCurrency: displayCurrencyProp,
  rates: ratesProp,
  formatNumber,
  formatMoney,
  t,
}) => {
  const { i18n } = useTranslation();

  /** Период окна: по умолчанию — период страницы; при смене данные канала подгружаются заново. */
  const [dateFrom, setDateFrom] = useState<string | undefined>(dateFromProp);
  const [dateTo, setDateTo] = useState<string | undefined>(dateToProp);
  useEffect(() => {
    setDateFrom(dateFromProp);
    setDateTo(dateToProp);
  }, [dateFromProp, dateToProp]);
  const rangeChanged = (dateFrom || '') !== (dateFromProp || '') || (dateTo || '') !== (dateToProp || '');
  const [rangeData, setRangeData] = useState<null | { rows: Item[]; labels?: Record<string, string> }>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  useEffect(() => {
    if (!open || !rangeChanged) {
      setRangeData(null);
      return;
    }
    let alive = true;
    setRangeLoading(true);
    const unattributed = dataSourceKey === 'unknown';
    fetchMarketingTraffic({
      from: dateFrom,
      to: dateTo,
      ...(unattributed ? {} : { dataSource: dataSourceKey }),
      itemsLimit: 20_000,
    })
      .then((st) => {
        if (!alive) return;
        const items = unattributed
          ? st.items.filter((it) => !(it.dataSource ?? '').trim())
          : st.items.filter((it) => (it.dataSource ?? '') === dataSourceKey);
        setRangeData({ rows: items, labels: st.integrationLabels });
      })
      .catch(() => {
        if (alive) setRangeData({ rows: [] });
      })
      .finally(() => {
        if (alive) setRangeLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, rangeChanged, dateFrom, dateTo, dataSourceKey]);
  const allRows = rangeChanged ? (rangeData?.rows ?? []) : rowsProp;
  const integrationLabels = rangeData?.labels ?? integrationLabelsProp;

  const setPreset = (preset: string) => {
    const today = new Date();
    const ymd = toIsoDate;
    const daysAgo = (n: number) => ymd(new Date(today.getTime() - n * 86_400_000));
    switch (preset) {
      case 'page':
        setDateFrom(dateFromProp);
        setDateTo(dateToProp);
        break;
      case '7':
      case '30':
      case '90':
        setDateFrom(daysAgo(Number(preset) - 1));
        setDateTo(ymd(today));
        break;
      case 'month':
        setDateFrom(`${ymd(today).slice(0, 8)}01`);
        setDateTo(ymd(today));
        break;
      case 'year':
        setDateFrom(`${today.getFullYear()}-01-01`);
        setDateTo(ymd(today));
        break;
      case 'all':
        setDateFrom(undefined);
        setDateTo(undefined);
        break;
    }
  };
  const pickerPresets: DateRangePreset[] = (() => {
    const today = new Date();
    const range = (from: Date | null, to: Date | null) => ({ from, to });
    const list: DateRangePreset[] = [
      ...([7, 30, 90] as const).map((n) => ({
        id: String(n),
        label: t(`crm.marketingChannelAnalytics.preset${n}`, { defaultValue: `Последние ${n} дней` }),
        range: lastDays(n),
      })),
      { id: 'month', label: t('crm.marketingChannelAnalytics.presetMonth', { defaultValue: 'Этот месяц' }), range: range(new Date(today.getFullYear(), today.getMonth(), 1), today) },
      { id: 'year', label: t('crm.marketingChannelAnalytics.presetYear', { defaultValue: 'Этот год' }), range: range(new Date(today.getFullYear(), 0, 1), today) },
      { id: 'all', label: t('crm.marketingChannelAnalytics.presetAll', { defaultValue: 'Весь период' }), range: range(null, null) },
    ];
    if (rangeChanged)
      list.push({
        id: 'page',
        label: t('crm.marketingChannelAnalytics.presetPage', { defaultValue: 'Как на странице' }),
        range: range(fromIsoDate(dateFromProp), fromIsoDate(dateToProp)),
      });
    return list;
  })();

  /** Валюта окна: по умолчанию — как на странице; пересчёт по курсам Frankfurter / ECB. */
  const [cur, setCur] = useState<{
    mode: MarketingCurrencyMode;
    display: string;
    rates: Record<string, number>;
    available?: string[];
  }>({ mode: currencyModeProp, display: displayCurrencyProp, rates: ratesProp });
  useEffect(() => {
    setCur((prev) => ({ ...prev, mode: currencyModeProp, display: displayCurrencyProp, rates: ratesProp }));
  }, [currencyModeProp, displayCurrencyProp, ratesProp]);
  const [fxLoading, setFxLoading] = useState(false);
  const onCurrencyChange = (value: string) => {
    if (value === 'native') {
      setCur((prev) => ({ ...prev, mode: 'native' }));
      return;
    }
    setFxLoading(true);
    fetchMarketingFxRates(value)
      .then((fx) =>
        setCur({
          mode: 'converted',
          display: value,
          rates: { ...fx.multiplyToDisplay },
          available: fx.availableDisplayCurrencies,
        }),
      )
      .catch(() => setCur((prev) => ({ ...prev, mode: 'converted', display: value })))
      .finally(() => setFxLoading(false));
  };
  const currencyMode = cur.mode;
  const displayCurrency = cur.display;
  const rates = cur.rates;
  const currencyChoices = useMemo(() => {
    const list = cur.available?.length ? cur.available : [...MARKETING_ALLOWED_CURRENCIES];
    return [...new Set([displayCurrency, ...list])].sort();
  }, [cur.available, displayCurrency]);
  /** Выбранный кабинет внутри окна ('' — все кабинеты). */
  const [account, setAccount] = useState(integrationId ?? '');
  useEffect(() => {
    setAccount(integrationId ?? '');
  }, [integrationId]);
  const accountOptions = useMemo(() => {
    const ids = [...new Set(allRows.map((r) => r.integrationId).filter((id): id is string => !!id))];
    return ids
      .map((id) => ({ id, label: integrationLabels?.[id] || id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows, integrationLabels]);
  /** Поиск по названию кампании и фильтр по стране внутри окна. */
  const [search, setSearch] = useState('');
  const [searchQ, setSearchQ] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setSearchQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  /** '' — все страны, '-' — страна не определена, иначе ISO2. */
  const [countryFilter, setCountryFilter] = useState('');
  const accountParam = account || undefined;
  const searchParam = searchQ || undefined;
  const countryParam = countryFilter || undefined;
  const filtersActive = Boolean(
    account ||
      searchQ ||
      countryFilter ||
      rangeChanged ||
      cur.mode !== currencyModeProp ||
      cur.display !== displayCurrencyProp,
  );
  const [series, setSeries] = useState<MarketingTrafficDailyPoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [geoRows, setGeoRows] = useState<MarketingTrafficCountryRow[]>([]);
  const [geoDetails, setGeoDetails] = useState<MarketingTrafficCountryDetail[]>([]);
  /** Раскрытая строка страны ('' — «страна не определена»). */
  const [geoExpanded, setGeoExpanded] = useState<string | null>(null);
  const rows = useMemo((): Item[] => {
    const byAccount = account ? allRows.filter((r) => r.integrationId === account) : allRows;
    if (countryFilter) {
      // Строки канала не разбиты по странам — при выбранной стране берём разбивку страна×кампания с API
      // (она уже учитывает кабинет и поиск).
      return geoDetails
        .filter((d) => (d.country ?? '-') === countryFilter)
        .map((d) => ({
          dataSource: dataSourceKey,
          integrationId: d.integrationId,
          source: d.source ?? null,
          medium: d.medium ?? null,
          campaign: d.campaign,
          sessions: d.sessions || 0,
          clicks: d.clicks || 0,
          leads: d.leads || 0,
          revenue: d.revenue || 0,
          impressions: d.impressions || 0,
          cost: d.cost || 0,
          currency: d.currency,
        }));
    }
    const q = foldTr(searchQ);
    return q ? byAccount.filter((r) => foldTr(r.campaign ?? '').includes(q)) : byAccount;
  }, [allRows, account, countryFilter, geoDetails, searchQ, dataSourceKey]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const onlyUnattributed = dataSourceKey === 'unknown';
  const chTheme = marketingChannelCardTheme(dataSourceKey);

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

  /** Дневной ряд расходов/выручки в валюте окна (API отдаёт суммы в валюте канала). */
  const seriesMoneyCurrency = convertMarketingAmount(0, provCur, currencyMode, displayCurrency, rates).currency;
  const seriesMoney = useMemo(
    () =>
      series.map((p) => ({
        ...p,
        cost: Math.round(convertMarketingAmount(p.cost || 0, provCur, currencyMode, displayCurrency, rates).value * 100) / 100,
        revenue: Math.round(convertMarketingAmount(p.revenue || 0, provCur, currencyMode, displayCurrency, rates).value * 100) / 100,
      })),
    [series, provCur, currencyMode, displayCurrency, rates],
  );

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
  /** Meta Ads — страна показа из статистики кабинета, а не веб-аналитика. */
  const isMetaAds = dataSourceKey === 'meta_ads';
  const mapByCountryAll = mapUsesApi ? trafficByCountryFromApi : trafficByCountryInferred;
  /** При выбранной стране на карте подсвечиваем только её (шкала — по ней одной). */
  const mapByCountry = useMemo(() => {
    if (!countryFilter) return mapByCountryAll;
    const one = new Map<string, CountryTrafficAgg>();
    const hit = mapByCountryAll.get(countryFilter);
    if (hit) one.set(countryFilter, hit);
    return one;
  }, [mapByCountryAll, countryFilter]);

  const mapTitle = mapUsesApi
    ? isMetaAds
      ? t('crm.marketingChannelAnalytics.mapTitleMeta', { defaultValue: 'География показов (данные Meta Ads)' })
      : t('crm.marketingChannelAnalytics.mapTitleGa4', {
        defaultValue: 'География (данные из Google Analytics)',
      })
    : undefined;
  const mapHint = mapUsesApi
    ? isMetaAds
      ? t('crm.marketingChannelAnalytics.mapHintMeta', {
          defaultValue: 'Страна показа рекламы — из статистики рекламного кабинета Meta (разбивка по странам).',
        })
      : t('crm.marketingChannelAnalytics.mapHintGa4', {
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

  const geoTableRows = useMemo((): MarketingTrafficCountryRow[] => {
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

  const geoHasCost = geoRows.some((r) => (r.cost || 0) > 0);
  /** Весь расход в таблице стран (с учётом кабинета и поиска) — база для «Доли расхода». */
  const geoCostTotal = geoRows.reduce((sum, r) => sum + (r.cost || 0), 0);
  const countryOptions = useMemo(
    () =>
      geoRows
        .filter((r) => (r.sessions || 0) + (r.impressions || 0) + (r.cost || 0) > 0)
        .map((r) => ({ value: r.country ?? '-', label: countryLabel(r.country) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [geoRows, countryLabel],
  );
  const geoDetailsByCountry = useMemo(() => {
    const m = new Map<string, MarketingTrafficCountryDetail[]>();
    for (const d of geoDetails) {
      const k = d.country ?? '';
      const arr = m.get(k) ?? [];
      arr.push(d);
      m.set(k, arr);
    }
    return m;
  }, [geoDetails]);

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

  const noAccountLabel = t('crm.marketingChannelAnalytics.noAccount', {
    defaultValue: 'Без метки кабинета',
  });
  const accountLabel = useCallback(
    (id: string | null | undefined) => (id ? integrationLabels?.[id] || id : noAccountLabel),
    [integrationLabels, noAccountLabel],
  );

  /** Суммы по рекламным кабинетам — только когда в выборке их несколько (режим «Все кабинеты»). */
  const byAccount = useMemo(() => {
    const m = new Map<
      string,
      { id: string | null; campaigns: number; impressions: number; clicks: number; sessions: number; leads: number; cost: number; revenue: number; currency: string }
    >();
    for (const r of rows) {
      const key = r.integrationId || '';
      const cur = m.get(key) ?? {
        id: r.integrationId || null,
        campaigns: 0,
        impressions: 0,
        clicks: 0,
        sessions: 0,
        leads: 0,
        cost: 0,
        revenue: 0,
        currency: r.currency || 'EUR',
      };
      cur.campaigns += 1;
      cur.impressions += r.impressions || 0;
      cur.clicks += r.clicks || 0;
      cur.sessions += r.sessions || 0;
      cur.leads += r.leads || 0;
      cur.cost += r.cost || 0;
      cur.revenue += r.revenue || 0;
      m.set(key, cur);
    }
    const list = [...m.values()];
    if (list.length < 2 || !list.some((a) => a.id)) return [];
    return list.sort((a, b) => b.cost - a.cost || b.impressions - a.impressions);
  }, [rows]);
  const showAccounts = byAccount.length > 1;
  /** Раскрытая строка кабинета ('' — строки без метки кабинета). */
  const [accExpanded, setAccExpanded] = useState<string | null>(null);
  /** Кампании каждого кабинета (строки канала агрегируются по названию кампании). */
  const campaignsByAccount = useMemo(() => {
    const m = new Map<
      string,
      Map<string, { campaign: string | null; impressions: number; clicks: number; leads: number; cost: number; currency: string }>
    >();
    for (const r of rows) {
      const ak = r.integrationId || '';
      const byCamp = m.get(ak) ?? new Map();
      const ck = r.campaign ?? '';
      const cur = byCamp.get(ck) ?? {
        campaign: r.campaign,
        impressions: 0,
        clicks: 0,
        leads: 0,
        cost: 0,
        currency: r.currency || 'EUR',
      };
      cur.impressions += r.impressions || 0;
      cur.clicks += r.clicks || 0;
      cur.leads += r.leads || 0;
      cur.cost += r.cost || 0;
      byCamp.set(ck, cur);
      m.set(ak, byCamp);
    }
    const out = new Map<string, Array<{ campaign: string | null; impressions: number; clicks: number; leads: number; cost: number; currency: string }>>();
    for (const [k, v] of m) {
      out.set(k, [...v.values()].sort((a, b) => b.cost - a.cost || b.impressions - a.impressions));
    }
    return out;
  }, [rows]);
  const accountsCostTotal = byAccount.reduce((s, a) => s + a.cost, 0);

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
        case 'account':
          return dir * accountLabel(a.integrationId).localeCompare(accountLabel(b.integrationId));
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
  }, [rows, sortKey, sortDir, t, accountLabel]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setSeriesLoading(true);
    setSeriesError(null);
    fetchMarketingTrafficDaily({
      from: dateFrom,
      to: dateTo,
      ...(onlyUnattributed ? { onlyUnattributed: true } : { dataSource: dataSourceKey, integrationId: accountParam }),
      q: searchParam,
      country: countryParam,
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
  }, [open, dateFrom, dateTo, dataSourceKey, accountParam, searchParam, countryParam, onlyUnattributed]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setGeoLoading(true);
    setGeoError(null);
    fetchMarketingTrafficByCountry({
      from: dateFrom,
      to: dateTo,
      ...(onlyUnattributed ? { onlyUnattributed: true } : { dataSource: dataSourceKey, integrationId: accountParam }),
      q: searchParam,
    })
      .then((res) => {
        if (!alive) return;
        setGeoRows(Array.isArray(res.rows) ? res.rows : []);
        setGeoDetails(Array.isArray(res.details) ? res.details : []);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setGeoError(e instanceof Error ? e.message : 'Error');
        setGeoRows([]);
        setGeoDetails([]);
      })
      .finally(() => {
        if (alive) setGeoLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, dateFrom, dateTo, dataSourceKey, accountParam, searchParam, onlyUnattributed]);

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
        <div
          className={`shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-[#e7e7e7] ${chTheme.headerBg}`}
        >
          {/* Logo badge */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: chTheme.brandColor,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 17,
              flexShrink: 0,
              fontFamily: 'Inter Tight, sans-serif',
            }}
          >
            {chTheme.logo}
          </div>
          <div className="flex-1 min-w-0">
            <div
              id="mch-analytics-title"
              className="text-[16px] sm:text-[18px] font-semibold tracking-tight text-[#222]"
            >
              {channelTitle}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-[#888] truncate" title={dataSourceKey}>
                {marketingProviderFamilyLabel(dataSourceKey)}
              </span>
              <span className="text-[10px] text-[#aaa]">·</span>
              <span className="text-[10.5px] text-[#888] font-mono">{periodLabel}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '7px 15px', border: '1px solid #e7e7e7', background: '#fff', color: '#222', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            {t('crm.marketingChannelAnalytics.close', { defaultValue: 'Закрыть' })}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#ececec] bg-[#fafafa] px-3 py-2.5 sm:px-5">
          <div className="relative min-w-[180px] flex-1 sm:max-w-[320px]">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#999]">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.marketingChannelAnalytics.searchCampaign', { defaultValue: 'Поиск кампании…' })}
              className="w-full rounded-lg border border-[#222222]/15 bg-white py-1.5 pl-7 pr-2.5 text-[12px] text-[#222222] placeholder:text-[#999]"
            />
          </div>
          <DateRangePicker
            value={{ from: fromIsoDate(dateFrom), to: fromIsoDate(dateTo) }}
            presets={pickerPresets}
            onChange={(v) => {
              if (v.presetId) return setPreset(v.presetId);
              setDateFrom(v.from ? toIsoDate(v.from) : undefined);
              setDateTo(v.to ? toIsoDate(v.to) : undefined);
            }}
          />
          <select
            className="rounded-lg border border-[#222222]/15 bg-white px-2.5 py-1.5 text-[12px] text-[#222222]"
            value={currencyMode === 'native' ? 'native' : displayCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            disabled={fxLoading}
            title={t('crm.marketingChannelAnalytics.currencyHint', {
              defaultValue: 'Пересчёт по курсам Frankfurter / ECB',
            })}
            aria-label={t('crm.marketingChannelAnalytics.currency', { defaultValue: 'Валюта' })}
          >
            <option value="native">{t('crm.marketingChannelAnalytics.currencyNative', { defaultValue: 'Исходная валюта' })}</option>
            {currencyChoices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {(rangeLoading || fxLoading) && (
            <span className="text-[11px] text-[#888]">
              {t('crm.marketingChannelAnalytics.loadingShort', { defaultValue: 'Загрузка…' })}
            </span>
          )}
          {countryOptions.length > 1 && (
            <select
              className="max-w-[46vw] sm:max-w-[220px] rounded-lg border border-[#222222]/15 bg-white px-2.5 py-1.5 text-[12px] text-[#222222]"
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                // строка «страна не определена» в таблице стран имеет ключ ''
                setGeoExpanded(e.target.value ? (e.target.value === '-' ? '' : e.target.value) : null);
              }}
              aria-label={t('crm.marketingChannelAnalytics.geoColCountry', { defaultValue: 'Страна' })}
            >
              <option value="">
                {t('crm.marketingChannelAnalytics.allCountries', {
                  defaultValue: 'Все страны ({{count}})',
                  count: countryOptions.length,
                })}
              </option>
              {countryOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
          {accountOptions.length > 1 && (
            <select
              className="max-w-[46vw] sm:max-w-[240px] rounded-lg border border-[#222222]/15 bg-white px-2.5 py-1.5 text-[12px] text-[#222222]"
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                onIntegrationChange?.(e.target.value);
              }}
              aria-label={t('crm.marketingChannelBlocks.accountFilter', { defaultValue: 'Рекламный кабинет' })}
            >
              <option value="">
                {t('crm.marketingChannelBlocks.allAccounts', {
                  defaultValue: 'Все кабинеты ({{count}})',
                  count: accountOptions.length,
                })}
              </option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchQ('');
                setCountryFilter('');
                setGeoExpanded(null);
                setAccount('');
                onIntegrationChange?.('');
                setDateFrom(dateFromProp);
                setDateTo(dateToProp);
                setCur((prev) => ({ ...prev, mode: currencyModeProp, display: displayCurrencyProp, rates: ratesProp }));
              }}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-[#0b4fc2] hover:bg-[#0866FF]/10"
            >
              {t('crm.marketingChannelAnalytics.resetFilters', { defaultValue: 'Сбросить' })}
            </button>
          )}
          {filtersActive && (
            <span className="ml-auto text-[11px] text-[#888]">
              {t('crm.marketingChannelAnalytics.filteredCampaigns', {
                defaultValue: 'Кампаний: {{count}}',
                count: new Set(rows.map((r) => `${r.integrationId ?? ''}|${r.campaign ?? ''}`)).size,
              })}
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:px-5 sm:py-5 space-y-6 sm:space-y-8">
          {/* 9-KPI hairline strip */}
          <div style={{ border: '1px solid #e7e7e7', borderRadius: 12, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(
              [
                { label: t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' }), v: formatNumber(aggTotals.impressions), color: undefined },
                { label: t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' }), v: formatNumber(aggTotals.clicks), color: '#5a45a8' },
                { label: t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' }), v: formatNumber(aggTotals.sessions), color: undefined },
                { label: t('crm.marketingChannels.kpi.leads'), v: formatNumber(aggTotals.leads), color: '#c08319' },
                { label: 'CTR', v: aggTotals.ctr != null ? `${aggTotals.ctr.toFixed(2)}%` : '—', color: undefined },
                { label: 'CPC', v: aggTotals.cpc != null && aggTotals.cpc > 0 ? `${formatMoney(aggTotals.cpc)} ${aggTotals.costC.currency}` : '—', color: undefined },
                { label: t('crm.marketingCampaigns.table.headers.cost'), v: fmtMoneyCell(aggTotals.cost, provCur), color: undefined },
                { label: t('crm.marketingCampaigns.table.headers.revenue'), v: fmtMoneyCell(aggTotals.revenue, provCur), color: '#1f8a5e' },
                { label: 'ROAS', v: aggTotals.roas != null && aggTotals.roas > 0 ? aggTotals.roas.toFixed(2) : '—', color: aggTotals.roas ? '#1f8a5e' : undefined },
              ]
            ).map((cell, idx, arr) => (
              <div
                key={idx}
                style={{
                  padding: '14px 18px',
                  borderRight: idx < arr.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}
              >
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', fontWeight: 500 }}>
                  {cell.label}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 600, color: cell.color ?? (cell.v === '—' ? '#b5b5b5' : '#222'), marginTop: 8, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {cell.v}
                </div>
              </div>
            ))}
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
                    {t('crm.marketingChannelAnalytics.chartCostRevenueCur', {
                      defaultValue: 'Расход и выручка по дням, {{currency}}',
                      currency: seriesMoneyCurrency,
                    })}
                  </div>
                  <div className="h-[220px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={seriesMoney} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickMargin={6} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            fontSize: 11,
                            border: '1px solid rgba(34,34,34,0.1)',
                          }}
                          formatter={(v: number | string) => `${formatMoney(Number(v) || 0)} ${seriesMoneyCurrency}`}
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
                  {isMetaAds
                    ? t('crm.marketingChannelAnalytics.geoTableHintMeta', {
                        defaultValue:
                          'Показы и клики по стране показа — из статистики рекламного кабинета Meta. Это агрегаты рекламы, не отдельные пользователи CRM.',
                      })
                    : t('crm.marketingChannelAnalytics.geoTableHint', {
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
                          {geoHasCost && (
                            <th className={`${marketingThNumeric} whitespace-nowrap`}>
                              {t('crm.marketingChannelBlocks.thCost', { defaultValue: 'Расход' })}
                            </th>
                          )}
                          {geoHasCost && (
                            <th className={`${marketingThNumeric} whitespace-nowrap`}>
                              {t('crm.marketingChannelAnalytics.costShare', { defaultValue: 'Доля расхода' })}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {geoTableRows
                          .filter((r) => !countryFilter || (r.country ?? '-') === countryFilter)
                          .map((r, idx) => {
                          const gk = r.country ?? '';
                          const det = geoDetailsByCountry.get(gk) ?? [];
                          const canExpand = det.length > 0;
                          const expanded = canExpand && geoExpanded === gk;
                          return (
                          <React.Fragment key={`${r.country ?? 'none'}-${idx}`}>
                          <tr
                            className={`${marketingTr} ${canExpand ? 'cursor-pointer hover:bg-[#222222]/[0.03]' : ''}`}
                            onClick={canExpand ? () => setGeoExpanded(expanded ? null : gk) : undefined}
                            title={canExpand ? t('crm.marketingChannelAnalytics.geoExpandHint', { defaultValue: 'Показать кабинеты и кампании этой страны' }) : undefined}
                          >
                            <td className={`${marketingTd} font-medium max-w-[160px] sm:max-w-none truncate`} title={countryLabel(r.country)}>
                              {canExpand && (
                                <span className="inline-block w-3.5 text-[#888]">{expanded ? '▾' : '▸'}</span>
                              )}
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
                            {geoHasCost && (
                              <td className={`${marketingTd} text-right tabular-nums font-medium whitespace-nowrap`}>
                                {fmtMoneyCell(r.cost || 0, r.currency)}
                              </td>
                            )}
                            {geoHasCost && (
                              <td className={`${marketingTd} whitespace-nowrap`}>
                                <ShareCell share={geoCostTotal > 0 ? ((r.cost || 0) / geoCostTotal) * 100 : 0} />
                              </td>
                            )}
                          </tr>
                          {expanded &&
                            det.slice(0, 50).map((d, j) => {
                              const camp = formatMarketingChannelDimension(
                                t,
                                sanitizeMarketingDimension(d.campaign),
                                'campaign',
                              );
                              return (
                                <tr key={`${gk}-d-${j}`} className="bg-[#f7f7f5]">
                                  <td className={`${marketingTd} pl-7 max-w-[160px] sm:max-w-[420px]`}>
                                    {d.integrationId && (
                                      <span className="mr-1.5 inline-block rounded bg-[#0866FF]/10 px-1.5 py-px text-[10px] text-[#0b4fc2]">
                                        {accountLabel(d.integrationId)}
                                      </span>
                                    )}
                                    <span className="text-[#222222]/80" title={camp}>{camp}</span>
                                  </td>
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {formatNumber(d.sessions || 0)}
                                  </td>
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {formatNumber(d.clicks || 0)}
                                  </td>
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {formatNumber(d.impressions || 0)}
                                  </td>
                                  {geoHasCost && (
                                    <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                      {fmtMoneyCell(d.cost || 0, d.currency)}
                                    </td>
                                  )}
                                  {geoHasCost && (
                                    <td className={`${marketingTd} whitespace-nowrap`}>
                                      <ShareCell share={geoCostTotal > 0 ? ((d.cost || 0) / geoCostTotal) * 100 : 0} muted />
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>

          {showAccounts && (
            <section className="space-y-2">
              <div className={marketingSectionTitle}>
                {t('crm.marketingChannelAnalytics.byAccount', { defaultValue: 'По кабинетам' })}
              </div>
              <div className={`${modalTableOuter} ${modalTableDensity}`}>
                <div className={`${modalTableInner} max-h-[320px] overflow-y-auto`}>
                  <table className="w-full min-w-[720px] text-left text-[10px] sm:text-[11px] border-separate border-spacing-0">
                    <thead className={`${marketingThead} sticky top-0 z-[1]`}>
                      <tr>
                        <th className={marketingTh}>
                          {t('crm.marketingChannelBlocks.accountFilter', { defaultValue: 'Рекламный кабинет' })}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingChannelAnalytics.campaignsCount', { defaultValue: 'Кампаний' })}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingChannelBlocks.thImpressions', { defaultValue: 'Показы' })}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingChannelBlocks.thClicks', { defaultValue: 'Клики' })}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>CTR</th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>CPC</th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingChannelBlocks.thLeads', { defaultValue: 'Лиды' })}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingChannelBlocks.thCost', { defaultValue: 'Расход' })}
                        </th>
                        <th className={`${marketingThNumeric} whitespace-nowrap`}>
                          {t('crm.marketingChannelAnalytics.costShare', { defaultValue: 'Доля расхода' })}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {byAccount.map((a) => {
                        const share = accountsCostTotal > 0 ? (a.cost / accountsCostTotal) * 100 : 0;
                        const ak = a.id ?? '';
                        const camps = campaignsByAccount.get(ak) ?? [];
                        const expanded = accExpanded === ak;
                        return (
                          <React.Fragment key={a.id ?? '_none'}>
                          <tr
                            className={`${marketingTr} ${camps.length ? 'cursor-pointer hover:bg-[#222222]/[0.03]' : ''}`}
                            onClick={camps.length ? () => setAccExpanded(expanded ? null : ak) : undefined}
                            title={camps.length ? t('crm.marketingChannelAnalytics.accountExpandHint', { defaultValue: 'Показать кампании кабинета' }) : undefined}
                          >
                            <td className={`${marketingTd} max-w-[240px] truncate font-medium`} title={accountLabel(a.id)}>
                              {camps.length > 0 && (
                                <span className="inline-block w-3.5 text-[#888]">{expanded ? '▾' : '▸'}</span>
                              )}
                              {accountLabel(a.id)}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {formatNumber(camps.length || a.campaigns)}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {formatNumber(a.impressions)}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {formatNumber(a.clicks)}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {a.impressions > 0 ? `${((a.clicks / a.impressions) * 100).toFixed(2)}%` : '—'}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {a.clicks > 0 && a.cost > 0 ? fmtMoneyCell(a.cost / a.clicks, a.currency) : '—'}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap`}>
                              {formatNumber(a.leads)}
                            </td>
                            <td className={`${marketingTd} text-right tabular-nums font-medium whitespace-nowrap`}>
                              {fmtMoneyCell(a.cost, a.currency)}
                            </td>
                            <td className={`${marketingTd} whitespace-nowrap`}>
                              <ShareCell share={share} />
                            </td>
                          </tr>
                          {expanded &&
                            camps.slice(0, 100).map((c, j) => {
                              const campLabel = formatMarketingChannelDimension(
                                t,
                                sanitizeMarketingDimension(c.campaign),
                                'campaign',
                              );
                              const cShare = accountsCostTotal > 0 ? (c.cost / accountsCostTotal) * 100 : 0;
                              return (
                                <tr key={`${ak}-c-${j}`} className="bg-[#f7f7f5]">
                                  <td className={`${marketingTd} pl-7 max-w-[240px] sm:max-w-[420px] truncate text-[#222222]/80`} title={campLabel}>
                                    {campLabel}
                                  </td>
                                  <td className={marketingTd} />
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {formatNumber(c.impressions)}
                                  </td>
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {formatNumber(c.clicks)}
                                  </td>
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : '—'}
                                  </td>
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {c.clicks > 0 && c.cost > 0 ? fmtMoneyCell(c.cost / c.clicks, c.currency) : '—'}
                                  </td>
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {formatNumber(c.leads)}
                                  </td>
                                  <td className={`${marketingTd} text-right tabular-nums whitespace-nowrap text-[#222222]/70`}>
                                    {fmtMoneyCell(c.cost, c.currency)}
                                  </td>
                                  <td className={`${marketingTd} whitespace-nowrap`}>
                                    <ShareCell share={cShare} muted />
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

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
                      {showAccounts && (
                        <th className={`${marketingTh} min-w-[110px]`}>
                          <button
                            type="button"
                            onClick={() => toggleSort('account')}
                            className="font-semibold text-left w-full min-w-0 hover:text-[#111827] inline-flex items-center gap-0.5 whitespace-nowrap"
                          >
                            {t('crm.marketingChannelAnalytics.accountCol', { defaultValue: 'Кабинет' })}
                            {sortKey === 'account' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                      )}
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
                          {showAccounts && (
                            <td
                              className={`${marketingTd} max-w-[160px] truncate align-top text-[#222222]/70`}
                              title={accountLabel(row.integrationId)}
                            >
                              {accountLabel(row.integrationId)}
                            </td>
                          )}
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
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
