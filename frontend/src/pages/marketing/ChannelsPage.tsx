import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchMarketingTraffic, type MarketingTrafficStats } from '../../api/marketing';
import { getLocale } from '../../i18n/utils';

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

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMarketingTraffic({ from: range.from, to: range.to })
      .then((res) => setStats(res))
      .catch((e: any) => {
        console.error(e);
        setError(e?.message || t('crm.marketingChannels.errors.load'));
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const currency = stats?.currency || 'EUR';
  const items = stats?.items || [];

  const topSources = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((row) => {
      const key = (row.source || t('crm.marketingChannels.common.unknown')).toString();
      map.set(key, (map.get(key) || 0) + (row.sessions || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [items, t]);

  const topMediums = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((row) => {
      const key = (row.medium || t('crm.marketingChannels.common.none')).toString();
      map.set(key, (map.get(key) || 0) + (row.sessions || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [items, t]);

  const topCampaigns = useMemo(() => {
    const map = new Map<string, { sessions: number; leads: number; revenue: number }>();
    items.forEach((row) => {
      const key = (row.campaign || t('crm.marketingChannels.common.noCampaign')).toString();
      const prev = map.get(key) || { sessions: 0, leads: 0, revenue: 0 };
      prev.sessions += row.sessions || 0;
      prev.leads += row.leads || 0;
      prev.revenue += row.revenue || 0;
      map.set(key, prev);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6);
  }, [items, t]);

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingChannels.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingChannels.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingChannels.subtitle')}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
            <span className="text-[11px] text-slate-600 pl-1">
              {t('crm.marketingChannels.periodLabel')}
            </span>
            {(['7d', '30d', '90d', 'all'] as PeriodPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={
                  'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                  (preset === p
                    ? 'bg-black text-white font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.2)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                }
              >
                {periodLabel[p]}
              </button>
            ))}
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-400">
            {t('crm.marketingChannels.loading')}
          </div>
        )}

        {error && <div className="text-[11px] text-red-400">{error}</div>}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingChannels.kpi.sessions')}
                </div>
                <div className="text-2xl font-semibold text-slate-50 mt-2">
                  {formatNumber(stats?.totalSessions || 0)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.marketingChannels.kpi.sessionsHint')}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingChannels.kpi.leads')}
                </div>
                <div className="text-2xl font-semibold text-slate-50 mt-2">
                  {formatNumber(stats?.totalLeads || 0)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.marketingChannels.kpi.leadsHint')}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {t('crm.marketingChannels.kpi.revenue')}
                </div>
                <div className="text-2xl font-semibold text-emerald-300 mt-2">
                  {formatNumber(stats?.totalRevenue || 0)} {currency}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.marketingChannels.kpi.revenueHint')}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-200 font-semibold mb-3">
                  {t('crm.marketingChannels.topSources')}
                </div>
                <div className="space-y-2 text-[11px]">
                  {topSources.map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between text-slate-300">
                      <span>{name}</span>
                      <span className="text-slate-100">{formatNumber(value)}</span>
                    </div>
                  ))}
                  {topSources.length === 0 && (
                    <div className="text-slate-500">
                      {t('crm.marketingChannels.common.noData')}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-200 font-semibold mb-3">
                  {t('crm.marketingChannels.topMediums')}
                </div>
                <div className="space-y-2 text-[11px]">
                  {topMediums.map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between text-slate-300">
                      <span>{name}</span>
                      <span className="text-slate-100">{formatNumber(value)}</span>
                    </div>
                  ))}
                  {topMediums.length === 0 && (
                    <div className="text-slate-500">
                      {t('crm.marketingChannels.common.noData')}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-200 font-semibold mb-3">
                  {t('crm.marketingChannels.topCampaigns')}
                </div>
                <div className="space-y-2 text-[11px]">
                  {topCampaigns.map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between text-slate-300">
                      <span className="truncate">{name}</span>
                      <span className="text-emerald-300">
                        {formatNumber(value.revenue)} {currency}
                      </span>
                    </div>
                  ))}
                  {topCampaigns.length === 0 && (
                    <div className="text-slate-500">
                      {t('crm.marketingChannels.common.noData')}
                    </div>
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
