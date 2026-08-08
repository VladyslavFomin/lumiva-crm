import type { TriggerEvent } from '../../api/automations';

export interface NotificationToken {
  /** Плоское имя без {{ }}, совпадает с тем, что кладёт бэкенд в triggerData (см. buildNotificationTokens в reservations.service.ts / hotel-reservations.service.ts) */
  token: string;
  /** Ключ i18n для подписи чипа, namespace crm.automations.form.builderUi */
  labelKey: string;
}

const BOOKING_TOKENS: NotificationToken[] = [
  { token: 'client_name', labelKey: 'tokenClientName' },
  { token: 'service', labelKey: 'tokenService' },
  { token: 'date', labelKey: 'tokenDate' },
  { token: 'time', labelKey: 'tokenTime' },
  { token: 'staff', labelKey: 'tokenStaff' },
  { token: 'location_address', labelKey: 'tokenLocationAddress' },
  { token: 'booking_id', labelKey: 'tokenBookingId' },
  { token: 'status', labelKey: 'tokenStatus' },
];

const HOTEL_TOKENS: NotificationToken[] = [
  { token: 'guest_name', labelKey: 'tokenGuestName' },
  { token: 'room_type', labelKey: 'tokenRoomType' },
  { token: 'check_in', labelKey: 'tokenCheckIn' },
  { token: 'check_out', labelKey: 'tokenCheckOut' },
  { token: 'hotel_name', labelKey: 'tokenHotelName' },
  { token: 'booking_id', labelKey: 'tokenBookingId' },
  { token: 'status', labelKey: 'tokenStatus' },
];

/** Триггеры, для которых бэкенд кладёт плоские токены ({{client_name}}, ...) в triggerData автоматизации. */
const TOKENS_BY_TRIGGER: Partial<Record<TriggerEvent, NotificationToken[]>> = {
  'booking.reservation_created': BOOKING_TOKENS,
  'booking.reservation_status_changed': BOOKING_TOKENS,
  'booking.reservation_rescheduled': BOOKING_TOKENS,
  'hotel.reservation_created': HOTEL_TOKENS,
  'hotel.reservation_status_changed': HOTEL_TOKENS,
  'hotel.price_changed': HOTEL_TOKENS,
};

export function getNotificationTokens(triggerEvent: TriggerEvent): NotificationToken[] {
  return TOKENS_BY_TRIGGER[triggerEvent] || [];
}
