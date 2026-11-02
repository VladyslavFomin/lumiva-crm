// src/api/bookingVerticals.ts — интерфейсы под тип бизнеса: ресторан, фитнес, консультации, аренда, счета
import { api } from './client';
import type { BookingResourceItem, Reservation } from './bookings';

const qs = (o: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

/* ---------- настройки вертикали ---------- */

export interface BookingVerticalSettings {
  turnMinutes: number;
  serviceChargePercent: number;
  autoReleaseMinutes: number;
  passChargeOn: 'booking' | 'attendance';
  noShowChargesVisit: boolean;
  lateCancelHours: number;
  defaultClassCapacity: number;
  defaultMeetingFormat: 'offline' | 'online' | 'phone';
  meetingUrlTemplate: string;
  followUpDays: number;
  rentalUnit: 'hour' | 'day';
  lateFeePercent: number;
  requireDeposit: boolean;
}
export const fetchVerticalSettings = () => api.get<BookingVerticalSettings>('/bookings/vertical/settings');
export const updateVerticalSettings = (dto: Partial<BookingVerticalSettings>) =>
  api.patch<BookingVerticalSettings>('/bookings/vertical/settings', dto);
export const fetchVerticalOverview = (locationId?: string) => api.get<any>(`/bookings/vertical/overview${qs({ locationId })}`);

/* ---------- счета ---------- */

export type BookingOrderStatus = 'open' | 'billed' | 'paid' | 'cancelled';
export type BookingOrderKind = 'table' | 'reservation' | 'pass' | 'rental' | 'walkin';
export type BookingPaymentMethod = 'cash' | 'card' | 'online' | 'transfer' | 'mixed';
export type BookingOrderItemKind = 'menu' | 'service' | 'pass' | 'rental' | 'deposit' | 'fee' | 'custom';
export type BookingOrderItemStatus = 'new' | 'cooking' | 'served' | 'void';

export interface BookingOrderItem {
  id: string;
  orderId: string;
  kind: BookingOrderItemKind;
  refId: string | null;
  name: string;
  unitPrice: string;
  qty: string;
  status: BookingOrderItemStatus;
  course: number | null;
  note: string | null;
  createdAt: string;
}

export interface BookingOrder {
  id: string;
  number: number;
  kind: BookingOrderKind;
  status: BookingOrderStatus;
  locationId: string | null;
  reservationId: string | null;
  resourceId: string | null;
  passId: string | null;
  contactId: string | null;
  leadId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  guests: number;
  staffUserId: string | null;
  currency: string;
  subtotal: string;
  discountPercent: string;
  discountAmount: string;
  serviceChargePercent: string;
  serviceChargeAmount: string;
  tipAmount: string;
  total: string;
  paidAmount: string;
  paymentMethod: BookingPaymentMethod | null;
  saleId: string | null;
  paymentUrl: string | null;
  notes: string | null;
  billedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: BookingOrderItem[];
  itemsCount?: number;
}

export const fetchOrders = (f: { status?: string; kind?: string; from?: string; to?: string; search?: string; reservationId?: string; resourceId?: string } = {}) =>
  api.get<BookingOrder[]>(`/bookings/orders${qs(f)}`);
export const fetchOrder = (id: string) => api.get<BookingOrder>(`/bookings/orders/${id}`);
export const fetchOrdersSummary = (from?: string, to?: string) =>
  api.get<Array<{ status: string; currency: string; count: number; total: number; tips: number; guests: number }>>(`/bookings/orders/summary${qs({ from, to })}`);
export const fetchTopMenu = (days = 30) =>
  api.get<Array<{ refId: string; name: string; qty: number; revenue: number; currency: string }>>(`/bookings/orders/top-menu${qs({ days })}`);
export const createOrder = (dto: Partial<BookingOrder> & { prefillFromReservation?: boolean }) => api.post<BookingOrder>('/bookings/orders', dto);
export const updateOrder = (id: string, dto: Partial<BookingOrder>) => api.patch<BookingOrder>(`/bookings/orders/${id}`, dto);
export const addOrderItem = (id: string, dto: { kind: BookingOrderItemKind; refId?: string; name?: string; unitPrice?: number | string; qty?: number; note?: string; course?: number | null }) =>
  api.post<BookingOrder>(`/bookings/orders/${id}/items`, dto);
export const updateOrderItem = (id: string, itemId: string, dto: Partial<{ qty: number | string; note: string | null; status: BookingOrderItemStatus; course: number | null; unitPrice: number | string }>) =>
  api.patch<BookingOrder>(`/bookings/orders/${id}/items/${itemId}`, dto);
export const removeOrderItem = (id: string, itemId: string) => api.delete<BookingOrder>(`/bookings/orders/${id}/items/${itemId}`);
export const billOrder = (id: string) => api.post<BookingOrder>(`/bookings/orders/${id}/bill`);
export const reopenOrder = (id: string) => api.post<BookingOrder>(`/bookings/orders/${id}/reopen`);
export const payOrder = (id: string, dto: { method: BookingPaymentMethod; amount?: number | string; tipAmount?: number | string }) =>
  api.post<BookingOrder>(`/bookings/orders/${id}/pay`, dto);
export const createOrderPaymentLink = (id: string, dto: { buyerName?: string; buyerEmail?: string; buyerPhone?: string; city?: string; address?: string }) =>
  api.post<BookingOrder>(`/bookings/orders/${id}/payment-link`, dto);
export const cancelOrder = (id: string) => api.post<BookingOrder>(`/bookings/orders/${id}/cancel`);

/* ---------- ресторан ---------- */

export interface BookingZoneDecor {
  id: string;
  kind: 'wall' | 'bar' | 'entrance' | 'window' | 'kitchen' | 'plant' | 'stage' | 'label';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  label?: string | null;
}
export interface BookingZone {
  id: string;
  locationId: string;
  name: string;
  color: string | null;
  width: number;
  height: number;
  decor: BookingZoneDecor[];
  sortOrder: number;
  active: boolean;
  tables: BookingResourceItem[];
}
export type FloorTableState = 'free' | 'soon' | 'reserved' | 'seated' | 'billed' | 'inactive';
export interface FloorTable {
  tableId: string;
  state: FloorTableState;
  current: Reservation | null;
  next: Reservation | null;
  order: { id: string; number: number; status: BookingOrderStatus; total: string; currency: string; guests: number; createdAt: string } | null;
  reservationsToday: number;
  timeline: Array<{ id: string; startAt: string; endAt: string; status: string; customerName: string | null; participants: number }>;
}
export interface FloorState {
  at: string;
  date: string;
  zones: BookingZone[];
  tables: FloorTable[];
  unseated: Reservation[];
  stats: { tables: number; free: number; occupied: number; reserved: number; guestsNow: number; seatsTotal: number; reservationsToday: number; guestsToday: number };
}
export interface LayoutTableInput {
  id?: string;
  name: string;
  shape: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation?: number;
  capacity: number;
  minCapacity?: number | null;
  active?: boolean;
}

export const fetchZones = (locationId?: string) => api.get<BookingZone[]>(`/bookings/restaurant/zones${qs({ locationId })}`);
export const createZone = (dto: Partial<BookingZone>) => api.post<BookingZone>('/bookings/restaurant/zones', dto);
export const updateZone = (id: string, dto: Partial<BookingZone>) => api.patch<BookingZone>(`/bookings/restaurant/zones/${id}`, dto);
export const deleteZone = (id: string) => api.delete<{ ok: boolean }>(`/bookings/restaurant/zones/${id}`);
export const saveZoneLayout = (id: string, dto: { tables: LayoutTableInput[]; decor: BookingZoneDecor[]; removedTableIds: string[]; width?: number; height?: number }) =>
  api.put<BookingZone>(`/bookings/restaurant/zones/${id}/layout`, dto);
export const fetchFloor = (locationId: string, at?: string) => api.get<FloorState>(`/bookings/restaurant/floor${qs({ locationId, at })}`);
export const suggestTables = (locationId: string, startAt: string, endAt: string, guests: number) =>
  api.get<Array<{ id: string; name: string; capacity: number | null; zoneName: string | null; shape: string | null }>>(
    `/bookings/restaurant/suggest-tables${qs({ locationId, startAt, endAt, guests })}`,
  );
export const seatTable = (tableId: string, dto: { reservationId?: string; guests?: number; customerName?: string; customerPhone?: string; durationMinutes?: number }) =>
  api.post<{ reservation: Reservation; order: BookingOrder }>(`/bookings/restaurant/tables/${tableId}/seat`, dto);
export const releaseTable = (tableId: string) => api.post<{ released: number }>(`/bookings/restaurant/tables/${tableId}/release`);
export const moveTable = (tableId: string, toTableId: string) => api.post<{ moved: number }>(`/bookings/restaurant/tables/${tableId}/move`, { toTableId });

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}
export interface MenuItem {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  portion: string | null;
  tags: string[];
  imageUrl: string | null;
  prepMinutes: number | null;
  available: boolean;
  active: boolean;
  sortOrder: number;
}
export const fetchMenu = () => api.get<{ categories: MenuCategory[]; items: MenuItem[] }>('/bookings/restaurant/menu');
export const createMenuCategory = (dto: { name: string }) => api.post<MenuCategory>('/bookings/restaurant/menu/categories', dto);
export const updateMenuCategory = (id: string, dto: Partial<MenuCategory>) => api.patch<MenuCategory>(`/bookings/restaurant/menu/categories/${id}`, dto);
export const reorderMenuCategories = (ids: string[]) => api.put<{ categories: MenuCategory[]; items: MenuItem[] }>('/bookings/restaurant/menu/categories/order', { ids });
export const deleteMenuCategory = (id: string) => api.delete<{ ok: boolean }>(`/bookings/restaurant/menu/categories/${id}`);
export const createMenuItem = (dto: Partial<MenuItem>) => api.post<MenuItem>('/bookings/restaurant/menu/items', dto);
export const updateMenuItem = (id: string, dto: Partial<MenuItem>) => api.patch<MenuItem>(`/bookings/restaurant/menu/items/${id}`, dto);
export const setMenuItemAvailability = (id: string, available: boolean) =>
  api.patch<MenuItem>(`/bookings/restaurant/menu/items/${id}/availability`, { available });
