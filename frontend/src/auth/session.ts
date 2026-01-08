// src/auth/session.ts

const STORAGE_KEY = 'lumiva_crm_session';

export interface StoredSession {
  token: string | null;
  user: any | null;
  clientKey?: string;
  tenantId?: string;
}

export function persistSession(resp: {
  token?: string;
  accessToken?: string;
  user: any;
  clientKey?: string;
  tenantId?: string;
}) {
  const token = resp.token || resp.accessToken || null;

  const session: StoredSession = {
    token,
    user: resp.user ?? null,
    clientKey: resp.clientKey,
    tenantId: resp.tenantId,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Cannot persist session:', e);
  }
}

export function getSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  const s = getSession() as any;
  return s?.token ?? s?.accessToken ?? null;
}

export function getStoredUser(): any | null {
  const s = getSession();
  return s?.user ?? null;
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Cannot clear session:', e);
  }
}
