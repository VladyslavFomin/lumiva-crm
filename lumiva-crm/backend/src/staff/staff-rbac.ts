// src/staff/staff-rbac.ts
import { StaffRole } from './staff-user.entity';

export type CrmModuleId =
  | 'dashboard'
  | 'leads'
  | 'projects'
  | 'finance'
  | 'marketing'
  | 'chat'
  | 'staff'
  | 'settings';

export interface ModulePermission {
  read: boolean;
  write: boolean;
}

export type RolePermissions = Record<CrmModuleId, ModulePermission>;

export const ROLE_PERMISSIONS: Record<StaffRole, RolePermissions> = {
  owner: {
    dashboard: { read: true, write: true },
    leads: { read: true, write: true },
    projects: { read: true, write: true },
    finance: { read: true, write: true },
    marketing: { read: true, write: true },
    chat: { read: true, write: true },
    staff: { read: true, write: true },
    settings: { read: true, write: true },
  },
  manager: {
    dashboard: { read: true, write: true },
    leads: { read: true, write: true },
    projects: { read: true, write: true },
    finance: { read: false, write: false },
    marketing: { read: true, write: true },
    chat: { read: true, write: true },
    staff: { read: true, write: false },
    settings: { read: false, write: false },
  },
  viewer: {
    dashboard: { read: true, write: false },
    leads: { read: true, write: false },
    projects: { read: true, write: false },
    finance: { read: false, write: false },
    marketing: { read: true, write: false },
    chat: { read: true, write: false },
    staff: { read: false, write: false },
    settings: { read: false, write: false },
  },
  finance: {
    dashboard: { read: true, write: false },
    leads: { read: true, write: false },
    projects: { read: true, write: false },
    finance: { read: true, write: true },
    marketing: { read: false, write: false },
    chat: { read: true, write: false },
    staff: { read: false, write: false },
    settings: { read: false, write: false },
  },
  sales: {
    dashboard: { read: true, write: true },
    leads: { read: true, write: true },
    projects: { read: true, write: true },
    finance: { read: false, write: false },
    marketing: { read: true, write: true },
    chat: { read: true, write: true },
    staff: { read: false, write: false },
    settings: { read: false, write: false },
  },
  developer: {
    dashboard: { read: true, write: false },
    leads: { read: false, write: false },
    projects: { read: true, write: true },
    finance: { read: false, write: false },
    marketing: { read: false, write: false },
    chat: { read: true, write: true },
    staff: { read: false, write: false },
    settings: { read: true, write: true },
  },
  support: {
    dashboard: { read: true, write: false },
    leads: { read: true, write: true },
    projects: { read: true, write: true },
    finance: { read: false, write: false },
    marketing: { read: false, write: false },
    chat: { read: true, write: true },
    staff: { read: false, write: false },
    settings: { read: false, write: false },
  },
};

export function canRead(role: StaffRole, module: CrmModuleId) {
  return ROLE_PERMISSIONS[role][module].read;
}

export function canWrite(role: StaffRole, module: CrmModuleId) {
  return ROLE_PERMISSIONS[role][module].write;
}