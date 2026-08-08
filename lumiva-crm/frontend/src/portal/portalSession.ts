// src/portal/portalSession.ts
const KEY = 'lumiva_portal_session';

export interface PortalSession {
  token: string;
  clientKey: string;
}

export function getPortalSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.clientKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setPortalSession(token: string, clientKey: string) {
  localStorage.setItem(KEY, JSON.stringify({ token, clientKey }));
}

export function clearPortalSession() {
  localStorage.removeItem(KEY);
}
