// src/pages/products/ProductLabelsPrintPage.tsx
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { ProductBarcodePreview } from './ProductBarcodePreview';
import type { Product } from '../../api/products';

const INK = '#222';
const FG3 = '#888';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

function formatMoney(value: string | number, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

/** Печать листа наклеек (штрихкод/QR) для нескольких выбранных товаров сразу. */
export const ProductLabelsPrintPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const products = (location.state as { products?: Product[] } | null)?.products || [];

  const [columns, setColumns] = useState(3);
  const [copies, setCopies] = useState<Record<string, number>>({});

  const labels = useMemo(() => {
    const out: Array<{ product: Product; copyIndex: number }> = [];
    for (const p of products) {
      const n = Math.max(1, Math.min(50, Number(copies[p.id]) || 1));
      for (let i = 0; i < n; i++) out.push({ product: p, copyIndex: i });
    }
    return out;
  }, [products, copies]);

  if (!products.length) {
    return (
      <MainLayout>
        <div className="lv-pt w-full pb-10">
          <h1>{t('crm.products.labels.title')}</h1>
          <div className="sub max-w-2xl">{t('crm.products.labels.empty')}</div>
          <button
            type="button"
            onClick={() => navigate('/products')}
            style={{ marginTop: 16, padding: '8px 16px', fontSize: 12, borderRadius: 8, border: `1px solid ${INK}`, background: '#fff', color: INK, cursor: 'pointer' }}
          >
            {t('crm.products.labels.back')}
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .label-sheet { gap: 0 !important; }
          .label-card { break-inside: avoid; }
        }
      `}</style>
      <div className="lv-pt w-full pb-10">
        <div className="no-print" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1>{t('crm.products.labels.title')}</h1>
            <div className="sub max-w-2xl">{t('crm.products.labels.subtitle')}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: FG3, display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('crm.products.labels.columns')}
              <input
                type="number"
                min={1}
                max={6}
                value={columns}
                onChange={(e) => setColumns(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                style={{ width: 50, padding: '4px 6px', border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 12 }}
              />
            </label>
            <button
              type="button"
              onClick={() => navigate('/products')}
              style={{ padding: '8px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: INK, cursor: 'pointer' }}
            >
              {t('crm.products.labels.back')}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer' }}
            >
              {t('crm.products.labels.print')}
            </button>
          </div>
        </div>

        <div className="no-print" style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: 20 }}>
          <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: BG_MUTED, borderBottom: `1px solid ${LINE}` }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, textTransform: 'uppercase', color: FG3 }}>
                  {t('crm.products.list.columns.name')}
                </th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, textTransform: 'uppercase', color: FG3 }}>
                  {t('crm.products.list.columns.sku')}
                </th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, textTransform: 'uppercase', color: FG3 }}>
                  {t('crm.products.labels.copies')}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                  <td style={{ padding: '8px 10px' }}>{p.name}</td>
                  <td style={{ padding: '8px 10px', color: FG3 }}>{p.barcode || p.sku || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={copies[p.id] ?? 1}
                      onChange={(e) => setCopies((prev) => ({ ...prev, [p.id]: Number(e.target.value) || 1 }))}
                      style={{ width: 60, padding: '4px 6px', border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 12 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="label-sheet"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}
        >
          {labels.map(({ product: p, copyIndex }) => {
            const value = p.barcode || p.sku || '';
            return (
              <div
                key={`${p.id}-${copyIndex}`}
                className="label-card"
                style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 10, textAlign: 'center' }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: FG3, marginBottom: 6 }}>{formatMoney(p.price, p.currency)}</div>
                {value ? (
                  <ProductBarcodePreview value={value} />
                ) : (
                  <div style={{ fontSize: 11, color: FG3 }}>{t('crm.products.labels.noBarcode')}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
};
