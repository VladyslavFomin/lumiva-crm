import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ApiError } from '../../api/client';
import { Ic, HTL_ICON } from './HotelIcons';
import { money } from './partners/partnerUtils';
import {
  cancelReservation,
  fetchCancellationQuote,
  markNoShow,
  HOTEL_CANCEL_REASONS,
  type HotelCancellationQuote,
  type HotelCloseRefund,
  type HotelReservation,
} from '../../api/hotels';

/** Минимум полей брони, нужный диалогам (подходит и полная бронь, и бронь из шахматки) */
type Res = Pick<HotelReservation, 'id' | 'guestName' | 'checkIn' | 'checkOut'>;

export const hotelErrorText = (t: (k: string, o?: Record<string, unknown>) => string, e: unknown, fallback: string) => {
  const err = e as ApiError;
  if (err?.code) return t(`crm.hotels.lifecycle.errors.${err.code}`, { defaultValue: t(`crm.hotels.rack.errors.${err.code}`, { defaultValue: err.message }) });
  return err?.message || fallback;
};

const useLang = () => {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
};

const REFUND_METHODS = ['cash', 'card', 'bank_transfer', 'other'];

/** Можно вернуть по счёту при штрафе fee: оплачено − доп. услуги − штраф (если проживание на этом счёте) */
const refundableOf = (q: HotelCancellationQuote, folio: 'guest' | 'partner', fee: number) =>
  Math.max(0, Math.round((q.folios[folio].payments - q.folios[folio].extras - (q.accommodationFolio === folio ? fee : 0)) * 100) / 100);

/**
 * Возврат вместе с отменой / no-show: сколько можно вернуть по каждому счёту при текущем штрафе (пересчёт сразу),
 * сумма, способ. Сервер проверяет ту же сумму ещё раз.
 */
