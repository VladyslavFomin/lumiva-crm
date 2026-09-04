// src/api/client.ts
import {
  clearSession,
  getAccessToken,
  persistSessionExpired,
} from '../auth/session';

// БАЗОВЫЙ URL API:
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_CRM_API_URL ||
  '/v1';

/**
 * Публичные файлы из /v1/uploads/... — пересобираем URL относительно API_BASE,
 * чтобы не ломались ссылки на старый host:port из БД при смене домена.
 */
export function resolvePublicAssetUrl(url: string | null | undefined): string | null {
  if (!url || !String(url).trim()) return null;
  const u = String(url).trim();
  const marker = '/uploads/';
  const i = u.indexOf(marker);
  if (i === -1) return u;
  const rel = u
    .slice(i + marker.length)
    .split('?')[0]
    ?.replace(/^\/+/, '');
  if (!rel) return u;
  const base = API_BASE.replace(/\/$/, '');
  const path = `${base}/uploads/${rel.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
  return path.replace(/([^:]\/)\/+/g, '$1');
}

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: any;

  constructor(message: string, status: number, code?: string, payload?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

/**
 * A 403 from a widget's own fetch (a lead's WooCommerce orders, custom fields, etc.) — the
 * caller should show a friendly "ask the assignee" message instead of this raw ApiError's text
 * (NestJS's default is literally "Forbidden resource"), same spirit as the route-level fix in
 * MainLayout but for inline sections that keep loading independently after the page has mounted.
 */
export function isForbiddenError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403;
}

const TENANT_INACTIVE_KEY = 'lumiva_tenant_inactive';
const FORBIDDEN_KEY = 'lumiva_forbidden_notice';
type ApiRequestInit = RequestInit & { skipUnauthorizedRedirect?: boolean };

function handleUnauthorized() {
  clearSession();
  persistSessionExpired('unauthorized');
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

/**
 * Shown once on the dashboard after MainLayout redirects a user away from a route their own
 * permission matrix says they can't see (see routeAllowed in MainLayout.tsx). Deliberately NOT
 * triggered reactively off a 403 response here — an incidental background fetch (nav badge
 * counts, notification polling, etc.) 403ing must never redirect the user off a page they DO
 * have access to just because some unrelated widget on it lacks permission for its own data.
 */
export function persistForbiddenNotice(path: string) {
  try {
    sessionStorage.setItem(FORBIDDEN_KEY, JSON.stringify({ path, ts: Date.now() }));
  } catch {
    // ignore
  }
}

export function readForbiddenNotice(): { path: string; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(FORBIDDEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearForbiddenNotice() {
  try {
    sessionStorage.removeItem(FORBIDDEN_KEY);
  } catch {
    // ignore
  }
}

function persistTenantInactive(reason: any) {
  try {
    localStorage.setItem(
      TENANT_INACTIVE_KEY,
      JSON.stringify({
        ...reason,
        ts: Date.now(),
      }),
    );
  } catch {
    // ignore
  }
}

export function readTenantInactiveReason():
  | {
      reason?: string;
      message?: string;
      activeUntil?: string | null;
      ts?: number;
    }
  | null {
  try {
    const raw = localStorage.getItem(TENANT_INACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearTenantInactiveReason() {
  try {
    localStorage.removeItem(TENANT_INACTIVE_KEY);
  } catch {
    // ignore
  }
}

async function request<T>(path: string, options: ApiRequestInit = {}): Promise<T> {
  const { skipUnauthorizedRedirect, ...fetchOptions } = options;
  const token = getAccessToken();

  const isFormData =
    typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;

  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers || {}),
  };

  if (token) {
    (headers as any).Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    cache: 'no-store',
  });

  if (res.status === 401) {
    if (skipUnauthorizedRedirect) {
      throw new ApiError('Сессия недоступна или почтовый провайдер вернул 401', 401);
    }
    handleUnauthorized();
    return new Promise<T>(() => {});
  }

  // ✅ 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  // ✅ Пытаемся прочитать тело как текст (бывает пустое при 200)
  const text = await res.text();

  // ✅ Пустое тело — ок, если статус успешный
  if (!text) {
    if (!res.ok) {
      throw new ApiError(
        `API error: ${res.status} ${res.statusText}`,
        res.status,
      );
    }
    return undefined as T;
  }

  // ✅ Если есть тело — пытаемся JSON
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // тело не JSON — если успех, просто вернём как строку
    if (res.ok) return text as unknown as T;
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  if (!res.ok) {
    console.error('API error response:', data);
    const msg =
      data?.message ||
      data?.error ||
      `API error: ${res.status} ${res.statusText}`;

    if (data?.code === 'TENANT_INACTIVE') {
      persistTenantInactive({
        reason: data?.reason,
        message: data?.message || msg,
        activeUntil: data?.activeUntil,
        status: res.status,
      });
      clearSession();
      window.location.href = '/tenant-inactive';
      return new Promise<T>(() => {});
    }

    throw new ApiError(msg, res.status, data?.code, data);
  }

  return data as T;
}

// ---------- ЛОГИН ----------

export interface LoginRequest {
  clientKey: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  accessToken?: string;
  user: any;
  clientKey?: string;
  tenantId?: string;
  tenantPlan?: string;
  billingLocked?: boolean;
  tenantActiveUntil?: string | null;
  tenantName?: string | null;
  tenant?: { name?: string | null };
}

export interface TwoFactorRequiredResponse {
  twoFactorRequired: true;
  challengeToken: string;
}

export async function login(
  payload: LoginRequest,
): Promise<LoginResponse | TwoFactorRequiredResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Login error: ${res.status}`, res.status);
  }

  if (!res.ok) {
    console.error('Login error response:', data);
    const msg =
      data?.message ||
      data?.error ||
      `Login error: ${res.status} ${res.statusText}`;

    if (data?.code === 'TENANT_INACTIVE') {
      persistTenantInactive({
        reason: data?.reason,
        message: data?.message || msg,
        activeUntil: data?.activeUntil,
        status: res.status,
      });
      if (typeof window !== 'undefined') {
        window.location.href = '/tenant-inactive';
      }
    }

    throw new ApiError(msg, res.status, data?.code, data);
  }

  return data as LoginResponse | TwoFactorRequiredResponse;
}

