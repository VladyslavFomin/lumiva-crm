// src/api/hotels.ts
import { api } from './client';

export type HotelStatus = 'active' | 'draft';

export interface Hotel {
  id: string;
  tenantId: string;
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
  referenceMarketGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  roomsCount: number;
  roomTypesCount: number;
  marketsCount: number;
  occupancyToday: number;
  adr: number;
}

export type HotelRoomPricingMode = 'offset' | 'fixed_rate';

export interface HotelRoomType {
  id: string;
  tenantId: string;
  hotelId: string;
  name: string;
  sizeM2: string | null;
  capacityLabel: string | null;
  basePrice: string;
  currency: string;
  quantity: number;
  amenities: string[];
  pricingMode: HotelRoomPricingMode;
  ppNetOffset: string;
  isBaseRoomType: boolean;
  infoFields: Record<string, string | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface HotelMarket {
  id: string;
  tenantId: string;
  hotelId: string;
  code: string;
  name: string;
}

export interface HotelRoomMarketPrice {
  marketId: string;
  code: string;
  name: string;
  price: string;
}

export interface HotelRoomDateOverride {
  id?: string;
  roomTypeId: string;
  date: string;
  price: string | null;
  blocked: boolean;
  discountPct: string;
  minNights: number;
}

export interface HotelMarketGroup {
  id: string;
  tenantId: string;
  hotelId: string;
  name: string;
  sortOrder: number;
}

export interface HotelPricingPeriod {
  id: string;
  tenantId: string;
  hotelId: string;
  startDate: string;
  endDate: string;
}

export interface HotelDailyMarketRateGroup {
  marketGroupId: string;
  marketGroupName: string;
  budgetPP: string;
  ppAvg: string;
  grossPP: string;
  discountPct: string;
  netPP: string;
}

export interface HotelDailyMarketRateRow {
  date: string;
  groups: HotelDailyMarketRateGroup[];
}

export interface HotelRoomOccupancyType {
  id: string;
  tenantId: string;
  roomTypeId: string;
  label: string;
  coefficient: string;
  paidChildCount: number;
  sortOrder: number;
}

export interface HotelRoomPricingOccupancyRow {
  id: string;
  label: string;
  coefficient: string;
  paidChildCount: number;
  pricesByPeriod: Record<string, number>;
  overriddenPeriods: string[];
}

export interface HotelRoomPricing {
  roomType: {
    id: string;
    name: string;
    pricingMode: HotelRoomPricingMode;
    ppNetOffset: string;
    isBaseRoomType: boolean;
  };
  periods: Array<{
    id: string;
    startDate: string;
    endDate: string;
    referenceNetPP: number;
    /** The value actually multiplied by each occupancy coefficient — referenceNetPP + offset
     * for 'offset' room types ("PP Net + разница"), or just referenceNetPP for 'fixed_rate'. */
    effectiveBasePP: number;
  }>;
  occupancyRows: HotelRoomPricingOccupancyRow[];
}

export interface HotelAgency {
  id: string;
  tenantId: string;
  name: string;
}

export type HotelReservationStatus =
  | 'confirmed'
  | 'pending'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';
export type HotelReservationPaidStatus = 'full' | 'partial' | 'none' | 'refunded';

export interface HotelReservation {
  id: string;
  tenantId: string;
  hotelId: string;
  roomTypeId: string;
  agencyId: string | null;
  guestName: string;
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
  source: 'manual' | 'import';
  createdAt: string;
  updatedAt: string;
}

export const HOTEL_RESERVATION_STATUS_LABELS_RU: Record<HotelReservationStatus, string> = {
  confirmed: 'Подтверждена',
  pending: 'Ожидает',
  checked_in: 'Заселён',
  checked_out: 'Выехал',
  cancelled: 'Отменена',
};

export const HOTEL_RESERVATION_PAID_LABELS_RU: Record<HotelReservationPaidStatus, string> = {
  full: 'Оплачено',
  partial: 'Частично',
  none: 'Не оплачено',
  refunded: 'Возврат',
};

/* ---------- overview ---------- */

export interface HotelsOverviewKpis {
  hotelsCount: number;
  roomsCount: number;
  occupancyToday: number;
  adr: number;
  bookings30d: number;
  revenue30d: number;
}

export function fetchHotelsOverviewKpis() {
  return api.get<HotelsOverviewKpis>('/hotels/overview-kpis');
}

/* ---------- hotels ---------- */

export function fetchHotels() {
  return api.get<Hotel[]>('/hotels');
}

export function fetchHotel(id: string) {
  return api.get<Hotel>(`/hotels/${id}`);
}

export function createHotel(dto: Partial<Hotel>) {
  return api.post<Hotel>('/hotels', dto);
}

export function updateHotel(id: string, dto: Partial<Hotel>) {
  return api.patch<Hotel>(`/hotels/${id}`, dto);
}

export function deleteHotel(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/${id}`);
}

/* ---------- room types ---------- */

export function fetchRoomTypes(hotelId: string) {
  return api.get<HotelRoomType[]>(`/hotels/${hotelId}/room-types`);
}

export function fetchRoomType(id: string) {
  return api.get<HotelRoomType>(`/hotels/room-types/${id}`);
}

export function createRoomType(hotelId: string, dto: Partial<HotelRoomType>) {
  return api.post<HotelRoomType>(`/hotels/${hotelId}/room-types`, dto);
}

export function updateRoomType(id: string, dto: Partial<HotelRoomType>) {
  return api.patch<HotelRoomType>(`/hotels/room-types/${id}`, dto);
}

export function deleteRoomType(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/room-types/${id}`);
}

