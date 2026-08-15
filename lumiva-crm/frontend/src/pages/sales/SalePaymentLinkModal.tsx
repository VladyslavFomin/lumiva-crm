import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from '../../components/integrations/BlurModal';
import { createSalePaymentLink, getPayment, type PaymentDto } from '../../api/payments';
import { useAlertModal } from '../../contexts/AlertModalContext';

type Props = {
  open: boolean;
  saleId: string;
  amount: number;
  currency: string;
  defaultBuyerName?: string;
  onClose: () => void;
  onPaid: () => void;
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

export const SalePaymentLinkModal: React.FC<Props> = ({
  open,
  saleId,
  amount,
  currency,
  defaultBuyerName,
  onClose,
  onPaid,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [form, setForm] = useState({
    buyerName: defaultBuyerName || '',
    buyerEmail: '',
    buyerPhone: '',
    city: '',
    address: '',
  });
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ buyerName: defaultBuyerName || '', buyerEmail: '', buyerPhone: '', city: '', address: '' });
    setPayment(null);
    setErr(null);
    setCopied(false);
  }, [open, defaultBuyerName]);

  // Опрос статуса, пока окно открыто и счёт выставлен, но ещё не оплачен
  useEffect(() => {
    if (!open || !payment || payment.status !== 'pending') return;
    const iv = setInterval(async () => {
      try {
        const fresh = await getPayment(payment.id);
        setPayment(fresh);
        if (fresh.status === 'paid') {
          onPaid();
        }
      } catch {
        // ignore transient poll errors
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [open, payment, onPaid]);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleCreate = async () => {
    if (!form.buyerName.trim() || !form.buyerEmail.trim() || !form.city.trim() || !form.address.trim()) {
      showAlert(t('crm.sales.paymentLink.errors.missing'), { variant: 'info' });
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const p = await createSalePaymentLink(saleId, {
        buyerName: form.buyerName.trim(),
        buyerEmail: form.buyerEmail.trim(),
        buyerPhone: form.buyerPhone.trim() || undefined,
        city: form.city.trim(),
        address: form.address.trim(),
      });
      setPayment(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('crm.sales.paymentLink.errors.create'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!payment?.paymentPageUrl) return;
    try {
      await navigator.clipboard.writeText(payment.paymentPageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable — link is still visible/selectable
    }
  };

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose} size="sm">
      <div className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">{t('crm.sales.paymentLink.title')}</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            {t('crm.sales.paymentLink.subtitle', {
              amount: amount.toLocaleString(undefined, { maximumFractionDigits: 2 }),
              currency,
            })}
          </p>
        </div>

        {!payment ? (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>{t('crm.sales.paymentLink.form.buyerName')}</label>
              <input
                value={form.buyerName}
                onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('crm.sales.paymentLink.form.buyerEmail')}</label>
                <input
                  type="email"
                  value={form.buyerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, buyerEmail: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('crm.sales.paymentLink.form.buyerPhone')} <span className="text-slate-400">{t('crm.common.optional')}</span>
                </label>
                <input
                  value={form.buyerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, buyerPhone: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('crm.sales.paymentLink.form.city')}</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Istanbul"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('crm.sales.paymentLink.form.address')}</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            {err ? <p className="text-[11px] text-rose-600">{err}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">
                {t('crm.common.cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCreate()}
                className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t('crm.sales.paymentLink.creating') : t('crm.sales.paymentLink.createButton')}
              </button>
            </div>
          </div>
        ) : payment.status === 'paid' ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] font-medium text-emerald-900">
              {t('crm.sales.paymentLink.paid')}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleClose} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90">
                {t('crm.common.close')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500">{t('crm.sales.paymentLink.linkReadyHint')}</p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                readOnly
                value={payment.paymentPageUrl || ''}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate bg-transparent text-[11px] text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={() => void copyLink()}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:border-slate-300"
              >
                {copied ? t('crm.sales.paymentLink.copied') : t('crm.sales.paymentLink.copy')}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">{t('crm.sales.paymentLink.waitingHint')}</p>
            <div className="flex justify-end">
              <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">
                {t('crm.common.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </BlurModal>
  );
};
