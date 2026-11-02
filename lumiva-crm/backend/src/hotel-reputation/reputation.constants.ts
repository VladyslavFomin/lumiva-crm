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

/** Часы и минуты «по стенке» в часовом поясе tz + день недели (1 = Пн … 7 = Вс). */
function wallClock(tz: string, at: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second, dow };
}

/** Момент «дата ymd, время hh:mm в поясе tz» в UTC (с поправкой на летнее время). */
function zonedTime(tz: string, y: number, m: number, d: number, hh: number, mm: number): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const w = wallClock(tz, new Date(guess));
  const offset = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - guess;
  return guess - offset;
}

/**
 * Последний наступивший слот расписания «по дням недели» (≤ now) — или null, если дни не выбраны.
 * Источник «должен» собраться, если с этого момента он ещё не запускался.
 */
export function lastScheduleSlot(sc: { days: number[]; at: string; tz: string }, now = new Date()): Date | null {
  const days = new Set((sc.days || []).filter((x) => x >= 1 && x <= 7));
  if (!days.size) return null;
  const [hh, mm] = (/^\d{1,2}:\d{2}$/.test(sc.at) ? sc.at : '02:00').split(':').map(Number);
  const tz = sc.tz || 'UTC';
  for (let back = 0; back <= 7; back++) {
    const w = wallClock(tz, new Date(now.getTime() - back * 864e5));
    if (!days.has(w.dow)) continue;
    const t = zonedTime(tz, w.y, w.m, w.d, hh, mm);
    if (t <= now.getTime()) return new Date(t);
  }
  return null;
}

