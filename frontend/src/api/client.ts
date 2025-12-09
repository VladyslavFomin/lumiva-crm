// src/api/client.ts
import { getAccessToken } from '../auth/session';

// БАЗОВЫЙ URL API:
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_CRM_API_URL ||
  '/v1';

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

  if (res.status === 204) {
    // нет тела ответа
    // (например, DELETE / PATCH без контента)
    return undefined as T;
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    console.error('API: cannot parse JSON', res.status, res.statusText);
    throw new Error(`API error: ${res.status}`);
  }

  if (!res.ok) {
    console.error('API error response:', data);
    const msg =
      data?.message ||
      data?.error ||
      `API error: ${res.status} ${res.statusText}`;
    throw new Error(msg);
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
    throw new Error(`Login error: ${res.status}`);
  }

  if (!res.ok) {
    console.error('Login error response:', data);
    const msg =
      data?.message ||
      data?.error ||
      `Login error: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data as LoginResponse;
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
  del: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE',
    }),
};