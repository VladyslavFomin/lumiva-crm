import { api } from './client';

export interface StaffDto {
  id: string;
  tenantId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  position: string | null;
  departmentId: string | null;
  role: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  position: string | null;
  departmentId: string | null;
  role: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapStaff(dto: StaffDto): Staff {
  return {
    id: dto.id,
    userId: dto.userId,
    firstName: dto.firstName || '',
    lastName: dto.lastName || '',
    fullName: `${dto.firstName || ''} ${dto.lastName || ''}`.trim() || dto.email,
    email: dto.email,
    phone: dto.phone,
    position: dto.position,
    departmentId: dto.departmentId,
    role: dto.role,
    isActive: dto.isActive,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export async function fetchStaff(): Promise<Staff[]> {
  const res = await api.get<StaffDto[] | { items?: StaffDto[] }>('/staff');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data.map(mapStaff);
}

export async function fetchStaffMember(id: string): Promise<Staff> {
  const res = await api.get<StaffDto>(`/staff/${id}`);
  return mapStaff(res.data);
}