/** Самый длинный промежуток между соседними слотами, в днях (для порога «площадка затихла»). */
export function maxScheduleGapDays(days: number[]): number {
  const d = [...new Set(days.filter((x) => x >= 1 && x <= 7))].sort((a, b) => a - b);
  if (!d.length) return 7;
  let gap = 7 - d[d.length - 1] + d[0];
  for (let i = 1; i < d.length; i++) gap = Math.max(gap, d[i] - d[i - 1]);
  return gap;
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** «a,b,c» → список (мультивыбор в фильтрах); id — только валидные uuid, площадки — только известные. */
export function listParam(v: string | string[] | undefined, kind: 'uuid' | 'platform'): string[] {
  const raw = (Array.isArray(v) ? v.join(',') : String(v || '')).split(',').map((x) => x.trim()).filter(Boolean);
  const ok = kind === 'uuid' ? raw.filter((x) => UUID_RE.test(x)) : raw.filter((x) => x in REPLY_MODE);
  return [...new Set(ok)].slice(0, 200);
}

/**
 * Темы, которые сейчас в справочнике (+ «прочее»). Удалённая тема не стирается из истории — её отметки
 * просто не показываются, пока тему не вернут.
 */
export function activeTopicKeys(cfg: Pick<ReputationConfig, 'topicsDisabled' | 'topicsExtra'>): string[] {
  const off = new Set(cfg.topicsDisabled || []);
  return [...TOPIC_KEYS.filter((k) => !off.has(k)), ...(cfg.topicsExtra || []).map((x) => x.key), 'other'].filter((k) => /^[a-z0-9_]{1,40}$/.test(k));
}
/** SQL-условие «тема активна» (ключи — только [a-z0-9_], поэтому безопасно вставлять литералами). */
export const activeTopicSql = (cfg: Pick<ReputationConfig, 'topicsDisabled' | 'topicsExtra'>, alias = 't') =>
  `${alias ? `${alias}.` : ''}topic IN (${activeTopicKeys(cfg).map((k) => `'${k}'`).join(', ')})`;

/** Rating-only reviews remain in review KPIs but cannot require a reply. */
export const reviewHasTextSql = (alias = 'r') =>
  `(NULLIF(BTRIM(COALESCE(${alias}."textOriginal", '')), '') IS NOT NULL OR NULLIF(BTRIM(COALESCE(${alias}.title, '')), '') IS NOT NULL)`;

export interface TopicTranslations {
  ru: string;
  tr: string;
  en: string;
}

export interface CustomReviewTopic {
  key: string;
  label: string;
  translations?: Partial<TopicTranslations>;
}

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
    /**
     * Когда собирать: 'interval' — каждые N часов по площадкам (everyHours), 'days' — в выбранные дни недели
     * в заданное время (все площадки разом; клиент сам решает, насколько свежие отзывы ему нужны и сколько платить Apify).
     */
    mode: 'interval' | 'days';
    /** Дни недели для mode='days': 1 = понедельник … 7 = воскресенье. */
    days: number[];
    /** Время запуска 'ЧЧ:ММ' в часовом поясе tz. */
    at: string;
    tz: string;
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
  topicsExtra: CustomReviewTopic[];
  topicsDisabled: string[];
  /** Удалённые свои темы: отметки в истории не трогаем, тему можно вернуть вместе с историей. */
  topicsArchive: CustomReviewTopic[];
  /**
   * Сбор отзывов конкурентов (только для сравнения). Ничего не собирается, пока конкурент не добавлен.
   * everyDays — как часто; historyMonths / firstLoadMax — глубина и потолок первой загрузки на площадку;
   * maxPerRun — потолок планового запуска; ai — разбирать ли темы (токены ИИ).
   */
  competitors: { everyDays: number; historyMonths: number; firstLoadMax: number; maxPerRun: number; ai: boolean };
  /** Брать только отзывы не старше этой даты (YYYY-MM-DD); null — без ограничения. */
  historyFrom: string | null;
  /**
   * Готовые ответы на отзывы — без ИИ, на языке гостя (нет перевода на его язык — английский).
   * Подстановки: {author} — имя гостя, {hotel} — отель, {signature} — подпись отеля.
   */
  replyTemplates: ReplyTemplate[];
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

export type ReplyTemplateTone = 'positive' | 'mixed' | 'negative' | 'any';
export interface ReplyTemplate {
  id: string;
  name: string;
  /** Для каких отзывов предлагать первым (по оценке). */
  tone: ReplyTemplateTone;
  /** Текст по языкам: ключ — 2 буквы (en, de, ru, tr …). */
  texts: Record<string, string>;
}

/** Стартовый набор — клиент правит под себя в настройках. */
export const DEFAULT_REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: 'thanks',
    name: 'Спасибо за высокую оценку',
    tone: 'positive',
    texts: {
      en: 'Dear {author}, thank you for your wonderful review! We are delighted that you enjoyed your stay at {hotel} and hope to welcome you back soon.\n\n{signature}',
      de: 'Liebe/r {author}, vielen Dank für Ihre wunderbare Bewertung! Es freut uns sehr, dass Ihnen Ihr Aufenthalt im {hotel} gefallen hat. Wir hoffen, Sie bald wieder bei uns begrüßen zu dürfen.\n\n{signature}',
      ru: '{author}, спасибо за прекрасный отзыв! Мы очень рады, что вам понравился отдых в {hotel}, и будем ждать вас снова.\n\n{signature}',
      tr: 'Sevgili {author}, harika yorumunuz için çok teşekkür ederiz! {hotel} konaklamanızdan memnun kalmanıza çok sevindik, sizi yeniden ağırlamayı umuyoruz.\n\n{signature}',
    },
  },
  {
    id: 'mixed',
    name: 'Спасибо + учтём замечания',
    tone: 'mixed',
    texts: {
      en: 'Dear {author}, thank you for taking the time to share your feedback. We are glad you enjoyed many aspects of your stay, and we have passed your comments on to the relevant teams so we can improve. We hope to welcome you back to {hotel}.\n\n{signature}',
      de: 'Liebe/r {author}, vielen Dank, dass Sie sich die Zeit für Ihre Bewertung genommen haben. Es freut uns, dass Ihnen vieles gefallen hat. Ihre Hinweise haben wir an die zuständigen Abteilungen weitergegeben, damit wir uns verbessern können. Wir hoffen, Sie wieder im {hotel} begrüßen zu dürfen.\n\n{signature}',
      ru: '{author}, спасибо, что нашли время поделиться впечатлениями. Мы рады, что многое вам понравилось, а ваши замечания уже передали в профильные службы, чтобы стать лучше. Будем рады видеть вас снова в {hotel}.\n\n{signature}',
      tr: 'Sevgili {author}, görüşlerinizi paylaşmak için zaman ayırdığınız için teşekkür ederiz. Konaklamanızın birçok yönünden memnun kalmanıza sevindik; geliştirmek için yorumlarınızı ilgili ekiplerimize ilettik. Sizi yeniden {hotel} misafiri olarak görmeyi umuyoruz.\n\n{signature}',
    },
  },
  {
    id: 'apology',
    name: 'Извинение за негативный опыт',
    tone: 'negative',
    texts: {
      en: 'Dear {author}, thank you for your feedback, and please accept our sincere apologies that your stay at {hotel} did not meet your expectations. We have shared your comments with our management team and are taking steps to address them. We would welcome the chance to discuss this further — please contact us directly.\n\n{signature}',
      de: 'Liebe/r {author}, vielen Dank für Ihr Feedback. Bitte entschuldigen Sie, dass Ihr Aufenthalt im {hotel} nicht Ihren Erwartungen entsprochen hat. Wir haben Ihre Hinweise an unsere Hotelleitung weitergegeben und kümmern uns darum. Gerne würden wir mit Ihnen persönlich darüber sprechen — bitte kontaktieren Sie uns direkt.\n\n{signature}',
      ru: '{author}, спасибо за отзыв и примите наши искренние извинения: отдых в {hotel} не оправдал ваших ожиданий. Мы передали ваши замечания руководству отеля и уже занимаемся ими. Будем благодарны, если вы свяжетесь с нами напрямую — хотим разобраться в ситуации.\n\n{signature}',
      tr: 'Sevgili {author}, geri bildiriminiz için teşekkür ederiz; {hotel} konaklamanız beklentilerinizi karşılamadığı için içtenlikle özür dileriz. Yorumlarınızı otel yönetimimize ilettik ve gerekli adımları atıyoruz. Konuyu sizinle görüşmek isteriz — lütfen bizimle doğrudan iletişime geçin.\n\n{signature}',
    },
  },
];

