import { api } from './client';
import type { CustomFieldDef, CustomFieldType } from './customFields';

export type ProductStatus = 'active' | 'draft' | 'archived' | 'out_of_stock';

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

export interface ProductDto {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  status: ProductStatus;
  price: string;
  salePrice: string | null;
  currency: string;
  isVariable: boolean;
  quantity: number;
  lowStockThreshold: number | null;
  unit: string | null;
  images: ProductImage[];
  tags: string[];
  barcode?: string | null;
  weight?: string | null;
  dimensions?: ProductDimensions | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  isPubliclyVisible?: boolean;
  externalId?: string | null;
  slug?: string | null;
  customFields?: Record<string, any> | null;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string;
  categoryId: string | null;
  status: ProductStatus;
  price: number;
  salePrice: number | null;
  currency: string;
  isVariable: boolean;
  quantity: number;
  lowStockThreshold: number | null;
  unit: string | null;
  coverImage: string | null;
  images: string[];
  tags: string[];
  barcode: string | null;
  weight: number | null;
  dimensions: ProductDimensions | null;
  saleStartAt: string | null;
  saleEndAt: string | null;
  isPubliclyVisible: boolean;
  externalId: string | null;
  slug: string | null;
  customFields: Record<string, any> | null;
  createdAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  color: string;
}

function mapProduct(dto: ProductDto): Product {
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.name,
    description: dto.description ?? '',
    categoryId: dto.categoryId,
    status: dto.status,
    price: Number(dto.price || 0),
    salePrice: dto.salePrice ? Number(dto.salePrice) : null,
    currency: dto.currency || 'EUR',
    isVariable: dto.isVariable,
    quantity: dto.quantity,
    lowStockThreshold: dto.lowStockThreshold,
    unit: dto.unit,
    coverImage: dto.images?.find((i) => i.isCover)?.url || dto.images?.[0]?.url || null,
    images: (dto.images || []).map((i) => i.url),
    tags: dto.tags || [],
    barcode: dto.barcode ?? null,
    weight: dto.weight != null && dto.weight !== '' ? Number(dto.weight) : null,
    dimensions: dto.dimensions ?? null,
    saleStartAt: dto.saleStartAt ?? null,
    saleEndAt: dto.saleEndAt ?? null,
    isPubliclyVisible: !!dto.isPubliclyVisible,
    externalId: dto.externalId ?? null,
    slug: dto.slug ?? null,
    customFields: dto.customFields ?? null,
    createdAt: dto.createdAt,
  };
}

export interface ProductAttributeValue {
  id: string;
  value: string;
  label: string;
  colorHex?: string;
}

export interface ProductAttribute {
  id: string;
  name: string;
  values: ProductAttributeValue[];
}

export interface ProductVariant {
  id: string;
  attributeValues: Record<string, string>;
  sku: string | null;
  quantity: number;
  priceOverride: number | null;
  isActive: boolean;
}

export async function fetchProductAttributes(): Promise<ProductAttribute[]> {
  const res = await api.get<ProductAttribute[]>('/products/attributes');
  return res.data;
}

export async function fetchProductVariants(productId: string): Promise<ProductVariant[]> {
  const res = await api.get<any[]>(`/products/${productId}/variants`);
  return res.data.map((v) => ({
    id: v.id,
    attributeValues: v.attributeValues || {},
    sku: v.sku,
    quantity: v.quantity,
    priceOverride: v.priceOverride != null ? Number(v.priceOverride) : null,
    isActive: v.isActive,
  }));
}

export function describeVariant(variant: ProductVariant, attributes: ProductAttribute[]): string {
  const parts = Object.entries(variant.attributeValues).map(([attrId, valueId]) => {
    const attr = attributes.find((a) => a.id === attrId);
    const val = attr?.values.find((v) => v.id === valueId);
    return val?.label || val?.value || '?';
  });
  return parts.length > 0 ? parts.join(' / ') : '—';
}

export async function fetchProducts(params?: { status?: ProductStatus; categoryId?: string; search?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.categoryId) search.set('categoryId', params.categoryId);
  if (params?.search) search.set('search', params.search);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const res = await api.get<{ items: ProductDto[]; total: number }>(`/products${qs ? `?${qs}` : ''}`);
  return { items: res.data.items.map(mapProduct), total: res.data.total };
}

export async function fetchProduct(id: string): Promise<Product> {
  const res = await api.get<{ product: ProductDto }>(`/products/${id}`);
  return mapProduct(res.data.product);
}

export async function fetchProductCategories(): Promise<ProductCategory[]> {
  const res = await api.get<{ id: string; name: string; color: string }[]>('/products/categories');
  return res.data;
}

export async function deleteProduct(id: string) {
  await api.delete(`/products/${id}`);
}

export interface CreateProductPayload {
  name: string;
  sku?: string | null;
  categoryId?: string | null;
  price?: number;
  currency?: string;
  quantity?: number;
  unit?: string | null;
  status?: ProductStatus;
  description?: string | null;
}

