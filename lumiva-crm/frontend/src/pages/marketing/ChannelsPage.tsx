import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import {
  fetchMarketingTraffic,
  normalizeMarketingTrafficStats,
  type MarketingTrafficStats,
} from '../../api/marketing';
import { getLocale } from '../../i18n/utils';
import { marketingDataSourceLabel } from '../../utils/marketingDataSourceLabel';
import {
  labelSanitizedDimension,
  sanitizeMarketingDimension,
} from '../../utils/marketingChannelDisplay';
import {
  marketingCard,
  marketingGrpTitle,
  marketingH1,
  marketingKicker,
  marketingKpiCell,
  marketingKpiLabel,
  marketingKpiValue,
  marketingLead,
  marketingPageShell,
  marketingSectionTitle,
  marketingSelect,
} from './marketingPageChrome';
import { MarketingChannelBlocks } from './marketingChannelBlocks';
import { MarketingProviderBreakdownTable } from './MarketingProviderBreakdownTable';
import {
  MarketingDisplayCurrencyToolbar,
  useMarketingDisplayCurrencyPrefs,
} from './MarketingDisplayCurrencyToolbar';
import { convertMarketingAmount } from './marketingDisplayCurrencyStorage';
import {
  marketingTrafficClampDateRange,
  marketingTrafficDefaultCustomRange,
  marketingTrafficPresetRange,
  marketingTrafficUtcTodayYmd,
  type MarketingTrafficPeriodPreset,
} from './marketingTrafficPeriod';

interface DateRange {
  from?: string;
  to?: string;
}

