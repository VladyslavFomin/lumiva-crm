import { API_BASE } from './client';

/** Карта участника программы лояльности по ссылке /lp/:token ({{loyalty_link}} в автоматизации) — без входа */
export interface LoyaltyPublic {
  program: string; currency: string; pointValue: number; pointsEnabled: boolean; hotels: string[]; guestFirstName: string; number: string; points: number; pendingPoints: number;
  tier: { name: string; discountPct: number; benefits: string[] } | null; next: { name: string; minNights: number | null; minStays: number | null; minSpend: number | null } | null;
  stats: { stays: number; nights: number; spend: number }; tierPeriod: '12m' | 'lifetime'; lang: 'ru' | 'en' | 'tr';
  history: Array<{ type: string; points: number; status: string; date: string; hotel: string }>;
}
export async function fetchLoyaltyPublic(token: string): Promise<LoyaltyPublic> {
  const res = await fetch(`${API_BASE.replace(/\/$/, '')}/public/hotel-loyalty/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.message || res.statusText), { status: res.status });
  return data as LoyaltyPublic;
}