export const deleteMenuItem = (id: string) => api.delete<{ ok: boolean }>(`/bookings/restaurant/menu/items/${id}`);

/* ---------- групповые занятия ---------- */

export interface ClassSession {
  id: string;
  serviceId: string;
  locationId: string;
  staffUserId: string | null;
  resourceId: string | null;
  startAt: string;
  endAt: string;
  capacity: number;
  price: string | null;
  status: 'scheduled' | 'cancelled' | 'completed';
  seriesId: string | null;
  level: string | null;
  notes: string | null;
  booked: number;
  attended: number;
  noShow: number;
  waitlist: number;
  spotsLeft: number;
}
export interface ClassRosterBooking extends Reservation {
  pass: { id: string; number: number; planName: string; kind: string; visitsTotal: number | null; visitsUsed: number; expiresAt: string } | null;
}
export interface ClassRoster {
  session: ClassSession;
  bookings: ClassRosterBooking[];
  waitlist: Array<{ id: string; customerName: string | null; customerPhone: string | null; participants: number; priority: string; createdAt: string; status: string }>;
}
export interface SessionInput {
  serviceId: string;
  locationId: string;
  staffUserId?: string | null;
  resourceId?: string | null;
  startAt?: string;
  durationMinutes?: number;
  capacity?: number;
  price?: string | number | null;
  level?: string | null;
  notes?: string | null;
}
export const fetchClassSessions = (f: { from?: string; to?: string; locationId?: string; serviceId?: string; staffUserId?: string; includeCancelled?: boolean }) =>
  api.get<ClassSession[]>(`/bookings/classes${qs({ ...f, includeCancelled: f.includeCancelled ? '1' : undefined })}`);