export async function createProduct(payload: CreateProductPayload): Promise<void> {
  await api.post('/products', payload);
}

export interface UpdateProductPayload {
  name?: string;
  sku?: string | null;
  description?: string | null;
  categoryId?: string | null;
  status?: ProductStatus;
  price?: number;
  salePrice?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  currency?: string;
  unit?: string | null;
  lowStockThreshold?: number | null;
  barcode?: string | null;
  weight?: number | null;
  dimensions?: ProductDimensions | null;
  tags?: string[];
  /** Send the FULL object — the server rebuilds product custom fields from what is sent and drops omitted keys. */
  customFields?: Record<string, any>;
}

/** `PATCH /products/:id` — the same endpoint the website's product form saves through (RBAC `products` write). */
export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  const res = await api.patch<{ product?: ProductDto } | ProductDto>(`/products/${id}`, payload);
  const dto = (res.data as any)?.product ?? res.data;
  return mapProduct(dto as ProductDto);
}

export interface ProductCategoryWithCount {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  color: string;
  productCount: number;
}

export async function fetchProductCategoriesWithCounts(): Promise<{ categories: ProductCategoryWithCount[]; uncategorizedCount: number }> {
  const res = await api.get<{ categories: ProductCategoryWithCount[]; uncategorizedCount: number }>('/products/categories/tree');
  return res.data;
}

export async function createProductCategory(name: string, color?: string): Promise<ProductCategoryWithCount> {
  const res = await api.post<ProductCategoryWithCount>('/products/categories', { name, color });
  return res.data;
}

export async function deleteProductCategory(id: string): Promise<void> {
  await api.delete(`/products/categories/${id}`);
}

export interface ProductLocation {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
}

export async function fetchProductLocations(): Promise<ProductLocation[]> {
  const res = await api.get<ProductLocation[]>('/products/locations');
  return res.data;
}

export async function createProductLocation(name: string, code?: string): Promise<ProductLocation> {
  const res = await api.post<ProductLocation>('/products/locations', { name, code });
  return res.data;
}

export async function deleteProductLocation(id: string): Promise<void> {
  await api.delete(`/products/locations/${id}`);
}

export interface ProductsAnalytics {
  displayCurrency: string;
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
  byCategory: { categoryId: string | null; name: string; color: string | null; count: number; value: number; stockUnits: number }[];
  byStatus: { status: ProductStatus; count: number; value: number }[];
  byCurrency: { currency: string; count: number; nativeValue: number; convertedValue: number }[];
  byLocation: { locationId: string; name: string; isDefault: boolean; productCount: number; stockUnits: number; value: number; lowStockCount: number }[];
  topProducts: { id: string; name: string; sku: string | null; currency: string; price: number; quantity: number; value: number }[];
  lowStock: { id: string; name: string; sku: string | null; quantity: number; lowStockThreshold: number }[];
  outOfStock: { id: string; name: string; sku: string | null }[];
  marginBuckets: { bucket: string; count: number }[];
  stockMovementTimeline: { period: string; in: number; out: number; net: number }[];
}

/** `displayCurrency` + `rates` are required for any non-EUR product to be converted — without them the server treats 1 TRY as 1 EUR. */
export async function fetchProductsAnalytics(params?: { displayCurrency?: string; rates?: string }): Promise<ProductsAnalytics> {
  const res = await api.get<ProductsAnalytics>('/products/analytics', { params });
  return res.data;
}

interface ProductFieldDefDto {
  id: string;
  key: string;
  label: string;
  type: string;
  group: string | null;
  required: boolean;
  options: { value: string; label: string }[] | null;
  description: string | null;
  order: number;
  isActive: boolean;
}

// Product fields are their own system (`/products/field-defs`, RBAC `products_manage_fields` to *define* them); values live in `product.customFields`.
const PRODUCT_FIELD_TYPE_MAP: Record<string, CustomFieldType> = {
  text: 'text', textarea: 'textarea', wysiwyg: 'textarea', number: 'number', date: 'date', datetime: 'datetime', boolean: 'boolean',
  select: 'select', radio: 'select', multiselect: 'multiselect', url: 'url', colorpicker: 'text',
};

/** Product field definitions mapped onto the shared `CustomFieldDef` shape so the same section renders/edits them.
 *  media / gallery / relation / repeater have no mobile editor → shown read-only as `complex`. */
export async function fetchProductFieldDefs(): Promise<CustomFieldDef[]> {
  const res = await api.get<ProductFieldDefDto[]>('/products/field-defs');
  return res.data
    .filter((f) => f.isActive)
    .sort((a, b) => a.order - b.order)
    .map((f) => {
      const mapped = PRODUCT_FIELD_TYPE_MAP[f.type];
      return {
        id: f.id, entityType: 'product' as const, key: f.key, label: f.label, type: mapped ?? 'complex', required: f.required,
        placeholder: null, helpText: f.description, options: f.options, order: f.order, isActive: true, group: f.group, readOnly: !mapped,
      };
    });
}
