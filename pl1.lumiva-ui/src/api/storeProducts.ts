// src/api/storeProducts.ts — тестовая витрина Товаров (/store/:clientKey/products/*)
import { publicClient } from "./publicClient";

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
}

export interface StoreProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  categoryId: string | null;
  images: Array<{ url: string; isCover?: boolean }>;
}

export interface StoreOrderItem {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface StoreOrderResult {
  orderCode: string;
  total: number;
  currency: string;
  items: StoreOrderItem[];
}

export async function fetchCategories(clientKey: string): Promise<StoreCategory[]> {
  const { data } = await publicClient.get(`/public/catalog/${clientKey}/categories`);
  return data;
}

export async function fetchProducts(clientKey: string, categoryId?: string): Promise<StoreProduct[]> {
  const { data } = await publicClient.get(`/public/catalog/${clientKey}/products`, {
    params: categoryId ? { category: categoryId } : undefined,
  });
  return data;
}

export async function fetchProduct(clientKey: string, sku: string): Promise<{ product: StoreProduct }> {
  const { data } = await publicClient.get(`/public/catalog/${clientKey}/products/${encodeURIComponent(sku)}`);
  return data;
}

export async function createOrder(
  clientKey: string,
  dto: {
    items: Array<{ sku: string; qty: number }>;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
  },
): Promise<StoreOrderResult> {
  const { data } = await publicClient.post(`/public/catalog/${clientKey}/orders`, dto);
  return data;
}

export async function lookupOrder(clientKey: string, code: string, email: string): Promise<StoreOrderResult & { status: string; createdAt: string; customerName: string }> {
  const { data } = await publicClient.get(`/public/catalog/${clientKey}/orders/${encodeURIComponent(code)}`, {
    params: { email },
  });
  return data;
}
