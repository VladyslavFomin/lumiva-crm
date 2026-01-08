import { api } from './client';

export interface Site {
  id: string;
  domain: string;
  name?: string | null;
  status?: string;
}

export async function fetchSites(): Promise<Site[]> {
  return api.get<Site[]>('/sites');
}

export async function createSite(body: { domain: string; name?: string }): Promise<Site> {
  return api.post<Site>('/sites', body);
}

export async function deleteSite(id: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/sites/${id}`);
}
