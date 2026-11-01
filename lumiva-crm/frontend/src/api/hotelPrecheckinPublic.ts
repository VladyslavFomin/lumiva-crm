import { API_BASE } from './client';
import type { GuestDocumentScan } from './hotels';

/** Публичная онлайн-регистрация по ссылке из письма — без входа */
export interface PrecheckinGuest { id?: string; fullName: string; birthDate: string; gender: 'M' | 'F' | ''; nationalityCode: string | null; documentType: 'passport' | 'id_card' | 'other' | ''; passportNumber: string; passportExpiry: string; tcKimlikNo?: string }
export interface PrecheckinOffer { kind: 'upgrade' | 'early_checkin' | 'late_checkout' | 'extra'; roomTypeId?: string; extraServiceId?: string; name: string; description: string | null; amount: number; unit: 'stay' | 'night' | 'person'; quantity: number }
export interface PrecheckinInfo {
  hotel: { name: string; city: string | null; address: string | null; country: string | null; checkInTime: string | null; checkOutTime: string | null; currency: string; coverPhotoUrl: string | null; childMaxAge: number };
  reservation: { code: string; guestName: string; checkIn: string; checkOut: string; nights: number; roomTypeName: string; pax: number; adults: number; childAges: Array<number | null>; boardType: string | null; total: number; guestCountry: string | null };
  guests: PrecheckinGuest[];
  status: 'new' | 'sent' | 'opened' | 'completed';
  completedAt: string | null;
  arrival: { eta: string | null; flight: string | null; needTransfer: boolean; requests: string | null; preferences: string[]; consent: boolean };
  offers: PrecheckinOffer[];
  requests: Array<{ id: string; kind: PrecheckinOffer['kind']; name: string; amount: number; quantity: number; status: 'requested' | 'approved' | 'declined' }>;
  preferences: string[];
  scansLeft: number;
}

const base = (token: string) => `${API_BASE.replace(/\/$/, '')}/public/hotel-precheckin/${encodeURIComponent(token)}`;
async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.message || res.statusText), { status: res.status, code: data?.code });
  return data as T;
}
export const fetchPrecheckin = (token: string) => req<PrecheckinInfo>('GET', base(token));
export const submitPrecheckin = (token: string, dto: { guests: PrecheckinGuest[]; consent: boolean; language: string; eta: string; flight: string; needTransfer: boolean; requests: string; preferences: string[]; upsells: Array<{ kind: string; roomTypeId?: string; extraServiceId?: string; quantity?: number }> }) =>
  req<PrecheckinInfo>('POST', base(token), dto);
export const cancelPrecheckinRequest = (token: string, id: string) => req<PrecheckinInfo>('DELETE', `${base(token)}/requests/${id}`);
export const scanPrecheckinDocument = (token: string, file: File, lang: string) => {
  const f = new FormData();
  f.append('file', file);
  return req<GuestDocumentScan>('POST', `${base(token)}/scan?lang=${lang}`, f);
};
