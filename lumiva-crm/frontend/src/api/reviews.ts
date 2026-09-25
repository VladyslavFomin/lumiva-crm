import { api } from './client';

/** ИИ-менеджер отзывов: Google-отзывы объектов, черновики ответов, сигналы о негативе. */
export interface ReviewsAccess {
  allowed: boolean;
  employee: { id: string; name: string; status: string; avatarUrl: string | null; autonomyMode?: string } | null;
  planAllowed: boolean;
  limit: number | null;
  used: number;
  canHire: boolean;
  placesKey: boolean;
}
export interface ReviewPlaceCandidate {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  totalReviews: number;
  mapsUrl: string | null;
}
export interface ReviewPlace {
  id: string;
  placeId: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  rating: number | null;
  totalReviews: number;
  enabled: boolean;
  syncHours: number;
  alertThreshold: number;
  recipients: string[];
  businessContext: string | null;
  signature: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  writeReviewUrl: string;
  open?: number;
  openNegative?: number;
}
export interface ReviewItem {
  id: string;
  placeRowId: string;
  authorName: string | null;
  authorUrl: string | null;
  authorPhoto: string | null;
  rating: number;
  text: string | null;
  language: string | null;
  publishedAt: string;
  status: 'new' | 'drafted' | 'replied' | 'ignored';
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  topics: string[];
  summary: string | null;
  aiReply: string | null;
  repliedAt: string | null;
}
export interface ReviewStats {
  days: number;
  count: number;
  avgRating: number | null;
  negative: number;
  replied: number;
  topics: Array<{ topic: string; total: number; negative: number }>;
}

const B = '/marketing/reviews';
export const fetchReviewsAccess = () => api.get<ReviewsAccess>(`${B}/access`);
export const searchReviewPlaces = (q: string) => api.get<ReviewPlaceCandidate[]>(`${B}/search?q=${encodeURIComponent(q)}`);
export const fetchReviewPlaces = () => api.get<ReviewPlace[]>(`${B}/places`);
export const addReviewPlace = (placeId: string) => api.post<ReviewPlace>(`${B}/places`, { placeId });
export const updateReviewPlace = (id: string, patch: Partial<ReviewPlace>) => api.patch<ReviewPlace>(`${B}/places/${id}`, patch);
export const removeReviewPlace = (id: string) => api.delete<{ ok: boolean }>(`${B}/places/${id}`);
export const syncReviewPlace = (id: string) => api.post<{ fetched: number; new: number }>(`${B}/places/${id}/sync`, {});
export const fetchReviewStats = (placeId?: string) => api.get<ReviewStats>(`${B}/stats${placeId ? `?placeId=${placeId}` : ''}`);
export const fetchReviewItems = (q: { placeId?: string; status?: string; sentiment?: string }) => {
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as Array<[string, string]>).toString();
  return api.get<ReviewItem[]>(`${B}/items${qs ? `?${qs}` : ''}`);
};
export const updateReviewItem = (id: string, patch: { status?: ReviewItem['status']; aiReply?: string }) => api.patch<ReviewItem>(`${B}/items/${id}`, patch);
export const regenerateReviewReply = (id: string, tone?: string) => api.post<ReviewItem>(`${B}/items/${id}/regenerate`, { tone });
