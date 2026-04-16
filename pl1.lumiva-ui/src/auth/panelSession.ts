// src/auth/panelSession.ts
const STORAGE_KEY = "pl1_admin_authed";
const TOKEN_KEY = "pl1_admin_token";

function isLikelyJwt(token: string | null): boolean {
  if (!token) return false;
  if (token.startsWith("platform_")) return false;
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export function isPanelAuthed(): boolean {
  if (localStorage.getItem(STORAGE_KEY) !== "1") {
    return false;
  }
  const token = localStorage.getItem(TOKEN_KEY);
  if (!isLikelyJwt(token)) {
    clearPanelSession();
    return false;
  }
  return true;
}

export function setPanelAuthed(token: string): void {
  localStorage.setItem(STORAGE_KEY, "1");
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearPanelSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getPanelToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  return isLikelyJwt(token) ? token : null;
}
