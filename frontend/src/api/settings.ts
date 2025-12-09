// src/api/settings.ts
import { api } from './client';

export interface CompanySettings {
  id: string;
  clientKey: string;
  name: string;
  logoUrl: string | null;
  uiLanguage: string | null;
  status: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Получить настройки текущего tenant
 */
export async function fetchCompanySettings(): Promise<CompanySettings> {
  return api.get<CompanySettings>('/tenants/settings');
}

/**
 * Обновить настройки компании
 */
export async function updateCompanySettings(payload: {
  name?: string;
  logoUrl?: string | null;
  uiLanguage?: string | null;
}): Promise<CompanySettings> {
  return api.patch<CompanySettings>('/tenants/settings', payload);
}