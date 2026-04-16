import { api, saveAuth } from './client';
import Constants from 'expo-constants';

export interface LoginPayload {
  email: string;
  password: string;
  tenantId: string;
  clientKey?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    tenantId?: string;
  };
  clientKey?: string;
}

export async function login(payload: LoginPayload) {
  // Используем clientKey из ввода, если нет — приравниваем к tenantId
  const clientKey =
    payload.clientKey ||
    payload.tenantId ||
    (Constants.expoConfig?.extra as any)?.clientKey ||
    'demo-client';

  // Бэкенд принимает логин на /auth/login
  const res = await api.post<LoginResponse>('/auth/login', {
    ...payload,
    clientKey,
  });
  await saveAuth(res.data.accessToken, payload.tenantId, clientKey);
  return res.data;
}
