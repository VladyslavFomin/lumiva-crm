// src/api/modules.ts
import { apiClient } from "./client";

export interface TenantModule {
  key: string;
  enabled: boolean;
  allowedByPlan?: boolean;
  plan?: string;
}

export async function fetchTenantModules(
  tenantId: string,
): Promise<TenantModule[]> {
  try {
    const res = await apiClient.get<TenantModule[]>(
      `/platform/tenants/${tenantId}/modules`,
    );
    return res.data;
  } catch (err) {
    throw err;
  }
}

export async function toggleTenantModule(
  tenantId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<TenantModule> {
  try {
    const res = await apiClient.patch<TenantModule>(
      `/platform/tenants/${tenantId}/modules/${moduleKey}`,
      { enabled },
    );
    return res.data;
  } catch (err) {
    throw err;
  }
}

