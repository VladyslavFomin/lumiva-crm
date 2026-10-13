export const REPUTATION_PLATFORMS = ['google', 'holidaycheck', 'tripadvisor', 'yandex', 'expedia', 'check24', 'otelpuan', 'booking'] as const;
export type ReputationPlatform = (typeof REPUTATION_PLATFORMS)[number];
export type ReviewSentiment = 'positive' | 'negative' | 'neutral';

/** Платформы, которые собираются через Apify (HolidayCheck — тоже, пока его API не отдаёт чтение). */
export const APIFY_PLATFORMS: ReputationPlatform[] = ['holidaycheck', 'tripadvisor', 'yandex', 'expedia', 'check24', 'otelpuan', 'booking'];

/**
 * Как отвечать на отзыв площадки:
 * api — из CRM через API; external — черновик + переход на площадку; none — площадка не публикует ответы.
 */
export const REPLY_MODE: Record<ReputationPlatform, 'api' | 'external' | 'none'> = {
  google: 'api',
  holidaycheck: 'api',
  tripadvisor: 'external',
  yandex: 'external',
  expedia: 'external',
  otelpuan: 'external',
  booking: 'external',
  check24: 'none',
};

/** Где менеджер отвечает на площадке (кабинеты отельера). */
export const PLATFORM_REPLY_HOME: Record<ReputationPlatform, string | null> = {
  google: 'https://business.google.com/reviews',
  holidaycheck: 'https://www.holidaycheck.de/business-center',
  tripadvisor: 'https://www.tripadvisor.com/ManagementCenter',
  yandex: 'https://yandex.ru/sprav/',
  expedia: 'https://apps.expediapartnercentral.com/',
  otelpuan: 'https://www.otelpuan.com/',
  booking: 'https://admin.booking.com/',
  check24: null,
};

/** Исходная шкала оценки площадки (проверяется по выгрузке: если оценка больше шкалы — шкала 10). */
export const DEFAULT_SCALE: Record<ReputationPlatform, number> = {
  google: 5,
  tripadvisor: 5,
  yandex: 5,
  holidaycheck: 6,
  otelpuan: 10,
  expedia: 10,
  check24: 10,
  booking: 10,
};

/** Нижняя граница дат отзывов (настройка «Брать отзывы начиная с»). */
export function historyFloor(cfg: { historyFrom: string | null }): number {
  return cfg.historyFrom ? Date.parse(`${cfg.historyFrom}T00:00:00Z`) : Date.parse('2000-01-01T00:00:00Z');
}

export function toRating10(raw: number | null, scale: number | null): number | null {
  if (raw == null || !Number.isFinite(raw) || !scale) return null;
  return Math.round(Math.min(10, Math.max(0, (raw / scale) * 10)) * 100) / 100;
}

/** Фиксированный справочник тем для отелей; всё вне него — «other» с меткой. */
export const TOPIC_KEYS = [
  'cleanliness', 'room', 'bed_sleep', 'noise', 'breakfast', 'food', 'bar', 'all_inclusive', 'pool', 'beach',
  'animation', 'staff', 'reception', 'wifi', 'air_conditioning', 'value', 'location', 'transfer', 'spa', 'kids_club',
] as const;

export const TOPIC_LABELS_RU: Record<string, string> = {
  cleanliness: 'уборка', room: 'номер', bed_sleep: 'кровать и сон', noise: 'шум', breakfast: 'завтрак',
  food: 'ресторан и еда', bar: 'бар', all_inclusive: 'all inclusive', pool: 'бассейн', beach: 'пляж',
  animation: 'анимация', staff: 'персонал', reception: 'ресепшн и заселение', wifi: 'Wi-Fi',
  air_conditioning: 'кондиционер', value: 'цена и ценность', location: 'расположение', transfer: 'трансфер',
  spa: 'спа', kids_club: 'детский клуб', other: 'прочее',
};

export type AlertKind = 'negative' | 'no_reply' | 'rating_lowered' | 'avg_drop' | 'topic_spike' | 'sync_problem';
export const ALERT_KINDS: AlertKind[] = ['negative', 'no_reply', 'rating_lowered', 'avg_drop', 'topic_spike', 'sync_problem'];

export interface Recipients {
  emails: string[];
  /** id получателей бота Telegram (Telegram → Бот → Получатели). */
  telegram: string[];
  /** Пользователи CRM — в колокольчик уведомлений. */
  userIds: string[];
}

export interface ApifyActorConfig {
  primary: string;
  fallback: string;
  /** JSON-шаблон входа актора: {{url}}, {{max}}, {{since}} подставляются при запуске. */
  input: string;
  /** Как часто собирать, часов. */
  everyHours: number;
  /** Первая загрузка истории: сколько отзывов на отель. */
  firstLoadMax: number;
  /** Потолок отзывов за один плановый запуск (оплата Apify — за каждый отзыв в выдаче). */
  maxPerRun: number;
}

