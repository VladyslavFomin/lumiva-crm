// src/api/components.ts
import { apiClient } from "./client";

export interface TenantComponent {
  key: string;
  enabled: boolean;
}

export async function fetchTenantComponents(
  tenantId: string,
): Promise<TenantComponent[]> {
  const res = await apiClient.get<TenantComponent[]>(
    `/platform/tenants/${tenantId}/components`,
  );
  return res.data;
}

export async function toggleTenantComponent(
  tenantId: string,
  componentKey: string,
  enabled: boolean,
): Promise<TenantComponent> {
  const res = await apiClient.patch<TenantComponent>(
    `/platform/tenants/${tenantId}/components/${componentKey}`,
    { enabled },
  );
  return res.data;
}
