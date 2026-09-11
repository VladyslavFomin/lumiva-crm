import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { fetchProjectCurrencyDefs, ProjectCurrencyDef } from '../api/projectSettings';

export type CurrencyDisplayMode = 'native' | 'converted';

const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', RUB: '₽', TRY: '₺', GBP: '£' };

interface FxRatesResponse {
  display: string;
  multiplyToDisplay: Record<string, number>;
}

interface CurrencyModeApi {
  cur: string;
  mode: CurrencyDisplayMode;
  codes: string[];
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
    if (Math.abs(rounded) >= 1e6) return `${sym}${(rounded / 1e6).toFixed(Math.abs(rounded) / 1e6 >= 10 ? 0 : 1)} млн`;
    return `${sym}${Math.round(rounded / 1000)} тыс`;
  }
  return `${sym}${rounded.toLocaleString('ru-RU')}`;
}

export const CurrencyModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [codes, setCodes] = useState<string[]>(['EUR']);
  const [cur, setCur] = useState('EUR');
  const [mode, setMode] = useState<CurrencyDisplayMode>('converted');
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchProjectCurrencyDefs()
      .then((defs: ProjectCurrencyDef[]) => {
        if (defs.length === 0) return;
        setCodes(defs.map((d) => d.code));
        const def = defs.find((d) => d.isDefault) || defs[0];
        setCur(def.code);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== 'converted') return;
    api.get<FxRatesResponse>('/marketing/fx-rates', { params: { display: cur } })
      .then((res) => setRates(res.data.multiplyToDisplay || {}))
      .catch(() => setRates({}));
  }, [mode, cur]);

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
    const converted = rate ? amount * rate : amount;
    return formatAmount(converted, symbol(cur), opts?.short);
  }, [cur, mode, rates, symbol]);

  const toDisplay = useCallback((amount: number, recordCurrency?: string) => {
    const rc = recordCurrency || cur;
    if (rc === cur) return amount;
    const rate = rates[rc];
    return rate ? amount * rate : amount;
  }, [cur, rates]);

  const value = useMemo<CurrencyModeApi>(() => ({ cur, mode, codes, setMode, cycleCurrency, symbol, fmt, toDisplay }), [cur, mode, codes, cycleCurrency, symbol, fmt, toDisplay]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useCurrencyMode(): CurrencyModeApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCurrencyMode must be used within CurrencyModeProvider');
  return ctx;
}
