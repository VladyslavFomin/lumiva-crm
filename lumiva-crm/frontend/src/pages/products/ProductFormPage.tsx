// src/pages/products/ProductFormPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { resolvePublicAssetUrl } from '../../api/client';
import {
  fetchProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchProductCategories,
  fetchProductAttributes,
  addProductAttributeValue,
  removeProductAttributeValue,
  fetchProductFieldDefs,
  generateProductVariants,
  updateProductVariant,
  deleteProductVariant,
  adjustProductStock,
  fetchProducts,
  fetchProductChangeLogs,
  requestProductPublication,
  approveProductPublication,
  rejectProductPublication,
  unpublishProduct,
  type ProductVariant,
  type ProductCategory,
  type ProductAttribute,
  type ProductFieldDef,
  type ProductDto,
  type ProductStatus,
  type ProductImage,
  type Product,
  type ProductPriceTier,
  type ProductBundleItem,
  type ProductTranslation,
  type ProductChangeLog,
} from '../../api/products';
import { fetchSites, type Site } from '../../api/sites';
import { ProductImageField, ProductGalleryField } from './ProductImageField';
import { ProductBarcodePreview } from './ProductBarcodePreview';

const TRANSLATION_LOCALES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
];

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'w-full px-3 py-2.5 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5] text-[#222]';
const lblCls = 'block text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5 text-[#888]';

