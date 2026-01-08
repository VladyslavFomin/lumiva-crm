// src/pages/projects/ClosedProjectsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { fetchProjects } from '../../api/projects';
import type { Project } from './projectTypes';
import { useTranslation } from 'react-i18next';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const ClosedProjectsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
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
  const currency = items[0]?.currency || 'EUR';
  const formatAmount = (amount: number) =>
    t('crm.projects.common.amountWithCurrency', {
      amount: new Intl.NumberFormat(locale).format(amount),
      currency,
    });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProjects({ status: 'Закрыт' })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.projects.closed.errors.loadFailed'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const totalAmount = useMemo(
    () => items.reduce((sum, p) => sum + (p.amount || 0), 0),
    [items],
  );

  const ProjectTable: React.FC<{ items: Project[]; onOpen: (id: string) => void }> = ({ items, onOpen }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-1.5 px-2 text-left font-normal">
              {t('crm.projects.closed.table.headers.project')}
            </th>
            <th className="py-1.5 px-2 text-left font-normal">
              {t('crm.projects.closed.table.headers.category')}
            </th>
            <th className="py-1.5 px-2 text-left font-normal">
              {t('crm.projects.closed.table.headers.status')}
            </th>
            <th className="py-1.5 px-2 text-left font-normal">
              {t('crm.projects.closed.table.headers.owner')}
            </th>
            <th className="py-1.5 px-2 text-right font-normal">
              {t('crm.projects.closed.table.headers.amount')}
            </th>
            <th className="py-1.5 px-2 text-right font-normal">
              {t('crm.projects.closed.table.headers.created')}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="py-3 text-center text-slate-500">
                {t('crm.projects.closed.empty')}
              </td>
            </tr>
          )}
          {items.map((p) => (
            <tr
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <td className="py-1.5 px-2 text-lumiva-accent font-semibold">{p.name}</td>
              <td className="py-1.5 px-2 text-slate-600">
                {p.category ? categoryLabels[p.category] ?? p.category : t('crm.projects.common.emptyValue')}
              </td>
              <td className="py-1.5 px-2 text-slate-600">
                {statusLabels[p.status] ?? p.status}
              </td>
              <td className="py-1.5 px-2 text-slate-600">
                {p.owner || t('crm.projects.common.emptyValue')}
              </td>
              <td className="py-1.5 px-2 text-right text-lumiva-accent font-mono">
                {formatAmount(p.amount)}
              </td>
              <td className="py-1.5 px-2 text-right text-slate-500">{p.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            {t('crm.projects.closed.kicker')}
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-lumiva-accent">
            {t('crm.projects.closed.title')}
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            {t('crm.projects.closed.subtitle')}
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
              {t('crm.projects.closed.kpis.count')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {items.length.toLocaleString(locale)}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.closed.kpis.amount')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {formatAmount(totalAmount)}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.closed.kpis.categories')}
            </div>
            <div className="mt-1 text-xl font-semibold text-lumiva-accent">
              {new Set(items.map((p) => p.category || '')).size}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lumiva-accent">
              {t('crm.projects.closed.table.title')}
            </h2>
            <span className="text-[11px] text-slate-500">
              {t('crm.projects.closed.table.total', { count: items.length })}
            </span>
          </div>
          {loading ? (
            <div className="text-xs text-slate-500">
              {t('crm.projects.closed.loading')}
            </div>
          ) : (
            <ProjectTable items={items} onOpen={(id) => navigate(`/app/projects/${id}`)} />
          )}
        </section>
      </div>
    </MainLayout>
  );
};
