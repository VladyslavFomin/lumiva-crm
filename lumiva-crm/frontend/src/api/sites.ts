import { api } from './client';

export interface Site {
  id: string;
  domain: string;
  name?: string | null;
  status?: string;
  apiToken?: string;
  enabledModules?: Record<string, boolean> | null;
}

export type WordpressModuleSiteRow = {
  key: string;
  tenantEnabled: boolean;
  siteOverride: boolean | null;
  effective: boolean;
  allowedByPlan: boolean;
};

export async function fetchSites(): Promise<Site[]> {
  return api.get<Site[]>('/sites');
}

export async function createSite(body: { domain: string; name?: string }): Promise<Site> {
  return api.post<Site>('/sites', body);
}

export async function fetchWordpressModuleState(
  siteId: string,
): Promise<WordpressModuleSiteRow[]> {
  return api.get<WordpressModuleSiteRow[]>(`/sites/${siteId}/wordpress-modules`);
}

export async function updateSite(
  id: string,
  body: { name?: string; enabledModules?: Record<string, boolean | null> },
): Promise<Site> {
  return api.patch<Site>(`/sites/${id}`, body);
}

export async function deleteSite(id: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/sites/${id}`);
}
