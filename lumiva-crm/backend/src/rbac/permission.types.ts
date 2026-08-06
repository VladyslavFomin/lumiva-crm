// src/rbac/permission.types.ts
import type { StaffRole } from '../staff/staff-user.entity';

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

export type UserPermissionMatrix = Record<string, PermissionKey[]>;
