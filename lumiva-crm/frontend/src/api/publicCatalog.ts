// src/api/publicCatalog.ts — публичный каталог товаров (/public/catalog/:clientKey/*), без JWT.
// Используется составным полем product_cart на публичной странице формы (PublicEmbedFormPage).
import { publicJson } from './embedForms';

export interface PublicCatalogCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PublicCatalogProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  categoryId: string | null;
  images: Array<{ url: string; isCover?: boolean }>;
}

export async function fetchPublicCategories(clientKey: string): Promise<PublicCatalogCategory[]> {
  return publicJson(`/public/catalog/${encodeURIComponent(clientKey)}/categories`);
}

export async function fetchPublicProducts(clientKey: string, categoryId?: string): Promise<PublicCatalogProduct[]> {
  const qs = categoryId ? `?category=${encodeURIComponent(categoryId)}` : '';
  return publicJson(`/public/catalog/${encodeURIComponent(clientKey)}/products${qs}`);
}
