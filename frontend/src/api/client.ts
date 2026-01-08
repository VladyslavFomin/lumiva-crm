// src/api/client.ts
import { clearSession, getAccessToken } from '../auth/session';

// БАЗОВЫЙ URL API:
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_CRM_API_URL ||
  '/v1';

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

const TENANT_INACTIVE_KEY = 'lumiva_tenant_inactive';

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as any).Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

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
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
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
    }

    throw new ApiError(msg, res.status, data?.code, data);
  }

  return data as LoginResponse;
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

// ---------- ОБЩИЙ API-ВРАППЕР ----------

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
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
