import { api } from './client';

export interface CompanySettings {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  logo: string | null;
  timezone: string | null;
  currency: string | null;
  language: string | null;
}

export interface ApiToken {
  id: string;
  name: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
}

export async function fetchCompanySettings(): Promise<CompanySettings> {
  const res = await api.get<CompanySettings>('/settings/company');
  return res.data;
}

export async function updateCompanySettings(payload: Partial<CompanySettings>): Promise<CompanySettings> {
  const res = await api.patch<CompanySettings>('/settings/company', payload);
  return res.data;
}

export async function fetchApiTokens(): Promise<ApiToken[]> {
  const res = await api.get<ApiToken[]>('/settings/api-tokens');
  return res.data;
}

export async function createApiToken(name: string): Promise<ApiToken> {
  const res = await api.post<ApiToken>('/settings/api-tokens', { name });
  return res.data;
}

export async function deleteApiToken(id: string): Promise<void> {
  await api.delete(`/settings/api-tokens/${id}`);
}




