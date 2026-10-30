/** ISO 3166-1 alpha-2 — тот же список, что backend/src/common/countries.ts. Названия — из Intl.DisplayNames. */
export const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF ' +
  'CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH ' +
  'GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW ' +
  'KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG ' +
  'NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN ' +
  'SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE ' +
  'YT ZA ZM ZW'
).split(' ');

/** Частые для курортных отелей Турции страны — наверху списка. */
export const POPULAR_COUNTRIES = ['TR', 'DE', 'RU', 'GB', 'NL', 'PL', 'UA', 'KZ', 'AT', 'CH', 'SE', 'BE', 'FR', 'IL', 'US'];

/** Готовые наборы для рынков. */
export const COUNTRY_GROUPS: Record<string, string[]> = {
  cis: ['RU', 'BY', 'KZ', 'UZ', 'KG', 'TJ', 'AM', 'AZ', 'MD', 'UA', 'GE', 'TM'],
  dach: ['DE', 'AT', 'CH'],
  benelux: ['BE', 'NL', 'LU'],
  scandinavia: ['SE', 'NO', 'DK', 'FI', 'IS'],
  uk_ie: ['GB', 'IE'],
  eastern_europe: ['PL', 'CZ', 'SK', 'HU', 'RO', 'BG'],
  middle_east: ['IL', 'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB'],
};

const cache = new Map<string, Intl.DisplayNames | null>();
function displayNames(lang: string): Intl.DisplayNames | null {
  if (!cache.has(lang)) {
    try {
      cache.set(lang, new Intl.DisplayNames([lang], { type: 'region' }));
    } catch {
      cache.set(lang, null);
    }
  }
  return cache.get(lang) ?? null;
}

export function countryName(code: string | null | undefined, lang: string): string {
  if (!code) return '';
  const c = code.toUpperCase();
  if (c === 'XK') return lang.startsWith('ru') ? 'Косово' : lang.startsWith('tr') ? 'Kosova' : 'Kosovo';
  return displayNames(lang.slice(0, 2))?.of(c) || c;
}

/** Эмодзи-флаг из кода страны (региональные индикаторы). */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...code.toUpperCase().split('').map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function countryLabel(code: string | null | undefined, lang: string): string {
  if (!code) return '';
  return `${countryFlag(code)} ${countryName(code, lang)}`;
}

/** Все страны, отсортированные по названию на языке интерфейса; популярные — первыми. */
export function countryOptions(lang: string): Array<{ code: string; name: string }> {
  const all = COUNTRY_CODES.map((code) => ({ code, name: countryName(code, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang));
  const pop = POPULAR_COUNTRIES.map((code) => all.find((x) => x.code === code)!).filter(Boolean);
  return [...pop, ...all.filter((x) => !POPULAR_COUNTRIES.includes(x.code))];
}
