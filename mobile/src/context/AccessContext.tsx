import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchProfile, UserProfile } from '../api/profile';
import { fetchStaff, Staff, StaffRole } from '../api/staff';
import { fetchTenantComponents, TenantComponent } from '../api/tenant';
import { fetchStaffPermissions, fetchUserPermissions, PermissionKey, RolePermissionMatrix, UserPermissionMatrix } from '../api/rbac';

const ROLES: StaffRole[] = ['owner', 'manager', 'viewer', 'finance', 'sales', 'developer', 'support'];

export interface AccessRule {
  /** Platform module key (`GET /tenants/components`) — the tenant's plan must include it. */
  component?: string;
  /** RBAC permission key — the signed-in staff member must be allowed it. */
  perm?: PermissionKey;
}

interface AccessApi {
  loaded: boolean;
  /** True when the section should be visible to this user on this tenant — same criteria as the website's sidebar. */
  allowed: (rule: AccessRule) => boolean;
  /** Single-permission check (e.g. `projects_edit_amount`) — for enabling/disabling individual fields, not whole sections. */
  can: (perm?: PermissionKey) => boolean;
}

const Ctx = createContext<AccessApi>({ loaded: false, allowed: () => true, can: () => true });

export const AccessProvider: React.FC<{ children: React.ReactNode; enabled?: boolean }> = ({ children, enabled = true }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [components, setComponents] = useState<TenantComponent[]>([]);
  const [roleMatrix, setRoleMatrix] = useState<RolePermissionMatrix | null>(null);
  const [userMatrix, setUserMatrix] = useState<UserPermissionMatrix | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // Every source fails open, exactly like the website: a failed request must never lock the user out of the app.
    Promise.all([
      fetchProfile().then(setProfile).catch(() => {}),
      fetchStaff().then(setStaff).catch(() => {}),
      fetchTenantComponents().then(setComponents).catch(() => {}),
      fetchStaffPermissions().then(setRoleMatrix).catch(() => {}),
      fetchUserPermissions().then(setUserMatrix).catch(() => {}),
    ]).finally(() => setLoaded(true));
  }, [enabled]);

  const currentStaff = useMemo(
    () => staff.find((s) => s.id === profile?.id || (!!profile?.email && s.email?.toLowerCase() === profile.email.toLowerCase())),
    [staff, profile],
  );

  const componentEnabled = useCallback((key?: string) => {
    if (!key || components.length === 0) return true;
    const c = components.find((x) => x.key === key);
    if (!c) return true; // unknown/new component: don't hide (same as the website)
    return c.enabled;
  }, [components]);

  const can = useCallback((perm?: PermissionKey) => {
    if (!perm) return true;
    // Fresh role from /staff-users wins over the login-time role (website's `canAccess`).
    const role = (currentStaff?.role ?? profile?.role ?? 'owner') as string;
    if (role === 'owner') return true;
    if (!roleMatrix) return true;
    const override = currentStaff?.id && userMatrix ? userMatrix[currentStaff.id]?.[perm] : undefined;
    if (override !== undefined) return override;
    const matrixRole = ROLES.includes(role as StaffRole) ? (role as StaffRole) : null;
    return (matrixRole ? roleMatrix[matrixRole] ?? [] : []).includes(perm);
  }, [currentStaff, profile, roleMatrix, userMatrix]);

  const allowed = useCallback((rule: AccessRule) => componentEnabled(rule.component) && can(rule.perm), [componentEnabled, can]);

  const value = useMemo(() => ({ loaded, allowed, can }), [loaded, allowed, can]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useAccess(): AccessApi {
  return useContext(Ctx);
}