const RefundBlock: React.FC<{ quote: HotelCancellationQuote; fee: number; currency?: string | null; value: HotelCloseRefund | null; onChange: (v: HotelCloseRefund | null) => void }> = ({
  quote, fee, currency, value, onChange,
}) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.lifecycle.refund.${key}`, o);
  const lang = useLang();
  const folios = (['guest', 'partner'] as const).filter((f) => quote.folios[f].payments > 0);
  const maxOf = (f: 'guest' | 'partner') => refundableOf(quote, f, fee);
  const folio = value?.folio || (maxOf('guest') > 0 || !folios.includes('partner') ? 'guest' : 'partner');
  const max = maxOf(folio);
  // штраф поменялся — сумма возврата не больше нового максимума
  useEffect(() => {
    if (value && Number(value.amount) > max) onChange({ ...value, amount: String(max) });
  }, [max]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!folios.length) return null;
  const tooBig = !!value && Number(String(value.amount).replace(',', '.')) > max + 0.009;
  return (
    <div className="htl-refund">
      <div className="htl-refund-sum">
        {folios.map((f) => (
          <div key={f}>
            <span>{k(`folio.${f}`)}</span>
            <b>{k('line', { paid: money(quote.folios[f].payments, currency, lang), kept: money(quote.folios[f].payments - maxOf(f), currency, lang), back: money(maxOf(f), currency, lang) })}</b>
          </div>
        ))}
      </div>
      <label className="htl-refund-on">
        <input type="checkbox" checked={!!value} disabled={!(maxOf('guest') > 0 || maxOf('partner') > 0)} onChange={(e) => onChange(e.target.checked ? { amount: String(max), method: 'cash', folio } : null)} />
        {k('issue')}
      </label>
      {value && (
        <div className="htl-refund-form">
          {folios.length > 1 && (
            <div>
              <label>{k('folioLabel')}</label>
              <select value={folio} onChange={(e) => { const f = e.target.value as 'guest' | 'partner'; onChange({ ...value, folio: f, amount: String(maxOf(f)) }); }}>
                {folios.map((f) => <option key={f} value={f}>{k(`folio.${f}`)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label>{k('amount')}</label>
            <input inputMode="decimal" value={value.amount} onChange={(e) => onChange({ ...value, amount: e.target.value })} />
            {tooBig && <div className="htl-err">{k('tooBig', { max: money(max, currency, lang) })}</div>}
          </div>
          <div>
            <label>{k('method')}</label>
            <select value={value.method} onChange={(e) => onChange({ ...value, method: e.target.value })}>
              {REFUND_METHODS.map((m) => <option key={m} value={m}>{t(`crm.hotels.reservations.paymentMethods.${m}`)}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

const refundInvalid = (q: HotelCancellationQuote | null, fee: number, r: HotelCloseRefund | null) =>
  !!r && (!q || !(Number(String(r.amount).replace(',', '.')) > 0) || Number(String(r.amount).replace(',', '.')) > refundableOf(q, r.folio, fee) + 0.009);

/** Отмена брони с причиной и штрафом по политике контракта (PMS-026) */
export const CancelReservationDialog: React.FC<{ reservation: Res; currency?: string | null; onClose: () => void; onDone: (r: HotelReservation) => void }> = ({
  reservation, currency, onClose, onDone,
}) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.lifecycle.${key}`, o);
  const lang = useLang();
  const { showAlert } = useAlertModal();
  const [quote, setQuote] = useState<HotelCancellationQuote | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [fee, setFee] = useState('');
  const [refund, setRefund] = useState<HotelCloseRefund | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCancellationQuote(reservation.id)
      .then((q) => {
        setQuote(q);
        setFee(String(q.suggestedFee));
        const f = q.folios.guest.refundable > 0 ? 'guest' : q.folios.partner.refundable > 0 ? 'partner' : null;
        if (f) setRefund({ amount: String(q.folios[f].refundable), method: 'cash', folio: f });
      })
      .catch(() => setQuote(null));
  }, [reservation.id]);
  const feeNum = Number(String(fee).replace(',', '.')) || 0;

  const submit = () => {
    if (!reason) { showAlert(k('errors.HOTEL_CANCEL_REASON_REQUIRED'), { variant: 'error' }); return; }
    setBusy(true);
    cancelReservation(reservation.id, { reason, note, fee: fee === '' ? 0 : fee, ...(refund ? { refund } : {}) })
      .then((r) => { showAlert(k('cancelled'), { variant: 'success' }); onDone(r); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('cancelError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const ruleText = quote?.nonRefundable
    ? k('policy.nonRefundable', { plan: quote.ratePlan ? `${quote.ratePlan.code} · ${quote.ratePlan.name}` : '—' })
    : quote?.ratePlan && quote.rule
    ? k('policy.planRule', {
        plan: `${quote.ratePlan.code} · ${quote.ratePlan.name}`,
        days: quote.rule.daysBefore,
        penalty: quote.rule.penaltyType === 'nights' ? k('policy.nights', { count: quote.rule.value }) : `${quote.rule.value}%`,
      })
    : quote?.ratePlan
    ? k('policy.planFree', { plan: `${quote.ratePlan.code} · ${quote.ratePlan.name}` })
    : quote?.rule
    ? k('policy.rule', {
        contract: quote.contractName || '—',
        days: quote.rule.daysBefore,
        penalty: quote.rule.penaltyType === 'nights' ? k('policy.nights', { count: quote.rule.value }) : `${quote.rule.value}%`,
      })
    : quote?.contractId
      ? k('policy.noRuleHit', { contract: quote.contractName || '—' })
      : k('policy.noContract');

  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back over-sheet" onClick={onClose} />
      <div className="bk-modal over-sheet" role="dialog" aria-modal="true">
        <div className="bk-modal-head">
          <h3>{k('cancelTitle', { name: reservation.guestName })}</h3>
          <button onClick={onClose} aria-label={t('crm.hotels.common.cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          <label>{k('reason')} *</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">{k('pickReason')}</option>
            {HOTEL_CANCEL_REASONS.map((r) => <option key={r} value={r}>{k(`cancelReasons.${r}`)}</option>)}
          </select>
          <label>{k('note')}</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={k('notePh')} />
          <label>{k('fee')}</label>
          <input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
          <div className="htl-life-hint">
            {quote ? (
              <>
                <div>{k('daysBefore', { count: quote.daysBefore })}</div>
                <div>{ruleText}</div>
                <div>{k('totalLine', { total: money(quote.total, currency, lang), suggested: money(quote.suggestedFee, currency, lang) })}</div>
              </>
            ) : (
              <div>{t('crm.hotels.common.loading')}</div>
            )}
          </div>
          {quote && <RefundBlock quote={quote} fee={feeNum} currency={currency} value={refund} onChange={setRefund} />}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{k('keep')}</button>
          <button className="btn btn-danger" disabled={busy || !reason || refundInvalid(quote, feeNum, refund)} onClick={submit}>{refund ? k('confirmCancelRefund') : k('confirmCancel')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Отметка «гость не заехал» со штрафом (по умолчанию — первая ночь) */
export const NoShowDialog: React.FC<{ reservation: Res; currency?: string | null; onClose: () => void; onDone: (r: HotelReservation) => void }> = ({
  reservation, currency, onClose, onDone,
}) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.lifecycle.${key}`, o);
  const lang = useLang();
  const { showAlert } = useAlertModal();
  const [quote, setQuote] = useState<HotelCancellationQuote | null>(null);
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState<HotelCloseRefund | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCancellationQuote(reservation.id)
      .then((q) => { setQuote(q); setFee(String(q.firstNight)); })
      .catch(() => setQuote(null));
  }, [reservation.id]);
  const feeNum = Math.min(Number(String(fee).replace(',', '.')) || 0, quote?.total ?? Infinity);

  const submit = () => {
    setBusy(true);
    markNoShow(reservation.id, { fee: fee === '' ? 0 : fee, note, ...(refund ? { refund } : {}) })
      .then((r) => { showAlert(k('noShowDone'), { variant: 'success' }); onDone(r); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('noShowError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back over-sheet" onClick={onClose} />
      <div className="bk-modal over-sheet" role="dialog" aria-modal="true">
        <div className="bk-modal-head">
          <h3>{k('noShowTitle', { name: reservation.guestName })}</h3>
          <button onClick={onClose} aria-label={t('crm.hotels.common.cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          <p className="htl-life-lead">{k('noShowLead')}</p>
          <label>{k('fee')}</label>
          <input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
          <div className="htl-life-hint">
            {quote ? <div>{k('noShowHint', { night: money(quote.firstNight, currency, lang), total: money(quote.total, currency, lang) })}</div> : <div>{t('crm.hotels.common.loading')}</div>}
          </div>
          {quote && <RefundBlock quote={quote} fee={feeNum} currency={currency} value={refund} onChange={setRefund} />}
          <label>{k('note')}</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={k('noShowNotePh')} />
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy || refundInvalid(quote, feeNum, refund)} onClick={submit}>{k('confirmNoShow')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Плашка-итог закрытой брони: причина отмены / no-show, штраф, когда */
export const ReservationClosedNote: React.FC<{ r: Pick<HotelReservation, 'status' | 'cancelReason' | 'cancelNote' | 'cancellationFee' | 'cancelledAt' | 'noShowAt'>; currency?: string | null }> = ({ r, currency }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.lifecycle.${key}`, o);
  const lang = useLang();
  if (r.status !== 'cancelled' && r.status !== 'no_show') return null;
  const when = r.status === 'cancelled' ? r.cancelledAt : r.noShowAt;
  const fee = Number(r.cancellationFee) || 0;
  return (
    <div className="htl-life-closed">
      <b>{r.status === 'cancelled' ? k('closed.cancelled', { reason: r.cancelReason ? k(`cancelReasons.${r.cancelReason}`) : '—' }) : k('closed.noShow')}</b>
      <span>
        {when ? new Date(when).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
        {` · ${fee > 0 ? k('closed.fee', { fee: money(fee, currency, lang) }) : k('closed.noFee')}`}
      </span>
      {r.cancelNote && <em>{r.cancelNote}</em>}
    </div>
  );
};