export function sanitizeReplyTemplates(v: unknown): ReplyTemplate[] {
  if (!Array.isArray(v)) return DEFAULT_REPLY_TEMPLATES.map((t) => ({ ...t, texts: { ...t.texts } }));
  const tones: ReplyTemplateTone[] = ['positive', 'mixed', 'negative', 'any'];
  return v.slice(0, 40).flatMap((x: any, i: number) => {
    const texts: Record<string, string> = {};
    for (const [k, t] of Object.entries(x?.texts || {})) {
      const lang = String(k).toLowerCase().slice(0, 2);
      const text = String(t ?? '').trim().slice(0, 3000);
      if (/^[a-z]{2}$/.test(lang) && text) texts[lang] = text;
    }
    const name = String(x?.name ?? '').trim().slice(0, 80);
    if (!name || !Object.keys(texts).length) return [];
    const id = /^[a-z0-9_-]{1,40}$/i.test(String(x?.id || '')) ? String(x.id) : `t${Date.now().toString(36)}${i}`;
    return [{ id, name, tone: tones.includes(x?.tone) ? x.tone : 'any', texts }];
  });
}

export function defaultConfig(): ReputationConfig {
  return {
    thresholds: { negativeBelow: 6, noReplyHours: 48, ratingDropPoints: 0.3, topicRepeatCount: 3, topicRepeatDays: 7, staleDays: 7, countDriftPct: 1 },
    alerts: { negative: true, no_reply: true, rating_lowered: true, avg_drop: true, topic_spike: true, sync_problem: true },
    schedule: { holidaycheckMinutes: 60, apifyHours: 6, otelpuanHours: 24, offSeason: false, maxPerRun: 50, firstLoadMax: 1000, maxConcurrentRuns: 4, mode: 'interval', days: [1], at: '02:00', tz: 'Europe/Istanbul' },
    translateTo: 'ru',
    telegramBotId: null,
    recipients: { developer: r(), brands: {}, hotels: {} },
    signatures: {},
    apifyActors: JSON.parse(JSON.stringify(DEFAULT_ACTORS)),
    google: { accountName: null, accountEmail: null, pubsubTopic: null, notificationsOk: false, notificationsError: null, connectedAt: null },
    holidaycheck: { replyUrlTemplate: '', method: 'POST', authHeader: 'Authorization', authPrefix: 'Bearer ', bodyField: 'text' },
    topicsExtra: [],
    topicsDisabled: [],
    topicsArchive: [],
    competitors: { everyDays: 7, historyMonths: 6, firstLoadMax: 100, maxPerRun: 30, ai: true },
    monthlyReport: { enabled: true },
    apifyPause: { reason: null, at: null },
    historyFrom: null,
    replyTemplates: DEFAULT_REPLY_TEMPLATES.map((t) => ({ ...t, texts: { ...t.texts } })),
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
    topicsDisabled: Array.isArray(s.topicsDisabled) ? s.topicsDisabled : [],
    topicsArchive: Array.isArray(s.topicsArchive) ? s.topicsArchive : [],
    competitors: { ...d.competitors, ...(s.competitors || {}) },
    monthlyReport: { ...d.monthlyReport, ...(s.monthlyReport || {}) },
    apifyPause: { ...d.apifyPause, ...(s.apifyPause || {}) },
    replyTemplates: sanitizeReplyTemplates(s.replyTemplates),
    historyFrom: typeof s.historyFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.historyFrom) ? s.historyFrom : null,
  };
}
