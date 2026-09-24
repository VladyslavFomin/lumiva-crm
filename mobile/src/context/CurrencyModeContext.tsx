import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { fetchProjectCurrencyDefs, ProjectCurrencyDef } from '../api/projectSettings';
import { appLocale, compactUnits, formatDecimal } from '../i18n/format';

export type CurrencyDisplayMode = 'native' | 'converted';

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', RUB: '₽', TRY: '₺', GBP: '£' };

interface FxRatesResponse {
  display: string;
  multiplyToDisplay: Record<string, number>;
}

/** Query params every FX-aware backend endpoint expects (`/sales/analytics`, `/products/analytics`, `/leads/roi`).
 *  Same contract the website sends: without `rates` the server can't convert anything (sales silently drop to 0,
 *  products treat 1 TRY as 1 EUR). */
export interface FxParams {
  currencyMode: CurrencyDisplayMode;
  displayCurrency: string;
  rates: string;
}

interface CurrencyModeApi {
  cur: string;
  mode: CurrencyDisplayMode;
  codes: string[];
  /** Raw multiplier map (record currency → display currency), display currency itself pinned to 1. */
  rates: Record<string, number>;
  fxParams: FxParams;
  /** Stable string that changes whenever a refetch of FX-dependent data is needed. */
  fxKey: string;
  /** False until the tenant's currency list and the rates for the current display currency have loaded —
   *  FX-dependent screens must wait for this, otherwise they fetch once with empty rates (wrong numbers). */
  ready: boolean;
  setMode: (m: CurrencyDisplayMode) => void;
  cycleCurrency: () => void;
  symbol: (code?: string) => string;
  /** Mirrors the design's `fmt(amount, recordCurrency, opts)` — converts to `cur` when mode is 'converted', shows as-is (record's own currency) when 'native'. */
  fmt: (amount: number, recordCurrency?: string, opts?: { short?: boolean }) => string;
  /** Raw numeric conversion to the current display currency — for summing amounts across mixed-currency records before formatting. */
  toDisplay: (amount: number, recordCurrency?: string) => number;
}

const Ctx = createContext<CurrencyModeApi | null>(null);

function formatAmount(v: number, sym: string, short?: boolean): string {
  const rounded = Math.round(v);
  if (short && Math.abs(rounded) >= 1000) {
    const { thousand, million } = compactUnits();
    if (Math.abs(rounded) >= 1e6) return `${sym}${formatDecimal(rounded / 1e6, Math.abs(rounded) / 1e6 >= 10 ? 0 : 1)}${million}`;
    return `${sym}${Math.round(rounded / 1000)}${thousand}`;
  }
  return `${sym}${rounded.toLocaleString(appLocale())}`;
}

export const CurrencyModeProvider: React.FC<{ children: React.ReactNode; enabled?: boolean }> = ({ children, enabled = true }) => {
  const [codes, setCodes] = useState<string[]>(['EUR']);
  const [cur, setCur] = useState('EUR');
  const [mode, setMode] = useState<CurrencyDisplayMode>('converted');
  const [rawRates, setRawRates] = useState<Record<string, number>>({});
  const [defsLoaded, setDefsLoaded] = useState(false);
  // Which display currency `rawRates` were fetched for — guards against using stale rates for the new currency.
  const [ratesFor, setRatesFor] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setDefsLoaded(false);
    setRatesFor(null);
    fetchProjectCurrencyDefs()
      .then((defs: ProjectCurrencyDef[]) => {
        if (defs.length === 0) return;
        setCodes(defs.map((d) => d.code));
        const def = defs.find((d) => d.isDefault) || defs[0];
        setCur(def.code);
      })
      .catch(() => {})
      .finally(() => setDefsLoaded(true));
  }, [enabled]);

  // Rates are needed in 'native' mode too: totals across rows of different currencies (marketing) still have to be summed in one.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api.get<FxRatesResponse>('/marketing/fx-rates', { params: { display: cur } })
      .then((res) => { if (!cancelled) { setRawRates(res.data.multiplyToDisplay || {}); setRatesFor(cur); } })
      .catch(() => { if (!cancelled) { setRawRates({}); setRatesFor(cur); } });
    return () => { cancelled = true; };
  }, [cur, enabled]);

  const rates = useMemo(() => (ratesFor === cur ? { ...rawRates, [cur]: 1 } : { [cur]: 1 }), [rawRates, ratesFor, cur]);
  const ready = defsLoaded && ratesFor === cur;
  const fxParams = useMemo<FxParams>(() => ({ currencyMode: mode, displayCurrency: cur, rates: JSON.stringify(rates) }), [mode, cur, rates]);
  const fxKey = `${mode}:${cur}:${ready ? 1 : 0}`;

  const cycleCurrency = useCallback(() => {
    setCur((c) => {
      const i = codes.indexOf(c);
      return codes[(i + 1) % codes.length] || c;
    });
  }, [codes]);

  const symbol = useCallback((code?: string) => SYMBOLS[code || cur] || (code || cur), [cur]);

  const fmt = useCallback((amount: number, recordCurrency?: string, opts?: { short?: boolean }) => {
    const rc = recordCurrency || cur;
    if (mode === 'native') return formatAmount(amount, symbol(rc), opts?.short);
    if (rc === cur) return formatAmount(amount, symbol(cur), opts?.short);
    const rate = rates[rc];
    // No rate for this currency: keep the record's own currency instead of mislabelling the raw number
    // as the display currency (same as the website's `convertMarketingAmount` → `missingRate`).
    if (!rate) return formatAmount(amount, symbol(rc), opts?.short);
    return formatAmount(amount * rate, symbol(cur), opts?.short);
  }, [cur, mode, rates, symbol]);

  const toDisplay = useCallback((amount: number, recordCurrency?: string) => {
    const rc = recordCurrency || cur;
    if (rc === cur) return amount;
    const rate = rates[rc];
    return rate ? amount * rate : amount;
  }, [cur, rates]);

  const value = useMemo<CurrencyModeApi>(
    () => ({ cur, mode, codes, rates, fxParams, fxKey, ready, setMode, cycleCurrency, symbol, fmt, toDisplay }),
    [cur, mode, codes, rates, fxParams, fxKey, ready, cycleCurrency, symbol, fmt, toDisplay],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useCurrencyMode(): CurrencyModeApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCurrencyMode must be used within CurrencyModeProvider');
  return ctx;
}
