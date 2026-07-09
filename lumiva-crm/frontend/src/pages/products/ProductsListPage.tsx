// src/pages/products/ProductsListPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchProducts,
  fetchProductCategories,
  deleteProduct,
  duplicateProduct,
  exportProducts,
  type Product,
  type ProductCategory,
  type ProductStatus,
} from '../../api/products';

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'px-3 py-2 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5] text-[#222]';

const STATUS_OPTIONS: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];

function formatMoney(value: string | number, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

export const ProductsListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const limit = 25;

  useEffect(() => {
    fetchProductCategories()
      .then(setCategories)
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

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await showConfirm(t('crm.products.list.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
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

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExportMenuOpen(false);
    try {
      await exportProducts({ format, status: statusFilter || undefined, categoryId: categoryFilter || undefined });
    } catch (err: any) {
      showAlert(err.message || 'Export failed', { variant: 'error' });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <MainLayout>
      <div style={{ color: INK }}>
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: INK, lineHeight: 1.1 }}>
                {t('crm.products.list.title')}
              </h1>
              <div style={{ fontSize: 13, color: FG3, marginTop: 6 }}>{t('crm.products.list.subtitle')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/products/attributes')}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
              >
                {t('crm.products.attributes.title')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/products/field-types')}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
              >
                {t('crm.products.fieldTypes.title')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/products/stock')}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
              >
                {t('crm.products.stock.title')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/products/import')}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
              >
                {t('crm.products.list.importButton')}
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setExportMenuOpen((v) => !v)}
                  style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                >
                  {t('crm.products.list.exportButton')}
                </button>
                {exportMenuOpen && (
                  <div
                    style={{
                      position: 'absolute', right: 0, top: '110%', zIndex: 10,
                      background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 160, overflow: 'hidden',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleExport('xlsx')}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: INK }}
                    >
                      {t('crm.products.list.exportXlsx')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('csv')}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: INK, borderTop: `1px solid ${LINE}` }}
                    >
                      {t('crm.products.list.exportCsv')}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate('/products/new')}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer' }}
              >
                {t('crm.products.list.addButton')}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <input
            className={inpCls}
            style={{ flex: '1 1 240px', minWidth: 200 }}
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder={t('crm.products.list.searchPlaceholder') || ''}
          />
          <select className={inpCls} value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
            <option value="">{t('crm.products.list.filters.allStatuses')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{t(`crm.products.status.${s}`)}</option>
            ))}
          </select>
          <select className={inpCls} value={categoryFilter} onChange={(e) => { setPage(1); setCategoryFilter(e.target.value); }}>
            <option value="">{t('crm.products.list.filters.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid #f0c8cf', background: '#fbecef', fontSize: 12, color: '#9a1f31' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.products.list.empty')}</div>
        ) : (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: BG_MUTED, borderBottom: `1px solid ${LINE}` }}>
                  {['name', 'sku', 'category', 'status', 'price', 'quantity', 'variable', 'actions'].map((col) => (
                    <th key={col} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: FG3, fontWeight: 600 }}>
                      {t(`crm.products.list.columns.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const isLow = p.lowStockThreshold != null && p.quantity <= p.lowStockThreshold;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/products/${p.id}`)}
                      style={{ borderBottom: `1px solid ${LINE}`, cursor: 'pointer' }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '10px 14px', color: FG3, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.sku || '—'}</td>
                      <td style={{ padding: '10px 14px', color: FG3 }}>{p.categoryId ? categoryById.get(p.categoryId) || '—' : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, background: BG_MUTED, border: `1px solid ${LINE}`, color: FG3 }}>
                          {t(`crm.products.status.${p.status}`)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>{formatMoney(p.price, p.currency)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {p.quantity}
                        {isLow && (
                          <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 10, background: '#fbecef', color: '#9a1f31' }}>
                            {t('crm.products.list.lowStockBadge')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: FG3 }}>{p.isVariable ? '✓' : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(p.id, e)}
                            style={{ fontSize: 12, color: FG3, background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            {t('crm.products.list.duplicateButton')}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(p.id, e)}
                            style={{ fontSize: 12, color: '#9a1f31', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            {t('crm.products.form.actions.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
            >
              ←
            </button>
            <span style={{ fontSize: 12, color: FG3 }}>{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              →
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
