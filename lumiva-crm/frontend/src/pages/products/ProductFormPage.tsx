// src/pages/products/ProductFormPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchProductCategories,
  fetchProductAttributes,
  fetchProductFieldDefs,
  generateProductVariants,
  updateProductVariant,
  deleteProductVariant,
  type ProductVariant,
  type ProductCategory,
  type ProductAttribute,
  type ProductFieldDef,
  type ProductDto,
  type ProductStatus,
} from '../../api/products';

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'w-full px-3 py-2.5 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5] text-[#222]';
const lblCls = 'block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5 text-[#888]';

const STATUS_OPTIONS: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];

const emptyForm: ProductDto = {
  name: '',
  sku: '',
  description: '',
  categoryId: '',
  status: 'active',
  price: 0,
  costPrice: undefined,
  currency: 'EUR',
  unit: '',
  lowStockThreshold: undefined,
  quantity: 0,
  isVariable: false,
  variantAttributeIds: [],
  customFields: {},
  externalId: '',
};

export const ProductFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductDto>(emptyForm);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [fieldDefs, setFieldDefs] = useState<ProductFieldDef[]>([]);
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);
  const [generatingVariants, setGeneratingVariants] = useState(false);

  useEffect(() => {
    Promise.all([fetchProductCategories(), fetchProductAttributes(), fetchProductFieldDefs()])
      .then(([cats, attrs, fields]) => {
        setCategories(cats);
        setAttributes(attrs);
        setFieldDefs(fields.filter((f) => f.isActive));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProduct(id)
      .then(({ product, variants: v }) => {
        setForm({
          name: product.name,
          sku: product.sku || '',
          description: product.description || '',
          categoryId: product.categoryId || '',
          status: product.status,
          price: Number(product.price),
          costPrice: product.costPrice != null ? Number(product.costPrice) : undefined,
          currency: product.currency,
          unit: product.unit || '',
          lowStockThreshold: product.lowStockThreshold ?? undefined,
          quantity: product.quantity,
          isVariable: product.isVariable,
          variantAttributeIds: product.variantAttributeIds || [],
          customFields: product.customFields || {},
          externalId: product.externalId || '',
        });
        setSelectedAttrIds(product.variantAttributeIds || []);
        setVariants(v);
      })
      .catch((e) => setError(e.message || t('crm.products.form.errors.loadFailed')))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof ProductDto>(field: K, value: ProductDto[K]) =>
    setForm((p) => ({ ...p, [field]: value }));

  const setCustomField = (key: string, value: unknown) =>
    setForm((p) => ({ ...p, customFields: { ...(p.customFields || {}), [key]: value } }));

  const attrById = useMemo(() => new Map(attributes.map((a) => [a.id, a])), [attributes]);

  const describeVariant = (v: ProductVariant): string => {
    const parts = Object.entries(v.attributeValues || {}).map(([attrId, valueId]) => {
      const attr = attrById.get(attrId);
      const value = attr?.values.find((val) => val.id === valueId);
      return value?.label || value?.value || '?';
    });
    return parts.join(' / ') || '—';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      setError(t('crm.products.form.errors.nameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: ProductDto = {
        ...form,
        sku: form.sku || null,
        description: form.description || null,
        categoryId: form.categoryId || null,
        unit: form.unit || null,
        externalId: form.externalId || null,
        costPrice: form.costPrice != null && form.costPrice !== ('' as any) ? Number(form.costPrice) : null,
        lowStockThreshold:
          form.lowStockThreshold != null && form.lowStockThreshold !== ('' as any)
            ? Number(form.lowStockThreshold)
            : null,
        price: Number(form.price) || 0,
      };
      if (id) {
        await updateProduct(id, payload);
        navigate('/products');
      } else {
        const created = await createProduct(payload);
        navigate(`/products/${created.id}`);
      }
    } catch (err: any) {
      setError(err.message || t('crm.products.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const ok = await showConfirm(t('crm.products.list.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProduct(id);
      navigate('/products');
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.deleteFailed'), { variant: 'error' });
    }
  };

  const handleGenerateVariants = async () => {
    if (!id || !selectedAttrIds.length) return;
    setGeneratingVariants(true);
    try {
      const v = await generateProductVariants(id, selectedAttrIds);
      setVariants(v);
      set('isVariable', true);
      set('variantAttributeIds', selectedAttrIds);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setGeneratingVariants(false);
    }
  };

  const handleVariantChange = async (variantId: string, patch: Partial<{ sku: string | null; priceOverride: number | null; isActive: boolean }>) => {
    if (!id) return;
    try {
      const updated = await updateProductVariant(id, variantId, patch);
      setVariants((prev) => prev.map((v) => (v.id === variantId ? updated : v)));
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleVariantQuantityAdjust = async () => {
    // Остаток варианта меняется только через раздел «Склад» (движение остатков) — переходим туда.
    navigate('/products/stock');
  };

  const handleVariantDelete = async (variantId: string) => {
    if (!id) return;
    const ok = await showConfirm(t('crm.products.list.deleteConfirm'));
    if (!ok) return;
    try {
      await deleteProductVariant(id, variantId);
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.common.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ color: INK }}>
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 20, marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => navigate('/products')}
            style={{ fontSize: 11, color: FG3, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← {t('crm.products.form.backToList')}
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: FG4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {isNew ? t('crm.products.form.newTitle') : t('crm.products.form.editTitle')}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: INK, marginTop: 6, lineHeight: 1.1 }}>
                {form.name?.trim() || '—'}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isNew && (
                <button
                  type="button"
                  onClick={handleDelete}
                  style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: '#9a1f31', cursor: 'pointer' }}
                >
                  {t('crm.products.form.actions.delete')}
                </button>
              )}
              <button
                type="submit"
                form="product-form"
                disabled={saving}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer', opacity: saving ? 0.65 : 1 }}
              >
                {saving ? t('crm.common.saving') : isNew ? t('crm.products.form.actions.create') : t('crm.products.form.actions.save')}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, border: '1px solid #f0c8cf', background: '#fbecef', fontSize: 12, color: '#9a1f31' }}>
            {error}
          </div>
        )}

        <form id="product-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label className={lblCls}>{t('crm.products.form.fields.name')} *</label>
                <input className={inpCls} value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.sku')}</label>
                  <input className={inpCls} value={form.sku || ''} onChange={(e) => set('sku', e.target.value)} />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.externalId')}</label>
                  <input className={inpCls} value={form.externalId || ''} onChange={(e) => set('externalId', e.target.value)} />
                </div>
              </div>

              <div>
                <label className={lblCls}>{t('crm.products.form.fields.description')}</label>
                <textarea
                  className={inpCls}
                  value={form.description || ''}
                  onChange={(e) => set('description', e.target.value)}
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.price')}</label>
                  <input type="number" step="0.01" className={inpCls} value={form.price ?? 0} onChange={(e) => set('price', Number(e.target.value))} />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.costPrice')}</label>
                  <input type="number" step="0.01" className={inpCls} value={form.costPrice ?? ''} onChange={(e) => set('costPrice', e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.currency')}</label>
                  <input className={inpCls} value={form.currency || 'EUR'} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={3} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.unit')}</label>
                  <input className={inpCls} value={form.unit || ''} onChange={(e) => set('unit', e.target.value)} placeholder="шт." />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.lowStockThreshold')}</label>
                  <input type="number" className={inpCls} value={form.lowStockThreshold ?? ''} onChange={(e) => set('lowStockThreshold', e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>
              </div>

              {/* ── Вариативность ─────────────────────────────────── */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!form.isVariable}
                    onChange={(e) => set('isVariable', e.target.checked)}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t('crm.products.form.variable.label')}</span>
                </label>
                <div style={{ fontSize: 12, color: FG3, marginTop: 6 }}>{t('crm.products.form.variable.hint')}</div>

                {form.isVariable && (
                  <div style={{ marginTop: 16, borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>{t('crm.products.form.variants.attributesLabel')}</div>
                    <div style={{ fontSize: 12, color: FG3, marginBottom: 10 }}>{t('crm.products.form.variants.attributesHint')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {attributes.map((a) => {
                        const checked = selectedAttrIds.includes(a.id);
                        return (
                          <label
                            key={a.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                              borderRadius: 999, border: `1px solid ${checked ? INK : LINE}`,
                              background: checked ? INK : '#fff', color: checked ? '#fff' : FG3,
                              fontSize: 12, cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedAttrIds((prev) =>
                                  e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id),
                                );
                              }}
                              style={{ display: 'none' }}
                            />
                            {a.name}
                          </label>
                        );
                      })}
                      {!attributes.length && (
                        <span style={{ fontSize: 12, color: FG4 }}>{t('crm.products.attributes.empty')}</span>
                      )}
                    </div>

                    {isNew ? (
                      <div style={{ fontSize: 12, color: FG4 }}>{t('crm.products.form.actions.save')} → {t('crm.products.form.variants.generateButton')}</div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateVariants}
                        disabled={!selectedAttrIds.length || generatingVariants}
                        style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: `1px solid ${INK}`, background: '#fff', color: INK, cursor: 'pointer', opacity: !selectedAttrIds.length || generatingVariants ? 0.5 : 1 }}
                      >
                        {generatingVariants ? t('crm.common.saving') : t('crm.products.form.variants.generateButton')}
                      </button>
                    )}

                    {!!variants.length && (
                      <div style={{ marginTop: 16, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: BG_MUTED, borderBottom: `1px solid ${LINE}` }}>
                              {['combination', 'sku', 'quantity', 'priceOverride', 'active'].map((c) => (
                                <th key={c} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: FG3 }}>
                                  {t(`crm.products.form.variants.table.${c}`)}
                                </th>
                              ))}
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((v) => (
                              <tr key={v.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                                <td style={{ padding: '8px 10px' }}>{describeVariant(v)}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <input
                                    defaultValue={v.sku || ''}
                                    onBlur={(e) => {
                                      if (e.target.value !== (v.sku || '')) {
                                        handleVariantChange(v.id, { sku: e.target.value || null });
                                      }
                                    }}
                                    style={{ width: 100, padding: '4px 6px', border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 12 }}
                                  />
                                </td>
                                <td
                                  style={{ padding: '8px 10px', cursor: 'pointer', textDecoration: 'underline dotted' }}
                                  onClick={() => handleVariantQuantityAdjust()}
                                  title={t('crm.products.stock.title') || ''}
                                >
                                  {v.quantity}
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    defaultValue={v.priceOverride ?? ''}
                                    onBlur={(e) => {
                                      const val = e.target.value === '' ? null : Number(e.target.value);
                                      if (val !== (v.priceOverride != null ? Number(v.priceOverride) : null)) {
                                        handleVariantChange(v.id, { priceOverride: val });
                                      }
                                    }}
                                    style={{ width: 90, padding: '4px 6px', border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 12 }}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <input
                                    type="checkbox"
                                    checked={v.isActive}
                                    onChange={(e) => handleVariantChange(v.id, { isActive: e.target.checked })}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleVariantDelete(v.id)}
                                    style={{ fontSize: 11, color: '#9a1f31', background: 'none', border: 'none', cursor: 'pointer' }}
                                  >
                                    {t('crm.products.form.actions.delete')}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {!form.isVariable && (
                  <div style={{ marginTop: 14 }}>
                    <label className={lblCls}>{t('crm.products.list.columns.quantity')}</label>
                    <input
                      type="number"
                      className={inpCls}
                      value={form.quantity ?? 0}
                      onChange={(e) => set('quantity', Number(e.target.value))}
                      disabled={!isNew}
                      title={!isNew ? t('crm.products.stock.title') || '' : undefined}
                    />
                    {!isNew && (
                      <div style={{ fontSize: 11, color: FG4, marginTop: 4 }}>
                        {t('crm.products.stock.title')} → <button type="button" onClick={() => navigate('/products/stock')} style={{ textDecoration: 'underline', background: 'none', border: 'none', color: FG3, cursor: 'pointer', padding: 0 }}>{t('crm.products.stock.adjustButton')}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Дополнительные поля ────────────────────────────── */}
              {!!fieldDefs.length && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{t('crm.products.form.customFields.title')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fieldDefs.map((f) => {
                      const value = (form.customFields || {})[f.key];
                      if (f.type === 'boolean') {
                        return (
                          <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <input type="checkbox" checked={!!value} onChange={(e) => setCustomField(f.key, e.target.checked)} />
                            {f.label}
                          </label>
                        );
                      }
                      if (f.type === 'select' || f.type === 'radio') {
                        return (
                          <div key={f.id}>
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <select className={inpCls} value={(value as string) || ''} onChange={(e) => setCustomField(f.key, e.target.value)}>
                              <option value="">—</option>
                              {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                        );
                      }
                      if (f.type === 'multiselect') {
                        const arr = Array.isArray(value) ? (value as string[]) : [];
                        return (
                          <div key={f.id}>
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {(f.options || []).map((o) => {
                                const checked = arr.includes(o.value);
                                return (
                                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 8px', borderRadius: 999, border: `1px solid ${LINE}` }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const next = e.target.checked ? [...arr, o.value] : arr.filter((v) => v !== o.value);
                                        setCustomField(f.key, next);
                                      }}
                                    />
                                    {o.label}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      if (f.type === 'textarea') {
                        return (
                          <div key={f.id} className="sm:col-span-2">
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <textarea className={inpCls} rows={3} value={(value as string) || ''} onChange={(e) => setCustomField(f.key, e.target.value)} style={{ resize: 'vertical' }} />
                          </div>
                        );
                      }
                      return (
                        <div key={f.id}>
                          <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                          <input
                            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : f.type === 'url' ? 'url' : 'text'}
                            className={inpCls}
                            value={(value as string) ?? ''}
                            onChange={(e) => setCustomField(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right sidebar ──────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: BG_MUTED }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 12 }}>
                  {t('crm.products.form.fields.status')}
                </div>
                <select className={inpCls} value={form.status} onChange={(e) => set('status', e.target.value as ProductStatus)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{t(`crm.products.status.${s}`)}</option>
                  ))}
                </select>
              </div>

              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, background: BG_MUTED }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 12 }}>
                  {t('crm.products.form.fields.category')}
                </div>
                <select className={inpCls} value={form.categoryId || ''} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">{t('crm.products.form.fields.categoryPlaceholder')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {!isNew && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 10 }}>
                    ID
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: FG3, wordBreak: 'break-all' }}>
                    {id}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};
