// src/api/storeBooking.ts — тестовая витрина Бронирования (/store/:clientKey/booking)
import { publicClient } from "./publicClient";

export interface StoreBookingService {
  id: string;
  name: string;
  category: string | null;
  durationMinutes: number;
  price: string;
  currency: string;
}

export interface StoreBookingLocation {
  id: string;
  name: string;
  address: string | null;
}

export async function fetchServices(clientKey: string): Promise<StoreBookingService[]> {
  const { data } = await publicClient.get(`/public/booking/${clientKey}/services`);
  return data;
}

export async function fetchLocations(clientKey: string): Promise<StoreBookingLocation[]> {
  const { data } = await publicClient.get(`/public/booking/${clientKey}/locations`);
  return data;
}

export async function createBookingRequest(
  clientKey: string,
  dto: {
    serviceId: string;
    locationId: string;
    startAt: string;
    endAt: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
  },
) {
  const { data } = await publicClient.post(`/public/booking/${clientKey}/requests`, dto);
  return data;
}
