// src/pages/marketing/BroadcastsPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchBroadcasts,
  cancelBroadcast,
  deleteBroadcast,
  type MarketingBroadcast,
  type BroadcastStatus,
} from '../../api/marketing-broadcasts';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';

const STATUS_BADGE: Record<BroadcastStatus, string> = {
  draft: 'badge-inactive',
  scheduled: 'badge-info',
  running: 'badge-warning',
  completed: 'badge-success',
  cancelled: 'badge-inactive',
};

export const BroadcastsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [items, setItems] = useState<MarketingBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchBroadcasts());
    } catch (e: any) {
      setError(e?.message || t('crm.marketingBroadcasts.list.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleCancel = async (id: string) => {
    if (!confirm(t('crm.marketingBroadcasts.list.confirmCancel'))) return;
    try {
      await cancelBroadcast(id);
      await load();
    } catch (e: any) {
      showAlert(e?.message || t('crm.marketingBroadcasts.list.errors.cancelFailed'), { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('crm.marketingBroadcasts.list.confirmDelete'))) return;
    try {
      await deleteBroadcast(id);
      await load();
    } catch (e: any) {
      showAlert(e?.message || t('crm.marketingBroadcasts.list.errors.deleteFailed'), { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">{t('crm.marketingBroadcasts.list.title')}</h1>
            <p className="page-subtitle">{t('crm.marketingBroadcasts.list.subtitle')}</p>
          </div>
          <button onClick={() => navigate('/marketing/broadcasts/new')} className="btn-primary">
            {t('crm.marketingBroadcasts.list.create')}
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-text-secondary py-10 text-center">{t('crm.marketingBroadcasts.list.loading')}</div>
        ) : error ? (
          <div className="text-sm text-status-error py-6 text-center">{error}</div>
        ) : items.length === 0 ? (
          <div className="card p-10 text-center text-sm text-text-secondary">
            {t('crm.marketingBroadcasts.list.empty')}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs text-text-secondary">
                  <th className="px-4 py-3 font-medium">{t('crm.marketingBroadcasts.list.colName')}</th>
                  <th className="px-4 py-3 font-medium">{t('crm.marketingBroadcasts.list.colChannel')}</th>
                  <th className="px-4 py-3 font-medium">{t('crm.marketingBroadcasts.list.colStatus')}</th>
                  <th className="px-4 py-3 font-medium">{t('crm.marketingBroadcasts.list.colSteps')}</th>
                  <th className="px-4 py-3 font-medium">{t('crm.marketingBroadcasts.list.colSent')}</th>
                  <th className="px-4 py-3 font-medium">{t('crm.marketingBroadcasts.list.colScheduled')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('crm.marketingBroadcasts.list.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-b border-border-default last:border-0">
                    <td className="px-4 py-3">
                      <button
                        className="font-medium text-[#111827] hover:underline"
                        onClick={() => navigate(`/marketing/broadcasts/${b.id}`)}
                      >
                        {b.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 uppercase text-xs text-text-secondary">{b.channel}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_BADGE[b.status]}`}>
                        {t(`crm.marketingBroadcasts.list.status.${b.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{b.steps.length}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {b.stats.completed + b.stats.active} / {b.stats.total}
                      {b.stats.failed > 0 && (
                        <span className="text-status-error">
                          {' '}{t('crm.marketingBroadcasts.list.failedSuffix', { count: b.stats.failed })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      {b.status === 'draft' && (
                        <>
                          <button className="text-xs text-[#111827] hover:underline" onClick={() => navigate(`/marketing/broadcasts/${b.id}`)}>
                            {t('crm.marketingBroadcasts.list.edit')}
                          </button>
                          <button className="text-xs text-status-error hover:underline" onClick={() => handleDelete(b.id)}>
                            {t('crm.marketingBroadcasts.list.delete')}
                          </button>
                        </>
                      )}
                      {(b.status === 'scheduled' || b.status === 'running') && (
                        <button className="text-xs text-status-error hover:underline" onClick={() => handleCancel(b.id)}>
                          {t('crm.marketingBroadcasts.list.cancel')}
                        </button>
                      )}
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
