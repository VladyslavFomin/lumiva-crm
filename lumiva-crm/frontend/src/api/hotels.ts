// src/api/hotels.ts
import { api, API_BASE } from './client';
import { getAccessToken } from '../auth/session';

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
  seasonRevenueTarget: string;
  riskThresholdBadPct: string | null;
  riskThresholdWarnPct: string | null;
  infoFields: Record<string, string | boolean>;
  coverPhotoUrl: string | null;
  quickLinks: Array<{ label: string; url: string }>;
  allowOverbooking: boolean;
  /** Прямая продажа: что важнее — сезонная цена группы рынка или плоская цена рынка */
  pricingPriority?: 'season' | 'market';
  /** гость младше этого возраста — ребёнок (12 → до 11,99 лет) */
  childMaxAge?: number;
  /** детская политика прямых продаж */
  childPolicy?: HotelChildPolicyRule[];
  /** сообщения WhatsApp от проживающих → заявки Guest Care */
  guestCareWhatsapp?: boolean;
  accommodationTaxPct: string;
  vatPct: string;
  pricesIncludeTax: boolean;
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
  stopSale: boolean;
  coverPhotoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HotelMarket {
  id: string;
  tenantId: string;
  hotelId: string;
  code: string;
  name: string;
  countryCodes: string[];
  /** Группа рынков с оптовыми ценами, по которой считается сезонная цена для гостей этого рынка */
  marketGroupId: string | null;
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
  /** надбавка (+) / скидка (−) в % к прайсу сезона */
  adjustmentPct?: string;
  /** свой PP минимальной категории на период */
  periodPP?: Record<string, string>;
}

export interface HotelPricingPeriod {
  id: string;
  tenantId: string;
  hotelId: string;
  startDate: string;
  endDate: string;
  ppBase?: string;
  budgetPP?: string;
  minNights?: number;
  releaseDays?: number;
  isPeak?: boolean;
}

export type HotelPeriodInput = { startDate?: string; endDate?: string; ppBase?: string; budgetPP?: string; minNights?: number; releaseDays?: number; isPeak?: boolean };

export interface HotelDailyMarketRateGroup {
  marketGroupId: string;
  marketGroupName: string;
  budgetPP: string;
  ppAvg: string;
  grossPP: string;
  discountPct: string;
  netPP: string;
  /** PP Ort. по факту — средняя цена на человека по броням этой даты; null — броней нет */
  ppActual?: number | null;
  ppActualCount?: number;
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
  /** коэффициент в пиковые периоды; null — как обычный */
  peakCoefficient?: string | null;
  /** младенцы (INF, до 2 лет) в размещении: бесплатно, нужна детская кроватка */
  infants?: number;
  paidChildCount: number;
  /** состав размещения — форма брони подбирает размещение по взрослым + детям */
  adults: number | null;
  children: number;
  sortOrder: number;
}

export interface HotelRoomPricingOccupancyRow {
  id: string;
  label: string;
  coefficient: string;
  paidChildCount: number;
  adults?: number | null;
  children?: number;
  pricesByPeriod: Record<string, number>;
  overriddenPeriods: string[];
}

