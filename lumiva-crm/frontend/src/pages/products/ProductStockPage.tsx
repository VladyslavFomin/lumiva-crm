// src/pages/products/ProductStockPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { fetchProductStock, adjustProductStock, type ProductStockRow } from '../../api/products';

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'px-3 py-2 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors placeholder:text-[#b5b5b5] text-[#222]';

export const ProductStockPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();

  const [rows, setRows] = useState<ProductStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<ProductStockRow | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchProductStock({ search: search || undefined, lowStockOnly })
      .then(setRows)
      .catch((e) => showAlert(e.message || t('crm.products.stock.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [search, lowStockOnly]);

  const openAdjust = (row: ProductStockRow) => {
    setAdjustTarget(row);
    setDelta('');
    setReason('');
  };

  const handleAdjustSave = async () => {
    if (!adjustTarget) return;
    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0) return;
    setSaving(true);
    try {
      await adjustProductStock({
        productId: adjustTarget.productId,
        variantId: adjustTarget.variantId,
        delta: d,
        reason: reason || undefined,
      });
      setAdjustTarget(null);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.stock.errors.adjustFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
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
          <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 10 }}>{t('crm.products.stock.title')}</h1>
          <div style={{ fontSize: 13, color: FG3, marginTop: 6 }}>{t('crm.products.stock.subtitle')}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className={inpCls}
            style={{ flex: '1 1 240px', minWidth: 200 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('crm.products.stock.searchPlaceholder') || ''}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: FG3 }}>
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            {t('crm.products.stock.lowStockOnly')}
          </label>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-[13px]" style={{ color: FG4 }}>{t('crm.products.stock.empty')}</div>
        ) : (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: BG_MUTED, borderBottom: `1px solid ${LINE}` }}>
                  {['product', 'sku', 'variant', 'quantity', 'threshold', 'actions'].map((c) => (
                    <th key={c} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: FG3 }}>
                      {t(`crm.products.stock.columns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.productId}-${r.variantId || 'base'}`} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                      <button
                        type="button"
                        onClick={() => navigate(`/products/${r.productId}`)}
                        style={{ background: 'none', border: 'none', padding: 0, color: INK, cursor: 'pointer', fontWeight: 500, textDecoration: 'underline dotted' }}
                      >
                        {r.productName}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px', color: FG3, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{r.sku || '—'}</td>
                    <td style={{ padding: '10px 14px', color: FG3 }}>{r.variantLabel || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.quantity}
                      {r.isLow && (
                        <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 10, background: '#fbecef', color: '#9a1f31' }}>
                          {t('crm.products.list.lowStockBadge')}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: FG3 }}>{r.lowStockThreshold ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        type="button"
                        onClick={() => openAdjust(r)}
                        style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                      >
                        {t('crm.products.stock.adjustButton')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {adjustTarget && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={() => setAdjustTarget(null)}
          >
            <div
              style={{ background: '#fff', borderRadius: 14, padding: 24, width: '92%', maxWidth: 420 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{t('crm.products.stock.adjustModal.title')}</div>
              <div style={{ fontSize: 12, color: FG3, marginBottom: 16 }}>
                {adjustTarget.productName}{adjustTarget.variantLabel ? ` · ${adjustTarget.variantLabel}` : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: FG3, marginBottom: 6 }}>
                    {t('crm.products.stock.adjustModal.deltaLabel')}
                  </label>
                  <input
                    type="number"
                    className={inpCls}
                    style={{ width: '100%' }}
                    value={delta}
                    onChange={(e) => setDelta(e.target.value)}
                    autoFocus
                  />
                  <div style={{ fontSize: 11, color: FG4, marginTop: 4 }}>{t('crm.products.stock.adjustModal.deltaHint')}</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: FG3, marginBottom: 6 }}>
                    {t('crm.products.stock.adjustModal.reasonLabel')}
                  </label>
                  <input className={inpCls} style={{ width: '100%' }} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setAdjustTarget(null)}
                    style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
                  >
                    {t('crm.products.stock.adjustModal.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAdjustSave}
                    disabled={saving || !delta || Number(delta) === 0}
                    style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer', opacity: saving || !delta || Number(delta) === 0 ? 0.6 : 1 }}
                  >
                    {t('crm.products.stock.adjustModal.save')}
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
