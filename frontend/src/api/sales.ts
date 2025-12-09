// src/api/sales.ts
import { api } from './client';

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

/* ─────────────────────────────
 * Payload для обновления продажи
 * ───────────────────────────── */

export interface UpdateSalePayload {
  status?: SaleStatus;
  managerName?: string | null;
  notes?: string | null;
  leadId?: string | null;
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