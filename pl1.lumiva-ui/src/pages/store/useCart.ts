// src/pages/store/useCart.ts — корзина тестовой витрины, живёт в localStorage (без бэкенда —
// см. план "Test storefront": цена всё равно всегда пересчитывается сервером при оформлении).
import { useCallback, useEffect, useState } from "react";

export interface CartItem {
  sku: string;
  name: string;
  price: number;
  currency: string;
  qty: number;
}

function storageKey(clientKey: string) {
  return `pl1_store_cart_${clientKey}`;
}

function readCart(clientKey: string): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(clientKey));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useCart(clientKey: string) {
  const [items, setItems] = useState<CartItem[]>(() => readCart(clientKey));

  useEffect(() => {
    setItems(readCart(clientKey));
  }, [clientKey]);

  const persist = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      localStorage.setItem(storageKey(clientKey), JSON.stringify(next));
    },
    [clientKey],
  );

  const addItem = useCallback(
    (item: Omit<CartItem, "qty">, qty = 1) => {
      const existing = readCart(clientKey);
      const idx = existing.findIndex((i) => i.sku === item.sku);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], qty: existing[idx].qty + qty };
      } else {
        existing.push({ ...item, qty });
      }
      persist([...existing]);
    },
    [clientKey, persist],
  );

  const setQty = useCallback(
    (sku: string, qty: number) => {
      const existing = readCart(clientKey);
      const next = qty <= 0 ? existing.filter((i) => i.sku !== sku) : existing.map((i) => (i.sku === sku ? { ...i, qty } : i));
      persist(next);
    },
    [clientKey, persist],
  );

  const removeItem = useCallback((sku: string) => setQty(sku, 0), [setQty]);
  const clear = useCallback(() => persist([]), [persist]);

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return { items, addItem, setQty, removeItem, clear, total, count };
}
