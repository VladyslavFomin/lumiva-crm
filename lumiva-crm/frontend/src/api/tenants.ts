// src/api/tenants.ts
import { api } from './client';

export interface TenantComponent {
  key: string;
  enabled: boolean;
}

export async function fetchTenantComponents(): Promise<TenantComponent[]> {
  return api.get<TenantComponent[]>('/tenants/components');
}













