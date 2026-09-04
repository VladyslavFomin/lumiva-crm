import React from 'react';
import {
  MARKETING_ALLOWED_CURRENCIES,
  normalizeMarketingDisplayCurrency,
  type MarketingDisplayCurrencyState,
} from '../pages/marketing/marketingDisplayCurrencyStorage';

function currencyOptionList(state: MarketingDisplayCurrencyState): string[] {
  const api = state.availableDisplayCurrencies;
  const base = api?.length ? [...api] : [...MARKETING_ALLOWED_CURRENCIES];
  const dc = normalizeMarketingDisplayCurrency(state.displayCurrency);
  const set = new Set(base);
  set.add(dc);
  return [...set].sort();
}

type AnalyticsCurrencyControlProps = {
  state: MarketingDisplayCurrencyState;
  onStateChange: (state: MarketingDisplayCurrencyState) => void;
  variant?: 'light' | 'dark';
  className?: string;
  showMeta?: boolean;
};

export const AnalyticsCurrencyControl: React.FC<AnalyticsCurrencyControlProps> = ({
  state,
  onStateChange,
  variant = 'light',
  className = '',
  showMeta = false,
}) => {
  const isDark = variant === 'dark';
  const displayCurrency = normalizeMarketingDisplayCurrency(state.displayCurrency);
  const shellClass = isDark
    ? 'inline-flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-300'
    : 'inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm';
  const labelClass = isDark
    ? 'text-slate-500'
    : 'font-mono text-xs uppercase tracking-[0.16em] text-neutral-400';
  const selectClass = isDark
    ? 'bg-transparent font-semibold text-slate-100 outline-none'
    : 'bg-transparent font-medium text-[#222] outline-none';
  const metaClass = isDark ? 'text-slate-500' : 'text-neutral-400';

  return (
    <div className={`${shellClass} ${className}`.trim()}>
      <span className={labelClass}>Валюта отчёта</span>
      <select
        className={selectClass}
        value={displayCurrency}
        onChange={(event) => {
          const nextCurrency = normalizeMarketingDisplayCurrency(event.target.value);
          onStateChange({
            ...state,
            currencyMode: 'converted',
            displayCurrency: nextCurrency,
            // Начинаем с чистой карты курсов, а не мёрджим со старой: иначе курс-заглушка
            // предыдущей выбранной валюты (тоже [prevCurrency]: 1, когда та была целью)
            // остаётся в объекте и молча принимается за настоящий курс конвертации в неё,
            // выдавая неверную (но не помеченную как missingRate) сумму до ответа /fx-rates.
            rates: { [nextCurrency]: 1 },
          });
        }}
      >
        {currencyOptionList(state).map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </select>
      {showMeta && (
        <span className={metaClass}>
          {state.fxAsOf ? `${state.fxSource ?? 'ECB'} · ${state.fxAsOf}` : 'курс загружается'}
        </span>
      )}
    </div>
  );
};
