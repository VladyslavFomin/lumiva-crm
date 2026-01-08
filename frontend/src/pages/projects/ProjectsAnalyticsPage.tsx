// src/pages/projects/ProjectsAnalyticsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { fetchProjects } from '../../api/projects';
import type { Project } from './projectTypes';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const COLORS = ['#22d3ee', '#a855f7', '#fb923c', '#4ade80', '#f97373'];

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const ProjectsAnalyticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProjects()
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.projects.analytics.errors.loadFailed'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      Новый: t('crm.projects.statuses.new'),
      'В работе': t('crm.projects.statuses.inProgress'),
      'На проверке': t('crm.projects.statuses.review'),
      Заморожен: t('crm.projects.statuses.paused'),
      Закрыт: t('crm.projects.statuses.closed'),
    }),
    [t],
  );
  const categoryLabels = useMemo<Record<string, string>>(
    () => ({
      Аналитика: t('crm.projects.categories.analytics'),
      Разработка: t('crm.projects.categories.development'),
      Маркетинг: t('crm.projects.categories.marketing'),
      Реклама: t('crm.projects.categories.ads'),
      SEO: t('crm.projects.categories.seo'),
      SMM: t('crm.projects.categories.smm'),
    }),
    [t],
  );
  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((p) => {
      const label = statusLabels[p.status] ?? p.status;
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }, [items, statusLabels]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((p) => {
      const raw = p.category || t('crm.projects.analytics.noCategory');
      const label = categoryLabels[raw] ?? raw;
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([category, count]) => ({ category, count }));
  }, [items, categoryLabels, t]);

  const totalAmount = useMemo(
    () => items.reduce((sum, p) => sum + (p.amount || 0), 0),
    [items],
  );
  const currency = items[0]?.currency || 'EUR';
  const formatAmount = (amount: number) => {
    const formatted = new Intl.NumberFormat(locale).format(amount);
    return t('crm.projects.common.amountWithCurrency', {
      amount: formatted,
      currency,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            {t('crm.projects.analytics.kicker')}
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-lumiva-accent">
            {t('crm.projects.analytics.title')}
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            {t('crm.projects.analytics.subtitle')}
          </p>
        </section>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.analytics.kpis.total')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {items.length.toLocaleString(locale)}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.analytics.kpis.amount')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {formatAmount(totalAmount)}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.analytics.kpis.categories')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {byCategory.length}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 md:gap-5">
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-lumiva-accent">
                {t('crm.projects.analytics.statusChart.title')}
              </h2>
              <span className="text-[11px] text-slate-500">
                {t('crm.projects.analytics.shown', { count: byStatus.length })}
              </span>
            </div>
            <div className="h-64 md:h-72">
              <ResponsiveContainer>
                <BarChart data={byStatus} margin={{ top: 10, right: 8, left: -20, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={38} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[10, 10, 4, 4]} barSize={32}>
                    {byStatus.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-lumiva-accent">
                {t('crm.projects.analytics.categoryChart.title')}
              </h2>
              <span className="text-[11px] text-slate-500">
                {t('crm.projects.analytics.shown', { count: byCategory.length })}
              </span>
            </div>
            <div className="h-64 md:h-72">
              <ResponsiveContainer>
                <BarChart data={byCategory} margin={{ top: 10, right: 8, left: -20, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={38} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[10, 10, 4, 4]} barSize={32}>
                    {byCategory.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[(idx + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
        {/* Таблица с переходом */}
        <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lumiva-accent">
              {t('crm.projects.analytics.table.title')}
            </h2>
            <span className="text-[11px] text-slate-500">
              {t('crm.projects.analytics.table.total', { count: items.length })}
            </span>
          </div>
          {loading ? (
            <div className="text-xs text-slate-500">
              {t('crm.projects.analytics.table.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.analytics.table.headers.project')}
                    </th>
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.analytics.table.headers.status')}
                    </th>
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.analytics.table.headers.category')}
                    </th>
                    <th className="py-1.5 px-2 text-left font-normal">
                      {t('crm.projects.analytics.table.headers.owner')}
                    </th>
                    <th className="py-1.5 px-2 text-right font-normal">
                      {t('crm.projects.analytics.table.headers.amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/app/projects/${p.id}`)}
                      className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-1.5 px-2 text-lumiva-accent font-semibold">{p.name}</td>
                      <td className="py-1.5 px-2 text-slate-600">
                        {statusLabels[p.status] ?? p.status}
                      </td>
                      <td className="py-1.5 px-2 text-slate-600">
                        {p.category ? categoryLabels[p.category] ?? p.category : t('crm.projects.common.emptyValue')}
                      </td>
                      <td className="py-1.5 px-2 text-slate-600">
                        {p.owner || t('crm.projects.common.emptyValue')}
                      </td>
                      <td className="py-1.5 px-2 text-right text-lumiva-accent font-mono">
                        {formatAmount(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};
