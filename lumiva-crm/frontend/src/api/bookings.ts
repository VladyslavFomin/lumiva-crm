// src/api/bookings.ts
import { api } from './client';

export type BookingBusinessType = 'salon' | 'restaurant' | 'fitness' | 'consultation' | 'rental';
export type BookingConfirmationMode = 'auto' | 'manual' | 'conditional';

export interface BookingProject {
  id: string;
  tenantId: string;
  name: string;
  businessType: BookingBusinessType;
  timezone: string;
  currency: string;
  confirmationMode: BookingConfirmationMode;
  status: string;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  cancellationDeadlineHours: number;
  rescheduleDeadlineHours: number;
  overbookingAllowed: boolean;
  notificationChannels: Record<string, { crm: boolean; email: boolean; telegram: boolean }>;
  createdAt: string;
  updatedAt: string;
}

export interface BookingWorkingHoursPeriod {
  start: string;
  end: string;
}
export type BookingWeeklyHours = Record<string, BookingWorkingHoursPeriod[]>;

export interface BookingLocationClosure {
  date: string;
  reason: string | null;
  customHours?: BookingWorkingHoursPeriod[];
}

export interface BookingLocation {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  address: string | null;
  timezone: string | null;
  phone: string | null;
  email: string | null;
  workingHours: BookingWeeklyHours | null;
  closures: BookingLocationClosure[];
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingServiceItem {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  category: string | null;
  color: string | null;
  durationMinutes: number;
  price: string;
  currency: string;
  capacityMin: number;
  capacityMax: number;
  locationIds: string[];
  staffUserIds: string[];
  resourceTypeRequired: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number | null;
  autoConfirm: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookingResourceItem {
  id: string;
  tenantId: string;
  projectId: string;
  locationId: string;
  name: string;
  type: string;
  quantity: number;
  capacity: number | null;
  assignedServiceIds: string[];
  weeklyAvailability: BookingWeeklyHours | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookingStaffTimeOff {
  from: string;
  to: string;
  reason: string | null;
}

export interface BookingStaffProfile {
  id: string;
  tenantId: string;
  staffUserId: string;
  availableForBooking: boolean;
  assignedLocationIds: string[];
  assignedServiceIds: string[];
  weeklyAvailability: BookingWeeklyHours | null;
  timeOff: BookingStaffTimeOff[];
  maxSimultaneousBookings: number;
  calendarColor: string | null;
  createdAt: string;
  updatedAt: string;
  staffUser?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl: string | null;
  } | null;
}

export type ReservationStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_business'
  | 'rejected'
  | 'no_show';

export type ReservationConfirmationStatus = 'not_required' | 'pending' | 'confirmed' | 'rejected';
export type ReservationPaymentStatus =
  | 'not_required'
  | 'unpaid'
  | 'deposit_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed';
export type ReservationSource = 'website' | 'phone' | 'walkin' | 'manual' | 'api' | 'import' | 'telegram';

export interface Reservation {
  id: string;
  tenantId: string;
  projectId: string;
  locationId: string;
  serviceId: string | null;
  staffUserId: string | null;
  resourceId: string | null;
  leadId: string | null;
  contactId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  startAt: string;
  endAt: string;
  participants: number;
  status: ReservationStatus;
  confirmationStatus: ReservationConfirmationStatus;
  paymentStatus: ReservationPaymentStatus;
  price: string | null;
  currency: string | null;
  source: ReservationSource;
  assignedUserId: string | null;
  customFields: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationActivity {
  id: string;
  tenantId: string;
  reservationId: string;
  userId: string | null;
  type: string;
  description: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  user?: { id: string; fullName: string } | null;
}

export interface ReservationListFilters {
  status?: string;
  locationId?: string;
  serviceId?: string;
  staffUserId?: string;
  assignedUserId?: string;
  source?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface CustomerStats {
  visits: number;
  cancellations: number;
  noShows: number;
  ltv: number;
  lastVisit: string | null;
  tags: string[];
}

export interface CreateReservationInput {
  locationId: string;
  serviceId?: string;
  staffUserId?: string;
  resourceId?: string;
  startAt: string;
  endAt: string;
  participants?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  source?: ReservationSource;
  price?: string;
  currency?: string;
  customFields?: Record<string, any>;
}

export interface StaffGridSlot {
  hour: number;
  busy: boolean;
  reservationId?: string;
  customerName?: string | null;
  serviceName?: string | null;
  price?: string | null;
}
export interface StaffGridRow {
  staffUserId: string;
  name: string;
  slots: StaffGridSlot[];
}

export interface SlotInspectResult {
  ok: boolean;
  reason?: string;
}

/* ---------- project settings ---------- */

export const fetchBookingProject = () => api.get<BookingProject>('/bookings/project');
export const updateBookingProject = (dto: Partial<BookingProject>) =>
  api.patch<BookingProject>('/bookings/project', dto);

/* ---------- locations ---------- */

export const fetchBookingLocations = () => api.get<BookingLocation[]>('/bookings/locations');
export const createBookingLocation = (dto: Partial<BookingLocation>) =>
  api.post<BookingLocation>('/bookings/locations', dto);
export const updateBookingLocation = (id: string, dto: Partial<BookingLocation>) =>
  api.patch<BookingLocation>(`/bookings/locations/${id}`, dto);
export const deleteBookingLocation = (id: string) => api.delete<void>(`/bookings/locations/${id}`);

export const addLocationClosure = (locationId: string, dto: { date: string; reason?: string }) =>
  api.post<BookingLocation>(`/bookings/locations/${locationId}/closures`, dto);
export const removeLocationClosure = (locationId: string, index: number) =>
  api.delete<BookingLocation>(`/bookings/locations/${locationId}/closures/${index}`);

/* ---------- services ---------- */

export const fetchBookingServices = () => api.get<BookingServiceItem[]>('/bookings/services');
export const createBookingService = (dto: Partial<BookingServiceItem>) =>
  api.post<BookingServiceItem>('/bookings/services', dto);
export const updateBookingService = (id: string, dto: Partial<BookingServiceItem>) =>
  api.patch<BookingServiceItem>(`/bookings/services/${id}`, dto);
export const deleteBookingService = (id: string) => api.delete<void>(`/bookings/services/${id}`);

/* ---------- resources ---------- */

export const fetchBookingResources = () => api.get<BookingResourceItem[]>('/bookings/resources');
export const createBookingResource = (dto: Partial<BookingResourceItem>) =>
  api.post<BookingResourceItem>('/bookings/resources', dto);
export const updateBookingResource = (id: string, dto: Partial<BookingResourceItem>) =>
  api.patch<BookingResourceItem>(`/bookings/resources/${id}`, dto);
export const deleteBookingResource = (id: string) => api.delete<void>(`/bookings/resources/${id}`);

/* ---------- staff ---------- */

export const fetchBookingStaff = () => api.get<BookingStaffProfile[]>('/bookings/staff');
export const updateBookingStaffProfile = (staffUserId: string, dto: Partial<BookingStaffProfile>) =>
  api.patch<BookingStaffProfile>(`/bookings/staff/${staffUserId}`, dto);

/* ---------- availability ---------- */

export const fetchStaffGrid = (date: string, locationId?: string) =>
  api.get<StaffGridRow[]>('/bookings/availability/staff-grid', {
    params: { date, locationId },
  });

export const inspectBookingSlot = (dto: {
  staffUserId?: string;
  resourceId?: string;
  startAt: string;
  endAt: string;
}) => api.post<SlotInspectResult>('/bookings/availability/inspect', dto);

export const addStaffTimeOff = (staffUserId: string, dto: BookingStaffTimeOff) =>
  api.post<BookingStaffProfile>(`/bookings/availability/staff/${staffUserId}/time-off`, dto);

export const removeStaffTimeOff = (staffUserId: string, index: number) =>
  api.delete<BookingStaffProfile>(`/bookings/availability/staff/${staffUserId}/time-off/${index}`);

/* ---------- reservations ---------- */

export const fetchReservations = (filters: ReservationListFilters = {}) =>
  api.get<Reservation[]>('/bookings/reservations', { params: filters as any });

export const fetchReservation = (id: string) => api.get<Reservation>(`/bookings/reservations/${id}`);

export const fetchReservationActivity = (id: string) =>
  api.get<ReservationActivity[]>(`/bookings/reservations/${id}/activity`);

export const fetchReservationsByLead = (leadId: string) =>
  api.get<Reservation[]>(`/bookings/reservations/by-lead/${leadId}`);

export const fetchUpcomingReservationsByLead = () =>
  api.get<Record<string, Reservation>>('/bookings/reservations/upcoming-by-lead');

export const fetchCustomerStats = (contactId: string) =>
  api.get<CustomerStats>(`/bookings/reservations/customer-stats/${contactId}`);

export const createReservation = (dto: CreateReservationInput) =>
  api.post<Reservation>('/bookings/reservations', dto);

export const updateReservation = (id: string, dto: Partial<Reservation>) =>
  api.patch<Reservation>(`/bookings/reservations/${id}`, dto);

export const confirmReservation = (id: string) => api.post<Reservation>(`/bookings/reservations/${id}/confirm`);
export const cancelReservation = (id: string) => api.post<Reservation>(`/bookings/reservations/${id}/cancel`);
export const rejectReservation = (id: string) => api.post<Reservation>(`/bookings/reservations/${id}/reject`);
export const checkInReservation = (id: string) => api.post<Reservation>(`/bookings/reservations/${id}/check-in`);
export const completeReservation = (id: string) => api.post<Reservation>(`/bookings/reservations/${id}/complete`);
export const markReservationNoShow = (id: string) =>
  api.post<Reservation>(`/bookings/reservations/${id}/no-show`);

/* ---------- waitlist ---------- */

export type WaitlistPriority = 'normal' | 'high' | 'vip';
export type WaitlistStatus = 'waiting' | 'offer' | 'confirmed' | 'expired' | 'removed';

export interface BookingWaitlistEntry {
  id: string;
  tenantId: string;
  projectId: string;
  locationId: string | null;
  serviceId: string | null;
  preferredStaffUserId: string | null;
  leadId: string | null;
  contactId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  preferredWindow: string | null;
  participants: number;
  priority: WaitlistPriority;
  status: WaitlistStatus;
  offeredStartAt: string | null;
  offeredEndAt: string | null;
  convertedReservationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const fetchWaitlist = (status?: string) =>
  api.get<BookingWaitlistEntry[]>('/bookings/waitlist', { params: status ? { status } : undefined });

export const createWaitlistEntry = (dto: {
  locationId?: string;
  serviceId?: string;
  preferredStaffUserId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  preferredWindow?: string;
  participants?: number;
  priority?: WaitlistPriority;
}) => api.post<BookingWaitlistEntry>('/bookings/waitlist', dto);

export const updateWaitlistPriority = (id: string, priority: WaitlistPriority) =>
  api.patch<BookingWaitlistEntry>(`/bookings/waitlist/${id}/priority`, { priority });

export const offerWaitlistSlot = (id: string, dto: { startAt: string; endAt: string }) =>
  api.post<BookingWaitlistEntry>(`/bookings/waitlist/${id}/offer`, dto);

export const convertWaitlistEntry = (id: string) =>
  api.post<Reservation>(`/bookings/waitlist/${id}/convert`);

export const removeWaitlistEntry = (id: string) => api.delete<BookingWaitlistEntry>(`/bookings/waitlist/${id}`);

export const WAITLIST_STATUS_LABELS_RU: Record<WaitlistStatus, string> = {
  waiting: 'Ждёт',
  offer: 'Предложен слот',
  confirmed: 'Подтверждён',
  expired: 'Истёк',
  removed: 'Удалён',
};

/* ---------- analytics ---------- */

export interface BookingAnalyticsSummary {
  totalReservations: number;
  completed: number;
  cancelled: number;
  noShow: number;
  noShowRate: number;
  totalRevenue: number;
  avgCheck: number;
  occupancyRate: number;
}
export interface DailyTrendPoint { day: string; count: number }
export interface HeatmapPoint { dow: number; hour: number; count: number }
export interface TopServiceRow { serviceId: string; name: string; count: number; revenue: number }
export interface StaffUtilizationRow { staffUserId: string; name: string; count: number; revenue: number }
export interface SourceBreakdownRow { source: string; count: number }
export interface AtRiskCustomerRow {
  contactId: string;
  customerName: string | null;
  lastVisit: string;
  visits: number;
  ltv: number;
}

export const fetchBookingAnalyticsSummary = (from?: string, to?: string) =>
  api.get<BookingAnalyticsSummary>('/bookings/analytics/summary', { params: { from, to } });
export const fetchBookingDailyTrend = (from?: string, to?: string) =>
  api.get<DailyTrendPoint[]>('/bookings/analytics/daily-trend', { params: { from, to } });
export const fetchBookingHeatmap = (from?: string, to?: string) =>
  api.get<HeatmapPoint[]>('/bookings/analytics/heatmap', { params: { from, to } });
export const fetchBookingTopServices = (from?: string, to?: string) =>
  api.get<TopServiceRow[]>('/bookings/analytics/top-services', { params: { from, to } });
export const fetchBookingStaffUtilization = (from?: string, to?: string) =>
  api.get<StaffUtilizationRow[]>('/bookings/analytics/staff-utilization', { params: { from, to } });
export const fetchBookingSources = (from?: string, to?: string) =>
  api.get<SourceBreakdownRow[]>('/bookings/analytics/sources', { params: { from, to } });
export const fetchAtRiskCustomers = (days = 60) =>
  api.get<AtRiskCustomerRow[]>('/bookings/analytics/at-risk-customers', { params: { days } });

export interface LocationStatsRow {
  id: string;
  name: string;
  address: string | null;
  status: string;
  staffCount: number;
  resourceCount: number;
  todayReservations: number;
  todayRevenue: number;
  occupancy: number;
}
export const fetchLocationStats = () => api.get<LocationStatsRow[]>('/bookings/analytics/locations');

export interface ResourceStatsRow {
  id: string;
  utilizationToday: number;
  nextReservation: { startAt: string; customerName: string | null } | null;
}
export const fetchResourceStats = () => api.get<ResourceStatsRow[]>('/bookings/analytics/resources');

/* ---------- reassign ---------- */

export const reassignStaffBookings = (dto: {
  fromStaffUserId: string;
  toStaffUserId: string | null;
  fromDate: string;
  toDate: string;
}) => api.post<{ reassignedCount: number; skippedCount: number }>('/bookings/availability/reassign', dto);

/* ---------- logs ---------- */

export interface BookingLogEntry {
  id: string;
  tenantId: string;
  reservationId: string;
  userId: string | null;
  type: string;
  description: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  user?: { id: string; fullName: string } | null;
  reservation?: { id: string; customerName: string | null } | null;
}

export const fetchBookingLogs = (limit = 100) =>
  api.get<BookingLogEntry[]>('/bookings/logs', { params: { limit } });

/* ------------------------------------------------------------------ import */

export interface ReservationImportPreview {
  importId: string;
  columns: string[];
  sample: Array<Record<string, unknown>>;
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
  mappableFields: Array<{ key: string; label: string }>;
  unmatchedColumns: string[];
}

export async function previewReservationsImport(file: File): Promise<ReservationImportPreview> {
  const form = new FormData();
  form.append('file', file);
  return api.postForm<ReservationImportPreview>('/bookings/import/preview', form);
}

export interface ReservationImportResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}

export const applyReservationsImport = (dto: {
  importId: string;
  mapping: Record<string, string | null>;
  defaultLocationId?: string;
}) => api.post<ReservationImportResult>('/bookings/import/apply', dto);

export const RESERVATION_STATUS_LABELS_RU: Record<ReservationStatus, string> = {
  draft: 'Черновик',
  pending: 'Ожидает',
  confirmed: 'Подтв.',
  checked_in: 'На месте',
  in_progress: 'В процессе',
  completed: 'Завершена',
  cancelled_by_customer: 'Отменена клиентом',
  cancelled_by_business: 'Отменена',
  rejected: 'Отклонена',
  no_show: 'Неявка',
};
