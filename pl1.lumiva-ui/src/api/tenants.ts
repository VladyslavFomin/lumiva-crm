// src/api/tenants.ts
import { apiClient, getApiErrorMessage } from "./client";

/** Статус тенанта в платформе */
export type TenantStatus = "active" | "blocked";

/** Тарифный план */
export type TenantPlan =
  | "free_locked"
  | "standard"
  | "professional"
  | "enterprise"
  | "ultimate";

/** Объект тенанта из платформенного API */
export interface TenantSummary {
  id: string;
  name: string;
  title?: string | null;
  clientKey: string;
  status: TenantStatus;
  plan: TenantPlan | null;
  apiEnabled: boolean;
  notes?: string | null;

  activeUntil: string | null;

  ownerName: string | null;
  ownerEmail: string | null;

  createdAt: string;
  updatedAt: string;
}

/** DTO для создания тенанта */
export interface CreateTenantDto {
  name: string;
  clientKey: string;
  plan?: TenantPlan | null;
  ownerEmail?: string | null;
  ownerFullName?: string | null;
  notes?: string | null;
}

export interface TenantDetail extends TenantSummary {
  notes?: string | null;
  logoUrl?: string | null;
}

export interface PlatformSite {
  id: string;
  tenantId: string;
  tenantClientKey?: string | null;
  tenantName?: string | null;
  domain: string;
  name: string;
  status: string;
  apiTokenMasked: string;
  sitesPerTenant?: number;
  createdAt: string;
  updatedAt: string;
  integrations?: Array<{
    id: string;
    name: string;
    kind: string;
    lastSyncStatus?: string;
    lastSyncAt?: string | null;
    isEnabled?: boolean;
    description?: string | null;
  }>;
}

export interface DemoRequest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  ordersPerMonth?: string | null;
  contactMethod: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantLog {
  id: string;
  tenantId: string;
  type: string;
  statusCode?: number | null;
  method?: string | null;
  path?: string | null;
  message?: string | null;
  meta?: Record<string, any> | null;
  createdAt: string;
}

/** DTO для обновления тенанта (частичное обновление) */
export interface UpdateTenantDto {
  name?: string;
  clientKey?: string;
  status?: TenantStatus;
  plan?: TenantPlan | null;
  apiEnabled?: boolean;
  activeUntil?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  notes?: string | null;
}

/* ───── Базовые запросы ───── */

export async function fetchTenants(): Promise<TenantSummary[]> {
  try {
    const res = await apiClient.get<TenantSummary[]>("/platform/tenants");
    return res.data;
  } catch (err) {
    throw err;
  }
}

export async function createTenant(
  dto: CreateTenantDto,
): Promise<TenantSummary> {
  try {
    const res = await apiClient.post<TenantSummary>("/platform/tenants", dto);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

/**
 * Универсальный апдейт.
 * ВАЖНО: здесь путь БЕЗ `/status` или `/api` — просто `/tenants/:id`
 * Именно этот эндпоинт есть на бекенде Nest.
 */
export async function updateTenant(
  id: string,
  dto: UpdateTenantDto,
): Promise<TenantSummary> {
  try {
    const res = await apiClient.patch<TenantSummary>(`/platform/tenants/${id}`, dto);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

/** Удаление тенанта (каскад на бэкенде). Только с Bearer токена панели. */
export async function deleteTenant(id: string): Promise<void> {
  try {
    await apiClient.delete(`/platform/tenants/${id}`);
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

/* ───── Удобные обёртки для UI ───── */

export function enableTenant(id: string) {
  return updateTenant(id, { status: "active" });
}

export function disableTenant(id: string) {
  return updateTenant(id, { status: "blocked" });
}

export function setTenantApi(id: string, enabled: boolean) {
  return updateTenant(id, { apiEnabled: enabled });
}

export async function fetchTenant(id: string): Promise<TenantDetail> {
  try {
    const res = await apiClient.get<TenantDetail>(`/platform/tenants/${id}`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchTenantLogs(id: string): Promise<TenantLog[]> {
  try {
    const res = await apiClient.get<TenantLog[]>(`/platform/tenants/${id}/logs`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function requestPasswordResetLink(
  id: string,
): Promise<{ link: string; expiresAt: string; email: string }> {
  try {
    const res = await apiClient.post<{
      link: string;
      expiresAt: string;
      email: string;
    }>(`/platform/tenants/${id}/password-reset`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchAllLogs(params?: {
  tenantId?: string;
  limit?: number;
}): Promise<TenantLog[]> {
  const query = new URLSearchParams();
  if (params?.tenantId) query.set("tenantId", params.tenantId);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  try {
    const res = await apiClient.get<TenantLog[]>(
      `/platform/tenants/logs${suffix}`,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function sendPasswordResetEmail(
  id: string,
  to?: string,
): Promise<{ ok: boolean; sentTo: string }> {
  try {
    const res = await apiClient.post<{ ok: boolean; sentTo: string }>(
      `/platform/tenants/${id}/password-reset/send`,
      to ? { to } : undefined,
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function pruneResetTokens(): Promise<{ ok: boolean }> {
  try {
    const res = await apiClient.post<{ ok: boolean }>(`/platform/tenants/password-reset/prune`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchPlatformSites(): Promise<PlatformSite[]> {
  try {
    const res = await apiClient.get<PlatformSite[]>(`/platform/tenants/sites`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function fetchDemoRequests(): Promise<DemoRequest[]> {
  try {
    const res = await apiClient.get<DemoRequest[]>(`/platform/demo-requests`);
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

export async function updateDemoRequestStatus(
  id: string,
  status: string,
): Promise<DemoRequest> {
  try {
    const res = await apiClient.patch<DemoRequest>(
      `/platform/demo-requests/${id}/status`,
      { status },
    );
    return res.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}
