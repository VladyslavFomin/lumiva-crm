// src/pages/products/ProductModerationQueuePage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProductPublicationQueue,
  approveProductPublication,
  rejectProductPublication,
  type Product,
} from '../../api/products';
import './products-design.css';

export const ProductModerationQueuePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    fetchProductPublicationQueue()
      .then(setItems)
      .catch((e) => showAlert(e.message || t('crm.products.moderation.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleApprove = async (p: Product) => {
    setBusyId(p.id);
    try {
      await approveProductPublication(p.id);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.moderation.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await rejectProductPublication(rejectTarget.id, rejectReason || undefined);
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.moderation.errors.saveFailed'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.moderation.title')}</h1>
            <p className="sub">{t('crm.products.moderation.subtitle')}</p>
          </div>
        </div>

        <ProductsSubnav active="moderation" />

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.common.loading')}</div>
        ) : !items.length ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.products.moderation.empty')}</div>
        ) : (
          <div className="px-table-wrap">
            <table className="px-table">
              <thead>
                <tr>
                  <th>{t('crm.products.list.columns.name')}</th>
                  <th>{t('crm.products.list.columns.sku')}</th>
                  <th>{t('crm.products.moderation.requestedAt')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="row" onClick={() => navigate(`/products/${p.id}`)}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td className="mono" style={{ color: 'var(--fg-3)' }}>{p.sku || '—'}</td>
                    <td style={{ color: 'var(--fg-3)', fontSize: 12 }}>
                      {p.publicationRequestedAt ? new Date(p.publicationRequestedAt).toLocaleString() : '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="aib sm"
                        disabled={busyId === p.id}
                        onClick={() => handleApprove(p)}
                        style={{ marginRight: 6 }}
                      >
                        {t('crm.products.moderation.approveButton')}
                      </button>
                      <button
                        type="button"
                        className="aib sm danger"
                        disabled={busyId === p.id}
                        onClick={() => setRejectTarget(p)}
                      >
                        {t('crm.products.moderation.rejectButton')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rejectTarget && (
          <div className="pr-cat-modal-back" onClick={() => setRejectTarget(null)}>
            <div className="pr-cat-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <h3>{t('crm.products.moderation.rejectButton')}</h3>
              <div className="ai-field" style={{ marginBottom: 0 }}>
                <label className="ai-label">{rejectTarget.name}</label>
                <input
                  className="ai-input"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('crm.products.moderation.rejectReasonPlaceholder') || ''}
                  autoFocus
                />
              </div>
              <div className="pr-cat-modal-foot">
                <button type="button" className="aib ghost" onClick={() => setRejectTarget(null)}>
                  {t('crm.products.fieldTypes.modal.cancel')}
                </button>
                <button type="button" className="aib" onClick={handleReject} disabled={busyId === rejectTarget.id}>
                  {t('crm.products.moderation.rejectConfirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
