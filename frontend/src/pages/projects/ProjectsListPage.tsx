// src/pages/projects/ProjectsListPage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import type { Project } from './projectTypes';
import { fetchProjects } from '../../api/projects';
import { fetchLeadsList } from '../../api/leads';
import type { Lead } from '../../api/leads';
import { useTranslation } from 'react-i18next';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const ProjectsListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const goTable = () => navigate('/app/projects');
  const goBoard = () => navigate('/app/projects/board');
  const handleOpen = (id: string) => navigate(`/app/projects/${id}`);
  const handleCreate = () => navigate('/app/projects/new');
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
  const formatStatus = (status?: string | null) => {
    if (!status) return t('crm.projects.common.emptyValue');
    return statusLabels[status] ?? status;
  };
  const formatAmount = (amount: number, currency?: string) => {
    const formatted = new Intl.NumberFormat(locale).format(amount);
    if (!currency) return formatted;
    return t('crm.projects.common.amountWithCurrency', {
      amount: formatted,
      currency,
    });
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    // грузим сразу проекты + лидов
    Promise.all([fetchProjects(), fetchLeadsList()])
      .then(([projRes, leads]) => {
        if (!alive) return;

        const leadsMap: Record<string, Lead> = {};
        leads.forEach((l) => {
          leadsMap[l.id] = l;
        });

        const enriched = projRes.items.map((p) => {
          const lead = p.leadId ? leadsMap[p.leadId] : undefined;
          return {
            ...p,
            // проставляем имя и email лида, если нашли
            leadName: lead?.name ?? p.leadName ?? null,
            leadEmail: lead?.email ?? p.leadEmail ?? null,
          };
        });

        setProjects(enriched);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setError(e.message || t('crm.projects.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок + переключатель вида */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.projects.list.title')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.list.subtitle')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] overflow-hidden">
              <button
                type="button"
                className="px-3 py-1.5 bg-slate-800 text-slate-50"
                onClick={goTable}
              >
                {t('crm.projects.views.table')}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-800/80"
                onClick={goBoard}
              >
                {t('crm.projects.views.kanban')}
              </button>
            </div>

            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-white font-semibold hover:bg-lumiva-accent-soft"
            >
              + {t('crm.projects.actions.newProject')}
            </button>
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-[12px] text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-2xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Лоадер */}
        {loading && (
          <div className="text-[12px] text-slate-400">
            {t('crm.projects.loading')}
          </div>
        )}

        {/* Таблица проектов */}
        {!loading && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-3 py-1">
                    {t('crm.projects.list.headers.name')}
                  </th>
                  <th className="text-left px-3 py-1">
                    {t('crm.projects.list.headers.owner')}
                  </th>
                  <th className="text-left px-3 py-1">
                    {t('crm.projects.list.headers.lead')}
                  </th>
                  <th className="text-left px-3 py-1">
                    {t('crm.projects.list.headers.status')}
                  </th>
                  <th className="text-left px-3 py-1">
                    {t('crm.projects.list.headers.amount')}
                  </th>
                  <th className="text-left px-3 py-1">
                    {t('crm.projects.list.headers.created')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                    onClick={() => handleOpen(p.id)}
                  >
                    <td className="px-3 py-1.5 text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <div className="flex gap-1">
                          {(p.tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded-full bg-rose-50 text-[10px] text-rose-600"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">
                      {p.owner ?? t('crm.projects.common.emptyValue')}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">
                      {p.leadName
                        ? `${p.leadName} (${p.leadId?.slice(0, 6) ?? ''})`
                        : t('crm.projects.common.emptyValue')}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">
                      {formatStatus(p.status)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">
                      {formatAmount(p.amount, p.currency)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">
                      {p.createdAt}
                    </td>
                  </tr>
                ))}

                {!projects.length && !error && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-3 text-center text-[12px] text-slate-500"
                    >
                      {t('crm.projects.list.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
