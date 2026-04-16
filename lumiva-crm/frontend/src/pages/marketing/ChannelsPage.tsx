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
  marketingChipActive,
  marketingChipInactive,
  marketingFilterBar,
  marketingFilterLabel,
  marketingH1,
  marketingKicker,
  marketingKpiHint,
  marketingKpiLabel,
  marketingKpiStripeBrand,
  marketingKpiStripeDuo,
  marketingKpiStripeEmerald,
  marketingKpiStripeViolet,
  marketingKpiValue,
  marketingLead,
  marketingMetaLine,
  marketingPageShell,
  marketingSectionSub,
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

type PeriodPreset = '7d' | '30d' | '90d' | 'all';

interface DateRange {
  from?: string;
  to?: string;
}

export const ChannelsPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [dataSource, setDataSource] = useState('');
  const [stats, setStats] = useState<MarketingTrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const formatNumber = useCallback(
    (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 0 }),
    [locale],
  );
  const periodLabel: Record<PeriodPreset, string> = {
    '7d': t('crm.marketingChannels.periods.7d'),
    '30d': t('crm.marketingChannels.periods.30d'),
    '90d': t('crm.marketingChannels.periods.90d'),
    all: t('crm.marketingChannels.periods.all'),
  };

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);
    setDataSource('');

    if (p === 'all') {
      setRange({});
      return;
    }

    const today = new Date();
    const end = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const start = new Date(end);

    if (p === '7d') start.setUTCDate(end.getUTCDate() - 6);
    if (p === '30d') start.setUTCDate(end.getUTCDate() - 29);
    if (p === '90d') start.setUTCDate(end.getUTCDate() - 89);

    setRange({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
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

  return (
    <MainLayout>
      <div className={`${marketingPageShell} space-y-5 md:space-y-6 pb-2`}>
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className={marketingKicker}>{t('crm.marketingChannels.kicker')}</div>
            <h1 className={marketingH1}>{t('crm.marketingChannels.title')}</h1>
            <p className={marketingLead}>{t('crm.marketingChannels.subtitle')}</p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            <div className={`${marketingFilterBar} w-full md:w-auto md:justify-end`}>
              <span className={marketingFilterLabel}>{t('crm.marketingChannels.periodLabel')}</span>
              {(['7d', '30d', '90d', 'all'] as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={preset === p ? marketingChipActive : marketingChipInactive}
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>
            <div className={`${marketingFilterBar} items-center w-full md:w-auto md:justify-end`}>
              <span className={marketingFilterLabel}>
                {t('crm.marketingTraffic.dataSourceLabel')}
              </span>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className={marketingSelect}
              >
                <option value="">
                  {t('crm.marketingTraffic.dataSourceAll')}
                </option>
                {dataSourceOptions.map((ds) => (
                  <option key={ds} value={ds}>
                    {marketingDataSourceLabel(t, ds, view.dataSourceLabels)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-[#222222]/50">{t('crm.marketingChannels.loading')}</div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
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

            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className={marketingKpiStripeBrand}>
                <div className={marketingKpiLabel}>{t('crm.marketingChannels.kpi.sessions')}</div>
                <div className={marketingKpiValue}>{formatNumber(view.totalSessions || 0)}</div>
                <div className={marketingKpiHint}>{t('crm.marketingChannels.kpi.sessionsHint')}</div>
              </div>
              <div className={marketingKpiStripeViolet}>
                <div className={marketingKpiLabel}>{t('crm.marketingChannels.kpi.leads')}</div>
                <div className={`${marketingKpiValue} text-violet-600`}>
                  {formatNumber(view.totalLeads || 0)}
                </div>
                <div className={marketingKpiHint}>{t('crm.marketingChannels.kpi.leadsHint')}</div>
              </div>
              <div className={marketingKpiStripeEmerald}>
                <div className={marketingKpiLabel}>{t('crm.marketingChannels.kpi.revenue')}</div>
                <div className={`${marketingKpiValue} text-emerald-600 text-left leading-tight`}>
                  {kpiRevenue.kind === 'split' ? (
                    <span className="block text-base sm:text-lg font-semibold break-words">
                      {kpiRevenue.parts.map((p) => (
                        <span key={p.c} className="inline-block mr-2">
                          {formatMoney(p.v)} {p.c}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <>
                      {formatMoney(kpiRevenue.sum)}
                      {` ${kpiRevenue.cur}`}
                      {kpiRevenue.miss && curPrefs.currencyMode === 'converted' ? '*' : ''}
                    </>
                  )}
                </div>
                <div className={marketingKpiHint}>{t('crm.marketingChannels.kpi.revenueHint')}</div>
              </div>
              <div className={marketingKpiStripeDuo}>
                <div className={marketingKpiLabel}>
                  {t('crm.marketingTraffic.kpi.dbRows', {
                    defaultValue: 'Строк в БД (период)',
                  })}
                </div>
                <div className={marketingKpiValue}>{formatNumber(totalRows)}</div>
                <div className={marketingKpiHint}>
                  {t('crm.marketingTraffic.kpi.dbRowsHint', {
                    defaultValue: 'Сколько записей marketing_traffic попало в выборку',
                  })}
                </div>
              </div>
            </section>

            <section className={`${marketingCard} space-y-4`}>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className={marketingSectionTitle}>
                    {t('crm.marketingTraffic.summaryStripTitle', {
                      defaultValue: 'Сводка периода',
                    })}
                  </div>
                  <div className={marketingSectionSub}>
                    {t('crm.marketingTraffic.summaryStripSubtitle', {
                      defaultValue:
                        'Таблица — сводка по каждому источнику данных за период (строки в выборке и метрики). Валюта — как на панели выше. Детальные карточки каналов — ниже.',
                    })}
                  </div>
                </div>
                <div className={marketingMetaLine}>
                  {t('crm.marketingTraffic.rawRowsLabel', { defaultValue: 'Строк в периоде' })}:{' '}
                  <span className="font-semibold tabular-nums text-[#222222]">{formatNumber(totalRows)}</span>
                  {totalImpressions > 0 && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.impressionsLabel', { defaultValue: 'Показы' })}:{' '}
                      <span className="font-semibold tabular-nums text-[#222222]">
                        {formatNumber(totalImpressions)}
                      </span>
                    </span>
                  )}
                  {spendSummary && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.spendLabel', { defaultValue: 'Расход' })}:{' '}
                      <span className="font-semibold tabular-nums text-[#222222]">{spendSummary}</span>
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
            </section>

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
              title={t('crm.marketingChannelBlocks.title', { defaultValue: 'Каналы' })}
              subtitle={t('crm.marketingChannelBlocks.subtitleTraffic', {
                defaultValue:
                  'Отдельный блок на каждый источник данных (Яндекс, Meta, Google и т.д.): метрики и топ кампаний по расходу.',
              })}
            />

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={marketingCard}>
                <div className={`${marketingSectionTitle} mb-3`}>{t('crm.marketingChannels.topSources')}</div>
                <div className="space-y-2 text-[11px]">
                  {topSources.map(([name, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg border border-[#222222]/8 bg-slate-50/60 px-2.5 py-1.5 text-[#222222]/80"
                    >
                      <span>{labelSanitizedDimension(t, name, 'source')}</span>
                      <span className="font-semibold tabular-nums text-[#222222]">{formatNumber(value)}</span>
                    </div>
                  ))}
                  {topSources.length === 0 && (
                    <div className="text-[#222222]/45">{t('crm.marketingChannels.common.noData')}</div>
                  )}
                </div>
              </div>

              <div className={marketingCard}>
                <div className={`${marketingSectionTitle} mb-3`}>{t('crm.marketingChannels.topMediums')}</div>
                <div className="space-y-2 text-[11px]">
                  {topMediums.map(([name, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg border border-[#222222]/8 bg-slate-50/60 px-2.5 py-1.5 text-[#222222]/80"
                    >
                      <span>{labelSanitizedDimension(t, name, 'medium')}</span>
                      <span className="font-semibold tabular-nums text-[#222222]">{formatNumber(value)}</span>
                    </div>
                  ))}
                  {topMediums.length === 0 && (
                    <div className="text-[#222222]/45">{t('crm.marketingChannels.common.noData')}</div>
                  )}
                </div>
              </div>

              <div className={marketingCard}>
                <div className={`${marketingSectionTitle} mb-3`}>{t('crm.marketingChannels.topCampaigns')}</div>
                <div className="space-y-2 text-[11px]">
                  {topCampaigns.map(([name, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-lg border border-[#222222]/8 bg-slate-50/60 px-2.5 py-1.5 text-[#222222]/80"
                    >
                      <span className="truncate pr-2">
                        {labelSanitizedDimension(t, name, 'campaign')}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-emerald-600">
                        {formatMoney(value.revenue)}
                        {view.currency === 'MIXED' ? (
                          <span className="text-[9px] text-[#222222]/45 font-normal ml-1">
                            {t('crm.marketingCurrency.mixedShort', { defaultValue: 'разн. вал.' })}
                          </span>
                        ) : (
                          ` ${currency}`
                        )}
                      </span>
                    </div>
                  ))}
                  {topCampaigns.length === 0 && (
                    <div className="text-[#222222]/45">{t('crm.marketingChannels.common.noData')}</div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
};