export function updateRoomTypeInfo(id: string, dto: Record<string, string | boolean>) {
  return api.patch<HotelRoomType>(`/hotels/room-types/${id}/info`, dto);
}

/* ---------- flat markets ---------- */

export function fetchMarkets(hotelId: string) {
  return api.get<HotelMarket[]>(`/hotels/${hotelId}/markets`);
}

export function createMarket(hotelId: string, dto: { code: string; name: string }) {
  return api.post<HotelMarket>(`/hotels/${hotelId}/markets`, dto);
}

export function updateMarket(id: string, dto: { code?: string; name?: string }) {
  return api.patch<HotelMarket>(`/hotels/markets/${id}`, dto);
}

export function deleteMarket(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/markets/${id}`);
}

export function fetchMarketPrices(roomTypeId: string) {
  return api.get<HotelRoomMarketPrice[]>(`/hotels/room-types/${roomTypeId}/market-prices`);
}

export function upsertMarketPrice(roomTypeId: string, marketId: string, price: string) {
  return api.post<HotelRoomMarketPrice>(
    `/hotels/room-types/${roomTypeId}/market-prices/${marketId}`,
    { price },
  );
}

/* ---------- date overrides (retail calendar) ---------- */

export function fetchDateOverrides(roomTypeId: string, from: string, to: string) {
  return api.get<HotelRoomDateOverride[]>(`/hotels/room-types/${roomTypeId}/date-overrides`, {
    params: { from, to },
  });
}

export function upsertDateOverride(
  roomTypeId: string,
  date: string,
  dto: { price?: string | null; blocked?: boolean; discountPct?: string; minNights?: number },
) {
  return api.post<HotelRoomDateOverride>(
    `/hotels/room-types/${roomTypeId}/date-overrides/${date}`,
    dto,
  );
}

export interface HotelMonthFillStats {
  total: number;
  occupied: number;
  free: number;
  occupancyPct: number;
}

export function fetchMonthFillStats(roomTypeId: string, year: number, month: number) {
  return api.get<HotelMonthFillStats>(`/hotels/room-types/${roomTypeId}/month-fill`, {
    params: { year, month },
  });
}

/* ---------- occupancy types (Цены с размещением) ---------- */

export function fetchOccupancyTypes(roomTypeId: string) {
  return api.get<HotelRoomOccupancyType[]>(`/hotels/room-types/${roomTypeId}/occupancy-types`);
}

export function createOccupancyType(roomTypeId: string, dto: Partial<HotelRoomOccupancyType>) {
  return api.post<HotelRoomOccupancyType>(`/hotels/room-types/${roomTypeId}/occupancy-types`, dto);
}

export function updateOccupancyType(id: string, dto: Partial<HotelRoomOccupancyType>) {
  return api.patch<HotelRoomOccupancyType>(`/hotels/occupancy-types/${id}`, dto);
}

export function deleteOccupancyType(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/occupancy-types/${id}`);
}

export function fetchRoomPricing(hotelId: string, roomTypeId: string) {
  return api.get<HotelRoomPricing>(`/hotels/${hotelId}/room-types/${roomTypeId}/room-pricing`);
}

export function setOccupancyOverride(occupancyTypeId: string, periodId: string, price: string | null) {
  return api.post<HotelRoomOccupancyType>(
    `/hotels/occupancy-types/${occupancyTypeId}/period-overrides/${periodId}`,
    { price },
  );
}

/* ---------- market groups + pricing periods ---------- */

export function fetchMarketGroups(hotelId: string) {
  return api.get<HotelMarketGroup[]>(`/hotels/${hotelId}/market-groups`);
}

export function createMarketGroup(hotelId: string, name: string) {
  return api.post<HotelMarketGroup>(`/hotels/${hotelId}/market-groups`, { name });
}

