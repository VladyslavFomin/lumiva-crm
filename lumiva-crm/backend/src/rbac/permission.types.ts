// src/rbac/permission.types.ts
import type { StaffRole } from '../staff/staff-user.entity';

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

export type RoleMatrix = Record<StaffRole, PermissionKey[]>;

/**
 * Per-user overrides on top of the role matrix. Key present + `true` = explicit grant
 * (overrides a role-level deny); key present + `false` = explicit deny (overrides a role-level
 * grant, even for a "new module" that otherwise fails open); key absent = inherit from role.
 * This is the real, backend-enforced shape — see RbacGuard/RbacService.canForUser — not just a
 * cosmetic list of extra-granted keys like the earlier version of this type.
 */
export type UserPermissionMatrix = Record<string, Partial<Record<PermissionKey, boolean>>>;

/**
 * Newly-added granular keys that didn't exist before this pass, for which "same access as the
 * base key" is the correct default because there was never a narrower pre-existing restriction
 * to preserve (sales CSV import, contacts bulk-update, company tasks were all previously gated
 * only by the base key, or not gated at all). Falls back to the base key's own resolved
 * allow/deny state when no explicit row exists for the granular key itself.
 *
 * Deliberately NOT used for 'leads_view_roi' (was owner/manager/finance-only via an inline check)
 * or 'projects_manage_trash' (was owner-only) — those have real prior restrictions narrower than
 * their base key, so they get explicit DEFAULT_ROLE_PERMISSIONS entries instead (see
 * rbac.service.ts) rather than inheriting the base key's broader default.
 *
 * Also NOT applied to the older Products/Bookings/Hotels granular keys, whose narrower-than-base
 * defaults (e.g. 'sales' role gets 'products' but not 'products_manage_fields') are an
 * intentional existing distinction, not a gap to backfill. 'hotels_manage_reservations' (added
 * later, front-desk role) follows the same explicit-per-role-grant convention as
 * 'hotels_manage_pricing' for the same reason.
 */
export const GRANULAR_FALLBACK_TO_BASE: Partial<Record<PermissionKey, PermissionKey>> = {
  sales_manage_import: 'sales',
  contacts_manage_bulk: 'contacts',
  companies_manage_tasks: 'companies',
  // Editing a lead/project's amount was never gated separately from editing the record at all —
  // inherits the base key's own resolution so nobody who could already edit amounts loses that
  // without the tenant explicitly restricting the new key.
  leads_edit_amount: 'leads',
  projects_edit_amount: 'projects',
  // projects_edit_owner deliberately has NO fallback entry — same precedent as
  // projects_manage_trash: reassigning a project's owner was previously owner-role-only
  // (hardcoded in ProjectsController), a real prior restriction narrower than base 'projects',
  // so it stays owner-only by default (role==='owner' always bypasses RBAC) until a tenant
  // explicitly grants this key to a role or person.
};
