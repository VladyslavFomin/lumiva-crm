// src/pages/products/ProductLocationsPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProductLocations,
  createProductLocation,
  updateProductLocation,
  deleteProductLocation,
  type ProductLocation,
} from '../../api/products';
import './products-design.css';

const I = {
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
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

/** Управление складами/локациями тенанта — lumiva_products_module_roadmap.md §12.2. */
export const ProductLocationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchProductLocations()
      .then(setLocations)
      .catch((e) => showAlert(e.message || t('crm.products.locations.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createProductLocation({ name: newName.trim(), code: newCode.trim() || null });
      setNewName('');
      setNewCode('');
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.locations.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (loc: ProductLocation, name: string) => {
    if (!name.trim() || name === loc.name) return;
    try {
      await updateProductLocation(loc.id, { name: name.trim() });
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.locations.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleToggleActive = async (loc: ProductLocation) => {
    try {
      await updateProductLocation(loc.id, { isActive: !loc.isActive });
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.locations.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleMakeDefault = async (loc: ProductLocation) => {
    try {
      await updateProductLocation(loc.id, { isDefault: true });
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.locations.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleDelete = async (loc: ProductLocation) => {
    const ok = await showConfirm(t('crm.products.locations.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      cancelLabel: t('crm.confirmModal.cancel', { defaultValue: 'Отмена' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProductLocation(loc.id);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.locations.errors.deleteFailed'), { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="productLocations" />
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.locations.title')}</h1>
            <p className="sub">{t('crm.products.locations.subtitle')}</p>
          </div>
        </div>

        <ProductsSubnav active="locations" />

        <form onSubmit={handleAdd} className="px-toolbar">
          <input
            className="ai-input"
            style={{ width: 240 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('crm.products.locations.namePlaceholder') || ''}
          />
          <input
            className="ai-input"
            style={{ width: 140 }}
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder={t('crm.products.locations.codePlaceholder') || ''}
          />
          <button type="submit" className="aib" disabled={saving || !newName.trim()}>
            <Icon d={I.plus} size={15} />
            {t('crm.products.locations.addButton')}
          </button>
        </form>

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.common.loading')}</div>
        ) : !locations.length ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.products.locations.empty')}</div>
        ) : (
          <div className="px-table-wrap">
            <table className="px-table">
              <thead>
                <tr>
                  <th>{t('crm.products.locations.columns.name')}</th>
                  <th>{t('crm.products.locations.columns.code')}</th>
                  <th>{t('crm.products.locations.columns.default')}</th>
                  <th className="c">{t('crm.products.locations.columns.active')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id} className="row">
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        defaultValue={loc.name}
                        onBlur={(e) => handleRename(loc, e.target.value)}
                        className="ai-input"
                        style={{ maxWidth: 260 }}
                      />
                    </td>
                    <td className="mono" style={{ color: 'var(--fg-3)' }}>{loc.code || '—'}</td>
                    <td>
                      {loc.isDefault ? (
                        <span className="pr-badge active">{t('crm.products.locations.defaultBadge')}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleMakeDefault(loc); }}
                          style={{ fontSize: 11.5, background: 'none', border: 'none', color: 'var(--ink)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                        >
                          {t('crm.products.locations.makeDefault')}
                        </button>
                      )}
                    </td>
                    <td className="c" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={loc.isActive} disabled={loc.isDefault} onChange={() => handleToggleActive(loc)} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {!loc.isDefault && (
                        <div className="px-row-actions">
                          <button type="button" className="danger" title={t('crm.products.form.actions.delete') || ''} onClick={() => handleDelete(loc)}>
                            <Icon d={I.trash} size={13} />
                          </button>
                        </div>
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
