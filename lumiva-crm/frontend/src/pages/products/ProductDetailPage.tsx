// src/pages/products/ProductDetailPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { resolvePublicAssetUrl } from '../../api/client';
import { ProductImageField, ProductGalleryField } from './ProductImageField';
import {
  fetchProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  fetchProductCategories,
  fetchProductAttributes,
  fetchProductFieldDefs,
  fetchProductChangeLogs,
  adjustProductStock,
  updateProductVariant,
  uploadProductImage,
  type Product,
  type ProductCategory,
  type ProductAttribute,
  type ProductFieldDef,
  type ProductChangeLog,
  type ProductVariant,
  type ProductStatus,
  type ProductImage,
} from '../../api/products';
import './products-design.css';

const STATUS_OPTIONS: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];

function formatMoney(value: string | number, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

function coverImageUrl(images: ProductImage[] | undefined | null): string | null {
  const cover = images?.find((img) => img.isCover) || images?.[0];
  if (!cover) return null;
  return resolvePublicAssetUrl(cover.url) || cover.url;
}

const I = {
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01" />
      <path d="M11 12h1v5h1" />
    </>
  ),
  layers: (
    <>
      <path d="M12 4l9 5-9 5-9-5z" />
      <path d="M3 14l9 5 9-5" />
    </>
  ),
  box: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3" />
      <path d="M20 14v3h-3" />
      <path d="M14 20h3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chev: <path d="M6 9l6 6 6-6" />,
  back: <path d="M15 6l-6 6 6 6" />,
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
  check: <path d="M5 12l4 4 10-10" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
};

const Icon: React.FC<{ d: React.ReactNode; size?: number; sw?: number }> = ({ d, size = 14, sw = 1.7 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

type TabKey = 'overview' | 'attrs' | 'variants' | 'codes' | 'activity';

type CoreForm = {
  name: string;
  description: string;
  categoryId: string;
  price: number;
  salePrice: number | undefined;
  weight: number | undefined;
  barcode: string;
  sku: string;
  lowStockThreshold: number | undefined;
  quantity: number;
  images: ProductImage[];
  customFields: Record<string, unknown>;
};

function toCoreForm(p: Product): CoreForm {
  return {
    name: p.name,
    description: p.description || '',
    categoryId: p.categoryId || '',
    price: Number(p.price) || 0,
    salePrice: p.salePrice != null ? Number(p.salePrice) : undefined,
    weight: p.weight != null ? Number(p.weight) : undefined,
    barcode: p.barcode || '',
    sku: p.sku || '',
    lowStockThreshold: p.lowStockThreshold ?? undefined,
    quantity: p.quantity,
    images: p.images || [],
    customFields: p.customFields || {},
  };
}

const BarcodeVisual: React.FC<{ value: string }> = ({ value }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', height: 50, fontSize: 12, margin: 6 });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [value]);
  if (failed) return null;
  return <svg ref={ref} style={{ maxWidth: '100%', height: 'auto' }} />;
};

const QrVisual: React.FC<{ value: string }> = ({ value }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: 150, margin: 1 })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [value]);
  if (!url) return null;
  return <img src={url} alt="QR" width={150} height={150} />;
};

