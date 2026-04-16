import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startGa4MarketingOAuth } from '../../api/marketing';
import { integrationCatalogName } from '../../pages/automations/integrationsCatalog';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { BlurModal } from './BlurModal';

const GA4_QUICK_CURRENCIES = ['EUR', 'USD', 'GBP', 'TRY'] as const;
type Ga4QuickCurrency = (typeof GA4_QUICK_CURRENCIES)[number];

const CATALOG_ID = 'google_analytics';
const REDIRECT_PATH = '/integrations-hub?tab=marketing';

const inputCls =
  'mt-1 w-full rounded-xl border border-[#222222]/16 bg-white px-3 py-2.5 text-[13px] text-[#222222] placeholder:text-[#222222]/35 outline-none transition shadow-[inset_0_1px_2px_rgba(34,34,34,0.04)] focus:border-[#222222] focus:ring-2 focus:ring-[#222222]/10';
const labelCls = 'block text-[11px] font-semibold text-[#222222]/55 tracking-wide';

export type Ga4MarketingQuickConnectModalProps = {
  open: boolean;
  onClose: () => void;
};

export const Ga4MarketingQuickConnectModal: React.FC<Ga4MarketingQuickConnectModalProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const [primaryId, setPrimaryId] = useState('');
  const [currency, setCurrency] = useState<Ga4QuickCurrency>('EUR');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleId = 'ga4-quick-connect-title';

  const resetForm = () => {
    setPrimaryId('');
    setCurrency('EUR');
    setErr(null);
    setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    resetForm();
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const pid = primaryId.replace(/\s+/g, '').trim();
    if (!pid) {
      setErr(t('crm.marketingIntegrations.errors.requiredGa4PropertyId'));
      return;
    }
    const name = t('crm.integrationsHub.ga4QuickConnect.defaultName', { id: pid });
    setBusy(true);
    try {
      const { url } = await startGa4MarketingOAuth({
        intent: 'create',
        redirectPath: REDIRECT_PATH,
        name,
        primaryId: pid,
        currency,
      });
      window.location.assign(url);
    } catch (e: unknown) {
      setBusy(false);
      setErr(
        e instanceof Error ? e.message : t('crm.marketingIntegrations.ga4.oauth.startError'),
      );
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return (
    <BlurModal open={open} onClose={handleClose} labelledBy={titleId} size="md">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="flex max-h-[min(90dvh,720px)] flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <IntegrationBrandIcon
              catalogId={CATALOG_ID}
              label={integrationCatalogName(CATALOG_ID, t)}
              size={44}
              className="ring-1 ring-black/5"
            />
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-semibold text-slate-900 sm:text-base">
                {t('crm.integrationsHub.ga4QuickConnect.title')}
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">
                {t('crm.integrationsHub.ga4QuickConnect.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            className="shrink-0 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:shadow disabled:opacity-40"
          >
            {t('crm.integrationsHub.marketingModalClose')}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div>
            <label htmlFor="ga4-quick-property-id" className={labelCls}>
              {t('crm.integrationsHub.ga4QuickConnect.primaryIdLabel')}
            </label>
            <input
              id="ga4-quick-property-id"
              className={inputCls}
              value={primaryId}
              onChange={(ev) => setPrimaryId(ev.target.value)}
              placeholder={t('crm.integrationsHub.ga4QuickConnect.primaryIdPlaceholder')}
              inputMode="numeric"
              autoComplete="off"
              disabled={busy}
            />
            <p className="mt-1 text-[10px] text-slate-500 leading-snug">
              {t('crm.integrationsHub.ga4QuickConnect.primaryIdHint')}
            </p>
          </div>

          <div>
            <label htmlFor="ga4-quick-currency" className={labelCls}>
              {t('crm.marketingIntegrations.form.currencyLabel')}
            </label>
            <select
              id="ga4-quick-currency"
              className={inputCls}
              value={currency}
              onChange={(ev) => setCurrency(ev.target.value as Ga4QuickCurrency)}
              disabled={busy}
            >
              {GA4_QUICK_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {err ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-900">
              {err}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-200/70 px-4 py-3 sm:px-5">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[#222222] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t('crm.integrationsHub.ga4QuickConnect.connecting') : t('crm.integrationsHub.ga4QuickConnect.connect')}
          </button>
        </div>
      </form>
    </BlurModal>
  );
};
