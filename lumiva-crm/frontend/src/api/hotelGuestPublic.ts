import { API_BASE } from './client';

/** Публичная страница «Заявка гостя» по QR-коду номера — без входа */
export interface GuestPublicInfo { hotelName: string; room: string; country: string | null; maintenance: string[] }

async function req<T>(method: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE.replace(/\/$/, '')}/public/hotel-guest/${encodeURIComponent(token)}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.message || res.statusText), { status: res.status, code: data?.code });
  return data as T;
}

export const fetchGuestPublic = (token: string) => req<GuestPublicInfo>('GET', token);
export const sendGuestPublic = (token: string, dto: { category: string; subcategory?: string; text?: string; guestName?: string; lang?: string }) =>
  req<{ number: number; category: string }>('POST', token, dto);
