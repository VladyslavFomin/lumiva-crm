/**
 * Справочник рынков/стран для сегментации рекламной аналитики (AI-чат и API).
 *
 * Зачем: у большинства рекламных источников (Google Ads, Meta, Yandex Direct/Metrika, VK Ads)
 * нет поля страны в БД — гео присутствует только для GA4-строк (marketing_traffic.country,
 * ISO2 из GA4 countryId). Реальные рынки агентства кодируются вручную в названии кампании —
 * либо как тег-токен рядом с началом строки, на дефисе или подчёркивании (типично для Google
 * Ads: "LV - Search - Traffic - ...", "RO_GDN_Branding", "WOXX_SHR_UK_EN_Search_Branding"),
 * либо как слово внутри названия на языке рекламного кабинета (Meta: "fb_Branding Banner
 * Letonya" — тур. "Латвия"). Без этого справочника ИИ не может отличить рынок от общего
 * агрегата и рискует выдать глобальные цифры под видом отчёта по одной стране.
 */

export interface MarketCatalogEntry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** Человекочитаемое имя для ответа (RU) */
  label: string;
  /** Ключевые слова/синонимы для сопоставления (EN/RU/TR, нижний регистр) — включая сам code */
  names: string[];
}

export const MARKET_CATALOG: MarketCatalogEntry[] = [
  { code: 'GB', label: 'Великобритания', names: ['gb', 'uk', 'united kingdom', 'great britain', 'britain', 'england', 'ingiltere', 'i̇ngiltere', 'birlesik krallik', 'birleşik krallık', 'великобритания', 'англия', 'британия', 'соединенное королевство', 'соединённое королевство'] },
  { code: 'TR', label: 'Турция', names: ['tr', 'turkey', 'turkiye', 'türkiye', 'турция'] },
  { code: 'RU', label: 'Россия', names: ['ru', 'russia', 'rusya', 'россия'] },
  { code: 'LV', label: 'Латвия', names: ['lv', 'latvia', 'letonya', 'латвия'] },
  { code: 'LT', label: 'Литва', names: ['lt', 'lithuania', 'litvanya', 'литва'] },
  { code: 'EE', label: 'Эстония', names: ['ee', 'estonia', 'estonya', 'эстония'] },
  { code: 'MK', label: 'Северная Македония', names: ['mk', 'macedonia', 'north macedonia', 'makedonya', 'македония', 'северная македония'] },
  { code: 'RO', label: 'Румыния', names: ['ro', 'romania', 'romanya', 'румыния'] },
  { code: 'XK', label: 'Косово', names: ['xk', 'kosovo', 'kosova', 'косово'] },
  { code: 'PL', label: 'Польша', names: ['pl', 'poland', 'polonya', 'польша'] },
  { code: 'DE', label: 'Германия', names: ['de', 'germany', 'almanya', 'германия'] },
  { code: 'FR', label: 'Франция', names: ['fr', 'france', 'fransa', 'франция'] },
  { code: 'NL', label: 'Нидерланды', names: ['nl', 'netherlands', 'hollanda', 'нидерланды', 'голландия'] },
  { code: 'BE', label: 'Бельгия', names: ['be', 'belgium', 'belcika', 'belçika', 'бельгия'] },
  { code: 'IT', label: 'Италия', names: ['it', 'italy', 'italya', 'италия'] },
  { code: 'ES', label: 'Испания', names: ['es', 'spain', 'ispanya', 'испания'] },
  { code: 'PT', label: 'Португалия', names: ['pt', 'portugal', 'portekiz', 'португалия'] },
  { code: 'AT', label: 'Австрия', names: ['at', 'austria', 'avusturya', 'австрия'] },
  { code: 'CH', label: 'Швейцария', names: ['ch', 'switzerland', 'isvicre', 'i̇sviçre', 'швейцария'] },
  { code: 'SE', label: 'Швеция', names: ['se', 'sweden', 'isvec', 'i̇sveç', 'швеция'] },
  { code: 'NO', label: 'Норвегия', names: ['no', 'norway', 'norvec', 'norveç', 'норвегия'] },
  { code: 'DK', label: 'Дания', names: ['dk', 'denmark', 'danimarka', 'дания'] },
  { code: 'FI', label: 'Финляндия', names: ['fi', 'finland', 'finlandiya', 'финляндия'] },
  { code: 'UA', label: 'Украина', names: ['ua', 'ukraine', 'ukrayna', 'украина'] },
  { code: 'BY', label: 'Беларусь', names: ['by', 'belarus', 'беларусь', 'белоруссия'] },
  { code: 'KZ', label: 'Казахстан', names: ['kz', 'kazakhstan', 'kazakistan', 'казахстан'] },
  { code: 'CZ', label: 'Чехия', names: ['cz', 'czech', 'czechia', 'cek cumhuriyeti', 'çek cumhuriyeti', 'чехия'] },
  { code: 'SK', label: 'Словакия', names: ['sk', 'slovakia', 'slovakya', 'словакия'] },
  { code: 'HU', label: 'Венгрия', names: ['hu', 'hungary', 'macaristan', 'венгрия'] },
  { code: 'BG', label: 'Болгария', names: ['bg', 'bulgaria', 'bulgaristan', 'болгария'] },
  { code: 'RS', label: 'Сербия', names: ['rs', 'serbia', 'sirbistan', 'сербия'] },
  { code: 'HR', label: 'Хорватия', names: ['hr', 'croatia', 'hirvatistan', 'хорватия'] },
  { code: 'SI', label: 'Словения', names: ['si', 'slovenia', 'slovenya', 'словения'] },
  { code: 'AL', label: 'Албания', names: ['al', 'albania', 'arnavutluk', 'албания'] },
  { code: 'BA', label: 'Босния и Герцеговина', names: ['ba', 'bosnia', 'bosna', 'босния'] },
  { code: 'GR', label: 'Греция', names: ['gr', 'greece', 'yunanistan', 'греция'] },
  { code: 'CY', label: 'Кипр', names: ['cy', 'cyprus', 'kibris', 'kıbrıs', 'кипр'] },
  { code: 'IE', label: 'Ирландия', names: ['ie', 'ireland', 'irlanda', 'ирландия'] },
  { code: 'IL', label: 'Израиль', names: ['il', 'israel', 'israil', 'i̇srail', 'израиль'] },
  { code: 'AE', label: 'ОАЭ', names: ['ae', 'uae', 'united arab emirates', 'bae', 'оаэ'] },
  { code: 'SA', label: 'Саудовская Аравия', names: ['sa', 'saudi arabia', 'suudi arabistan', 'саудовская аравия'] },
  { code: 'AZ', label: 'Азербайджан', names: ['az', 'azerbaijan', 'azerbaycan', 'азербайджан'] },
  { code: 'GE', label: 'Грузия', names: ['ge', 'georgia', 'gurcistan', 'грузия'] },
  { code: 'US', label: 'США', names: ['us', 'usa', 'united states', 'abd', 'сша'] },
  { code: 'CA', label: 'Канада', names: ['ca', 'canada', 'kanada', 'канада'] },
];

