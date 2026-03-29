import React, { useEffect, useMemo, useState } from 'react';
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
  marketingEmptyBanner,
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
  marketingTableWrap,
  marketingTd,
  marketingTh,
  marketingThead,
  marketingTr,
  marketingWarnBanner,
} from './marketingPageChrome';

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
  const formatNumber = (v: number) =>
    v.toLocaleString(locale, { maximumFractionDigits: 0 });
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
    })
      .then((res) => {
        if (!alive) return;
        setStats(res);
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
  const providerBreakdown = view.providerBreakdown;
  const totalRows = view.totalRows;
  const totalImpressions = view.totalImpressions;
  const totalCost = view.totalCost;
  const formatMoney = (v: number) =>
    v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const topSources = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((row) => {
      const key = sanitizeMarketingDimension(row.source);
      map.set(key, (map.get(key) || 0) + (row.sessions || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [items]);

  const topMediums = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((row) => {
      const key = sanitizeMarketingDimension(row.medium);
      map.set(key, (map.get(key) || 0) + (row.sessions || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [items]);

  const topCampaigns = useMemo(() => {
    const map = new Map<string, { sessions: number; leads: number; revenue: number }>();
    items.forEach((row) => {
      const key = sanitizeMarketingDimension(row.campaign);
      const prev = map.get(key) || { sessions: 0, leads: 0, revenue: 0 };
      prev.sessions += row.sessions || 0;
      prev.leads += row.leads || 0;
      prev.revenue += row.revenue || 0;
      map.set(key, prev);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6);
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
                    {marketingDataSourceLabel(t, ds)}
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
                <div className={`${marketingKpiValue} text-emerald-600`}>
                  {formatNumber(view.totalRevenue || 0)} {currency}
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
                    {t('crm.marketingTraffic.extendedMetricsTitle', {
                      defaultValue: 'Расширенные метрики провайдеров',
                    })}
                  </div>
                  <div className={marketingSectionSub}>
                    {t('crm.marketingTraffic.extendedMetricsSubtitle', {
                      defaultValue:
                        'Сырые строки в БД и агрегаты по полю dataSource (Meta Ads, Яндекс.Метрика, GA4, Google Ads и т.д.).',
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
                  {totalCost > 0 && (
                    <span className="ml-3">
                      {t('crm.marketingTraffic.spendLabel', { defaultValue: 'Расход' })}:{' '}
                      <span className="font-semibold tabular-nums text-[#222222]">
                        {formatMoney(totalCost)} {currency}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              {providerBreakdown.length === 0 && totalRows > 0 ? (
                <div className={marketingWarnBanner}>
                  {t('crm.marketingTraffic.extendedMetricsMismatch', {
                    defaultValue:
                      `В ответе API есть ${totalRows} строк, но таблица разбивки пуста. Сделайте жёсткое обновление страницы (Ctrl+Shift+R) или проверьте, что открыта актуальная сборка фронта.`,
                  })}
                </div>
              ) : providerBreakdown.length === 0 ? (
                <div className={marketingEmptyBanner}>
                  {t('crm.marketingTraffic.extendedMetricsEmpty', {
                    defaultValue:
                      'Расширенных метрик пока нет: выполните синхронизацию интеграций (GA4, Яндекс.Метрика, Meta Ads, Google Ads) или расширьте период «Все время».',
                  })}
                </div>
              ) : (
                <div className={`${marketingTableWrap} overflow-x-auto min-w-0`}>
                  <table className="w-full min-w-[640px] text-left">
                    <thead className={marketingThead}>
                      <tr>
                        <th className={marketingTh}>
                          {t('crm.marketingTraffic.table.provider', { defaultValue: 'Провайдер' })}
                        </th>
                        <th className={`${marketingTh} text-right tabular-nums`}>
                          {t('crm.marketingTraffic.table.rows', { defaultValue: 'Строк' })}
                        </th>
                        <th className={`${marketingTh} text-right tabular-nums`}>
                          {t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии / визиты' })}
                        </th>
                        <th className={`${marketingTh} text-right tabular-nums`}>
                          {t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики / просмотры' })}
                        </th>
                        <th className={`${marketingTh} text-right tabular-nums`}>
                          {t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })}
                        </th>
                        <th className={`${marketingTh} text-right tabular-nums`}>
                          {t('crm.marketingTraffic.table.cost', { defaultValue: 'Расход' })}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerBreakdown.map((row, idx) => (
                        <tr key={`${row.dataSource}-${row.currency}-${idx}`} className={marketingTr}>
                          <td className={`${marketingTd} font-medium text-[#222222]`}>
                            {marketingDataSourceLabel(t, row.dataSource)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums`}>
                            {formatNumber(row.rowCount)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums`}>
                            {formatNumber(row.sessions)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums`}>
                            {formatNumber(row.clicks)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums`}>
                            {formatNumber(row.impressions)}
                          </td>
                          <td className={`${marketingTd} text-right tabular-nums font-medium text-[#222222]`}>
                            {formatMoney(row.cost)} {row.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

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
                        {formatNumber(value.revenue)} {currency}
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
