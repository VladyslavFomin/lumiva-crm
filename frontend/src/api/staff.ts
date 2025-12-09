// src/api/staff.ts
import { api } from './client';

export type StaffRole =
  | 'owner'
  | 'manager'
  | 'viewer'
  | 'finance'
  | 'sales'
  | 'developer'
  | 'support';

export interface StaffUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  department: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  inviteStatus: string;
  externalId?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string | null;
}

// ---------- LIST ----------
export async function fetchStaff(): Promise<StaffUser[]> {
  return api.get<StaffUser[]>('/staff-users');
}

// ---------- ONE BY ID ----------
export async function fetchStaffById(id: string): Promise<StaffUser> {
  return api.get<StaffUser>(`/staff-users/${id}`);
}

// ---------- CREATE ----------
export async function createStaffUser(payload: {
  email: string;
  fullName: string;
  role: StaffRole;
  department?: string;
  avatarUrl?: string;
}): Promise<StaffUser> {
  return api.post<StaffUser>('/staff-users', payload);
}

// ---------- UPDATE (универсальный) ----------
export async function updateStaffUser(
  id: string,
  payload: Partial<{
    email: string;
    fullName: string;
    role: StaffRole;
    department: string | null;
    avatarUrl: string | null;
    isActive: boolean;
  }>,
): Promise<StaffUser> {
  return api.patch<StaffUser>(`/staff-users/${id}`, payload);
}

// Специальные хелперы – просто обёртки над updateStaffUser

export async function updateStaffRole(
  id: string,
  role: StaffRole,
): Promise<StaffUser> {
  return updateStaffUser(id, { role });
}

export async function updateStaffDepartment(
  id: string,
  department: string,
): Promise<StaffUser> {
  return updateStaffUser(id, { department });
}

// ---------- DEACTIVATE ----------
export async function deactivateStaffUser(id: string): Promise<void> {
  // если у тебя уже есть backend-ручка /deactivate — оставь её.
  // если нет — можно просто isActive=false через PATCH.
  try {
    await api.patch(`/staff-users/${id}/deactivate`);
  } catch {
    await updateStaffUser(id, { isActive: false });
  }
}

// ---------- ACTIVATE ----------
export async function activateStaffUser(id: string): Promise<void> {
  // аналогично: либо отдельная ручка, либо общий PATCH
  try {
    await api.patch(`/staff-users/${id}/activate`);
  } catch {
    await updateStaffUser(id, { isActive: true });
  }
}

// ---------- DELETE (по необходимости) ----------
export async function deleteStaffUser(id: string): Promise<void> {
  await api.del(`/staff-users/${id}`);
}