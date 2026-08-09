// src/api/publicHotels.ts — публичный поиск/детали отелей (/public/hotels/:clientKey/*), без JWT.
// Используется составным полем hotel_booking на публичной странице формы.
import { publicJson } from './embedForms';

export interface PublicHotelSearchResult {
  hotelId: string;
  hotelName: string;
  city: string | null;
  stars: number;
  coverPhotoUrl: string | null;
  roomTypeId: string;
  roomTypeName: string;
  currency: string;
  pricePerNight: number;
  nights: number;
  total: number;
}

export interface PublicHotelDetail {
  id: string;
  name: string;
  roomTypes: Array<{
    id: string;
    name: string;
    occupancyTypes: Array<{ id: string; label: string }>;
  }>;
}

export async function searchPublicHotels(
  clientKey: string,
  checkIn: string,
  checkOut: string,
  pax?: number,
): Promise<PublicHotelSearchResult[]> {
  const params = new URLSearchParams({ checkIn, checkOut });
  if (pax) params.set('pax', String(pax));
  return publicJson(`/public/hotels/${encodeURIComponent(clientKey)}/search?${params.toString()}`);
}

export async function fetchPublicHotel(clientKey: string, hotelId: string): Promise<PublicHotelDetail> {
  return publicJson(`/public/hotels/${encodeURIComponent(clientKey)}/hotels/${encodeURIComponent(hotelId)}`);
}
