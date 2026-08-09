// src/api/storeHotels.ts — тестовая витрина Системы резервации (/store/:clientKey/hotels/*)
import { publicClient } from "./publicClient";

export interface StoreHotel {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  stars: number;
  currency: string;
  description: string | null;
  coverPhotoUrl: string | null;
}

export interface StoreSearchResult {
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

export interface StoreHotelDetail extends StoreHotel {
  address: string | null;
  checkInTime: string;
  checkOutTime: string;
  roomTypes: Array<{
    id: string;
    name: string;
    sizeM2: string | null;
    capacityLabel: string | null;
    amenities: string[];
    coverPhotoUrl: string | null;
    occupancyTypes: Array<{ id: string; label: string }>;
  }>;
  photos: Array<{ id: string; url: string }>;
}

export interface StoreReservationResult {
  id: string;
  bookingCode: string;
  total: string;
  currency: string;
}

export async function fetchHotels(clientKey: string): Promise<StoreHotel[]> {
  const { data } = await publicClient.get(`/public/hotels/${clientKey}/hotels`);
  return data;
}

export async function searchHotels(
  clientKey: string,
  checkIn: string,
  checkOut: string,
  pax?: number,
): Promise<StoreSearchResult[]> {
  const { data } = await publicClient.get(`/public/hotels/${clientKey}/search`, {
    params: { checkIn, checkOut, pax },
  });
  return data;
}

export async function fetchHotel(clientKey: string, hotelId: string): Promise<StoreHotelDetail> {
  const { data } = await publicClient.get(`/public/hotels/${clientKey}/hotels/${hotelId}`);
  return data;
}

export async function createReservation(
  clientKey: string,
  dto: {
    hotelId: string;
    roomTypeId: string;
    occupancyTypeId: string;
    checkIn: string;
    checkOut: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    pax?: number;
    notes?: string;
  },
): Promise<StoreReservationResult> {
  const { data } = await publicClient.post(`/public/hotels/${clientKey}/reservations`, dto);
  return data;
}

export async function payReservation(clientKey: string, reservationId: string) {
  const { data } = await publicClient.post(`/public/hotels/${clientKey}/reservations/${reservationId}/test-payment`);
  return data;
}

export async function lookupReservation(clientKey: string, code: string, email: string) {
  const { data } = await publicClient.get(`/public/hotels/${clientKey}/reservations/lookup`, {
    params: { code, email },
  });
  return data;
}
