import { API_BASE } from './client';

/** Публичная страница оплаты брони по ссылке /hp/:token — без входа */
export interface HotelPayInfo {
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  amount: number; currency: string; expiresAt: string | null; paidAt: string | null; kind: 'deposit' | 'balance' | 'custom';
  hotel: { name: string; city: string | null; country: string | null };
  guestName: string; bookingCode: string | null; checkIn: string; checkOut: string; roomType: string | null; pax: number; children: number;
  lang: 'ru' | 'en' | 'tr'; provider: 'iyzico' | 'paytr' | 'yookassa' | null;
  lastAttempt: { status: 'pending' | 'paid' | 'failed' | 'cancelled'; failReason: string | null } | null;
  buyer: { name: string; email: string | null; phone: string | null; city: string | null };
}
const base = (token: string) => `${API_BASE.replace(/\/$/, '')}/public/hotel-pay/${encodeURIComponent(token)}`;
async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.message || res.statusText), { status: res.status, code: data?.code });
  return data as T;
}
export const fetchHotelPay = (token: string) => req<HotelPayInfo>('GET', base(token));
export const startHotelPay = (token: string, dto: { name: string; email: string; phone?: string; lang: string }) => req<{ url: string }>('POST', `${base(token)}/checkout`, dto);
