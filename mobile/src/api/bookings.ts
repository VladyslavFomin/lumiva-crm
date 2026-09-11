import { api } from './client';

export type ReservationStatus =
  | 'draft' | 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed'
  | 'cancelled_by_customer' | 'cancelled_by_business' | 'rejected' | 'no_show';

export interface ReservationDto {
  id: string;
  locationId: string;
  serviceId: string | null;
  staffUserId: string | null;
  leadId: string | null;
  contactId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  startAt: string;
  endAt: string;
  participants: number;
  status: ReservationStatus;
  paymentStatus: string;
  price: string | null;
  currency: string | null;
  source: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  locationId: string;
  serviceId: string | null;
  leadId: string | null;
  contactId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  startAt: string;
  endAt: string;
  participants: number;
  status: ReservationStatus;
  paymentStatus: string;
  price: number | null;
  currency: string | null;
  source: string;
  createdAt: string;
}

function mapReservation(dto: ReservationDto): Reservation {
  return {
    id: dto.id,
    locationId: dto.locationId,
    serviceId: dto.serviceId,
    leadId: dto.leadId,
    contactId: dto.contactId,
    customerName: dto.customerName || 'Без имени',
    customerPhone: dto.customerPhone,
    customerEmail: dto.customerEmail,
    startAt: dto.startAt,
    endAt: dto.endAt,
    participants: dto.participants,
    status: dto.status,
    paymentStatus: dto.paymentStatus,
    price: dto.price != null ? Number(dto.price) : null,
    currency: dto.currency,
    source: dto.source,
    createdAt: dto.createdAt,
  };
}

export async function fetchReservations(params?: { from?: string; to?: string; status?: ReservationStatus; search?: string }) {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.status) search.set('status', params.status);
  if (params?.search) search.set('search', params.search);
  const qs = search.toString();
  const res = await api.get<ReservationDto[]>(`/bookings/reservations${qs ? `?${qs}` : ''}`);
  return res.data.map(mapReservation);
}

export async function fetchReservation(id: string): Promise<Reservation> {
  const res = await api.get<ReservationDto>(`/bookings/reservations/${id}`);
  return mapReservation(res.data);
}

export interface BookingService {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  currency: string;
}

export interface BookingLocation {
  id: string;
  name: string;
  address: string | null;
}

export interface AvailabilitySlot {
  hour: number;
  busy: boolean;
  reservationId?: string;
  customerName?: string | null;
  serviceName?: string | null;
  price?: string | null;
}

export interface StaffAvailabilityRow {
  staffUserId: string;
  name: string;
  slots: AvailabilitySlot[];
}

export async function fetchStaffAvailabilityGrid(date: string, locationId?: string): Promise<StaffAvailabilityRow[]> {
  const res = await api.get<StaffAvailabilityRow[]>('/bookings/availability/staff-grid', { params: { date, locationId } });
  return res.data;
}

export async function fetchBookingServices(): Promise<BookingService[]> {
  const res = await api.get<BookingService[]>('/bookings/services');
  return res.data;
}

export async function fetchBookingLocations(): Promise<BookingLocation[]> {
  const res = await api.get<BookingLocation[]>('/bookings/locations');
  return res.data;
}

async function reservationAction(id: string, action: string) {
  const res = await api.post<ReservationDto>(`/bookings/reservations/${id}/${action}`);
  return mapReservation(res.data);
}

export const confirmReservation = (id: string) => reservationAction(id, 'confirm');
export const cancelReservation = (id: string) => reservationAction(id, 'cancel');
export const rejectReservation = (id: string) => reservationAction(id, 'reject');
export const checkInReservation = (id: string) => reservationAction(id, 'check-in');
export const completeReservation = (id: string) => reservationAction(id, 'complete');
export const noShowReservation = (id: string) => reservationAction(id, 'no-show');

export type ReservationActivityType =
  | 'created' | 'status_changed' | 'rescheduled' | 'staff_changed' | 'resource_changed' | 'notification_sent' | 'note_added';

export type WaitlistPriority = 'normal' | 'high' | 'vip';
export type WaitlistStatus = 'waiting' | 'offer' | 'confirmed' | 'expired' | 'removed';

export interface WaitlistEntry {
  id: string;
  locationId: string | null;
  serviceId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  preferredWindow: string | null;
  participants: number;
  priority: WaitlistPriority;
  status: WaitlistStatus;
  offeredStartAt: string | null;
  offeredEndAt: string | null;
  createdAt: string;
}

export async function fetchWaitlist(status?: string): Promise<WaitlistEntry[]> {
  const res = await api.get<WaitlistEntry[]>('/bookings/waitlist', { params: status ? { status } : undefined });
  return res.data;
}

/** Sets the offered slot and flips the entry to `status: 'offer'` — required before it can be
 * converted (the backend rejects conversion until a slot has been offered). */
export async function offerWaitlistSlot(id: string, slot: { startAt: string; endAt: string }): Promise<WaitlistEntry> {
  const res = await api.post<WaitlistEntry>(`/bookings/waitlist/${id}/offer`, slot);
  return res.data;
}

export async function convertWaitlistEntry(id: string): Promise<Reservation> {
  const res = await api.post<ReservationDto>(`/bookings/waitlist/${id}/convert`);
  return mapReservation(res.data);
}

export async function removeWaitlistEntry(id: string): Promise<void> {
  await api.delete(`/bookings/waitlist/${id}`);
}

export interface ReservationActivityEntry {
  id: string;
  type: ReservationActivityType;
  description: string | null;
  fromValue: string | null;
  toValue: string | null;
  user: { id: string; fullName: string } | null;
  createdAt: string;
}

export async function fetchReservationActivity(id: string): Promise<ReservationActivityEntry[]> {
  const res = await api.get<ReservationActivityEntry[]>(`/bookings/reservations/${id}/activity`);
  return res.data;
}

export interface CustomerStats {
  visits: number;
  cancellations: number;
  noShows: number;
  ltv: number;
  lastVisit: string | null;
  tags: string[];
}

export async function fetchCustomerStats(contactId: string): Promise<CustomerStats> {
  const res = await api.get<CustomerStats>(`/bookings/reservations/customer-stats/${contactId}`);
  return res.data;
}

export interface BookingResource {
  id: string;
  name: string;
  type: string;
  quantity: number;
  capacity: number | null;
  active: boolean;
}

export async function fetchBookingResources(): Promise<BookingResource[]> {
  const res = await api.get<BookingResource[]>('/bookings/resources');
  return res.data;
}

export interface ResourceStat {
  id: string;
  utilizationToday: number;
  nextReservation: { startAt: string; customerName: string | null } | null;
}

/** GET /bookings/analytics/resources — real utilization computed server-side from today's
 * reservations vs. the resource's daily availability (BookingsAnalyticsService.getResourceStats). */
export async function fetchResourceStats(): Promise<ResourceStat[]> {
  const res = await api.get<ResourceStat[]>('/bookings/analytics/resources');
  return res.data;
}
