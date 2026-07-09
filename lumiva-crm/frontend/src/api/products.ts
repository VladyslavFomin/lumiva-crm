// src/api/products.ts
import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

export type ProductStatus = 'active' | 'draft' | 'archived' | 'out_of_stock';
export type ProductFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'url'
  | 'media'
  | 'gallery';

export interface ProductImage {
  url: string;
  isCover?: boolean;
}

export interface ProductCategory {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAttributeValue {
  id: string;
  value: string;
  label: string;
  colorHex?: string;
}

export interface ProductAttribute {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  values: ProductAttributeValue[];
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFieldDef {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  type: ProductFieldType;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
  settings: Record<string, unknown> | null;
  width: '25' | '50' | '75' | '100';
  description: string | null;
  order: number;
  showInList: boolean;
  showInQuickEdit: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  status: ProductStatus;
  price: string;
  costPrice: string | null;
  currency: string;
  isVariable: boolean;
  variantAttributeIds: string[] | null;
  quantity: number;
  lowStockThreshold: number | null;
  unit: string | null;
  images: ProductImage[];
  externalId: string | null;
  customFields: Record<string, unknown>;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  attributeValues: Record<string, string>;
  sku: string | null;
  quantity: number;
  priceOverride: string | null;
  images: ProductImage[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductStockMovement {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  type: 'in' | 'out' | 'adjustment' | 'sale' | 'return';
  quantityDelta: number;
  resultingQuantity: number;
  reason: string | null;
  userId: string | null;
  source: string | null;
  createdAt: string;
}

export interface ProductStockRow {
  productId: string;
  productName: string;
  sku: string | null;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  lowStockThreshold: number | null;
  isLow: boolean;
}

/* ------------------------------------------------------------------ categories */

export const fetchProductCategories = () => api.get<ProductCategory[]>('/products/categories');
export const createProductCategory = (dto: { name: string; slug?: string; order?: number }) =>
  api.post<ProductCategory>('/products/categories', dto);
export const updateProductCategory = (
  id: string,
  dto: Partial<{ name: string; slug: string; order: number; isActive: boolean }>,
) => api.patch<ProductCategory>(`/products/categories/${id}`, dto);
export const deleteProductCategory = (id: string) => api.delete<{ ok: true }>(`/products/categories/${id}`);

/* ------------------------------------------------------------------ field defs */

export const fetchProductFieldDefs = () => api.get<ProductFieldDef[]>('/products/field-defs');
export const createProductFieldDef = (dto: {
  key?: string;
  label: string;
  type: ProductFieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  settings?: Record<string, unknown>;
  width?: string;
  description?: string;
  showInList?: boolean;
  showInQuickEdit?: boolean;
}) => api.post<ProductFieldDef>('/products/field-defs', dto);
export const updateProductFieldDef = (
  id: string,
  dto: Partial<{
    label: string;
    required: boolean;
    options: Array<{ value: string; label: string }>;
    settings: Record<string, unknown>;
    width: string;
    description: string;
    showInList: boolean;
    showInQuickEdit: boolean;
    isActive: boolean;
  }>,
) => api.patch<ProductFieldDef>(`/products/field-defs/${id}`, dto);
export const deleteProductFieldDef = (id: string) => api.delete<{ ok: true }>(`/products/field-defs/${id}`);
export const reorderProductFieldDefs = (orderedIds: string[]) =>
  api.post<ProductFieldDef[]>('/products/field-defs/reorder', { orderedIds });

/* ------------------------------------------------------------------ attributes */

export const fetchProductAttributes = () => api.get<ProductAttribute[]>('/products/attributes');
export const createProductAttribute = (dto: { name: string; slug?: string }) =>
  api.post<ProductAttribute>('/products/attributes', dto);
export const updateProductAttribute = (
  id: string,
  dto: Partial<{ name: string; order: number; isActive: boolean }>,
) => api.patch<ProductAttribute>(`/products/attributes/${id}`, dto);
export const deleteProductAttribute = (id: string) => api.delete<{ ok: true }>(`/products/attributes/${id}`);
export const addProductAttributeValue = (
  id: string,
  dto: { value: string; label?: string; colorHex?: string },
) => api.post<ProductAttribute>(`/products/attributes/${id}/values`, dto);
export const removeProductAttributeValue = (id: string, valueId: string) =>
  api.delete<ProductAttribute>(`/products/attributes/${id}/values/${valueId}`);

/* ------------------------------------------------------------------ products */

export interface ListProductsQuery {
  status?: string;
  categoryId?: string;
  isVariable?: boolean;
  search?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export const fetchProducts = (query?: ListProductsQuery) =>
  api.get<{ items: Product[]; total: number; page: number; limit: number }>('/products', { params: query });

export const fetchProduct = (id: string) => api.get<{ product: Product; variants: ProductVariant[] }>(`/products/${id}`);

export interface ProductDto {
  name: string;
  sku?: string | null;
  description?: string | null;
  categoryId?: string | null;
  status?: ProductStatus;
  price?: number;
  costPrice?: number | null;
  currency?: string;
  unit?: string | null;
  lowStockThreshold?: number | null;
  images?: ProductImage[];
  quantity?: number;
  isVariable?: boolean;
  variantAttributeIds?: string[];
  customFields?: Record<string, unknown>;
  externalId?: string | null;
}

export const createProduct = (dto: ProductDto) => api.post<Product>('/products', dto);
export const updateProduct = (id: string, dto: Partial<ProductDto>) => api.patch<Product>(`/products/${id}`, dto);
export const deleteProduct = (id: string) => api.delete<{ ok: true }>(`/products/${id}`);
export const duplicateProduct = (id: string) =>
  api.post<{ product: Product; variants: ProductVariant[] }>(`/products/${id}/duplicate`, {});

/* ------------------------------------------------------------------ variants */

export const fetchProductVariants = (productId: string) =>
  api.get<ProductVariant[]>(`/products/${productId}/variants`);
export const generateProductVariants = (productId: string, attributeIds: string[]) =>
  api.post<ProductVariant[]>(`/products/${productId}/variants/generate`, { attributeIds });
export const updateProductVariant = (
  productId: string,
  variantId: string,
  dto: Partial<{ sku: string | null; priceOverride: number | null; images: ProductImage[] | null; isActive: boolean }>,
) => api.patch<ProductVariant>(`/products/${productId}/variants/${variantId}`, dto);
export const deleteProductVariant = (productId: string, variantId: string) =>
  api.delete<{ ok: true }>(`/products/${productId}/variants/${variantId}`);

/* ------------------------------------------------------------------ stock */

export const fetchProductStock = (query?: { search?: string; categoryId?: string; lowStockOnly?: boolean }) =>
  api.get<ProductStockRow[]>('/products/stock', { params: query });

export const adjustProductStock = (dto: {
  productId: string;
  variantId?: string | null;
  delta: number;
  reason?: string;
}) => api.post<ProductStockMovement>('/products/stock/adjust', dto);

export const fetchProductStockMovements = (query?: { productId?: string; variantId?: string; limit?: number }) =>
  api.get<ProductStockMovement[]>('/products/stock/movements', { params: query });

/* ------------------------------------------------------------------ import/export */

export interface ProductImportPreview {
  importId: string;
  columns: string[];
  sample: Array<Record<string, unknown>>;
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
  mappableFields: Array<{ key: string; label: string }>;
}

export async function previewProductImport(file: File): Promise<ProductImportPreview> {
  const form = new FormData();
  form.append('file', file);
  return api.postForm<ProductImportPreview>('/products/import/preview', form);
}

export interface ProductImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}

export const applyProductImport = (dto: {
  importId: string;
  mapping: Record<string, string | null>;
  updateExisting?: boolean;
}) => api.post<ProductImportResult>('/products/import/apply', dto);

export async function exportProducts(query?: {
  format?: 'xlsx' | 'csv';
  status?: string;
  categoryId?: string;
}): Promise<void> {
  const token = getAccessToken();
  const params = new URLSearchParams();
  if (query?.format) params.set('format', query.format);
  if (query?.status) params.set('status', query.status);
  if (query?.categoryId) params.set('categoryId', query.categoryId);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/products/export${qs ? `?${qs}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Не удалось экспортировать товары: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `products.${query?.format === 'csv' ? 'csv' : 'xlsx'}`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
