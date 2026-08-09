// src/api/publicBooking.ts — публичный список услуг (/public/booking/:clientKey/services), без JWT.
// Используется составным полем service_booking на публичной странице формы.
import { publicJson } from './embedForms';

export interface PublicBookingService {
  id: string;
  name: string;
  category: string | null;
  durationMinutes: number;
  price: string;
  currency: string;
}

export async function fetchPublicServices(clientKey: string): Promise<PublicBookingService[]> {
  return publicJson(`/public/booking/${encodeURIComponent(clientKey)}/services`);
}
