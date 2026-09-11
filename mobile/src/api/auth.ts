import { api, saveAuth } from './client';
import Constants from 'expo-constants';

export interface LoginPayload {
  email: string;
  password: string;
  tenantId: string;
  clientKey?: string;
}

export interface AuthSuccess {
  accessToken: string;
  clientKey: string;
  tenantId: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
  };
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

export type LoginResult = AuthSuccess | TwoFactorChallenge;

function isTwoFactorChallenge(res: LoginResult): res is TwoFactorChallenge {
  return (res as TwoFactorChallenge).twoFactorRequired === true;
}

export async function login(payload: LoginPayload): Promise<LoginResult> {
  // Используем clientKey из ввода, если нет — приравниваем к tenantId
  const clientKey =
    payload.clientKey ||
    payload.tenantId ||
    (Constants.expoConfig?.extra as any)?.clientKey ||
    'demo-client';

  // Бэкенд принимает логин на /auth/login
  const res = await api.post<LoginResult>('/auth/login', {
    email: payload.email,
    password: payload.password,
    clientKey,
  });

  if (isTwoFactorChallenge(res.data)) {
    return res.data;
  }

  await saveAuth(res.data.accessToken, res.data.tenantId, res.data.clientKey);
  return res.data;
}

/** Second step of login when `login()` returned `{ twoFactorRequired: true }`. */
export async function verifyTwoFactor(challengeToken: string, code: string): Promise<AuthSuccess> {
  const res = await api.post<AuthSuccess>('/auth/verify-2fa', { challengeToken, code });
  await saveAuth(res.data.accessToken, res.data.tenantId, res.data.clientKey);
  return res.data;
}

export async function requestPasswordReset(clientKey: string, email: string): Promise<void> {
  await api.post('/auth/request-reset', { clientKey, email });
}

/** POST /auth/set-password — new password via a reset or invite token (same endpoint for both flows). */
export async function setPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/set-password', { token, password });
}

export interface SignupPayload {
  companyName: string;
  clientKey: string;
  email: string;
  password: string;
  phone?: string;
}

export interface SignupResult {
  verificationRequired: true;
  clientKey: string;
  email: string;
  expiresAt: string;
  message: string;
}

export async function signup(payload: SignupPayload): Promise<SignupResult> {
  const res = await api.post<SignupResult>('/auth/signup', payload);
  return res.data;
}

export async function verifySignupCode(clientKey: string, email: string, code: string): Promise<AuthSuccess> {
  const res = await api.post<AuthSuccess>('/auth/verify-signup-code', { clientKey, email, code });
  await saveAuth(res.data.accessToken, res.data.tenantId, res.data.clientKey);
  return res.data;
}

export async function resendSignupCode(clientKey: string, email: string): Promise<{ expiresAt: string }> {
  const res = await api.post<{ expiresAt: string }>('/auth/resend-signup-code', { clientKey, email });
  return res.data;
}
