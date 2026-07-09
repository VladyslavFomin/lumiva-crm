// src/pages/products/ProductFieldTypesPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchProductFieldDefs,
  createProductFieldDef,
  updateProductFieldDef,
  deleteProductFieldDef,
  type ProductFieldDef,
  type ProductFieldType,
} from '../../api/products';

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'w-full px-3 py-2.5 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5] text-[#222]';
const lblCls = 'block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5 text-[#888]';

const FIELD_TYPES: ProductFieldType[] = [
  'text', 'textarea', 'number', 'date', 'datetime', 'boolean',
  'select', 'multiselect', 'radio', 'url', 'media', 'gallery',
];

const OPTIONS_TYPES: ProductFieldType[] = ['select', 'multiselect', 'radio'];

type DraftField = {
  label: string;
  type: ProductFieldType;
  required: boolean;
  width: '25' | '50' | '75' | '100';
  description: string;
  options: Array<{ value: string; label: string }>;
  showInList: boolean;
  showInQuickEdit: boolean;
};

const emptyDraft: DraftField = {
  label: '',
  type: 'text',
  required: false,
  width: '100',
  description: '',
  options: [],
  showInList: true,
  showInQuickEdit: false,
};

export const ProductFieldTypesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();

  const [fields, setFields] = useState<ProductFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftField>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchProductFieldDefs()
      .then(setFields)
      .catch((e) => showAlert(e.message || t('crm.products.fieldTypes.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  };

  const openEdit = (f: ProductFieldDef) => {
    setEditingId(f.id);
    setDraft({
      label: f.label,
      type: f.type,
      required: f.required,
      width: f.width,
      description: f.description || '',
      options: f.options || [],
      showInList: f.showInList,
      showInQuickEdit: f.showInQuickEdit,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm(t('crm.products.fieldTypes.deleteConfirm'));
    if (!ok) return;
    try {
      await deleteProductFieldDef(id);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.fieldTypes.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleSave = async () => {
    if (!draft.label.trim()) return;
    setSaving(true);
    try {
      const payload = {
        label: draft.label.trim(),
        type: draft.type,
        required: draft.required,
        width: draft.width,
        description: draft.description || undefined,
        options: OPTIONS_TYPES.includes(draft.type) ? draft.options : undefined,
        showInList: draft.showInList,
        showInQuickEdit: draft.showInQuickEdit,
      };
      if (editingId) {
        await updateProductFieldDef(editingId, payload);
      } else {
        await createProductFieldDef(payload);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.fieldTypes.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div style={{ color: INK }}>
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 20, marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <button
              type="button"
              onClick={() => navigate('/products')}
              style={{ fontSize: 11, color: FG3, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ← {t('crm.products.list.title')}
            </button>
            <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 10 }}>{t('crm.products.fieldTypes.title')}</h1>
            <div style={{ fontSize: 13, color: FG3, marginTop: 6 }}>{t('crm.products.fieldTypes.subtitle')}</div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer' }}
          >
            {t('crm.products.fieldTypes.addButton')}
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.common.loading')}</div>
        ) : fields.length === 0 ? (
          <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.products.fieldTypes.empty')}</div>
        ) : (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: BG_MUTED, borderBottom: `1px solid ${LINE}` }}>
                  {['label', 'type', 'required', 'width', 'actions'].map((c) => (
                    <th key={c} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: FG3 }}>
                      {t(`crm.products.fieldTypes.table.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{f.label}</td>
                    <td style={{ padding: '10px 14px', color: FG3 }}>{t(`crm.products.fieldTypes.types.${f.type}`)}</td>
                    <td style={{ padding: '10px 14px', color: FG3 }}>{f.required ? '✓' : '—'}</td>
                    <td style={{ padding: '10px 14px', color: FG3 }}>{f.width}%</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => openEdit(f)} style={{ fontSize: 12, color: FG3, background: 'none', border: 'none', cursor: 'pointer' }}>
                          {t('crm.products.fieldTypes.editButton')}
                        </button>
                        <button type="button" onClick={() => handleDelete(f.id)} style={{ fontSize: 12, color: '#9a1f31', background: 'none', border: 'none', cursor: 'pointer' }}>
                          {t('crm.products.form.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modalOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={() => setModalOpen(false)}
          >
            <div
              style={{ background: '#fff', borderRadius: 14, padding: 24, width: '92%', maxWidth: 520, maxHeight: '86vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className={lblCls}>{t('crm.products.fieldTypes.modal.labelField')}</label>
                  <input className={inpCls} value={draft.label} onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.fieldTypes.modal.typeField')}</label>
                  <select
                    className={inpCls}
                    value={draft.type}
                    onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value as ProductFieldType }))}
                    disabled={!!editingId}
                  >
                    {FIELD_TYPES.map((ty) => (
                      <option key={ty} value={ty}>{t(`crm.products.fieldTypes.types.${ty}`)}</option>
                    ))}
                  </select>
                </div>

                {OPTIONS_TYPES.includes(draft.type) && (
                  <div>
                    <label className={lblCls}>{t('crm.products.fieldTypes.modal.optionsField')}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {draft.options.map((o, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8 }}>
                          <input
                            className={inpCls}
                            placeholder={t('crm.products.fieldTypes.modal.optionValue') || ''}
                            value={o.value}
                            onChange={(e) => setDraft((p) => ({ ...p, options: p.options.map((x, i) => i === idx ? { ...x, value: e.target.value } : x) }))}
                          />
                          <input
                            className={inpCls}
                            placeholder={t('crm.products.fieldTypes.modal.optionLabel') || ''}
                            value={o.label}
                            onChange={(e) => setDraft((p) => ({ ...p, options: p.options.map((x, i) => i === idx ? { ...x, label: e.target.value } : x) }))}
                          />
                          <button
                            type="button"
                            onClick={() => setDraft((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }))}
                            style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer', fontSize: 16 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDraft((p) => ({ ...p, options: [...p.options, { value: '', label: '' }] }))}
                        style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer', alignSelf: 'flex-start' }}
                      >
                        {t('crm.products.fieldTypes.modal.addOption')}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className={lblCls}>{t('crm.products.fieldTypes.modal.descriptionField')}</label>
                  <input className={inpCls} value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
                </div>

                <div>
                  <label className={lblCls}>{t('crm.products.fieldTypes.modal.widthField')}</label>
                  <select className={inpCls} value={draft.width} onChange={(e) => setDraft((p) => ({ ...p, width: e.target.value as DraftField['width'] }))}>
                    <option value="25">25%</option>
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={draft.required} onChange={(e) => setDraft((p) => ({ ...p, required: e.target.checked }))} />
                  {t('crm.products.fieldTypes.modal.requiredField')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={draft.showInList} onChange={(e) => setDraft((p) => ({ ...p, showInList: e.target.checked }))} />
                  {t('crm.products.fieldTypes.modal.showInList')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={draft.showInQuickEdit} onChange={(e) => setDraft((p) => ({ ...p, showInQuickEdit: e.target.checked }))} />
                  {t('crm.products.fieldTypes.modal.showInQuickEdit')}
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                  >
                    {t('crm.products.fieldTypes.modal.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !draft.label.trim()}
                    style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer', opacity: saving || !draft.label.trim() ? 0.6 : 1 }}
                  >
                    {t('crm.products.fieldTypes.modal.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
