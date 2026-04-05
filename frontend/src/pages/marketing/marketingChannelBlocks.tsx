import React, { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import type { MarketingTrafficStats } from '../../api/marketing';
import { marketingDataSourceLabel } from '../../utils/marketingDataSourceLabel';
import {
  formatMarketingChannelDimension,
  sanitizeMarketingDimension,
} from '../../utils/marketingChannelDisplay';
import {
  convertMarketingAmount,
  type MarketingCurrencyMode,
} from './marketingDisplayCurrencyStorage';
import {
  compareMarketingChannelDs,
  marketingChannelCardTheme,
} from './marketingChannelCardTheme';
import {
  marketingEmptyBanner,
  marketingSectionSub,
  marketingSectionTitle,
  marketingTableWrap,
  marketingTd,
  marketingTh,
  marketingThNumeric,
  marketingThead,
  marketingTr,
  marketingWarnBanner,
} from './marketingPageChrome';
import { MarketingChannelAnalyticsModal } from './MarketingChannelAnalyticsModal';

type Item = MarketingTrafficStats['items'][number];

function groupByDataSource(items: Item[]): Map<string, Item[]> {
  const m = new Map<string, Item[]>();
  for (const it of items) {
    const ds = (it.dataSource || '').trim() || 'unknown';
    const arr = m.get(ds) ?? [];
    arr.push(it);
    m.set(ds, arr);
  }
  return m;
}

function sumMetrics(rows: Item[]) {
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
  /** Для GA4 «показы» = просмотры страниц (как клики) — отношение 1:1, не рекламный CTR. */
  const ctrPct =
    impressions > 0 && clicks !== impressions ? (clicks / impressions) * 100 : null;
  return { sessions, clicks, leads, revenue, cost, impressions, ctrPct };
}

function dominantCurrency(rows: Item[]): string {
  const cw: Record<string, number> = {};
  for (const r of rows) {
    const w = Math.abs(r.revenue) + Math.abs(r.cost) + 0.000_001;
    const c = (r.currency || 'EUR').toUpperCase().slice(0, 8);
    cw[c] = (cw[c] || 0) + w;
  }
  let provCur = 'EUR';
  let maxW = 0;
  for (const [c, w] of Object.entries(cw)) {
    if (w > maxW) {
      maxW = w;
      provCur = c;
    }
  }
  return provCur;
}

export type MarketingChannelBlocksProps = {
  items: Item[];
  t: TFunction;
  currencyMode: MarketingCurrencyMode;
  displayCurrency: string;
  rates: Record<string, number>;
  formatNumber: (n: number) => string;
  formatMoney: (n: number) => string;
  title: string;
  subtitle: string;
  dataSourceLabels?: Record<string, string>;
  /** Скрыть строки без dataSource (колонка «без канала») — только на странице кампаний. */
  unattributedControl?: {
    hidden: boolean;
    onChange: (next: boolean) => void;
  };
  /** Период страницы — для графика «по дням» в расширенной аналитике. */
  trafficDateFrom?: string;
  trafficDateTo?: string;
};

export const MarketingChannelBlocks: React.FC<MarketingChannelBlocksProps> = ({
  items,
  t,
  currencyMode,
  displayCurrency,
  rates,
  formatNumber,
  formatMoney,
  title,
  subtitle,
  dataSourceLabels,
  unattributedControl,
  trafficDateFrom,
  trafficDateTo,
}) => {
  const [detailModal, setDetailModal] = useState<null | { ds: string; title: string; rows: Item[] }>(
    null,
  );
  const hasUnattributed = useMemo(
    () => items.some((it) => !(it.dataSource ?? '').trim()),
    [items],
  );

  const baseItems = useMemo(() => {
    if (!unattributedControl?.hidden) return items;
    return items.filter((it) => (it.dataSource ?? '').trim().length > 0);
  }, [items, unattributedControl?.hidden]);

  const columns = useMemo(() => {
    const m = groupByDataSource(baseItems);
    return [...m.entries()].sort((a, b) => compareMarketingChannelDs(a[0], b[0]));
  }, [baseItems]);

  /** Сортировки и суммы по каналам только при смене данных, не при каждом рендере (курсы/валюта). */
  const columnPrepared = useMemo(
    () =>
      columns.map(([ds, rows]) => {
        const agg = sumMetrics(rows);
        const provCur = dominantCurrency(rows);
        const top = [...rows]
          .sort(
            (a, b) =>
              b.cost - a.cost ||
              b.impressions - a.impressions ||
              b.clicks - a.clicks ||
              b.sessions - a.sessions,
          )
          .slice(0, 8);
        return { ds, rows, agg, provCur, top };
      }),
    [columns],
  );

  const fmtMoney = (amount: number, fromCur: string) => {
    const c = convertMarketingAmount(amount, fromCur, currencyMode, displayCurrency, rates);
    if (c.missingRate && currencyMode === 'converted') {
      return `${formatMoney(c.value)} ${c.currency}*`;
    }
    return `${formatMoney(c.value)} ${c.currency}`;
  };

  if (!items.length) return null;

  if (!baseItems.length) {
    return (
      <section className="space-y-4">
        <div>
          <div className={marketingSectionTitle}>{title}</div>
          <div className={marketingSectionSub}>{subtitle}</div>
        </div>
        <p className={marketingEmptyBanner}>
          {t('crm.marketingChannelBlocks.allUnattributedHidden', {
            defaultValue:
              'Все строки скрыты: в выборке остались только записи без канала интеграции. Снимите фильтр ниже или задайте dataSource при импорте.',
          })}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className={marketingSectionTitle}>{title}</div>
          <div className={marketingSectionSub}>{subtitle}</div>
        </div>
        {unattributedControl && hasUnattributed && (
          <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-[#222222]/12 bg-white px-3 py-1.5 text-[11px] text-[#222222]/70 shadow-[0_4px_18px_rgba(34,34,34,0.06)] shrink-0">
            <input
              type="checkbox"
              className="rounded border-[#222222]/25 text-[#222222] focus:ring-[#222222]/20"
              checked={unattributedControl.hidden}
              onChange={(e) => unattributedControl.onChange(e.target.checked)}
            />
            {t('crm.marketingChannelBlocks.hideUnattributed', {
              defaultValue: 'Скрыть «без канала интеграции»',
            })}
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch [content-visibility:auto]">
        {columnPrepared.map(({ ds, rows, agg, provCur, top }) => {
          const theme = marketingChannelCardTheme(ds);
          const costConv = convertMarketingAmount(
            agg.cost,
            provCur,
            currencyMode,
            displayCurrency,
            rates,
          );
          const revConv = convertMarketingAmount(
            agg.revenue,
            provCur,
            currencyMode,
            displayCurrency,
            rates,
          );
          const cpc =
            agg.clicks > 0 && agg.cost > 0 ? costConv.value / agg.clicks : null;
          const cpm =
            agg.impressions > 0 && agg.cost > 0
              ? (costConv.value / agg.impressions) * 1000
              : null;
          const roasCh =
            costConv.value > 0 && revConv.value > 0 ? revConv.value / costConv.value : null;
          const cplCh =
            agg.leads > 0 && agg.cost > 0 ? costConv.value / agg.leads : null;
          const rateStar =
            costConv.missingRate && currencyMode === 'converted' ? '*' : '';

          const metricCell =
            'rounded-xl border px-2.5 py-2 bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]';

          return (
            <div
              key={ds}
              className={`flex flex-col h-full min-h-0 rounded-2xl border border-black/[0.07] bg-white overflow-hidden contain-layout ${theme.topBorder} ${theme.cardShadow}`}
            >
              <div className={`px-4 pt-4 pb-3 ${theme.headerBg}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold tracking-tight text-[#111827]">
                      {marketingDataSourceLabel(t, ds, dataSourceLabels)}
                    </div>
                    <div
                      className={`text-[10px] font-mono mt-1 inline-flex max-w-full truncate rounded-md border px-2 py-0.5 ${theme.pill}`}
                      title={ds}
                    >
                      {ds}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDetailModal({
                        ds,
                        title: marketingDataSourceLabel(t, ds, dataSourceLabels),
                        rows,
                      })
                    }
                    className="shrink-0 rounded-xl border border-[#222222]/18 bg-white px-3 py-1.5 text-[10px] font-semibold text-[#222222] shadow-[0_4px_14px_rgba(34,34,34,0.06)] transition hover:bg-slate-50"
                  >
                    {t('crm.marketingChannelBlocks.moreDetails', { defaultValue: 'Подробнее' })}
                  </button>
                </div>
                {ds === 'unknown' && (
                  <p className={`mt-3 ${marketingWarnBanner} !text-[10px] !leading-relaxed`}>
                    {t('crm.marketingChannelBlocks.unknownExplain', {
                      defaultValue:
                        'Строки без поля канала (data source) в CRM: часто импорт из n8n/аналитики без тега интеграции. Показы и расходы здесь могут дублировать срез Meta/Google по сессиям без UTM — не складывайте с соседними колонками как «ещё одну рекламу».',
                    })}
                  </p>
                )}
              </div>

              <div className="px-4 pb-2 flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 text-[11px]">
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })}
                    </div>
                    <div className="font-semibold tabular-nums text-[#111827] mt-0.5">
                      {formatNumber(agg.impressions)}
                    </div>
                  </div>
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' })}
                    </div>
                    <div className="font-semibold tabular-nums text-violet-700 mt-0.5">
                      {formatNumber(agg.clicks)}
                    </div>
                  </div>
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' })}
                    </div>
                    <div className="font-semibold tabular-nums text-[#111827] mt-0.5">
                      {formatNumber(agg.sessions)}
                    </div>
                  </div>
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingChannels.kpi.leads')}
                    </div>
                    <div className="font-semibold tabular-nums text-amber-800 mt-0.5">
                      {formatNumber(agg.leads)}
                    </div>
                  </div>
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingChannelBlocks.ctr', { defaultValue: 'CTR' })}
                    </div>
                    <div className="font-semibold tabular-nums text-[#111827] mt-0.5">
                      {agg.ctrPct != null ? `${agg.ctrPct.toFixed(2)}%` : '—'}
                    </div>
                  </div>
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingChannelBlocks.cpc', { defaultValue: 'CPC' })}
                    </div>
                    <div className="font-semibold tabular-nums text-[#111827] mt-0.5">
                      {cpc != null && cpc > 0
                        ? `${formatMoney(cpc)} ${costConv.currency}${rateStar}`
                        : '—'}
                    </div>
                  </div>
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingChannelBlocks.cpm', { defaultValue: 'CPM' })}
                    </div>
                    <div className="font-semibold tabular-nums text-[#111827] mt-0.5">
                      {cpm != null && cpm > 0
                        ? `${formatMoney(cpm)} ${costConv.currency}${rateStar}`
                        : '—'}
                    </div>
                  </div>
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingCampaigns.kpi.roas')}
                    </div>
                    <div className="font-semibold tabular-nums text-emerald-800 mt-0.5">
                      {roasCh != null && roasCh > 0 ? roasCh.toFixed(2) : '—'}
                    </div>
                  </div>
                  <div className={`${metricCell} border-[#222222]/8`}>
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingChannelBlocks.cplShort', { defaultValue: 'CPL' })}
                    </div>
                    <div className="font-semibold tabular-nums text-rose-700 mt-0.5">
                      {cplCh != null && cplCh > 0
                        ? `${formatMoney(cplCh)} ${costConv.currency}${rateStar}`
                        : '—'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
                  <div className="rounded-xl border border-[#222222]/10 bg-gradient-to-br from-white to-slate-50/50 px-3 py-2.5">
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingCampaigns.table.headers.cost')}
                    </div>
                    <div className="font-semibold tabular-nums text-[#111827] mt-0.5">
                      {fmtMoney(agg.cost, provCur)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#222222]/10 bg-gradient-to-br from-white to-emerald-50/30 px-3 py-2.5">
                    <div className="text-[#222222]/48 font-medium">
                      {t('crm.marketingCampaigns.table.headers.revenue')}
                    </div>
                    <div className="font-semibold tabular-nums text-emerald-800 mt-0.5">
                      {fmtMoney(agg.revenue, provCur)}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-[#222222]/50 mb-2 tracking-wide uppercase">
                  {t('crm.marketingChannelBlocks.topCampaigns', { defaultValue: 'Кампании' })}
                </div>
                <div
                  className={`${marketingTableWrap} flex-1 min-h-[180px] max-h-[280px] flex flex-col border-[#222222]/8`}
                >
                  <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                    <table className="w-max min-w-full text-left text-[11px] border-separate border-spacing-0">
                      <thead className={`${marketingThead} sticky top-0 z-[1]`}>
                        <tr>
                          <th
                            className={`${marketingTh} whitespace-normal align-bottom min-w-[140px] max-w-[220px] leading-tight`}
                          >
                            {t('crm.marketingCampaigns.table.headers.campaign')}
                          </th>
                          <th className={`${marketingThNumeric} tabular-nums align-bottom w-px`}>
                            {t('crm.marketingChannelBlocks.thImpressions', {
                              defaultValue: 'Показы',
                            })}
                          </th>
                          <th className={`${marketingThNumeric} tabular-nums align-bottom w-px`}>
                            {t('crm.marketingChannelBlocks.thClicks', {
                              defaultValue: 'Клики',
                            })}
                          </th>
                          <th className={`${marketingThNumeric} tabular-nums align-bottom w-px`}>
                            {t('crm.marketingChannelBlocks.thSessions', {
                              defaultValue: 'Сессии',
                            })}
                          </th>
                          <th className={`${marketingThNumeric} tabular-nums align-bottom w-px`}>
                            {t('crm.marketingChannelBlocks.thLeads', {
                              defaultValue: 'Лиды',
                            })}
                          </th>
                          <th className={`${marketingThNumeric} tabular-nums align-bottom w-px px-3`}>
                            {t('crm.marketingChannelBlocks.thCost', {
                              defaultValue: 'Расход',
                            })}
                          </th>
                          <th className={`${marketingThNumeric} tabular-nums align-bottom w-px px-3`}>
                            {t('crm.marketingChannelBlocks.thRevenue', {
                              defaultValue: 'Выручка',
                            })}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {top.map((row, idx) => (
                          <tr
                            key={`${ds}-${row.source ?? ''}-${row.medium ?? ''}-${row.campaign ?? ''}-${idx}`}
                            className={marketingTr}
                          >
                            <td
                              className={`${marketingTd} max-w-[200px] truncate font-medium text-[#111827]`}
                              title={formatMarketingChannelDimension(
                                t,
                                sanitizeMarketingDimension(row.campaign),
                                'campaign',
                              )}
                            >
                              {formatMarketingChannelDimension(
                                t,
                                sanitizeMarketingDimension(row.campaign),
                                'campaign',
                              )}
                            </td>
                            <td
                              className={`${marketingTd} text-right tabular-nums whitespace-nowrap px-2.5`}
                            >
                              {formatNumber(row.impressions || 0)}
                            </td>
                            <td
                              className={`${marketingTd} text-right tabular-nums whitespace-nowrap px-2.5`}
                            >
                              {formatNumber(row.clicks || 0)}
                            </td>
                            <td
                              className={`${marketingTd} text-right tabular-nums whitespace-nowrap px-2.5`}
                            >
                              {formatNumber(row.sessions || 0)}
                            </td>
                            <td
                              className={`${marketingTd} text-right tabular-nums whitespace-nowrap px-2.5`}
                            >
                              {formatNumber(row.leads || 0)}
                            </td>
                            <td
                              className={`${marketingTd} text-right tabular-nums font-medium whitespace-nowrap px-3`}
                            >
                              {fmtMoney(row.cost || 0, row.currency)}
                            </td>
                            <td
                              className={`${marketingTd} text-right tabular-nums text-emerald-800/90 whitespace-nowrap px-3`}
                            >
                              {fmtMoney(row.revenue || 0, row.currency)}
                            </td>
                          </tr>
                        ))}
                        {top.length === 0 && (
                          <tr className={marketingTr}>
                            <td colSpan={7} className={`${marketingTd} text-[#222222]/45`}>
                              {t('crm.marketingChannels.common.noData')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {currencyMode === 'converted' && (
        <p className="text-[10px] text-amber-800/85">
          {t('crm.marketingCurrency.missingRateFootnote', {
            defaultValue:
              '* Валюта строки не входит в EUR/GBP/TRY/RUB или курс ещё не подгрузился — сумма без пересчёта.',
          })}
        </p>
      )}

      {detailModal && (
        <MarketingChannelAnalyticsModal
          open
          onClose={() => setDetailModal(null)}
          dataSourceKey={detailModal.ds}
          channelTitle={detailModal.title}
          rows={detailModal.rows}
          dateFrom={trafficDateFrom}
          dateTo={trafficDateTo}
          currencyMode={currencyMode}
          displayCurrency={displayCurrency}
          rates={rates}
          formatNumber={formatNumber}
          formatMoney={formatMoney}
          t={t}
        />
      )}
    </section>
  );
};
