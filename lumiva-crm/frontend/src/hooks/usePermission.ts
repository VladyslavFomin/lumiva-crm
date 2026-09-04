// src/hooks/usePermission.ts
import { useEffect, useState } from 'react';
import {
  fetchStaffPermissions,
  fetchUserPermissions,
  type PermissionKey,
  type RolePermissionMatrix,
  type UserPermissionMatrix,
} from '../api/rbac';
import { fetchStaff, type StaffRole } from '../api/staff';
import { getStoredUser } from '../auth/session';

type PermissionState = {
  roleMatrix: RolePermissionMatrix;
  userMatrix: UserPermissionMatrix;
  staffRole: StaffRole | null;
  staffId: string | null;
};

// Module-scope cache, shared across every usePermission() call so sibling components on the same
// page don't each re-fetch the same two endpoints independently. Time-bounded (not "forever until
// hard refresh" like an earlier version of this cache) — an owner changing someone's role/rights
// must show up within this window on their next navigation, not require a relogin to notice.
const CACHE_TTL_MS = 30_000;
let cache: PermissionState | null = null;
let cachedAt = 0;
let inflight: Promise<PermissionState | null> | null = null;

async function loadPermissionState(): Promise<PermissionState> {
  const user = getStoredUser();
  const [roleMatrix, userMatrix, staffList] = await Promise.all([
    fetchStaffPermissions(),
    fetchUserPermissions(),
    fetchStaff(),
  ]);
  const currentStaff = staffList.find(
    (s) => s.id === user?.id || s.email === user?.email,
  );
  return {
    roleMatrix,
    userMatrix,
    staffRole: (currentStaff?.role ?? user?.role ?? null) as StaffRole | null,
    staffId: currentStaff?.id ?? null,
  };
}

/**
 * Same allow/deny resolution as MainLayout's canAccess() (role matrix, then personal override —
 * see that component for the full rationale), for use outside the nav itself — e.g. disabling a
 * single field on a detail page when the viewer lacks a granular right like
 * 'leads_edit_amount'/'projects_edit_owner'. Owner always true. Fails open (returns true) while
 * the underlying fetch is in flight, matching MainLayout's own "don't flash a wrong state"
 * behavior — the real enforcement is server-side regardless.
 */
export function usePermission(key: PermissionKey | null): boolean {
  const isFresh = () => !!cache && Date.now() - cachedAt < CACHE_TTL_MS;
  const [state, setState] = useState<PermissionState | null>(isFresh() ? cache : null);

  useEffect(() => {
    if (!key || isFresh()) return;
    if (!inflight) {
      inflight = loadPermissionState().catch(() => null);
    }
    let alive = true;
    inflight.then((result) => {
      inflight = null;
      if (!alive) return;
      cache = result;
      cachedAt = Date.now();
      setState(result);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return true;
  if (!state) return true;
  if (state.staffRole === 'owner') return true;

  const override = state.staffId ? state.userMatrix[state.staffId]?.[key] : undefined;
  if (override !== undefined) return override;

  const rolePerms = state.staffRole ? state.roleMatrix[state.staffRole] ?? [] : [];
  return rolePerms.includes(key);
}
