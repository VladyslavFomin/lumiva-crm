// src/pages/products/ProductAttributesPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProductAttributes,
  createProductAttribute,
  deleteProductAttribute,
  addProductAttributeValue,
  removeProductAttributeValue,
  type ProductAttribute,
} from '../../api/products';
import './products-design.css';

export const ProductAttributesPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    fetchProductAttributes()
      .then(setAttributes)
      .catch((e) => showAlert(e.message || t('crm.products.attributes.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAddAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createProductAttribute({ name: newName.trim() });
      setNewName('');
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.attributes.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleDeleteAttribute = async (id: string) => {
    const ok = await showConfirm(t('crm.products.attributes.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      cancelLabel: t('crm.confirmModal.cancel', { defaultValue: 'Отмена' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProductAttribute(id);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.attributes.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleAddValue = async (attrId: string) => {
    const value = (valueDrafts[attrId] || '').trim();
    if (!value) return;
    try {
      await addProductAttributeValue(attrId, { value });
      setValueDrafts((prev) => ({ ...prev, [attrId]: '' }));
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.attributes.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleRemoveValue = async (attrId: string, valueId: string) => {
    const ok = await showConfirm(t('crm.products.attributes.deleteValueConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      cancelLabel: t('crm.confirmModal.cancel', { defaultValue: 'Отмена' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeProductAttributeValue(attrId, valueId);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.attributes.errors.saveFailed'), { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="productAttributes" />
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.attributes.title')}</h1>
            <p className="sub">{t('crm.products.attributes.subtitle')}</p>
          </div>
        </div>

        <ProductsSubnav active="attributes" />

        <form onSubmit={handleAddAttribute} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          <input
            className="ai-input"
            style={{ flex: '0 1 320px' }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('crm.products.attributes.namePlaceholder') || ''}
          />
          <button type="submit" className="aib">
            {t('crm.products.attributes.addButton')}
          </button>
        </form>

        {loading ? (
          <div className="an-empty">{t('crm.common.loading')}</div>
        ) : attributes.length === 0 ? (
          <div className="an-empty">{t('crm.products.attributes.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {attributes.map((attr) => (
              <div key={attr.id} className="an-panel">
                <div className="an-panel-head">
                  <div className="t">{attr.name}</div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => handleDeleteAttribute(attr.id)}
                  >
                    {t('crm.products.form.actions.delete')}
                  </button>
                </div>
                <div className="mono" style={{ color: 'var(--fg-3)', marginBottom: 8 }}>
                  {t('crm.products.attributes.valuesTitle')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {(attr.values || []).map((v) => (
                    <span key={v.id} className="pr-cat-tag">
                      {v.colorHex && <span className="sw" style={{ background: v.colorHex, borderRadius: '50%' }} />}
                      {v.label}
                      <button
                        type="button"
                        onClick={() => handleRemoveValue(attr.id, v.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {!attr.values?.length && <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>—</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="ai-input"
                    style={{ flex: '0 1 220px' }}
                    value={valueDrafts[attr.id] || ''}
                    onChange={(e) => setValueDrafts((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddValue(attr.id); } }}
                    placeholder={t('crm.products.attributes.addValueLabel') || ''}
                  />
                  <button type="button" className="aib ghost sm" onClick={() => handleAddValue(attr.id)}>
                    {t('crm.products.attributes.addValueButton')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