const CATALOG_BY_CODE = new Map(MARKET_CATALOG.map((m) => [m.code, m]));
/** Только реальные ISO-коды рынков из каталога — чтобы токен не ловил случайные аббревиатуры. */
const KNOWN_CODES = new Set(MARKET_CATALOG.map((m) => m.code));

/**
 * Короткие (2-3 симв.) алиасы, которые совпадают с обычными словами EN (be/it/at/no/by/us) —
 * их разрешаем распознавать ТОЛЬКО если они стоят самым первым токеном названия кампании
 * (там это почти всегда осознанный тег рынка), но НЕ где-то в середине текста, чтобы не поймать
 * случайное слово ("to be confirmed", "by request" и т.п.).
 */
const AMBIGUOUS_SHORT_CODES = new Set(['BE', 'IT', 'AT', 'NO', 'BY', 'US']);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shortAliasesForCode(code: string): string[] {
  const entry = CATALOG_BY_CODE.get(code);
  const names = entry?.names || [];
  return [...new Set([code, ...names.filter((n) => n.length <= 3).map((n) => n.toUpperCase())])];
}

/** Кэш скомпилированных регэкспов на код рынка (tier1: строго первый токен; tier2: где угодно в первых ~40 символах). */
const TAG_REGEX_CACHE = new Map<string, { first: RegExp; anywhere: RegExp | null }>();

