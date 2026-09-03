// src/api/settings.ts
import { api } from './client';

/**
 * Как backend toRelativeUploadsUrl: полный URL с /uploads/... → /v1/uploads/...
 * (без хоста, чтобы не было 404 на чужом домене).
 */
export function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (url == null || !String(url).trim()) return null;
  const s = String(url).trim();
  if (s.startsWith('/v1/uploads/')) return s.split('?')[0] || null;
  const marker = '/uploads/';
  const i = s.indexOf(marker);
  if (i === -1) return null;
  const rel = s
    .slice(i + marker.length)
    .replace(/^\/+/, '')
    .split('?')[0];
  return rel ? `/v1/uploads/${rel}` : null;
}

export interface CompanySettings {
  id: string;
  clientKey: string;
  name: string;
  logoUrl: string | null;
  uiLanguage: string | null;
  status: string;
  plan: string;
  apiEnabled?: boolean;
  activeUntil: string | null;
  trialEndsAt?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  /** байты */
  storageUsedBytes?: number;
  storageExtraBytes?: number;
  /** null = без лимита (тариф ultimate / по договорённости) */
  storageQuotaBytes?: number | null;
  /** Удаление файлов общего хранилища: владелец или ИТ-отдел */
  canDeleteTenantStorage?: boolean;
  /** Шаблон обёртки для AI/транзакционных писем ({{contentHtml}}, …); null = встроенный дизайн */
  aiWrapperEmailTemplateId?: string | null;
}

/**
 * Получить настройки текущего tenant
 */
export async function fetchCompanySettings(options?: {
  skipUnauthorizedRedirect?: boolean;
}): Promise<CompanySettings> {
  return api.get<CompanySettings>('/tenants/settings', options);
}

/**
 * Обновить настройки компании
 */
export async function updateCompanySettings(payload: {
  name?: string;
  logoUrl?: string | null;
  uiLanguage?: string | null;
  aiWrapperEmailTemplateId?: string | null;
}): Promise<CompanySettings> {
  return api.patch<CompanySettings>('/tenants/settings', payload);
}

/**
 * Загрузить логотип (multipart, поле file). Только owner.
 */
export async function uploadCompanyLogo(file: File): Promise<CompanySettings> {
  const fd = new FormData();
  fd.append('file', file);
  return api.postForm<CompanySettings>('/tenants/settings/logo', fd);
}

export const TENANT_BRANDING_EVENT = 'lumiva-tenant-branding';

export function notifyTenantBrandingUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TENANT_BRANDING_EVENT));
  }
}
