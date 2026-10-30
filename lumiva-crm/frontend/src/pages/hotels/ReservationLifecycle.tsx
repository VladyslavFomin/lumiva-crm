import React, { useEffect, useState } from 'react';
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCancellationQuote(reservation.id)
      .then((q) => { setQuote(q); setFee(String(q.suggestedFee)); })
      .catch(() => setQuote(null));
  }, [reservation.id]);

  const submit = () => {
    if (!reason) { showAlert(k('errors.HOTEL_CANCEL_REASON_REQUIRED'), { variant: 'error' }); return; }
    setBusy(true);
    cancelReservation(reservation.id, { reason, note, fee: fee === '' ? 0 : fee })
      .then((r) => { showAlert(k('cancelled'), { variant: 'success' }); onDone(r); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('cancelError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const ruleText = quote?.rule
    ? k('policy.rule', {
        contract: quote.contractName || '—',
        days: quote.rule.daysBefore,
        penalty: quote.rule.penaltyType === 'nights' ? k('policy.nights', { count: quote.rule.value }) : `${quote.rule.value}%`,
      })
    : quote?.contractId
      ? k('policy.noRuleHit', { contract: quote.contractName || '—' })
      : k('policy.noContract');

  return (
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal" role="dialog" aria-modal="true">
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
                {quote.paid > 0 && <div className="warn">{k('paidWarn', { paid: money(quote.paid, currency, lang) })}</div>}
              </>
            ) : (
              <div>{t('crm.hotels.common.loading')}</div>
            )}
          </div>
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{k('keep')}</button>
          <button className="btn btn-danger" disabled={busy || !reason} onClick={submit}>{k('confirmCancel')}</button>
        </div>
      </div>
    </div>
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCancellationQuote(reservation.id)
      .then((q) => { setQuote(q); setFee(String(q.firstNight)); })
      .catch(() => setQuote(null));
  }, [reservation.id]);

  const submit = () => {
    setBusy(true);
    markNoShow(reservation.id, { fee: fee === '' ? 0 : fee, note })
      .then((r) => { showAlert(k('noShowDone'), { variant: 'success' }); onDone(r); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('noShowError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal" role="dialog" aria-modal="true">
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
            {quote && quote.paid > 0 && <div className="warn">{k('paidWarn', { paid: money(quote.paid, currency, lang) })}</div>}
          </div>
          <label>{k('note')}</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={k('noShowNotePh')} />
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{k('confirmNoShow')}</button>
        </div>
      </div>
    </div>
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
