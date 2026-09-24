import { Lang, DEFAULT_LANG } from './translations';

// Numbers, dates and times must follow the language picked in the app, not a hardcoded Russian locale.
// Formatting happens all over the codebase outside React (API mappers, StyleSheet-free helpers, memo callbacks),
// so the active locale lives in a tiny module-level holder that `LanguageProvider` keeps in sync — and updates
// synchronously during render, so every component rendered after a language switch already sees the new value.
const LOCALES: Record<Lang, string> = { ru: 'ru-RU', en: 'en-US', tr: 'tr-TR' };

let currentLang: Lang = DEFAULT_LANG;

export function setFormatLang(lang: Lang): void {
  currentLang = lang;
}

/** BCP-47 locale for `toLocaleString` / `Intl.*` of the currently selected app language. */
export function appLocale(): string {
  return LOCALES[currentLang];
}

/** Fixed-decimals number in the current locale (`12,3` in ru/tr, `12.3` in en) — replaces `toFixed(n).replace('.', ',')`. */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString(appLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const COMPACT_UNITS: Record<Lang, { thousand: string; million: string }> = {
  ru: { thousand: ' тыс', million: ' млн' },
  en: { thousand: 'K', million: 'M' },
  tr: { thousand: ' B', million: ' Mn' },
};

/** Magnitude suffixes for short money (`€5 тыс` / `€5K` / `€5 B`). */
export function compactUnits(): { thousand: string; million: string } {
  return COMPACT_UNITS[currentLang];
}
