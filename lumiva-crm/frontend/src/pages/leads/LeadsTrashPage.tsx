// src/pages/leads/LeadsTrashPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import { fetchLeads, updateLead, deleteLead, type Lead, type LeadStatus } from '../../api/leads';

const statusStyles: Record<LeadStatus, string> = {
  'Новый клиент': 'bg-rose-500/15 text-rose-600 border-rose-500/30',
  'В работе': 'bg-sky-500/15 text-sky-600 border-sky-500/30',
  'Ожидает ответа': 'bg-amber-400/30 text-amber-900 border-amber-400/40',
  'Закрыт (успех)': 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  'Закрыт (проигран)': 'bg-rose-500/15 text-rose-600 border-rose-500/30',
};

export const LeadsTrashPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en')
    ? 'en-US'
    : i18n.language?.startsWith('tr')
      ? 'tr-TR'
      : 'ru-RU';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchLeads()
      .then((items) => {
        if (!alive) return;
        setLeads(items);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message || t('crm.leads.trash.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  const trashedLeads = useMemo(
    () => leads.filter((l) => l.meta?.deleted),
    [leads],
  );

  const restoreLead = async (lead: Lead) => {
    const nextMeta = {
      ...(lead.meta ?? {}),
      deleted: false,
      deletedAt: null,
    };
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, meta: nextMeta } : l)));
    await updateLead(lead.id, { meta: nextMeta }).catch(() => null);
  };

  const hardDelete = async (lead: Lead) => {
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    await deleteLead(lead.id).catch(() => null);
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">
            {t('crm.leads.trash.title')}
          </h1>
          <div className="text-[11px] text-slate-500">
            {t('crm.leads.trash.subtitle')}
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          {loading ? (
            <div className="text-xs text-slate-400">{t('crm.leads.trash.loading')}</div>
          ) : trashedLeads.length === 0 ? (
            <div className="text-xs text-slate-400">{t('crm.leads.trash.empty')}</div>
          ) : (
            <table className="w-full text-xs border-separate border-spacing-y-1 table-fixed">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1">{t('crm.leads.trash.columns.name')}</th>
                  <th className="text-left px-2 py-1">{t('crm.leads.trash.columns.status')}</th>
                  <th className="text-left px-2 py-1">{t('crm.leads.trash.columns.created')}</th>
                  <th className="text-right px-2 py-1">{t('crm.leads.trash.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {trashedLeads.map((lead) => (
                  <tr key={lead.id} className="bg-slate-950/80">
                    <td className="px-2 py-1.5 text-slate-100">{lead.name || '—'}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                          statusStyles[lead.status] ?? 'bg-slate-900 text-slate-200 border-slate-800'
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-400">
                      {new Date(lead.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="px-2 py-1.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => restoreLead(lead)}
                        className="px-2 py-1 rounded-lg border border-slate-700/80 text-slate-200 hover:bg-slate-900/80 text-[11px]"
                      >
                        {t('crm.leads.trash.actions.restore')}
                      </button>
                      <button
                        type="button"
                        onClick={() => hardDelete(lead)}
                        className="px-2 py-1 rounded-lg border border-rose-500/60 text-rose-300 hover:bg-rose-950/60 text-[11px]"
                      >
                        {t('crm.leads.trash.actions.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
};