/**
 * Лимиты по умолчанию под цену скрейпера (за 1000 отзывов): Google ~$0.3–0.6, Tripadvisor ~$0.9, Booking ~$1–2,
 * Expedia ~$2, Яндекс ~$2.9, HolidayCheck ~$4.9, Check24 ~$19, Otelpuan ~$29. Дорогие — реже и меньше.
 */
const LIMITS: Record<string, { everyHours: number; firstLoadMax: number; maxPerRun: number }> = {
  google: { everyHours: 6, firstLoadMax: 1000, maxPerRun: 50 },
  booking: { everyHours: 6, firstLoadMax: 1000, maxPerRun: 50 },
  tripadvisor: { everyHours: 12, firstLoadMax: 1000, maxPerRun: 30 },
  expedia: { everyHours: 24, firstLoadMax: 300, maxPerRun: 20 },
  yandex: { everyHours: 24, firstLoadMax: 300, maxPerRun: 20 },
  holidaycheck: { everyHours: 24, firstLoadMax: 500, maxPerRun: 20 },
  check24: { everyHours: 24, firstLoadMax: 100, maxPerRun: 20 },
  otelpuan: { everyHours: 168, firstLoadMax: 100, maxPerRun: 20 },
};

export interface ReputationConfig {
  thresholds: {
    negativeBelow: number; // 0–10
    noReplyHours: number;
    ratingDropPoints: number;
    topicRepeatCount: number;
    topicRepeatDays: number;
    staleDays: number;
    countDriftPct: number;
  };
  alerts: Record<AlertKind, boolean>;
  schedule: {
    holidaycheckMinutes: number;
    apifyHours: number;
    otelpuanHours: number;
    /** Вне сезона Apify-площадки собираются раз в сутки — экономия бюджета. */
    offSeason: boolean;
    maxPerRun: number;
    /** Первая загрузка истории: сколько отзывов на отель брать (0 у разных акторов значит «всё» или «ничего»). */
    firstLoadMax: number;
    /** Сколько запусков Apify держать одновременно (на бесплатном тарифе Apify лимит 5; оставляем слот для тестов). */
    maxConcurrentRuns: number;
  };
  translateTo: 'ru' | 'en';
  telegramBotId: string | null;
  recipients: {
    developer: Recipients;
    brands: Record<string, Recipients>;
    hotels: Record<string, Recipients>;
  };
  /** Подпись ответа по отелю (иначе — название отеля). */
  signatures: Record<string, string>;
  apifyActors: Record<string, ApifyActorConfig>;
  google: {
    accountName: string | null;
    accountEmail: string | null;
    pubsubTopic: string | null;
    notificationsOk: boolean;
    notificationsError: string | null;
    connectedAt: string | null;
  };
  holidaycheck: {
    /** URL ответа на отзыв, {reviewId} подставляется. Уточнить по документации HolidayCheck. */
    replyUrlTemplate: string;
    method: 'POST' | 'PUT';
    authHeader: string;
    authPrefix: string;
    bodyField: string;
  };
  /** Дополнительные темы (расширение справочника по итогам месячного разбора «прочего»). */
  topicsExtra: Array<{ key: string; label: string }>;
  /** Брать только отзывы не старше этой даты (YYYY-MM-DD); null — без ограничения. */
  historyFrom: string | null;
  /** Сбор через Apify на паузе: кончился месячный бюджет тарифа (повтор раз в 3 часа или вручную). */
  apifyPause: { reason: string | null; at: string | null };
  /** Отчёт по бренду в начале месяца — кому слать. */
  monthlyReport: { enabled: boolean };
}

const r = (): Recipients => ({ emails: [], telegram: [], userIds: [] });

