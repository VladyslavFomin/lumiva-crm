// src/auth/session.ts

const STORAGE_KEY = 'lumiva_crm_session';
const SESSION_EXPIRED_KEY = 'lumiva_session_expired';

/** Fired after `updateStoredUser` so shell UI (header avatar, etc.) can re-read session. */
export const SESSION_USER_UPDATED_EVENT = 'lumiva-session-user-updated';

export interface StoredSession {
  token: string | null;
  user: any | null;
  clientKey?: string;
  tenantId?: string;
  /** Название компании (из tenant.name при регистрации / логине) */
  tenantName?: string | null;
  tenantPlan?: string | null;
  billingLocked?: boolean;
  tenantActiveUntil?: string | null;
}

type SessionExpiredState = {
  reason?: string;
  ts: number;
};

function decodeBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    return atob(padded);
  } catch {
    return null;
  }
}

function readJwtPayload(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) return null;
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = readJwtPayload(token);
  if (!payload?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  const leewaySeconds = 10;
  return payload.exp <= now + leewaySeconds;
}

export function persistSessionExpired(reason?: string) {
  try {
    const payload: SessionExpiredState = {
      reason,
      ts: Date.now(),
    };
    localStorage.setItem(SESSION_EXPIRED_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Cannot persist session expiry:', e);
  }
}

export function readSessionExpired(): SessionExpiredState | null {
  try {
    const raw = localStorage.getItem(SESSION_EXPIRED_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSessionExpired() {
  try {
    localStorage.removeItem(SESSION_EXPIRED_KEY);
  } catch (e) {
    console.error('Cannot clear session expiry:', e);
  }
}

export function persistSession(resp: {
  token?: string;
  accessToken?: string;
  user: any;
  clientKey?: string;
  tenantId?: string;
  tenant?: { name?: string | null };
  tenantPlan?: string;
  billingLocked?: boolean;
  tenantActiveUntil?: string | null;
}) {
  const token = resp.token || resp.accessToken || null;
  const tenantName =
    (resp as any).tenantName ??
    (typeof (resp as any).tenant?.name === 'string' ? (resp as any).tenant.name : null);

  const session: StoredSession = {
    token,
    user: resp.user ?? null,
    clientKey: resp.clientKey,
    tenantId: resp.tenantId,
    tenantName: tenantName ?? null,
    tenantPlan: resp.tenantPlan ?? null,
    tenantActiveUntil: resp.tenantActiveUntil ?? null,
    billingLocked:
      typeof resp.billingLocked === 'boolean'
        ? resp.billingLocked
        : resp.tenantPlan === 'free_locked',
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    clearSessionExpired();
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
  const token = s?.token ?? s?.accessToken ?? null;
  if (!token) return null;
  if (isTokenExpired(token)) {
    persistSessionExpired('token_expired');
    clearSession();
    return null;
  }
  return token;
}

export function getStoredUser(): any | null {
  const s = getSession();
  return s?.user ?? null;
}

/** Название компании для шапки сайдбара */
export function getStoredTenantName(): string | null {
  const s = getSession();
  const n = s?.tenantName;
  return typeof n === 'string' && n.trim() ? n.trim() : null;
}

/** Синхронизировать название в localStorage с актуальным именем тенанта (настройки компании). */
export function updateStoredTenantName(name: string | null | undefined) {
  const s = getSession();
  if (!s) return;
  const trimmed = typeof name === 'string' ? name.trim() : '';
  try {
    const next: StoredSession = {
      ...s,
      tenantName: trimmed ? trimmed : s.tenantName ?? null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Cannot update tenant name in session', e);
  }
}

/** Обновить поля пользователя в сессии (например после сохранения профиля). */
export function updateStoredUser(partial: Record<string, unknown>) {
  const s = getSession();
  if (!s?.user || typeof s.user !== 'object') return;
  try {
    const next: StoredSession = {
      ...s,
      user: { ...s.user, ...partial },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event(SESSION_USER_UPDATED_EVENT));
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    console.error('Cannot update user in session', e);
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Cannot clear session:', e);
  }
}

export function isBillingLocked(): boolean {
  const s = getSession() as any;
  if (!s) return false;
  const activeUntil = s.tenantActiveUntil ? new Date(s.tenantActiveUntil).getTime() : null;
  if (activeUntil && Number.isFinite(activeUntil) && activeUntil <= Date.now()) return true;
  if (typeof s.billingLocked === 'boolean') return s.billingLocked;
  return s.tenantPlan === 'free_locked';
}

export function markBillingUnlocked(nextPlan?: string) {
  const s = getSession() as any;
  if (!s) return;
  persistSession({
    token: s.token || s.accessToken || null,
    user: s.user,
    clientKey: s.clientKey,
    tenantId: s.tenantId,
    tenant: s.tenantName ? { name: s.tenantName } : undefined,
    tenantPlan: nextPlan || s.tenantPlan || 'standard',
    billingLocked: false,
    tenantActiveUntil: s.tenantActiveUntil || null,
  });
}
