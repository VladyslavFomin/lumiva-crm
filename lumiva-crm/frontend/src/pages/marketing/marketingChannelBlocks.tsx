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

  const fmtMoney = (amount: number, fromCur?: string | null) => {
    const cur = (fromCur && String(fromCur).trim()) || 'EUR';
    const c = convertMarketingAmount(amount, cur, currencyMode, displayCurrency, rates);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch [content-visibility:auto]">
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

          const LINE = '#e7e7e7';
          const LINE3 = '#f0f0f0';
          const INK = '#222';
          const FG3 = '#888';

          const kpiItems = [
            { l: t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' }), v: formatNumber(agg.impressions), color: undefined },
            { l: t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики / просмотры' }), v: formatNumber(agg.clicks || agg.sessions), color: '#5a45a8' },
            { l: t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии / визиты' }), v: formatNumber(agg.sessions), color: undefined },
            { l: t('crm.marketingChannels.kpi.leads'), v: formatNumber(agg.leads), color: '#c08319' },
            { l: 'CTR', v: agg.ctrPct != null ? `${agg.ctrPct.toFixed(2)}%` : '—', color: undefined },
            { l: 'CPC', v: cpc != null && cpc > 0 ? `${formatMoney(cpc)} ${costConv.currency}${rateStar}` : '—', color: undefined },
            { l: 'CPM', v: cpm != null && cpm > 0 ? `${formatMoney(cpm)} ${costConv.currency}${rateStar}` : '—', color: undefined },
            { l: 'ROAS', v: roasCh != null && roasCh > 0 ? roasCh.toFixed(2) : '—', color: roasCh ? '#1f8a5e' : undefined },
            { l: 'CPL', v: cplCh != null && cplCh > 0 ? `${formatMoney(cplCh)} ${costConv.currency}${rateStar}` : '—', color: undefined },
          ];

          return (
            <div
              key={ds}
              className={`flex flex-col h-full min-h-0 bg-white overflow-hidden ${theme.topBorder} ${theme.cardShadow}`}
              style={{ borderRadius: 14, border: `1px solid ${LINE}`, transition: 'box-shadow .15s, transform .15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 28px -12px rgba(0,0,0,0.14)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              {/* Card head */}
              <div className={theme.headerBg} style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${LINE}` }}>
                {/* Logo badge */}
                <div style={{ width: 38, height: 38, borderRadius: 10, background: theme.brandColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0, fontFamily: 'Inter Tight, sans-serif' }}>
                  {theme.logo}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: INK }}>
                    {marketingDataSourceLabel(t, ds, dataSourceLabels)}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: FG3, marginTop: 2, letterSpacing: '0.02em' }}>
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
                  style={{ padding: '6px 13px', border: `1px solid ${LINE}`, background: '#fff', color: INK, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .12s', flexShrink: 0 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = INK; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = LINE; }}
                >
                  {t('crm.marketingChannelBlocks.moreDetails', { defaultValue: 'Details' })}
                </button>
              </div>

              {ds === 'unknown' && (
                <div className={`mx-4 mt-3 ${marketingWarnBanner} !text-[10px] !leading-relaxed`}>
                  {t('crm.marketingChannelBlocks.unknownExplain', {
                    defaultValue:
                      'Строки без поля канала (data source) в CRM: часто импорт из n8n/аналитики без тега интеграции. Показы и расходы здесь могут дублировать срез Meta/Google по сессиям без UTM — не складывайте с соседними колонками как «ещё одну рекламу».',
                  })}
                </div>
              )}

              {/* 9-KPI hairline grid (3×3) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {kpiItems.map((kpi, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRight: (idx + 1) % 3 !== 0 ? `1px solid ${LINE3}` : 'none',
                      borderBottom: `1px solid ${LINE3}`,
                    }}
                  >
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: FG3, fontWeight: 500 }}>
                      {kpi.l}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 600, color: kpi.color ?? (kpi.v === '—' ? '#b5b5b5' : INK), marginTop: 6, letterSpacing: '-0.02em' }}>
                      {kpi.v}
                    </div>
                  </div>
                ))}
              </div>

              {/* Spend + Revenue wide row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '13px 16px', borderRight: `1px solid ${LINE3}`, borderBottom: `1px solid ${LINE3}` }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: FG3, fontWeight: 500 }}>
                    {t('crm.marketingCampaigns.table.headers.cost')}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: INK, marginTop: 6, letterSpacing: '-0.02em' }}>
                    {fmtMoney(agg.cost, provCur)}
                  </div>
                </div>
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${LINE3}` }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: FG3, fontWeight: 500 }}>
                    {t('crm.marketingCampaigns.table.headers.revenue')}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: '#1f8a5e', marginTop: 6, letterSpacing: '-0.02em' }}>
                    {fmtMoney(agg.revenue, provCur)}
                  </div>
                </div>
              </div>

              {/* Campaigns mini-table */}
              <div style={{ borderTop: `1px solid ${LINE}`, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, fontWeight: 500 }}>
                  {t('crm.marketingChannelBlocks.topCampaigns', { defaultValue: 'Campaigns' })} · {top.length}
                </div>
                <div
                  className={`${marketingTableWrap} flex-1 max-h-[260px] flex flex-col`}
                  style={{ borderRadius: 0, border: 'none', borderTop: `1px solid ${LINE}` }}
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