/**
 * Резолвит clientKey по кастомному домену тенанта (см. GET /tenants/by-domain) — используется
 * страницей логина, когда её открыли не с crm.lumiva.agency, чтобы не показывать клиенту поле
 * с его собственным company slug. Возвращает null, если домен не настроен/не активен — это
 * штатный случай (например для самого crm.lumiva.agency), а не ошибка.
 */
export async function resolveClientKeyByDomain(host: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/tenants/by-domain?host=${encodeURIComponent(host)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.clientKey || null;
  } catch {
    return null;
  }
}

export async function verifyTwoFactorLogin(payload: {
  challengeToken: string;
  code: string;
}): Promise<LoginResponse & { usedBackupCode?: boolean }> {
  const res = await fetch(`${API_BASE}/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`2FA error: ${res.status}`, res.status);
  }
  if (!res.ok) {
    throw new ApiError(
      data?.message || `2FA error: ${res.status} ${res.statusText}`,
      res.status,
      data?.code,
      data,
    );
  }
  return data;
}

export interface SignupRequest {
  companyName: string;
  clientKey: string;
  email: string;
  password: string;
  phone?: string;
}

export interface SignupResponse {
  verificationRequired: boolean;
  clientKey: string;
  email: string;
  expiresAt?: string;
  message?: string;
}

export async function signup(payload: SignupRequest): Promise<SignupResponse> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      data?.message || `Signup error: ${res.status} ${res.statusText}`,
      res.status,
      data?.code,
      data,
    );
  }
  return data as SignupResponse;
}

export async function verifySignupCode(payload: {
  clientKey: string;
  email: string;
  code: string;
}): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/auth/verify-signup-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      data?.message || `Verify error: ${res.status} ${res.statusText}`,
      res.status,
      data?.code,
      data,
    );
  }
  return data as LoginResponse;
}

export async function resendSignupCode(payload: {
  clientKey: string;
  email: string;
}): Promise<{ ok: boolean; message?: string; expiresAt?: string }> {
  const res = await fetch(`${API_BASE}/auth/resend-signup-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      data?.message || `Resend error: ${res.status} ${res.statusText}`,
      res.status,
      data?.code,
      data,
    );
  }
  return data as { ok: boolean; message?: string; expiresAt?: string };
}

