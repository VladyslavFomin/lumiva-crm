import { createHash } from 'node:crypto';
import { DEFAULT_SCALE, ReputationPlatform } from './reputation.constants';

/** Отзыв любой площадки, приведённый к одному виду перед записью в hotel_reviews. */
export interface NormalizedReview {
  externalReviewId: string;
  author: string | null;
  authorPhoto: string | null;
  lang: string | null;
  title: string | null;
  textOriginal: string | null;
  /** Перевод, который отдала сама площадка (Google) — не наш. */
  platformTranslation: string | null;
  ratingRaw: number | null;
  ratingScale: number;
  subRatings: Record<string, number> | null;
  travelDate: string | null;
  publishedAt: Date | null;
  platformUpdatedAt: Date | null;
  reviewUrl: string | null;
  reply: { text: string; at: Date | null } | null;
  /** Страна автора ISO-2, если площадка её отдаёт. */
  authorCountry?: string | null;
}

let countryIndex: Map<string, string> | null = null;
/** «Israel» / «Германия» / «Türkiye» → IL / DE / TR (названия стран из профиля гостя на площадке). */
export function countryCodeOf(name: unknown): string | null {
  const s = str(name)?.toLowerCase();
  if (!s) return null;
  if (/^[a-z]{2}$/.test(s)) return s.toUpperCase();
  if (!countryIndex) {
    countryIndex = new Map();
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const loc of ['en', 'ru', 'tr', 'de']) {
      let dn: Intl.DisplayNames;
      try {
        dn = new Intl.DisplayNames([loc], { type: 'region' });
      } catch {
        continue;
      }
      for (const a of A) {
        for (const b of A) {
          const code = a + b;
          try {
            const n = dn.of(code);
            if (n && n !== code) countryIndex.set(n.toLowerCase(), code);
          } catch {
            /* не регион */
          }
        }
      }
    }
    for (const [k, v] of Object.entries({ turkey: 'TR', usa: 'US', 'united states of america': 'US', uk: 'GB', england: 'GB', scotland: 'GB', russia: 'RU', 'czech republic': 'CZ' })) countryIndex.set(k, v);
  }
  // «Berlin, Germany» → последняя часть
  return countryIndex.get(s) || countryIndex.get(s.split(',').pop()!.trim()) || null;
}

