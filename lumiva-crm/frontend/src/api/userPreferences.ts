import { api } from './client';

export type UserPreferencesResponse = {
  preferences: Record<string, any>;
  timezone: string | null;
};

export function fetchUserPreferences() {
  return api.get<UserPreferencesResponse>('/users/me/preferences');
}

export function updateUserPreferences(patch: Record<string, any>) {
  return api.patch<UserPreferencesResponse>('/users/me/preferences', patch);
}