export const fetchClassStats = () => api.get<any>('/bookings/classes/stats');
export const fetchClassRoster = (id: string) => api.get<ClassRoster>(`/bookings/classes/${id}/roster`);
export const createClassSession = (dto: SessionInput) => api.post<ClassSession>('/bookings/classes', dto);
export const createClassSeries = (dto: SessionInput & { days: string[]; time: string; fromDate: string; weeks: number }) =>
  api.post<{ seriesId: string; created: number; skipped: Array<{ date: string; reason: string }> }>('/bookings/classes/series', dto);
export const updateClassSession = (id: string, dto: Partial<SessionInput> & { scope?: 'one' | 'future' }) =>
  api.patch<{ updated: number; errors: string[]; session: ClassSession }>(`/bookings/classes/${id}`, dto);
export const cancelClassSession = (id: string, scope: 'one' | 'future' = 'one') =>
  api.post<{ cancelledSessions: number; cancelledBookings: number }>(`/bookings/classes/${id}/cancel`, { scope });
export const completeClassSession = (id: string) => api.post<{ attended: number; noShow: number }>(`/bookings/classes/${id}/complete`);
export const enrollClass = (id: string, dto: { customerName?: string; customerPhone?: string; customerEmail?: string; participants?: number; passId?: string | null; usePass?: boolean; waitlistIfFull?: boolean }) =>
  api.post<{ waitlisted: boolean; reservation?: Reservation; entry?: any }>(`/bookings/classes/${id}/enroll`, dto);