const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const date = (v: unknown): Date | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000);
  const s = String(v).trim();
  // «2023-06» (месяц поездки) → первое число
  const ym = /^(\d{4})-(\d{2})$/.exec(s);
  const d = new Date(ym ? `${ym[1]}-${ym[2]}-01T00:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pick = (o: any, keys: string[]): any => {
  for (const k of keys) {
    const parts = k.split('.');
    let cur = o;
    for (const p of parts) cur = cur == null ? undefined : cur[p];
    if (cur != null && cur !== '') return cur;
  }
  return null;
};

/** Определение языка по оригиналу (если площадка его не отдала). Грубо, но для 4 рабочих языков достаточно. */
export function guessLang(text: string | null): string | null {
  if (!text) return null;
  const t = text.slice(0, 600);
  if (/[іїєґ]/i.test(t)) return 'uk';
  if (/[а-яё]/i.test(t)) return 'ru';
  if (/[ğış]/i.test(t) || /\b(ve|çok|otel|bir|için|güzel)\b/i.test(t)) return 'tr';
  if (/[äß]/i.test(t) || /\b(und|nicht|sehr|wir|das|ist|war|zimmer|aber|mit|für|leider|laut|schmutzig\w*)\b/i.test(t)) return 'de';
  if (/\b(the|and|was|very|we|hotel|room)\b/i.test(t)) return 'en';
  return null;
}

/**
 * Google в comment может прислать «(Translated by Google) … (Original) …» — оригинал храним отдельно,
 * язык определяем по оригиналу.
 */
export function splitGoogleTranslation(comment: string | null): { original: string | null; translated: string | null } {
  if (!comment) return { original: null, translated: null };
  const T = '(Translated by Google)';
  const O = '(Original)';
  const ti = comment.indexOf(T);
  const oi = comment.indexOf(O);
  if (ti >= 0 && oi > ti) {
    return { translated: str(comment.slice(ti + T.length, oi)), original: str(comment.slice(oi + O.length)) };
  }
  if (ti > 0) return { original: str(comment.slice(0, ti)), translated: str(comment.slice(ti + T.length)) };
  return { original: str(comment), translated: null };
}

const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Отзыв из Google Business Profile API v4 (accounts/{a}/locations/{l}/reviews). */
export function normalizeGoogleApiReview(r: any): NormalizedReview {
  const { original, translated } = splitGoogleTranslation(str(r.comment));
  return {
    externalReviewId: String(r.reviewId || r.name),
    author: str(r.reviewer?.isAnonymous ? null : r.reviewer?.displayName),
    authorPhoto: str(r.reviewer?.profilePhotoUrl),
    lang: guessLang(original),
    title: null,
    textOriginal: original,
    platformTranslation: translated,
    ratingRaw: STAR[String(r.starRating)] ?? null,
    ratingScale: 5,
    subRatings: null,
    travelDate: null,
    publishedAt: date(r.createTime),
    platformUpdatedAt: date(r.updateTime),
    reviewUrl: null,
    reply: r.reviewReply?.comment ? { text: String(r.reviewReply.comment), at: date(r.reviewReply.updateTime) } : null,
  };
}

function subRatingsOf(it: any): Record<string, number> | null {
  const out: Record<string, number> = {};
  // Tripadvisor: [{name, value}]
  if (Array.isArray(it.subratings)) {
    for (const s of it.subratings) {
      const v = num(s?.value ?? s?.rating);
      if (s?.name && v != null) out[String(s.name)] = v;
    }
  }
  // HolidayCheck: { FOOD: { GENERAL: 6 } } / Otelpuan: { food: 9 }
  const obj = it.ratings || it.reviewDetailedRating || it.categoryRatings || it.subRatings;
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'GENERAL' && v && typeof v === 'object') continue;
      const n = v && typeof v === 'object' ? num((v as any).GENERAL ?? (v as any).value ?? Object.values(v as any)[0]) : num(v);
      if (n != null) out[k] = n;
    }
  }
  if (Array.isArray(obj)) {
    for (const s of obj) {
      const v = num(s?.value ?? s?.rating ?? s?.score);
      if ((s?.name || s?.category) && v != null) out[String(s.name || s.category)] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Элемент выдачи Apify-скрейпера → NormalizedReview. Скрейперы пишут разные авторы, поля называются
 * по-разному — перебираем известные варианты. Служебные записи (SUMMARY) без id/текста/оценки — null.
 */
export function normalizeApifyItem(platform: ReputationPlatform, it: any): NormalizedReview | null {
  if (!it || typeof it !== 'object') return null;
  const rating = num(pick(it, ['generalRating', 'stars', 'rating', 'ratingValue', 'reviewRating', 'score', 'overallRating', 'rating.value']));
  // Booking: текст разбит на «понравилось» / «не понравилось»
  const parts = it.reviewTextParts && typeof it.reviewTextParts === 'object' ? it.reviewTextParts : null;
  const partsText = parts
    ? [str(parts.Liked ?? parts.liked) && `+ ${str(parts.Liked ?? parts.liked)}`, str(parts.Disliked ?? parts.disliked) && `− ${str(parts.Disliked ?? parts.disliked)}`].filter(Boolean).join('\n') || null
    : null;
  // Booking (voyager): likedText / dislikedText
  const liked = str(it.likedText);
  const disliked = str(it.dislikedText);
  const likedText = liked || disliked ? [liked && `+ ${liked}`, disliked && `− ${disliked}`].filter(Boolean).join('\n') : null;
  const textMain = partsText || likedText || str(pick(it, ['text', 'reviewText', 'content', 'body', 'review', 'comment', 'description']));
  const advice = str(it.textAdvice);
  const text = textMain && advice ? `${textMain}\n\n${advice}` : textMain || advice;
  let id = str(pick(it, ['reviewId', 'id', 'review_id', 'reviewID', 'uuid']));
  if (!id) {
    if (rating == null && !text) return null;
    // нет id у скрейпера — стабильный ключ из автора/даты/текста
    id = createHash('sha1')
      .update(`${pick(it, ['user.name', 'authorName', 'name']) || ''}|${pick(it, ['entryDate', 'publishedDate', 'publishedAtDate', 'date']) || ''}|${(text || '').slice(0, 200)}`)
      .digest('hex');
  }
  let scale = num(pick(it, ['ratingScale', 'scale', 'maxRating', 'bestRating'])) || DEFAULT_SCALE[platform];
  if (rating != null && rating > scale) scale = 10;

  const replyText = str(
    typeof it.ownerResponse === 'string'
      ? it.ownerResponse
      : pick(it, ['ownerResponse.text', 'responseFromOwnerText', 'businessComment', 'managementResponse.text', 'managementResponse', 'hotelResponse.text', 'hotelResponse', 'propertyResponse.text', 'propertyResponse', 'response.text']),
  );
  const replyAt = date(pick(it, ['ownerResponse.respondedAt', 'ownerResponse.publishedDate', 'responseFromOwnerDate', 'businessCommentDate', 'managementResponse.date', 'hotelResponse.date']));
  const platformTranslation = str(it.textTranslated) && it.textTranslated !== textMain ? str(it.textTranslated) : null;

  let lang = str(pick(it, ['originalLocale', 'originalLanguage', 'reviewLanguage', 'textLanguage', 'lang', 'language', 'locale']));
  if (lang && lang.length > 8) lang = null;
  return {
    externalReviewId: String(id).slice(0, 300),
    author: str(pick(it, ['user.name', 'authorName', 'author.name', 'reviewerName', 'userName', 'name', 'user.firstName', 'author'])),
    authorPhoto: str(pick(it, ['user.avatar', 'user.avatarUrl', 'user.profilePictureUrl', 'authorAvatarUrl', 'reviewerPhotoUrl', 'authorPhoto'])),
    lang: (lang ? lang.split(/[-_]/)[0].toLowerCase() : null) || guessLang(text),
    // у Google Maps-скрейпера title — это название места, а не заголовок отзыва
    title: platform === 'google' ? null : str(it.reviewTitle ?? it.title),
    textOriginal: text,
    platformTranslation,
    ratingRaw: rating,
    ratingScale: scale,
    subRatings: subRatingsOf(it),
    travelDate: (() => {
      const d = date(pick(it, ['travelDate', 'stayDate', 'visitedIn', 'tripDate', 'checkInDate']));
      return d ? d.toISOString().slice(0, 10) : null;
    })(),
    publishedAt: date(pick(it, ['entryDate', 'publishedDate', 'publishedAtDate', 'publishedAt', 'reviewDate', 'date', 'createdAt', 'submissionTime', 'reviewDate'])),
    platformUpdatedAt: date(pick(it, ['updatedAt', 'updateTime', 'editedAt'])),
    reviewUrl: str(pick(it, ['reviewUrl', 'url', 'link', 'reviewLink'])),
    reply: replyText ? { text: replyText, at: replyAt } : null,
    authorCountry: countryCodeOf(platform === 'booking' ? it.userLocation : pick(it, ['user.userLocation.country', 'reviewerCountry', 'authorCountry'])),
  };
}

/**
 * Общий рейтинг и число отзывов объекта на площадке — скрейперы кладут их в каждый элемент выдачи
 * (Google: totalScore/reviewsCount, Tripadvisor: placeInfo.rating/numberOfReviews, Booking: hotelRating/hotelReviews).
 */
export function placeStatsOf(platform: ReputationPlatform, it: any): { rating: number | null; count: number | null } {
  if (!it || typeof it !== 'object') return { rating: null, count: null };
  const rating = num(
    platform === 'google' ? it.totalScore : platform === 'tripadvisor' ? it.placeInfo?.rating : platform === 'booking' ? it.hotelRating : pick(it, ['hotelRating', 'placeRating', 'overallRating']),
  );
  const count = num(
    platform === 'google' ? it.reviewsCount : platform === 'tripadvisor' ? it.placeInfo?.numberOfReviews : platform === 'booking' ? it.hotelReviews : pick(it, ['hotelReviews', 'reviewsCount', 'numberOfReviews']),
  );
  return { rating: rating != null && rating > 0 && rating <= 10 ? rating : null, count: count != null && count >= 0 ? Math.round(count) : null };
}
