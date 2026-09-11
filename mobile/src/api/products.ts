import { api } from './client';

export type ProductStatus = 'active' | 'draft' | 'archived' | 'out_of_stock';

export interface ProductImage {
  url: string;
  isCover?: boolean;
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