export const cancelEnrollment = (reservationId: string, byCustomer = true) =>
  api.post<{ promoted: Reservation | null }>(`/bookings/classes/enrollments/${reservationId}/cancel`, { byCustomer });
export const markEnrollment = (reservationId: string, mark: 'attended' | 'no_show' | 'reset') =>
  api.post<Reservation>(`/bookings/classes/enrollments/${reservationId}/mark`, { mark });
export const removeClassWaitlist = (entryId: string) => api.post<any>(`/bookings/classes/waitlist/${entryId}/remove`);

/* ---------- абонементы / пакеты ---------- */

export interface PassPlan {
  id: string;
  name: string;
  description: string | null;
  kind: 'visits' | 'unlimited';
  visits: number | null;
  validityDays: number;
  price: string;
  currency: string;
  serviceIds: string[];
  freezeDaysAllowed: number;
  color: string | null;
  active: boolean;
}
export type PassStatus = 'active' | 'frozen' | 'expired' | 'used_up' | 'cancelled';
export interface ClientPass {
  id: string;
  planId: string;
  number: number;
  contactId: string | null;
  leadId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  planName: string;
  kind: 'visits' | 'unlimited';
  visitsTotal: number | null;
  visitsUsed: number;
  serviceIds: string[];
  startsAt: string;
  expiresAt: string;
  status: PassStatus;
  frozenFrom: string | null;
  freezeDaysUsed: number;
  freezeDaysAllowed: number;
  price: string;
  currency: string;
  orderId: string | null;
  notes: string | null;
  createdAt: string;
  remaining: number | null;
  paymentStatus?: BookingOrderStatus | null;
  usage?: Reservation[];
  order?: BookingOrder | null;
}
export const fetchPassPlans = () => api.get<PassPlan[]>('/bookings/passes/plans');
export const createPassPlan = (dto: Partial<PassPlan>) => api.post<PassPlan>('/bookings/passes/plans', dto);
export const updatePassPlan = (id: string, dto: Partial<PassPlan>) => api.patch<PassPlan>(`/bookings/passes/plans/${id}`, dto);
export const deletePassPlan = (id: string) => api.delete<{ archived?: boolean; deleted?: boolean }>(`/bookings/passes/plans/${id}`);
export const fetchPasses = (f: { status?: string; search?: string; contactId?: string; planId?: string } = {}) => api.get<ClientPass[]>(`/bookings/passes${qs(f)}`);
export const fetchPass = (id: string) => api.get<ClientPass>(`/bookings/passes/${id}`);
export const fetchPassStats = () => api.get<{ active: number; frozen: number; expiringSoon: number; lowVisits: number; unpaid: number }>('/bookings/passes/stats');
export const fetchUsablePasses = (contactId: string, serviceId?: string) => api.get<ClientPass[]>(`/bookings/passes/usable${qs({ contactId, serviceId })}`);
export const sellPass = (dto: { planId: string; customerName?: string; customerPhone?: string; customerEmail?: string; startsAt?: string; paymentMethod?: BookingPaymentMethod | null; price?: number | string; notes?: string }) =>
  api.post<ClientPass>('/bookings/passes', dto);
