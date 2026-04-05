export type MarketingCurrencyMode = 'native' | 'converted';

const STORAGE_KEY = 'lumiva_crm_marketing_display_currency_v1';

/** Только поддерживаемые в маркетинге валюты (и на бэкенде FX). */
export const MARKETING_ALLOWED_CURRENCIES = ['EUR', 'GBP', 'TRY', 'RUB'] as const;
export type MarketingAllowedCurrency = (typeof MARKETING_ALLOWED_CURRENCIES)[number];

export type MarketingDisplayCurrencyState = {
  currencyMode: MarketingCurrencyMode;
  displayCurrency: string;
  /** Множитель: сумма в валюте отображения = сумма_в_исходной × rates[исходная] */
  rates: Record<string, number>;
  fxAsOf?: string;
  fxSource?: string;
};

const defaultState: MarketingDisplayCurrencyState = {
  currencyMode: 'converted',
  displayCurrency: 'EUR',
  rates: {},
};

export function normalizeMarketingDisplayCurrency(code: string): MarketingAllowedCurrency {
  const c = (code || 'EUR').toUpperCase().slice(0, 8);
  return (MARKETING_ALLOWED_CURRENCIES as readonly string[]).includes(c)
    ? (c as MarketingAllowedCurrency)
    : 'EUR';
}

export function loadMarketingDisplayCurrency(): MarketingDisplayCurrencyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const p = JSON.parse(raw) as Partial<MarketingDisplayCurrencyState>;
    const displayCurrency = normalizeMarketingDisplayCurrency(p.displayCurrency || 'EUR');
    return {
      currencyMode: p.currencyMode === 'native' ? 'native' : 'converted',
      displayCurrency,
      rates: typeof p.rates === 'object' && p.rates && !Array.isArray(p.rates) ? p.rates : {},
      fxAsOf: typeof p.fxAsOf === 'string' ? p.fxAsOf : undefined,
      fxSource: typeof p.fxSource === 'string' ? p.fxSource : undefined,
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
  const fromRaw = (fromCur || 'EUR').toUpperCase().slice(0, 8) || 'EUR';
  const display = normalizeMarketingDisplayCurrency(displayCur);
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
