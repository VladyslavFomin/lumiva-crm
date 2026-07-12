// src/pages/products/ProductWebhooksPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProductWebhooks,
  createProductWebhook,
  updateProductWebhook,
  regenerateProductWebhookSecret,
  deleteProductWebhook,
  type ProductWebhook,
  type ProductWebhookEvent,
} from '../../api/products';
import { fetchSites, type Site } from '../../api/sites';
import './products-design.css';

const ALL_EVENTS: ProductWebhookEvent[] = [
  'product.created',
  'product.updated',
  'product.deleted',
  'product.stock_changed',
  'product.published',
];

const I = {
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </>
  ),
};

const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

type ModalState = { mode: 'create' } | { mode: 'edit'; webhook: ProductWebhook } | null;

const WebhookModal: React.FC<{
  state: ModalState;
  sites: Site[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ state, sites, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const editing = state?.mode === 'edit' ? state.webhook : null;
  const [name, setName] = useState(editing?.name || '');
  const [url, setUrl] = useState(editing?.url || '');
  const [siteId, setSiteId] = useState(editing?.siteId || '');
  const [events, setEvents] = useState<ProductWebhookEvent[]>(editing?.events || ['product.updated']);
  const [saving, setSaving] = useState(false);

  if (!state) return null;

  const toggleEvent = (ev: ProductWebhookEvent) => {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim() || !events.length) return;
    setSaving(true);
    try {
      if (editing) {
        await updateProductWebhook(editing.id, { name: name.trim(), url: url.trim(), events, siteId: siteId || null });
      } else {
        await createProductWebhook({ name: name.trim(), url: url.trim(), events, siteId: siteId || null });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.webhooks.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pr-cat-modal-back" onClick={onClose}>
      <div className="pr-cat-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? t('crm.products.form.actions.save') : t('crm.products.webhooks.addButton')}</h3>
        <div className="ai-field">
          <label className="ai-label">{t('crm.products.webhooks.namePlaceholder')}</label>
          <input className="ai-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="ai-field">
          <label className="ai-label">URL</label>
          <input className="ai-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('crm.products.webhooks.urlPlaceholder') || ''} />
        </div>
        {!!sites.length && (
          <div className="ai-field">
            <label className="ai-label">{t('crm.products.webhooks.siteLabel')}</label>
            <select className="ai-select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">{t('crm.products.webhooks.allSites')}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name || s.domain}</option>
              ))}
            </select>
          </div>
        )}
        <div className="ai-field" style={{ marginBottom: 0 }}>
          <label className="ai-label">{t('crm.products.webhooks.eventsLabel')}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {ALL_EVENTS.map((ev) => (
              <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} />
                {t(`crm.products.webhooks.events.${ev}`)}
              </label>
            ))}
          </div>
        </div>
        <div className="pr-cat-modal-foot">
          <button type="button" className="aib ghost" onClick={onClose}>
            {t('crm.products.fieldTypes.modal.cancel')}
          </button>
          <button type="button" className="aib" onClick={handleSave} disabled={saving || !name.trim() || !url.trim() || !events.length}>
            {editing ? t('crm.products.form.actions.save') : t('crm.products.form.actions.create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProductWebhooksPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const [webhooks, setWebhooks] = useState<ProductWebhook[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchProductWebhooks(), fetchSites()])
      .then(([w, s]) => {
        setWebhooks(w);
        setSites(s);
      })
      .catch((e) => showAlert(e.message || t('crm.products.webhooks.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const siteName = (siteId: string | null) => {
    if (!siteId) return t('crm.products.webhooks.allSites');
    return sites.find((s) => s.id === siteId)?.domain || siteId;
  };

  const handleToggleActive = async (wh: ProductWebhook) => {
    try {
      await updateProductWebhook(wh.id, { isActive: !wh.isActive });
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.webhooks.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleRegenerateSecret = async (wh: ProductWebhook) => {
    try {
      await regenerateProductWebhookSecret(wh.id);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.webhooks.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleDelete = async (wh: ProductWebhook) => {
    const ok = await showConfirm(t('crm.products.form.actions.delete'), { danger: true });
    if (!ok) return;
    try {
      await deleteProductWebhook(wh.id);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.webhooks.errors.deleteFailed'), { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.webhooks.title')}</h1>
            <p className="sub">{t('crm.products.webhooks.subtitle')}</p>
          </div>
          <div className="px-head-actions">
            <button type="button" className="aib" onClick={() => setModal({ mode: 'create' })}>
              <Icon d={I.plus} size={15} />
              {t('crm.products.webhooks.addButton')}
            </button>
          </div>
        </div>

        <ProductsSubnav active="webhooks" />

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.common.loading')}</div>
        ) : !webhooks.length ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.products.webhooks.empty')}</div>
        ) : (
          <div className="px-table-wrap">
            <table className="px-table">
              <thead>
                <tr>
                  <th>{t('crm.products.webhooks.columns.name')}</th>
                  <th>{t('crm.products.webhooks.columns.url')}</th>
                  <th>{t('crm.products.webhooks.columns.events')}</th>
                  <th>{t('crm.products.webhooks.columns.status')}</th>
                  <th className="c">{t('crm.products.webhooks.columns.active')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="row" onClick={() => setModal({ mode: 'edit', webhook: wh })}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{wh.name}</div>
                      <div className="mono" style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 10 }}>{siteName(wh.siteId)}</div>
                    </td>
                    <td>
                      <code style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{wh.url}</code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {wh.events.map((ev) => (
                          <span key={ev} className="pr-cat-tag">{t(`crm.products.webhooks.events.${ev}`)}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {wh.lastTriggeredAt ? (
                        <span style={{ color: wh.lastStatusCode && wh.lastStatusCode < 300 ? '#1f8a5e' : '#cc2f47', fontSize: 11.5 }}>
                          {wh.lastStatusCode || t('crm.products.webhooks.errors.saveFailed')} · {new Date(wh.lastTriggeredAt).toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--fg-4)', fontSize: 11.5 }}>{t('crm.products.webhooks.neverTriggered')}</span>
                      )}
                    </td>
                    <td className="c" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={wh.isActive} onChange={() => handleToggleActive(wh)} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="px-row-actions">
                        <button type="button" title={t('crm.products.webhooks.regenerateSecret') || ''} onClick={() => handleRegenerateSecret(wh)}>
                          <Icon d={I.edit} size={13} />
                        </button>
                        <button type="button" className="danger" title={t('crm.products.form.actions.delete') || ''} onClick={() => handleDelete(wh)}>
                          <Icon d={I.trash} size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <WebhookModal state={modal} sites={sites} onClose={() => setModal(null)} onSaved={load} />
      </div>
    </MainLayout>
  );
};
