import { api } from './client';

// Read-only mobile view of the Hotels/PMS module. Every write/edit/delete action for pricing,
// room types, galleries, factsheets, agencies, etc. stays website-only by explicit product
// decision — this file only ever calls GET routes.

export type HotelStatus = 'active' | 'draft';

/** Mirrors Hotel entity (src/hotels/hotel.entity.ts) plus the enrich() fields hotels.service.ts
 * attaches to every list()/get() response. Fields the entity has but that don't serve a
 * read-only display (infoFields, quickLinks, feedToken, referenceMarketGroupId,
 * seasonRevenueTarget, riskThreshold*) are intentionally left out of this type. */
export interface Hotel {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  stars: number;
  currency: string;
  address: string | null;
  description: string | null;
  status: HotelStatus;
  checkInTime: string;
  checkOutTime: string;
  coverPhotoUrl: string | null;
  allowOverbooking: boolean;
  createdAt: string;
  updatedAt: string;
  // enrich() additions — per-hotel KPIs, already computed server-side.
  roomsCount: number;
  roomTypesCount: number;
  marketsCount: number;
  occupancyToday: number;
  adr: number;
}

export async function fetchHotels(): Promise<Hotel[]> {
  const res = await api.get<Hotel[]>('/hotels');
  return res.data;
}

export async function fetchHotel(id: string): Promise<Hotel> {
  const res = await api.get<Hotel>(`/hotels/${id}`);
  return res.data;
}

/** Tenant-wide (all hotels combined) — HotelsController has no per-hotel variant of this route. */
export interface HotelOverviewKpis {
  hotelsCount: number;
  roomsCount: number;
  occupancyToday: number;
  adr: number;
  bookings30d: number;
  revenue30d: number;
}

export async function fetchHotelOverviewKpis(): Promise<HotelOverviewKpis> {
  const res = await api.get<HotelOverviewKpis>('/hotels/overview-kpis');
  return res.data;
}

/* ---------- reservations ---------- */

export type HotelReservationStatus = 'confirmed' | 'pending' | 'checked_in' | 'checked_out' | 'cancelled';
export type HotelReservationPaidStatus = 'full' | 'partial' | 'none' | 'refunded';
export type HotelReservationSource = 'manual' | 'import' | 'website';

export interface HotelReservationGuest {
  id: string;
  fullName: string;
  citizenship: string;
  passportNumber: string;
  passportExpiry: string;
  age: string;
  note: string | null;
}

export interface HotelReservationPayment {
  id: string;
  date: string;
  amount: string;
  method: string;
  note: string | null;
}

/** Mirrors HotelReservation entity (src/hotels/hotel-reservation.entity.ts) exactly — this
 * controller's list()/get() return the raw row, with no joined hotel/room-type name. */
export interface HotelReservation {
  id: string;
  hotelId: string;
  roomTypeId: string;
  agencyId: string | null;
  roomUnitId: string | null;
  occupancyTypeId: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  pax: number;
  market: string | null;
  checkIn: string;
  checkOut: string;
  costPerNight: string;
  ppPerNight: string;
  grossPerNight: string;
  ppTotal: string;
  roomTotal: string;
  discountPct: string;
  total: string;
  status: HotelReservationStatus;
  paidStatus: HotelReservationPaidStatus;
  source: HotelReservationSource;
  bookingCode: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  depositAmount: string;
  payments: HotelReservationPayment[];
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  notes: string | null;
  guests: HotelReservationGuest[];
  createdAt: string;
  updatedAt: string;
}

export interface HotelReservationFilters {
  hotelId?: string;
  roomTypeId?: string;
  agencyId?: string;
  status?: string;
  market?: string;
  search?: string;
}

export async function fetchHotelReservations(params?: HotelReservationFilters): Promise<HotelReservation[]> {
  const res = await api.get<HotelReservation[]>('/hotels/reservations', { params });
  return res.data;
}

export async function fetchHotelReservation(id: string): Promise<HotelReservation> {
  const res = await api.get<HotelReservation>(`/hotels/reservations/${id}`);
  return res.data;
}

/* ---------- analytics ---------- */

/** Flat subset of HotelAnalyticsService.getSummary()'s return value — this endpoint also
 * returns `pacing`/`funnel`/`roomTypes`/`agencies`/`guests` breakdowns, but those are left
 * untyped/unused here: `guests` is a hardcoded stub (dataAvailable: false) that must never be
 * rendered, and the rest are dense structures built for the web pricing/pacing tools that are
 * out of scope for a read-only mobile view. `markets` is kept — it's a small, genuinely
 * real per-market revenue breakdown. */
export interface HotelAnalyticsKpis {
  occupancyNowPct: number;
  roomsAvailable: number;
  roomsTotal: number;
  revenueSold: number;
  roomsNeededPerDay: number;
  currency: string;
}

export interface HotelAnalyticsMarketRow {
  market: string;
  revenueActual: number;
  revenueTarget: number | null;
  roomsSold: number;
}

export interface HotelAnalyticsSummary {
  kpis: HotelAnalyticsKpis;
  markets: HotelAnalyticsMarketRow[];
}

export interface HotelAnalyticsFilters {
  /** Single hotel id, or omit for every hotel (HotelAnalyticsQueryDto.hotelIds is comma-separated). */
  hotelId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchHotelAnalytics(filters?: HotelAnalyticsFilters): Promise<HotelAnalyticsSummary> {
  const res = await api.get<HotelAnalyticsSummary>('/hotels/analytics', {
    params: {
      hotelIds: filters?.hotelId,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo,
    },
  });
  return res.data;
}
