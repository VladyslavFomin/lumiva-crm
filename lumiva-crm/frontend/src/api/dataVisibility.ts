// src/api/dataVisibility.ts
import { api } from './client';
import type { StaffRole } from './staff';

export type DataVisibilityRuleKey = 'foreign_records' | 'amounts_visibility' | 'contact_masking' | 'ip_mode';

export type DataVisibilityMatrix = Record<StaffRole, Record<DataVisibilityRuleKey, string>>;

export interface IpAllowlistEntry {
  id: string;
  tenantId: string;
  cidr: string;
  label: string | null;
  createdAt: string;
}

export interface DataVisibilitySimulation {
  privileged: boolean;
  foreignRecords: string;
  amountsVisibility: string;
  contactMasking: string;
  contacts: { visible: number; total: number };
  companies: { visible: number; total: number };
  sales: { visible: number; total: number };
}

export function fetchDataVisibilityRules(): Promise<DataVisibilityMatrix> {
  return api.get<DataVisibilityMatrix>('/data-visibility/rules');
}

export function saveDataVisibilityRules(matrix: DataVisibilityMatrix): Promise<DataVisibilityMatrix> {
  return api.post<DataVisibilityMatrix>('/data-visibility/rules', matrix);
}

export function fetchIpAllowlist(): Promise<IpAllowlistEntry[]> {
  return api.get<IpAllowlistEntry[]>('/data-visibility/ip-allowlist');
}

export function addIpAllowlistEntry(cidr: string, label?: string): Promise<IpAllowlistEntry> {
  return api.post<IpAllowlistEntry>('/data-visibility/ip-allowlist', { cidr, label });
}

export function removeIpAllowlistEntry(id: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/data-visibility/ip-allowlist/${id}`);
}

export function simulateDataVisibility(staffUserId: string): Promise<DataVisibilitySimulation> {
  return api.get<DataVisibilitySimulation>(`/data-visibility/simulate/${staffUserId}`);
}
