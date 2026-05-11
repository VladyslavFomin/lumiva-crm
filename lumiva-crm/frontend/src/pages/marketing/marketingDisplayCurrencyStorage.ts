export type MarketingCurrencyMode = 'native' | 'converted';

const STORAGE_KEY = 'lumiva_crm_marketing_display_currency_v1';

/**
 * Fallback для выпадающих списков до первого ответа `/marketing/fx-rates`.
 * Полный список приходит как `availableDisplayCurrencies`.
 */
export const MARKETING_ALLOWED_CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'PLN',
  'TRY',
  'RUB',
  'SEK',
  'NOK',
  'DKK',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'JPY',
  'CAD',
  'AUD',
  'NZD',
] as const;

/** Подсказки для выбора валюты интеграции (не исчерпывающий список). */
export const MARKETING_ISO_CURRENCY_SUGGESTIONS = [
  ...MARKETING_ALLOWED_CURRENCIES,
  'CNY',
  'HKD',
  'SGD',
  'INR',
  'BRL',
  'MXN',
  'ZAR',
  'ILS',
  'THB',
] as const;

export type MarketingDisplayCurrencyState = {
  currencyMode: MarketingCurrencyMode;
  displayCurrency: string;
  /** Множитель: сумма в валюте отображения = сумма_в_исходной × rates[исходная] */
  rates: Record<string, number>;
  fxAsOf?: string;
  fxSource?: string;
  /** С бэкенда (Frankfurter/ECB) — валюты, доступные как валюта отчёта */
  availableDisplayCurrencies?: string[];
};

const defaultState: MarketingDisplayCurrencyState = {
  currencyMode: 'converted',
  displayCurrency: 'EUR',
  rates: {},
};

/** Нормализация ISO 4217 для валюты отчёта (любой код из ответа Frankfurter). */
export function normalizeMarketingDisplayCurrency(code: string): string {
  const c = (code || 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return /^[A-Z]{3}$/.test(c) ? c : 'EUR';
}

export function loadMarketingDisplayCurrency(): MarketingDisplayCurrencyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const p = JSON.parse(raw) as Partial<MarketingDisplayCurrencyState>;
    const displayCurrency = normalizeMarketingDisplayCurrency(p.displayCurrency || 'EUR');
    let availableDisplayCurrencies: string[] | undefined;
    if (Array.isArray(p.availableDisplayCurrencies)) {
      availableDisplayCurrencies = p.availableDisplayCurrencies
        .map((x) => normalizeMarketingDisplayCurrency(String(x)))
        .filter((x, i, a) => a.indexOf(x) === i);
    }
    return {
      currencyMode: p.currencyMode === 'native' ? 'native' : 'converted',
      displayCurrency,
      rates: typeof p.rates === 'object' && p.rates && !Array.isArray(p.rates) ? p.rates : {},
      fxAsOf: typeof p.fxAsOf === 'string' ? p.fxAsOf : undefined,
      fxSource: typeof p.fxSource === 'string' ? p.fxSource : undefined,
      availableDisplayCurrencies,
    };
  } catch {
    return { ...defaultState };
  }
}

export function saveMarketingDisplayCurrency(s: MarketingDisplayCurrencyState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/** Коэффициент: 1 единица fromCur → столько единиц displayCur (как отдаёт /marketing/fx-rates). */
export function convertMarketingAmount(
  amount: number,
  fromCur: string,
  mode: MarketingCurrencyMode,
  displayCur: string,
  rates: Record<string, number>,
): { value: number; currency: string; missingRate: boolean } {
  const fromRaw = normalizeMarketingDisplayCurrency(fromCur || 'EUR');
  const display = normalizeMarketingDisplayCurrency(displayCur || 'EUR');
  if (mode === 'native') {
    return { value: amount, currency: fromRaw, missingRate: false };
  }
  if (fromRaw === display) {
    return { value: amount, currency: display, missingRate: false };
  }
  const r = rates[fromRaw];
  if (r == null || !Number.isFinite(r) || r <= 0) {
    return { value: amount, currency: fromRaw, missingRate: true };
  }
  return { value: amount * r, currency: display, missingRate: false };
}
