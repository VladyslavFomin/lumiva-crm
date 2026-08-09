import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  deleteEmbedForm,
  fetchEmbedForms,
  type EmbedFormRow,
  type EmbedFormKind,
} from '../../api/embedForms';
import { withTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../../utils/withTimeout';
import { useAlertModal } from '../../contexts/AlertModalContext';

const KIND_BADGE: Record<EmbedFormKind, { label: string; className: string } | null> = {
  lead: null,
  product_order: { label: 'Заказ товаров', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  booking: { label: 'Запись на услугу', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  hotel_reservation: { label: 'Бронирование отеля', className: 'bg-violet-50 text-violet-700 border-violet-200' },
};

export const WebFormsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const navigate = useNavigate();
  const [rows, setRows] = useState<EmbedFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    withTimeout(
      fetchEmbedForms(),
      DEFAULT_FETCH_TIMEOUT_MS,
      'embed forms list',
    )
      .then(setRows)
      .catch((e) =>
        setError(e instanceof Error ? e.message : t('crm.embedForms.list.loadError')),
      )
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (id: string) => {
    if (!confirm(t('crm.embedForms.list.deleteConfirm'))) return;
    setDeleting(id);
    try {
      await deleteEmbedForm(id);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showAlert(msg, { variant: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <MainLayout>
      <div className="w-full min-w-0 max-w-none px-2 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8 pb-16 text-[#222]">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1">
              {t('crm.embedForms.kicker')}
            </p>
            <h1 className="text-2xl font-semibold text-[#222]">
              {t('crm.embedForms.list.title')}
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              {t('crm.embedForms.list.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/web-forms/new')}
            className="mt-2 md:mt-0 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            style={{ background: '#222' }}
          >
            {t('crm.embedForms.list.create')}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">{t('crm.embedForms.list.loading')}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            {t('crm.embedForms.list.empty')}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('crm.embedForms.list.colName')}</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">
                    {t('crm.embedForms.list.colSite')}
                  </th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">
                    {t('crm.embedForms.list.colStatus')}
                  </th>
                  <th className="px-4 py-3 font-medium w-[1%] whitespace-nowrap" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/web-forms/${r.id}`)}
                        className="font-medium text-left text-[#222] hover:underline"
                      >
                        {r.name}
                      </button>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-slate-500 line-clamp-1">
                          {r.templateKey}
                        </span>
                        {KIND_BADGE[r.kind] && (
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${KIND_BADGE[r.kind]!.className}`}
                          >
                            {KIND_BADGE[r.kind]!.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                      {r.site?.domain || r.siteId}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {r.published ? (
                        <span className="text-emerald-700 text-xs font-medium">
                          {t('crm.embedForms.list.published')}
                        </span>
                      ) : (
                        <span className="text-amber-700 text-xs font-medium">
                          {t('crm.embedForms.list.draft')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => navigate(`/web-forms/${r.id}`)}
                        className="text-xs font-semibold text-slate-700 hover:text-[#222] mr-2"
                      >
                        {t('crm.embedForms.list.edit')}
                      </button>
                      <button
                        type="button"
                        disabled={deleting === r.id}
                        onClick={() => onDelete(r.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
                      >
                        {t('crm.embedForms.list.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