export const DEFAULT_ACTORS: Record<string, ApifyActorConfig> = {
  tripadvisor: {
    primary: 'maxcopell/tripadvisor-reviews',
    fallback: '',
    input: '{"startUrls":[{"url":"{{url}}"}],"maxItemsPerQuery":{{max}},"lastReviewDate":"{{since}}","disableMachineTranslations":true,"scrapeReviewerInfo":true,"reviewRatings":["ALL_REVIEW_RATINGS"],"reviewsLanguages":["ALL_REVIEW_LANGUAGES"]}',
    ...LIMITS.tripadvisor,
  },
  yandex: {
    primary: 'parsebird/yandex-maps-reviews-scraper',
    fallback: '',
    input: '{"startUrls":[{"url":"{{url}}"}],"maxReviewsPerPlace":{{max}},"language":"ru"}',
    ...LIMITS.yandex,
  },
  expedia: {
    primary: 'tri_angle/expedia-hotels-com-reviews-scraper',
    fallback: '',
    input: '{"startUrls":[{"url":"{{url}}"}],"maxReviewsPerHotel":{{max}}}',
    ...LIMITS.expedia,
  },
  check24: {
    primary: 'valiant_quarter/check24-hotel-reviews-scraper',
    fallback: '',
    input: '{"startUrls":[{"url":"{{url}}"}],"maxReviewsPerHotel":{{max}},"dateFrom":"{{since}}"}',
    ...LIMITS.check24,
  },
  otelpuan: {
    primary: 'valiant_quarter/otelpuan-reviews-scraper',
    fallback: '',
    input: '{"startUrls":[{"url":"{{url}}"}],"maxReviewsPerHotel":{{max}},"proxyConfiguration":{"useApifyProxy":true,"apifyProxyGroups":["RESIDENTIAL"],"apifyProxyCountry":"TR"}}',
    ...LIMITS.otelpuan,
  },
  holidaycheck: {
    primary: 'valiant_quarter/best-holidaycheck-de-reviews-scraper',
    fallback: '',
    input: '{"startUrls":[{"url":"{{url}}"}],"maxReviewsPerHotel":{{max}},"includeOwnerResponses":true}',
    ...LIMITS.holidaycheck,
  },
  booking: {
    primary: 'voyager/booking-reviews-scraper',
    fallback: '',
    input: '{"startUrls":[{"url":"{{url}}"}],"maxReviewsPerHotel":{{max}},"sortReviewsBy":"f_recent_desc","cutoffDate":"{{since}}","reviewScores":["ALL"]}',
    ...LIMITS.booking,
  },
  /** Временный источник Google на чтение, пока доступ к Business Profile API не одобрен. */
  google: {
    primary: 'compass/google-maps-reviews-scraper',
    fallback: '',
    input: '{"startUrls":[{"url":"{{url}}"}],"maxReviews":{{max}},"reviewsSort":"newest","reviewsStartDate":"{{since}}","personalData":true}',
    ...LIMITS.google,
  },
};

export function defaultConfig(): ReputationConfig {
  return {
    thresholds: { negativeBelow: 6, noReplyHours: 48, ratingDropPoints: 0.3, topicRepeatCount: 3, topicRepeatDays: 7, staleDays: 7, countDriftPct: 1 },
    alerts: { negative: true, no_reply: true, rating_lowered: true, avg_drop: true, topic_spike: true, sync_problem: true },
    schedule: { holidaycheckMinutes: 60, apifyHours: 6, otelpuanHours: 24, offSeason: false, maxPerRun: 50, firstLoadMax: 1000, maxConcurrentRuns: 4 },
    translateTo: 'ru',
    telegramBotId: null,
    recipients: { developer: r(), brands: {}, hotels: {} },
    signatures: {},
    apifyActors: JSON.parse(JSON.stringify(DEFAULT_ACTORS)),
    google: { accountName: null, accountEmail: null, pubsubTopic: null, notificationsOk: false, notificationsError: null, connectedAt: null },
    holidaycheck: { replyUrlTemplate: '', method: 'POST', authHeader: 'Authorization', authPrefix: 'Bearer ', bodyField: 'text' },
    topicsExtra: [],
    monthlyReport: { enabled: true },
    apifyPause: { reason: null, at: null },
    historyFrom: null,
  };
}

/** Глубокое слияние сохранённого конфига поверх значений по умолчанию (новые поля получают дефолты). */
export function mergeConfig(saved: any): ReputationConfig {
  const d = defaultConfig();
  const s = saved && typeof saved === 'object' ? saved : {};
  const actors = { ...d.apifyActors };
  for (const [k, v] of Object.entries(s.apifyActors || {})) actors[k] = { ...(actors[k] || { primary: '', fallback: '', input: '' }), ...(v as any) };
  return {
    ...d,
    ...s,
    thresholds: { ...d.thresholds, ...(s.thresholds || {}) },
    alerts: { ...d.alerts, ...(s.alerts || {}) },
    schedule: { ...d.schedule, ...(s.schedule || {}) },
    recipients: {
      developer: { ...r(), ...(s.recipients?.developer || {}) },
      brands: s.recipients?.brands || {},
      hotels: s.recipients?.hotels || {},
    },
    signatures: s.signatures || {},
    apifyActors: actors,
    google: { ...d.google, ...(s.google || {}) },
    holidaycheck: { ...d.holidaycheck, ...(s.holidaycheck || {}) },
    topicsExtra: Array.isArray(s.topicsExtra) ? s.topicsExtra : [],
    monthlyReport: { ...d.monthlyReport, ...(s.monthlyReport || {}) },
    apifyPause: { ...d.apifyPause, ...(s.apifyPause || {}) },
    historyFrom: typeof s.historyFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.historyFrom) ? s.historyFrom : null,
  };
}
