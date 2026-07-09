// src/pages/products/ProductAttributesPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchProductAttributes,
  createProductAttribute,
  deleteProductAttribute,
  addProductAttributeValue,
  removeProductAttributeValue,
  type ProductAttribute,
} from '../../api/products';

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'px-3 py-2 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5] text-[#222]';

export const ProductAttributesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    const ok = await showConfirm(t('crm.products.attributes.deleteConfirm'));
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
    const ok = await showConfirm(t('crm.products.attributes.deleteValueConfirm'));
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
      <div style={{ color: INK }}>
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 20, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => navigate('/products')}
            style={{ fontSize: 11, color: FG3, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← {t('crm.products.list.title')}
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 10 }}>{t('crm.products.attributes.title')}</h1>
          <div style={{ fontSize: 13, color: FG3, marginTop: 6 }}>{t('crm.products.attributes.subtitle')}</div>
        </div>

        <form onSubmit={handleAddAttribute} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <input
            className={inpCls}
            style={{ flex: '0 1 320px' }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('crm.products.attributes.namePlaceholder') || ''}
          />
          <button
            type="submit"
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer' }}
          >
            {t('crm.products.attributes.addButton')}
          </button>
        </form>

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.common.loading')}</div>
        ) : attributes.length === 0 ? (
          <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.products.attributes.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {attributes.map((attr) => (
              <div key={attr.id} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{attr.name}</div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttribute(attr.id)}
                    style={{ fontSize: 12, color: '#9a1f31', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {t('crm.products.form.actions.delete')}
                  </button>
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: FG3, marginBottom: 8 }}>
                  {t('crm.products.attributes.valuesTitle')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {(attr.values || []).map((v) => (
                    <span
                      key={v.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                        borderRadius: 999, background: BG_MUTED, border: `1px solid ${LINE}`, fontSize: 12,
                      }}
                    >
                      {v.colorHex && (
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.colorHex, display: 'inline-block' }} />
                      )}
                      {v.label}
                      <button
                        type="button"
                        onClick={() => handleRemoveValue(attr.id, v.id)}
                        style={{ background: 'none', border: 'none', color: FG3, cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {!attr.values?.length && <span style={{ fontSize: 12, color: FG4 }}>—</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className={inpCls}
                    style={{ flex: '0 1 220px' }}
                    value={valueDrafts[attr.id] || ''}
                    onChange={(e) => setValueDrafts((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddValue(attr.id); } }}
                    placeholder={t('crm.products.attributes.addValueLabel') || ''}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddValue(attr.id)}
                    style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                  >
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