export interface HotelRoomPricing {
  /** группа рынков, по которой посчитаны цены, и опорная ли она (ручные цены периода — только у опорной) */
  marketGroupId?: string | null;
  isReferenceGroup?: boolean;
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

export type HotelPartnerType = 'tour_operator' | 'ota' | 'travel_agency' | 'corporate' | 'direct' | 'other';
export const HOTEL_PARTNER_TYPES: HotelPartnerType[] = ['tour_operator', 'ota', 'travel_agency', 'corporate', 'direct', 'other'];
export type HotelPartnerPaymentTerms = 'prepayment' | 'on_arrival' | 'postpayment';

/** Партнёр по продажам (исторически — «агентство»). */
export interface HotelAgency {
  id: string;
  tenantId: string;
  name: string;
  type: HotelPartnerType;
  status: 'active' | 'archived';
  countryCode: string | null;
  city: string | null;
  code: string | null;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  currency: string | null;
  commissionPct: string;
  paymentTerms: HotelPartnerPaymentTerms;
  paymentDays: number;
  creditLimit: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HotelPartnerStats {
  bookings: number;
  cancelled: number;
  gross: number;
  net: number;
  commission: number;
  lastBookingAt: string | null;
  activeContracts: number;
}

export type HotelPartnerWithStats = HotelAgency & { stats: HotelPartnerStats };

export type HotelBoardType = 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | 'UAI';
export const HOTEL_BOARD_TYPES: HotelBoardType[] = ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI'];
export type HotelContractStatus = 'draft' | 'active' | 'expired' | 'cancelled';

export interface HotelContractRoom {
  roomTypeId: string;
  allotment: number;
  releaseDays: number | null;
  rate: string | null;
  dateOverrides: Record<string, number>;
  stopDates: string[];
}
export interface HotelCancellationRule {
  daysBefore: number;
  penaltyType: 'percent' | 'nights';
  value: number;
}
export interface HotelContractPromotion {
  id: string;
  type: 'early_booking' | 'spo' | 'long_stay';
  name: string;
  discountPct: number;
  bookBy: string | null;
  stayFrom: string | null;
  stayTo: string | null;
  minNights: number;
  combinable: boolean;
}

/** Та же логика, что promotionDiscount на сервере: суммируемые складываются, из остальных — лучшая. */
export function contractPromotionDiscount(c: HotelContract | null, checkIn: string, checkOut: string, bookedOn: string) {
  if (!c?.promotions?.length || !checkIn || !checkOut) return { pct: 0, applied: [] as HotelContractPromotion[] };
  const nights = Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
  const fits = c.promotions.filter(
    (p) =>
      nights >= (p.minNights || 1) &&
      (!p.stayFrom || checkIn >= p.stayFrom) &&
      (!p.stayTo || checkIn <= p.stayTo) &&
      (p.type !== 'early_booking' || (!!p.bookBy && bookedOn <= p.bookBy)),
  );
  const best = fits.filter((p) => !p.combinable).sort((a, b) => b.discountPct - a.discountPct)[0];
  const applied = [...fits.filter((p) => p.combinable), ...(best ? [best] : [])];
  return { pct: Math.min(90, applied.reduce((s, p) => s + p.discountPct, 0)), applied };
}

export interface HotelChildPolicyRule {
  /** от (включительно) — до (не включая): 0–2 = до 1,99 */
  ageFrom: number;
  ageTo: number;
  type: 'free' | 'percent';
  value: number;
  /** только для N-го ребёнка (1 — старший) */
  childNo?: number;
}

export interface HotelContract {
  id: string;
  tenantId: string;
  agencyId: string;
  hotelId: string;
  name: string;
  code: string | null;
  status: HotelContractStatus;
  validFrom: string;
  validTo: string;
  bookingFrom: string | null;
  bookingTo: string | null;
  pricing: 'net' | 'commission';
  commissionPct: string;
  boardType: HotelBoardType;
  currency: string | null;
  releaseDays: number;
  guaranteed: boolean;
  allowOverAllotment: boolean;
  minStay: number;
  marketCountries: string[];
  rooms: HotelContractRoom[];
  cancellationPolicy: HotelCancellationRule[];
  childPolicy: HotelChildPolicyRule[];
  promotions: HotelContractPromotion[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HotelContractUsage {
  contract: HotelContract;
  from: string;
  to: string;
  rows: Array<{
    roomTypeId: string;
    days: Array<{ date: string; allotment: number; sold: number; left: number; released: boolean; stop: boolean }>;
    totalAllotment: number;
    totalSold: number;
    utilizationPct: number;
  }>;
}

export type HotelRoomBlockStatus = 'tentative' | 'definite' | 'released' | 'cancelled';
export interface HotelRoomBlock {
  id: string;
  tenantId: string;
  hotelId: string;
  roomTypeId: string;
  agencyId: string | null;
  contractId: string | null;
  name: string;
  status: HotelRoomBlockStatus;
  dateFrom: string;
  dateTo: string;
  rooms: number;
  cutoffDate: string;
  ratePerNight: string | null;
  boardType: string | null;
  countryCode: string | null;
  contactName: string | null;
  notes: string | null;
  pickup?: { bookings: number; roomNights: number; pickedRoomNights: number; pct: number };
  holds?: boolean;
}

export interface HotelInventory {
  hotelId: string;
  from: string;
  to: string;
  nights: string[];
  rows: Array<{
    roomTypeId: string;
    name: string;
    capacity: number;
    days: Array<{ date: string; capacity: number; sold: number; heldBlocks: number; heldAllot: number; allotted: number; free: number }>;
    contracts: Array<{
      contractId: string;
      name: string;
      partner: string;
      guaranteed: boolean;
      days: Array<{ date: string; allotment: number; sold: number; released: boolean; stop: boolean }>;
    }>;
    blocks: Array<{
      blockId: string;
      name: string;
      status: HotelRoomBlockStatus;
      partner: string | null;
      cutoffDate: string;
      days: Array<{ date: string; rooms: number; picked: number }>;
    }>;
  }>;
}

export type HotelRoomUnitHousekeepingStatus = 'clean' | 'dirty' | 'inspected' | 'out_of_order';

export interface HotelRoomUnit {
  id: string;
  tenantId: string;
  hotelId: string;
  roomTypeId: string;
  label: string;
  housekeepingStatus: HotelRoomUnitHousekeepingStatus;
  note: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const HOTEL_ROOM_UNIT_HOUSEKEEPING_LABELS_RU: Record<HotelRoomUnitHousekeepingStatus, string> = {
  clean: 'Убрана',
  dirty: 'Грязная',
  inspected: 'Проверена',
  out_of_order: 'Не работает',
};

export type HotelReservationStatus =
  | 'confirmed'
  | 'pending'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export const HOTEL_CANCEL_REASONS = ['guest_request', 'partner', 'no_payment', 'duplicate', 'overbooking', 'force_majeure', 'other'] as const;
export type HotelCancelReason = (typeof HOTEL_CANCEL_REASONS)[number] | 'option_expired';
export const HOTEL_COMP_REASONS = ['infotour', 'influencer', 'pr', 'partner_visit', 'staff', 'vip', 'compensation', 'other'] as const;
export type HotelCompReason = (typeof HOTEL_COMP_REASONS)[number];
export type HotelReservationPaidStatus = 'full' | 'partial' | 'none' | 'refunded';

export interface HotelReservation {
  id: string;
  tenantId: string;
  hotelId: string;
  roomTypeId: string;
  agencyId: string | null;
  roomUnitId: string | null;
  occupancyTypeId: string | null;
  /** бронь из менеджера каналов */
  otaName?: string | null;
  /** бронь из канала: кто берёт оплату (отель / OTA) и способ оплаты */
  paymentCollect?: 'property' | 'ota' | null;
  channelPaymentType?: string | null;
  otaCode?: string | null;
  channelBookingId?: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  pax: number;
  children: number;
  /** возрасты детей (null — не указан) */
  childAges?: Array<number | null>;
  market: string | null;
  marketId: string | null;
  guestCountry: string | null;
  saleCountry: string | null;
  contractId: string | null;
  blockId: string | null;
  boardType: string | null;
  commissionPct: string;
  commissionAmount: string;
  netTotal: string;
  bookingCode?: string | null;
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
  source: 'manual' | 'import' | 'website' | 'demo' | 'walk_in' | 'channel';
  cancelReason: HotelCancelReason | null;
  cancelNote: string | null;
  cancelledAt: string | null;
  cancellationFee: string;
  noShowAt: string | null;
  optionUntil: string | null;
  isComplimentary: boolean;
  compReason: HotelCompReason | null;
  compNote: string | null;
  compValue: string;
  accommodationFolio: 'guest' | 'partner';
  extrasTotal: string;
  priceMode: 'auto' | 'manual';
  nightlyRates: HotelNightlyRate[] | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  depositAmount: string;
  /** срок предоплаты по тарифу */
  depositDueDate?: string | null;
  /** тариф брони */
  ratePlanId?: string | null;
  /** профиль гостя-контакта (история, VIP, предпочтения) */
  guestProfileId?: string | null;
  /** групповая бронь и «гость ещё не указан» (ждёт rooming list) */
  groupId?: string | null;
  roomingPending?: boolean;
  /** акции отеля в цене брони (снимок) и признак «акции сняты» */
  promotions?: HotelAppliedPromotion[];
  promotionsOff?: boolean;
  payments: HotelReservationPayment[];
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  notes: string | null;
  guests: HotelReservationGuest[];
  createdAt: string;
  updatedAt: string;
}

export interface HotelReservationPayment {
  id: string;
  date: string;
  amount: string;
  method: string;
  note: string | null;
}

export interface HotelReservationGuest {
  id: string;
  fullName: string;
  citizenship: string;
  passportNumber: string;
  passportExpiry: string;
  age: string;
  note: string | null;
  birthDate?: string;
  gender?: 'M' | 'F' | '';
  documentType?: 'passport' | 'id_card' | 'other' | '';
  nationalityCode?: string | null;
  tcKimlikNo?: string;
  fatherName?: string;
  motherName?: string;
  kbsReportedAt?: string | null;
  birthPlace?: string;
  documentIssueDate?: string;
  migrationCard?: string;
  visaNumber?: string;
  entryPurpose?: 'tourism' | 'business' | 'private' | 'work' | 'study' | 'other' | '';
  /** профиль гостя — ставит сервер сопоставлением */
  profileId?: string | null;
}

/** Россия по свободному тексту страны отеля — тот же признак, что isRussia на сервере. */
export const isRussiaCountry = (c: string | null | undefined) => /^(ru|rus|russia|россия|российская федерация|рф)$/i.test(String(c || '').trim());

/** Результат распознавания фото паспорта / ID-карты (POST /hotels/reservations/scan-document) */
export interface GuestDocumentScan {
  documentType: 'passport' | 'id_card' | 'other';
  surname: string;
  givenNames: string;
  fullName: string;
  nationalityIso3: string | null;
  nationalityName: string | null;
  nationalityCode: string | null;
  documentNumber: string;
  birthDate: string | null;
  expiryDate: string | null;
  sex: 'M' | 'F' | null;
  mrzVerified: boolean;
  warnings: Array<'no_mrz' | 'mrz_checksum_failed' | 'expired'>;
}

export function scanGuestDocument(file: Blob, lang: string) {
  const fd = new FormData();
  fd.append('file', file, 'document.jpg');
  return api.postForm<GuestDocumentScan>(`/hotels/reservations/scan-document?lang=${encodeURIComponent(lang)}`, fd);
}

export const HOTEL_RESERVATION_STATUS_LABELS_RU: Record<HotelReservationStatus, string> = {
  confirmed: 'Подтверждена',
  pending: 'Ожидает',
  checked_in: 'Заселён',
  checked_out: 'Выехал',
  cancelled: 'Отменена',
  no_show: 'Не заехал',
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
  /** Валюта adr/revenue30d — основная валюта тенанта (брони пересчитаны из валют своих отелей). */
  currency: string;
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

/** Типы номеров всех отелей тенанта (по одному запросу на отель). */
export async function fetchAllRoomTypes(hotels?: Hotel[]) {
  const list = hotels ?? (await fetchHotels());
  return (await Promise.all(list.map((h) => fetchRoomTypes(h.id)))).flat();
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

export function createMarket(hotelId: string, dto: { code: string; name: string; countryCodes?: string[] }) {
  return api.post<HotelMarket>(`/hotels/${hotelId}/markets`, dto);
}

export function updateMarket(id: string, dto: { code?: string; name?: string; countryCodes?: string[]; marketGroupId?: string | null }) {
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

export function fetchRoomPricing(hotelId: string, roomTypeId: string, marketGroupId?: string) {
  return api.get<HotelRoomPricing>(`/hotels/${hotelId}/room-types/${roomTypeId}/room-pricing`, { params: marketGroupId ? { marketGroupId } : undefined });
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

export function updateMarketGroup(id: string, dto: string | { name?: string; adjustmentPct?: string; periodPP?: { periodId: string; pp: string | null } }) {
  return api.patch<HotelMarketGroup>(`/hotels/market-groups/${id}`, typeof dto === 'string' ? { name: dto } : dto);
}

export function deleteMarketGroup(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/market-groups/${id}`);
}

export function fetchPricingPeriods(hotelId: string) {
  return api.get<HotelPricingPeriod[]>(`/hotels/${hotelId}/pricing-periods`);
}

export function createPricingPeriod(hotelId: string, dto: HotelPeriodInput & { startDate: string; endDate: string }) {
  return api.post<HotelPricingPeriod>(`/hotels/${hotelId}/pricing-periods`, dto);
}

export function updatePricingPeriod(id: string, dto: HotelPeriodInput) {
  return api.patch<HotelPricingPeriod>(`/hotels/pricing-periods/${id}`, dto);
}

/* ---------- тарифы: питание, невозвратный, условия отмены и предоплаты ---------- */

export type HotelBoardCode = 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | 'UAI';
export const HOTEL_BOARD_CODES: HotelBoardCode[] = ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI'];
export interface HotelCancelRule { daysBefore: number; penaltyType: 'percent' | 'nights'; value: number }
export interface HotelRatePlan {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  description: string | null;
  boardType: HotelBoardCode;
  boardSupplementAdult: string;
  boardSupplementChild: string;
  adjustType: 'percent' | 'amount';
  adjustValue: string;
  refundable: boolean;
  cancellationPolicy: HotelCancelRule[];
  prepaymentType: 'none' | 'percent' | 'nights' | 'full';
  prepaymentValue: string;
  prepaymentDueDays: number;
  minNights: number;
  roomTypeIds: string[];
  sellDirect: boolean;
  sellWebsite: boolean;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
}
export type HotelRatePlanInput = Partial<Omit<HotelRatePlan, 'id' | 'hotelId'>> & { hotelId?: string };

export const fetchRatePlans = (hotelId: string) => api.get<HotelRatePlan[]>('/hotels/rate-plans', { params: { hotelId } });
export const createRatePlan = (dto: HotelRatePlanInput) => api.post<HotelRatePlan>('/hotels/rate-plans', dto);
export const updateRatePlan = (id: string, dto: HotelRatePlanInput) => api.patch<HotelRatePlan>(`/hotels/rate-plans/${id}`, dto);
export const makeDefaultRatePlan = (id: string) => api.post<HotelRatePlan>(`/hotels/rate-plans/${id}/default`, {});
export const deleteRatePlan = (id: string) => api.delete<{ ok: boolean }>(`/hotels/rate-plans/${id}`);

/* ---------- точки продаж (ресторан, бар, SPA, мини-бар) ---------- */

export type HotelPosKind = 'restaurant' | 'bar' | 'spa' | 'minibar' | 'shop' | 'other';
export const HOTEL_POS_KINDS: HotelPosKind[] = ['restaurant', 'bar', 'spa', 'minibar', 'shop', 'other'];
export interface HotelPosOutlet { id: string; hotelId: string; name: string; kind: HotelPosKind; active: boolean; sortOrder: number; items: HotelExtraService[] }
export interface HotelPosGuest { reservationId: string; guestName: string; roomLabel: string | null; boardType: string | null; allInclusive: boolean; pax: number; checkOut: string; extrasOwed: number; creditLimit: number | null }
export interface HotelPosLine { extraServiceId: string; name: string; quantity: number; unitPrice: number; amount: number; included: boolean }
export interface HotelPosCheck { id: string; outletId: string; number: number; businessDate: string; reservationId: string | null; roomLabel: string | null; guestName: string | null; paymentMethod: string | null; lines: HotelPosLine[]; total: string; includedValue: string; status: 'posted' | 'voided'; note: string | null; voidReason: string | null; createdAt: string }
export interface HotelPosReportRow { outletId: string; name: string; kind: HotelPosKind; checks: number; voided: number; room: number; cash: number; card: number; other: number; included: number; total: number }
const POS = '/hotels/pos';
export const fetchPosOutlets = (hotelId: string) => api.get<{ outlets: HotelPosOutlet[]; creditLimit: number | null; currency: string; businessDate: string }>(`${POS}/outlets`, { params: { hotelId } });
export const createPosOutlet = (dto: { hotelId: string; name: string; kind: HotelPosKind }) => api.post<HotelPosOutlet>(`${POS}/outlets`, dto);
export const updatePosOutlet = (id: string, dto: Partial<Pick<HotelPosOutlet, 'name' | 'kind' | 'active' | 'sortOrder'>>) => api.patch<HotelPosOutlet>(`${POS}/outlets/${id}`, dto);
export const deletePosOutlet = (id: string) => api.delete<{ ok: boolean }>(`${POS}/outlets/${id}`);
export const savePosSettings = (hotelId: string, creditLimit: number | null) => api.patch<{ creditLimit: number | null }>(`${POS}/settings/${hotelId}`, { creditLimit });
export const fetchPosGuests = (hotelId: string, q: string) => api.get<HotelPosGuest[]>(`${POS}/in-house`, { params: { hotelId, q } });
export const fetchPosChecks = (q: { hotelId: string; outletId?: string; date?: string }) => api.get<HotelPosCheck[]>(`${POS}/checks`, { params: q });
export const createPosCheck = (dto: { outletId: string; lines: Array<{ extraServiceId: string; quantity: number }>; reservationId?: string | null; paymentMethod?: string | null; note?: string; overrideLimit?: boolean }) => api.post<HotelPosCheck>(`${POS}/checks`, dto);
export const voidPosCheck = (id: string, reason: string) => api.post<HotelPosCheck>(`${POS}/checks/${id}/void`, { reason });
export const fetchPosReport = (q: { hotelId: string; from: string; to: string }) => api.get<HotelPosReportRow[]>(`${POS}/report`, { params: q });

/* ---------- рекомендации цены (revenue) ---------- */

export interface HotelRevenueRow {
  date: string; weekday: number; lead: number; roomTypeId: string; roomTypeName: string; capacity: number; sold: number; occupancy: number; pickup: number;
  currentPct: number; currentByRule: boolean; recommendedPct: number | null; ruleId: string | null; ruleName: string | null; guard: 'budget' | 'max' | null;
  manualPrice: boolean; basePrice: number; currentPrice: number; newPrice: number | null;
}
export interface HotelRevenueRule { id: string; hotelId: string; name: string; roomTypeIds: string[]; metric: 'occupancy' | 'pickup'; op: 'gte' | 'lte'; threshold: string; leadMin: number; leadMax: number | null; weekdays: number[]; adjustPct: string; active: boolean; sortOrder: number }
export type HotelRevenueRuleInput = Partial<Omit<HotelRevenueRule, 'id' | 'hotelId'>> & { hotelId?: string };
export interface HotelRevenueSettings { revenueAutoApply: boolean; revenueHorizon: number; revenueMaxPct: number }
const RM = '/hotels/revenue';
export const fetchRevenue = (hotelId: string, days?: number) => api.get<{ from: string; to: string; today: string; rows: HotelRevenueRow[]; rules: number; settings: HotelRevenueSettings }>(RM, { params: { hotelId, days } });
export const fetchRevenueRules = (hotelId: string) => api.get<HotelRevenueRule[]>(`${RM}/rules`, { params: { hotelId } });
export const createRevenueRule = (dto: HotelRevenueRuleInput) => api.post<HotelRevenueRule>(`${RM}/rules`, dto);
export const updateRevenueRule = (id: string, dto: HotelRevenueRuleInput) => api.patch<HotelRevenueRule>(`${RM}/rules/${id}`, dto);
export const deleteRevenueRule = (id: string) => api.delete<{ ok: boolean }>(`${RM}/rules/${id}`);
export const applyRevenue = (hotelId: string, items: Array<{ roomTypeId: string; date: string; pct: number; ruleId?: string | null }>) => api.post<{ applied: number }>(`${RM}/apply`, { hotelId, items });
export const revenueRange = (dto: { hotelId: string; roomTypeIds: string[]; from: string; to: string; pct: number }) => api.post<{ applied: number }>(`${RM}/range`, dto);
export const saveRevenueSettings = (hotelId: string, dto: Partial<HotelRevenueSettings>) => api.patch<HotelRevenueSettings>(`${RM}/settings/${hotelId}`, dto);

/* ---------- онлайн-регистрация и допродажи ---------- */

export type HotelPrecheckinStatus = 'new' | 'sent' | 'opened' | 'completed';
export interface HotelPrecheckinRow {
  reservationId: string; guestName: string; guestEmail: string | null; checkIn: string; checkOut: string; pax: number; roomTypeName: string; guestsFilled: number;
  status: HotelPrecheckinStatus | null; sentAt: string | null; completedAt: string | null; eta: string | null; flight: string | null; needTransfer: boolean; requestsText: string | null;
  upsells: { requested: number; approved: number };
}
export interface HotelUpsellRequest {
  id: string; reservationId: string; kind: 'upgrade' | 'early_checkin' | 'late_checkout' | 'extra'; name: string; quantity: number; amount: number;
  status: 'requested' | 'approved' | 'declined'; note: string | null; decidedAt: string | null; createdAt: string; guestName: string; checkIn: string | null; checkOut: string | null; reservationStatus: string | null;
}
const PC = '/hotels/precheckin';
export const fetchPrecheckins = (q: { hotelId: string; from?: string; to?: string }) => api.get<{ from: string; to: string; autoDays: number | null; upgrades: boolean; items: HotelPrecheckinRow[] }>(PC, { params: q });
export const fetchUpsellRequests = (q: { hotelId: string; status?: string }) => api.get<HotelUpsellRequest[]>(`${PC}/requests`, { params: q });
export const decideUpsell = (id: string, approve: boolean, note?: string) => api.post<HotelUpsellRequest>(`${PC}/requests/${id}/${approve ? 'approve' : 'decline'}`, { note });
export const precheckinLink = (reservationId: string) => api.post<{ token: string; url: string; status: HotelPrecheckinStatus; sentAt: string | null; completedAt: string | null }>(`${PC}/${reservationId}/link`, {});
export const precheckinSend = (reservationId: string) => api.post<{ ok: boolean; sentTo: string }>(`${PC}/${reservationId}/send`, {});
export const savePrecheckinSettings = (hotelId: string, dto: { precheckinAutoDays?: number | null; precheckinUpgrades?: boolean }) => api.patch<{ precheckinAutoDays: number | null; precheckinUpgrades: boolean }>(`${PC}/settings/${hotelId}`, dto);

/* ---------- групповые брони и rooming list ---------- */

export type HotelGroupStatus = 'tentative' | 'definite' | 'cancelled';
export interface HotelGroupSummary { rooms: number; cancelled: number; named: number; pax: number; inHouse: number; checkedOut: number; withUnit: number; byType: Array<{ roomTypeId: string; count: number }>; total: number; paid: number; balance: number; currency: string }
export interface HotelGroup {
  id: string; hotelId: string; code: string; name: string; agencyId: string | null; contractId: string | null; blockId: string | null; ratePlanId: string | null;
  contactName: string | null; contactEmail: string | null; contactPhone: string | null; checkIn: string; checkOut: string; status: HotelGroupStatus;
  optionUntil: string | null; roomingDue: string | null; billing: 'group' | 'individual'; notes: string | null; createdAt: string;
  hotelName: string; partnerName: string | null; summary: HotelGroupSummary;
}
export interface HotelGroupRoom {
  id: string; guestName: string; roomingPending: boolean; roomTypeId: string; roomTypeName: string; roomUnitId: string | null; roomLabel: string | null;
  checkIn: string; checkOut: string; status: HotelReservationStatus; pax: number; children: number; total: string; extrasTotal: string; paid: number;
  guests: HotelReservationGuest[]; optionUntil: string | null;
}
export interface HotelGroupFull extends HotelGroup { roomTypes: Array<{ id: string; name: string }>; reservations: HotelGroupRoom[] }
export interface HotelGroupRoomLine { roomTypeId: string; count: number; adults?: number; childAges?: Array<number | null> }
export type HotelGroupInput = Partial<Pick<HotelGroup, 'name' | 'agencyId' | 'contractId' | 'blockId' | 'ratePlanId' | 'contactName' | 'contactEmail' | 'contactPhone' | 'checkIn' | 'checkOut' | 'status' | 'optionUntil' | 'roomingDue' | 'notes'>> & { hotelId?: string; rooms?: HotelGroupRoomLine[] };
export interface HotelRoomingPreview {
  columns: string[]; skipped: number;
  rooms: Array<{ row: number; key: string | null; roomType: string | null; checkIn: string | null; checkOut: string | null; notes: string | null; roomTypeId: string | null; reservationId: string | null; reservationName: string | null; existing?: boolean; problem: 'unknown_room_type' | 'no_free_room' | null;
    guests: Array<{ fullName: string; birthDate: string | null; age: number | null; childHint: boolean; passportNumber: string | null; nationality: string | null; gender: 'M' | 'F' | null }> }>;
}
const G = '/hotels/groups';
export const fetchHotelGroups = (q: { hotelId?: string; status?: string; period?: 'upcoming' | 'past' | 'all' }) => api.get<HotelGroup[]>(G, { params: q });
export const fetchHotelGroup = (id: string) => api.get<HotelGroupFull>(`${G}/${id}`);
export const createHotelGroup = (dto: HotelGroupInput) => api.post<HotelGroupFull>(G, dto);
export const updateHotelGroup = (id: string, dto: HotelGroupInput) => api.patch<HotelGroupFull>(`${G}/${id}`, dto);
export const addHotelGroupRooms = (id: string, rooms: HotelGroupRoomLine[]) => api.post<HotelGroupFull>(`${G}/${id}/rooms`, { rooms });
export const changeHotelGroupDates = (id: string, dto: { checkIn: string; checkOut: string; reservationIds?: string[] }) => api.post<{ updated: number; failed: Array<{ id: string; error?: string }>; group: HotelGroupFull }>(`${G}/${id}/dates`, dto);
export const assignHotelGroupRooms = (id: string) => api.post<{ assigned: number; missing: number; group: HotelGroupFull }>(`${G}/${id}/assign-rooms`, {});
export const previewHotelGroupRooming = (id: string, file: File) => { const f = new FormData(); f.append('file', file); return api.postForm<HotelRoomingPreview>(`${G}/${id}/rooming/preview`, f); };
export const applyHotelGroupRooming = (id: string, file: File, addMissing: boolean) => { const f = new FormData(); f.append('file', file); f.append('addMissing', String(addMissing)); return api.postForm<{ applied: number; updated: number; added: number; failed: Array<{ row: number; name: string; error: string }>; group: HotelGroupFull }>(`${G}/${id}/rooming/apply`, f); };
export const payHotelGroup = (id: string, dto: { amount: string; method: string; date?: string; note?: string }) => api.post<{ distributed: Array<{ id: string; amount: number }>; group: HotelGroupFull }>(`${G}/${id}/pay`, dto);
export const cancelHotelGroupRooms = (id: string, dto: { reservationIds?: string[]; reason: string; fee: 'policy' | 'none'; note?: string }) => api.post<{ cancelled: number; failed: Array<{ id: string; error: string }>; group: HotelGroupFull }>(`${G}/${id}/cancel-rooms`, dto);
export const hotelGroupStay = (id: string, action: 'check_in' | 'check_out') => api.post<{ done: number; failed: Array<{ id: string; name: string; error: string }>; group: HotelGroupFull }>(`${G}/${id}/stay`, { action });

/* ---------- профили гостей ---------- */

export const HOTEL_GUEST_PREFERENCES = [
  'high_floor', 'low_floor', 'quiet_room', 'sea_view', 'near_elevator', 'twin_beds', 'double_bed', 'extra_pillow',
  'baby_cot', 'accessible', 'non_smoking', 'late_arrival', 'early_breakfast', 'vegetarian', 'gluten_free', 'no_alcohol',
] as const;
export interface HotelGuestStats { stays: number; nights: number; bookings: number; cancelled: number; revenue: Record<string, number>; lastStay: string | null; nextStay: string | null }
export interface HotelGuestProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  language: string | null;
  birthDate: string | null;
  gender: 'M' | 'F' | null;
  documentType: 'passport' | 'id_card' | 'other' | null;
  documentNumber: string | null;
  documentExpiry: string | null;
  vip: boolean;
  blacklisted: boolean;
  blacklistReason: string | null;
  preferences: string[];
  allergies: string | null;
  notes: string | null;
  marketingConsent: boolean;
  anonymizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: HotelGuestStats;
}
export interface HotelGuestStay { id: string; hotelId: string; hotelName: string; currency: string; roomTypeName: string; roomNumber: string | null; checkIn: string; checkOut: string; status: HotelReservation['status']; total: string; pax: number; guestName: string; source: string; isContact: boolean }
export interface HotelGuestDuplicateRef { id: string; fullName: string; email: string | null; phone: string | null; country: string | null; birthDate: string | null; documentNumber: string | null; reason: 'document' | 'email' | 'phone' | 'name_birth' | 'name' }
export interface HotelGuestProfileFull extends HotelGuestProfile { stays: HotelGuestStay[]; duplicates: HotelGuestDuplicateRef[] }
export interface HotelGuestList { items: HotelGuestProfile[]; total: number; page: number; pageSize: number; counts: { total: number; vip: number; blacklisted: number; repeat: number; upcoming: number }; unlinked: number }
export interface HotelGuestBrief { id: string; fullName: string; vip: boolean; blacklisted: boolean; blacklistReason: string | null; preferences: string[]; allergies: string | null; notes?: string | null; stays?: number; stats?: HotelGuestStats }
export type HotelGuestProfileInput = Partial<Omit<HotelGuestProfile, 'id' | 'stats' | 'anonymizedAt' | 'createdAt' | 'updatedAt'>>;
export const fetchGuestProfiles = (q: { search?: string; filter?: string; country?: string; sort?: string; page?: number }) => api.get<HotelGuestList>('/hotels/guests', { params: q });
export const fetchGuestProfile = (id: string) => api.get<HotelGuestProfileFull>(`/hotels/guests/${id}`);
export const fetchGuestBrief = (id: string) => api.get<HotelGuestBrief | null>(`/hotels/guests/${id}/brief`);
export const lookupGuestProfiles = (q: string) => api.get<HotelGuestProfile[]>('/hotels/guests/lookup', { params: { q } });
export const createGuestProfile = (dto: HotelGuestProfileInput) => api.post<HotelGuestProfile>('/hotels/guests', dto);
export const updateGuestProfile = (id: string, dto: HotelGuestProfileInput) => api.patch<HotelGuestProfile>(`/hotels/guests/${id}`, dto);
export const anonymizeGuestProfile = (id: string) => api.post<HotelGuestProfile>(`/hotels/guests/${id}/anonymize`, {});
export const mergeGuestProfiles = (targetId: string, sourceIds: string[]) => api.post<{ id: string; merged: number }>('/hotels/guests/merge', { targetId, sourceIds });
export const fetchGuestDuplicates = () => api.get<Array<{ reason: HotelGuestDuplicateRef['reason']; profiles: Array<HotelGuestDuplicateRef & { vip: boolean; blacklisted: boolean; createdAt: string; stats: HotelGuestStats }> }>>('/hotels/guests/duplicates');
export const backfillGuestProfiles = () => api.post<{ processed: number; linked: number; remaining: number }>('/hotels/guests/backfill', {});

/* ---------- акции отеля: раннее бронирование, горящие, спецпредложения, длительное проживание ---------- */

export type HotelPromotionType = 'early_booking' | 'last_minute' | 'spo' | 'long_stay';
export const HOTEL_PROMOTION_TYPES: HotelPromotionType[] = ['early_booking', 'last_minute', 'spo', 'long_stay'];
export interface HotelPromotion {
  id: string;
  hotelId: string;
  type: HotelPromotionType;
  name: string;
  description: string | null;
  discountPct: string;
  freeNights: number;
  bookFrom: string | null;
  bookTo: string | null;
  stayFrom: string | null;
  stayTo: string | null;
  stayRule: 'nights' | 'arrival';
  minNights: number;
  maxNights: number | null;
  minDaysBefore: number | null;
  maxDaysBefore: number | null;
  combinable: boolean;
  prepaymentPct: string;
  prepaymentDueDate: string | null;
  prepaymentDueDays: number | null;
  marketGroupIds: string[];
  roomTypeIds: string[];
  ratePlanIds: string[];
  sellDirect: boolean;
  sellWebsite: boolean;
  active: boolean;
  origin: 'manual' | 'import';
  sortOrder: number;
}
export type HotelPromotionInput = Partial<Omit<HotelPromotion, 'id' | 'hotelId' | 'origin'>> & { hotelId?: string };
export interface HotelAppliedPromotion { id: string; type: HotelPromotionType; name: string; discountPct: number; freeNights: number; amount: number; prepaymentPct: number; prepaymentDueDate: string | null }
export type HotelPromotionBlocker = 'inactive' | 'channel' | 'room' | 'market' | 'rate_plan' | 'book_window' | 'lead_time' | 'min_nights' | 'max_nights' | 'stay_window' | 'not_best';
export interface HotelPromotionCheck {
  total: number;
  totalBeforePromo: number;
  promoDiscount: number;
  currency: string;
  prepayment: { amount: number; dueDate: string | null } | null;
  ratePlan: { id: string; code: string; name: string } | null;
  nights: HotelNightlyRate[];
  warnings: HotelQuote['warnings'];
  promotions: Array<{ id: string; name: string; type: HotelPromotionType; applied: boolean; amount: number; blockers: HotelPromotionBlocker[] }>;
}
export const fetchPromotions = (hotelId: string) => api.get<HotelPromotion[]>('/hotels/promotions', { params: { hotelId } });
export const createPromotion = (dto: HotelPromotionInput) => api.post<HotelPromotion>('/hotels/promotions', dto);
export const updatePromotion = (id: string, dto: HotelPromotionInput) => api.patch<HotelPromotion>(`/hotels/promotions/${id}`, dto);
export const deletePromotion = (id: string) => api.delete<{ ok: boolean }>(`/hotels/promotions/${id}`);
export const checkPromotions = (dto: { hotelId: string; roomTypeId: string; checkIn: string; checkOut: string; bookedOn?: string; marketGroupId?: string | null; ratePlanId?: string | null; adults?: number; salesChannel?: 'direct' | 'website' }) =>
  api.post<HotelPromotionCheck>('/hotels/promotions/check', dto);

/* ---------- календарь ограничений (ARI): свободно, цена, стоп, закрыто на заезд / выезд, мин. / макс. ночей ---------- */

export interface HotelAriDay {
  date: string;
  free: number;
  price: number | null;
  stop: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minStay: number;
  maxStay: number;
  manualPrice: number | null;
  discountPct: number;
  /** стоп поставлен не в календаре (тип номера снят с продажи или стоп-дата «По дням») */
  stopElsewhere: boolean;
}

export interface HotelAriGrid {
  hotelId: string;
  from: string;
  days: number;
  adults: number;
  marketGroupId: string | null;
  today: string;
  currency: string;
  dates: string[];
  roomTypes: Array<{ id: string; name: string; isBase: boolean; stopSale: boolean; days: HotelAriDay[] }>;
}

export interface HotelAriBulkPatch {
  roomTypeIds: string[];
  from: string;
  to: string;
  weekdays?: number[];
  price?: string | null;
  discountPct?: string | null;
  stop?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  minNights?: number | null;
  maxNights?: number | null;
}

export function fetchAriGrid(hotelId: string, q: { from?: string; days?: number; adults?: number; marketGroupId?: string | null }) {
  return api.get<HotelAriGrid>('/hotels/ari/grid', { params: { hotelId, ...q, ...(q.marketGroupId ? {} : { marketGroupId: undefined }) } });
}

export function saveAriBulk(dto: HotelAriBulkPatch) {
  return api.post<{ updated: number; removed: number; dates: number; roomTypes: number }>('/hotels/ari/bulk', dto);
}

/* ---------- прайс сезона: PP периода → + разница категории → × коэффициент → ± рынок ---------- */

export interface HotelSeasonPrice {
  currency: string;
  referenceGroupId: string | null;
  marketGroupId: string | null;
  isReference: boolean;
  groups: Array<{ id: string; name: string; adjustmentPct: number; periodPP: Record<string, string> }>;
  periods: Array<{
    id: string; startDate: string; endDate: string; ppBase: number; budgetPP: number; minNights: number; releaseDays: number; isPeak: boolean;
    marketPP: number; marketPPManual: boolean;
  }>;
  overlaps: Array<[string, string]>;
  roomTypes: Array<{
    id: string; name: string; sizeM2: number | null; area: string | null; quantity: number; isBase: boolean; pricingMode: 'offset' | 'fixed_rate'; ppNetOffset: number;
    periods: Record<string, { pp: number; budget: number; margin: number | null; ownPP: boolean; dailyDays: number } | null>;
    rows: Array<{
      id: string; label: string; coefficient: number; peakCoefficient: number | null; adults: number | null; children: number;
      prices: Record<string, { price: number; coefficient: number; override: boolean } | null>;
    }>;
  }>;
}

export function fetchSeasonPrice(hotelId: string, marketGroupId?: string | null) {
  return api.get<HotelSeasonPrice>(`/hotels/${hotelId}/season-price`, { params: marketGroupId ? { marketGroupId } : {} });
}

export function setRoomTypePeriodPP(roomTypeId: string, periodId: string, pp: string | null) {
  return api.post<HotelRoomType>(`/hotels/room-types/${roomTypeId}/period-pp/${periodId}`, { pp });
}

export interface HotelPriceListPreview {
  sheet: string | null;
  sheets: string[];
  currency: string | null;
  hotelCurrency: string;
  currencyMismatch: boolean;
  periods: Array<{ startDate: string; endDate: string; ppBase: number; minNights: number | null; releaseDays: number | null; budgetPP: number | null; isPeak: boolean; exists: boolean }>;
  categories: Array<{
    name: string; area: string | null; sizeM2: number | null; isBase: boolean; offset: number; ownPeriods: number; pp: Array<number | null>; exists: boolean;
    rows: Array<{ label: string; coefficient: number; peakCoefficient: number | null; adults: number | null; children: number; infants: number; overrides: number; exists: boolean }>;
  }>;
  stalePeriods: Array<{ id: string; startDate: string; endDate: string }>;
  dailyDays: number;
  /** раннее бронирование из блока ERKEN REZERVASYON — станет акциями отеля */
  earlyBooking?: Array<{ roomType: string | null; roomTypeKnown: boolean; bookFrom: string | null; bookTo: string | null; stayFrom: string | null; stayTo: string | null; discountPct: number; prepaymentPct: number; prepaymentDueDate: string | null; listDate: string | null; exists: boolean }>;
  warnings: string[];
}

export interface HotelPriceListResult {
  periodsCreated: number; periodsUpdated: number; periodsRemoved: number; roomTypesCreated: string[]; roomTypesUpdated: number;
  rowsCreated: number; rowsUpdated: number; overrides: number; dailyCleared: number;
  promotionsCreated?: number; promotionsUpdated?: number; promotionsSkipped?: number;
}

export interface HotelMarketSheetPreview {
  sheet: string | null; sheets: string[]; currency: string | null; hotelCurrency: string; currencyMismatch: boolean; mode: 'dates' | 'order'; referenceGroupId: string | null;
  group: { id: string; name: string; importedSheet: string | null; importedAt: string | null } | null;
  periods: Array<{ id: string; startDate: string; endDate: string; basePP: number; sheet: { startDate: string; endDate: string; ppBase: number } | null }>;
  unusedSheetPeriods: Array<{ startDate: string; endDate: string }>;
  categories: Array<{ name: string; roomTypeId: string | null; isBase: boolean; sheetOffset: number; hotelOffset: number | null; ownPeriods: number }>;
  earlyBooking: Array<{ discountPct: number; bookFrom: string | null; bookTo: string | null }>;
  warnings: string[];
}
export interface HotelMarketSheetResult { groupId: string; groupName: string; periods: number; roomCells: number; mode: 'dates' | 'order'; promotionsCreated: number; promotionsUpdated: number }
export function previewMarketSheet(hotelId: string, file: File, sheet: string | null, groupId: string | null) {
  const f = new FormData();
  f.append('file', file);
  f.append('hotelId', hotelId);
  if (sheet) f.append('sheet', sheet);
  if (groupId) f.append('groupId', groupId);
  return api.postForm<HotelMarketSheetPreview>('/hotels/price-list-import/market/preview', f);
}
export function applyMarketSheet(hotelId: string, file: File, o: { sheet: string | null; groupId: string | null; newGroupName: string | null; fxRate: number | null; importPromotions: boolean }) {
  const f = new FormData();
  f.append('file', file);
  f.append('hotelId', hotelId);
  if (o.sheet) f.append('sheet', o.sheet);
  if (o.groupId) f.append('groupId', o.groupId);
  if (o.newGroupName) f.append('newGroupName', o.newGroupName);
  if (o.fxRate) f.append('fxRate', String(o.fxRate));
  f.append('importPromotions', String(o.importPromotions));
  return api.postForm<HotelMarketSheetResult>('/hotels/price-list-import/market/apply', f);
}

export function previewPriceListImport(hotelId: string, file: File, sheet?: string | null) {
  const form = new FormData();
  form.append('file', file);
  form.append('hotelId', hotelId);
  if (sheet) form.append('sheet', sheet);
  return api.postForm<HotelPriceListPreview>('/hotels/price-list-import/preview', form);
}

export function applyPriceListImport(hotelId: string, file: File, opts: { replacePeriods: boolean; clearDaily: boolean; sheet?: string | null; importPromotions?: boolean; promoMarketGroupIds?: string[] }) {
  const form = new FormData();
  form.append('file', file);
  form.append('hotelId', hotelId);
  if (opts.sheet) form.append('sheet', opts.sheet);
  form.append('replacePeriods', String(opts.replacePeriods));
  form.append('clearDaily', String(opts.clearDaily));
  form.append('importPromotions', String(opts.importPromotions !== false));
  if (opts.promoMarketGroupIds?.length) form.append('promoMarketGroupIds', opts.promoMarketGroupIds.join(','));
  return api.postForm<HotelPriceListResult>('/hotels/price-list-import/apply', form);
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

/** «Заполнить диапазон» — одни значения на все даты from..to (weekdays: 1=пн … 7=вс; пусто — все дни) */
export function bulkFillDailyRates(
  roomTypeId: string,
  dto: { marketGroupIds: string[]; from: string; to: string; weekdays?: number[]; budgetPP?: string; ppAvg?: string; grossPP?: string; discountPct?: string },
) {
  return api.post<{ updated: number }>(`/hotels/room-types/${roomTypeId}/daily-rates/bulk`, dto);
}

/* ---------- stop-sale (Цены и рынки — точечный стоп на дату) ---------- */

export function fetchStopSaleDates(roomTypeId: string, dates: string[]) {
  return api.get<string[]>(`/hotels/room-types/${roomTypeId}/stop-sale-dates`, {
    params: { dates: dates.join(',') },
  });
}

export function setStopSaleDate(roomTypeId: string, date: string, stopped: boolean) {
  return api.post<{ date: string; stopped: boolean }>(
    `/hotels/room-types/${roomTypeId}/stop-sale-dates/${date}`,
    { stopped },
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

/* ---------- partners / contracts / blocks / inventory ---------- */

export function fetchPartners() {
  return api.get<HotelPartnerWithStats[]>('/hotels/partners');
}
export function fetchPartner(id: string) {
  return api.get<HotelAgency>(`/hotels/partners/${id}`);
}
export function createPartner(dto: Partial<HotelAgency>) {
  return api.post<HotelAgency>('/hotels/partners', dto);
}
export function updatePartner(id: string, dto: Partial<HotelAgency>) {
  return api.patch<HotelAgency>(`/hotels/partners/${id}`, dto);
}
export function deletePartner(id: string) {
  return api.delete<{ ok: boolean; archived: boolean }>(`/hotels/partners/${id}`);
}
export function addTypicalPartners() {
  return api.post<HotelAgency[]>('/hotels/partners/typical');
}

export function fetchContracts(filters: { agencyId?: string; hotelId?: string } = {}) {
  return api.get<HotelContract[]>('/hotels/contracts', { params: filters });
}
export function fetchContract(id: string) {
  return api.get<HotelContract>(`/hotels/contracts/${id}`);
}
export function fetchContractUsage(id: string, from?: string, to?: string) {
  return api.get<HotelContractUsage>(`/hotels/contracts/${id}/usage`, { params: { from, to } });
}
export function createContract(dto: Partial<HotelContract>) {
  return api.post<HotelContract>('/hotels/contracts', dto);
}
export function updateContract(id: string, dto: Partial<HotelContract>) {
  return api.patch<HotelContract>(`/hotels/contracts/${id}`, dto);
}
export function duplicateContract(id: string) {
  return api.post<HotelContract>(`/hotels/contracts/${id}/duplicate`);
}
export function deleteContract(id: string) {
  return api.delete<{ ok: boolean; cancelled: boolean }>(`/hotels/contracts/${id}`);
}

export function fetchRoomBlocks(filters: { hotelId?: string; agencyId?: string } = {}) {
  return api.get<HotelRoomBlock[]>('/hotels/blocks', { params: filters });
}
export function createRoomBlock(dto: Partial<HotelRoomBlock>) {
  return api.post<HotelRoomBlock>('/hotels/blocks', dto);
}
export function updateRoomBlock(id: string, dto: Partial<HotelRoomBlock>) {
  return api.patch<HotelRoomBlock>(`/hotels/blocks/${id}`, dto);
}
export function deleteRoomBlock(id: string) {
  return api.delete<{ ok: boolean; cancelled: boolean }>(`/hotels/blocks/${id}`);
}

export function fetchHotelInventory(hotelId: string, from: string, to: string) {
  return api.get<HotelInventory>(`/hotels/inventory/${hotelId}`, { params: { from, to } });
}

export function fetchDemoReservationsCount() {
  return api.get<{ count: number }>('/hotels/demo-reservations');
}
export function generateDemoReservations(dto: { hotelIds?: string[]; count?: number }) {
  return api.post<{ created: number }>('/hotels/demo-reservations', dto);
}
export function clearDemoReservations() {
  return api.delete<{ deleted: number }>('/hotels/demo-reservations');
}

/* ---------- reservations ---------- */

export interface HotelReservationFilters {
  hotelId?: string;
  roomTypeId?: string;
  agencyId?: string;
  status?: string;
  market?: string;
  search?: string;
  contractId?: string;
  blockId?: string;
  guestCountry?: string;
  source?: string;
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

export function checkInReservation(id: string, roomUnitId?: string) {
  return api.post<HotelReservation>(`/hotels/reservations/${id}/check-in`, { roomUnitId });
}

export function checkOutReservation(id: string) {
  return api.post<HotelReservation>(`/hotels/reservations/${id}/check-out`, {});
}

export function addReservationPayment(id: string, dto: { date: string; amount: string; method: string; note?: string }) {
  return api.post<HotelReservation>(`/hotels/reservations/${id}/payments`, dto);
}

export function removeReservationPayment(id: string, paymentId: string) {
  return api.delete<HotelReservation>(`/hotels/reservations/${id}/payments/${paymentId}`);
}

export async function downloadReservationFolio(id: string, opts: { lang?: string; folio?: 'guest' | 'partner' } = {}): Promise<void> {
  const token = getAccessToken();
  const qs = new URLSearchParams({ ...(opts.lang ? { lang: opts.lang } : {}), ...(opts.folio ? { folio: opts.folio } : {}) }).toString();
  const res = await fetch(`${API_BASE}/hotels/reservations/${id}/folio.pdf${qs ? `?${qs}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Не удалось скачать счёт: ${res.status}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `folio-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function sendFolioEmail(id: string) {
  return api.post<{ ok: boolean }>(`/hotels/reservations/${id}/send-folio-email`, {});
}

export interface HotelReservationPriceLookup {
  pricePerNight: number | null;
  periodId: string | null;
  spansMultiplePeriods: boolean;
}

export function fetchReservationPrice(roomTypeId: string, occupancyTypeId: string, checkIn: string, checkOut: string) {
  return api.get<HotelReservationPriceLookup>(`/hotels/room-types/${roomTypeId}/reservation-price`, {
    params: { occupancyTypeId, checkIn, checkOut },
  });
}

/* ---------- front desk ---------- */

export interface HotelFrontDeskToday {
  date: string;
  arrivals: HotelReservation[];
  /** заехали в этот день (уже оформлены) — для прогресса */
  arrived: HotelReservation[];
  departures: HotelReservation[];
  departed: HotelReservation[];
  inHouse: HotelReservation[];
  /** выезд прошёл, гость всё ещё заселён */
  overdue: HotelReservation[];
  /** заезд прошёл, гость не заселён */
  noShowCandidates: HotelReservation[];
  optionsExpiring: HotelReservation[];
  inHouseCount: number;
  /** профили гостей броней дня: VIP, чёрный список, сколько раз жил, предпочтения */
  guestProfiles?: Record<string, HotelGuestBrief & { stays: number }>;
}

export interface HotelCancellationQuote {
  daysBefore: number;
  total: number;
  firstNight: number;
  contractId: string | null;
  contractName: string | null;
  rule: { daysBefore: number; penaltyType: 'percent' | 'nights'; value: number } | null;
  /** условия отмены по тарифу брони (если нет контракта) */
  ratePlan?: { id: string; code: string; name: string; refundable: boolean } | null;
  nonRefundable?: boolean;
  suggestedFee: number;
  paid: number;
  /** счёт, на который ложится проживание (и штраф) */
  accommodationFolio: 'guest' | 'partner';
  /** по счёту: оплачено, доп. услуги, можно вернуть при штрафе по умолчанию */
  folios: Record<'guest' | 'partner', { payments: number; extras: number; refundable: number }>;
}

export interface HotelCloseRefund { amount: string; method: string; folio: 'guest' | 'partner'; note?: string }

export function fetchCancellationQuote(id: string) {
  return api.get<HotelCancellationQuote>(`/hotels/reservations/${id}/cancellation-quote`);
}

export function cancelReservation(id: string, dto: { reason: string; note?: string; fee?: string | number | null; refund?: HotelCloseRefund }) {
  return api.post<HotelReservation>(`/hotels/reservations/${id}/cancel`, dto);
}

export function markNoShow(id: string, dto: { fee?: string | number | null; note?: string; refund?: HotelCloseRefund } = {}) {
  return api.post<HotelReservation>(`/hotels/reservations/${id}/no-show`, dto);
}

export function bulkNoShow(ids: string[], feeMode: 'none' | 'first_night') {
  return api.post<{ done: string[]; failed: Array<{ id: string; code: string; message: string }> }>('/hotels/frontdesk/no-show', { ids, feeMode });
}

export interface HotelWalkInInput {
  hotelId: string;
  roomUnitId: string;
  nights: number;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  pax?: number;
  children?: number;
  adults?: number;
  childAges?: Array<number | null>;
  grossPerNight?: string;
  boardType?: string | null;
  guestCountry?: string | null;
  notes?: string | null;
  payment?: { amount: string; method: string; note?: string } | null;
}

export function walkIn(dto: HotelWalkInInput) {
  return api.post<HotelReservation>('/hotels/frontdesk/walk-in', dto);
}

export interface HotelLifecycleBucket { reason: string; count: number; nights: number; amount: Record<string, number> }
export interface HotelLifecycleReport {
  from: string;
  to: string;
  complimentary: {
    byReason: HotelLifecycleBucket[];
    rows: Array<{ id: string; hotelId: string; guestName: string; checkIn: string; checkOut: string; nights: number; reason: HotelCompReason | null; note: string | null; value: number; currency: string; status: HotelReservationStatus }>;
  };
  cancellations: HotelLifecycleBucket[];
  noShow: HotelLifecycleBucket;
}

export function fetchLifecycleReport(params: { hotelIds?: string; dateFrom?: string; dateTo?: string }) {
  return api.get<HotelLifecycleReport>('/hotels/analytics/lifecycle', { params });
}

export function fetchFrontDeskToday(date?: string, hotelId?: string) {
  return api.get<HotelFrontDeskToday>('/hotels/frontdesk/today', { params: { date, hotelId } });
}

/* ---------- room rack (шахматка) ---------- */

export interface HotelRackReservation {
  id: string;
  hotelId: string;
  roomTypeId: string;
  roomUnitId: string | null;
  agencyId: string | null;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  guestCountry: string | null;
  pax: number;
  children: number;
  /** младенцы до 2 лет — нужна детская кроватка */
  infants?: number;
  checkIn: string;
  checkOut: string;
  status: HotelReservationStatus;
  paidStatus: HotelReservationPaidStatus;
  total: string;
  paidAmount: string;
  grossPerNight: string;
  boardType: string | null;
  bookingCode: string | null;
  source: string;
  blockId: string | null;
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  notes: string | null;
  guestsCount: number;
  optionUntil: string | null;
  isComplimentary: boolean;
  extrasTotal: string;
  cancellationFee: string;
}

export interface HotelRack {
  hotel: { id: string; name: string; currency: string; checkInTime: string; checkOutTime: string };
  from: string;
  to: string;
  days: number;
  roomTypes: Array<{ id: string; name: string; quantity: number; stopSale: boolean }>;
  units: Array<{ id: string; roomTypeId: string; label: string; housekeepingStatus: HotelRoomUnitHousekeepingStatus; note: string | null; active: boolean; floor: string | null; building: string | null; features: string[] }>;
  outages: Array<{ id: string; roomUnitId: string; kind: HotelOutageKind; dateFrom: string; dateTo: string | null; reason: string; note: string | null }>;
  agencies: Array<{ id: string; name: string }>;
  reservations: HotelRackReservation[];
}

export function fetchRack(hotelId: string, from: string, days: number) {
  return api.get<HotelRack>('/hotels/frontdesk/rack', { params: { hotelId, from, days } });
}

export interface HotelReservationMoveInput {
  roomUnitId?: string | null;
  checkIn?: string;
  checkOut?: string;
  reason?: string;
  swap?: boolean;
}

/** 409 HOTEL_MOVE_CONFLICT кладёт в ApiError.payload: { canSwap, conflicts[] } */
export interface HotelMoveConflict {
  canSwap: boolean;
  conflicts: Array<{ id: string; guestName: string; checkIn: string; checkOut: string; status: HotelReservationStatus }>;
}

export function moveReservation(id: string, dto: HotelReservationMoveInput) {
  return api.post<{ reservation: HotelReservation; swapped: { id: string; roomUnitId: string | null } | null }>(`/hotels/reservations/${id}/move`, dto);
}

export interface HotelReservationHistoryEntry {
  id: string;
  createdAt: string;
  action: 'create' | 'update' | 'delete';
  summary: string | null;
  changes: Array<{ field: string; oldValue: string | null; newValue: string | null }>;
  actorName: string | null;
}

export function fetchReservationHistory(id: string) {
  return api.get<HotelReservationHistoryEntry[]>(`/hotels/reservations/${id}/history`);
}

/* ---------- room units ---------- */

export function fetchRoomUnits(filters: { hotelId?: string; roomTypeId?: string } = {}) {
  return api.get<HotelRoomUnit[]>('/hotels/room-units', { params: filters });
}

export function createRoomUnit(dto: { roomTypeId: string; label: string; note?: string }) {
  return api.post<HotelRoomUnit>('/hotels/room-units', dto);
}

export function updateRoomUnit(id: string, dto: Partial<{ label: string; note: string | null; active: boolean }>) {
  return api.patch<HotelRoomUnit>(`/hotels/room-units/${id}`, dto);
}

export function updateRoomUnitHousekeeping(id: string, housekeepingStatus: HotelRoomUnitHousekeepingStatus) {
  return api.patch<HotelRoomUnit>(`/hotels/room-units/${id}/housekeeping`, { housekeepingStatus });
}

export function deleteRoomUnit(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/room-units/${id}`);
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

/* ---------- analytics ---------- */

export interface HotelAnalyticsFilters {
  hotelIds?: string;
  roomTypeId?: string;
  dateFrom?: string;
  dateTo?: string;
  marketId?: string;
  agencyId?: string;
  guestCountry?: string;
  saleCountry?: string;
  partnerCountry?: string;
  partnerType?: string;
}

export interface HotelAnalyticsKpis {
  occupancyNowPct: number;
  roomsAvailable: number;
  roomsTotal: number;
  revenueSold: number;
  roomsNeededPerDay: number;
  currency: string;
}

export interface PacingBucket {
  daysBeforeArrival: number;
  targetPct: number;
  actualPct: number;
  gapPct: number;
  roomsNeededPerDay: number | null;
}

export interface RevenueFunnel {
  planRevenue: number;
  actualRevenue: number;
  pendingRevenue: number;
  remainingRevenue: number;
  maxPossibleRevenue: number;
  currency: string;
}

export interface RoomTypeBreakdownRow {
  roomTypeId: string;
  name: string;
  qtyTotal: number;
  qtySold: number;
  occupancyPct: number;
  adr: number;
  avgGuestsPerBooking: number;
  revenue: number;
}

export interface MarketRevenueRow {
  market: string;
  revenueActual: number;
  revenueTarget: number | null;
  roomsSold: number;
}

export interface AgencyAnalyticsRow {
  agencyId: string | null;
  name: string;
  type: HotelPartnerType | null;
  country: string | null;
  bookingsCount: number;
  roomNights: number;
  revenue: number;
  net: number;
  commission: number;
  avgRate: number;
  adr: number;
  cancelPct: number;
  sharePct: number;
}

export interface CountryAnalyticsRow {
  country: string | null;
  bookings: number;
  cancelled: number;
  roomNights: number;
  guests: number;
  gross: number;
  net: number;
  commission: number;
  adr: number;
  avgStay: number;
  sharePct: number;
}

export interface GuestDemographics {
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  avgGuestsPerBooking: number;
  ageBuckets: Record<'0-2' | '3-6' | '7-11' | '12-17', number>;
  dataAvailable: boolean;
}

export interface HotelAnalyticsSummary {
  kpis: HotelAnalyticsKpis;
  pacing: { buckets: PacingBucket[] };
  funnel: RevenueFunnel;
  roomTypes: RoomTypeBreakdownRow[];
  markets: MarketRevenueRow[];
  agencies: AgencyAnalyticsRow[];
  guests: GuestDemographics;
  countries: { guest: CountryAnalyticsRow[]; sale: CountryAnalyticsRow[]; partner: CountryAnalyticsRow[] };
  partnerTypes: Array<{ type: string; bookings: number; gross: number; net: number; commission: number }>;
  totals: { bookings: number; cancelled: number; roomNights: number; gross: number; net: number; commission: number };
}

export interface ArrivalDayRow {
  date: string;
  occupancyPct: number;
  riskLevel: 'bad' | 'warn' | 'ok';
}

export interface PacingTargetRow {
  id: string;
  hotelId: string;
  daysBeforeArrival: number;
  targetPct: string;
}

export function fetchHotelAnalyticsSummary(filters: HotelAnalyticsFilters) {
  return api.get<HotelAnalyticsSummary>('/hotels/analytics', { params: filters });
}

export function fetchHotelAnalyticsArrivals(filters: HotelAnalyticsFilters) {
  return api.get<ArrivalDayRow[]>('/hotels/analytics/arrivals', { params: filters });
}

export function fetchPacingTargets(hotelId: string) {
  return api.get<PacingTargetRow[]>('/hotels/analytics/pacing-targets', { params: { hotelId } });
}

export function updatePacingTargets(hotelId: string, rows: Array<{ daysBeforeArrival: number; targetPct: number }>) {
  return api.patch<PacingTargetRow[]>(`/hotels/analytics/pacing-targets/${hotelId}`, rows);
}

/* ---------- hotel info fields (Информация об отеле — factsheet) ---------- */

export function updateHotelInfo(id: string, fields: Record<string, string | boolean>) {
  return api.patch<Hotel>(`/hotels/${id}/info`, fields);
}

/* ---------- cover photos ---------- */

export function uploadHotelCover(id: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return api.postForm<Hotel>(`/hotels/${id}/cover`, fd);
}

export function uploadRoomTypeCover(id: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return api.postForm<HotelRoomType>(`/hotels/room-types/${id}/cover`, fd);
}

/* ---------- gallery (категории + фото) ---------- */

export interface HotelGalleryCategory {
  id: string;
  tenantId: string;
  hotelId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface HotelPhoto {
  id: string;
  tenantId: string;
  hotelId: string;
  categoryId: string | null;
  roomTypeId: string | null;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export function fetchGalleryCategories(hotelId: string) {
  return api.get<HotelGalleryCategory[]>(`/hotels/${hotelId}/gallery/categories`);
}

export function createGalleryCategory(hotelId: string, name: string) {
  return api.post<HotelGalleryCategory>(`/hotels/${hotelId}/gallery/categories`, { name });
}

export function renameGalleryCategory(id: string, name: string) {
  return api.patch<HotelGalleryCategory>(`/hotels/gallery-categories/${id}`, { name });
}

export function removeGalleryCategory(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/gallery-categories/${id}`);
}

export function fetchGalleryPhotos(hotelId: string, opts: { categoryId?: string; roomTypeId?: string } = {}) {
  const params: Record<string, string> = {};
  if (opts.categoryId) params.categoryId = opts.categoryId;
  if (opts.roomTypeId) params.roomTypeId = opts.roomTypeId;
  return api.get<HotelPhoto[]>(`/hotels/${hotelId}/gallery/photos`, {
    params: Object.keys(params).length ? params : undefined,
  });
}

export function uploadGalleryPhoto(hotelId: string, file: File | Blob, opts: { categoryId?: string | null; roomTypeId?: string } = {}) {
  const fd = new FormData();
  fd.append('file', file, 'photo.jpg');
  const params = new URLSearchParams();
  if (opts.categoryId) params.set('categoryId', opts.categoryId);
  if (opts.roomTypeId) params.set('roomTypeId', opts.roomTypeId);
  const qs = params.toString();
  return api.postForm<HotelPhoto>(`/hotels/${hotelId}/gallery/photos/upload${qs ? `?${qs}` : ''}`, fd);
}

export function updateGalleryPhoto(id: string, dto: { categoryId?: string | null }) {
  return api.patch<HotelPhoto>(`/hotels/gallery-photos/${id}`, dto);
}

export function replaceGalleryPhoto(id: string, file: File | Blob) {
  const fd = new FormData();
  fd.append('file', file, 'photo.jpg');
  return api.postForm<HotelPhoto>(`/hotels/gallery-photos/${id}/replace`, fd);
}

export function removeGalleryPhoto(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/gallery-photos/${id}`);
}

/* ---------- factsheet items (рестораны/бары/бассейны/мини-клуб/услуги) ---------- */

export type HotelFactsheetItemKind = 'restaurant' | 'bar' | 'pool' | 'miniclub' | 'service';

export interface HotelFactsheetItem {
  id: string;
  tenantId: string;
  hotelId: string;
  kind: HotelFactsheetItemKind;
  name: string;
  description: string | null;
  hours: string | null;
  paid: boolean | null;
  extra: Record<string, string>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface HotelFactsheetItemInput {
  kind: HotelFactsheetItemKind;
  name: string;
  description?: string | null;
  hours?: string | null;
  paid?: boolean | null;
  extra?: Record<string, string>;
}

export function fetchFactsheetItems(hotelId: string, kind?: HotelFactsheetItemKind) {
  return api.get<HotelFactsheetItem[]>(`/hotels/${hotelId}/factsheet-items`, {
    params: kind ? { kind } : undefined,
  });
}

export function createFactsheetItem(hotelId: string, dto: HotelFactsheetItemInput) {
  return api.post<HotelFactsheetItem>(`/hotels/${hotelId}/factsheet-items`, dto);
}

export function updateFactsheetItem(id: string, dto: Partial<HotelFactsheetItemInput>) {
  return api.patch<HotelFactsheetItem>(`/hotels/factsheet-items/${id}`, dto);
}

export function removeFactsheetItem(id: string) {
  return api.delete<{ ok: boolean }>(`/hotels/factsheet-items/${id}`);
}

/* ---------- info import/export (Excel) ---------- */

export interface HotelInfoImportPreview {
  importId: string;
  infoFieldsCount: number;
  itemCounts: Record<string, number>;
  unmatchedLabels: string[];
  totalItems: number;
}

export function previewHotelInfoImport(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return api.postForm<HotelInfoImportPreview>('/hotels/info-import/preview', fd);
}

export function applyHotelInfoImport(dto: { importId: string; hotelId: string }) {
  return api.post<{ infoFieldsUpdated: number; itemsCreated: number }>('/hotels/info-import/apply', dto);
}

export async function exportHotelInfo(hotelId: string, hotelName: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/hotels/info-import/export/${hotelId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Не удалось экспортировать данные отеля: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `${hotelName || 'hotel'}-info.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/* ---------- settings: feed token + period price summary ---------- */

export function fetchFeedToken(hotelId: string) {
  return api.get<{ token: string }>(`/hotels/${hotelId}/feed-token`);
}

export function regenerateFeedToken(hotelId: string) {
  return api.post<{ token: string }>(`/hotels/${hotelId}/feed-token/regenerate`, {});
}

export interface HotelPeriodPriceSummaryRow {
  periodId: string;
  startDate: string;
  endDate: string;
  avgNetPP: number;
}

export function fetchPeriodPriceSummary(hotelId: string) {
  return api.get<{ currency: string; rows: HotelPeriodPriceSummaryRow[] }>(`/hotels/${hotelId}/pricing/period-summary`);
}

/* ---------- файлы с авторизацией ---------- */

/** Скачать файл с авторизацией (PDF, Excel) */
export async function downloadAuthed(path: string, fallbackName: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = (await res.json()).message || msg;
    } catch {
      /* не JSON */
    }
    throw new Error(msg);
  }
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = window.URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const qs = (o: Record<string, string | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');

/* ---------- журнал гостей (KBS / МВД) ---------- */

export type GuestIssue =
  | 'no_manifest' | 'missing_name' | 'missing_nationality' | 'missing_document' | 'missing_birthdate'
  | 'missing_gender' | 'missing_tckn' | 'invalid_tckn' | 'missing_parents' | 'document_expired'
  | 'missing_birthplace' | 'missing_issue_date' | 'missing_migration_card' | 'missing_entry_purpose';

export interface GuestRegisterRow {
  reservationId: string;
  guestId: string | null;
  hotelId: string;
  roomType: string | null;
  room: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string | null;
  documentType: string | null;
  documentNumber: string;
  documentExpiry: string | null;
  birthDate: string | null;
  gender: string | null;
  tcKimlikNo: string | null;
  fatherName: string | null;
  motherName: string | null;
  reportedAt: string | null;
  birthPlace: string | null;
  documentIssueDate: string | null;
  migrationCard: string | null;
  visaNumber: string | null;
  entryPurpose: string | null;
  deadline: string | null;
  issues: GuestIssue[];
}

export interface GuestRegister {
  date: string;
  mode: 'inhouse' | 'arrivals' | 'departures';
  regime: 'kbs' | 'mvd';
  rows: GuestRegisterRow[];
  summary: { guests: number; ready: number; withIssues: number; reported: number; foreigners: number; overdue: number };
}

export function fetchGuestRegister(q: { hotelId?: string; date?: string; mode?: string; regime?: string }) {
  return api.get<GuestRegister>('/hotels/guest-register', { params: q });
}
export function downloadGuestRegisterXlsx(q: { hotelId?: string; date?: string; mode?: string; regime?: string }) {
  return downloadAuthed(`/hotels/guest-register.xlsx?${qs(q)}`, 'kbs.xlsx');
}
export function markGuestsReported(items: Array<{ reservationId: string; guestId: string | null }>, reported = true) {
  return api.post<{ marked: number }>('/hotels/guest-register/mark', { items, reported });
}

/* ---------- выписка партнёру ---------- */

export interface PartnerStatement {
  partner: { id: string; name: string; legalName: string | null; email: string | null; currency: string | null; paymentTerms: string; paymentDays: number };
  from: string;
  to: string;
  basis: 'checkout' | 'arrival';
  currency: string | null;
  rows: Array<{
    reservationId: string;
    bookingCode: string | null;
    hotel: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    status: string;
    gross: number;
    commissionPct: number;
    commission: number;
    net: number;
  }>;
  totals: { bookings: number; roomNights: number; gross: number; commission: number; net: number };
}

export function fetchPartnerStatement(id: string, q: { from: string; to: string; basis: string }) {
  return api.get<PartnerStatement>(`/hotels/partners/${id}/statement`, { params: q });
}
export function downloadPartnerStatement(id: string, q: { from: string; to: string; basis: string }, format: 'pdf' | 'xlsx') {
  return downloadAuthed(`/hotels/partners/${id}/statement.${format}?${qs(q)}`, `statement.${format}`);
}
export function sendPartnerStatement(id: string, body: { from: string; to: string; basis: string; email?: string }) {
  return api.post<{ ok: boolean; to: string }>(`/hotels/partners/${id}/statement/send`, body);
}

/** Как hotelTaxes на сервере: налог на проживание входит в базу НДС; итог = база × (1+налог) × (1+НДС). */
export function hotelTaxes(amount: number, hotel: Pick<Hotel, 'accommodationTaxPct' | 'vatPct' | 'pricesIncludeTax'> | null | undefined) {
  const a = Math.max(0, Number(hotel?.accommodationTaxPct) || 0) / 100;
  const v = Math.max(0, Number(hotel?.vatPct) || 0) / 100;
  const base = hotel?.pricesIncludeTax === false ? amount : amount / ((1 + a) * (1 + v));
  const acc = base * a;
  const vat = (base + acc) * v;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { has: a > 0 || v > 0, base: r2(base), accommodationTax: r2(acc), vat: r2(vat), total: r2(base + acc + vat), accommodationTaxPct: a * 100, vatPct: v * 100, included: hotel?.pricesIncludeTax !== false };
}

/* ---------- housekeeping (уборка, неработающие номера, неисправности, находки) ---------- */

export const HOTEL_UNIT_FEATURES = ['connecting', 'accessible', 'smoking', 'non_smoking', 'pet_friendly', 'sea_view', 'balcony'] as const;
export type HotelOutageKind = 'ooo' | 'oos';
export const HOTEL_OUTAGE_REASONS = ['repair', 'renovation', 'deep_cleaning', 'pest_control', 'damage', 'staff_use', 'other'] as const;
export const HOTEL_ISSUE_CATEGORIES = ['ac', 'plumbing', 'electric', 'tv', 'safe', 'furniture', 'door_lock', 'minibar', 'other'] as const;
export const HOTEL_ISSUE_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const HOTEL_LOST_CATEGORIES = ['documents', 'electronics', 'jewelry', 'clothing', 'money', 'bag', 'other'] as const;
export type HotelHkTaskKind = 'departure' | 'stayover' | 'arrival' | 'vacant_dirty';
export type HotelHkTaskStatus = 'pending' | 'in_progress' | 'done' | 'inspected' | 'skipped';
export type HotelRoomState = 'vacant_clean' | 'vacant_dirty' | 'inspected' | 'occupied_clean' | 'occupied_dirty' | 'out_of_order' | 'out_of_service';

export interface HotelStaffMember { id: string; name: string }

export interface HotelHkTask {
  id: string;
  hotelId: string;
  date: string;
  roomUnitId: string;
  kind: HotelHkTaskKind;
  priority: number;
  credits: number;
  reservationId: string | null;
  assigneeUserId: string | null;
  status: HotelHkTaskStatus;
  note: string | null;
  startedAt: string | null;
  doneAt: string | null;
  inspectedAt: string | null;
  unit: { id: string; label: string; floor: string | null; building: string | null; roomTypeName: string; housekeepingStatus: HotelRoomUnitHousekeepingStatus; state?: HotelRoomState } | null;
  guestName: string | null;
  pax?: number | null;
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  nextArrival?: { guestName: string; earlyCheckIn: boolean } | null;
  /** сколько детских кроваток поставить (младенцы заезжающей/живущей брони) */
  babyCots?: number;
  departed: boolean | null;
  hotelName?: string;
}

export interface HotelHkPlan {
  date: string;
  editable: boolean;
  tasks: HotelHkTask[];
  staff: HotelStaffMember[];
  load: Array<{ userId: string; tasks: number; credits: number; done: number }>;
  roomStates: Partial<Record<HotelRoomState, number>>;
  summary: { total: number; done: number; inspected: number; unassigned: number; credits: number };
}

export interface HotelRoomOutage {
  id: string;
  hotelId: string;
  roomUnitId: string;
  kind: HotelOutageKind;
  dateFrom: string;
  dateTo: string | null;
  reason: string;
  note: string | null;
  issueId: string | null;
  createdAt: string;
}

export interface HotelOutageConflict { id: string; guestName: string; checkIn: string; checkOut: string; status: HotelReservationStatus }

export interface HotelMaintenanceIssue {
  id: string;
  hotelId: string;
  roomUnitId: string | null;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  description: string;
  photoUrls: string[];
  reportedBy: string | null;
  assigneeUserId: string | null;
  outageId: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  repeated?: boolean;
}

export interface HotelLostItem {
  id: string;
  hotelId: string;
  roomUnitId: string | null;
  reservationId: string | null;
  guestName: string | null;
  category: string;
  description: string;
  foundPlace: string | null;
  foundAt: string;
  foundBy: string | null;
  storageLocation: string | null;
  photoUrls: string[];
  status: 'stored' | 'returned' | 'disposed' | 'handed_over';
  returnedTo: string | null;
  closedAt: string | null;
  notifiedAt: string | null;
  note: string | null;
}

export type HotelUnitFull = HotelRoomUnit & { floor: string | null; building: string | null; features: string[] };

const HK = '/hotels/housekeeping';
export const fetchHkStaff = () => api.get<HotelStaffMember[]>(`${HK}/staff`);
export const fetchHkPlan = (hotelId: string, date: string) => api.get<HotelHkPlan>(`${HK}/plan`, { params: { hotelId, date } });
export const autoAssignHk = (dto: { hotelId: string; date: string; userIds: string[]; mode?: 'unassigned' | 'all' }) => api.post<{ assigned: number }>(`${HK}/plan/auto-assign`, dto);
export const fetchMyHkTasks = (date?: string) => api.get<{ date: string; tasks: HotelHkTask[] }>(`${HK}/my`, { params: { date } });
export const assignHkTask = (id: string, userId: string | null) => api.patch<HotelHkTask>(`${HK}/tasks/${id}/assign`, { userId });
export const hkTaskAction = (id: string, action: 'start' | 'done' | 'skip' | 'reopen' | 'inspect', note?: string) => api.post<HotelHkTask>(`${HK}/tasks/${id}/${action}`, { note });
export const fetchHkUnits = (hotelId: string) => api.get<{ units: HotelUnitFull[]; roomTypes: Array<{ id: string; name: string }> }>(`${HK}/units`, { params: { hotelId } });
export const updateHkUnit = (id: string, dto: { floor?: string | null; building?: string | null; features?: string[]; note?: string | null }) => api.patch<HotelUnitFull>(`${HK}/units/${id}`, dto);
export const floorsFromLabels = (hotelId: string, overwrite = false) => api.post<{ changed: number }>(`${HK}/units/floors-from-labels`, { hotelId, overwrite });
export const fetchOutages = (hotelId: string, includeEnded = false) => api.get<HotelRoomOutage[]>(`${HK}/outages`, { params: { hotelId, includeEnded: includeEnded ? '1' : undefined } });
export const createOutage = (dto: { roomUnitId: string; kind: HotelOutageKind; dateFrom: string; dateTo: string | null; reason: string; note?: string }) => api.post<{ outage: HotelRoomOutage; conflicts: HotelOutageConflict[] }>(`${HK}/outages`, dto);
export const updateOutage = (id: string, dto: Partial<HotelRoomOutage>) => api.patch<{ outage: HotelRoomOutage; conflicts: HotelOutageConflict[] }>(`${HK}/outages/${id}`, dto);
export const endOutage = (id: string) => api.post<{ outage?: HotelRoomOutage; removed?: boolean }>(`${HK}/outages/${id}/end`, {});
export const deleteOutage = (id: string) => api.delete<{ ok: boolean }>(`${HK}/outages/${id}`);
export const fetchIssues = (hotelId: string, status?: string) => api.get<HotelMaintenanceIssue[]>(`${HK}/issues`, { params: { hotelId, status } });
export const createIssue = (dto: { hotelId: string; roomUnitId?: string | null; category: string; priority: string; description: string; photoUrls?: string[]; makeOoo?: boolean; assigneeUserId?: string | null }) =>
  api.post<{ issue: HotelMaintenanceIssue; conflicts: HotelOutageConflict[] }>(`${HK}/issues`, dto);
export const updateIssue = (id: string, dto: Partial<HotelMaintenanceIssue>) => api.patch<HotelMaintenanceIssue>(`${HK}/issues/${id}`, dto);
export const fetchLostFound = (hotelId: string, status?: string, search?: string) => api.get<HotelLostItem[]>(`${HK}/lost-found`, { params: { hotelId, status, search } });
export const createLostItem = (dto: Partial<HotelLostItem> & { hotelId: string }) => api.post<HotelLostItem>(`${HK}/lost-found`, dto);
export const updateLostItem = (id: string, dto: Partial<HotelLostItem>) => api.patch<HotelLostItem>(`${HK}/lost-found/${id}`, dto);
export const notifyLostItem = (id: string) => api.post<HotelLostItem>(`${HK}/lost-found/${id}/notify`, {});
export const deleteLostItem = (id: string) => api.delete<{ ok: boolean }>(`${HK}/lost-found/${id}`);
export function uploadHkPhoto(file: Blob) {
  const form = new FormData();
  form.append('file', file, (file as File).name || 'photo.jpg');
  return api.postForm<{ url: string }>(`${HK}/photos`, form);
}

/* ---------- фолио, касса, ночной аудит, отчёты ---------- */

export type HotelFolioKind = 'guest' | 'partner';
export const HOTEL_FOLIO_LINE_KINDS = ['extra', 'board', 'minibar', 'early_checkin', 'late_checkout', 'fee', 'discount', 'adjustment'] as const;
export const HOTEL_EXTRA_CATEGORIES = ['fnb', 'minibar', 'spa', 'transfer', 'excursion', 'laundry', 'room', 'other'] as const;

export interface HotelFolioLine {
  id: string;
  reservationId: string;
  folio: HotelFolioKind;
  serviceDate: string;
  kind: string;
  extraServiceId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  voidOfId: string | null;
  voided: boolean;
  reason: string | null;
  createdAt: string;
}

export interface HotelFolioSummary {
  currency: string;
  accommodation: number;
  accommodationFolio: HotelFolioKind;
  taxes: { base: number; accommodationTax: number; vat: number; accommodationTaxPct: number; vatPct: number; pricesIncludeTax: boolean };
  folios: Record<HotelFolioKind, { charges: number; extras: number; payments: number; balance: number }>;
  extrasTotal: number;
  paymentsTotal: number;
  balance: number;
}

export interface HotelFolio {
  lines: HotelFolioLine[];
  summary: HotelFolioSummary;
  businessDate: string;
  lastAuditDate: string | null;
  payments: Array<HotelReservationPayment & { folio?: HotelFolioKind; shiftId?: string | null }>;
}

export const fetchFolio = (id: string) => api.get<HotelFolio>(`/hotels/reservations/${id}/folio`);
export const postFolioLine = (id: string, dto: { folio: HotelFolioKind; serviceDate?: string; kind: string; extraServiceId?: string | null; description?: string; quantity?: string; unitPrice?: string }) =>
  api.post<HotelFolioLine>(`/hotels/reservations/${id}/folio/lines`, dto);
export const voidFolioLine = (id: string, lineId: string, reason: string) => api.post<HotelFolioLine>(`/hotels/reservations/${id}/folio/lines/${lineId}/void`, { reason });
export const setFolioRouting = (id: string, accommodationFolio: HotelFolioKind) => api.patch<HotelReservation>(`/hotels/reservations/${id}/folio-routing`, { accommodationFolio });
export const addFolioPayment = (id: string, dto: { date?: string; amount: string; method: string; note?: string; folio?: HotelFolioKind; refund?: boolean }) =>
  api.post<HotelReservation>(`/hotels/reservations/${id}/payments`, dto);

export interface HotelExtraService { id: string; hotelId: string; name: string; category: string; price: string; active: boolean; sortOrder: number; sellOnline?: boolean; description?: string | null; priceMode?: 'per_stay' | 'per_night' | 'per_person'; outletId?: string | null; aiIncluded?: boolean }
export interface HotelCashShift {
  id: string; hotelId: string; status: 'open' | 'closed'; openedBy: string | null; openedAt: string; openingCash: string;
  closedBy: string | null; closedAt: string | null; countedCash: string | null; expectedCash: string | null; difference: string | null; totals: Record<string, number> | null; note: string | null;
}
export interface HotelShiftPayment { reservationId: string; guestName: string; bookingCode: string | null; id: string; date: string; amount: number; method: string; note: string | null; createdAt?: string }

const CASH = '/hotels/cashier';
export const fetchCashierSettings = (hotelId: string) => api.get<{ earlyCheckInFeePct: string; lateCheckOutFeePct: string; currency: string; businessDate: string; lastAuditDate: string | null }>(`${CASH}/settings`, { params: { hotelId } });
export const saveCashierSettings = (dto: { hotelId: string; earlyCheckInFeePct?: string; lateCheckOutFeePct?: string }) => api.patch<{ earlyCheckInFeePct: string; lateCheckOutFeePct: string }>(`${CASH}/settings`, dto);
export const fetchExtras = (hotelId: string, all = false) => api.get<HotelExtraService[]>(`${CASH}/extras`, { params: { hotelId, all: all ? '1' : undefined } });
export const createExtra = (dto: Partial<HotelExtraService> & { hotelId: string }) => api.post<HotelExtraService>(`${CASH}/extras`, dto);
export const updateExtra = (id: string, dto: Partial<HotelExtraService>) => api.patch<HotelExtraService>(`${CASH}/extras/${id}`, dto);
export const deleteExtra = (id: string) => api.delete<{ ok: boolean }>(`${CASH}/extras/${id}`);
export const fetchCurrentShift = (hotelId: string) => api.get<{ shift: HotelCashShift | null; payments: HotelShiftPayment[]; totals: Record<string, number>; expectedCash: number | null }>(`${CASH}/shift`, { params: { hotelId } });
export const openShift = (hotelId: string, openingCash: string) => api.post<HotelCashShift>(`${CASH}/shift/open`, { hotelId, openingCash });
export const closeShift = (hotelId: string, countedCash: string, note?: string) => api.post<HotelCashShift>(`${CASH}/shift/close`, { hotelId, countedCash, note });
export const fetchShifts = (hotelId: string) => api.get<HotelCashShift[]>(`${CASH}/shifts`, { params: { hotelId } });
export const fetchShiftDetail = (id: string) => api.get<{ shift: HotelCashShift; payments: HotelShiftPayment[]; totals: Record<string, number> }>(`${CASH}/shifts/${id}`);

export interface HotelAuditSnapshot {
  available: number; sold: number; comp: number; occupancyPct: number; roomRevenue: number; adr: number; revpar: number;
  extrasRevenue: number; feesRevenue: number; totalRevenue: number; arrivals: number; departures: number; noShows: number; cancellations: number;
  inHouseGuests: number; payments: Record<string, number>; paymentsTotal: number; openBalance: number; outOfOrder: number;
  byRoomType: Array<{ roomTypeId: string; name: string; available: number; sold: number; revenue: number }>; currency: string;
}
export interface HotelAuditBrief { id: string; guestName: string; checkIn: string; checkOut: string; status: HotelReservationStatus; roomUnitId: string | null; bookingCode: string | null; balance?: number }
export interface HotelNightAuditStatus {
  auditDate: string;
  today: string;
  canRun: boolean;
  lastAuditDate: string | null;
  checks: { pendingArrivals: HotelAuditBrief[]; pendingDepartures: HotelAuditBrief[]; unpaidDepartures: HotelAuditBrief[]; openShift: { id: string; openedAt: string } | null };
  history: Array<{ id: string; businessDate: string; mode: 'manual' | 'auto'; completedAt: string; snapshot: HotelAuditSnapshot; reportSentAt: string | null; checks: Record<string, any> }>;
  settings: { nightAuditAuto: boolean; nightAuditTime: string; timezone: string; nightAuditEmails: string; currency: string };
}
const NA = '/hotels/night-audit';
export const fetchNightAuditStatus = (hotelId: string) => api.get<HotelNightAuditStatus>(`${NA}/status`, { params: { hotelId } });
export const runNightAudit = (dto: { hotelId: string; autoNoShow?: boolean; noShowFee?: 'none' | 'first_night'; ignoreDepartures?: boolean; ignoreOpenShift?: boolean }) => api.post<{ id: string; businessDate: string }>(`${NA}/run`, dto);
export const saveNightAuditSettings = (dto: { hotelId: string; nightAuditAuto?: boolean; nightAuditTime?: string; timezone?: string; nightAuditEmails?: string }) => api.patch<HotelNightAuditStatus>(`${NA}/settings`, dto);
export const sendNightAuditReport = (id: string) => api.post<{ sent: boolean; reason?: string }>(`${NA}/audits/${id}/send`, {});

export interface HotelPerfRow { period: string; available: number; sold: number; comp: number; revenue: number; occupancyPct: number; adr: number; revpar: number }
export interface HotelPerformanceReport { hotel: { id: string; name: string; currency: string }; from: string; to: string; groupBy: 'day' | 'month'; rows: HotelPerfRow[]; byRoomType: Array<HotelPerfRow & { roomTypeId: string; name: string }>; total: HotelPerfRow }
export interface HotelForecastRow { period: string; available: number; otbRooms: number; otbRevenue: number; stlyRooms: number; stlyRevenue: number; lyRooms: number; lyRevenue: number; otbOccPct: number; stlyOccPct: number }
export interface HotelForecastReport { hotel: { id: string; name: string; currency: string }; today: string; to: string; horizon: number; groupBy: 'day' | 'month'; rows: HotelForecastRow[]; total: Record<string, number> }
export interface HotelPickupRow { period: string; otb: number; pickup1: number; pickup7: number; pickup30: number; new30: number; cancelled30: number }
export interface HotelPickupReport { hotel: { id: string; name: string }; today: string; to: string; horizon: number; groupBy: 'day' | 'month'; rows: HotelPickupRow[]; total: Omit<HotelPickupRow, 'period'> }
export const fetchPerformance = (q: { hotelId: string; from: string; to: string; groupBy: 'day' | 'month'; roomTypeId?: string }) => api.get<HotelPerformanceReport>('/hotels/reports/performance', { params: q });
export const fetchForecast = (hotelId: string, horizon: number) => api.get<HotelForecastReport>('/hotels/reports/forecast', { params: { hotelId, horizon } });
export const fetchPickup = (hotelId: string, horizon: number) => api.get<HotelPickupReport>('/hotels/reports/pickup', { params: { hotelId, horizon } });

/* ---------- единый расчёт цены ---------- */

export type HotelRateSource = 'block' | 'contract' | 'calendar' | 'season' | 'market' | 'base' | 'channel';
export interface HotelNightlyRate { date: string; price: number; source: HotelRateSource; discountPct?: number; rmPct?: number; pp?: number; childAmount?: number; boardAmount?: number; promoAmount?: number; promoPct?: number }
export interface HotelQuote {
  nights: HotelNightlyRate[];
  total: number;
  average: number;
  seasonAverage: number;
  ppAverage?: number;
  occupancyTypeId: string | null;
  guests?: { adults: number; children: number; grown: number; infants?: number; childMaxAge: number } | null;
  childLines?: Array<{ childNo: number; age: number | null; share: number; reason: 'rule' | 'no_rule' | 'no_age' | 'infant' }>;
  childPolicySource?: 'contract' | 'hotel' | null;
  marketId: string | null;
  marketGroupId: string | null;
  marketGroupGuessed: boolean;
  priority: 'season' | 'market';
  ratePlan?: { id: string; code: string; name: string; boardType: string; refundable: boolean } | null;
  prepayment?: { amount: number; dueDate: string | null } | null;
  promotions?: HotelAppliedPromotion[];
  promoDiscount?: number;
  totalBeforePromo?: number;
  currency: string;
  warnings: Array<{ code: 'no_price' | 'blocked' | 'group_fallback' | 'no_occupancy' | 'min_stay' | 'max_stay' | 'closed_arrival' | 'closed_departure' | 'release' | 'below_budget'; dates: string[]; value?: number }>;
}
export const fetchQuote = ({ childAges, ...q }: { roomTypeId: string; occupancyTypeId?: string; ratePlanId?: string; checkIn: string; checkOut: string; marketId?: string; market?: string; guestCountry?: string; contractId?: string; blockId?: string; adults?: number; childAges?: Array<number | null>; promotions?: 'auto' | 'none'; salesChannel?: 'direct' | 'website'; bookedAt?: string }) =>
  api.get<HotelQuote>('/hotels/reservations/quote', { params: { ...q, ...(childAges?.length ? { childAges: childAges.map((a) => (a === null ? '-' : String(a))).join(',') } : {}) } });
export const autoMapMarketGroups = (hotelId: string) => api.post<{ mapped: number; unmapped: number }>(`/hotels/${hotelId}/markets/auto-groups`, {});


/* ---------- живые обновления PMS (Server-Sent Events) и блокировки редактирования ---------- */

export type HotelLiveEntity = 'reservation' | 'unit' | 'housekeeping' | 'outage' | 'request';
export interface HotelEditLock { reservationId: string; userId: string; userName: string; expiresAt: number }
export type HotelLiveEvent =
  | { type: 'changed'; entity: HotelLiveEntity; id: string; hotelId: string | null; action: 'insert' | 'update' | 'remove' }
  | { type: 'locks'; locks: HotelEditLock[] }
  | { type: 'ping' };

export const issueLiveTicket = () => api.post<{ ticket: string; expiresInSec: number }>('/hotels/live/ticket', {});
export const acquireReservationLock = (reservationId: string) =>
  api.post<{ ok: boolean; lock: HotelEditLock }>(`/hotels/live/locks/${reservationId}`, {});
export const releaseReservationLock = (reservationId: string) => api.delete<{ ok: boolean }>(`/hotels/live/locks/${reservationId}`);

/* ---------- менеджер каналов (Channex → Booking.com, Expedia, Airbnb…) ---------- */

export interface HotelChannelMapping {
  id?: string;
  roomTypeId: string;
  occupancyTypeId: string | null;
  marketGroupId: string | null;
  externalRoomTypeId: string;
  externalRatePlanId: string | null;
  externalName?: string | null;
  active: boolean;
  /** режим тарифа в канале (читается при сохранении сопоставления) */
  ratePlanMeta?: HotelChannelRatePlanMeta | null;
  /** наш тариф для цены этого тарифа канала */
  ratePlanId?: string | null;
}
export interface HotelChannelConnection {
  id: string;
  hotelId: string;
  provider: 'channex';
  environment: 'production' | 'staging' | 'test';
  status: 'active' | 'paused' | 'error';
  apiKeyMasked: string | null;
  externalPropertyId: string | null;
  externalPropertyName: string | null;
  settings: { pushDays?: number; reserveRooms?: number };
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
  /** полная выгрузка — раз в сутки ночью; изменения — после правок и раз в 5 минут */
  lastFullSyncAt: string | null;
  lastDeltaAt: string | null;
  /** пауза обмена после ошибки канала (1, 2, 4… до 15 минут) */
  pausedUntil: string | null;
  failCount: number;
  webhookActive: boolean;
  mappings: HotelChannelMapping[];
}
export interface HotelChannelRatePlanMeta { sellMode: 'per_room' | 'per_person'; rateMode: 'manual' | 'derived' | 'auto' | 'cascade'; occupancies: number[] }
export interface HotelChannelRemote {
  properties: Array<{ id: string; title: string; currency: string | null }>;
  roomTypes: Array<{ id: string; title: string; rooms: number | null }>;
  ratePlans: Array<{ id: string; title: string; roomTypeId: string | null; currency: string | null } & HotelChannelRatePlanMeta>;
}
export interface HotelChannelWarning { externalId: string | null; from: string | null; to: string | null; message: string }
export interface HotelChannelLogRow {
  id: string;
  kind: 'push' | 'pull' | 'booking' | 'test';
  ok: boolean;
  message: string;
  createdAt: string;
  details?: { taskIds?: string[]; warnings?: HotelChannelWarning[]; pauseMinutes?: number; mode?: string } | null;
}
export interface HotelChannelSyncResult { mode: 'delta' | 'full'; availability: number; rates: number; calls: number; taskIds: string[]; warnings: HotelChannelWarning[]; deferred: Array<'availability' | 'rates'> }
export interface HotelChannelState {
  availability: { values: number; lastSentAt: string | null; until: string | null };
  rates: { values: number; lastSentAt: string | null; until: string | null };
  lastFullSyncAt: string | null;
  lastDeltaAt: string | null;
}

export const fetchChannels = (hotelId?: string) => api.get<HotelChannelConnection[]>('/hotels/channels', { params: hotelId ? { hotelId } : {} });
export const connectChannel = (dto: { hotelId: string; provider: 'channex'; apiKey?: string; environment: string; externalPropertyId?: string }) =>
  api.post<{ connection: HotelChannelConnection; properties: HotelChannelRemote['properties'] }>('/hotels/channels', dto);
export const updateChannel = (id: string, dto: { status?: 'active' | 'paused'; settings?: HotelChannelConnection['settings']; externalPropertyId?: string }) =>
  api.patch<HotelChannelConnection>(`/hotels/channels/${id}`, dto);
export const deleteChannel = (id: string) => api.delete<{ ok: boolean }>(`/hotels/channels/${id}`);
export const fetchChannelRemote = (id: string) => api.get<HotelChannelRemote>(`/hotels/channels/${id}/remote`);
export const saveChannelMappings = (id: string, mappings: HotelChannelMapping[]) => api.put<HotelChannelMapping[]>(`/hotels/channels/${id}/mappings`, { mappings });
export const pushChannel = (id: string, full = false) => api.post<HotelChannelSyncResult>(`/hotels/channels/${id}/push${full ? '?full=1' : ''}`, {});
export const fetchChannelState = (id: string) => api.get<HotelChannelState>(`/hotels/channels/${id}/state`);
export const toggleChannelWebhook = (id: string, enabled: boolean) => api.post<HotelChannelConnection>(`/hotels/channels/${id}/webhook`, { enabled });
export const pullChannel = (id: string) => api.post<{ revisions: number; created: number; modified: number; cancelled: number; failed: number }>(`/hotels/channels/${id}/pull`, {});
export const fetchChannelLogs = (id: string) => api.get<HotelChannelLogRow[]>(`/hotels/channels/${id}/logs`);

/* ---------- Guest Care: заявки гостей (QR в номере, WhatsApp, со слов гостя) ---------- */

export type HotelGuestRequestCategory = 'towels' | 'cleaning' | 'amenities' | 'minibar' | 'maintenance' | 'noise' | 'other' | 'message';
export type HotelGuestRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';
export interface HotelGuestRequest {
  id: string;
  hotelId: string;
  roomUnitId: string | null;
  reservationId: string | null;
  number: number;
  source: 'qr' | 'whatsapp' | 'staff';
  category: HotelGuestRequestCategory;
  subcategory: string | null;
  text: string | null;
  guestName: string | null;
  lang: string | null;
  status: HotelGuestRequestStatus;
  assigneeUserId: string | null;
  maintenanceIssueId: string | null;
  staffNote: string | null;
  startedAt: string | null;
  doneAt: string | null;
  createdAt: string;
  room: string | null;
}
export const HOTEL_GUEST_HK_CATEGORIES: HotelGuestRequestCategory[] = ['towels', 'cleaning', 'amenities', 'minibar'];
export const fetchGuestRequests = (q: { hotelId?: string; status?: string; days?: number }) =>
  api.get<{ requests: HotelGuestRequest[]; staff: Array<{ id: string; name: string }> }>('/hotels/guest-care', { params: q });
export const fetchMyGuestRequests = () => api.get<HotelGuestRequest[]>('/hotels/guest-care/my');
export const createGuestRequest = (dto: { hotelId: string; roomUnitId?: string | null; category: HotelGuestRequestCategory; subcategory?: string; text?: string }) =>
  api.post<HotelGuestRequest>('/hotels/guest-care', dto);
export const updateGuestRequest = (id: string, dto: { status?: HotelGuestRequestStatus; assigneeUserId?: string | null; staffNote?: string | null }) =>
  api.patch<HotelGuestRequest>(`/hotels/guest-care/${id}`, dto);
export const fetchGuestQrLinks = (hotelId: string) => api.get<Array<{ roomUnitId: string; label: string; floor: string | null; token: string }>>(`/hotels/guest-care/qr/${hotelId}`);
export const rotateGuestQr = (roomUnitId: string) => api.post<{ roomUnitId: string; token: string }>(`/hotels/guest-care/qr/rotate/${roomUnitId}`, {});
