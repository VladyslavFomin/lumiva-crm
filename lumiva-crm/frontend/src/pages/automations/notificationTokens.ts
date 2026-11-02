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

/** Путь гостя (hotel-guest-journey.service.ts → tokens): данные брони + ссылки (создаются, только если есть в тексте) */
const GUEST_JOURNEY_TOKENS: NotificationToken[] = [
  { token: 'guest_first_name', labelKey: 'tokenGuestFirstName' },
  { token: 'guest_name', labelKey: 'tokenGuestName' },
  { token: 'guest_email', labelKey: 'tokenGuestEmail' },
  { token: 'guest_phone', labelKey: 'tokenGuestPhone' },
  { token: 'hotel_name', labelKey: 'tokenHotelName' },
  { token: 'check_in', labelKey: 'tokenCheckIn' },
  { token: 'check_out', labelKey: 'tokenCheckOut' },
  { token: 'nights', labelKey: 'tokenNights' },
  { token: 'room_type', labelKey: 'tokenRoomType' },
  { token: 'room_number', labelKey: 'tokenRoomNumber' },
  { token: 'board', labelKey: 'tokenBoard' },
  { token: 'booking_code', labelKey: 'tokenBookingCode' },
  { token: 'checkin_time', labelKey: 'tokenCheckinTime' },
  { token: 'balance', labelKey: 'tokenBalance' },
  { token: 'deposit_left', labelKey: 'tokenDepositLeft' },
  { token: 'deposit_due', labelKey: 'tokenDepositDue' },
  { token: 'currency', labelKey: 'tokenCurrency' },
  { token: 'precheckin_link', labelKey: 'tokenPrecheckinLink' },
  { token: 'pay_link', labelKey: 'tokenPayLink' },
  { token: 'guest_care_link', labelKey: 'tokenGuestCareLink' },
  { token: 'survey_link', labelKey: 'tokenSurveyLink' },
];
const PAYMENT_TOKENS: NotificationToken[] = [
  ...GUEST_JOURNEY_TOKENS.filter((x) => !x.token.endsWith('_link')),
  { token: 'payment_amount', labelKey: 'tokenPaymentAmount' },
  { token: 'payment_currency', labelKey: 'tokenCurrency' },
];
const FEEDBACK_TOKENS: NotificationToken[] = [
  ...GUEST_JOURNEY_TOKENS.filter((x) => !x.token.endsWith('_link')),
  { token: 'score', labelKey: 'tokenScore' },
  { token: 'score_stars', labelKey: 'tokenScoreStars' },
  { token: 'comment', labelKey: 'tokenComment' },
  { token: 'crm_url', labelKey: 'tokenCrmUrl' },
];

/** Отзывы отелей (hotel-reputation/reputation-events.service.ts → tokens). */
const REVIEW_TOKENS: NotificationToken[] = [
  { token: 'hotel_name', labelKey: 'tokenHotelName' },
  { token: 'brand_name', labelKey: 'tokenBrandName' },
  { token: 'platform_label', labelKey: 'tokenPlatform' },
  { token: 'rating_text', labelKey: 'tokenRating' },
  { token: 'rating10', labelKey: 'tokenRating10' },
  { token: 'author', labelKey: 'tokenAuthor' },
  { token: 'text', labelKey: 'tokenReviewText' },
  { token: 'text_translated', labelKey: 'tokenReviewTranslation' },
  { token: 'complaints', labelKey: 'tokenComplaints' },
  { token: 'topics', labelKey: 'tokenTopics' },
  { token: 'published_at', labelKey: 'tokenDate' },
  { token: 'review_url', labelKey: 'tokenReviewUrl' },
  { token: 'crm_url', labelKey: 'tokenCrmUrl' },
];
const REVIEW_SPIKE_TOKENS: NotificationToken[] = [
  { token: 'hotel_name', labelKey: 'tokenHotelName' },
  { token: 'topic_label', labelKey: 'tokenTopic' },
  { token: 'count', labelKey: 'tokenCount' },
  { token: 'days', labelKey: 'tokenDays' },
  { token: 'quotes', labelKey: 'tokenQuotes' },
];
const REVIEW_DROP_TOKENS: NotificationToken[] = [
  { token: 'hotel_name', labelKey: 'tokenHotelName' },
  { token: 'avg_now', labelKey: 'tokenAvgNow' },
  { token: 'avg_prev', labelKey: 'tokenAvgPrev' },
  { token: 'drop', labelKey: 'tokenDrop' },
];

/** Триггеры, для которых бэкенд кладёт плоские токены ({{client_name}}, ...) в triggerData автоматизации. */
const TOKENS_BY_TRIGGER: Partial<Record<TriggerEvent, NotificationToken[]>> = {
  'booking.reservation_created': BOOKING_TOKENS,
  'booking.reservation_status_changed': BOOKING_TOKENS,
  'booking.reservation_rescheduled': BOOKING_TOKENS,
  'hotel.reservation_created': HOTEL_TOKENS,
  'hotel.reservation_status_changed': HOTEL_TOKENS,
  'hotel.price_changed': HOTEL_TOKENS,
  'hotel.guest_before_arrival': GUEST_JOURNEY_TOKENS,
  'hotel.guest_arrival_day': GUEST_JOURNEY_TOKENS,
  'hotel.guest_in_stay': GUEST_JOURNEY_TOKENS,
  'hotel.guest_after_departure': GUEST_JOURNEY_TOKENS,
  'hotel.deposit_due': GUEST_JOURNEY_TOKENS,
  'hotel.payment_received': PAYMENT_TOKENS,
  'hotel.guest_feedback': FEEDBACK_TOKENS,
  'hotel.guest_feedback_negative': FEEDBACK_TOKENS,
  'review.created': REVIEW_TOKENS,
  'review.negative': REVIEW_TOKENS,
  'review.no_reply': [...REVIEW_TOKENS, { token: 'hours_without_reply', labelKey: 'tokenHoursWithoutReply' }],
  'review.rating_lowered': [...REVIEW_TOKENS, { token: 'old_rating10', labelKey: 'tokenOldRating' }, { token: 'new_rating10', labelKey: 'tokenNewRating' }],
  'review.replied': [...REVIEW_TOKENS, { token: 'reply_text', labelKey: 'tokenReplyText' }],
  'review.topic_spike': REVIEW_SPIKE_TOKENS,
  'review.rating_drop': REVIEW_DROP_TOKENS,
};

export function getNotificationTokens(triggerEvent: TriggerEvent): NotificationToken[] {
  return TOKENS_BY_TRIGGER[triggerEvent] || [];
}
