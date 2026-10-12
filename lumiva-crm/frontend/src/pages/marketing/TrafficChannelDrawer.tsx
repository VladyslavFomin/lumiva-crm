/**
 * Полная аналитика канала — правая панель страницы «Трафик» (дизайн components/traffic-analytics.jsx).
 * Свои фильтры окна (поиск, период, валюта, страна, кабинет), KPI, динамика по дням,
 * структура расхода/трафика, кампании, география (карта + страны), кабинеты.
 * Данные: строки канала со страницы (или свой запрос при смене периода), /traffic/daily, /traffic/by-country.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import {
  fetchMarketingFxRates,
  fetchMarketingTraffic,
  fetchMarketingTrafficByCountry,
  fetchMarketingTrafficDaily,
  type MarketingTrafficCountryDetail,
  type MarketingTrafficCountryRow,
  type MarketingTrafficDailyPoint,
} from '../../api/marketing';
import { getLocale } from '../../i18n/utils';
import { marketingProviderFamilyLabel } from '../../utils/marketingDataSourceLabel';
import { DateRangePicker, fromIsoDate, lastDays, toIsoDate, type DateRangePreset } from '../../components/ui/DateRangePicker';
import { cl, Ic } from '../contacts/CrmListShared';
import { marketingChannelCardTheme } from './marketingChannelCardTheme';
import {
  MARKETING_ALLOWED_CURRENCIES,
  type MarketingCurrencyMode,
  type MarketingDisplayCurrencyState,
} from './marketingDisplayCurrencyStorage';
import { aggregateTrafficByInferredCountry, ISO2_TO_WORLD_ATLAS_NAME } from './marketingTrafficCountryInference';
import {
  Dash,
  TI,
  curOf,
  dimLabel,
  dominantCurrency,
  foldTr,
  isAdsSource,
  makeFormatters,
  moneyOf,
  type CurCtx,
  type TrafficItem,
} from './trafficShared';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const CAMPAIGNS_LIMIT = 300;
const SERIES_2 = '#5a45a8';
const SERIES_POS = '#1f8a5e';

type Tab = 'overview' | 'campaigns' | 'geo' | 'accounts';
type SortKey = 'campaign' | 'account' | 'impressions' | 'clicks' | 'sessions' | 'leads' | 'cost' | 'revenue';
type Series = { n: string; c: string; v: number[] };

/* ── линии по дням ── */
const Trend: React.FC<{ dates: string[]; series: Series[]; fmt: (v: number, short?: boolean) => string; locale: string }> = ({
  dates,
  series,
  fmt,
  locale,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth - 20)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const days = dates.length;
  const H = W < 520 ? 200 : 240;
  const PL = 52;
  const PR = 14;
  const PT = 16;
  const PB = 30;
  const top = Math.max(1, ...series.flatMap((s) => s.v));
  const max = top * 1.12;
  const X = (i: number) => PL + (i * (W - PL - PR)) / Math.max(1, days - 1);
  const Y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const ticks = days <= 7 ? dates.map((_, i) => i) : [0, Math.round((days - 1) / 3), Math.round(((days - 1) * 2) / 3), days - 1];
  const dl = (i: number) => {
    const d = fromIsoDate(dates[i]);
    return d ? d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) : dates[i];
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * W;
    const i = Math.round(((x - PL) / (W - PL - PR)) * (days - 1));
    setH(Math.max(0, Math.min(days - 1, i)));
  };
  const tipX = h != null ? Math.min(Math.max(X(h), 80), W - 80) : 0;
  return (
    <div className="sm-chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerLeave={() => setH(null)} role="img">
        {[0, 0.5, 1].map((p, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={Y(top * p)} y2={Y(top * p)} stroke={i ? 'var(--line-3)' : 'var(--line-2)'} />
            <text x={PL - 10} y={Y(top * p) + 3.5} textAnchor="end" fontSize="10" fontFamily="var(--ff-mono)" fill="var(--fg-4)">
              {fmt(top * p, true)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.n} d={path(s.v)} fill="none" stroke={s.c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {ticks.map((i) => (
          <text
            key={i}
            x={X(i)}
            y={H - 10}
            textAnchor={i === 0 ? 'start' : i === days - 1 ? 'end' : 'middle'}
            fontSize="10"
            fontFamily="var(--ff-mono)"
            fill="var(--fg-4)"
          >
            {dl(i)}
          </text>
        ))}
        {h != null && (
          <g>
            <line x1={X(h)} x2={X(h)} y1={PT} y2={H - PB} stroke="var(--line-2)" />
            {series.map((s) => (
              <circle key={s.n} cx={X(h)} cy={Y(s.v[h])} r="3.4" fill={s.c} />
            ))}
          </g>
        )}
      </svg>
      {h != null && (
        <div className="sm-tip" style={{ left: `${(tipX / W) * 100}%`, top: Math.max(56, Math.min(...series.map((s) => Y(s.v[h])))) }}>
          <div className="dt">{dl(h)}</div>
          {series.map((s) => (
            <div className="rw" key={s.n}>
              <i style={{ background: s.c }} />
              <span>{s.n}</span>
              <b>{fmt(s.v[h])}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── карта: монохромная шкала, клик по стране — фильтр окна ── */
type GeoAgg = { iso: string; sessions: number; impressions: number; clicks: number };
const GeoMap: React.FC<{
  rows: GeoAgg[];
  sel: string;
  onPick: ((iso: string) => void) | null;
  nameOf: (iso: string | null) => string;
  nf: (v: number) => string;
}> = ({ rows, sel, onPick, nameOf, nf }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<null | { n: string; d?: GeoAgg; x: number; y: number }>(null);
  const enNames = useMemo(() => new Intl.DisplayNames(['en'], { type: 'region' }), []);
  const byAtlas = useMemo(() => {
    const m = new Map<string, GeoAgg>();
    for (const r of rows) {
      let atlas = ISO2_TO_WORLD_ATLAS_NAME[r.iso];
      if (!atlas) {
        try {
          atlas = enNames.of(r.iso) ?? '';
        } catch {
          atlas = '';
        }
      }
      if (atlas) m.set(atlas, r);
    }
    return m;
  }, [rows, enNames]);
  const val = (d: GeoAgg) => d.sessions || d.impressions;
  const max = Math.max(1, ...rows.map(val));
  // color-mix(var(--ink) p%, #fff) — шкала кабинета, считаем в rgb для fill.
  const fillFor = (v: number) => {
    const p = (12 + v * 78) / 100;
    const c = Math.round(255 - (255 - 34) * p);
    return `rgb(${c},${c},${c})`;
  };
  return (
    <div
      className="an-map"
      ref={ref}
      onMouseMove={(e) => {
        const b = ref.current?.getBoundingClientRect();
        if (!b) return;
        setTip((p) => p && { ...p, x: e.clientX - b.left, y: e.clientY - b.top });
      }}
    >
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 190, center: [28, 44] }} width={900} height={420}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies
              .filter((g) => (g.properties as { name?: string }).name !== 'Antarctica')
              .map((g) => {
                const name = (g.properties as { name?: string }).name || '';
                const d = byAtlas.get(name);
                const isSel = !!d && sel === d.iso;
                const fill = d ? fillFor(val(d) / max) : '#f5f5f5';
                return (
                  <Geography
                    key={g.rsmKey}
                    geography={g}
                    onMouseEnter={() => setTip({ n: d ? nameOf(d.iso) : name, d, x: 0, y: 0 })}
                    onMouseLeave={() => setTip(null)}
                    onClick={() => d && onPick?.(isSel ? '' : d.iso)}
                    style={{
                      default: { fill, stroke: isSel ? '#222' : '#fff', strokeWidth: isSel ? 1.6 : 0.6, outline: 'none' },
                      hover: { fill, stroke: d ? '#222' : '#fff', strokeWidth: d ? 1 : 0.6, outline: 'none', cursor: d && onPick ? 'pointer' : 'default' },
                      pressed: { fill, outline: 'none' },
                    }}
                  />
                );
              })
          }
        </Geographies>
      </ComposableMap>
      {tip && tip.x > 0 && (
        <div className="an-map-tip" style={{ left: Math.min(tip.x + 14, (ref.current?.clientWidth || 600) - 170), top: tip.y + 14 }}>
          <b>{tip.n}</b>
          {tip.d ? (
            <>
              <div>
                <span>{t('crm.trafficPage.col.sessions')}</span>
                {nf(tip.d.sessions)}
              </div>
              <div>
                <span>{t('crm.trafficPage.col.impressions')}</span>
                {nf(tip.d.impressions)}
              </div>
              <div>
                <span>{t('crm.trafficPage.col.clicks')}</span>
                {nf(tip.d.clicks)}
              </div>
            </>
          ) : (
            <div>
              <span>{t('crm.trafficPage.an.noCountryData')}</span>
            </div>
          )}
        </div>
      )}
      <div className="an-map-scale">
        <span>{t('crm.trafficPage.an.less')}</span>
        <i />
        <span>{t('crm.trafficPage.an.more')}</span>
      </div>
    </div>
  );
};

/* ── доли (вместо круговых диаграмм) ── */
type ShareRow = { k: string; v: number };
const ShareList: React.FC<{ title: string; rows: ShareRow[]; fmt: (v: number) => string }> = ({ title, rows, fmt }) => {
  const { t } = useTranslation();
  const tot = rows.reduce((s, r) => s + r.v, 0) || 1;
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="an-share">
      <div className="an-sub">{title}</div>
      {rows.length === 0 && (
        <div className="tr-na" style={{ padding: '8px 0' }}>
          {t('crm.trafficPage.noData')}
        </div>
      )}
      {rows.map((r) => (
        <div className="an-share-r" key={r.k}>
          <span className="t" title={r.k}>
            {r.k}
          </span>
          <span className="v">{fmt(r.v)}</span>
          <span className="tr-bar">
            <i style={{ width: `${(r.v / max) * 100}%` }} />
          </span>
          <span className="p">{((r.v / tot) * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
};
const topN = (m: Map<string, number>, n: number, other: string): ShareRow[] => {
  const a = [...m.entries()].map(([k, v]) => ({ k, v })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v);
  const top = a.slice(0, n);
  const rest = a.slice(n).reduce((s, x) => s + x.v, 0);
  if (rest > 0) top.push({ k: other, v: rest });
  return top;
};

export type TrafficChannelDrawerProps = {
  ds: string;
  title: string;
  /** Строки канала со страницы (все кабинеты). */
  rows: TrafficItem[];
  dateFrom?: string;
  dateTo?: string;
  pageCur: MarketingDisplayCurrencyState;
  integrationLabels?: Record<string, string>;
  /** Кабинет, выбранный на странице ('' — все). */
  account: string;
  onAccountChange: (id: string) => void;
  onClose: () => void;
};

export const TrafficChannelDrawer: React.FC<TrafficChannelDrawerProps> = ({
  ds,
  title,
  rows: rowsProp,
  dateFrom: fromProp,
  dateTo: toProp,
  pageCur,
  integrationLabels: labelsProp,
  account: accountProp,
  onAccountChange,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const locale = getLocale();
  const { nf, mf, mk } = useMemo(() => makeFormatters(locale), [locale]);
  const ads = isAdsSource(ds);
  const unattributed = ds === 'unknown';
  const theme = marketingChannelCardTheme(ds);

  const [tab, setTab] = useState<Tab>('overview');
  const [chart, setChart] = useState<'traffic' | 'money'>('traffic');
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: 'cost', d: -1 });
  const [openC, setOpenC] = useState<string | null>(null);
  const [openA, setOpenA] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /* период окна: по умолчанию как на странице; при смене строки канала грузим заново */
  const [range, setRange] = useState<{ from?: string; to?: string }>({ from: fromProp, to: toProp });
  const [presetId, setPresetId] = useState<string | null>('page');
  const rangeChanged = (range.from || '') !== (fromProp || '') || (range.to || '') !== (toProp || '');
  const [rangeData, setRangeData] = useState<null | { rows: TrafficItem[]; labels?: Record<string, string> }>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  useEffect(() => {
    if (!rangeChanged) {
      setRangeData(null);
      return;
    }
    let alive = true;
    setRangeLoading(true);
    fetchMarketingTraffic({ from: range.from, to: range.to, ...(unattributed ? {} : { dataSource: ds }), itemsLimit: 20_000 })
      .then((st) => {
        if (!alive) return;
        const items = unattributed
          ? st.items.filter((it) => !(it.dataSource ?? '').trim())
          : st.items.filter((it) => (it.dataSource ?? '') === ds);
        setRangeData({ rows: items, labels: st.integrationLabels });
      })
      .catch(() => alive && setRangeData({ rows: [] }))
      .finally(() => alive && setRangeLoading(false));
    return () => {
      alive = false;
    };
  }, [rangeChanged, range.from, range.to, ds, unattributed]);
  const allRows = rangeChanged ? (rangeData?.rows ?? []) : rowsProp;
  const integrationLabels = rangeData?.labels ?? labelsProp;
  const accountLabel = useCallback(
    (id: string | null | undefined) => (id ? integrationLabels?.[id] || id : t('crm.trafficPage.an.noAccount')),
    [integrationLabels, t],
  );

  const pickerPresets: DateRangePreset[] = useMemo(() => {
    const today = new Date();
    return [
      { id: 'page', label: t('crm.trafficPage.an.asPage'), range: { from: fromIsoDate(fromProp), to: fromIsoDate(toProp) } },
      ...([7, 30, 90] as const).map((n) => ({ id: String(n), label: t(`crm.trafficPage.an.last${n}`), range: lastDays(n) })),
      { id: 'year', label: t('crm.trafficPage.an.thisYear'), range: { from: new Date(today.getFullYear(), 0, 1), to: today } },
      { id: 'all', label: t('crm.trafficPage.an.allTime'), range: { from: null, to: null } },
    ];
  }, [t, fromProp, toProp]);

  /* валюта окна: по умолчанию как на странице; пересчёт по курсам ECB (Frankfurter) */
  const [cur, setCur] = useState<{ mode: MarketingCurrencyMode; display: string; rates: Record<string, number>; available?: string[] }>({
    mode: pageCur.currencyMode,
    display: pageCur.displayCurrency,
    rates: pageCur.rates,
    available: pageCur.availableDisplayCurrencies,
  });
  const pageCurValue = pageCur.currencyMode === 'native' ? 'native' : pageCur.displayCurrency;
  const curValue = cur.mode === 'native' ? 'native' : cur.display;
  const onCurrency = (value: string) => {
    if (value === 'native') return setCur((p) => ({ ...p, mode: 'native' }));
    if (value === pageCur.displayCurrency && pageCur.currencyMode === 'converted') {
      return setCur({ mode: 'converted', display: value, rates: pageCur.rates, available: pageCur.availableDisplayCurrencies });
    }
    fetchMarketingFxRates(value)
      .then((fx) => setCur({ mode: 'converted', display: value, rates: { ...fx.multiplyToDisplay }, available: fx.availableDisplayCurrencies }))
      .catch(() => setCur((p) => ({ ...p, mode: 'converted', display: value, rates: {} })));
  };
  const ctx: CurCtx = useMemo(() => ({ mode: cur.mode, display: cur.display, rates: cur.rates }), [cur]);
  const currencyChoices = useMemo(() => {
    const list = cur.available?.length ? cur.available : [...MARKETING_ALLOWED_CURRENCIES];
    return [...new Set([cur.display, ...list])].sort();
  }, [cur.available, cur.display]);

  /* кабинет, поиск, страна */
  const [account, setAccount] = useState(accountProp);
  const accounts = useMemo(
    () =>
      [...new Set(allRows.map((r) => r.integrationId).filter((id): id is string => !!id))].sort((a, b) =>
        accountLabel(a).localeCompare(accountLabel(b)),
      ),
    [allRows, accountLabel],
  );
  const pickAccount = (id: string) => {
    setAccount(id);
    onAccountChange(id);
  };
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  /** '' — все страны, '-' — страна не определена, иначе ISO2. */
  const [country, setCountry] = useState('');

  const [series, setSeries] = useState<MarketingTrafficDailyPoint[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [geoRows, setGeoRows] = useState<MarketingTrafficCountryRow[]>([]);
  const [geoDetails, setGeoDetails] = useState<MarketingTrafficCountryDetail[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const scope = unattributed ? { onlyUnattributed: true as const } : { dataSource: ds, integrationId: account || undefined };

  useEffect(() => {
    let alive = true;
    setSeriesLoading(true);
    fetchMarketingTrafficDaily({ from: range.from, to: range.to, ...scope, q: q || undefined, country: country || undefined })
      .then((res) => alive && setSeries(Array.isArray(res.series) ? res.series : []))
      .catch(() => alive && setSeries([]))
      .finally(() => alive && setSeriesLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope выводится из ds/account
  }, [range.from, range.to, ds, account, q, country]);

  useEffect(() => {
    let alive = true;
    setGeoLoading(true);
    fetchMarketingTrafficByCountry({ from: range.from, to: range.to, ...scope, q: q || undefined })
      .then((res) => {
        if (!alive) return;
        setGeoRows(Array.isArray(res.rows) ? res.rows : []);
        setGeoDetails(Array.isArray(res.details) ? res.details : []);
      })
      .catch(() => {
        if (!alive) return;
        setGeoRows([]);
        setGeoDetails([]);
      })
      .finally(() => alive && setGeoLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope выводится из ds/account
  }, [range.from, range.to, ds, account, q]);

  /** Строки окна. Строки канала не разбиты по странам — при выбранной стране берём разбивку страна×кампания с API. */
  const rows = useMemo((): TrafficItem[] => {
    if (country) {
      return geoDetails
        .filter((d) => (d.country ?? '-') === country)
        .map((d) => ({
          dataSource: ds,
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
    const base = account ? allRows.filter((r) => r.integrationId === account) : allRows;
    const fq = foldTr(q);
    return fq ? base.filter((r) => foldTr(r.campaign ?? '').includes(fq)) : base;
  }, [allRows, account, country, geoDetails, q, ds]);

  const lead = (r: TrafficItem) => (ads ? r.conversions || 0 : r.leads || 0);
  const rev = (r: TrafficItem) => (ads ? r.conversionValue || 0 : r.revenue || 0);
  const conv = useCallback((v: number, from: string) => moneyOf(ctx, v, from).v, [ctx]);
  const provCur = useMemo(() => dominantCurrency(rows), [rows]);
  const curL = cur.mode === 'native' ? provCur : cur.display;

  const T = useMemo(() => {
    const s = { impressions: 0, clicks: 0, sessions: 0, leads: 0, cost: 0, rev: 0 };
    for (const r of rows) {
      s.impressions += r.impressions || 0;
      s.clicks += r.clicks || 0;
      s.sessions += r.sessions || 0;
      s.leads += lead(r);
      s.cost += conv(r.cost || 0, curOf(r));
      s.rev += conv(rev(r), curOf(r));
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, conv, ads]);
  const ctr = T.impressions > 0 && T.clicks !== T.impressions ? (T.clicks / T.impressions) * 100 : null;
  const money = (v: number) => `${mf(v)} ${curL}`;

  /* дневной ряд: API отдаёт суммы в валюте канала */
  const dates = useMemo(() => series.map((p) => p.date), [series]);
  const sTraffic: Series[] = useMemo(
    () =>
      [
        { n: t('crm.trafficPage.col.sessions'), c: 'var(--ink)', v: series.map((p) => p.sessions || 0) },
        { n: t('crm.trafficPage.col.clicks'), c: SERIES_2, v: series.map((p) => p.clicks || 0) },
      ].filter((s) => s.v.some(Boolean)),
    [series, t],
  );
  const sMoney: Series[] = useMemo(
    () =>
      [
        { n: t('crm.trafficPage.col.cost'), c: 'var(--ink)', v: series.map((p) => conv(p.cost || 0, provCur)) },
        { n: t('crm.trafficPage.col.revenue'), c: SERIES_POS, v: series.map((p) => conv(p.revenue || 0, provCur)) },
      ].filter((s) => s.v.some(Boolean)),
    [series, conv, provCur, t],
  );
  const short = (v: number) => (v >= 1000 ? v.toLocaleString(locale, { notation: 'compact', maximumFractionDigits: 1 }) : String(Math.round(v)));
  const fmtN = (v: number, s?: boolean) => (s ? short(v) : nf(v));
  const fmtM = (v: number, s?: boolean) => (s ? short(v) : money(v));
  const active = chart === 'traffic' ? sTraffic : sMoney;

  /* структура */
  const other = t('crm.trafficPage.an.other');
  const shCost = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(dimLabel(t, r.campaign), (m.get(dimLabel(t, r.campaign)) || 0) + conv(r.cost || 0, curOf(r)));
    return topN(m, 6, other);
  }, [rows, conv, t, other]);
  const shSrc = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(dimLabel(t, r.source), (m.get(dimLabel(t, r.source)) || 0) + (r.sessions || 0));
    return topN(m, 5, other);
  }, [rows, t, other]);
  const shMed = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(dimLabel(t, r.medium), (m.get(dimLabel(t, r.medium)) || 0) + (r.impressions || 0));
    return topN(m, 5, other);
  }, [rows, t, other]);

  /* кампании */
  const camps = useMemo(() => {
    const list = rows.map((r) => ({
      campaign: dimLabel(t, r.campaign),
      account: accountLabel(r.integrationId),
      impressions: r.impressions || 0,
      clicks: r.clicks || 0,
      sessions: r.sessions || 0,
      leads: lead(r),
      cost: conv(r.cost || 0, curOf(r)),
      revenue: conv(rev(r), curOf(r)),
    }));
    return list.sort((a, b) => {
      const x = a[sort.k];
      const y = b[sort.k];
      return typeof x === 'string' ? sort.d * x.localeCompare(String(y)) : sort.d * ((x as number) - (y as number));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort, conv, accountLabel, t, ads]);
  const multiAcc = accounts.length > 1;

  /* география */
  const regionNames = useMemo(() => {
    const l = (i18n.language || 'ru').split('-')[0].toLowerCase();
    return new Intl.DisplayNames([['ru', 'en', 'tr'].includes(l) ? l : 'en'], { type: 'region' });
  }, [i18n.language]);
  const countryName = useCallback(
    (code: string | null) => {
      const u = (code ?? '').trim().toUpperCase();
      if (!u || u === '-') return t('crm.trafficPage.an.unknownCountry');
      if (/^[A-Z]{2}$/.test(u)) {
        try {
          return regionNames.of(u) || u;
        } catch {
          return u;
        }
      }
      return u;
    },
    [regionNames, t],
  );
  const geoFromApi = geoRows.length > 0;
  /** Без гео в БД — оценка страны по названию кампании (как раньше в окне канала). */
  const geoTable = useMemo((): Array<MarketingTrafficCountryRow & { key: string }> => {
    if (geoFromApi) {
      return [...geoRows]
        .map((r) => ({ ...r, key: (r.country ?? '').trim().toUpperCase() || '-' }))
        .sort((a, b) => (b.sessions || 0) + (b.impressions || 0) - ((a.sessions || 0) + (a.impressions || 0)));
    }
    return [...aggregateTrafficByInferredCountry(rows).byCountry.values()]
      .map((a) => ({ country: a.iso2, key: a.iso2, sessions: a.sessions, clicks: a.clicks, impressions: a.impressions }))
      .sort((a, b) => b.sessions + b.impressions - (a.sessions + a.impressions));
  }, [geoFromApi, geoRows, rows]);
  const mapRows: GeoAgg[] = useMemo(
    () =>
      geoTable
        .filter((r) => /^[A-Z]{2}$/.test(r.key) && (!country || r.key === country))
        .map((r) => ({ iso: r.key, sessions: r.sessions || 0, impressions: r.impressions || 0, clicks: r.clicks || 0 })),
    [geoTable, country],
  );
  const geoCost = (r: MarketingTrafficCountryRow) => conv(r.cost || 0, r.currency || provCur);
  const geoCostTotal = geoTable.reduce((s, r) => s + geoCost(r), 0);
  const detailsBy = useMemo(() => {
    const m = new Map<string, MarketingTrafficCountryDetail[]>();
    for (const d of geoDetails) {
      const k = (d.country ?? '').trim().toUpperCase() || '-';
      const arr = m.get(k) ?? [];
      arr.push(d);
      m.set(k, arr);
    }
    return m;
  }, [geoDetails]);
  const countryOptions = geoFromApi
    ? geoTable
        .filter((r) => (r.sessions || 0) + (r.impressions || 0) + (r.cost || 0) > 0)
        .map((r) => ({ v: r.key, n: countryName(r.key) }))
        .sort((a, b) => a.n.localeCompare(b.n))
    : [];
  const countryLabel = country ? countryName(country) : '';

  /* кабинеты — только когда их несколько и фильтр «все» */
  const byAcc = useMemo(() => {
    if (accounts.length < 2 || account) return [];
    const m = new Map<string, { id: string; rs: TrafficItem[] }>();
    for (const r of rows) {
      const id = r.integrationId || '';
      const o = m.get(id) ?? { id, rs: [] };
      o.rs.push(r);
      m.set(id, o);
    }
    return [...m.values()]
      .map((o) => ({
        ...o,
        camps: new Set(o.rs.map((r) => r.campaign ?? '')).size,
        impressions: o.rs.reduce((s, r) => s + (r.impressions || 0), 0),
        clicks: o.rs.reduce((s, r) => s + (r.clicks || 0), 0),
        leads: o.rs.reduce((s, r) => s + lead(r), 0),
        cost: o.rs.reduce((s, r) => s + conv(r.cost || 0, curOf(r)), 0),
      }))
      .sort((a, b) => b.cost - a.cost || b.impressions - a.impressions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, accounts, account, conv, ads]);
  const accCostTotal = byAcc.reduce((s, a) => s + a.cost, 0) || 1;

  useEffect(() => {
    if (tab === 'accounts' && byAcc.length === 0) setTab('overview');
  }, [tab, byAcc.length]);

  const filtered = !!(search || account || country || rangeChanged || curValue !== pageCurValue);
  const reset = () => {
    setSearch('');
    setQ('');
    pickAccount('');
    setCountry('');
    setRange({ from: fromProp, to: toProp });
    setPresetId('page');
    setCur({ mode: pageCur.currencyMode, display: pageCur.displayCurrency, rates: pageCur.rates, available: pageCur.availableDisplayCurrencies });
  };

  const periodText =
    range.from && range.to
      ? `${fromIsoDate(range.from)?.toLocaleDateString(locale)} — ${fromIsoDate(range.to)?.toLocaleDateString(locale)}`
      : range.from
        ? `${fromIsoDate(range.from)?.toLocaleDateString(locale)} — …`
        : t('crm.trafficPage.an.allTime').toLowerCase();

  const L = ads ? t('crm.trafficPage.col.conversions') : t('crm.trafficPage.col.leads');
  const R = ads ? t('crm.trafficPage.col.value') : t('crm.trafficPage.col.revenue');
  const tabs: Array<[Tab, string]> = [
    ['overview', t('crm.trafficPage.an.tabOverview')],
    ['campaigns', `${t('crm.trafficPage.an.tabCampaigns')} · ${camps.length}`],
    ['geo', t('crm.trafficPage.an.tabGeo')],
    ...(byAcc.length ? ([['accounts', `${t('crm.trafficPage.an.tabAccounts')} · ${byAcc.length}`]] as Array<[Tab, string]>) : []),
  ];
  const TH: React.FC<{ id: SortKey; l?: boolean; children: React.ReactNode }> = ({ id, l, children }) => (
    <th className={l ? '' : 'r'}>
      <button
        type="button"
        className={cl('an-th', sort.k === id && 'on')}
        onClick={() => setSort((s) => ({ k: id, d: s.k === id ? (s.d === 1 ? -1 : 1) : id === 'campaign' || id === 'account' ? 1 : -1 }))}
      >
        {children}
        {sort.k === id && <span>{sort.d > 0 ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
  const busy = rangeLoading;
  const Mu = ({ v }: { v: number }) => (
    <>
      {mf(v)}
      <span className="u">{curL}</span>
    </>
  );

  const body = (
    <div className="px-scope smm-scope">
      <div className="sm-drawer-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="an" role="dialog" aria-modal="true" aria-label={t('crm.trafficPage.an.aria', { name: title })}>
          <div className="an-head">
            <span className="sm-ava" style={{ background: theme.brandColor }}>
              {theme.logo}
            </span>
            <div className="nm">
              <h2>
                {title}
                {country && (
                  <span className="an-chip">
                    {countryLabel}
                    <button type="button" onClick={() => setCountry('')} title={t('crm.trafficPage.an.clearFilter')}>
                      <Ic d={TI.x} size={11} />
                    </button>
                  </span>
                )}
              </h2>
              <span>
                {unattributed ? t('crm.trafficPage.unknownSub') : marketingProviderFamilyLabel(ds)} · {periodText}
              </span>
            </div>
            <button type="button" className="sm-ico" onClick={onClose} title={t('crm.trafficPage.an.close')} aria-label={t('crm.trafficPage.an.close')}>
              <Ic d={TI.x} size={15} />
            </button>
          </div>

          <div className="an-bar">
            <label className="sm-search">
              <Ic d={TI.search} size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('crm.trafficPage.an.searchPh')} />
            </label>
            <DateRangePicker
              value={{ from: fromIsoDate(range.from), to: fromIsoDate(range.to) }}
              presetId={presetId}
              presets={pickerPresets}
              onChange={(v) => {
                setPresetId(v.presetId);
                if (v.presetId === 'page') return setRange({ from: fromProp, to: toProp });
                setRange({ from: v.from ? toIsoDate(v.from) : undefined, to: v.to ? toIsoDate(v.to) : undefined });
              }}
            />
            <select className="sm-select" value={curValue} onChange={(e) => onCurrency(e.target.value)} title={t('crm.trafficPage.an.fxTitle')}>
              <option value="native">{t('crm.trafficPage.an.nativeCur')}</option>
              {currencyChoices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {countryOptions.length > 0 && (
              <select className="sm-select" value={country} onChange={(e) => setCountry(e.target.value)} aria-label={t('crm.trafficPage.an.country')}>
                <option value="">{t('crm.trafficPage.an.allCountries', { count: countryOptions.filter((c) => c.v !== '-').length })}</option>
                {countryOptions.map((c) => (
                  <option key={c.v} value={c.v}>
                    {c.n}
                  </option>
                ))}
              </select>
            )}
            {multiAcc && (
              <select className="sm-select" value={account} onChange={(e) => pickAccount(e.target.value)} aria-label={t('crm.trafficPage.account')}>
                <option value="">{t('crm.trafficPage.allAccounts', { count: accounts.length })}</option>
                {accounts.map((id) => (
                  <option key={id} value={id}>
                    {accountLabel(id)}
                  </option>
                ))}
              </select>
            )}
            {filtered && (
              <button type="button" className="an-reset" onClick={reset}>
                {t('crm.trafficPage.an.reset')}
              </button>
            )}
          </div>

          <div className="an-tabs" role="tablist">
            {tabs.map(([id, n]) => (
              <button type="button" role="tab" aria-selected={tab === id} key={id} className={cl(tab === id && 'on')} onClick={() => setTab(id)}>
                {n}
              </button>
            ))}
          </div>

          <div className={cl('an-body', 'tr-body', busy && 'is-loading')}>
            {tab === 'overview' && (
              <>
                <div className="sm-kpis tr-kpis">
                  <div className="sm-kpi">
                    <span className="l">{t('crm.trafficPage.col.impressions')}</span>
                    <span className="v">{T.impressions ? nf(T.impressions) : '—'}</span>
                    <span className="note">CTR {ctr != null ? `${ctr.toFixed(2)}%` : '—'}</span>
                  </div>
                  <div className="sm-kpi">
                    <span className="l">{t('crm.trafficPage.col.clicks')}</span>
                    <span className="v">{T.clicks ? nf(T.clicks) : '—'}</span>
                    <span className="note">CPC {T.clicks && T.cost ? money(T.cost / T.clicks) : '—'}</span>
                  </div>
                  <div className="sm-kpi">
                    <span className="l">{t('crm.trafficPage.col.sessions')}</span>
                    <span className="v">{T.sessions ? nf(T.sessions) : '—'}</span>
                    <span className="note">CPM {T.impressions && T.cost ? money((T.cost / T.impressions) * 1000) : '—'}</span>
                  </div>
                  <div className="sm-kpi">
                    <span className="l">{L}</span>
                    <span className="v">{T.leads ? nf(Math.round(T.leads * 10) / 10) : '—'}</span>
                    <span className="note">
                      {ads ? 'CPA' : 'CPL'} {T.leads && T.cost ? money(T.cost / T.leads) : '—'}
                    </span>
                  </div>
                  <div className="sm-kpi">
                    <span className="l">{t('crm.trafficPage.col.cost')}</span>
                    <span className="v">
                      {T.cost ? mk(T.cost) : '—'}
                      {T.cost > 0 && <span className="u">{curL}</span>}
                    </span>
                    <span className="note">{t('crm.trafficPage.an.rows', { count: rows.length })}</span>
                  </div>
                  <div className="sm-kpi">
                    <span className="l">{R}</span>
                    <span className="v pos">
                      {T.rev ? mk(T.rev) : '—'}
                      {T.rev > 0 && <span className="u">{curL}</span>}
                    </span>
                    <span className="note">ROAS {T.cost && T.rev ? (T.rev / T.cost).toFixed(2) : '—'}</span>
                  </div>
                </div>

                <div className="sm-card">
                  <div className="sm-card-head">
                    <h3>{t('crm.trafficPage.an.daily')}</h3>
                    <div className="sm-card-tools">
                      <div className="sm-seg">
                        <button type="button" className={chart === 'traffic' ? 'active' : ''} onClick={() => setChart('traffic')}>
                          {t('crm.trafficPage.an.chartTraffic')}
                        </button>
                        <button type="button" className={chart === 'money' ? 'active' : ''} onClick={() => setChart('money')}>
                          {t('crm.trafficPage.an.chartMoney')}
                        </button>
                      </div>
                    </div>
                  </div>
                  {seriesLoading && series.length === 0 ? (
                    <div className="sm-skel" style={{ height: 220, margin: 14 }} />
                  ) : active.length === 0 || dates.length < 2 ? (
                    <div className="sm-empty">{t('crm.trafficPage.an.noDaily')}</div>
                  ) : (
                    <>
                      <Trend dates={dates} series={active} fmt={chart === 'traffic' ? fmtN : fmtM} locale={locale} />
                      <div className="sm-legend">
                        {active.map((s) => (
                          <button type="button" key={s.n} className="on" style={{ color: s.c }}>
                            <i />
                            <span style={{ color: 'var(--fg-2)' }}>{s.n}</span>
                          </button>
                        ))}
                        {chart === 'money' && <span className="hint">{curL}</span>}
                      </div>
                    </>
                  )}
                </div>

                <div className="sm-card">
                  <div className="sm-card-head">
                    <h3>{t('crm.trafficPage.an.structure')}</h3>
                    <span className="meta">{t('crm.trafficPage.an.topAndOther')}</span>
                  </div>
                  <div className="an-shares">
                    <ShareList title={t('crm.trafficPage.an.costByCampaign', { cur: curL })} rows={shCost} fmt={mk} />
                    <ShareList title={t('crm.trafficPage.an.sessionsBySource')} rows={shSrc} fmt={nf} />
                    <ShareList title={t('crm.trafficPage.an.imprByMedium')} rows={shMed} fmt={nf} />
                  </div>
                </div>
              </>
            )}

            {tab === 'campaigns' && (
              <div className="sm-card">
                <div className="sm-table-scroll">
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <TH id="campaign" l>
                          {t('crm.trafficPage.col.campaign')}
                        </TH>
                        {multiAcc && (
                          <TH id="account" l>
                            {t('crm.trafficPage.account')}
                          </TH>
                        )}
                        <TH id="impressions">{t('crm.trafficPage.col.impressions')}</TH>
                        <TH id="clicks">{t('crm.trafficPage.col.clicks')}</TH>
                        <TH id="sessions">{t('crm.trafficPage.col.sessions')}</TH>
                        <TH id="leads">{L}</TH>
                        <TH id="cost">{t('crm.trafficPage.col.cost')}</TH>
                        <TH id="revenue">{R}</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {camps.slice(0, CAMPAIGNS_LIMIT).map((c, i) => (
                        <tr key={i}>
                          <td className="tr-camp" title={c.campaign}>
                            {c.campaign}
                          </td>
                          {multiAcc && <td className="tr-sm">{c.account}</td>}
                          <td className="r">{c.impressions ? nf(c.impressions) : <Dash />}</td>
                          <td className="r">{c.clicks ? nf(c.clicks) : <Dash />}</td>
                          <td className="r">{c.sessions ? nf(c.sessions) : <Dash />}</td>
                          <td className="r">{c.leads ? nf(Math.round(c.leads * 10) / 10) : <Dash />}</td>
                          <td className="r">{c.cost ? <Mu v={c.cost} /> : <Dash />}</td>
                          <td className="r pos">{c.revenue ? <Mu v={c.revenue} /> : <Dash />}</td>
                        </tr>
                      ))}
                    </tbody>
                    {camps.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={multiAcc ? 2 : 1}>
                            {t('crm.trafficPage.total')} · {camps.length}
                          </td>
                          <td className="r">{nf(T.impressions)}</td>
                          <td className="r">{nf(T.clicks)}</td>
                          <td className="r">{nf(T.sessions)}</td>
                          <td className="r">{nf(Math.round(T.leads * 10) / 10)}</td>
                          <td className="r">
                            <Mu v={T.cost} />
                          </td>
                          <td className="r pos">
                            <Mu v={T.rev} />
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  {camps.length === 0 && <div className="sm-empty">{t('crm.trafficPage.an.noCampaigns')}</div>}
                </div>
                {camps.length > CAMPAIGNS_LIMIT && (
                  <div className="an-more">{t('crm.trafficPage.an.shownFirst', { n: CAMPAIGNS_LIMIT, total: camps.length })}</div>
                )}
              </div>
            )}

            {tab === 'geo' && (
              <>
                <div className="sm-card">
                  <div className="sm-card-head">
                    <h3>{ds === 'meta_ads' ? t('crm.trafficPage.an.geoImpr') : t('crm.trafficPage.an.geoTraffic')}</h3>
                    <span className="meta">
                      {!geoFromApi
                        ? t('crm.trafficPage.an.geoInferred')
                        : ds === 'meta_ads'
                          ? t('crm.trafficPage.an.geoMeta')
                          : /^ga4/.test(ds)
                            ? t('crm.trafficPage.an.geoGa4')
                            : t('crm.trafficPage.an.geoCabinet')}
                    </span>
                  </div>
                  {geoLoading && geoTable.length === 0 ? (
                    <div className="sm-skel" style={{ height: 300, margin: 14 }} />
                  ) : mapRows.length === 0 ? (
                    <div className="sm-empty">{t('crm.trafficPage.an.geoEmpty')}</div>
                  ) : (
                    <GeoMap rows={mapRows} sel={country} onPick={geoFromApi ? setCountry : null} nameOf={countryName} nf={nf} />
                  )}
                </div>
                {geoTable.length > 0 && (
                  <div className="sm-card">
                    <div className="sm-table-scroll">
                      <table className="sm-table">
                        <thead>
                          <tr>
                            <th style={{ width: 28 }} />
                            <th>{t('crm.trafficPage.an.country')}</th>
                            <th className="r">{t('crm.trafficPage.col.impressions')}</th>
                            <th className="r">{t('crm.trafficPage.col.clicks')}</th>
                            <th className="r">{t('crm.trafficPage.col.sessions')}</th>
                            <th className="r">{t('crm.trafficPage.col.cost')}</th>
                            <th className="r">{t('crm.trafficPage.an.costShare')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {geoTable.map((g) => {
                            const det = detailsBy.get(g.key) ?? [];
                            const canOpen = det.length > 0;
                            const o = openC === g.key;
                            const gc = geoCost(g);
                            return (
                              <React.Fragment key={g.key}>
                                <tr
                                  className={cl('tr-row', o && 'open', country === g.key && 'an-hl')}
                                  onClick={() => canOpen && setOpenC(o ? null : g.key)}
                                  style={canOpen ? undefined : { cursor: 'default' }}
                                >
                                  <td>{canOpen && <span className="tr-chev"><Ic d={TI.chev} size={13} /></span>}</td>
                                  <td>
                                    <b style={{ fontWeight: 600 }}>{countryName(g.key)}</b>
                                    {g.key !== '-' && (
                                      <span className="tr-sm" style={{ marginLeft: 8 }}>
                                        {g.key}
                                      </span>
                                    )}
                                  </td>
                                  <td className="r">{g.impressions ? nf(g.impressions) : <Dash />}</td>
                                  <td className="r">{g.clicks ? nf(g.clicks) : <Dash />}</td>
                                  <td className="r">{g.sessions ? nf(g.sessions) : <Dash />}</td>
                                  <td className="r">{gc ? <Mu v={gc} /> : <Dash />}</td>
                                  <td className="r">
                                    {gc && geoCostTotal ? (
                                      <div className="tr-share" style={{ justifyContent: 'flex-end' }}>
                                        <span className="tr-bar" style={{ width: 64 }}>
                                          <i style={{ width: `${(gc / geoCostTotal) * 100}%` }} />
                                        </span>
                                        {((gc / geoCostTotal) * 100).toFixed(1)}%
                                      </div>
                                    ) : (
                                      <Dash />
                                    )}
                                  </td>
                                </tr>
                                {o && (
                                  <tr className="tr-open">
                                    <td colSpan={7}>
                                      <div className="an-nest">
                                        {[...det]
                                          .sort((a, b) => (b.cost || 0) - (a.cost || 0) || (b.sessions || 0) - (a.sessions || 0))
                                          .slice(0, 12)
                                          .map((c, i) => (
                                            <div key={i} className="an-nest-r">
                                              <span className="t" title={c.campaign ?? ''}>
                                                {dimLabel(t, c.campaign)}
                                                {multiAcc && c.integrationId ? ` · ${accountLabel(c.integrationId)}` : ''}
                                              </span>
                                              <span>{t('crm.trafficPage.an.imprShort', { v: nf(c.impressions || 0) })}</span>
                                              <span>
                                                {c.clicks
                                                  ? t('crm.trafficPage.an.clicksShort', { v: nf(c.clicks) })
                                                  : t('crm.trafficPage.an.sessShort', { v: nf(c.sessions || 0) })}
                                              </span>
                                              <span>{c.cost ? money(conv(c.cost, c.currency || provCur)) : '—'}</span>
                                            </div>
                                          ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'accounts' && byAcc.length > 0 && (
              <div className="sm-card">
                <div className="sm-table-scroll">
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th style={{ width: 28 }} />
                        <th>{t('crm.trafficPage.account')}</th>
                        <th className="r">{t('crm.trafficPage.an.campaignsCount')}</th>
                        <th className="r">{t('crm.trafficPage.col.impressions')}</th>
                        <th className="r">{t('crm.trafficPage.col.clicks')}</th>
                        <th className="r">{L}</th>
                        <th className="r">{t('crm.trafficPage.col.cost')}</th>
                        <th className="r">{t('crm.trafficPage.an.costShare')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byAcc.map((a) => {
                        const o = openA === a.id;
                        return (
                          <React.Fragment key={a.id || '-'}>
                            <tr className={cl('tr-row', o && 'open')} onClick={() => setOpenA(o ? null : a.id)}>
                              <td>
                                <span className="tr-chev">
                                  <Ic d={TI.chev} size={13} />
                                </span>
                              </td>
                              <td>
                                <b style={{ fontWeight: 600 }}>{accountLabel(a.id)}</b>
                              </td>
                              <td className="r">{a.camps}</td>
                              <td className="r">{nf(a.impressions)}</td>
                              <td className="r">{nf(a.clicks)}</td>
                              <td className="r">{nf(Math.round(a.leads * 10) / 10)}</td>
                              <td className="r">
                                <Mu v={a.cost} />
                              </td>
                              <td className="r">
                                <div className="tr-share" style={{ justifyContent: 'flex-end' }}>
                                  <span className="tr-bar" style={{ width: 64 }}>
                                    <i style={{ width: `${(a.cost / accCostTotal) * 100}%` }} />
                                  </span>
                                  {((a.cost / accCostTotal) * 100).toFixed(1)}%
                                </div>
                              </td>
                            </tr>
                            {o && (
                              <tr className="tr-open">
                                <td colSpan={8}>
                                  <div className="an-nest">
                                    {[...a.rs]
                                      .sort((x, y) => (y.cost || 0) - (x.cost || 0))
                                      .slice(0, 30)
                                      .map((c, i) => (
                                        <div key={i} className="an-nest-r">
                                          <span className="t">{dimLabel(t, c.campaign)}</span>
                                          <span>{t('crm.trafficPage.an.imprShort', { v: nf(c.impressions || 0) })}</span>
                                          <span>{t('crm.trafficPage.an.clicksShort', { v: nf(c.clicks || 0) })}</span>
                                          <span>{money(conv(c.cost || 0, curOf(c)))}</span>
                                        </div>
                                      ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ads && <div className="tr-foot" style={{ border: 0, padding: 0 }}>{t('crm.trafficPage.an.adsFoot')}</div>}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
};