export const ChannelsPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [preset, setPreset] = useState<MarketingTrafficPeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [dataSource, setDataSource] = useState('');
  const [stats, setStats] = useState<MarketingTrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const formatNumber = useCallback(
    (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 0 }),
    [locale],
  );
  const periodLabel: Record<MarketingTrafficPeriodPreset, string> = {
    '7d': t('crm.marketingChannels.periods.7d'),
    '30d': t('crm.marketingChannels.periods.30d'),
    '90d': t('crm.marketingChannels.periods.90d'),
    custom: t('crm.marketingChannels.periods.custom'),
    all: t('crm.marketingChannels.periods.all'),
  };

  const applyPreset = (p: MarketingTrafficPeriodPreset) => {
    setPreset(p);
    setDataSource('');

    if (p === 'all') {
      setRange({});
      return;
    }

    if (p === 'custom') {
      setRange(marketingTrafficDefaultCustomRange());
      return;
    }

    setRange(marketingTrafficPresetRange(p));
  };

  useEffect(() => {
    applyPreset('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = useMemo(
    () => normalizeMarketingTrafficStats(stats ?? {}),
    [stats],
  );

  const dataSourceOptions = useMemo(() => {
    const list = [...(view.dataSources ?? [])];
    if (dataSource && !list.includes(dataSource)) list.push(dataSource);
    return list.sort((a, b) => a.localeCompare(b));
  }, [view.dataSources, dataSource]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchMarketingTraffic({
      from: range.from,
      to: range.to,
      dataSource: dataSource || undefined,
      itemsLimit: 12_000,
    })
      .then((res) => {
        if (!alive) return;
        startTransition(() => setStats(res));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        console.error(e);
        const msg =
          e instanceof Error ? e.message : t('crm.marketingChannels.errors.load');
        setError(msg);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // Язык менять не нужно — те же цифры; t только для текста ошибки.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- без t, чтобы не ловить лишние перезапросы
  }, [range.from, range.to, dataSource]);

  const currency = view.currency || 'EUR';
  const items = view.items;
  const deferredItemsForBlocks = useDeferredValue(items);
  const providerBreakdown = view.providerBreakdown;
  const totalRows = view.totalRows;
  const totalImpressions = view.totalImpressions;
  const totalCost = view.totalCost;
  const formatMoney = useCallback(
    (v: number) =>
      v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [locale],
  );

  const { state: curPrefs, setState: setCurPrefs } = useMarketingDisplayCurrencyPrefs(
    view.currenciesPresent ?? [],
  );

  const kpiRevenue = useMemo(() => {
    if (curPrefs.currencyMode === 'native' && view.currency === 'MIXED') {
      const by = new Map<string, number>();
      for (const p of providerBreakdown) {
        const c = (p.currency || 'EUR').toUpperCase().slice(0, 8);
        by.set(c, (by.get(c) || 0) + (p.revenue || 0));
      }
      const parts = [...by.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([c, v]) => ({ c, v }));
      return { kind: 'split' as const, parts, miss: false };
    }
    let sum = 0;
    let miss = false;
    for (const p of providerBreakdown) {
      const c = convertMarketingAmount(
        p.revenue || 0,
        p.currency,
        curPrefs.currencyMode,
        curPrefs.displayCurrency,
        curPrefs.rates,
      );
      if (c.missingRate) miss = true;
      sum += c.value;
    }
    const cur =
      curPrefs.currencyMode === 'converted'
        ? curPrefs.displayCurrency
        : currency;
    return { kind: 'single' as const, sum, cur, miss };
  }, [providerBreakdown, curPrefs, view.currency, currency]);

  const spendSummary = useMemo(() => {
    if (totalCost <= 0) return null;
    if (curPrefs.currencyMode === 'native') {
      return providerBreakdown
        .filter((p) => p.cost > 0)
        .map((p) => `${formatMoney(p.cost)} ${p.currency}`)
        .join(' · ');
    }
    let sum = 0;
    let miss = false;
    for (const p of providerBreakdown) {
      const c = convertMarketingAmount(
        p.cost,
        p.currency,
        'converted',
        curPrefs.displayCurrency,
        curPrefs.rates,
      );
      if (c.missingRate) miss = true;
      sum += c.value;
    }
    return `${formatMoney(sum)} ${curPrefs.displayCurrency}${miss ? '*' : ''}`;
  }, [totalCost, providerBreakdown, curPrefs, formatMoney]);

  const { topSources, topMediums, topCampaigns } = useMemo(() => {
    const srcMap = new Map<string, number>();
    const medMap = new Map<string, number>();
    const campMap = new Map<string, { sessions: number; leads: number; revenue: number }>();
    for (const row of items) {
      const sk = sanitizeMarketingDimension(row.source);
      srcMap.set(sk, (srcMap.get(sk) || 0) + (row.sessions || 0));
      const mk = sanitizeMarketingDimension(row.medium);
      medMap.set(mk, (medMap.get(mk) || 0) + (row.sessions || 0));
      const ck = sanitizeMarketingDimension(row.campaign);
      const prev = campMap.get(ck) || { sessions: 0, leads: 0, revenue: 0 };
      prev.sessions += row.sessions || 0;
      prev.leads += row.leads || 0;
      prev.revenue += row.revenue || 0;
      campMap.set(ck, prev);
    }
    const topSources = Array.from(srcMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const topMediums = Array.from(medMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const topCampaigns = Array.from(campMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6);
    return { topSources, topMediums, topCampaigns };
  }, [items]);

  const totalClicks = useMemo(
    () => items.reduce((s, r) => s + (r.clicks || 0), 0),
    [items],
  );

  const INK = '#222';
  const LINE = '#e7e7e7';
  const FG3 = '#888';
  const BG = '#fafafa';

  const btnIconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 13px',
    fontSize: 12.5,
    fontWeight: 500,
    borderRadius: 8,
    border: `1px solid ${LINE}`,
    background: '#fff',
    color: INK,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const segBtn = (active: boolean): React.CSSProperties => ({
    background: active ? '#fff' : 'none',
    border: 'none',
    padding: '6px 12px',
    fontSize: 12,
    color: active ? INK : FG3,
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: active ? 500 : 400,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
  });

  return (
    <MainLayout>
      <PageHelpButton topic="marketingTraffic" />
      <div className={`${marketingPageShell} space-y-5 md:space-y-6`}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <section style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div className={marketingKicker}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: INK, flexShrink: 0 }} />
                {t('crm.marketingChannels.kicker')}
              </div>
              <h1 className={marketingH1}>{t('crm.marketingChannels.title')}</h1>
              <p className={marketingLead}>{t('crm.marketingChannels.subtitle')}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={btnIconStyle}
                onClick={() => { applyPreset(preset); }}
              >
                ↺ {t('crm.common.refresh', { defaultValue: 'Обновить' })}
              </button>
            </div>
          </div>
        </section>

        {/* ── Toolbar ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Period segment */}
          <div style={{ display: 'inline-flex', background: BG, border: `1px solid ${LINE}`, borderRadius: 8, padding: 2 }}>
            {(['7d', '30d', '90d', 'custom', 'all'] as MarketingTrafficPeriodPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                style={segBtn(preset === p)}
              >
                {periodLabel[p]}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <>
              <input
                type="date"
                aria-label={t('crm.marketingChannels.periodDateFromAria', { defaultValue: 'Дата начала' })}
                className={`${marketingSelect} h-9`}
                value={range.from || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreset('custom');
                  setRange((r) => marketingTrafficClampDateRange({ from: v, to: r.to || marketingTrafficUtcTodayYmd() }));
                }}
              />
              <input
                type="date"
                aria-label={t('crm.marketingChannels.periodDateToAria', { defaultValue: 'Дата окончания' })}
                className={`${marketingSelect} h-9`}
                value={range.to || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setPreset('custom');
                  setRange((r) => marketingTrafficClampDateRange({ from: r.from || marketingTrafficUtcTodayYmd(), to: v }));
                }}
              />
            </>
          )}
          {/* DataSource */}
          <select
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value)}
            style={{ fontSize: 12, border: `1px solid ${LINE}`, borderRadius: 8, padding: '7px 10px', background: '#fff', color: INK, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <option value="">{t('crm.marketingTraffic.dataSourceAll')}</option>
            {dataSourceOptions.map((ds) => (
              <option key={ds} value={ds}>{marketingDataSourceLabel(t, ds, view.dataSourceLabels)}</option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          {!loading && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: FG3, letterSpacing: '0.04em' }}>
              {dataSourceOptions.length} {t('crm.marketingChannels.channelsCount', { defaultValue: 'КАНАЛА' })}
            </span>
          )}
        </div>

        {loading && (
          <div className="text-[11px]" style={{ color: FG3 }}>{t('crm.marketingChannels.loading')}</div>
        )}

        {error && (
          <div style={{ borderRadius: 10, border: '1px solid #f0c8cf', background: '#fbecef', padding: '10px 14px', fontSize: 12, color: '#9a1f31' }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <MarketingDisplayCurrencyToolbar
              currenciesPresent={view.currenciesPresent ?? []}
              state={curPrefs}
              onStateChange={setCurPrefs}
            />

            {/* ── KPI strip (6-col hairline) ──────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', border: `1px solid ${LINE}`, borderRadius: 12, background: '#fff', overflow: 'hidden' }}
              className="[&>*:nth-child(6n)]:border-r-0 max-xl:[grid-template-columns:repeat(3,1fr)] max-sm:[grid-template-columns:repeat(2,1fr)]"
            >
              <div className={marketingKpiCell}>
                <div className={marketingKpiLabel}>{t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })}</div>
                <div className={marketingKpiValue}>{formatNumber(totalImpressions)}</div>
              </div>
              <div className={marketingKpiCell}>
                <div className={marketingKpiLabel}>{t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' })}</div>
                <div className={marketingKpiValue}>{formatNumber(view.totalSessions || 0)}</div>
              </div>
              <div className={marketingKpiCell}>
                <div className={marketingKpiLabel}>{t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' })}</div>
                <div className={`${marketingKpiValue} text-[#5a45a8]`}>{formatNumber(totalClicks)}</div>
              </div>
              <div className={marketingKpiCell}>
                <div className={marketingKpiLabel}>{t('crm.marketingChannels.kpi.leads')}</div>
                <div className={`${marketingKpiValue} text-[#c08319]`}>{formatNumber(view.totalLeads || 0)}</div>
              </div>
              <div className={marketingKpiCell}>
                <div className={marketingKpiLabel}>{t('crm.marketingTraffic.spendLabel', { defaultValue: 'Расходы' })}</div>
                <div className={marketingKpiValue}>
                  {spendSummary ? spendSummary : '—'}
                </div>
              </div>
              <div className={marketingKpiCell} style={{ borderRight: 0 }}>
                <div className={marketingKpiLabel}>{t('crm.marketingChannels.kpi.revenue')}</div>
                <div className={`${marketingKpiValue} !text-[16px] text-[#1f8a5e] leading-snug`}>
                  {kpiRevenue.kind === 'split' ? (
                    kpiRevenue.parts.map((p) => (
                      <span key={p.c} className="block">
                        {formatMoney(p.v)} <span style={{ fontSize: 11, color: FG3, fontWeight: 500 }}>{p.c}</span>
                      </span>
                    ))
                  ) : (
                    <>
                      {formatMoney(kpiRevenue.sum)}
                      <span style={{ fontSize: 11, color: FG3, fontWeight: 500, marginLeft: 4 }}>
                        {kpiRevenue.cur}
                        {kpiRevenue.miss && curPrefs.currencyMode === 'converted' ? '*' : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section: Каналы ────────────────────────────────── */}
            <div className={marketingGrpTitle}>
              {t('crm.marketingChannelBlocks.title', { defaultValue: 'Каналы' })}
              <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
            </div>

            <MarketingChannelBlocks
              items={deferredItemsForBlocks}
              t={t}
              currencyMode={curPrefs.currencyMode}
              displayCurrency={curPrefs.displayCurrency}
              rates={curPrefs.rates}
              formatNumber={formatNumber}
              formatMoney={formatMoney}
              dataSourceLabels={view.dataSourceLabels}
              trafficDateFrom={range.from}
              trafficDateTo={range.to}
              title=""
              subtitle=""
            />

            {/* ── Section: Сводка ────────────────────────────────── */}
            <div className={marketingGrpTitle}>
              {t('crm.marketingTraffic.summaryStripTitle', { defaultValue: 'Сводка по каналам' })}
              <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
            </div>

            <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `1px solid ${LINE}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: INK }}>
                  {t('crm.marketingTraffic.summaryStripTitle', { defaultValue: 'Разбивка по источникам данных' })}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: FG3, letterSpacing: '0.04em' }}>
                  {t('crm.marketingTraffic.rawRowsLabel', { defaultValue: 'Строк' })}:{' '}
                  <span style={{ color: INK, fontWeight: 600 }}>{formatNumber(totalRows)}</span>
                  {totalImpressions > 0 && (
                    <span style={{ marginLeft: 12 }}>
                      {t('crm.marketingTraffic.impressionsLabel', { defaultValue: 'Показы' })}:{' '}
                      <span style={{ color: INK, fontWeight: 600 }}>{formatNumber(totalImpressions)}</span>
                    </span>
                  )}
                  {spendSummary && (
                    <span style={{ marginLeft: 12 }}>
                      {t('crm.marketingTraffic.spendLabel', { defaultValue: 'Расход' })}:{' '}
                      <span style={{ color: INK, fontWeight: 600 }}>{spendSummary}</span>
                    </span>
                  )}
                </div>
              </div>
              <MarketingProviderBreakdownTable
                rows={providerBreakdown}
                dataSourceLabels={view.dataSourceLabels}
                currencyMode={curPrefs.currencyMode}
                displayCurrency={curPrefs.displayCurrency}
                rates={curPrefs.rates}
                formatNumber={formatNumber}
                formatMoney={formatMoney}
                t={t}
              />
            </div>

            {/* ── Top sources / mediums / campaigns ───────────────── */}
            <div className={marketingGrpTitle}>
              {t('crm.marketingChannels.topSources', { defaultValue: 'Источники, площадки, кампании' })}
              <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
            </div>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={marketingCard} style={{ borderColor: LINE }}>
                <div className={`${marketingSectionTitle} mb-3`}>{t('crm.marketingChannels.topSources')}</div>
                <div className="space-y-2 text-[11px]">
                  {topSources.map(([name, value]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: BG }}>
                      <span style={{ color: INK }}>{labelSanitizedDimension(t, name, 'source')}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: INK }}>{formatNumber(value)}</span>
                    </div>
                  ))}
                  {topSources.length === 0 && <div style={{ color: FG3 }}>{t('crm.marketingChannels.common.noData')}</div>}
                </div>
              </div>

              <div className={marketingCard} style={{ borderColor: LINE }}>
                <div className={`${marketingSectionTitle} mb-3`}>{t('crm.marketingChannels.topMediums')}</div>
                <div className="space-y-2 text-[11px]">
                  {topMediums.map(([name, value]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: BG }}>
                      <span style={{ color: INK }}>{labelSanitizedDimension(t, name, 'medium')}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: INK }}>{formatNumber(value)}</span>
                    </div>
                  ))}
                  {topMediums.length === 0 && <div style={{ color: FG3 }}>{t('crm.marketingChannels.common.noData')}</div>}
                </div>
              </div>

              <div className={marketingCard} style={{ borderColor: LINE }}>
                <div className={`${marketingSectionTitle} mb-3`}>{t('crm.marketingChannels.topCampaigns')}</div>
                <div className="space-y-2 text-[11px]">
                  {topCampaigns.map(([name, value]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: BG }}>
                      <span style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {labelSanitizedDimension(t, name, 'campaign')}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#1f8a5e', flexShrink: 0 }}>
                        {formatMoney(value.revenue)}
                        {view.currency === 'MIXED' ? (
                          <span style={{ fontSize: 9, color: FG3, fontWeight: 400, marginLeft: 4 }}>
                            {t('crm.marketingCurrency.mixedShort', { defaultValue: 'разн.' })}
                          </span>
                        ) : ` ${currency}`}
                      </span>
                    </div>
                  ))}
                  {topCampaigns.length === 0 && <div style={{ color: FG3 }}>{t('crm.marketingChannels.common.noData')}</div>}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
};
