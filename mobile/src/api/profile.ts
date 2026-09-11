import { api } from './client';
import Constants from 'expo-constants';

const host = Constants.expoConfig?.extra?.apiHost || 'https://crm.lumiva.agency';

export interface UserProfile {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string | null;
  status: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  name?: string | null;
  phone?: string | null;
}

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return `${host}/uploads/${avatarUrl.replace(/^\/?(uploads\/)?/, '')}`;
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await api.get<UserProfile>('/users/me');
  return res.data;
}

export async function updateProfile(payload: UpdateProfileDto): Promise<UserProfile> {
  const res = await api.patch<UserProfile>('/users/me', payload);
  return res.data;
}

export async function changePassword(payload: ChangePasswordDto): Promise<void> {
  await api.patch('/users/me/password', {
    oldPassword: payload.oldPassword,
    newPassword: payload.newPassword,
  });
}

export async function uploadAvatar(uri: string): Promise<UserProfile> {
  const form = new FormData();
  form.append('file', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
  const res = await api.post<UserProfile>('/users/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
