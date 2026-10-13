/**
 * Маркетинг · Трафик — показы, переходы, лиды и деньги по каналам за период.
 * Дизайн: claude.ai/design marketing-traffic.html (components/traffic-page.jsx).
 * Канал = dataSource строки отчёта; раскрытие строки — топ кампаний, иконка/кнопка — правая панель аналитики.
 */
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { fetchMarketingTraffic, type MarketingTrafficStats } from '../../api/marketing';
import { getLocale } from '../../i18n/utils';
import { marketingDataSourceLabel, marketingProviderFamilyLabel } from '../../utils/marketingDataSourceLabel';
import { cl, Ic } from '../contacts/CrmListShared';
import '../contacts/crm-lists-design.css';
import './smm-design.css';
import './traffic-design.css';
import { DateRangePicker, fromIsoDate, toIsoDate } from '../../components/ui/DateRangePicker';
import { useMarketingDisplayCurrencyPrefs } from './MarketingDisplayCurrencyToolbar';
import {
  MARKETING_ALLOWED_CURRENCIES,
  type MarketingDisplayCurrencyState,
} from './marketingDisplayCurrencyStorage';
import {
  marketingTrafficPresetRange,
  marketingTrafficPickerPresets,
  type MarketingTrafficPeriodPreset,
} from './marketingTrafficPeriod';
import { compareMarketingChannelDs, marketingChannelCardTheme } from './marketingChannelCardTheme';
import {
  Dash,
  TI,
  curOf,
  dimLabel,
  dominantCurrency,
  dsOf,
  isAdsSource,
  isEmptyDim,
  makeFormatters,
  moneyOf,
  sumMoney,
  sumRows,
  type CurCtx,
  type Money,
  type TrafficItem,
} from './trafficShared';
import { TrafficChannelDrawer } from './TrafficChannelDrawer';

type Range = { from?: string; to?: string };
type ShareKey = 'sessions' | 'leads' | 'cost' | 'revenue';
type DimKey = 'source' | 'medium' | 'campaign';
const SHARE_KEYS: ShareKey[] = ['sessions', 'leads', 'cost', 'revenue'];
const DIM_KEYS: DimKey[] = ['source', 'medium', 'campaign'];

/* ── валюта отчёта: поповер вместо отдельной строки и модалки ── */
const CurrencyPicker: React.FC<{
  state: MarketingDisplayCurrencyState;
  onChange: (s: MarketingDisplayCurrencyState) => void;
  present: string[];
  locale: string;
}> = ({ state, onChange, present, locale }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open]);
  const native = state.currencyMode === 'native';
  const choices = useMemo(() => {
    const list = state.availableDisplayCurrencies?.length ? state.availableDisplayCurrencies : [...MARKETING_ALLOWED_CURRENCIES];
    return [...new Set([state.displayCurrency, ...list])].sort();
  }, [state.availableDisplayCurrencies, state.displayCurrency]);
  const asOf = state.fxAsOf ? fromIsoDate(state.fxAsOf.slice(0, 10)) : null;
  const asOfLabel = asOf ? asOf.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) : null;
  const rateRows = present.filter((c) => c !== state.displayCurrency);
  return (
    <div className="tr-pop-wrap" ref={ref}>
      <button type="button" className={cl('tr-chipbtn', open && 'on')} onClick={() => setOpen(!open)} aria-expanded={open}>
        <Ic d={TI.coin} size={14} />
        {native ? (
          t('crm.trafficPage.cur.native')
        ) : (
          <>
            {t('crm.trafficPage.cur.inCurrency', { cur: state.displayCurrency })}
            {asOfLabel && <span className="mut">ECB · {asOfLabel}</span>}
          </>
        )}
        <Ic d={TI.down} size={12} />
      </button>
      {open && (
        <div className="tr-pop" role="dialog" aria-label={t('crm.trafficPage.cur.mode')}>
          <div className="l">{t('crm.trafficPage.cur.mode')}</div>
          <div className="sm-seg">
            <button type="button" className={!native ? 'active' : ''} onClick={() => onChange({ ...state, currencyMode: 'converted' })}>
              {t('crm.trafficPage.cur.single')}
            </button>
            <button type="button" className={native ? 'active' : ''} onClick={() => onChange({ ...state, currencyMode: 'native' })}>
              {t('crm.trafficPage.cur.asChannel')}
            </button>
          </div>
          {!native && (
            <>
              <div className="l">{t('crm.trafficPage.cur.report')}</div>
              <select
                className="sm-select"
                value={state.displayCurrency}
                onChange={(e) => onChange({ ...state, currencyMode: 'converted', displayCurrency: e.target.value, rates: {} })}
              >
                {choices.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {rateRows.length > 0 && (
                <div className="tr-rates">
                  {rateRows.map((c) => (
                    <div key={c}>
                      <span>1 {c}</span>
                      <b>
                        {state.rates[c] ? `${state.rates[c].toLocaleString(locale, { maximumFractionDigits: 4 })} ${state.displayCurrency}` : '—'}
                      </b>
                    </div>
                  ))}
                </div>
              )}
              <div className="foot">
                {asOf
                  ? t('crm.trafficPage.cur.footAsOf', {
                      date: asOf.toLocaleDateString(locale),
                      source: state.fxSource || 'ECB (Frankfurter)',
                    })
                  : t('crm.trafficPage.cur.footLoading')}{' '}
                {t('crm.trafficPage.cur.footRows')}
              </div>
            </>
          )}
          {native && <div className="foot">{t('crm.trafficPage.cur.footNative')}</div>}
        </div>
      )}
    </div>
  );
};

