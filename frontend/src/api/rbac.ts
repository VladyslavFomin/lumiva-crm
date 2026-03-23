// src/api/rbac.ts
import { api } from './client';
import type { StaffRole } from './staff'; // берём тот же union, что и в Staff API

export type PermissionKey =
  | 'leads'
  | 'projects'
  | 'staff'
  | 'finance'
  | 'analytics'
  | 'settings'
  | 'chat'
  | 'contacts'
  | 'companies'
  | 'tools_automation'
  | 'custom_objects';

export type RolePermissionMatrix = Record<StaffRole, PermissionKey[]>;
export type UserPermissionMatrix = Record<string, PermissionKey[]>;

// ---------- GET ----------
export async function fetchStaffPermissions(): Promise<RolePermissionMatrix> {
  return api.get<RolePermissionMatrix>('/rbac/staff-permissions');
}

// ---------- SAVE ----------
export async function saveStaffPermissions(
  matrix: RolePermissionMatrix,
): Promise<RolePermissionMatrix> {
  // backend ждёт тело прямо в виде матрицы
  return api.post<RolePermissionMatrix>('/rbac/staff-permissions', matrix);
}

// ---------- USER-LEVEL (per user) ----------
export async function fetchUserPermissions(): Promise<UserPermissionMatrix> {
  return api.get<UserPermissionMatrix>('/rbac/user-permissions');
}

export async function saveUserPermissions(
  matrix: UserPermissionMatrix,
): Promise<UserPermissionMatrix> {
  return api.post<UserPermissionMatrix>('/rbac/user-permissions', matrix);
}
