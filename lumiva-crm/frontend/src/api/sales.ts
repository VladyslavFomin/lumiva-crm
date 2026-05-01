// src/api/sales.ts
import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

/* ─────────────────────────────
 * Базовые типы
 * ───────────────────────────── */

export type SaleStatus =
  | 'new'
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'refunded'
  | 'other';

export interface Sale {
  id: string;

  channelId: string | null;
  // на будущее, если бэкенд будет отдавать join:
  channel?: {
    id: string;
    name: string;
  };

  externalId: string | null;
  externalOrderNo: string | null;

  saleDate: string | null;

  guestName: string | null;
  agentName: string | null;
  hotel: string | null;   // в UI используем как "продукт"
  market: string | null;

  amount: number;
  currency: string;
  status: SaleStatus;

  checkInAt: string | null;
  checkOutAt: string | null;

  managerName: string | null;
  notes: string | null;
  customFields?: Record<string, any> | null;

  /** Сырой payload Woo и др. (для ссылки на товар из line_items). */
  rawPayload?: Record<string, unknown> | null;

  /** Ссылка на редактирование заказа в WP admin (если бэкенд смог собрать из интеграции WooCommerce). */
  wooAdminEditUrl?: string | null;

  /** Домен сайта канала (из URL интеграции или имени канала). */
  channelSiteLabel?: string | null;
  /** Тип интеграции для отображения (напр. WooCommerce). */
  channelIntegrationLabel?: string | null;

  // Привязанный лид (опционально)
  leadId?: string | null;

  createdAt: string;
  updatedAt: string;
}

/* ─────────────────────────────
 * Детализированное представление заказа
 * ───────────────────────────── */

export interface SaleDetail {
  id: string;

  // Краткая информация о канале
  channel: {
    id: string;
    name: string;
    type: string;
  } | null;

  // Краткая информация об интеграции
  integration: {
    id: string;
    name: string;
    kind: string; // IntegrationKind
  } | null;

  // Все поля, что есть в таблице sale (как есть)
  sale: Record<string, any>;

  // metaJson / payloadJson, если есть
  meta: Record<string, any> | null;
}

/* ─────────────────────────────
 * Список продаж / статистика
 * ───────────────────────────── */

export interface ListSalesResponse {
  items: Sale[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListSalesParams {
  page?: number;
  pageSize?: number;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  status?: SaleStatus;
  channelId?: string;
  search?: string;
  /** Продажи, привязанные к лиду */
  leadId?: string;
}

export interface SalesByStatusDto {
  status: SaleStatus;
  count: number;
  amount: number;
}

export interface SalesByCurrencyDto {
  currency: string;
  amount: number;
}

export interface SalesStats {
  totalAmount: number;
  totalCount: number;
  avgCheck: number;
  byStatus: SalesByStatusDto[];
  byCurrency: SalesByCurrencyDto[];
}

export interface SalesAnalyticsSeriesRow {
  month: string;
  [channelId: string]: number | string;
}

export interface SalesAnalyticsCustomField {
  key: string;
  label: string;
  type: string;
  items: Array<{ label: string; count: number; amount: number }>;
}

export interface SalesAnalyticsResponse {
  totalCount: number;
  totalAmount: number;
  avgCheck: number;
  displayCurrency: string;
  currencyMode: 'native' | 'converted';
  byStatus: Array<{ status: SaleStatus; count: number; amount: number }>;
  byChannel: Array<{ channelId: string | null; label: string; count: number; amount: number }>;
  byProduct: Array<{ label: string; count: number; amount: number }>;
  byMarket: Array<{ label: string; count: number; amount: number }>;
  byManager: Array<{ label: string; count: number; amount: number }>;
  byCurrency: Array<{ label: string; count: number; amount: number }>;
  timeline: {
    count: SalesAnalyticsSeriesRow[];
    amount: SalesAnalyticsSeriesRow[];
  };
  customFields: Record<string, SalesAnalyticsCustomField>;
  sampleSales: Sale[];
}

/* ─────────────────────────────
 * Payload для обновления продажи
 * ───────────────────────────── */

export interface UpdateSalePayload {
  status?: SaleStatus;
  managerName?: string | null;
  notes?: string | null;
  leadId?: string | null;
  customFields?: Record<string, any> | null;
}

/* ───────────────────── helpers ───────────────────── */

function buildQuery(params: Record<string, any>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join('&');

  return q ? `?${q}` : '';
}

/* ───────────────────── API ───────────────────── */

/** Список продаж с фильтрами и пагинацией */
export async function fetchSales(
  params: ListSalesParams = {},
): Promise<ListSalesResponse> {
  const qs = buildQuery(params);
  const url = `/sales${qs}`;
  return api.get<ListSalesResponse>(url);
}

/** Статистика по продажам */
export async function fetchSalesStats(
  params: ListSalesParams = {},
): Promise<SalesStats> {
  const qs = buildQuery(params);
  const url = `/sales/stats${qs}`;
  return api.get<SalesStats>(url);
}

export async function fetchSalesAnalytics(params: {
  from?: string;
  to?: string;
  dateField?: 'saleDate' | 'createdAt';
  channelIds?: string[];
  status?: SaleStatus;
  search?: string;
  currencyMode?: 'native' | 'converted';
  displayCurrency?: string;
  rates?: Record<string, number>;
  sampleLimit?: number;
}): Promise<SalesAnalyticsResponse> {
  const payload: Record<string, any> = {
    ...params,
    channelIds: params.channelIds?.join(','),
    rates: params.rates ? JSON.stringify(params.rates) : undefined,
  };
  const qs = buildQuery(payload);
  const url = `/sales/analytics${qs}`;
  return api.get<SalesAnalyticsResponse>(url);
}

export async function exportSalesAnalytics(params: {
  from?: string;
  to?: string;
  dateField?: 'saleDate' | 'createdAt';
  channelIds?: string[];
  status?: SaleStatus;
  search?: string;
  currencyMode?: 'native' | 'converted';
  displayCurrency?: string;
  rates?: Record<string, number>;
  format?: 'csv' | 'xls' | 'xlsx' | 'excel';
}): Promise<Blob> {
  const payload: Record<string, any> = {
    ...params,
    channelIds: params.channelIds?.join(','),
    rates: params.rates ? JSON.stringify(params.rates) : undefined,
  };
  const qs = buildQuery(payload);
  const url = `${API_BASE}/sales/analytics/export${qs}`;
  const token = getAccessToken();
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`);
  }
  return res.blob();
}

export async function fetchSalesAnalyticsPreset(): Promise<any | null> {
  return api.get<any | null>('/sales/analytics/preset');
}

export async function saveSalesAnalyticsPreset(payload: Record<string, any>) {
  return api.patch('/sales/analytics/preset', { payload });
}

/** Обновление продажи (статус, менеджер, заметки, лид) */
export async function updateSale(
  id: string,
  payload: UpdateSalePayload,
): Promise<Sale> {
  return api.patch<Sale>(`/sales/${id}`, payload);
}

/** Детали заказа (универсальный объект) */
export async function fetchSaleDetail(id: string): Promise<SaleDetail> {
  return api.get<SaleDetail>(`/sales/${id}`);
}