function tagRegexFor(code: string): { first: RegExp; anywhere: RegExp | null } {
  const cached = TAG_REGEX_CACHE.get(code);
  if (cached) return cached;
  const shorts = shortAliasesForCode(code).map(escapeRegex);
  const alt = shorts.join('|');
  const first = new RegExp(`^(?:${alt})(?:[\\s\\-_/]|$)`, 'i');
  const anywhere = AMBIGUOUS_SHORT_CODES.has(code)
    ? null
    : new RegExp(`(^|[\\s\\-_/])(?:${alt})(?:[\\s\\-_/]|$)`, 'i');
  const built = { first, anywhere };
  TAG_REGEX_CACHE.set(code, built);
  return built;
}

/**
 * Приводит свободный текст пользователя/модели ("Великобритания", "uk", "gb") к ISO2-коду рынка
 * из каталога. Возвращает null, если код неизвестен — вызывающий код НЕ должен молча
 * игнорировать фильтр в этом случае, а обязан сообщить, что рынок не распознан.
 */
export function resolveMarketQuery(raw: string | null | undefined): string | null {
  const q = (raw || '').trim().toLowerCase();
  if (!q) return null;
  const asCode = q.toUpperCase();
  if (KNOWN_CODES.has(asCode)) return asCode;
  for (const m of MARKET_CATALOG) {
    if (m.names.includes(q)) return m.code;
  }
  // Фоллбэк на падежные формы RU ("Великобритании", "Англии", "Турцию" — модель может
  // передать текст пользователя как есть, не приводя к именительному падежу): сравниваем
  // по общему стему словарной формы, а не по точному совпадению строки.
  for (const m of MARKET_CATALOG) {
    for (const name of m.names) {
      if (!/[а-яё]/i.test(name) || name.length < 5) continue;
      const stem = name.slice(0, Math.max(5, name.length - 2));
      if (q.length >= stem.length && q.startsWith(stem)) return m.code;
    }
  }
  return null;
}

export function marketLabel(code: string): string {
  return CATALOG_BY_CODE.get(code)?.label || code;
}

/**
 * Достаёт тег рынка из названия кампании: строгий разбор первого токена ("LV - Search - ...",
 * "UK_gdn_eb_2026") плюс поиск короткого алиаса в первых ~40 символах для схем вида
 * "WOXX_SHR_UK_EN_Search_Branding" или "hyb_de_mlcpc_travel" (агентство не всегда ставит код
 * рынка первым). Неоднозначные 2-буквенные алиасы (be/it/at/no/by/us — совпадают с обычными
 * английскими словами) распознаются ТОЛЬКО как самый первый токен, чтобы не поймать случайное
 * слово из остального текста кампании.
 */
export function extractCampaignMarketTag(campaign: string | null | undefined): string | null {
  const s = (campaign || '').trim();
  if (!s) return null;
  const head = s.slice(0, 40);
  for (const code of KNOWN_CODES) {
    const { first } = tagRegexFor(code);
    if (first.test(head)) return code;
  }
  for (const code of KNOWN_CODES) {
    const { anywhere } = tagRegexFor(code);
    if (anywhere && anywhere.test(head)) return code;
  }
  return null;
}

/**
 * "Пустая" метка кампании — визит без атрибуции конкретной рекламной кампании ((direct),
 * (referral), (organic), (not set), (ai-assistant), либо сырой числовой id кампании). Только
 * для таких строк у нас нет НИКАКОГО сигнала о целевом рынке, кроме страны визита из GA4.
 */
