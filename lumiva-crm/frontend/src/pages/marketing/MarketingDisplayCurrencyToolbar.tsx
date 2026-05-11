import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMarketingFxRates } from '../../api/marketing';
import {
  MARKETING_ALLOWED_CURRENCIES,
  type MarketingCurrencyMode,
  type MarketingDisplayCurrencyState,
  loadMarketingDisplayCurrency,
  normalizeMarketingDisplayCurrency,
  saveMarketingDisplayCurrency,
} from './marketingDisplayCurrencyStorage';
import {
  marketingChipActive,
  marketingChipInactive,
  marketingFilterBar,
  marketingFilterLabel,
} from './marketingPageChrome';

const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-[#222222] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-black';
const btnGhost =
  'rounded-xl border border-[#222222]/14 bg-white px-3 py-2 text-[11px] font-medium text-[#222222] hover:bg-slate-50';

export function useMarketingDisplayCurrencyPrefs(_currenciesPresent: string[]) {
  const [state, setStateInternal] = useState<MarketingDisplayCurrencyState>(() =>
    loadMarketingDisplayCurrency(),
  );

  useEffect(() => {
    setStateInternal((prev) => ({
      ...prev,
      displayCurrency: normalizeMarketingDisplayCurrency(prev.displayCurrency),
    }));
  }, []);

  useEffect(() => {
    if (state.currencyMode !== 'converted') return;
    let cancelled = false;
    fetchMarketingFxRates(state.displayCurrency)
      .then((fx) => {
        if (cancelled) return;
        setStateInternal((prev) => {
          const next: MarketingDisplayCurrencyState = {
            ...prev,
            rates: { ...fx.multiplyToDisplay },
            fxAsOf: fx.asOf,
            fxSource: fx.source,
            availableDisplayCurrencies: fx.availableDisplayCurrencies,
          };
          saveMarketingDisplayCurrency(next);
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.displayCurrency, state.currencyMode]);

  const setState = useCallback((s: MarketingDisplayCurrencyState) => {
    const normalized: MarketingDisplayCurrencyState = {
      ...s,
      displayCurrency: normalizeMarketingDisplayCurrency(s.displayCurrency),
    };
    saveMarketingDisplayCurrency(normalized);
    setStateInternal(normalized);
  }, []);

  return { state, setState };
}

export type MarketingDisplayCurrencyToolbarProps = {
  currenciesPresent: string[];
  state: MarketingDisplayCurrencyState;
  onStateChange: (s: MarketingDisplayCurrencyState) => void;
};

export const MarketingDisplayCurrencyToolbar: React.FC<MarketingDisplayCurrencyToolbarProps> = ({
  state,
  onStateChange,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MarketingDisplayCurrencyState>(state);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft({ ...state, rates: { ...state.rates } });
      setFxError(null);
    }
  }, [open, state]);

  const pullFx = useCallback(
    async (display: string, force = false) => {
      setFxLoading(true);
      setFxError(null);
      try {
        const fx = await fetchMarketingFxRates(normalizeMarketingDisplayCurrency(display), {
          force,
        });
        setDraft((d) => ({
          ...d,
          displayCurrency: fx.display,
          rates: { ...fx.multiplyToDisplay },
          fxAsOf: fx.asOf,
          fxSource: fx.source,
          availableDisplayCurrencies: fx.availableDisplayCurrencies,
        }));
      } catch (e: unknown) {
        setFxError(e instanceof Error ? e.message : t('crm.marketingCurrency.fxError', { defaultValue: 'Не удалось загрузить курсы' }));
      } finally {
        setFxLoading(false);
      }
    },
    [t],
  );

  const currencySelectCodes = useMemo(() => {
    const base =
      draft.availableDisplayCurrencies && draft.availableDisplayCurrencies.length > 0
        ? [...draft.availableDisplayCurrencies]
        : [...MARKETING_ALLOWED_CURRENCIES];
    const set = new Set(base);
    set.add(normalizeMarketingDisplayCurrency(draft.displayCurrency));
    return [...set].sort();
  }, [draft.availableDisplayCurrencies, draft.displayCurrency]);

  const ratePreviewCodes = useMemo(() => {
    return Object.keys(draft.rates)
      .filter((c) => c !== normalizeMarketingDisplayCurrency(draft.displayCurrency))
      .sort();
  }, [draft.rates, draft.displayCurrency]);

  const summary = useMemo(() => {
    if (state.currencyMode === 'native') {
      return t('crm.marketingCurrency.toolbar.native', { defaultValue: 'Как в данных' });
    }
    return t('crm.marketingCurrency.toolbar.convertedTo', {
      code: state.displayCurrency,
      defaultValue: 'В {{code}}',
    });
  }, [state.currencyMode, state.displayCurrency, t]);

  return (
    <>
      <div className={`${marketingFilterBar} flex-wrap items-center`}>
        <span className={marketingFilterLabel}>
          {t('crm.marketingCurrency.toolbar.label', { defaultValue: 'Валюта отчёта' })}
        </span>
        <span className="text-[11px] font-medium text-[#222222]/70 tabular-nums">{summary}</span>
        {state.currencyMode === 'converted' && state.fxAsOf && (
          <span className="text-[10px] text-[#222222]/45">
            {t('crm.marketingCurrency.toolbar.fxAsOf', {
              defaultValue: '{{source}} {{date}}',
              source: state.fxSource ?? 'ECB',
              date: state.fxAsOf,
            })}
          </span>
        )}
        <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
          {t('crm.marketingCurrency.toolbar.configure', { defaultValue: 'Настроить' })}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mkt-cur-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#222222]/12 bg-white shadow-[0_24px_80px_rgba(34,34,34,0.18)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#222222]/10 px-5 py-4">
              <h2 id="mkt-cur-modal-title" className="text-sm font-semibold text-[#222222]">
                {t('crm.marketingCurrency.modal.title', {
                  defaultValue: 'Валюта кампаний и трафика',
                })}
              </h2>
              <p className="text-[11px] text-[#222222]/50 mt-1 leading-relaxed">
                {t('crm.marketingCurrency.modal.introFx', {
                  defaultValue:
                    'Валюта отчёта — любой код из списка ECB (Frankfurter): открой список или обновите курсы. Валюта строк задаётся в интеграциях маркетинга.',
                })}
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#222222]/55 mb-1.5">
                  {t('crm.sales.analytics.settings.currencyMode', { defaultValue: 'Режим валют' })}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, currencyMode: 'converted' }))}
                    className={
                      draft.currencyMode === 'converted' ? marketingChipActive : marketingChipInactive
                    }
                  >
                    {t('crm.marketingCurrency.modal.modeConverted', {
                      defaultValue: 'Единая валюта (курс ECB)',
                    })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, currencyMode: 'native' }))}
                    className={draft.currencyMode === 'native' ? marketingChipActive : marketingChipInactive}
                  >
                    {t('crm.marketingCurrency.modal.modeNative', {
                      defaultValue: 'Как в данных (по каналу)',
                    })}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#222222]/55 mb-1.5">
                  {t('crm.sales.analytics.settings.displayCurrency', { defaultValue: 'Валюта отображения' })}
                </label>
                <select
                  className="w-full rounded-xl border border-[#222222]/16 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#222222]"
                  value={draft.displayCurrency}
                  disabled={draft.currencyMode === 'native'}
                  onChange={(e) => {
                    const v = normalizeMarketingDisplayCurrency(e.target.value);
                    setDraft((d) => ({ ...d, displayCurrency: v }));
                    if (draft.currencyMode === 'converted') void pullFx(v);
                  }}
                >
                  {currencySelectCodes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {draft.currencyMode === 'converted' && (
                <div className="rounded-xl border border-[#222222]/10 bg-slate-50/60 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-[#222222]/65">
                      {t('crm.marketingCurrency.modal.fxTo', { defaultValue: 'К пересчёту в' })}{' '}
                      <span className="tabular-nums">{draft.displayCurrency}</span>
                      {draft.fxAsOf && (
                        <span className="text-[#222222]/45 font-normal ml-2">
                          · {draft.fxSource ?? 'ECB'} · {draft.fxAsOf}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={fxLoading}
                      onClick={() => void pullFx(draft.displayCurrency, true)}
                    >
                      {fxLoading
                        ? t('crm.common.loading', { defaultValue: '…' })
                        : t('crm.marketingCurrency.modal.refreshFx', { defaultValue: 'Обновить курсы' })}
                    </button>
                  </div>
                  {fxError && (
                    <p className="text-[11px] text-red-600">{fxError}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-[11px] max-h-52 overflow-y-auto">
                    {ratePreviewCodes.map((code) => (
                      <div
                        key={code}
                        className="flex justify-between rounded-lg border border-[#222222]/8 bg-white px-2.5 py-1.5"
                      >
                        <span className="font-semibold text-[#222222]">1 {code}</span>
                        <span className="tabular-nums text-[#222222]/80">
                          = {(draft.rates[code] ?? 0).toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}{' '}
                          {draft.displayCurrency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-[#222222]/10 bg-slate-50/80">
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
                {t('crm.common.cancel', { defaultValue: 'Отмена' })}
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  const display = normalizeMarketingDisplayCurrency(draft.displayCurrency);
                  const rates =
                    draft.currencyMode === 'converted'
                      ? { ...draft.rates, [display]: 1 }
                      : draft.rates;
                  onStateChange({
                    ...draft,
                    displayCurrency: display,
                    rates,
                  });
                  setOpen(false);
                }}
              >
                {t('crm.common.save', { defaultValue: 'Сохранить' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
