// src/pages/leads/LostLeadsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useTranslation } from 'react-i18next';
import {
  fetchLostLeadsStats,
  type LostLeadsStats,
  type LostLeadManagerStat,
  type LostLeadItem,
} from '../../api/leads';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

type PeriodPreset = '7d' | '30d' | '90d' | 'all';

interface DateRange {
  from?: string;
  to?: string;
}

const LOSS_COLORS = ['#f43f5e', '#fb7185', '#f97316', '#f59e0b', '#e11d48'];

function resolveLocale(lang: string) {
  if (lang === 'tr') return 'tr-TR';
  if (lang === 'en') return 'en-US';
  return 'ru-RU';
}

export const LostLeadsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [stats, setStats] = useState<LostLeadsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);

    if (p === 'all') {
      setRange({});
      return;
    }

    const today = new Date();
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
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

    fetchLostLeadsStats({
      from: range.from,
      to: range.to,
    })
      .then((res) => setStats(res))
      .catch((e: any) => {
        console.error(e);
        setError(e.message || t('crm.leads.lost.errors.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const managers: LostLeadManagerStat[] = stats?.byManager ?? [];
  const items: LostLeadItem[] = stats?.items ?? [];

  const chartData = useMemo(
    () => managers.map((m, idx) => ({ ...m, color: LOSS_COLORS[idx % LOSS_COLORS.length] })),
    [managers],
  );

  const currency = stats?.currency || 'EUR';

  const presetLabel = (p: PeriodPreset) => t(`crm.leads.lost.presets.${p}`);

  const ManagerTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload as LostLeadManagerStat;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-md">
        <div className="font-medium">{label}</div>
        <div className="mt-1 flex flex-col gap-0.5">
          <span>{t('crm.leads.lost.tooltip.lost', { count: row.lost })}</span>
          <span>
            {t('crm.leads.lost.tooltip.amount', {
              amount: row.amount.toLocaleString(locale),
              currency,
            })}
          </span>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <PageHelpButton topic="leadsLost" />
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + пресеты */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.leads.lost.sectionLabel')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-lumiva-accent">
              {t('crm.leads.lost.title')}
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              {t('crm.leads.lost.subtitle')}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1">
            <span className="text-[11px] text-slate-600 pl-1">
              {t('crm.leads.lost.periodLabel')}
            </span>
            {(['7d', '30d', '90d', 'all'] as PeriodPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={
                  'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                  (preset === p
                    ? 'bg-rose-500 text-white font-semibold shadow-[0_10px_30px_rgba(244,63,94,0.25)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                }
              >
                {presetLabel(p)}
              </button>
            ))}
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-500">
            {t('crm.leads.lost.loading')}
          </div>
        )}

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {!loading && !error && stats && (
          <>
            {/* KPI */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {t('crm.leads.lost.kpi.lostTitle')}
                </div>
                <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
                  {stats.totalLost.toLocaleString(locale)}
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  {t('crm.leads.lost.kpi.lostHint')}
                </p>
              </div>

              <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-4 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.18em] text-rose-600">
                  {t('crm.leads.lost.kpi.amountTitle')}
                </div>
                <div className="mt-1 text-2xl font-semibold text-rose-600">
                  {stats.totalAmount.toLocaleString(locale, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}{' '}
                  {currency}
                </div>
                <p className="mt-1 text-[11px] text-rose-600/80">
                  {t('crm.leads.lost.kpi.amountHint')}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {t('crm.leads.lost.kpi.managersTitle')}
                </div>
                <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
                  {managers.length}
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  {t('crm.leads.lost.kpi.managersHint')}
                </p>
              </div>
            </section>

            {/* График + таблица по менеджерам */}
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 md:gap-5">
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-lumiva-accent">
                      {t('crm.leads.lost.chart.title')}
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      {t('crm.leads.lost.chart.subtitle')}
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t('crm.leads.lost.chart.shown', { count: managers.length })}
                  </div>
                </div>

                <div className="h-64 md:h-72">
                  <ResponsiveContainer>
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 8, left: -20, bottom: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="manager"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} />
                      <Tooltip content={<ManagerTooltip />} />
                      <Bar dataKey="amount" radius={[10, 10, 4, 4]} barSize={30}>
                        {chartData.map((row, idx) => (
                          <Cell key={row.manager} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-lumiva-accent">
                    {t('crm.leads.lost.tableManagers.title')}
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    {t('crm.leads.lost.tableManagers.total', { count: managers.length })}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 pr-3 text-left font-normal">
                          {t('crm.leads.lost.tableManagers.headers.manager')}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {t('crm.leads.lost.tableManagers.headers.lost')}
                        </th>
                        <th className="py-1.5 px-3 text-right font-normal">
                          {t('crm.leads.lost.tableManagers.headers.amount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {managers.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-3 text-center text-slate-500">
                            {t('crm.leads.lost.tableManagers.empty')}
                          </td>
                        </tr>
                      )}

                      {managers.map((row, idx) => (
                        <tr
                          key={`${row.manager}-${idx}`}
                          className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-1.5 pr-3 text-lumiva-accent">{row.manager}</td>
                          <td className="py-1.5 px-3 text-right text-slate-700">
                            {row.lost}
                          </td>
                          <td className="py-1.5 px-3 text-right text-rose-600 font-mono">
                            {row.amount.toLocaleString(locale, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{' '}
                            {currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Таблица по лидам */}
            <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-lumiva-accent">
                      {t('crm.leads.lost.tableLeads.title')}
                    </h2>
                    <p className="text-[11px] text-slate-600">
                      {t('crm.leads.lost.tableLeads.subtitle')}
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t('crm.leads.lost.tableLeads.total', { count: items.length })}
                  </div>
                </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5 pr-3 text-left font-normal">
                        {t('crm.leads.lost.tableLeads.headers.lead')}
                      </th>
                      <th className="py-1.5 px-3 text-left font-normal">
                        {t('crm.leads.lost.tableLeads.headers.manager')}
                      </th>
                      <th className="py-1.5 px-3 text-right font-normal">
                        {t('crm.leads.lost.tableLeads.headers.amount')}
                      </th>
                      <th className="py-1.5 pl-3 text-right font-normal">
                        {t('crm.leads.lost.tableLeads.headers.created')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-slate-500">
                          {t('crm.leads.lost.tableLeads.empty')}
                        </td>
                      </tr>
                    )}

                    {items.map((row) => (
                      <tr
                        key={row.leadId}
                        className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-1.5 pr-3 text-lumiva-accent">
                          {row.leadName || t('crm.leads.lost.tableLeads.leadFallback')}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600">
                          {row.manager || t('crm.leads.lost.tableLeads.managerFallback')}
                        </td>
                        <td className="py-1.5 px-3 text-right text-rose-600 font-mono">
                          {row.amount.toLocaleString(locale, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{' '}
                          {row.currency}
                        </td>
                        <td className="py-1.5 pl-3 text-right text-slate-500">
                          {new Date(row.createdAt).toLocaleDateString(locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
};
