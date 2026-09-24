import { api } from './client';
import Constants from 'expo-constants';

const host = Constants.expoConfig?.extra?.apiHost || 'https://crm.lumiva.agency';

export interface TenantSettings {
  id: string;
  name: string;
  clientKey: string;
  logoUrl: string | null;
  plan: string;
  status: string;
  ownerName: string | null;
  ownerEmail: string | null;
  uiLanguage: string | null;
  primaryCurrency: string;
  apiEnabled: boolean;
  activeUntil: string | null;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  storageExtraBytes: number;
}

export function resolveLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http')) return logoUrl;
  return `${host}/uploads/${logoUrl.replace(/^\/?(uploads\/)?/, '')}`;
}

export function tenantInitials(name: string | null | undefined): string {
  if (!name) return 'T';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function planLabel(plan: string | null | undefined): string {
  if (!plan) return 'FREE';
  return plan.toUpperCase();
}

export async function fetchTenantSettings(): Promise<TenantSettings> {
  const res = await api.get<TenantSettings>('/tenants/settings');
  return res.data;
}

export async function updateTenantSettings(payload: Partial<TenantSettings>): Promise<TenantSettings> {
  const res = await api.patch<TenantSettings>('/tenants/settings', payload);
  return res.data;
}

/** Which product modules the tenant's plan/platform admin has switched on (`GET /tenants/components`). */
export interface TenantComponent {
  key: string;
  enabled: boolean;
}

export async function fetchTenantComponents(): Promise<TenantComponent[]> {
  const res = await api.get<TenantComponent[]>('/tenants/components');
  return res.data;
}
