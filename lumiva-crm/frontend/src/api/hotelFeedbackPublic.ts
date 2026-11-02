import { API_BASE } from './client';

/** Публичный опрос гостя по ссылке /fb/:token ({{survey_link}} в автоматизации) — без входа */
export interface HotelFeedbackInfo { hotel: string; guestFirstName: string; stage: 'in_stay' | 'after_stay' | 'other'; lang: 'ru' | 'en' | 'tr'; score: number | null; comment: string | null; answered: boolean; reviewLinks: Array<{ platform: string }> }
const base = (token: string) => `${API_BASE.replace(/\/$/, '')}/public/hotel-feedback/${encodeURIComponent(token)}`;
async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.message || res.statusText), { status: res.status, code: data?.code });
  return data as T;
}
export const fetchFeedback = (token: string) => req<HotelFeedbackInfo>('GET', base(token));
export const submitFeedback = (token: string, dto: { score: number; comment: string }) => req<HotelFeedbackInfo>('POST', base(token), dto);
export const openReview = (token: string, platform: string) => req<{ url: string }>('POST', `${base(token)}/review`, { platform });