const STATUS_OPTIONS: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Минимальный WYSIWYG на contentEditable + execCommand — без тяжёлой зависимости. */
const SimpleWysiwygEditor: React.FC<{ value: string; onChange: (html: string) => void }> = ({ value, onChange }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const isFirstRender = React.useRef(true);

  useEffect(() => {
    if (isFirstRender.current && ref.current) {
      ref.current.innerHTML = value || '';
      isFirstRender.current = false;
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const btnStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: `1px solid ${LINE}`, background: '#fff',
    cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button type="button" style={{ ...btnStyle, fontWeight: 700 }} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>B</button>
        <button type="button" style={{ ...btnStyle, fontStyle: 'italic' }} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}>I</button>
        <button type="button" style={{ ...btnStyle, textDecoration: 'underline' }} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}>U</button>
        <button type="button" style={btnStyle} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')}>•</button>
        <button
          type="button"
          style={btnStyle}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = window.prompt('URL');
            if (url) exec('createLink', url);
          }}
        >
          🔗
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        onBlur={() => ref.current && onChange(ref.current.innerHTML)}
        style={{
          minHeight: 100, border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px',
          fontSize: 13, outline: 'none', lineHeight: 1.5,
        }}
      />
    </div>
  );
};

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
  images: [],
  slug: '',
  metaTitle: '',
  metaDescription: '',
  weight: undefined,
  dimensions: undefined,
  barcode: '',
  tags: [],
  relatedProductIds: [],
  translations: {},
  salePrice: undefined,
  saleStartAt: '',
  saleEndAt: '',
  priceTiers: [],
  isBundle: false,
  bundleItems: [],
  prices: [],
  siteIds: [],
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
  const [expandedVariantImagesId, setExpandedVariantImagesId] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [changeLogs, setChangeLogs] = useState<ProductChangeLog[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [translationTab, setTranslationTab] = useState<string>(TRANSLATION_LOCALES[0].code);
  const [sites, setSites] = useState<Site[]>([]);
  const [publicationInfo, setPublicationInfo] = useState<Product | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [rejectReasonDraft, setRejectReasonDraft] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [attrValueDrafts, setAttrValueDrafts] = useState<Record<string, string>>({});
  const [savingAttrValue, setSavingAttrValue] = useState<string | null>(null);
  const [adjustingVariantId, setAdjustingVariantId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchProductCategories(), fetchProductAttributes(), fetchProductFieldDefs(), fetchProducts({ limit: 200 }), fetchSites()])
      .then(([cats, attrs, fields, productsRes, sitesRes]) => {
        setCategories(cats);
        setAttributes(attrs);
        setFieldDefs(fields.filter((f) => f.isActive));
        setAllProducts(productsRes.items);
        setSites(sitesRes);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchProductChangeLogs(id).then(setChangeLogs).catch(() => {});
  }, [id]);

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
          images: product.images || [],
          slug: product.slug || '',
          metaTitle: product.metaTitle || '',
          metaDescription: product.metaDescription || '',
          weight: product.weight != null ? Number(product.weight) : undefined,
          dimensions: product.dimensions || undefined,
          barcode: product.barcode || '',
          tags: product.tags || [],
          relatedProductIds: product.relatedProductIds || [],
          translations: product.translations || {},
          salePrice: product.salePrice != null ? Number(product.salePrice) : undefined,
          saleStartAt: product.saleStartAt ? product.saleStartAt.slice(0, 10) : '',
          saleEndAt: product.saleEndAt ? product.saleEndAt.slice(0, 10) : '',
          priceTiers: product.priceTiers || [],
          isBundle: product.isBundle,
          bundleItems: product.bundleItems || [],
          prices: product.prices || [],
          siteIds: product.siteIds || [],
        });
        setPublicationInfo(product);
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
        slug: form.slug || null,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        weight: form.weight != null && form.weight !== ('' as any) ? Number(form.weight) : null,
        barcode: form.barcode || null,
        salePrice: form.salePrice != null && form.salePrice !== ('' as any) ? Number(form.salePrice) : null,
        saleStartAt: form.saleStartAt || null,
        saleEndAt: form.saleEndAt || null,
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
      cancelLabel: t('crm.confirmModal.cancel', { defaultValue: 'Отмена' }),
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

  const handleRequestPublication = async () => {
    if (!id) return;
    setPublishBusy(true);
    try {
      const updated = await requestProductPublication(id);
      setPublicationInfo(updated);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setPublishBusy(false);
    }
  };

  const handleApprovePublication = async () => {
    if (!id) return;
    setPublishBusy(true);
    try {
      const updated = await approveProductPublication(id);
      setPublicationInfo(updated);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setPublishBusy(false);
    }
  };

  const handleRejectPublication = async () => {
    if (!id) return;
    setPublishBusy(true);
    try {
      const updated = await rejectProductPublication(id, rejectReasonDraft || undefined);
      setPublicationInfo(updated);
      setShowRejectBox(false);
      setRejectReasonDraft('');
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setPublishBusy(false);
    }
  };

  const handleUnpublish = async () => {
    if (!id) return;
    setPublishBusy(true);
    try {
      const updated = await unpublishProduct(id);
      setPublicationInfo(updated);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setPublishBusy(false);
    }
  };

  const reloadAttributes = () => {
    fetchProductAttributes().then(setAttributes).catch(() => {});
  };

  const handleAddAttrValue = async (attrId: string) => {
    const value = (attrValueDrafts[attrId] || '').trim();
    if (!value) return;
    setSavingAttrValue(attrId);
    try {
      await addProductAttributeValue(attrId, { value });
      setAttrValueDrafts((prev) => ({ ...prev, [attrId]: '' }));
      reloadAttributes();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.attributes.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSavingAttrValue(null);
    }
  };

  const handleRemoveAttrValue = async (attrId: string, valueId: string) => {
    try {
      await removeProductAttributeValue(attrId, valueId);
      reloadAttributes();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.attributes.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleVariantQuantityDelta = async (variantId: string, delta: number) => {
    if (!id) return;
    setAdjustingVariantId(variantId);
    try {
      await adjustProductStock({ productId: id, variantId, delta, reason: t('crm.products.form.variants.table.quantity') });
      const { variants: v } = await fetchProduct(id);
      setVariants(v);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setAdjustingVariantId(null);
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

  const handleVariantChange = async (variantId: string, patch: Partial<{ sku: string | null; priceOverride: number | null; isActive: boolean; images: ProductImage[] | null }>) => {
    if (!id) return;
    try {
      const updated = await updateProductVariant(id, variantId, patch);
      setVariants((prev) => prev.map((v) => (v.id === variantId ? updated : v)));
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    }
  };

  const handleVariantDelete = async (variantId: string) => {
    if (!id) return;
    const ok = await showConfirm(t('crm.products.list.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      cancelLabel: t('crm.confirmModal.cancel', { defaultValue: 'Отмена' }),
      danger: true,
    });
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
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

              <div>
                <label className={lblCls}>{t('crm.products.form.fields.mainImage')}</label>
                <ProductImageField
                  value={(form.images && form.images[0]) || null}
                  onChange={(img) => set('images', img ? [{ ...img, isCover: true }] : [])}
                  onError={(msg) => showAlert(msg, { variant: 'error' })}
                />
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
                <label className={lblCls}>{t('crm.products.form.fields.barcode')}</label>
                <input className={inpCls} value={form.barcode || ''} onChange={(e) => set('barcode', e.target.value)} placeholder="EAN / UPC / Code128" />
                <ProductBarcodePreview value={form.barcode || ''} />
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
              {form.costPrice != null && Number(form.price) > 0 && (
                <div style={{ fontSize: 12, color: FG3, marginTop: -12 }}>
                  {t('crm.products.form.fields.margin')}:{' '}
                  <b style={{ color: INK }}>
                    {(((Number(form.price) - Number(form.costPrice)) / Number(form.price)) * 100).toFixed(1)}%
                  </b>
                </div>
              )}

              {/* ── Цены в других валютах ─────────────────────────── */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t('crm.products.form.prices.title')}</div>
                <div style={{ fontSize: 12, color: FG3, marginBottom: 12 }}>{t('crm.products.form.prices.hint')}</div>
                {(form.prices || []).map((p, i) => (
                  <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input
                      className={inpCls}
                      style={{ width: 80 }}
                      value={p.currency}
                      maxLength={3}
                      placeholder={t('crm.products.form.prices.currencyPlaceholder') || ''}
                      onChange={(e) => {
                        const next = [...(form.prices || [])];
                        next[i] = { ...next[i], currency: e.target.value.toUpperCase() };
                        set('prices', next);
                      }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className={inpCls}
                      style={{ width: 140 }}
                      value={p.price}
                      onChange={(e) => {
                        const next = [...(form.prices || [])];
                        next[i] = { ...next[i], price: Number(e.target.value) };
                        set('prices', next);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => set('prices', (form.prices || []).filter((_, idx) => idx !== i))}
                      style={{ fontSize: 12, color: '#9a1f31', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {t('crm.products.form.actions.delete')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set('prices', [...(form.prices || []), { currency: '', price: 0 }])}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                >
                  {t('crm.products.form.prices.addButton')}
                </button>
              </div>

              {/* ── Скидка ────────────────────────────────────────── */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{t('crm.products.form.sale.title')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={lblCls}>{t('crm.products.form.sale.price')}</label>
                    <input type="number" step="0.01" className={inpCls} value={form.salePrice ?? ''} onChange={(e) => set('salePrice', e.target.value === '' ? undefined : Number(e.target.value))} />
                  </div>
                  <div>
                    <label className={lblCls}>{t('crm.products.form.sale.startAt')}</label>
                    <input type="date" className={inpCls} value={form.saleStartAt || ''} onChange={(e) => set('saleStartAt', e.target.value)} />
                  </div>
                  <div>
                    <label className={lblCls}>{t('crm.products.form.sale.endAt')}</label>
                    <input type="date" className={inpCls} value={form.saleEndAt || ''} onChange={(e) => set('saleEndAt', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* ── Оптовые пороги цены ──────────────────────────────── */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{t('crm.products.form.priceTiers.title')}</div>
                {(form.priceTiers || []).map((tier, i) => (
                  <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="number"
                      placeholder={t('crm.products.form.priceTiers.minQty') || ''}
                      className={inpCls}
                      style={{ width: 120 }}
                      value={tier.minQty}
                      onChange={(e) => {
                        const next = [...(form.priceTiers || [])];
                        next[i] = { ...next[i], minQty: Number(e.target.value) };
                        set('priceTiers', next);
                      }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder={t('crm.products.form.priceTiers.price') || ''}
                      className={inpCls}
                      style={{ width: 120 }}
                      value={tier.price}
                      onChange={(e) => {
                        const next = [...(form.priceTiers || [])];
                        next[i] = { ...next[i], price: Number(e.target.value) };
                        set('priceTiers', next);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => set('priceTiers', (form.priceTiers || []).filter((_, idx) => idx !== i))}
                      style={{ fontSize: 12, color: '#9a1f31', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {t('crm.products.form.actions.delete')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set('priceTiers', [...(form.priceTiers || []), { minQty: 1, price: 0 } as ProductPriceTier])}
                  style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                >
                  {t('crm.products.form.priceTiers.add')}
                </button>
              </div>

              {/* ── Вес и габариты ───────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.weight')}</label>
                  <input type="number" step="0.001" className={inpCls} value={form.weight ?? ''} onChange={(e) => set('weight', e.target.value === '' ? undefined : Number(e.target.value))} />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.length')}</label>
                  <input type="number" className={inpCls} value={form.dimensions?.length ?? ''} onChange={(e) => set('dimensions', { ...(form.dimensions || {}), length: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.width')}</label>
                  <input type="number" className={inpCls} value={form.dimensions?.width ?? ''} onChange={(e) => set('dimensions', { ...(form.dimensions || {}), width: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.form.fields.height')}</label>
                  <input type="number" className={inpCls} value={form.dimensions?.height ?? ''} onChange={(e) => set('dimensions', { ...(form.dimensions || {}), height: e.target.value === '' ? undefined : Number(e.target.value) })} />
                </div>
              </div>

              {/* ── Теги ─────────────────────────────────────────────── */}
              <div>
                <label className={lblCls}>{t('crm.products.form.fields.tags')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {(form.tags || []).map((tag) => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: BG_MUTED, border: `1px solid ${LINE}`, fontSize: 12 }}>
                      {tag}
                      <button type="button" onClick={() => set('tags', (form.tags || []).filter((t2) => t2 !== tag))} style={{ background: 'none', border: 'none', color: FG3, cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
                <input
                  className={inpCls}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      const v = tagInput.trim();
                      if (!(form.tags || []).includes(v)) set('tags', [...(form.tags || []), v]);
                      setTagInput('');
                    }
                  }}
                  placeholder={t('crm.products.form.fields.tagsPlaceholder') || ''}
                />
              </div>

              {/* ── SEO ──────────────────────────────────────────────── */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{t('crm.products.form.seo.title')}</div>
                <div style={{ marginBottom: 12 }}>
                  <label className={lblCls}>{t('crm.products.form.seo.slug')}</label>
                  <input className={inpCls} value={form.slug || ''} onChange={(e) => set('slug', e.target.value)} placeholder="product-url-slug" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className={lblCls}>{t('crm.products.form.seo.metaTitle')}</label>
                  <input className={inpCls} value={form.metaTitle || ''} onChange={(e) => set('metaTitle', e.target.value)} />
                </div>
                <div>
                  <label className={lblCls}>{t('crm.products.form.seo.metaDescription')}</label>
                  <textarea className={inpCls} rows={2} value={form.metaDescription || ''} onChange={(e) => set('metaDescription', e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>

              {/* ── Публичный каталог / модерация публикации ──────────── */}
              {!isNew && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t('crm.products.form.publicCatalog.title')}</div>
                  <div style={{ fontSize: 11, color: FG4, marginBottom: 14 }}>{t('crm.products.form.publicCatalog.hint')}</div>

                  {publicationInfo?.isPubliclyVisible ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1f8a5e', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ● {t('crm.products.form.publicCatalog.statusPublished')}
                      </span>
                      <button type="button" onClick={handleUnpublish} disabled={publishBusy} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: '#9a1f31', cursor: 'pointer' }}>
                        {t('crm.products.form.publicCatalog.unpublishButton')}
                      </button>
                    </div>
                  ) : publicationInfo?.publicationRequestedAt ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#c08319', marginBottom: 10 }}>
                        ● {t('crm.products.form.publicCatalog.statusPending')}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button type="button" onClick={handleApprovePublication} disabled={publishBusy} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer' }}>
                          {t('crm.products.form.publicCatalog.approveButton')}
                        </button>
                        <button type="button" onClick={() => setShowRejectBox((v) => !v)} disabled={publishBusy} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: '#9a1f31', cursor: 'pointer' }}>
                          {t('crm.products.form.publicCatalog.rejectButton')}
                        </button>
                      </div>
                      {showRejectBox && (
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <input
                            className={inpCls}
                            style={{ flex: '1 1 160px', minWidth: 0 }}
                            value={rejectReasonDraft}
                            onChange={(e) => setRejectReasonDraft(e.target.value)}
                            placeholder={t('crm.products.form.publicCatalog.rejectReasonPlaceholder') || ''}
                          />
                          <button type="button" onClick={handleRejectPublication} disabled={publishBusy} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer' }}>
                            {t('crm.products.form.publicCatalog.rejectConfirm')}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {publicationInfo?.publicationRejectedAt && (
                        <div style={{ fontSize: 11, color: '#9a1f31', marginBottom: 10 }}>
                          {t('crm.products.form.publicCatalog.rejectedNote')}
                          {publicationInfo.publicationRejectionReason ? `: ${publicationInfo.publicationRejectionReason}` : ''}
                        </div>
                      )}
                      <button type="button" onClick={handleRequestPublication} disabled={publishBusy} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer' }}>
                        {t('crm.products.form.publicCatalog.requestButton')}
                      </button>
                    </div>
                  )}

                  {!!sites.length && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
                      <label className={lblCls}>{t('crm.products.form.publicCatalog.sitesLabel')}</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                        {sites.map((s) => {
                          const checked = !form.siteIds?.length || form.siteIds.includes(s.id);
                          const allSelected = !form.siteIds?.length;
                          return (
                            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const current = allSelected ? sites.map((x) => x.id) : (form.siteIds || []);
                                  const next = e.target.checked
                                    ? [...new Set([...current, s.id])]
                                    : current.filter((sid) => sid !== s.id);
                                  set('siteIds', next.length === sites.length ? [] : next);
                                }}
                              />
                              {s.name || s.domain}
                            </label>
                          );
                        })}
                      </div>
                      <div className="ai-hint" style={{ fontSize: 10.5, color: FG4, marginTop: 6 }}>
                        {t('crm.products.form.publicCatalog.sitesHint')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Переводы ─────────────────────────────────────────── */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{t('crm.products.form.translations.title')}</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {TRANSLATION_LOCALES.map((loc) => (
                    <button
                      key={loc.code}
                      type="button"
                      onClick={() => setTranslationTab(loc.code)}
                      style={{
                        padding: '6px 14px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${translationTab === loc.code ? INK : LINE}`,
                        background: translationTab === loc.code ? INK : '#fff',
                        color: translationTab === loc.code ? '#fff' : FG3,
                      }}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
                {(() => {
                  const tr: ProductTranslation = (form.translations || {})[translationTab] || {};
                  const setTr = (patch: Partial<ProductTranslation>) =>
                    set('translations', { ...(form.translations || {}), [translationTab]: { ...tr, ...patch } });
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label className={lblCls}>{t('crm.products.form.fields.name')}</label>
                        <input className={inpCls} value={tr.name || ''} onChange={(e) => setTr({ name: e.target.value })} />
                      </div>
                      <div>
                        <label className={lblCls}>{t('crm.products.form.fields.description')}</label>
                        <textarea className={inpCls} rows={3} value={tr.description || ''} onChange={(e) => setTr({ description: e.target.value })} style={{ resize: 'vertical' }} />
                      </div>
                      <div>
                        <label className={lblCls}>{t('crm.products.form.seo.metaTitle')}</label>
                        <input className={inpCls} value={tr.metaTitle || ''} onChange={(e) => setTr({ metaTitle: e.target.value })} />
                      </div>
                      <div>
                        <label className={lblCls}>{t('crm.products.form.seo.metaDescription')}</label>
                        <textarea className={inpCls} rows={2} value={tr.metaDescription || ''} onChange={(e) => setTr({ metaDescription: e.target.value })} style={{ resize: 'vertical' }} />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Похожие товары ───────────────────────────────────── */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{t('crm.products.form.related.title')}</div>
                <select
                  multiple
                  className={inpCls}
                  style={{ height: 120 }}
                  value={form.relatedProductIds || []}
                  onChange={(e) => set('relatedProductIds', Array.from(e.target.selectedOptions).map((o) => o.value))}
                >
                  {allProducts.filter((p) => p.id !== id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                  ))}
                </select>
                <div className="ai-hint" style={{ fontSize: 11, color: FG4, marginTop: 6 }}>{t('crm.products.form.related.hint')}</div>
              </div>

              {/* ── Комплект ─────────────────────────────────────────── */}
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.isBundle} onChange={(e) => set('isBundle', e.target.checked)} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t('crm.products.form.bundle.label')}</span>
                </label>
                <div style={{ fontSize: 12, color: FG3, marginTop: 6 }}>{t('crm.products.form.bundle.hint')}</div>
                {form.isBundle && (
                  <div style={{ marginTop: 16, borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
                    {(form.bundleItems || []).map((item, i) => {
                      const p = allProducts.find((x) => x.id === item.productId);
                      return (
                        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ flex: '1 1 140px', minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p?.name || item.productId}</div>
                          <input
                            type="number"
                            className={inpCls}
                            style={{ width: 90 }}
                            value={item.quantity}
                            onChange={(e) => {
                              const next = [...(form.bundleItems || [])];
                              next[i] = { ...next[i], quantity: Number(e.target.value) };
                              set('bundleItems', next);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => set('bundleItems', (form.bundleItems || []).filter((_, idx) => idx !== i))}
                            style={{ fontSize: 12, color: '#9a1f31', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            {t('crm.products.form.actions.delete')}
                          </button>
                        </div>
                      );
                    })}
                    <select
                      className={inpCls}
                      value=""
                      onChange={(e) => {
                        const productId = e.target.value;
                        if (!productId) return;
                        if ((form.bundleItems || []).some((b) => b.productId === productId)) return;
                        set('bundleItems', [...(form.bundleItems || []), { productId, quantity: 1 } as ProductBundleItem]);
                      }}
                    >
                      <option value="">{t('crm.products.form.bundle.addItem')}</option>
                      {allProducts.filter((p) => p.id !== id && !p.isBundle).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
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

                    {!!selectedAttrIds.length && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                        {selectedAttrIds.map((attrId) => {
                          const attr = attrById.get(attrId);
                          if (!attr) return null;
                          return (
                            <div key={attrId} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 10 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 500, marginBottom: 6 }}>{attr.name}</div>
                              {!attr.values.length && (
                                <div style={{ fontSize: 11, color: '#c08319', marginBottom: 6 }}>
                                  {t('crm.products.form.variants.noValuesHint')}
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                {attr.values.map((v) => (
                                  <span
                                    key={v.id}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px',
                                      borderRadius: 999, background: BG_MUTED, border: `1px solid ${LINE}`, fontSize: 11.5,
                                    }}
                                  >
                                    {v.label}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAttrValue(attrId, v.id)}
                                      style={{ background: 'none', border: 'none', color: FG3, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                  value={attrValueDrafts[attrId] || ''}
                                  onChange={(e) => setAttrValueDrafts((prev) => ({ ...prev, [attrId]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAttrValue(attrId); } }}
                                  placeholder={t('crm.products.attributes.addValueLabel') || ''}
                                  style={{ flex: '0 1 180px', padding: '5px 8px', fontSize: 11.5, border: `1px solid ${LINE}`, borderRadius: 6 }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddAttrValue(attrId)}
                                  disabled={savingAttrValue === attrId}
                                  style={{ padding: '5px 12px', fontSize: 11.5, borderRadius: 6, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                                >
                                  {t('crm.products.attributes.addValueButton')}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

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
                      <div style={{ marginTop: 16, border: `1px solid ${LINE}`, borderRadius: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: BG_MUTED, borderBottom: `1px solid ${LINE}` }}>
                              {['combination', 'sku', 'quantity', 'priceOverride', 'active', 'images'].map((c) => (
                                <th key={c} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: FG3 }}>
                                  {t(`crm.products.form.variants.table.${c}`)}
                                </th>
                              ))}
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((v) => (
                              <React.Fragment key={v.id}>
                              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
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
                                <td style={{ padding: '8px 10px' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <button
                                      type="button"
                                      onClick={() => handleVariantQuantityDelta(v.id, -1)}
                                      disabled={adjustingVariantId === v.id}
                                      style={{ width: 22, height: 22, border: `1px solid ${LINE}`, background: '#fff', color: FG3, borderRadius: 6, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                                    >
                                      −
                                    </button>
                                    <input
                                      key={v.quantity}
                                      type="number"
                                      defaultValue={v.quantity}
                                      disabled={adjustingVariantId === v.id}
                                      onBlur={(e) => {
                                        const next = Number(e.target.value);
                                        if (Number.isFinite(next) && next !== v.quantity) {
                                          handleVariantQuantityDelta(v.id, next - v.quantity);
                                        }
                                      }}
                                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                      style={{ width: 56, padding: '4px 6px', border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 12, textAlign: 'center' }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleVariantQuantityDelta(v.id, 1)}
                                      disabled={adjustingVariantId === v.id}
                                      style={{ width: 22, height: 22, border: `1px solid ${LINE}`, background: '#fff', color: FG3, borderRadius: 6, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                                    >
                                      +
                                    </button>
                                  </div>
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
                                    onClick={() =>
                                      setExpandedVariantImagesId((prev) => (prev === v.id ? null : v.id))
                                    }
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                                      background: 'none', border: `1px solid ${LINE}`, borderRadius: 6,
                                      padding: '3px 8px', cursor: 'pointer', color: FG3,
                                    }}
                                  >
                                    {v.images?.[0] ? (
                                      <img
                                        src={resolvePublicAssetUrl(v.images[0].url) || v.images[0].url}
                                        alt=""
                                        style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }}
                                      />
                                    ) : null}
                                    {v.images?.length ? v.images.length : t('crm.products.form.variants.table.images')}
                                  </button>
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleVariantDelete(v.id)}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {t('crm.products.form.actions.delete')}
                                  </button>
                                </td>
                              </tr>
                              {expandedVariantImagesId === v.id && (
                                <tr style={{ borderBottom: `1px solid ${LINE}`, background: BG_MUTED }}>
                                  <td colSpan={7} style={{ padding: '10px 12px' }}>
                                    <div style={{ fontSize: 11, color: FG3, marginBottom: 8 }}>
                                      {t('crm.products.form.variants.imagesHint')}
                                    </div>
                                    <ProductGalleryField
                                      value={v.images || []}
                                      onChange={(images) =>
                                        handleVariantChange(v.id, { images: images.length ? images : null })
                                      }
                                      onError={(msg) => showAlert(msg, { variant: 'error' })}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setExpandedVariantImagesId(null)}
                                      style={{
                                        marginTop: 8, fontSize: 11, background: 'none', border: 'none',
                                        color: FG3, cursor: 'pointer', textDecoration: 'underline',
                                      }}
                                    >
                                      {t('crm.products.form.variants.imagesClose')}
                                    </button>
                                  </td>
                                </tr>
                              )}
                              </React.Fragment>
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
                      if (f.type === 'media') {
                        const img = (value as ProductImage | undefined) || null;
                        return (
                          <div key={f.id}>
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <ProductImageField
                              value={img}
                              onChange={(next) => setCustomField(f.key, next)}
                              onError={(msg) => showAlert(msg, { variant: 'error' })}
                            />
                          </div>
                        );
                      }
                      if (f.type === 'gallery') {
                        const imgs = Array.isArray(value) ? (value as ProductImage[]) : [];
                        return (
                          <div key={f.id} className="sm:col-span-2">
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <ProductGalleryField
                              value={imgs}
                              onChange={(next) => setCustomField(f.key, next)}
                              onError={(msg) => showAlert(msg, { variant: 'error' })}
                            />
                          </div>
                        );
                      }
                      if (f.type === 'url') {
                        const youtubeId = extractYoutubeId((value as string) || '');
                        return (
                          <div key={f.id}>
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <input
                              type="url"
                              className={inpCls}
                              value={(value as string) ?? ''}
                              placeholder={t('crm.products.form.fields.videoUrlHint') || ''}
                              onChange={(e) => setCustomField(f.key, e.target.value)}
                            />
                            {youtubeId && (
                              <img
                                src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                                alt=""
                                style={{ marginTop: 8, width: 120, borderRadius: 8, border: `1px solid ${LINE}` }}
                              />
                            )}
                          </div>
                        );
                      }
                      if (f.type === 'wysiwyg') {
                        return (
                          <div key={f.id} className="sm:col-span-2">
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <SimpleWysiwygEditor value={(value as string) || ''} onChange={(html) => setCustomField(f.key, html)} />
                          </div>
                        );
                      }
                      if (f.type === 'colorpicker') {
                        const palette = Array.isArray((f.settings as any)?.palette) ? ((f.settings as any).palette as string[]) : [];
                        return (
                          <div key={f.id}>
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="color"
                                value={(value as string) || '#222222'}
                                onChange={(e) => setCustomField(f.key, e.target.value)}
                                style={{ width: 40, height: 34, border: `1px solid ${LINE}`, borderRadius: 8, padding: 2, cursor: 'pointer' }}
                              />
                              <input className={inpCls} value={(value as string) || ''} onChange={(e) => setCustomField(f.key, e.target.value)} placeholder="#000000" />
                            </div>
                            {!!palette.length && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                {palette.map((c) => (
                                  <div key={c} onClick={() => setCustomField(f.key, c)} style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer', border: value === c ? `2px solid ${INK}` : '1px solid transparent' }} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (f.type === 'relation') {
                        const multiple = Boolean((f.settings as any)?.multiple);
                        const selected = multiple ? (Array.isArray(value) ? (value as string[]) : []) : (value ? [String(value)] : []);
                        return (
                          <div key={f.id}>
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            <select
                              className={inpCls}
                              multiple={multiple}
                              style={multiple ? { height: 100 } : undefined}
                              value={multiple ? selected : (selected[0] || '')}
                              onChange={(e) => {
                                if (multiple) {
                                  setCustomField(f.key, Array.from(e.target.selectedOptions).map((o) => o.value));
                                } else {
                                  setCustomField(f.key, e.target.value || null);
                                }
                              }}
                            >
                              {!multiple && <option value="">—</option>}
                              {allProducts.filter((p) => p.id !== id).map((p) => (
                                <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                              ))}
                            </select>
                          </div>
                        );
                      }
                      if (f.type === 'repeater') {
                        const subFields = Array.isArray((f.settings as any)?.subFields)
                          ? ((f.settings as any).subFields as Array<{ key: string; label: string; type?: string }>)
                          : [];
                        const rows = Array.isArray(value) ? (value as Record<string, string | number>[]) : [];
                        return (
                          <div key={f.id} className="sm:col-span-2">
                            <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                            {!subFields.length ? (
                              <div style={{ fontSize: 12, color: FG4 }}>{t('crm.products.fieldTypes.repeaterNoSubFields')}</div>
                            ) : (
                              <>
                                {rows.map((row, i) => (
                                  <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                    {subFields.map((sf) => (
                                      <input
                                        key={sf.key}
                                        type={sf.type === 'number' ? 'number' : 'text'}
                                        className={inpCls}
                                        style={{ flex: '1 1 100px', minWidth: 0 }}
                                        placeholder={sf.label}
                                        value={row[sf.key] ?? ''}
                                        onChange={(e) => {
                                          const next = [...rows];
                                          next[i] = { ...next[i], [sf.key]: sf.type === 'number' ? Number(e.target.value) : e.target.value };
                                          setCustomField(f.key, next);
                                        }}
                                      />
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setCustomField(f.key, rows.filter((_, idx) => idx !== i))}
                                      style={{ fontSize: 12, color: '#9a1f31', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                      {t('crm.products.form.actions.delete')}
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setCustomField(f.key, [...rows, {}])}
                                  style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                                >
                                  {t('crm.products.fieldTypes.repeaterAddRow')}
                                </button>
                              </>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div key={f.id}>
                          <label className={lblCls}>{f.label}{f.required ? ' *' : ''}</label>
                          <input
                            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
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

              {!isNew && !!changeLogs.length && (
                <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FG3, marginBottom: 10 }}>
                    {t('crm.products.form.changeLog.title')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                    {changeLogs.map((log) => (
                      <div key={log.id} style={{ fontSize: 11, color: FG3, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
                        <div style={{ color: INK, fontWeight: 500 }}>
                          {t(`crm.products.form.changeLog.fields.${log.field}`, { defaultValue: log.field })}
                        </div>
                        <div>
                          {log.oldValue ?? '—'} → {log.newValue ?? '—'}
                        </div>
                        <div style={{ color: FG4 }}>{new Date(log.createdAt).toLocaleString('ru-RU')}</div>
                      </div>
                    ))}
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
