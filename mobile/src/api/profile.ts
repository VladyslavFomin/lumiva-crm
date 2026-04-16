import { api } from './client';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  role: string | null;
  position: string | null;
  departmentId: string | null;
  timezone: string | null;
  language: string | null;
}

export interface UpdateProfileDto {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  position?: string | null;
  timezone?: string | null;
  language?: string | null;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await api.get<UserProfile>('/users/profile');
  return res.data;
}

export async function updateProfile(payload: UpdateProfileDto): Promise<UserProfile> {
  const res = await api.patch<UserProfile>('/users/profile', payload);
  return res.data;
}

export async function changePassword(payload: ChangePasswordDto): Promise<void> {
  await api.post('/users/change-password', payload);
}




