// src/pages/products/ProductsListPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { LottieIcon } from '../../components/LottieIcon';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { resolvePublicAssetUrl } from '../../api/client';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProducts,
  fetchProductCategoriesTree,
  deleteProduct,
  duplicateProduct,
  exportProducts,
  bulkUpdateProducts,
  type Product,
  type ProductCategoryWithCount,
  type ProductStatus,
} from '../../api/products';
import './products-design.css';

const STATUS_OPTIONS: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];

const I = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  filter: <><path d="M3 5h18" /><path d="M6 12h12" /><path d="M10 19h4" /></>,
  upload: <><path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M4 3h16" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  list: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 10h18" /><path d="M3 16h18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 15l-5-5-6 6" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>,
};

const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

function formatMoney(value: string | number, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

function coverImageUrl(p: Product): string | null {
  const cover = p.images?.find((img) => img.isCover) || p.images?.[0];
  if (!cover) return null;
  return resolvePublicAssetUrl(cover.url) || cover.url;
}

function marginPercent(p: Product): number | null {
  const price = Number(p.price);
  const cost = p.costPrice != null ? Number(p.costPrice) : null;
  if (!price || cost == null) return null;
  return ((price - cost) / price) * 100;
}

export const ProductsListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<ProductCategoryWithCount[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const limit = 25;

  useEffect(() => {
    fetchProductCategoriesTree()
      .then((res) => {
        setCategories(res.categories);
        setUncategorizedCount(res.uncategorizedCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProducts({
      search: search || undefined,
      status: statusFilter || undefined,
      categoryId: categoryFilter || undefined,
      page,
      limit,
    })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message || t('crm.products.list.errors.loadFailed'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [search, statusFilter, categoryFilter, page]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const rootCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, ProductCategoryWithCount[]>();
    for (const c of categories) {
      if (!c.parentId) continue;
      const arr = map.get(c.parentId) || [];
      arr.push(c);
      map.set(c.parentId, arr);
    }
    return map;
  }, [categories]);

  const totalProductsAllCats = categories.reduce((s, c) => s + c.productCount, 0) + uncategorizedCount;
  const activeCount = items.filter((p) => p.status === 'active').length;
  const lowStockCount = items.filter((p) => p.lowStockThreshold != null && p.quantity > 0 && p.quantity <= p.lowStockThreshold).length;
  const outOfStockCount = items.filter((p) => p.quantity === 0).length;
  const stockValue = items.reduce((s, p) => s + Number(p.price) * p.quantity, 0);
  const withSubCount = categories.filter((c) => childrenByParent.has(c.id)).length;

  const stockCls = (p: Product) => {
    if (p.quantity === 0) return 'out';
    if (p.lowStockThreshold != null && p.quantity <= p.lowStockThreshold) return 'low';
    return '';
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await showConfirm(t('crm.products.list.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      cancelLabel: t('crm.confirmModal.cancel', { defaultValue: 'Отмена' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProduct(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.list.errors.deleteFailed'), { variant: 'error' });
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { product } = await duplicateProduct(id);
      navigate(`/products/${product.id}`);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.list.errors.duplicateFailed'), { variant: 'error' });
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv' | 'pdf') => {
    setExportMenuOpen(false);
    try {
      await exportProducts({ format, status: statusFilter || undefined, categoryId: categoryFilter || undefined });
    } catch (err: any) {
      showAlert(err.message || 'Export failed', { variant: 'error' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = items.length > 0 && items.every((p) => selectedIds.has(p.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        items.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      items.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleBulkStatus = async (status: string) => {
    setBulkSaving(true);
    try {
      await bulkUpdateProducts({ productIds: [...selectedIds], status });
      setSelectedIds(new Set());
      setPage((p) => p);
      fetchProducts({ search: search || undefined, status: statusFilter || undefined, categoryId: categoryFilter || undefined, page, limit })
        .then((res) => { setItems(res.items); setTotal(res.total); });
    } catch (err: any) {
      showAlert(err.message || t('crm.products.list.errors.deleteFailed'), { variant: 'error' });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkCategory = async (categoryId: string) => {
    setBulkSaving(true);
    try {
      await bulkUpdateProducts({ productIds: [...selectedIds], categoryId: categoryId || null });
      setSelectedIds(new Set());
      fetchProducts({ search: search || undefined, status: statusFilter || undefined, categoryId: categoryFilter || undefined, page, limit })
        .then((res) => { setItems(res.items); setTotal(res.total); });
    } catch (err: any) {
      showAlert(err.message || t('crm.products.list.errors.deleteFailed'), { variant: 'error' });
    } finally {
      setBulkSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <MainLayout>
      <PageHelpButton topic="products" />
      <div className="px-scope">
        <div className="pr-head px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.list.title')}</h1>
            <p className="sub">{t('crm.products.list.subtitle')}</p>
          </div>
          <div className="px-head-actions">
            <button type="button" className="tb-icon-btn" onClick={() => navigate('/products/import')}>
              <Icon d={I.upload} size={13} />
              {t('crm.products.list.importButton')}
            </button>
            <div style={{ position: 'relative' }}>
              <button type="button" className="tb-icon-btn" onClick={() => setExportMenuOpen((v) => !v)}>
                <Icon d={I.download} size={13} />
                {t('crm.products.list.exportButton')}
              </button>
              {exportMenuOpen && (
                <div
                  style={{
                    position: 'absolute', right: 0, top: '110%', zIndex: 10,
                    background: '#fff', border: '1px solid var(--line-2)', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 160, overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleExport('xlsx')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
                  >
                    {t('crm.products.list.exportXlsx')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', borderTop: '1px solid var(--line-2)' }}
                  >
                    {t('crm.products.list.exportCsv')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', borderTop: '1px solid var(--line-2)' }}
                  >
                    {t('crm.products.list.exportPdf')}
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="aib" onClick={() => navigate('/products/new')}>
              <Icon d={I.plus} size={15} />
              {t('crm.products.list.addButton')}
            </button>
          </div>
        </div>

        <ProductsSubnav active="catalog" />

        <div className="pr-kpis">
          <div className="pr-kpi">
            <div className="l">{t('crm.products.list.kpis.total')}</div>
            <div className="v">{total}</div>
            <div className="d">{t('crm.products.list.kpis.totalHint', { count: activeCount })}</div>
          </div>
          <div className="pr-kpi">
            <div className="l">{t('crm.products.list.kpis.value')}</div>
            <div className="v">{Math.round(stockValue / 1000).toLocaleString('ru-RU')}<span className="u">K</span></div>
            <div className="d">{t('crm.products.list.kpis.valueHint')}</div>
          </div>
          <div className="pr-kpi">
            <div className="l">{t('crm.products.list.kpis.categories')}</div>
            <div className="v">{categories.length}</div>
            <div className="d">{t('crm.products.list.kpis.categoriesHint', { count: withSubCount })}</div>
          </div>
          <div className="pr-kpi">
            <div className="l">{t('crm.products.list.kpis.lowStock')}</div>
            <div className="v" style={{ color: lowStockCount ? '#c08319' : undefined }}>{lowStockCount}</div>
            <div className="d warn">{lowStockCount ? t('crm.products.list.kpis.lowStockHintWarn') : t('crm.products.list.kpis.lowStockHintOk')}</div>
          </div>
          <div className="pr-kpi">
            <div className="l">{t('crm.products.list.kpis.outOfStock')}</div>
            <div className="v" style={{ color: outOfStockCount ? '#cc2f47' : undefined }}>{outOfStockCount}</div>
            <div className="d bad">{outOfStockCount ? t('crm.products.list.kpis.outOfStockHintBad') : t('crm.products.list.kpis.outOfStockHintOk')}</div>
          </div>
        </div>

        <div className="pr-body">
          <div className="pr-rail">
            <div className="pr-rail-head">
              <div className="t">{t('crm.products.list.rail.title')}</div>
              <button type="button" className="pr-rail-add" onClick={() => navigate('/products/categories')} title={t('crm.products.categories.addButton') || ''}>
                <Icon d={I.plus} size={13} />
              </button>
            </div>
            <div className="pr-cat-list">
              <div className={`pr-cat${!categoryFilter ? ' active' : ''}`} onClick={() => { setCategoryFilter(''); setPage(1); }}>
                <span className="sw" style={{ background: '#222' }} />
                <span className="nm">{t('crm.products.list.rail.all')}</span>
                <span className="cnt">{totalProductsAllCats}</span>
              </div>
              {rootCategories.map((c) => (
                <React.Fragment key={c.id}>
                  <div
                    className={`pr-cat${categoryFilter === c.id ? ' active' : ''}`}
                    onClick={() => { setCategoryFilter(c.id); setPage(1); }}
                  >
                    <span className="sw" style={{ background: c.color }} />
                    <span className="nm">{c.name}</span>
                    <span className="cnt">{c.productCount}</span>
                  </div>
                  {(childrenByParent.get(c.id) || []).map((sub) => (
                    <div
                      key={sub.id}
                      className={`pr-cat sub${categoryFilter === sub.id ? ' active' : ''}`}
                      onClick={() => { setCategoryFilter(sub.id); setPage(1); }}
                    >
                      <span className="sw" style={{ background: sub.color }} />
                      <span className="nm">{sub.name}</span>
                      <span className="cnt">{sub.productCount}</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
            <div className="pr-rail-foot">
              <div className="stat"><span>{t('crm.products.list.rail.totalLabel')}</span><b>{totalProductsAllCats}</b></div>
              <div className="stat"><span>{t('crm.products.list.rail.categoriesLabel')}</span><b>{categories.length}</b></div>
            </div>
          </div>

          <div className="pr-main">
            <div className="px-toolbar">
              <div className="tb-search" style={{ width: 230 }}>
                <Icon d={I.search} size={13} />
                <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder={t('crm.products.list.searchPlaceholder') || ''} />
              </div>
              <select className="ai-select" style={{ width: 'auto', minWidth: 150 }} value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
                <option value="">{t('crm.products.list.filters.allStatuses')}</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{t(`crm.products.status.${s}`)}</option>
                ))}
              </select>
              <div style={{ flex: 1 }} />
              <div className="pr-view-toggle">
                <button type="button" className={view === 'table' ? 'active' : undefined} onClick={() => setView('table')} title={t('crm.products.list.viewTable') || ''}>
                  <Icon d={I.list} size={15} />
                </button>
                <button type="button" className={view === 'grid' ? 'active' : undefined} onClick={() => setView('grid')} title={t('crm.products.list.viewGrid') || ''}>
                  <Icon d={I.grid} size={15} />
                </button>
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid #f0c8cf', background: '#fbecef', fontSize: 12, color: '#9a1f31' }}>
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>
                <div className="flex justify-center mb-1"><LottieIcon name="loader-spinner" size={48} /></div>
                {t('crm.common.loading')}
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>
                <div className="flex justify-center mb-1"><LottieIcon name="empty-state-folder" size={72} /></div>
                {t('crm.products.list.empty')}
              </div>
            ) : view === 'table' ? (
              <div className="pr-table-wrap">
                <table className="pr-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
                      <th>{t('crm.products.list.columns.name')}</th>
                      <th>{t('crm.products.list.columns.category')}</th>
                      <th className="r">{t('crm.products.list.columns.price')}</th>
                      <th className="r">{t('crm.products.list.columns.margin')}</th>
                      <th>{t('crm.products.list.columns.quantity')}</th>
                      <th className="c">{t('crm.products.list.columns.variable')}</th>
                      <th>{t('crm.products.list.columns.status')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => {
                      const cat = p.categoryId ? categoryById.get(p.categoryId) : null;
                      const margin = marginPercent(p);
                      return (
                        <tr key={p.id} className={`row${selectedIds.has(p.id) ? ' selected' : ''}`} onClick={() => navigate(`/products/${p.id}`)}>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} />
                          </td>
                          <td>
                            <div className="pr-cell-name">
                              <div className="pr-thumb">
                                {coverImageUrl(p) ? (
                                  <img src={coverImageUrl(p)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <Icon d={I.image} size={15} />
                                )}
                              </div>
                              <div className="nb">
                                <div className="n">{p.name}</div>
                                <div className="s">{p.sku || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {cat ? (
                              <span className="pr-cat-tag"><span className="sw" style={{ background: cat.color }} />{cat.name}</span>
                            ) : '—'}
                          </td>
                          <td className="r">{formatMoney(p.price, p.currency)}</td>
                          <td className="r" style={{ color: margin != null && margin < 15 ? '#c08319' : 'var(--fg-3)' }}>
                            {margin != null ? `${margin.toFixed(0)}%` : '—'}
                          </td>
                          <td>
                            <div className={`pr-stockbar ${stockCls(p)}`}>
                              <span className="track"><span style={{ width: `${Math.min(100, p.lowStockThreshold ? (p.quantity / (p.lowStockThreshold * 4)) * 100 : 100)}%` }} /></span>
                              <span className="n">{p.quantity}</span>
                            </div>
                          </td>
                          <td className="c" style={{ color: 'var(--fg-3)' }}>{p.isVariable ? '✓' : '—'}</td>
                          <td><span className={`pr-badge ${p.status}`}>{t(`crm.products.status.${p.status}`)}</span></td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="px-row-actions" style={{ opacity: 1 }}>
                              <button type="button" title={t('crm.products.list.duplicateButton') || ''} onClick={(e) => handleDuplicate(p.id, e)}>
                                <Icon d={I.copy} size={13} />
                              </button>
                              <button type="button" className="danger" title={t('crm.products.form.actions.delete') || ''} onClick={(e) => handleDelete(p.id, e)}>
                                <Icon d={I.trash} size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pr-grid">
                {items.map((p) => (
                  <div key={p.id} className="pr-gcard" onClick={() => navigate(`/products/${p.id}`)}>
                    <div className="pr-gcard-img">
                      {coverImageUrl(p) ? (
                        <img src={coverImageUrl(p)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Icon d={I.image} size={26} />
                      )}
                      <span
                        className={`pr-gcard-badge ${p.status}`}
                        style={
                          p.status === 'active'
                            ? { color: '#1f8a5e', borderColor: '#c5e3d2', background: '#eaf4ee' }
                            : p.status === 'draft'
                            ? { color: 'var(--fg-3)', borderColor: 'var(--line-2)', background: '#fff' }
                            : { color: '#7a4a09', borderColor: '#f0d9a8', background: '#fbf2dc' }
                        }
                      >
                        {t(`crm.products.status.${p.status}`)}
                      </span>
                    </div>
                    <div className="pr-gcard-body">
                      <div className="sku">{p.sku || '—'}</div>
                      <div className="nm">{p.name}</div>
                      <div className="pr-gcard-foot">
                        <div className="price">{formatMoney(p.price, p.currency)}</div>
                        <div className={`stock ${stockCls(p)}`}>{p.quantity === 0 ? '—' : `${p.quantity}`}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18 }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="tb-icon-btn"
                  style={{ opacity: page <= 1 ? 0.5 : 1 }}
                >
                  ←
                </button>
                <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="tb-icon-btn"
                  style={{ opacity: page >= totalPages ? 0.5 : 1 }}
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="bulk-bar">
            <div className="count"><strong>{selectedIds.size}</strong> {t('crm.products.list.bulk.selected')}</div>
            <div className="bulk-bar-divider" />
            <select
              className="ai-select"
              style={{ width: 'auto', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 12 }}
              value=""
              disabled={bulkSaving}
              onChange={(e) => e.target.value && handleBulkStatus(e.target.value)}
            >
              <option value="">{t('crm.products.list.bulk.setStatus')}</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(`crm.products.status.${s}`)}</option>)}
            </select>
            <select
              className="ai-select"
              style={{ width: 'auto', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 12 }}
              value=""
              disabled={bulkSaving}
              onChange={(e) => handleBulkCategory(e.target.value)}
            >
              <option value="">{t('crm.products.list.bulk.setCategory')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              type="button"
              className="ai-select"
              style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
              onClick={() =>
                navigate('/products/print-labels', {
                  state: { products: items.filter((p) => selectedIds.has(p.id)) },
                })
              }
            >
              {t('crm.products.list.bulk.printLabels')}
            </button>
            <div className="bulk-bar-divider" />
            <button type="button" className="bulk-close" onClick={() => setSelectedIds(new Set())}>×</button>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
