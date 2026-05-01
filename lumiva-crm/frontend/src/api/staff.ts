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
  departmentId?: string | null;
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

/** Приводит ответ бэка к одному виду (camelCase + departmentId). */
export function normalizeStaffUser(raw: unknown): StaffUser {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== 'object') {
    throw new Error('Invalid staff user payload');
  }
  const departmentIdRaw = r.departmentId ?? r.department_id;
  const departmentId =
    departmentIdRaw === undefined || departmentIdRaw === ''
      ? null
      : (departmentIdRaw as string | null);
  return {
    id: String(r.id ?? ''),
    tenantId: String(r.tenantId ?? r.tenant_id ?? ''),
    email: String(r.email ?? ''),
    fullName: String(r.fullName ?? r.full_name ?? r.email ?? ''),
    role: r.role as StaffRole,
    department: (r.department != null ? String(r.department) : null) as string | null,
    departmentId,
    phone: r.phone != null ? String(r.phone) : null,
    avatarUrl: (r.avatarUrl ?? r.avatar_url ?? null) as string | null,
    isActive: Boolean(r.isActive ?? r.is_active ?? true),
    inviteStatus: String(r.inviteStatus ?? r.invite_status ?? 'active'),
    externalId: (r.externalId ?? r.external_id ?? null) as string | null,
    lastLoginAt: (r.lastLoginAt ?? r.last_login_at ?? null) as string | null,
    createdAt: String(r.createdAt ?? r.created_at ?? ''),
    updatedAt: String(r.updatedAt ?? r.updated_at ?? ''),
    lastActiveAt: (r.lastActiveAt ?? r.last_active_at ?? null) as string | null,
  };
}

// ---------- LIST ----------
export async function fetchStaff(): Promise<StaffUser[]> {
  const rows = await api.get<unknown[]>('/staff-users');
  return rows.map((row) => normalizeStaffUser(row));
}

// ---------- ONE BY ID ----------
export async function fetchStaffById(id: string): Promise<StaffUser> {
  const row = await api.get<unknown>(`/staff-users/${id}`);
  return normalizeStaffUser(row);
}

// ---------- CREATE ----------
export async function createStaffUser(payload: {
  email: string;
  fullName: string;
  role: StaffRole;
  department?: string;
  avatarUrl?: string;
}): Promise<StaffUser> {
  const row = await api.post<unknown>('/staff-users', payload);
  return normalizeStaffUser(row);
}

// ---------- UPDATE (универсальный) ----------
export async function updateStaffUser(
  id: string,
  payload: Partial<{
    email: string;
    fullName: string;
    role: StaffRole;
    department: string | null;
    departmentId: string | null;
    avatarUrl: string | null;
    isActive: boolean;
  }>,
): Promise<StaffUser> {
  const row = await api.patch<unknown>(`/staff-users/${id}`, payload);
  return normalizeStaffUser(row);
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

/** Владелец: приглашение по email, письмо со ссылкой на установку пароля. */
export async function inviteStaffMember(payload: {
  email: string;
  fullName: string;
  role: StaffRole;
  departmentId?: string | null;
}): Promise<StaffUser> {
  const row = await api.post<unknown>('/staff-users/invite', payload);
  return normalizeStaffUser(row);
}

export async function resendStaffInvite(id: string): Promise<StaffUser> {
  const row = await api.post<unknown>(`/staff-users/${id}/resend-invite`, {});
  return normalizeStaffUser(row);
}