type Channel = {
  ds: string;
  rows: TrafficItem[];
  allRows: TrafficItem[];
  accounts: string[];
  account: string;
  agg: ReturnType<typeof sumRows>;
  cur: string;
  ads: boolean;
  /** Лиды CRM, у рекламных площадок — конверсии кабинета. */
  leads: number;
  cost: Money;
  /** Выручка CRM, у рекламных площадок — ценность конверсий. */
  rev: Money;
};

/* ── раскрытая строка канала ── */
const ChannelDetail: React.FC<{
  ch: Channel;
  ctx: CurCtx;
  fmt: ReturnType<typeof makeFormatters>;
  accountLabel: (id: string) => string;
  setAccount: (id: string) => void;
  onFull: () => void;
}> = ({ ch, ctx, fmt, accountLabel, setAccount, onFull }) => {
  const { t } = useTranslation();
  const { nf, mf } = fmt;
  const a = ch.agg;
  const cpc = a.clicks > 0 && ch.cost.v > 0 ? ch.cost.v / a.clicks : null;
  const cpm = a.impressions > 0 && ch.cost.v > 0 ? (ch.cost.v / a.impressions) * 1000 : null;
  const top = useMemo(
    () =>
      [...ch.rows]
        .sort((x, y) => y.cost - x.cost || y.impressions - x.impressions || y.sessions - x.sessions || y.leads - x.leads)
        .slice(0, 8),
    [ch.rows],
  );
  const lead = (x: TrafficItem) => (ch.ads ? x.conversions || 0 : x.leads);
  const rev = (x: TrafficItem) => (ch.ads ? x.conversionValue || 0 : x.revenue);
  const M = ({ v }: { v: number }) => (
    <>
      {mf(v)}
      <span className="u">{ch.cost.c}</span>
    </>
  );
  return (
    <div className="tr-detail">
      {ch.ds === 'unknown' && (
        <div className="sm-note warn" style={{ margin: 0 }}>
          <Ic d={TI.info} size={14} />
          <span className="sp">{t('crm.trafficPage.unknownNote')}</span>
        </div>
      )}
      <div className="tr-d-top">
        <div className="tr-mini">
          <div>
            <span>CPC</span>
            <b>{cpc ? <M v={cpc} /> : <Dash />}</b>
          </div>
          <div>
            <span>CPM</span>
            <b>{cpm ? <M v={cpm} /> : <Dash />}</b>
          </div>
          <div>
            <span>{t('crm.trafficPage.col.cost')}</span>
            <b>{ch.cost.v > 0 ? <M v={ch.cost.v} /> : <Dash />}</b>
          </div>
          <div>
            <span>{t('crm.trafficPage.dataRows')}</span>
            <b>{nf(ch.rows.length)}</b>
          </div>
        </div>
        <div className="tr-d-acts">
          {ch.accounts.length > 1 && (
            <select className="sm-select" value={ch.account} onChange={(e) => setAccount(e.target.value)} aria-label={t('crm.trafficPage.account')}>
              <option value="">{t('crm.trafficPage.allAccounts', { count: ch.accounts.length })}</option>
              {ch.accounts.map((id) => (
                <option key={id} value={id}>
                  {accountLabel(id)}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-sm btn-primary" onClick={onFull}>
            <Ic d={TI.chart} size={13} />
            {t('crm.trafficPage.fullBtn')}
          </button>
        </div>
      </div>
      <div className="tr-d-table">
        <table className="sm-table">
          <thead>
            <tr>
              <th>{t('crm.trafficPage.col.campaign')}</th>
              <th>{t('crm.trafficPage.col.sourceMedium')}</th>
              <th className="r">{t('crm.trafficPage.col.impressions')}</th>
              <th className="r">{t('crm.trafficPage.col.clicks')}</th>
              <th className="r">{t('crm.trafficPage.col.sessions')}</th>
              <th className="r">{ch.ads ? t('crm.trafficPage.col.conversions') : t('crm.trafficPage.col.leads')}</th>
              <th className="r">{t('crm.trafficPage.col.cost')}</th>
              <th className="r">{ch.ads ? t('crm.trafficPage.col.value') : t('crm.trafficPage.col.revenue')}</th>
            </tr>
          </thead>
          <tbody>
            {top.map((x, i) => {
              const c = moneyOf(ctx, x.cost, curOf(x));
              const r = moneyOf(ctx, rev(x), curOf(x));
              return (
                <tr key={i}>
                  <td className="tr-camp" title={x.campaign ?? ''}>
                    {dimLabel(t, x.campaign)}
                  </td>
                  <td className="tr-sm">
                    {dimLabel(t, x.source)} / {dimLabel(t, x.medium)}
                  </td>
                  <td className="r">{x.impressions ? nf(x.impressions) : <Dash />}</td>
                  <td className="r">{x.clicks ? nf(x.clicks) : <Dash />}</td>
                  <td className="r">{x.sessions ? nf(x.sessions) : <Dash />}</td>
                  <td className="r">{lead(x) ? nf(lead(x)) : <Dash />}</td>
                  <td className="r">
                    {x.cost ? (
                      <>
                        {mf(c.v)}
                        <span className="u">{c.c}{c.miss ? '*' : ''}</span>
                      </>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className="r pos">
                    {rev(x) ? (
                      <>
                        {mf(r.v)}
                        <span className="u">{r.c}{r.miss ? '*' : ''}</span>
                      </>
                    ) : (
                      <Dash />
                    )}
                  </td>
                </tr>
              );
            })}
            {top.length === 0 && (
              <tr>
                <td colSpan={8} className="tr-na">
                  {t('crm.trafficPage.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TrafficPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const fmt = useMemo(() => makeFormatters(locale), [locale]);
  const { nf, mf, mk } = fmt;

  const [preset, setPreset] = useState<MarketingTrafficPeriodPreset>('30d');
  const [range, setRange] = useState<Range>(() => marketingTrafficPresetRange('30d'));
  const [dataSource, setDataSource] = useState('');
  const [stats, setStats] = useState<MarketingTrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [accByDs, setAccByDs] = useState<Record<string, string>>({});
  const [share, setShare] = useState<ShareKey>('sessions');
  const [dim, setDim] = useState<DimKey>('source');
  const [full, setFull] = useState<string | null>(null);

  const periodLabel: Record<MarketingTrafficPeriodPreset, string> = {
    '7d': t('crm.marketingChannels.periods.7d'),
    '30d': t('crm.marketingChannels.periods.30d'),
    '90d': t('crm.marketingChannels.periods.90d'),
    custom: t('crm.marketingChannels.periods.custom'),
    all: t('crm.marketingChannels.periods.all'),
  };

  const applyPreset = (p: MarketingTrafficPeriodPreset) => {
    setPreset(p);
    if (p === 'all') setRange({});
    else if (p !== 'custom') setRange(marketingTrafficPresetRange(p));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchMarketingTraffic({ from: range.from, to: range.to, dataSource: dataSource || undefined, itemsLimit: 12_000 })
      .then((res) => {
        if (!alive) return;
        startTransition(() => {
          setStats(res);
          setLoadedAt(new Date());
        });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        console.error(e);
        setError(e instanceof Error ? e.message : t('crm.marketingChannels.errors.load'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- без t, чтобы не ловить лишние перезапросы
  }, [range.from, range.to, dataSource, reloadKey]);

  const items = useMemo(() => stats?.items ?? [], [stats]);
  const labels = stats?.dataSourceLabels;
  const integrationLabels = stats?.integrationLabels;
  const accountLabel = useCallback((id: string) => integrationLabels?.[id] || id, [integrationLabels]);
  const dsLabel = useCallback(
    (ds: string) => (ds === 'unknown' ? t('crm.trafficPage.unknownChannel') : marketingDataSourceLabel(t, ds, labels)),
    [t, labels],
  );

  const currenciesPresent = useMemo(() => {
    const s = new Set<string>(stats?.currenciesPresent ?? []);
    for (const it of items) if (it.cost || it.revenue || it.conversionValue) s.add(curOf(it));
    return [...s].sort();
  }, [stats, items]);
  const { state: curPrefs, setState: setCurPrefs } = useMarketingDisplayCurrencyPrefs(currenciesPresent);
  const ctx: CurCtx = useMemo(
    () => ({ mode: curPrefs.currencyMode, display: curPrefs.displayCurrency, rates: curPrefs.rates }),
    [curPrefs.currencyMode, curPrefs.displayCurrency, curPrefs.rates],
  );
  const native = ctx.mode === 'native';

  const dataSourceOptions = useMemo(() => {
    const list = [...(stats?.dataSources ?? [])].filter(Boolean);
    if (dataSource && !list.includes(dataSource)) list.push(dataSource);
    return list.sort(compareMarketingChannelDs);
  }, [stats?.dataSources, dataSource]);

  const channels: Channel[] = useMemo(() => {
    const g = new Map<string, TrafficItem[]>();
    for (const x of items) {
      const k = dsOf(x);
      const arr = g.get(k) ?? [];
      arr.push(x);
      g.set(k, arr);
    }
    return [...g.entries()]
      .sort((a, b) => compareMarketingChannelDs(a[0], b[0]))
      .map(([ds, allRows]) => {
        const accounts = [...new Set(allRows.map((x) => x.integrationId).filter((id): id is string => !!id))].sort((a, b) =>
          accountLabel(a).localeCompare(accountLabel(b)),
        );
        const picked = accByDs[ds] || '';
        const account = accounts.length > 1 && accounts.includes(picked) ? picked : '';
        const rows = account ? allRows.filter((x) => x.integrationId === account) : allRows;
        const agg = sumRows(rows);
        const ads = isAdsSource(ds);
        const cur = dominantCurrency(rows);
        const costS = sumMoney(ctx, rows, (x) => x.cost);
        const revS = sumMoney(ctx, rows, (x) => (ads ? x.conversionValue || 0 : x.revenue));
        return {
          ds,
          rows,
          allRows,
          accounts,
          account,
          agg,
          cur,
          ads,
          leads: ads ? agg.conversions : agg.leads,
          cost: { v: costS.v, c: costS.c ?? cur, miss: costS.miss || costS.c == null },
          rev: { v: revS.v, c: revS.c ?? cur, miss: revS.miss || revS.c == null },
        };
      });
  }, [items, accByDs, ctx, accountLabel]);

  /** Итоги: деньги в валюте отчёта; в режиме «как в канале» — разбивка по валютам. */
  const tot = useMemo(() => {
    const a = sumRows(items);
    const crm = items.filter((x) => !isAdsSource(dsOf(x)));
    const ads = items.filter((x) => isAdsSource(dsOf(x)));
    const cost = sumMoney(ctx, items, (x) => x.cost);
    const rev = sumMoney(ctx, crm, (x) => x.revenue);
    const cval = sumMoney(ctx, ads, (x) => x.conversionValue || 0);
    const split = (rows: TrafficItem[], pick: (x: TrafficItem) => number) => {
      const m = new Map<string, number>();
      for (const x of rows) {
        const v = pick(x);
        if (v) m.set(curOf(x), (m.get(curOf(x)) || 0) + v);
      }
      return [...m.entries()].sort((p, q) => q[1] - p[1]);
    };
    return {
      ...a,
      crmLeads: crm.reduce((s, x) => s + (x.leads || 0), 0),
      cost,
      rev,
      cval,
      costNat: split(items, (x) => x.cost),
      revNat: split(crm, (x) => x.revenue),
      costCurs: new Set(items.filter((x) => x.cost).map(curOf)).size,
    };
  }, [items, ctx]);
  const anyMiss = !native && (tot.cost.miss || tot.rev.miss || tot.cval.miss || channels.some((c) => c.cost.miss || c.rev.miss));

  const shareVal = (c: Channel) =>
    share === 'sessions' ? c.agg.sessions : share === 'leads' ? c.leads : share === 'cost' ? c.cost.v : c.rev.v;
  // В «как в канале» суммы в разных валютах — доли по деньгам несопоставимы.
  const shareComparable = !(native && (share === 'cost' || share === 'revenue') && new Set(channels.map((c) => c.cost.c)).size > 1);
  const shareMax = Math.max(1, ...channels.map(shareVal));
  const shareSum = channels.reduce((s, c) => s + shareVal(c), 0) || 1;

  const ranked = useMemo(() => {
    const m = new Map<string, { k: string; sessions: number; leads: number; rows: TrafficItem[] }>();
    for (const x of items) {
      if (isEmptyDim(x[dim])) continue;
      const k = dimLabel(t, x[dim]);
      const o = m.get(k) ?? { k, sessions: 0, leads: 0, rows: [] };
      o.sessions += x.sessions || 0;
      o.leads += x.leads || 0;
      if (!isAdsSource(dsOf(x))) o.rows.push(x);
      m.set(k, o);
    }
    const arr = [...m.values()].map((o) => ({ ...o, revenue: sumMoney(ctx, o.rows, (x) => x.revenue) }));
    arr.sort((a, b) =>
      dim === 'campaign' ? b.revenue.v - a.revenue.v || b.sessions - a.sessions : b.sessions - a.sessions || b.leads - a.leads,
    );
    return arr.slice(0, 8);
  }, [items, dim, ctx, t]);
  const rankVal = (x: (typeof ranked)[number]) => (dim === 'campaign' ? x.revenue.v : x.sessions);
  const rMax = Math.max(1, ...ranked.map(rankVal));

  const cpl = !native && tot.crmLeads > 0 && tot.cost.v > 0 ? tot.cost.v / tot.crmLeads : null;
  const roas = !native && tot.cost.v > 0 && tot.rev.v > 0 ? tot.rev.v / tot.cost.v : null;
  const ctrTot = tot.impressions > 0 && tot.clicks !== tot.impressions ? ((tot.clicks / tot.impressions) * 100).toFixed(2) + '%' : '—';
  const periodName = preset === 'custom' && range.from && range.to ? `${range.from} — ${range.to}` : periodLabel[preset].toLowerCase();

  const fullCh = full ? channels.find((c) => c.ds === full) : null;
  const syncLabel = loading
    ? t('crm.trafficPage.loading')
    : loadedAt
      ? t('crm.trafficPage.updatedAt', { time: loadedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
      : '';

  const MoneyBig = ({ m }: { m: { v: number; c: string | null; miss: boolean } }) => (
    <>
      {mk(m.v)}
      <span className="u">
        {m.c ?? ''}
        {m.miss ? '*' : ''}
      </span>
    </>
  );

  return (
    <MainLayout>
      <PageHelpButton topic="marketingTraffic" />
      <div className="px-scope smm-scope">
        <div className="sm-wrap tr">
          <div className="sm-head">
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('crm.trafficPage.kicker')}
              </div>
              <h1>{t('crm.trafficPage.title')}</h1>
              <div className="sub">{t('crm.trafficPage.subtitle')}</div>
            </div>
            <div className="sm-head-actions">
              <span className="sm-sync">{syncLabel}</span>
              <button type="button" className="btn btn-sm" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
                <Ic d={TI.refresh} size={13} />
                {t('crm.common.refresh', { defaultValue: 'Обновить' })}
              </button>
            </div>
          </div>

          <div data-tour="traffic-filters" className="sm-bar">
            <DateRangePicker
              value={{ from: fromIsoDate(range.from), to: fromIsoDate(range.to) }}
              presetId={preset === 'custom' ? null : preset}
              presets={marketingTrafficPickerPresets(periodLabel)}
              onChange={(v) => {
                if (v.presetId) return applyPreset(v.presetId as MarketingTrafficPeriodPreset);
                setPreset('custom');
                setRange({ from: v.from ? toIsoDate(v.from) : undefined, to: v.to ? toIsoDate(v.to) : undefined });
              }}
            />
            <select
              className="sm-select"
              value={dataSource}
              onChange={(e) => {
                setDataSource(e.target.value);
                if (e.target.value) setOpen(e.target.value);
              }}
              aria-label={t('crm.trafficPage.dataSource')}
            >
              <option value="">{t('crm.marketingTraffic.dataSourceAll')}</option>
              {dataSourceOptions.map((ds) => (
                <option key={ds} value={ds}>
                  {dsLabel(ds)}
                </option>
              ))}
            </select>
            <div className="sm-bar-spacer" />
            <CurrencyPicker state={curPrefs} onChange={setCurPrefs} present={currenciesPresent} locale={locale} />
          </div>

          {error && (
            <div className="sm-note err">
              <span className="sp">{error}</span>
              <button type="button" className="btn btn-sm" onClick={() => setReloadKey((k) => k + 1)}>
                {t('crm.trafficPage.retry')}
              </button>
            </div>
          )}

          {!stats && loading ? (
            <div aria-busy="true">
              <div className="sm-skel" style={{ height: 86, marginBottom: 16 }} />
              <div className="sm-skel" style={{ height: 320, marginBottom: 16 }} />
              <div className="sm-skel" style={{ height: 260 }} />
            </div>
          ) : stats ? (
            <div className={cl('tr-body', loading && 'is-loading')}>
              <div data-tour="traffic-kpis" className="sm-kpis tr-kpis">
                <div className="sm-kpi">
                  <span className="l">{t('crm.trafficPage.col.impressions')}</span>
                  <span className="v">{nf(tot.impressions)}</span>
                  <span className="note">CTR {ctrTot}</span>
                </div>
                <div className="sm-kpi">
                  <span className="l">{t('crm.trafficPage.col.clicks')}</span>
                  <span className="v">{nf(tot.clicks)}</span>
                  <span className="note">{t('crm.trafficPage.kpi.clicksNote')}</span>
                </div>
                <div className="sm-kpi">
                  <span className="l">{t('crm.trafficPage.col.sessions')}</span>
                  <span className="v">{nf(tot.sessions)}</span>
                  <span className="note">{t('crm.trafficPage.kpi.sessionsNote')}</span>
                </div>
                <div className="sm-kpi">
                  <span className="l">{t('crm.trafficPage.kpi.leads')}</span>
                  <span className="v">{nf(tot.crmLeads)}</span>
                  <span className="note">
                    {cpl ? `CPL ${mf(cpl)} ${ctx.display}` : t('crm.trafficPage.kpi.leadsNote')}
                  </span>
                </div>
                <div className="sm-kpi">
                  <span className="l">{t('crm.trafficPage.col.cost')}</span>
                  {native ? (
                    <span className={cl('v', tot.costNat.length > 1 && 'tr-split')}>
                      {tot.costNat.length === 0
                        ? '—'
                        : tot.costNat.map(([c, v]) => (
                            <span key={c}>
                              {mk(v)}
                              <span className="u">{c}</span>
                            </span>
                          ))}
                    </span>
                  ) : (
                    <span className="v">{tot.cost.v ? <MoneyBig m={tot.cost} /> : '—'}</span>
                  )}
                  <span className="note">{t('crm.trafficPage.kpi.currencies', { count: tot.costCurs })}</span>
                </div>
                <div className="sm-kpi">
                  <span className="l">{t('crm.trafficPage.kpi.revenue')}</span>
                  {native ? (
                    <span className={cl('v pos', tot.revNat.length > 1 && 'tr-split')}>
                      {tot.revNat.length === 0
                        ? '—'
                        : tot.revNat.map(([c, v]) => (
                            <span key={c}>
                              {mk(v)}
                              <span className="u">{c}</span>
                            </span>
                          ))}
                    </span>
                  ) : (
                    <span className="v pos">{tot.rev.v ? <MoneyBig m={tot.rev} /> : '—'}</span>
                  )}
                  <span className="note">
                    {roas ? `ROAS ${roas.toFixed(2)}` : '—'}
                    {!native && tot.cval.v > 0 && <> · {t('crm.trafficPage.kpi.platformValue', { v: `${mk(tot.cval.v)} ${ctx.display}` })}</>}
                  </span>
                </div>
              </div>

              <div className="sm-card">
                <div className="sm-card-head">
                  <h3>
                    {t('crm.trafficPage.channels')} <span className="tr-cnt">{channels.length}</span>
                  </h3>
                  <div className="sm-card-tools">
                    <span className="meta">{t('crm.trafficPage.shareBy')}</span>
                    <div data-tour="traffic-share" className="sm-seg">
                      {SHARE_KEYS.map((k) => (
                        <button type="button" key={k} className={share === k ? 'active' : ''} onClick={() => setShare(k)}>
                          {t(`crm.trafficPage.share.${k}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {channels.length === 0 ? (
                  <div className="sm-empty">
                    <b>{t('crm.trafficPage.emptyTitle')}</b>
                    {t('crm.trafficPage.emptyText')}
                  </div>
                ) : (
                  <div className="sm-table-scroll">
                    <table data-tour="traffic-table" className="sm-table tr-ch">
                      <thead>
                        <tr>
                          <th style={{ width: 28 }} />
                          <th>{t('crm.trafficPage.col.channel')}</th>
                          <th>{t('crm.trafficPage.col.share', { what: t(`crm.trafficPage.share.${share}`).toLowerCase() })}</th>
                          <th className="r">{t('crm.trafficPage.col.impressions')}</th>
                          <th className="r">{t('crm.trafficPage.col.clicks')}</th>
                          <th className="r">CTR</th>
                          <th className="r">{t('crm.trafficPage.col.sessions')}</th>
                          <th className="r">{t('crm.trafficPage.col.leads')}*</th>
                          <th className="r">{t('crm.trafficPage.col.cost')}</th>
                          <th className="r">CPL*</th>
                          <th className="r">{t('crm.trafficPage.col.revenue')}*</th>
                          <th className="r">ROAS</th>
                          <th style={{ width: 44 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map((c) => {
                          const theme = marketingChannelCardTheme(c.ds);
                          const a = c.agg;
                          const isOpen = open === c.ds;
                          const cplV = c.leads > 0 && c.cost.v > 0 ? c.cost.v / c.leads : null;
                          const roasV = c.cost.v > 0 && c.rev.v > 0 && c.cost.c === c.rev.c ? c.rev.v / c.cost.v : null;
                          const placeholder = c.ads && a.conversions > 0 && a.conversionValue > 0 && a.conversionValue / a.conversions < 10;
                          const sv = shareVal(c);
                          const toggle = () => setOpen(isOpen ? null : c.ds);
                          return (
                            <React.Fragment key={c.ds}>
                              <tr
                                className={cl('tr-row', isOpen && 'open')}
                                onClick={toggle}
                                tabIndex={0}
                                aria-expanded={isOpen}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggle();
                                  }
                                }}
                              >
                                <td>
                                  <span className="tr-chev">
                                    <Ic d={TI.chev} size={13} />
                                  </span>
                                </td>
                                <td>
                                  <div className="sm-prof">
                                    <span className="sm-ava" style={{ background: theme.brandColor }}>
                                      {theme.logo}
                                    </span>
                                    <div style={{ minWidth: 0 }}>
                                      <div className="nm">
                                        {dsLabel(c.ds)}
                                        {c.ads && <span className="tr-tag">{t('crm.trafficPage.adsTag')}</span>}
                                      </div>
                                      <div className="ur" title={c.ds}>
                                        {c.account
                                          ? accountLabel(c.account)
                                          : c.ds === 'unknown'
                                            ? t('crm.trafficPage.unknownSub')
                                            : marketingProviderFamilyLabel(c.ds)}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {shareComparable ? (
                                    <div className="tr-share">
                                      <span className="tr-bar">
                                        <i style={{ width: `${(sv / shareMax) * 100}%`, background: theme.brandColor }} />
                                      </span>
                                      <span>{sv > 0 ? `${Math.round((sv / shareSum) * 100)}%` : '—'}</span>
                                    </div>
                                  ) : (
                                    <Dash />
                                  )}
                                </td>
                                <td className="r">{a.impressions ? nf(a.impressions) : <Dash />}</td>
                                <td className="r">{a.clicks ? nf(a.clicks) : <Dash />}</td>
                                <td className="r">{a.ctr != null ? `${a.ctr.toFixed(2)}%` : <Dash />}</td>
                                <td className="r">{a.sessions ? nf(a.sessions) : <Dash />}</td>
                                <td className="r">{c.leads ? nf(Math.round(c.leads * 10) / 10) : <Dash />}</td>
                                <td className="r">{c.cost.v ? <MoneyBig m={c.cost} /> : <Dash />}</td>
                                <td className="r">
                                  {cplV ? (
                                    <>
                                      {mf(cplV)}
                                      <span className="u">{c.cost.c}</span>
                                    </>
                                  ) : (
                                    <Dash />
                                  )}
                                </td>
                                <td className="r pos">
                                  {c.rev.v ? (
                                    <>
                                      <MoneyBig m={c.rev} />
                                      {placeholder && (
                                        <span className="tr-cond" title={t('crm.trafficPage.condHint')}>
                                          {t('crm.trafficPage.cond')}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <Dash />
                                  )}
                                </td>
                                <td className="r">{roasV ? <b className={roasV >= 1 ? 'pos' : 'neg'}>{roasV.toFixed(2)}</b> : <Dash />}</td>
                                <td className="r">
                                  <button
                                    type="button"
                                    className="sm-ico"
                                    title={t('crm.trafficPage.fullTitle')}
                                    aria-label={t('crm.trafficPage.fullTitle')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFull(c.ds);
                                    }}
                                  >
                                    <Ic d={TI.chart} size={14} />
                                  </button>
                                </td>
                              </tr>
                              {isOpen && (
                                <tr className="tr-open">
                                  <td colSpan={13}>
                                    <ChannelDetail
                                      ch={c}
                                      ctx={ctx}
                                      fmt={fmt}
                                      accountLabel={accountLabel}
                                      setAccount={(id) => setAccByDs((p) => ({ ...p, [c.ds]: id }))}
                                      onFull={() => setFull(c.ds)}
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td />
                          <td>{t('crm.trafficPage.total')}</td>
                          <td />
                          <td className="r">{nf(tot.impressions)}</td>
                          <td className="r">{nf(tot.clicks)}</td>
                          <td className="r">{ctrTot}</td>
                          <td className="r">{nf(tot.sessions)}</td>
                          <td className="r">{nf(tot.crmLeads)}</td>
                          <td className="r">{native || !tot.cost.v ? '—' : <MoneyBig m={tot.cost} />}</td>
                          <td className="r">{cpl ? mf(cpl) : '—'}</td>
                          <td className="r pos">{native || !tot.rev.v ? '—' : <MoneyBig m={tot.rev} />}</td>
                          <td className="r">{roas ? roas.toFixed(2) : '—'}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <div className="tr-foot">
                  {t('crm.trafficPage.footAds')}
                  {anyMiss && <> {t('crm.marketingCurrency.missingRateFootnote')}</>}
                </div>
              </div>

              <div className="sm-card">
                <div className="sm-card-head">
                  <h3>{t('crm.trafficPage.whereFrom')}</h3>
                  <div className="sm-card-tools">
                    <div className="sm-seg">
                      {DIM_KEYS.map((k) => (
                        <button type="button" key={k} className={dim === k ? 'active' : ''} onClick={() => setDim(k)}>
                          {t(`crm.trafficPage.dims.${k}`)}
                        </button>
                      ))}
                    </div>
                    <span className="meta">
                      {dim === 'campaign' ? t('crm.trafficPage.byRevenue') : t('crm.trafficPage.bySessions')} · {periodName}
                    </span>
                  </div>
                </div>
                {ranked.length === 0 ? (
                  <div className="sm-empty">{t('crm.trafficPage.noData')}</div>
                ) : (
                  <div className="tr-rank">
                    <div className="tr-rank-h">
                      <span>#</span>
                      <span>{t(`crm.trafficPage.dim1.${dim}`)}</span>
                      <span className="r">{t('crm.trafficPage.col.sessions')}</span>
                      <span className="r">{t('crm.trafficPage.col.leads')}</span>
                      <span className="r">{t('crm.trafficPage.col.revenue')}</span>
                    </div>
                    {ranked.map((x, i) => (
                      <div className="tr-rank-r" key={x.k}>
                        <span className="n">{String(i + 1).padStart(2, '0')}</span>
                        <span className="k">
                          <span className="t" title={x.k}>
                            {x.k}
                          </span>
                          <span className="tr-bar">
                            <i style={{ width: `${(rankVal(x) / rMax) * 100}%` }} />
                          </span>
                        </span>
                        <span className="r">{x.sessions ? nf(x.sessions) : <Dash />}</span>
                        <span className="r">{x.leads ? nf(x.leads) : <Dash />}</span>
                        <span className="r pos">
                          {!x.revenue.v ? (
                            <Dash />
                          ) : x.revenue.c == null ? (
                            <span title={t('crm.trafficPage.mixedHint')}>{t('crm.marketingCurrency.mixedShort', { defaultValue: 'разн.' })}</span>
                          ) : (
                            <MoneyBig m={x.revenue} />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {fullCh && (
        <TrafficChannelDrawer
          ds={fullCh.ds}
          title={dsLabel(fullCh.ds)}
          rows={fullCh.allRows}
          dateFrom={range.from}
          dateTo={range.to}
          pageCur={curPrefs}
          integrationLabels={integrationLabels}
          account={fullCh.account}
          onAccountChange={(id) => setAccByDs((p) => ({ ...p, [fullCh.ds]: id }))}
          onClose={() => setFull(null)}
        />
      )}
    </MainLayout>
  );
};
