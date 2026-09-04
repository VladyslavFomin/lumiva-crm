// src/api/rbac.ts
import { api } from './client';
import type { StaffRole } from './staff'; // берём тот же union, что и в Staff API

export type PermissionKey =
  | 'leads'
  | 'leads_view_roi'
  | 'leads_edit_amount'
  | 'leads_create'
  | 'leads_manage_import'
  | 'projects'
  | 'projects_manage_trash'
  | 'projects_edit_amount'
  | 'projects_edit_owner'
  | 'projects_manage'
  | 'sales'
  | 'sales_manage_import'
  | 'client_accounts'
  | 'staff'
  | 'finance'
  | 'analytics'
  | 'settings'
  | 'chat'
  | 'contacts'
  | 'contacts_manage_bulk'
  | 'companies'
  | 'companies_manage_tasks'
  | 'helpdesk'
  | 'esign'
  | 'notes'
  | 'telegram'
  | 'whatsapp'
  | 'telephony'
  | 'tools_automation'
  | 'custom_objects'
  | 'email'
  | 'marketing'
  | 'products'
  | 'products_manage_fields'
  | 'products_manage_stock'
  | 'products_publish'
  | 'bookings'
  | 'bookings_manage_settings'
  | 'hotels'
  | 'hotels_manage_pricing'
  | 'hotels_manage_reservations';

export type RolePermissionMatrix = Record<StaffRole, PermissionKey[]>;

/**
 * Per-user overrides on top of the role matrix. Key present + `true` = explicit grant (wins over
 * a role-level deny); key present + `false` = explicit deny (wins over a role-level grant,
 * including the "new module, fail open" default); key absent = inherit from role. Real,
 * backend-enforced shape — see RbacGuard.canForUser on the backend.
 */
export type UserPermissionMatrix = Record<string, Partial<Record<PermissionKey, boolean>>>;

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
