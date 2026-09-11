import { api } from './client';

export type StaffRole = 'owner' | 'manager' | 'viewer' | 'finance' | 'sales' | 'developer' | 'support';

export interface StaffDto {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  department: string | null;
  departmentId: string | null;
  role: StaffRole;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  inviteStatus: string;
  lastLoginAt: string | null;
}

export type Staff = StaffDto;

export async function fetchStaff(): Promise<Staff[]> {
  const res = await api.get<StaffDto[] | { items?: StaffDto[] }>('/staff-users');
  return Array.isArray(res.data) ? res.data : res.data?.items || [];
}

export async function fetchStaffMember(id: string): Promise<Staff> {
  const res = await api.get<StaffDto>(`/staff-users/${id}`);
  return res.data;
}
