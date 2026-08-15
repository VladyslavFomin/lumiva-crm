import React, { useEffect, useMemo, useState } from 'react';
import { fetchPublicCategories, fetchPublicProducts, type PublicCatalogCategory, type PublicCatalogProduct } from '../../../api/publicCatalog';
import { resolvePublicAssetUrl } from '../../../api/client';
import type { EmbedFieldConfigItem } from '../../../api/embedForms';
import { fieldLabelStyle, pillButtonStyle, primaryButtonStyle } from './compositeFieldStyles';

export interface CartValue {
  items: Array<{ sku: string; qty: number }>;
}

interface CartLine {
  sku: string;
  qty: number;
  name: string;
  price: number;
  currency: string;
}

/** Составное поле "Товары" (kind='product_order') — мини-каталог с категориями и корзиной,
 * встроенный внутрь публичной формы. Данные берутся из того же /public/catalog/:clientKey/*,
 * что и тестовая витрина /store на pl1.lumiva-ui. */
export const ProductCartField: React.FC<{
  field: EmbedFieldConfigItem;
  clientKey: string;
  design: Record<string, unknown>;
  onChange: (value: CartValue) => void;
}> = ({ field, clientKey, design: d, onChange }) => {
  const [categories, setCategories] = useState<PublicCatalogCategory[]>([]);
  const [products, setProducts] = useState<PublicCatalogProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [lines, setLines] = useState<CartLine[]>([]);

  const allowedCategoryIds = field.sourceFilter?.categoryIds;

  useEffect(() => {
    fetchPublicCategories(clientKey)
      .then((rows) => setCategories(allowedCategoryIds?.length ? rows.filter((c) => allowedCategoryIds.includes(c.id)) : rows))
      .catch(() => {});
  }, [clientKey]);

  useEffect(() => {
    fetchPublicProducts(clientKey, activeCategory || undefined)
      .then((rows) => setProducts(allowedCategoryIds?.length ? rows.filter((p) => p.categoryId && allowedCategoryIds.includes(p.categoryId)) : rows))
      .catch(() => {});
  }, [clientKey, activeCategory]);

  useEffect(() => {
    onChange({ items: lines.map(({ sku, qty }) => ({ sku, qty })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);
  const currency = lines[0]?.currency;

  const addProduct = (p: PublicCatalogProduct) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.sku === p.sku);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { sku: p.sku, name: p.name, price: Number(p.price) || 0, currency: p.currency, qty: 1 }];
    });
  };

  const setQty = (sku: string, qty: number) => {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => l.sku !== sku) : prev.map((l) => (l.sku === sku ? { ...l, qty } : l))));
  };

  const border = String(d.borderColor || '#e5e7eb');
  const radius = Number(d.borderRadiusPx || 8);

  return (
    <div style={{ width: '100%' }}>
      <div style={fieldLabelStyle(d)}>{field.label}</div>

      {categories.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <button type="button" onClick={() => setActiveCategory('')} style={pillButtonStyle(d, !activeCategory)}>
            Все
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setActiveCategory(c.id)} style={pillButtonStyle(d, activeCategory === c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
        {products.map((p) => {
          const cover = p.images?.find((i) => i.isCover) || p.images?.[0];
          return (
            <div key={p.id} style={{ border: `1px solid ${border}`, borderRadius: radius + 2, padding: 10, boxShadow: '0 4px 14px rgba(15,23,42,.04)' }}>
              <div style={{ height: 74, borderRadius: radius, background: String(d.fieldBackground || '#f9fafb'), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 }}>
                {cover ? <img src={resolvePublicAssetUrl(cover.url) || undefined} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>📦</span>}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2, color: d.textColor as string }}>{p.name}</div>
              <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.7, color: d.textColor as string }}>{p.price} {p.currency}</div>
              <button type="button" onClick={() => addProduct(p)} style={{ ...primaryButtonStyle(d, false), width: '100%', padding: '6px 0', fontSize: 12 }}>
                Добавить
              </button>
            </div>
          );
        })}
        {!products.length && <span style={{ fontSize: 12, color: '#94a3b8' }}>Нет доступных товаров</span>}
      </div>

      {lines.length > 0 && (
        <div style={{ border: `1px solid ${border}`, borderRadius: radius + 2, padding: 12, background: String(d.fieldBackground || '#f9fafb') }}>
          {lines.map((l) => (
            <div key={l.sku} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '5px 0' }}>
              <span style={{ flex: 1, color: d.textColor as string }}>{l.name}</span>
              <input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => setQty(l.sku, Math.max(0, Number(e.target.value) || 0))}
                style={{ width: 48, border: `1px solid ${border}`, borderRadius: 6, padding: '3px 4px', textAlign: 'center', background: '#fff' }}
              />
              <span style={{ width: 76, textAlign: 'right', fontWeight: 600, color: d.textColor as string }}>{(l.price * l.qty).toFixed(2)}</span>
              <button type="button" onClick={() => setQty(l.sku, 0)} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
          <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13.5, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${border}`, color: d.textColor as string }}>
            Итого: {total.toFixed(2)} {currency}
          </div>
        </div>
      )}
    </div>
  );
};
