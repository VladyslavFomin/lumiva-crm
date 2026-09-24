/**
 * Курсы валют для сумм на главной: любые суммы (проекты/лиды/продажи) приводятся к одной валюте
 * отчёта по актуальному курсу, а не складываются числами разных валют. Валюта отчёта и курсы —
 * те же, что на страницах аналитики (marketingDisplayCurrencyStorage + GET /marketing/fx-rates).
 * Раньше главная брала курсы только из localStorage, куда их клал экран аналитики, — если его
 * ни разу не открывали, курсов не было и суммы молча складывались как есть.
 */
import { fetchMarketingFxRates } from '../api/marketing';
import { fetchCompanySettings } from '../api/settings';
import {
  convertMarketingAmount,
  loadMarketingDisplayCurrency,
  normalizeMarketingDisplayCurrency,
  saveMarketingDisplayCurrency,
} from '../pages/marketing/marketingDisplayCurrencyStorage';

const PREFS_KEY = 'lumiva_crm_marketing_display_currency_v1';
const FX_TTL_MS = 5 * 60 * 1000;

export type DashboardFx = {
  /** Валюта, в которую приведены все суммы */
  currency: string;
  /** Валюты, для которых курса не нашлось — их суммы остались как есть (нужно предупредить) */
  missing: string[];
  /** Множители «исходная валюта → валюта отчёта» (для кода, что вызывает convertMarketingAmount сам) */
  rates: Record<string, number>;
  convert: (amount: number, fromCurrency?: string | null) => number;
};

function hasSavedPrefs(): boolean {
  try {
    return localStorage.getItem(PREFS_KEY) != null;
  } catch {
    return true;
  }
}

/** Основная валюта компании — но только пока пользователь сам не выбрал «Валюту отчёта»
 * (иначе null): тогда её и надо использовать по умолчанию вместо жёсткого EUR. */
export async function resolveDefaultDisplayCurrency(): Promise<string | null> {
  if (hasSavedPrefs()) return null;
  try {
    const settings = await fetchCompanySettings({ skipUnauthorizedRedirect: true });
    return settings.primaryCurrency ? normalizeMarketingDisplayCurrency(settings.primaryCurrency) : null;
  } catch {
    return null;
  }
}

let cached: { at: number; promise: Promise<DashboardFx> } | null = null;

async function build(): Promise<DashboardFx> {
  const prefs = loadMarketingDisplayCurrency();
  let display = normalizeMarketingDisplayCurrency(prefs.displayCurrency);

  // Пока пользователь сам не выбирал «Валюту отчёта» — берём основную валюту компании.
  display = (await resolveDefaultDisplayCurrency()) ?? display;

  let rates: Record<string, number> = prefs.displayCurrency === display ? { ...prefs.rates } : {};
  try {
    const fx = await fetchMarketingFxRates(display);
    rates = { ...fx.multiplyToDisplay };
    // Сохраняем только для режима «converted»: для «как в данных» пользователь выбрал не
    // пересчитывать маркетинг, и трогать его настройку отсюда нельзя.
    if (prefs.currencyMode === 'converted') {
      saveMarketingDisplayCurrency({
        ...prefs,
        displayCurrency: display,
        rates,
        fxAsOf: fx.asOf,
        fxSource: fx.source,
        availableDisplayCurrencies: fx.availableDisplayCurrencies,
      });
    }
  } catch {
    /* сеть/сервер недоступны — работаем на последних сохранённых курсах */
  }
  rates[display] = 1;

  const missing = new Set<string>();
  return {
    currency: display,
    rates,
    get missing() {
      return [...missing];
    },
    convert(amount, fromCurrency) {
      const n = Number(amount) || 0;
      if (!n) return 0;
      // Без валюты в данных везде в проекте принято считать EUR (как в analytics-страницах).
      const from = (fromCurrency || 'EUR').toUpperCase();
      const res = convertMarketingAmount(n, from, 'converted', display, rates);
      if (res.missingRate) missing.add(from);
      return res.value;
    },
  };
}

export function loadDashboardFx(): Promise<DashboardFx> {
  const now = Date.now();
  if (cached && now - cached.at < FX_TTL_MS) return cached.promise;
  const promise = build();
  cached = { at: now, promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

/** Сбросить кэш (например, после смены валюты отчёта на странице аналитики). */
export function resetDashboardFxCache(): void {
  cached = null;
}
