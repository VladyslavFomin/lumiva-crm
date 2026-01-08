// src/pages/leads/LeadsListPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lead } from '../../api/leads';
import { fetchLeads } from '../../api/leads';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const LeadsListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleCreateLead = () => navigate('/app/leads/new');
  const handleOpenLead = (id: string) => navigate(`/app/leads/${id}`);
  const goBoard = () => navigate('/app/leads');
  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      new: t('crm.leads.statuses.new'),
      in_progress: t('crm.leads.statuses.inProgress'),
      waiting: t('crm.leads.statuses.waiting'),
      won: t('crm.leads.statuses.won'),
      lost: t('crm.leads.statuses.lost'),
    }),
    [t],
  );
  const formatUtm = (lead: Lead) => {
    const parts = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(
      (v) => v && String(v).trim().length > 0,
    );
    return parts.length ? parts.join(' / ') : t('crm.leads.list.emptyValue');
  };
  const formatStatus = (status?: string | null) => {
    if (!status) return t('crm.leads.list.emptyValue');
    return statusLabels[status] ?? status;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchLeads()
      .then((items) => {
        if (!alive) return;
        // fetchLeads уже возвращает Lead[]
        setLeads(items);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.leads.list.errors.loadFailed'));
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.leads.list.title')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.leads.list.subtitle')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Переключатель вида */}
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] overflow-hidden">
              <button
                className="px-3 py-1.5 text-slate-400 hover:bg-slate-800/80"
                type="button"
                onClick={goBoard}
              >
                {t('crm.leads.list.viewKanban')}
              </button>
              <button
                className="px-3 py-1.5 bg-slate-800 text-slate-50"
                type="button"
              >
                {t('crm.leads.list.viewList')}
              </button>
            </div>

            <button
              onClick={handleCreateLead}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
            >
              {t('crm.leads.list.create')}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Таблица */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          {loading ? (
            <div className="text-xs text-slate-400">
              {t('crm.leads.list.loading')}
            </div>
          ) : (
            <table className="w-full text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1">
                    {t('crm.leads.list.columns.name')}
                  </th>
                  <th className="text-left px-2 py-1">
                    {t('crm.leads.list.columns.channel')}
                  </th>
                  <th className="text-left px-2 py-1">
                    {t('crm.leads.list.columns.utm')}
                  </th>
                  <th className="text-left px-2 py-1">
                    {t('crm.leads.list.columns.status')}
                  </th>
                  <th className="text-left px-2 py-1">
                    {t('crm.leads.list.columns.created')}
                  </th>
                  <th className="text-right px-2 py-1">
                    {t('crm.leads.list.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                    onClick={() => handleOpenLead(lead.id)}
                  >
                    <td className="px-2 py-1.5 text-slate-100">
                      {lead.name || t('crm.leads.list.emptyValue')}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {lead.channel || t('crm.leads.list.emptyValue')}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {formatUtm(lead)}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {formatStatus(lead.status)}
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {new Date(lead.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className="text-[11px] text-lumiva-accent hover:text-lumiva-accent-soft">
                        {t('crm.leads.list.open')}
                      </span>
                    </td>
                  </tr>
                ))}

                {leads.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-2 py-2 text-[11px] text-slate-500 italic"
                    >
                      {t('crm.leads.list.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
