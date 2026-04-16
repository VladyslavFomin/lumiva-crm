import React, { useCallback, useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { MarketingTrafficProviderBreakdown } from '../../api/marketing';
import { marketingDataSourceLabel } from '../../utils/marketingDataSourceLabel';
import {
  marketingEmptyBanner,
  marketingTableWrap,
  marketingTd,
  marketingTh,
  marketingThNumeric,
  marketingThead,
  marketingTr,
} from './marketingPageChrome';
import { convertMarketingAmount, type MarketingCurrencyMode } from './marketingDisplayCurrencyStorage';

export type MarketingProviderBreakdownTableProps = {
  rows: MarketingTrafficProviderBreakdown[];
  dataSourceLabels?: Record<string, string>;
  currencyMode: MarketingCurrencyMode;
  displayCurrency: string;
  rates: Record<string, number>;
  formatNumber: (n: number) => string;
  formatMoney: (n: number) => string;
  t: TFunction;
};

export const MarketingProviderBreakdownTable: React.FC<MarketingProviderBreakdownTableProps> = ({
  rows,
  dataSourceLabels,
  currencyMode,
  displayCurrency,
  rates,
  formatNumber,
  formatMoney,
  t,
}) => {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0)),
    [rows],
  );

  const fmtMoneyCell = useCallback(
    (amount: number, fromCur: string) => {
      const c = convertMarketingAmount(amount, fromCur, currencyMode, displayCurrency, rates);
      if (c.missingRate && currencyMode === 'converted') {
        return `${formatMoney(c.value)} ${c.currency}*`;
      }
      return `${formatMoney(c.value)} ${c.currency}`;
    },
    [currencyMode, displayCurrency, rates, formatMoney],
  );

  if (!sorted.length) {
    return (
      <div className={marketingEmptyBanner}>
        {t('crm.marketingTraffic.summaryBreakdownEmpty', {
          defaultValue: 'Нет агрегата по каналам для выбранного периода.',
        })}
      </div>
    );
  }

  return (
    <div className={`${marketingTableWrap} max-h-[min(360px,48vh)] overflow-auto`}>
      <table className="w-full text-left border-separate border-spacing-0 min-w-[640px]">
        <thead className={`${marketingThead} sticky top-0 z-[1]`}>
          <tr>
            <th className={marketingTh}>
              {t('crm.marketingTraffic.summaryBreakdownChannel', { defaultValue: 'Канал (источник данных)' })}
            </th>
            <th className={marketingThNumeric}>
              {t('crm.marketingTraffic.summaryBreakdownRows', { defaultValue: 'Строк' })}
            </th>
            <th className={marketingThNumeric}>{t('crm.marketingTraffic.table.impressions', { defaultValue: 'Показы' })}</th>
            <th className={marketingThNumeric}>{t('crm.marketingTraffic.table.sessions', { defaultValue: 'Сессии' })}</th>
            <th className={marketingThNumeric}>{t('crm.marketingTraffic.table.clicks', { defaultValue: 'Клики' })}</th>
            <th className={marketingThNumeric}>{t('crm.marketingChannels.kpi.leads')}</th>
            <th className={marketingThNumeric}>{t('crm.marketingCampaigns.table.headers.cost')}</th>
            <th className={marketingThNumeric}>{t('crm.marketingCampaigns.table.headers.revenue')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.dataSource} className={marketingTr}>
              <td className={`${marketingTd} font-medium max-w-[200px]`}>
                <span className="block truncate" title={p.dataSource}>
                  {marketingDataSourceLabel(t, p.dataSource, dataSourceLabels)}
                </span>
              </td>
              <td className={`${marketingTd} text-right tabular-nums`}>{formatNumber(p.rowCount || 0)}</td>
              <td className={`${marketingTd} text-right tabular-nums`}>{formatNumber(p.impressions || 0)}</td>
              <td className={`${marketingTd} text-right tabular-nums`}>{formatNumber(p.sessions || 0)}</td>
              <td className={`${marketingTd} text-right tabular-nums`}>{formatNumber(p.clicks || 0)}</td>
              <td className={`${marketingTd} text-right tabular-nums text-violet-800/90`}>
                {formatNumber(p.leads || 0)}
              </td>
              <td className={`${marketingTd} text-right tabular-nums`}>{fmtMoneyCell(p.cost || 0, p.currency)}</td>
              <td className={`${marketingTd} text-right tabular-nums text-emerald-800/90`}>
                {fmtMoneyCell(p.revenue || 0, p.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
