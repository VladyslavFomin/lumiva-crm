import { api } from './client';
import type { StaffRole } from './staff';

// Same keys as the website's `api/rbac.ts` / backend RbacGuard — used only to decide which sections to show.
export type PermissionKey =
  | 'leads' | 'leads_view_roi' | 'leads_edit_amount' | 'leads_create' | 'leads_manage_import'
  | 'projects' | 'projects_manage_trash' | 'projects_edit_amount' | 'projects_edit_owner' | 'projects_manage'
  | 'sales' | 'sales_manage_import' | 'client_accounts' | 'staff' | 'finance' | 'analytics' | 'settings' | 'chat'
  | 'contacts' | 'contacts_manage_bulk' | 'companies' | 'companies_manage_tasks' | 'helpdesk' | 'esign' | 'notes'
  | 'telegram' | 'whatsapp' | 'telephony' | 'tools_automation' | 'custom_objects' | 'email' | 'marketing'
  | 'products' | 'products_manage_fields' | 'products_manage_stock' | 'products_publish'
  | 'bookings' | 'bookings_manage_settings' | 'hotels' | 'hotels_manage_pricing' | 'hotels_manage_reservations';

export type RolePermissionMatrix = Record<StaffRole, PermissionKey[]>;
/** Per-staff overrides on top of the role matrix: `true` = explicit grant, `false` = explicit deny, absent = inherit. */
export type UserPermissionMatrix = Record<string, Partial<Record<PermissionKey, boolean>>>;

export async function fetchStaffPermissions(): Promise<RolePermissionMatrix> {
  const res = await api.get<RolePermissionMatrix>('/rbac/staff-permissions');
  return res.data;
}

export async function fetchUserPermissions(): Promise<UserPermissionMatrix> {
  const res = await api.get<UserPermissionMatrix>('/rbac/user-permissions');
  return res.data;
}
