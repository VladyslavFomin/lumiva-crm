import type { TFunction } from 'i18next';
import type { BookingBusinessType } from '../../api/bookings';

export type BookingNavKey =
  | 'overview'
  | 'reservations'
  | 'waitlist'
  | 'resources'
  | 'locations'
  | 'services'
  | 'availability'
  | 'analytics'
  | 'logs'
  | 'roles'
  | 'settings'
  | 'floor'
  | 'floorEditor'
  | 'menu'
  | 'orders'
  | 'schedule'
  | 'passes'
  | 'calendar'
  | 'desk'
  | 'inventory';

export const BOOKING_NAV_PATHS: Record<BookingNavKey, string> = {
  overview: '/bookings',
  reservations: '/bookings/reservations',
  waitlist: '/bookings/waitlist',
  resources: '/bookings/resources',
  locations: '/bookings/locations',
  services: '/bookings/services',
  availability: '/bookings/availability',
  analytics: '/bookings/analytics',
  logs: '/bookings/logs',
  roles: '/staff/permissions',
  settings: '/bookings/settings',
  floor: '/bookings/floor',
  floorEditor: '/bookings/floor/editor',
  menu: '/bookings/menu',
  orders: '/bookings/orders',
  schedule: '/bookings/schedule',
  passes: '/bookings/passes',
  calendar: '/bookings/calendar',
  desk: '/bookings/desk',
  inventory: '/bookings/inventory',
};

/** Набор и порядок разделов под каждый тип бизнеса — «совершенно новый интерфейс» на одной модели данных. */
export const BOOKING_NAV_BY_TYPE: Record<BookingBusinessType, BookingNavKey[]> = {
  salon: ['overview', 'reservations', 'waitlist', 'resources', 'locations', 'services', 'availability', 'passes', 'orders', 'analytics', 'logs', 'roles', 'settings'],
  restaurant: ['overview', 'floor', 'reservations', 'orders', 'menu', 'floorEditor', 'waitlist', 'locations', 'availability', 'analytics', 'logs', 'roles', 'settings'],
  fitness: ['overview', 'schedule', 'reservations', 'passes', 'services', 'resources', 'availability', 'waitlist', 'orders', 'locations', 'analytics', 'logs', 'roles', 'settings'],
  consultation: ['overview', 'calendar', 'reservations', 'services', 'availability', 'passes', 'orders', 'waitlist', 'locations', 'analytics', 'logs', 'roles', 'settings'],
  rental: ['overview', 'desk', 'reservations', 'inventory', 'orders', 'locations', 'availability', 'analytics', 'logs', 'roles', 'settings'],
};

/** Подпись раздела: сначала вертикальная (crm.bookings.navV.<type>.<key>), иначе общая. */
export function bookingNavLabel(t: TFunction, type: BookingBusinessType, key: BookingNavKey): string {
  return t(`crm.bookings.navV.${type}.${key}`, { defaultValue: t(`crm.bookings.nav.${key}`) });
}

export function bookingNavItems(t: TFunction, type: BookingBusinessType) {
  return BOOKING_NAV_BY_TYPE[type].map((key) => ({ key, label: bookingNavLabel(t, type, key), path: BOOKING_NAV_PATHS[key] }));
}
