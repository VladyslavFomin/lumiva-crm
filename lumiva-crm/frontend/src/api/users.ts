// src/api/users.ts
import { api } from './client';

//
// ===== ТИПЫ =====
//
export interface MeDto {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string | null;
  status?: string | null;
  timezone?: string | null;
  preferences?: Record<string, any> | null;
  twoFactorEnabled?: boolean;
  lastActiveAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMePayload {
  name?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface ProvisionUserResponse {
  email: string;
  password: string;
}

//
// ===== МЕТОДЫ =====
//

export async function fetchMe(): Promise<MeDto> {
  return api.get<MeDto>('/users/me');
}

export async function updateMe(payload: UpdateMePayload): Promise<MeDto> {
  return api.patch<MeDto>('/users/me', payload);
}

export async function changeMyPassword(
  oldPassword: string,
  newPassword: string,
) {
  return api.patch('/users/me/password', {
    oldPassword,
    newPassword,
  });
}

export async function uploadMyAvatar(file: File): Promise<MeDto> {
  const fd = new FormData();
  fd.append('file', file);
  return api.postForm<MeDto>('/users/me/avatar', fd);
}

/**
 * === Админ создаёт/сбрасывает логин и пароль сотрудника ===
 * POST /users/admin/provision
 */
export async function adminProvisionUser(payload: {
  email: string;
  name?: string;
  role?: string;
  password?: string;
}): Promise<ProvisionUserResponse> {
  return api.post<ProvisionUserResponse>('/users/admin/provision', payload);
}