export async function requestPasswordReset(payload: {
  clientKey: string;
  email: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/request-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg: any;
    try {
      msg = await res.json();
    } catch {
      msg = null;
    }
    throw new Error(
      msg?.message || `Reset error: ${res.status} ${res.statusText}`,
    );
  }
}

export interface BillingCatalogPlan {
  code: 'standard' | 'professional' | 'enterprise' | 'ultimate';
  title: string;
  price: string;
  subtitle: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  i18n?: {
    en?: {
      subtitle?: string;
      description?: string;
      features?: string[];
    };
    tr?: {
      subtitle?: string;
      description?: string;
      features?: string[];
    };
  };
}

export async function fetchBillingCatalog(): Promise<BillingCatalogPlan[]> {
  return request('/billing/catalog', { method: 'GET' });
}

export async function createCheckoutSession(payload: {
  plan: 'standard' | 'professional' | 'enterprise' | 'ultimate';
  period?: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string | null; provider: 'stripe' | 'yookassa' | 'iyzico'; ref?: string }> {
  return request('/billing/checkout-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createAiAddonCheckoutSession(payload: {
  kind: 'ai_prepaid' | 'storage_pack' | 'telephony_addon';
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string | null }> {
  return request('/billing/checkout-ai-addon', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function confirmCheckoutSession(sessionId: string): Promise<{ ok: boolean }> {
  return request(`/billing/checkout-confirm?session_id=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
  });
}

export async function confirmProviderCheckout(params: {
  provider: 'yookassa';
  ref: string;
}): Promise<{ ok: boolean }> {
  return request(
    `/billing/checkout-confirm?provider=${encodeURIComponent(params.provider)}&ref=${encodeURIComponent(params.ref)}`,
    { method: 'GET' },
  );
}

export async function createPortalSession(payload: { returnUrl: string }): Promise<{ url: string }> {
  return request('/billing/portal-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchBillingPlanFeatures(): Promise<
  Record<'standard' | 'professional' | 'enterprise' | 'ultimate', string[]>
> {
  return request('/billing/plan-features', { method: 'GET' });
}

// ---------- ОБЩИЙ API-ВРАППЕР ----------

/** Собирает query-string из плоского объекта (массивы → повторяющиеся ключи). */
function appendQueryToPath(path: string, params?: object): string {
  if (!params) return path;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        sp.append(key, String(item));
      }
    } else {
      sp.set(key, String(value));
    }
  }
  const qs = sp.toString();
  if (!qs) return path;
  const joiner = path.includes('?') ? '&' : '?';
  return `${path}${joiner}${qs}`;
}

export type ApiGetParams = object;

export const api = {
  get: <T>(
    path: string,
    options?: { params?: ApiGetParams } & Pick<ApiRequestInit, 'skipUnauthorizedRedirect'>,
  ) => {
    const { params, skipUnauthorizedRedirect, ...rest } = options || {};
    return request<T>(appendQueryToPath(path, params), {
      ...rest,
      ...(skipUnauthorizedRedirect ? { skipUnauthorizedRedirect: true } : {}),
    });
  },

  post: <T>(
    path: string,
    body?: any,
    init?: ApiRequestInit & { timeout?: number },
  ) => {
    if (!init?.timeout) {
      return request<T>(path, {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
        ...init,
      });
    }
    const { timeout, ...rest } = init;
    const timeoutSignal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? (AbortSignal as typeof AbortSignal & { timeout(ms: number): AbortSignal }).timeout(
            timeout,
          )
        : undefined;
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...rest,
      signal: rest.signal ?? timeoutSignal,
    });
  },

  /** multipart/form-data (не задавать Content-Type вручную) */
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: 'POST',
      body: formData,
    }),

  patch: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  // было: del
  del: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE',
    }),

  // ✅ добавили нормальное имя (как ты уже используешь в коде)
  delete: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE',
    }),
};