export const freezePass = (id: string, from?: string) => api.post<ClientPass>(`/bookings/passes/${id}/freeze`, { from });
export const unfreezePass = (id: string) => api.post<ClientPass>(`/bookings/passes/${id}/unfreeze`);
export const adjustPass = (id: string, dto: { visitsDelta?: number; extendDays?: number; notes?: string }) => api.post<ClientPass>(`/bookings/passes/${id}/adjust`, dto);
export const cancelPass = (id: string) => api.post<ClientPass>(`/bookings/passes/${id}/cancel`);

/* ---------- аренда ---------- */

export interface RentalQuote {
  hours: number;
  days: number;
  mode: 'hour' | 'day';
  label: string;
  unitTotal: number;
  total: number;
  deposit: number;
  currency: string;
  available: boolean;
  reason: string | null;
  freeUnits: number;
  quantity: number;
}
export interface RentalDeskRow extends Reservation {
  lateEstimate?: { periods: number; fee: number; label: string };
}
export interface RentalDesk {
  date: string;
  pickups: RentalDeskRow[];
  returns: RentalDeskRow[];
  overdue: RentalDeskRow[];
  outNow: number;
  unitsOut: number;
  depositsHeld: number;
  currency: string;
  resources: Array<{ id: string; name: string; type: string }>;
}
export interface RentalTimeline {
  from: string;
  days: string[];
  resources: Array<{
    id: string;
    name: string;
    type: string;
    quantity: number;
    pricePerHour: string | null;
    pricePerDay: string | null;
    depositAmount: string | null;
    cells: Array<{ date: string; used: number; reservations: Array<{ id: string; customerName: string | null; units: number; startAt: string; endAt: string; status: string; issuedAt: string | null }> }>;
  }>;
}
export const fetchRentalDesk = (date?: string) => api.get<RentalDesk>(`/bookings/rental/desk${qs({ date })}`);
export const fetchRentalTimeline = (f: { from?: string; days?: number; locationId?: string }) => api.get<RentalTimeline>(`/bookings/rental/timeline${qs(f)}`);
export const quoteRental = (dto: { resourceId: string; startAt: string; endAt: string; units?: number; excludeReservationId?: string }) =>
  api.post<RentalQuote>('/bookings/rental/quote', dto);
export const createRental = (dto: { resourceId: string; locationId?: string; startAt: string; endAt: string; units?: number; customerName?: string; customerPhone?: string; customerEmail?: string; notes?: string }) =>
  api.post<Reservation>('/bookings/rental/rentals', dto);
export const issueRental = (id: string, dto: { conditionOut?: string; depositCollected?: boolean; depositAmount?: number | string }) =>
  api.post<Reservation>(`/bookings/rental/rentals/${id}/issue`, dto);
export const returnRental = (id: string, dto: { conditionIn?: string; damageFee?: number | string; damageNote?: string; deposit?: 'return' | 'withhold' | 'partial'; withheldAmount?: number | string; waiveLateFee?: boolean }) =>
  api.post<{ reservation: Reservation; lateFee: number; damage: number }>(`/bookings/rental/rentals/${id}/return`, dto);
export const extendRental = (id: string, endAt: string) => api.post<Reservation>(`/bookings/rental/rentals/${id}/extend`, { endAt });

/* ---------- консультации ---------- */

export const setReservationMeeting = (id: string, dto: { format: 'offline' | 'online' | 'phone'; url?: string | null; regenerate?: boolean }) =>
  api.post<Reservation>(`/bookings/vertical/reservations/${id}/meeting`, dto);
export const saveReservationSession = (id: string, dto: { sessionSummary?: string | null; followUpAt?: string | null }) =>
  api.post<Reservation>(`/bookings/vertical/reservations/${id}/session`, dto);
export const fetchFollowUps = (days = 14) => api.get<Reservation[]>(`/bookings/vertical/follow-ups${qs({ days })}`);
