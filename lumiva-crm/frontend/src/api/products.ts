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
  | 'gallery'
  | 'wysiwyg'
  | 'colorpicker'
  | 'relation'
  | 'repeater';

export interface ProductImage {
  url: string;
  isCover?: boolean;
}

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  unit?: 'cm' | 'in';
}

export interface ProductPriceTier {
  minQty: number;
  price: number;
}

export interface ProductBundleItem {
  productId: string;
  quantity: number;
}

export interface ProductTranslation {
  name?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export type ProductRepeaterRow = Record<string, string | number>;

export interface ProductCategory {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  parentId: string | null;
  color: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategoryWithCount extends ProductCategory {
  productCount: number;
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
  group: string | null;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
  settings: Record<string, unknown> | null;
  width: '25' | '50' | '75' | '100';
  description: string | null;
  order: number;
  showInList: boolean;
  showInQuickEdit: boolean;
  showInFilters: boolean;
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
  slug: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  weight: string | null;
  dimensions: ProductDimensions | null;
  barcode: string | null;
  tags: string[];
  relatedProductIds: string[] | null;
  translations: Record<string, ProductTranslation> | null;
  salePrice: string | null;
  saleStartAt: string | null;
  saleEndAt: string | null;
  priceTiers: ProductPriceTier[] | null;
  isBundle: boolean;
  bundleItems: ProductBundleItem[] | null;
  isPubliclyVisible: boolean;
  prices: ProductPriceInCurrency[] | null;
  siteIds: string[] | null;
  publicationRequestedAt: string | null;
  publicationRequestedBy: string | null;
  publicationApprovedAt: string | null;
  publicationApprovedBy: string | null;
  publicationRejectedAt: string | null;
  publicationRejectionReason: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPriceInCurrency {
  currency: string;
  price: number;
}

export interface ProductChangeLog {
  id: string;
  tenantId: string;
  productId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string | null;
  createdAt: string;
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
  locationId: string | null;
  relatedMovementId: string | null;
  type: 'in' | 'out' | 'adjustment' | 'sale' | 'return' | 'transfer_out' | 'transfer_in';
  quantityDelta: number;
  resultingQuantity: number;
  reason: string | null;
  userId: string | null;
  source: string | null;
  createdAt: string;
}

export interface ProductStockLocationBreakdown {
  locationId: string;
  locationName: string;
  quantity: number;
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
  locations: ProductStockLocationBreakdown[];
}

export interface ProductLocation {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ categories */

export const fetchProductCategories = () => api.get<ProductCategory[]>('/products/categories');
export const fetchProductCategoriesTree = () =>
  api.get<{ categories: ProductCategoryWithCount[]; uncategorizedCount: number }>('/products/categories/tree');
export const createProductCategory = (dto: {
  name: string;
  slug?: string;
  order?: number;
  parentId?: string | null;
  color?: string;
}) => api.post<ProductCategory>('/products/categories', dto);
export const updateProductCategory = (
  id: string,
  dto: Partial<{
    name: string;
    slug: string;
    order: number;
    isActive: boolean;
    parentId: string | null;
    color: string;
  }>,
) => api.patch<ProductCategory>(`/products/categories/${id}`, dto);
export const deleteProductCategory = (id: string) => api.delete<{ ok: true }>(`/products/categories/${id}`);

/* ------------------------------------------------------------------ field defs */

export const fetchProductFieldDefs = () => api.get<ProductFieldDef[]>('/products/field-defs');
export const fetchProductFieldGroups = () => api.get<string[]>('/products/field-defs/groups');
export const createProductFieldDef = (dto: {
  key?: string;
  label: string;
  type: ProductFieldType;
  group?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  settings?: Record<string, unknown>;
  width?: string;
  description?: string;
  showInList?: boolean;
  showInQuickEdit?: boolean;
  showInFilters?: boolean;
}) => api.post<ProductFieldDef>('/products/field-defs', dto);
export const updateProductFieldDef = (
  id: string,
  dto: Partial<{
    label: string;
    type: ProductFieldType;
    group: string | null;
    required: boolean;
    options: Array<{ value: string; label: string }>;
    settings: Record<string, unknown>;
    width: string;
    description: string;
    showInList: boolean;
    showInQuickEdit: boolean;
    showInFilters: boolean;
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
  slug?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  weight?: number | null;
  dimensions?: ProductDimensions | null;
  barcode?: string | null;
  tags?: string[];
  relatedProductIds?: string[];
  translations?: Record<string, ProductTranslation>;
  salePrice?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  priceTiers?: ProductPriceTier[];
  isBundle?: boolean;
  bundleItems?: ProductBundleItem[];
  prices?: ProductPriceInCurrency[];
  siteIds?: string[];
}

export const createProduct = (dto: ProductDto) => api.post<Product>('/products', dto);
export const updateProduct = (id: string, dto: Partial<ProductDto>) => api.patch<Product>(`/products/${id}`, dto);

/* ------------------------------------------------------------------ publication moderation */

export const requestProductPublication = (id: string) => api.post<Product>(`/products/${id}/request-publication`, {});
export const approveProductPublication = (id: string) => api.post<Product>(`/products/${id}/approve-publication`, {});
export const rejectProductPublication = (id: string, reason?: string) =>
  api.post<Product>(`/products/${id}/reject-publication`, { reason });
export const unpublishProduct = (id: string) => api.post<Product>(`/products/${id}/unpublish`, {});
export const fetchProductPublicationQueue = () => api.get<Product[]>('/products/publication-queue');
export const deleteProduct = (id: string) => api.delete<{ ok: true }>(`/products/${id}`);
export const duplicateProduct = (id: string) =>
  api.post<{ product: Product; variants: ProductVariant[] }>(`/products/${id}/duplicate`, {});
export const fetchProductChangeLogs = (id: string) => api.get<ProductChangeLog[]>(`/products/${id}/changes`);

export const bulkUpdateProducts = (dto: {
  productIds: string[];
  categoryId?: string | null;
  status?: string;
  tagsToAdd?: string[];
  tagsToRemove?: string[];
}) => api.post<{ updated: number }>('/products/bulk-update', dto);

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

/* ------------------------------------------------------------------ locations (склады) */

export const fetchProductLocations = () => api.get<ProductLocation[]>('/products/locations');
export const createProductLocation = (dto: { name: string; code?: string | null }) =>
  api.post<ProductLocation>('/products/locations', dto);
export const updateProductLocation = (
  id: string,
  dto: Partial<{ name: string; code: string | null; isActive: boolean; isDefault: boolean }>,
) => api.patch<ProductLocation>(`/products/locations/${id}`, dto);
export const deleteProductLocation = (id: string) =>
  api.delete<{ ok: true }>(`/products/locations/${id}`);

/* ------------------------------------------------------------------ stock */

export const fetchProductStock = (query?: {
  search?: string;
  categoryId?: string;
  lowStockOnly?: boolean;
  locationId?: string;
}) => api.get<ProductStockRow[]>('/products/stock', { params: query });

export const adjustProductStock = (dto: {
  productId: string;
  variantId?: string | null;
  locationId?: string | null;
  delta: number;
  reason?: string;
}) => api.post<ProductStockMovement>('/products/stock/adjust', dto);

export const transferProductStock = (dto: {
  productId: string;
  variantId?: string | null;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  reason?: string;
}) => api.post<{ ok: true; outMovementId: string; inMovementId: string }>('/products/stock/transfer', dto);

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
  unmatchedColumns: string[];
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
  createdFieldLabels: string[];
}

export const applyProductImport = (dto: {
  importId: string;
  mapping: Record<string, string | null>;
  updateExisting?: boolean;
  newFields?: Array<{ column: string; label: string }>;
}) => api.post<ProductImportResult>('/products/import/apply', dto);

export async function exportProducts(query?: {
  format?: 'xlsx' | 'csv' | 'pdf';
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
  const filename = match ? match[1] : `products.${query?.format === 'csv' ? 'csv' : query?.format === 'pdf' ? 'pdf' : 'xlsx'}`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ image upload */

export async function uploadProductImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  return api.postForm<{ url: string }>('/products/images/upload', form);
}

/* ------------------------------------------------------------------ webhooks */

export type ProductWebhookEvent =
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'product.stock_changed'
  | 'product.published';

export interface ProductWebhook {
  id: string;
  tenantId: string;
  siteId: string | null;
  name: string;
  url: string;
  secret: string;
  events: ProductWebhookEvent[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export const fetchProductWebhooks = () => api.get<ProductWebhook[]>('/products/webhooks');
export const createProductWebhook = (dto: {
  name: string;
  url: string;
  events: ProductWebhookEvent[];
  siteId?: string | null;
}) => api.post<ProductWebhook>('/products/webhooks', dto);
export const updateProductWebhook = (
  id: string,
  dto: Partial<{ name: string; url: string; events: ProductWebhookEvent[]; siteId: string | null; isActive: boolean }>,
) => api.patch<ProductWebhook>(`/products/webhooks/${id}`, dto);
export const regenerateProductWebhookSecret = (id: string) =>
  api.post<ProductWebhook>(`/products/webhooks/${id}/regenerate-secret`, {});
export const deleteProductWebhook = (id: string) => api.delete<{ ok: true }>(`/products/webhooks/${id}`);

export type ProductWebhookDeliveryStatus = 'pending' | 'success' | 'failed';
export interface ProductWebhookDelivery {
  id: string;
  webhookId: string;
  event: ProductWebhookEvent;
  status: ProductWebhookDeliveryStatus;
  attempt: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}
export const fetchProductWebhookDeliveries = (webhookId: string) =>
  api.get<ProductWebhookDelivery[]>(`/products/webhooks/${webhookId}/deliveries`);

/* ------------------------------------------------------------------ analytics */

export interface ProductsAnalyticsFilters {
  from?: string;
  to?: string;
  status?: ProductStatus;
  categoryId?: string;
  locationId?: string;
  tag?: string;
  search?: string;
  displayCurrency?: string;
  /** Множители валюта -> displayCurrency, см. GET /marketing/fx-rates multiplyToDisplay */
  rates?: Record<string, number>;
}

export interface ProductsAnalyticsByCategory {
  categoryId: string | null;
  name: string;
  color: string | null;
  count: number;
  value: number;
  stockUnits: number;
}
export interface ProductsAnalyticsByStatus {
  status: ProductStatus;
  count: number;
  value: number;
}
export interface ProductsAnalyticsByCurrency {
  currency: string;
  count: number;
  nativeValue: number;
  convertedValue: number;
}
export interface ProductsAnalyticsByTag {
  tag: string;
  count: number;
}
export interface ProductsAnalyticsByLocation {
  locationId: string;
  name: string;
  isDefault: boolean;
  productCount: number;
  stockUnits: number;
  value: number;
  lowStockCount: number;
}
export interface ProductsAnalyticsTopProduct {
  id: string;
  name: string;
  sku: string | null;
  currency: string;
  price: number;
  quantity: number;
  value: number;
}
export interface ProductsAnalyticsLowStock {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  lowStockThreshold: number;
}
export interface ProductsAnalyticsMovementBucket {
  period: string;
  in: number;
  out: number;
  net: number;
}
export interface ProductsAnalyticsMarginBucket {
  bucket: string;
  count: number;
}

export interface ProductsAnalyticsResult {
  displayCurrency: string;
  filters: {
    from: string | null;
    to: string | null;
    status: string | null;
    categoryId: string | null;
    locationId: string | null;
    tag: string | null;
    search: string | null;
  };
  kpis: {
    totalProducts: number;
    activeProducts: number;
    totalCatalogValue: number;
    totalCostValue: number;
    avgMarginPct: number | null;
    totalStockUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalCategories: number;
    totalWarehouses: number;
  };
  byCategory: ProductsAnalyticsByCategory[];
  byStatus: ProductsAnalyticsByStatus[];
  byCurrency: ProductsAnalyticsByCurrency[];
  byTag: ProductsAnalyticsByTag[];
  byLocation: ProductsAnalyticsByLocation[];
  topProducts: ProductsAnalyticsTopProduct[];
  lowStock: ProductsAnalyticsLowStock[];
  outOfStock: Array<{ id: string; name: string; sku: string | null }>;
  marginBuckets: ProductsAnalyticsMarginBucket[];
  stockMovementTimeline: ProductsAnalyticsMovementBucket[];
}

function buildAnalyticsParams(filters?: ProductsAnalyticsFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (!filters) return p;
  if (filters.from) p.from = filters.from;
  if (filters.to) p.to = filters.to;
  if (filters.status) p.status = filters.status;
  if (filters.categoryId) p.categoryId = filters.categoryId;
  if (filters.locationId) p.locationId = filters.locationId;
  if (filters.tag) p.tag = filters.tag;
  if (filters.search) p.search = filters.search;
  if (filters.displayCurrency) p.displayCurrency = filters.displayCurrency;
  if (filters.rates) p.rates = JSON.stringify(filters.rates);
  return p;
}

export const fetchProductsAnalytics = (filters?: ProductsAnalyticsFilters) =>
  api.get<ProductsAnalyticsResult>('/products/analytics', { params: buildAnalyticsParams(filters) });

export async function exportProductsAnalytics(filters?: ProductsAnalyticsFilters): Promise<void> {
  const token = getAccessToken();
  const params = new URLSearchParams(buildAnalyticsParams(filters));
  const res = await fetch(`${API_BASE}/products/analytics/export?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Не удалось экспортировать аналитику: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'products-analytics.xlsx';
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const fetchProductsAnalyticsPreset = () => api.get<Record<string, any> | null>('/products/analytics/preset');
export const saveProductsAnalyticsPreset = (payload: Record<string, any>) =>
  api.patch<Record<string, any>>('/products/analytics/preset', { payload });