export function updateMarketGroup(id: string, name: string) {
  return api.patch<HotelMarketGroup>(`/hotels/market-groups/${id}`, { name });
}

export function deleteMarketGroup(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/market-groups/${id}`);
}

export function fetchPricingPeriods(hotelId: string) {
  return api.get<HotelPricingPeriod[]>(`/hotels/${hotelId}/pricing-periods`);
}

export function createPricingPeriod(hotelId: string, dto: { startDate: string; endDate: string }) {
  return api.post<HotelPricingPeriod>(`/hotels/${hotelId}/pricing-periods`, dto);
}

export function updatePricingPeriod(id: string, dto: { startDate?: string; endDate?: string }) {
  return api.patch<HotelPricingPeriod>(`/hotels/pricing-periods/${id}`, dto);
}

export function deletePricingPeriod(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/pricing-periods/${id}`);
}

/* ---------- daily market rates (Bütçe/PP Ort./Brüt/İndirim/Net) ---------- */

export function fetchDailyRates(roomTypeId: string, dates: string[]) {
  return api.get<HotelDailyMarketRateRow[]>(`/hotels/room-types/${roomTypeId}/daily-rates`, {
    params: { dates: dates.join(',') },
  });
}

export function upsertDailyRate(
  roomTypeId: string,
  marketGroupId: string,
  date: string,
  dto: { budgetPP?: string; ppAvg?: string; grossPP?: string; discountPct?: string },
) {
  return api.post(
    `/hotels/room-types/${roomTypeId}/daily-rates/${marketGroupId}/${date}`,
    dto,
  );
}

/* ---------- agencies ---------- */

export function fetchAgencies() {
  return api.get<HotelAgency[]>('/hotels/agencies');
}

export function createAgency(name: string) {
  return api.post<HotelAgency>('/hotels/agencies', { name });
}

export function deleteAgency(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/agencies/${id}`);
}

/* ---------- reservations ---------- */

export interface HotelReservationFilters {
  hotelId?: string;
  roomTypeId?: string;
  agencyId?: string;
  status?: string;
  market?: string;
  search?: string;
}

export function fetchReservations(filters: HotelReservationFilters = {}) {
  return api.get<HotelReservation[]>('/hotels/reservations', { params: filters });
}

export function fetchReservation(id: string) {
  return api.get<HotelReservation>(`/hotels/reservations/${id}`);
}

export function createReservation(dto: Partial<HotelReservation>) {
  return api.post<HotelReservation>('/hotels/reservations', dto);
}

export function updateReservation(id: string, dto: Partial<HotelReservation>) {
  return api.patch<HotelReservation>(`/hotels/reservations/${id}`, dto);
}

export function deleteReservation(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/reservations/${id}`);
}

/* ---------- import: reservations ---------- */

export interface HotelReservationImportPreview {
  importId: string;
  columns: string[];
  sample: Array<Record<string, any>>;
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
  mappableFields: Array<{ key: string; label: string }>;
  unmatchedColumns: string[];
}

export function previewReservationsImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.postForm<HotelReservationImportPreview>('/hotels/reservations-import/preview', form);
}

export function applyReservationsImport(dto: {
  importId: string;
  mapping: Record<string, string | null>;
  defaultHotelId?: string;
}) {
  return api.post<{ created: number; errors: Array<{ row: number; message: string }>; total: number }>(
    '/hotels/reservations-import/apply',
    dto,
  );
}

/* ---------- import: daily pricing ---------- */

export interface HotelPricingImportPreview {
  importId: string;
  columns: string[];
  sample: Array<Record<string, any>>;
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
  groupNames: string[];
}

export function previewPricingImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.postForm<HotelPricingImportPreview>('/hotels/pricing-import/preview', form);
}

export function applyPricingImport(dto: {
  importId: string;
  hotelId: string;
  roomTypeId: string;
  dateColumn?: string;
}) {
  return api.post<{
    created: number;
    errors: Array<{ row: number; message: string }>;
    total: number;
    groupsCreated: string[];
  }>('/hotels/pricing-import/apply', dto);
}

/* ---------- import: room pricing (Цены с размещением) ---------- */

export interface HotelRoomPricingImportPreview {
  importId: string;
  periods: Array<{ startDate: string; endDate: string }>;
  occupancyLabels: string[];
  totalRows: number;
}

export function previewRoomPricingImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.postForm<HotelRoomPricingImportPreview>('/hotels/room-pricing-import/preview', form);
}

export function applyRoomPricingImport(dto: { importId: string; hotelId: string; roomTypeId: string }) {
  return api.post<{
    cellsSet: number;
    errors: Array<{ row: number; message: string }>;
    total: number;
    occupancyRowsCreated: string[];
  }>('/hotels/room-pricing-import/apply', dto);
}
