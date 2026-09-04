// src/api/account.ts — «Аккаунт»: сессии, 2FA, журнал безопасности, предпочтения, опасная зона
import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

export interface AccountSession {
  id: string;
  os: string;
  browser: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export async function fetchMySessions(): Promise<AccountSession[]> {
  return api.get('/users/me/sessions');
}

export async function revokeMySession(id: string): Promise<{ ok: boolean }> {
  return api.delete(`/users/me/sessions/${id}`);
}

export async function revokeOtherSessions(): Promise<{ ok: boolean; count: number }> {
  return api.post('/users/me/sessions/revoke-others', {});
}

export interface SecurityLogItem {
  id: string;
  summary: string | null;
  createdAt: string;
}

export async function fetchSecurityLog(): Promise<{ items: SecurityLogItem[]; total: number }> {
  return api.get('/users/me/security-log');
}

export interface ApiTokenSummary {
  id: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export async function fetchApiTokensSummary(): Promise<ApiTokenSummary[]> {
  return api.get('/users/me/api-tokens-summary');
}

export interface AccountPreferences {
  theme?: string;
  density?: string;
  dateFormat?: string;
  weekStart?: string;
  startPage?: string;
  workHours?: { start: string; end: string };
  notifications?: Record<string, boolean>;
  timezone?: string | null;
}

export async function updatePreferences(
  patch: AccountPreferences,
): Promise<{ preferences: AccountPreferences; timezone: string | null }> {
  return api.patch('/users/me/preferences', patch);
}

// ---------- 2FA ----------

export async function setup2FA(): Promise<{ secret: string; otpAuthUrl: string; qrDataUrl: string }> {
  return api.post('/users/me/2fa/setup', {});
}

export async function verify2FA(code: string): Promise<{ enabled: boolean; backupCodes: string[] }> {
  return api.post('/users/me/2fa/verify', { code });
}

export async function disable2FA(password: string): Promise<{ enabled: boolean }> {
  return api.post('/users/me/2fa/disable', { password });
}

export async function regenerateBackupCodes(password: string): Promise<{ backupCodes: string[] }> {
  return api.post('/users/me/2fa/backup-codes/regenerate', { password });
}

// ---------- опасная зона ----------

export async function transferOwnership(
  targetStaffUserId: string,
  password: string,
): Promise<{ ok: boolean; newOwnerId: string }> {
  return api.post('/users/me/transfer-ownership', { targetStaffUserId, password });
}

export async function deleteMyAccount(password: string): Promise<{ ok: boolean }> {
  return api.post('/users/me/delete-account', { password });
}

/** Скачивание файла требует ручного fetch с заголовком авторизации — общий api-враппер
 * парсит ответ как JSON и не годится для application/json-как-вложения. */
export async function exportMyData(): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/users/me/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lumiva-account-data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
