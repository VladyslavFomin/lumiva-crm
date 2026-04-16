// src/api/profile.ts
import { api } from './client';

export interface Profile {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
}

export async function fetchProfile(): Promise<Profile> {
  return api.get<Profile>('/users/me');
}

export async function updateProfile(
  payload: Partial<Profile>,
): Promise<Profile> {
  return api.patch<Profile>('/users/me', payload);
}