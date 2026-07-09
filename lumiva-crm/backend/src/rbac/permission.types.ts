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
  | 'products';

export type RoleMatrix = Record<StaffRole, PermissionKey[]>;

export type UserPermissionMatrix = Record<string, PermissionKey[]>;