export const ProductDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [fieldDefs, setFieldDefs] = useState<ProductFieldDef[]>([]);
  const [changeLogs, setChangeLogs] = useState<ProductChangeLog[]>([]);

  const [tab, setTab] = useState<TabKey>('overview');
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CoreForm | null>(null);
  const [adjustingVariantId, setAdjustingVariantId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchProductCategories(), fetchProductAttributes(), fetchProductFieldDefs()])
      .then(([cats, attrs, fields]) => {
        setCategories(cats);
        setAttributes(attrs);
        setFieldDefs(fields.filter((f) => f.isActive));
      })
      .catch(() => {});
  }, []);

  const reload = () => {
    if (!id) return Promise.resolve();
    return fetchProduct(id).then(({ product: p, variants: v }) => {
      setProduct(p);
      setVariants(v);
    });
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    reload()
      .catch((e) => setError(e.message || t('crm.products.form.errors.loadFailed')))
      .finally(() => setLoading(false));
    fetchProductChangeLogs(id).then(setChangeLogs).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!statusOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) setStatusOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [statusOpen]);

  const attrById = useMemo(() => new Map(attributes.map((a) => [a.id, a])), [attributes]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const fieldGroups = useMemo(() => {
    const groups = new Map<string, ProductFieldDef[]>();
    fieldDefs.forEach((f) => {
      const key = f.group || t('crm.products.detail.attrs.ungrouped');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    });
    return Array.from(groups.entries()).map(([name, fields]) => ({ name, fields }));
  }, [fieldDefs, t]);

  const describeVariant = (v: ProductVariant): string => {
    const parts = Object.entries(v.attributeValues || {}).map(([attrId, valueId]) => {
      const attr = attrById.get(attrId);
      const value = attr?.values.find((val) => val.id === valueId);
      return value?.label || value?.value || '?';
    });
    return parts.join(' / ') || '—';
  };

  if (loading || !product) {
    return (
      <MainLayout>
        <div className="px-scope">
          {error ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{error}</div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{t('crm.common.loading')}</div>
          )}
        </div>
      </MainLayout>
    );
  }

  const st = product.status;
  const stockCls = product.quantity === 0 ? 'out' : product.lowStockThreshold != null && product.quantity <= product.lowStockThreshold ? 'low' : '';
  const stockPct = product.lowStockThreshold
    ? Math.min(100, Math.round((product.quantity / (product.lowStockThreshold * 4)) * 100))
    : 100;

  const startEdit = () => {
    setForm(toCoreForm(product));
    setEditing(true);
    setTab('overview');
  };

  const cancelEdit = () => {
    setForm(null);
    setEditing(false);
  };

  const setField = <K extends keyof CoreForm>(key: K, value: CoreForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setCustomField = (key: string, value: unknown) => {
    setForm((prev) => (prev ? { ...prev, customFields: { ...prev.customFields, [key]: value } } : prev));
  };

  const saveEdit = async () => {
    if (!id || !form) return;
    if (!form.name.trim()) {
      showAlert(t('crm.products.form.errors.nameRequired'), { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProduct(id, {
        name: form.name.trim(),
        description: form.description || null,
        categoryId: form.categoryId || null,
        price: Number(form.price) || 0,
        salePrice: form.salePrice != null && (form.salePrice as any) !== '' ? Number(form.salePrice) : null,
        weight: form.weight != null && (form.weight as any) !== '' ? Number(form.weight) : null,
        barcode: form.barcode || null,
        sku: form.sku || null,
        lowStockThreshold: form.lowStockThreshold != null && (form.lowStockThreshold as any) !== '' ? Number(form.lowStockThreshold) : null,
        quantity: product.isVariable ? undefined : Number(form.quantity) || 0,
        images: form.images,
        customFields: form.customFields,
      });
      setProduct(updated);
      setEditing(false);
      setForm(null);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (next: ProductStatus) => {
    if (!id || next === product.status) { setStatusOpen(false); return; }
    setStatusBusy(true);
    try {
      const updated = await updateProduct(id, { status: next });
      setProduct(updated);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setStatusBusy(false);
      setStatusOpen(false);
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    try {
      const { product: created } = await duplicateProduct(id);
      navigate(`/products/${created.id}`);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
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

  const handleVariantChange = async (variantId: string, patch: Partial<{ priceOverride: number | null; isActive: boolean }>) => {
    if (!id) return;
    try {
      const updated = await updateProductVariant(id, variantId, patch);
      setVariants((prev) => prev.map((v) => (v.id === variantId ? updated : v)));
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    }
  };

  const tabs: Array<{ k: TabKey; l: string; ic: React.ReactNode; badge?: number }> = [
    { k: 'overview', l: t('crm.products.detail.tabs.overview'), ic: I.info },
    { k: 'attrs', l: t('crm.products.detail.tabs.attrs'), ic: I.layers },
    { k: 'variants', l: t('crm.products.detail.tabs.variants'), ic: I.box, badge: variants.length || undefined },
    { k: 'codes', l: t('crm.products.detail.tabs.codes'), ic: I.qr },
    { k: 'activity', l: t('crm.products.detail.tabs.activity'), ic: I.clock },
  ];

  const galleryImages = editing ? form?.images || [] : product.images || [];
  const codeValue = product.barcode || product.sku || '';

  const handleAddGalleryFiles = async (files: FileList) => {
    setUploadingGallery(true);
    try {
      const uploaded: ProductImage[] = [];
      for (const file of Array.from(files)) {
        const { url } = await uploadProductImage(file);
        uploaded.push({ url });
      }
      setField('images', [...(form?.images || []), ...uploaded]);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.form.errors.saveFailed'), { variant: 'error' });
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    setField('images', (form?.images || []).filter((_, i) => i !== index));
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <button type="button" className="px-back" onClick={() => navigate('/products')}>
          <Icon d={I.back} size={14} />
          {t('crm.products.detail.backToList')}
        </button>

        <div className="pd-top">
          <div className="pd-top-l">
            <div className="pd-thumb-lg">
              {coverImageUrl(product.images) ? (
                <img src={coverImageUrl(product.images)!} alt="" />
              ) : (
                <Icon d={I.box} size={26} />
              )}
            </div>
            <div className="pd-id">
              <div className="nm">
                {editing ? (
                  <input
                    className="nm-input"
                    value={form?.name ?? ''}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                ) : (
                  product.name
                )}
                <div style={{ position: 'relative' }} ref={statusRef}>
                  <button
                    type="button"
                    className={`pd-status-select ${st}`}
                    onClick={() => setStatusOpen((o) => !o)}
                    disabled={statusBusy}
                  >
                    <span className="dot" />{t(`crm.products.status.${st}`)}<Icon d={I.chev} size={11} />
                  </button>
                  {statusOpen && (
                    <div className="popover" style={{ top: 'calc(100% + 6px)', left: 0, minWidth: 150 }}>
                      <div className="popover-list">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s}
                            className="popover-item"
                            style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', font: 'inherit' }}
                            onClick={() => changeStatus(s)}
                          >
                            <span className={`pd-status-select ${s}`} style={{ padding: '2px 8px' }}>
                              <span className="dot" />{t(`crm.products.status.${s}`)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="meta">
                <span>SKU <code>{product.sku || '—'}</code></span><span className="sep">•</span>
                <span>{product.categoryId ? categoryById.get(product.categoryId)?.name || '—' : t('crm.products.detail.noCategory')}</span><span className="sep">•</span>
                <span>{t('crm.products.detail.variantsCount', { count: variants.length })}</span><span className="sep">•</span>
                <span>ID <code>{product.id.slice(0, 8)}…{product.id.slice(-4)}</code></span>
              </div>
            </div>
          </div>
          <div className="pd-actions">
            {editing ? (
              <>
                <button type="button" className="aib ghost sm" onClick={cancelEdit} disabled={saving}>
                  {t('crm.products.form.actions.cancel')}
                </button>
                <button type="button" className="aib sm" onClick={saveEdit} disabled={saving}>
                  <Icon d={I.check} size={14} />{saving ? t('crm.common.saving') : t('crm.products.form.actions.save')}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="aib ghost sm" onClick={handleDuplicate}>
                  <Icon d={I.copy} size={13} />{t('crm.products.form.actions.duplicate')}
                </button>
                <button type="button" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" onClick={handleDelete}>
                  <Icon d={I.trash} size={13} />
                </button>
                <button type="button" className="aib sm" onClick={startEdit}>
                  <Icon d={I.edit} size={14} />{t('crm.products.detail.edit')}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="pd-tabs">
          {tabs.map((tb) => (
            <button key={tb.k} className={`pd-tab${tab === tb.k ? ' active' : ''}`} onClick={() => setTab(tb.k)}>
              <span className="ic"><Icon d={tb.ic} size={14} /></span>{tb.l}
              {tb.badge ? <span className="badge">{tb.badge}</span> : null}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="pd-2col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="pd-panel">
                <div className="pd-panel-head">
                  <div className="pt"><span className="ic"><Icon d={I.box} size={14} /></span>{t('crm.products.detail.gallery.title')}</div>
                  {editing && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.products.detail.gallery.hint')}</span>}
                </div>
                <div className="pd-panel-body">
                  {!editing && !galleryImages.length ? (
                    <div className="pd-photo-empty">
                      <Icon d={I.box} size={26} />
                      {t('crm.products.detail.gallery.empty')}
                    </div>
                  ) : (
                    <div
                      className="pd-photo-grid"
                      onDragOver={editing ? (e) => e.preventDefault() : undefined}
                      onDrop={editing ? (e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleAddGalleryFiles(e.dataTransfer.files); } : undefined}
                    >
                      {galleryImages.map((img, i) => (
                        <div className="pd-photo-tile" key={i}>
                          <img src={resolvePublicAssetUrl(img.url) || img.url} alt="" />
                          {editing && (
                            <button type="button" className="pd-photo-rm" onClick={() => removeGalleryImage(i)}>×</button>
                          )}
                        </div>
                      ))}
                      {editing && (
                        <div className="pd-photo-add" onClick={() => galleryInputRef.current?.click()}>
                          <Icon d={I.plus} size={18} />
                          {uploadingGallery ? t('crm.common.loading') : t('crm.products.detail.gallery.add')}
                        </div>
                      )}
                    </div>
                  )}
                  {editing && (
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files?.length) handleAddGalleryFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="pd-panel">
                <div className="pd-panel-head"><div className="pt"><span className="ic"><Icon d={I.info} size={14} /></span>{t('crm.products.detail.description.title')}</div></div>
                <div className="pd-panel-body">
                  {editing ? (
                    <textarea
                      className="pd-desc-edit"
                      value={form?.description ?? ''}
                      onChange={(e) => setField('description', e.target.value)}
                    />
                  ) : product.description ? (
                    <div className="pd-desc">
                      {product.description.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  ) : (
                    <div className="pd-desc" style={{ color: 'var(--fg-4)' }}>{t('crm.products.detail.description.empty')}</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="pd-panel">
                {editing ? (
                  <div className="pd-price-edit">
                    <div className="f">
                      <label>{t('crm.products.form.fields.price')}</label>
                      <input type="number" step="0.01" value={form?.price ?? 0} onChange={(e) => setField('price', Number(e.target.value))} />
                    </div>
                    <div className="f">
                      <label>{t('crm.products.form.fields.salePrice', { defaultValue: 'Цена со скидкой' })}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form?.salePrice ?? ''}
                        onChange={(e) => setField('salePrice', e.target.value === '' ? undefined : Number(e.target.value))}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pd-price-row">
                    <span className="cur">{formatMoney(product.salePrice ?? product.price, product.currency)}</span>
                    {product.salePrice != null && (
                      <>
                        <span className="old">{formatMoney(product.price, product.currency)}</span>
                        <span className="disc">−{Math.round((1 - Number(product.salePrice) / Number(product.price)) * 100)}%</span>
                      </>
                    )}
                  </div>
                )}
                {!product.isVariable && (
                  <>
                    <div className="pd-stock-strip">
                      <div className="c">
                        <div className="l">{t('crm.products.list.columns.quantity')}</div>
                        <div className="v">
                          {editing ? (
                            <input type="number" value={form?.quantity ?? 0} onChange={(e) => setField('quantity', Number(e.target.value))} />
                          ) : product.quantity}
                        </div>
                      </div>
                      <div className="c">
                        <div className="l">{t('crm.products.form.fields.lowStockThreshold')}</div>
                        <div className="v">
                          {editing ? (
                            <input
                              type="number"
                              value={form?.lowStockThreshold ?? ''}
                              onChange={(e) => setField('lowStockThreshold', e.target.value === '' ? undefined : Number(e.target.value))}
                            />
                          ) : product.lowStockThreshold ?? '—'}
                        </div>
                      </div>
                    </div>
                    <div className="pd-stock-bar-row">
                      <div className={`pd-stock-bar ${stockCls}`}><div className="fill" style={{ width: stockPct + '%' }} /></div>
                      {product.lowStockThreshold != null && (
                        <div className="pd-stock-bar-lbl">
                          <span>{product.quantity}</span>
                          <span>{t('crm.products.detail.stock.threshold', { count: product.lowStockThreshold })}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="pd-panel">
                <div className="pd-panel-head"><div className="pt">{t('crm.products.detail.infoTitle')}</div></div>
                <div className="pd-panel-body" style={{ paddingTop: 2, paddingBottom: 2 }}>
                  <div className="pd-info-row">
                    <span className="k">{t('crm.products.form.fields.category')}</span>
                    <span className="v">
                      {editing ? (
                        <select value={form?.categoryId ?? ''} onChange={(e) => setField('categoryId', e.target.value)}>
                          <option value="">{t('crm.products.form.fields.categoryPlaceholder')}</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (product.categoryId ? categoryById.get(product.categoryId)?.name || '—' : '—')}
                    </span>
                  </div>
                  <div className="pd-info-row">
                    <span className="k">{t('crm.products.form.fields.sku')}</span>
                    <span className="v">{editing ? <input value={form?.sku ?? ''} onChange={(e) => setField('sku', e.target.value)} /> : (product.sku || '—')}</span>
                  </div>
                  <div className="pd-info-row">
                    <span className="k">{t('crm.products.form.fields.barcode')}</span>
                    <span className="v">{editing ? <input value={form?.barcode ?? ''} onChange={(e) => setField('barcode', e.target.value)} /> : (product.barcode || '—')}</span>
                  </div>
                  <div className="pd-info-row">
                    <span className="k">{t('crm.products.form.fields.weight')}</span>
                    <span className="v">
                      {editing ? (
                        <input
                          type="number"
                          step="0.001"
                          value={form?.weight ?? ''}
                          onChange={(e) => setField('weight', e.target.value === '' ? undefined : Number(e.target.value))}
                        />
                      ) : (product.weight != null ? `${product.weight} кг` : '—')}
                    </span>
                  </div>
                  <div className="pd-info-row"><span className="k">{t('crm.products.detail.created')}</span><span className="v">{new Date(product.createdAt).toLocaleDateString('ru-RU')}</span></div>
                  <div className="pd-info-row"><span className="k">{t('crm.products.detail.updated')}</span><span className="v">{new Date(product.updatedAt).toLocaleString('ru-RU')}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ATTRIBUTES */}
        {tab === 'attrs' && (
          <div className="pd-panel">
            <div className="pd-panel-head">
              <div className="pt"><span className="ic"><Icon d={I.layers} size={14} /></span>{t('crm.products.detail.attrs.title')}</div>
              <button type="button" className="aib ghost sm" onClick={() => navigate('/products/field-types')}>
                <Icon d={I.edit} size={12} />{t('crm.products.subnav.fields')}
              </button>
            </div>
            {!fieldGroups.length ? (
              <div className="pd-log-empty">{t('crm.products.detail.attrs.empty')}</div>
            ) : (
              fieldGroups.map((g) => (
                <div key={g.name}>
                  <div style={{ padding: '12px 18px 8px', fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-3)', fontWeight: 500, background: 'var(--bg-muted)', borderTop: '1px solid var(--line-2)', borderBottom: '1px solid var(--line-2)' }}>{g.name}</div>
                  <div className="pd-attrs">
                    {g.fields.map((f) => {
                      const value = (editing ? form?.customFields : product.customFields)?.[f.key];
                      const simpleEditable = editing && ['text', 'textarea', 'number', 'date', 'datetime', 'boolean', 'select', 'radio', 'multiselect', 'url'].includes(f.type);
                      const isMediaType = f.type === 'media' || f.type === 'gallery';
                      return (
                        <div className="pd-attr" key={f.id} style={isMediaType ? { gridColumn: '1 / -1', borderRight: 'none' } : undefined}>
                          <div className="al">{f.label}</div>
                          <div className={`av${f.type === 'boolean' && !simpleEditable ? ' chk' : ''}`}>
                            {simpleEditable ? (
                              f.type === 'boolean' ? (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input type="checkbox" checked={!!value} onChange={(e) => setCustomField(f.key, e.target.checked)} />
                                  {value ? t('crm.products.detail.attrs.yes') : t('crm.products.detail.attrs.no')}
                                </label>
                              ) : f.type === 'select' || f.type === 'radio' ? (
                                <select value={(value as string) || ''} onChange={(e) => setCustomField(f.key, e.target.value)}>
                                  <option value="">—</option>
                                  {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              ) : f.type === 'textarea' ? (
                                <textarea rows={2} value={(value as string) || ''} onChange={(e) => setCustomField(f.key, e.target.value)} />
                              ) : (
                                <input
                                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                                  value={(value as string) ?? ''}
                                  onChange={(e) => setCustomField(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                                />
                              )
                            ) : editing && f.type === 'media' ? (
                              <ProductImageField
                                value={(value as ProductImage | undefined) || null}
                                onChange={(next) => setCustomField(f.key, next)}
                                onError={(msg) => showAlert(msg, { variant: 'error' })}
                              />
                            ) : editing && f.type === 'gallery' ? (
                              <ProductGalleryField
                                value={Array.isArray(value) ? (value as ProductImage[]) : []}
                                onChange={(next) => setCustomField(f.key, next)}
                                onError={(msg) => showAlert(msg, { variant: 'error' })}
                              />
                            ) : f.type === 'media' && value ? (
                              <img
                                src={resolvePublicAssetUrl((value as ProductImage).url) || (value as ProductImage).url}
                                alt=""
                                style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--line-3)' }}
                              />
                            ) : f.type === 'gallery' && Array.isArray(value) && value.length ? (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {(value as ProductImage[]).map((img, i) => (
                                  <img
                                    key={i}
                                    src={resolvePublicAssetUrl(img.url) || img.url}
                                    alt=""
                                    style={{ width: 44, height: 44, borderRadius: 7, objectFit: 'cover', border: '1px solid var(--line-3)' }}
                                  />
                                ))}
                              </div>
                            ) : f.type === 'boolean' ? (
                              value ? <><Icon d={I.check} size={13} />{t('crm.products.detail.attrs.yes')}</> : <span className="muted">{t('crm.products.detail.attrs.no')}</span>
                            ) : f.type === 'multiselect' && Array.isArray(value) ? (
                              (value as string[]).length ? (value as string[]).join(', ') : <span className="muted">—</span>
                            ) : value != null && value !== '' ? (
                              typeof value === 'object' ? t('crm.products.detail.attrs.complexValue') : String(value)
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* VARIANTS */}
        {tab === 'variants' && (
          <div className="pd-panel">
            <div className="pd-panel-head">
              <div className="pt"><span className="ic"><Icon d={I.box} size={14} /></span>{t('crm.products.detail.tabs.variants')}</div>
              <button type="button" className="aib ghost sm" onClick={() => navigate(`/products/${id}/edit`)}>
                <Icon d={I.plus} size={13} />{t('crm.products.detail.variants.manage')}
              </button>
            </div>
            {!variants.length ? (
              <div className="pd-log-empty">{t('crm.products.form.variants.empty')}</div>
            ) : (
              <div className="pd-panel-body flush">
                <table className="pd-var-table">
                  <thead>
                    <tr>
                      <th>{t('crm.products.form.variants.table.combination')}</th>
                      <th>{t('crm.products.form.variants.table.sku')}</th>
                      <th className="r">{t('crm.products.form.variants.table.priceOverride')}</th>
                      <th className="r">{t('crm.products.form.variants.table.quantity')}</th>
                      <th className="c">{t('crm.products.form.variants.table.active')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.id}>
                        <td><span className="pd-var-combo">{describeVariant(v)}</span></td>
                        <td><span className="pd-var-sku" style={{ marginLeft: 0 }}>{v.sku || '—'}</span></td>
                        <td className="r">
                          {editing ? (
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={v.priceOverride ?? ''}
                              onBlur={(e) => {
                                const val = e.target.value === '' ? null : Number(e.target.value);
                                if (val !== (v.priceOverride != null ? Number(v.priceOverride) : null)) handleVariantChange(v.id, { priceOverride: val });
                              }}
                            />
                          ) : v.priceOverride != null ? formatMoney(v.priceOverride, product.currency) : '—'}
                        </td>
                        <td className="r" style={{ fontWeight: 600 }}>
                          {editing ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <button type="button" disabled={adjustingVariantId === v.id} onClick={() => handleVariantQuantityDelta(v.id, -1)} style={{ width: 20, height: 20, border: '1px solid var(--line-2)', background: '#fff', borderRadius: 5, cursor: 'pointer' }}>−</button>
                              <span style={{ minWidth: 24, display: 'inline-block', textAlign: 'center' }}>{v.quantity}</span>
                              <button type="button" disabled={adjustingVariantId === v.id} onClick={() => handleVariantQuantityDelta(v.id, 1)} style={{ width: 20, height: 20, border: '1px solid var(--line-2)', background: '#fff', borderRadius: 5, cursor: 'pointer' }}>+</button>
                            </div>
                          ) : v.quantity}
                        </td>
                        <td className="c">
                          {editing ? (
                            <input type="checkbox" checked={v.isActive} onChange={(e) => handleVariantChange(v.id, { isActive: e.target.checked })} />
                          ) : (
                            <span className={`pr-badge ${v.isActive ? 'active' : 'draft'}`}>{v.isActive ? t('crm.products.status.active') : t('crm.products.status.draft')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CODES */}
        {tab === 'codes' && (
          <div className="pd-code-grid">
            <div className="pd-code-card">
              <div className="lbl">{t('crm.products.detail.codes.qr')}</div>
              <div className="pd-code-visual">{codeValue ? <QrVisual value={codeValue} /> : <Icon d={I.qr} size={40} />}</div>
              <div className="pd-code-value">{codeValue || t('crm.products.detail.codes.none')}</div>
            </div>
            <div className="pd-code-card">
              <div className="lbl">{t('crm.products.detail.codes.barcode')}</div>
              <div className="pd-code-visual" style={{ width: '100%' }}>{codeValue ? <BarcodeVisual value={codeValue} /> : <Icon d={I.box} size={40} />}</div>
              <div className="pd-code-value">{codeValue || t('crm.products.detail.codes.none')}</div>
              <div className="pd-code-actions">
                <button type="button" className="aib ghost sm" onClick={() => navigate('/products/print-labels')}>
                  <Icon d={I.download} size={13} />{t('crm.products.detail.codes.print')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY */}
        {tab === 'activity' && (
          <div className="pd-panel">
            <div className="pd-panel-head"><div className="pt"><span className="ic"><Icon d={I.clock} size={14} /></span>{t('crm.products.form.changeLog.title')}</div></div>
            {!changeLogs.length ? (
              <div className="pd-log-empty">{t('crm.products.detail.activity.empty')}</div>
            ) : (
              <div className="pd-log">
                {changeLogs.map((log) => (
                  <div className="pd-log-item" key={log.id}>
                    <div className="pd-log-time">
                      {new Date(log.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      <div className="d">{new Date(log.createdAt).toLocaleDateString('ru-RU')}</div>
                    </div>
                    <div>
                      <div className="pd-log-ev">
                        <span className="pd-log-dot" style={{ background: 'var(--ink)' }} />
                        <span style={{ fontWeight: 500 }}>{t(`crm.products.form.changeLog.fields.${log.field}`, { defaultValue: log.field })}</span>
                      </div>
                      <div className="pd-log-io">{log.oldValue ?? '—'} → {log.newValue ?? '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