function isGenericCampaignLabel(campaign: string | null | undefined): boolean {
  const s = (campaign || '').trim();
  if (!s) return true;
  if (/^\(.*\)$/.test(s)) return true;
  if (/^\d+$/.test(s)) return true;
  return false;
}

/**
 * Определяет рынок одной строки трафика/расхода: сперва тег/текст кампании (см.
 * extractCampaignMarketTag и поиск имени страны в тексте) — это то, ЧТО РЕКЛАМОДАТЕЛЬ
 * целенаправленно таргетировал и на что потратил бюджет; страна визита из GA4 (country)
 * используется ТОЛЬКО как запасной вариант для строк без названия кампании (direct/referral/
 * organic/не заданная кампания) — иначе кликнувший из Британии по кампании "RO - ..." (Румыния)
 * ошибочно засчитывался бы в бюджет рынка GB, хотя таргетировался и оплачивался рынок RO.
 * Возвращает null, если рынок не удалось определить — такие строки должны попадать в
 * "unclassified", а не молча теряться или засчитываться не в тот рынок.
 */
export function resolveRowMarket(
  campaign: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const tag = extractCampaignMarketTag(campaign);
  if (tag) return tag;
  const text = (campaign || '').toLowerCase();
  if (text) {
    for (const m of MARKET_CATALOG) {
      for (const name of m.names) {
        if (name.length < 3) continue; // избегаем ложных срабатываний на 2-буквенных кодах внутри текста
        const idx = text.indexOf(name);
        if (idx === -1) continue;
        const before = idx === 0 ? ' ' : text[idx - 1];
        const after = idx + name.length >= text.length ? ' ' : text[idx + name.length];
        const isWordChar = (ch: string) => /[a-zа-яё0-9]/i.test(ch);
        if (!isWordChar(before) && !isWordChar(after)) return m.code;
      }
    }
  }
  if (isGenericCampaignLabel(campaign)) {
    const c = (country || '').trim().toUpperCase();
    if (c && KNOWN_CODES.has(c)) return c;
  }
  return null;
}

/**
 * true, если строка (кампания/страна) относится к запрошенному рынку `marketCode`.
 * Используется для server-side фильтрации в JS-слое поверх уже сгруппированных строк.
 */
export function rowMatchesMarket(
  campaign: string | null | undefined,
  country: string | null | undefined,
  marketCode: string,
): boolean {
  return resolveRowMarket(campaign, country) === marketCode.toUpperCase();
}

/**
 * Regex-фрагменты (Postgres ARE, для оператора ~*) для SQL-фильтрации по рынку — зеркалит
 * логику extractCampaignMarketTag (tier1: первый токен; tier2: где угодно в первых 40 символах,
 * кроме неоднозначных алиасов) плюс отдельно вхождение полного имени страны в текст.
 */
export function buildMarketRegexPatterns(code: string): {
  prefix: string;
  names: string | null;
} {
  const upperCode = code.toUpperCase();
  // Всё в нижнем регистре (кроме regex-синтаксиса \s \m \M ^ $ — их регистр значим для Postgres):
  // паттерн матчится через LOWER(t.campaign) ~ (не ~*), т.к. ~* не приводит турецкую İ к "i".
  const shorts = shortAliasesForCode(upperCode).map((s) => escapeRegex(s.toLowerCase()));
  const alt = shorts.join('|');
  const firstTokenPattern = `^(?:${alt})[\\s\\-_/]`;
  const anywherePattern = AMBIGUOUS_SHORT_CODES.has(upperCode)
    ? null
    : `(^|[\\s_/-])(?:${alt})([\\s_/-]|$)`;
  const prefix = anywherePattern
    ? `(${firstTokenPattern})|(${anywherePattern})`
    : firstTokenPattern;

  const entry = CATALOG_BY_CODE.get(upperCode);
  const longNames = (entry?.names || []).filter((n) => n.length >= 3).map(escapeRegex);
  return {
    prefix,
    names: longNames.length ? `\\m(${longNames.join('|')})\\M` : null,
  };
}
