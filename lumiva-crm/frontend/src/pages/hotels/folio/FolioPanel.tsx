import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { money } from '../partners/partnerUtils';
import {
  addFolioPayment,
  downloadReservationFolio,
  fetchExtras,
  fetchFolio,
  postFolioLine,
  removeReservationPayment,
  sendFolioEmail,
  setFolioRouting,
  voidFolioLine,
  HOTEL_FOLIO_LINE_KINDS,
  type HotelExtraService,
  type HotelFolio,
  type HotelFolioKind,
} from '../../../api/hotels';
import { DateInput } from '../../../components/ui/DateInput';

const METHODS = ['cash', 'card', 'bank_transfer', 'other'];

/** Фолио брони (PMS-080…086): два счёта, начисления со сторно, платежи и возвраты, PDF и письмо гостю */
export const FolioPanel: React.FC<{
  reservation: { id: string; hotelId: string; agencyId: string | null; guestEmail?: string | null; status: string };
  currency?: string | null;
  onChanged?: () => void;
}> = ({ reservation, currency, onChanged }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.folio.${key}`, o);
  const lang = i18n.language?.startsWith('tr') ? 'tr' : i18n.language?.startsWith('en') ? 'en' : 'ru';
  const loc = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : 'ru-RU';
  const { showAlert, showPrompt, showConfirm } = useAlertModal();
  const [folio, setFolio] = useState<HotelFolio | null>(null);
  const [extras, setExtras] = useState<HotelExtraService[]>([]);
  const [busy, setBusy] = useState(false);
  const [charge, setCharge] = useState({ extraServiceId: '', kind: 'extra', description: '', quantity: '1', unitPrice: '', folio: 'guest' as HotelFolioKind, serviceDate: '' });
  const [pay, setPay] = useState({ amount: '', method: 'card', note: '', folio: 'guest' as HotelFolioKind, refund: false });
  const hasPartner = !!reservation.agencyId;
  const m = (n: number | string) => money(Number(n), currency, loc);
  const err = (e: unknown, fb: string) => showAlert(hotelErrorText(t, e, fb), { variant: 'error' });

  const load = useCallback(() => fetchFolio(reservation.id).then((f) => { setFolio(f); setCharge((c) => ({ ...c, serviceDate: c.serviceDate || f.businessDate })); }).catch((e) => err(e, k('loadError'))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reservation.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetchExtras(reservation.hotelId).then(setExtras).catch(() => setExtras([])); }, [reservation.hotelId]);
  const done = () => { void load(); onChanged?.(); };

  const pickExtra = (id: string) => {
    const x = extras.find((e) => e.id === id);
    setCharge((c) => ({ ...c, extraServiceId: id, description: x ? x.name : c.description, unitPrice: x ? String(Number(x.price)) : c.unitPrice, kind: x?.category === 'minibar' ? 'minibar' : c.kind }));
  };
  const addCharge = () => {
    if (!charge.description.trim() && !charge.extraServiceId) { showAlert(k('errors.HOTEL_FOLIO_DESCRIPTION_REQUIRED'), { variant: 'error' }); return; }
    setBusy(true);
    postFolioLine(reservation.id, { ...charge, extraServiceId: charge.extraServiceId || null })
      .then(() => { setCharge((c) => ({ ...c, extraServiceId: '', description: '', quantity: '1', unitPrice: '' })); done(); })
      .catch((e) => err(e, k('saveError')))
      .finally(() => setBusy(false));
  };
  const voidLine = async (lineId: string) => {
    const reason = await showPrompt({ title: k('voidTitle'), label: k('voidLabel'), placeholder: k('voidPh'), confirmLabel: k('void'), cancelLabel: t('crm.hotels.common.cancel') });
    if (reason === null) return;
    if (!reason.trim()) { showAlert(k('errors.HOTEL_FOLIO_VOID_REASON'), { variant: 'error' }); return; }
    voidFolioLine(reservation.id, lineId, reason.trim()).then(done).catch((e) => err(e, k('saveError')));
  };
  const addPay = () => {
    if (!Number(pay.amount)) return;
    setBusy(true);
    addFolioPayment(reservation.id, { amount: pay.amount, method: pay.method, note: pay.note || undefined, folio: pay.folio, refund: pay.refund })
      .then(() => { setPay((p) => ({ ...p, amount: '', note: '', refund: false })); done(); })
      .catch((e) => err(e, k('saveError')))
      .finally(() => setBusy(false));
  };
  const removePay = async (id: string) => {
    const ok = await showConfirm(k('removePayConfirm'), { title: k('removePay'), confirmLabel: t('crm.hotels.common.delete'), cancelLabel: t('crm.hotels.common.cancel'), danger: true });
    if (ok) removeReservationPayment(reservation.id, id).then(done).catch((e) => err(e, k('saveError')));
  };
  const route = (f: HotelFolioKind) => setFolioRouting(reservation.id, f).then(done).catch((e) => err(e, k('saveError')));
  const email = () => {
    setBusy(true);
    sendFolioEmail(reservation.id).then(() => showAlert(k('emailSent'), { variant: 'success' })).catch((e) => err(e, k('saveError'))).finally(() => setBusy(false));
  };

  if (!folio) return <div className="htl-rack-skel small">{[0, 1].map((i) => <div key={i} />)}</div>;
  const s = folio.summary;
  const label = (kind: string, d: string) => d || k(`kinds.${kind}`, { defaultValue: kind });
  const folios: HotelFolioKind[] = hasPartner ? ['guest', 'partner'] : ['guest'];

  return (
    <div className="htl-folio">
      <div className="htl-folio-cards">
        {folios.map((f) => (
          <div key={f} className="card">
            <span>{k(`folios.${f}`)}</span>
            <b className={s.folios[f].balance > 0.009 ? 'due' : s.folios[f].balance < -0.009 ? 'over' : 'ok'}>{m(Math.abs(s.folios[f].balance))}</b>
            <em>{s.folios[f].balance > 0.009 ? k('due') : s.folios[f].balance < -0.009 ? k('overpaid') : k('settled')} · {k('chargesLine', { charges: m(s.folios[f].charges), paid: m(s.folios[f].payments) })}</em>
          </div>
        ))}
      </div>
      {hasPartner && (
        <div className="htl-folio-route">
          <span>{k('accommodationTo')}</span>
          <div className="htl-seg">{folios.map((f) => <button key={f} type="button" className={s.accommodationFolio === f ? 'on' : ''} onClick={() => void route(f)}>{k(`folios.${f}`)}</button>)}</div>
        </div>
      )}
      {folio.lastAuditDate && <div className="htl-sub" style={{ margin: '6px 0' }}>{k('closedUntil', { date: folio.lastAuditDate, open: folio.businessDate })}</div>}

      <div className="htl-folio-sec">{k('charges')}</div>
      <div className="htl-folio-lines">
        <div className="ln acc">
          <span className="d">{k('accommodation')}</span>
          <span className="f">{k(`folios.${s.accommodationFolio}`)}</span>
          <b>{m(s.accommodation)}</b>
          <span />
        </div>
        {folio.lines.map((l) => (
          <div key={l.id} className={`ln${l.voided || l.voidOfId ? ' void' : ''}`}>
            <span className="d">
              <i>{l.serviceDate}</i> {label(l.kind, l.description)}{Number(l.quantity) !== 1 ? ` × ${Number(l.quantity)}` : ''}
              {l.voidOfId && <em>{k('voidLine', { reason: l.reason || '' })}</em>}
            </span>
            <span className="f">{hasPartner ? k(`folios.${l.folio}`) : ''}</span>
            <b>{m(l.amount)}</b>
            <span>{!l.voided && !l.voidOfId && <button type="button" className="x" title={k('void')} onClick={() => void voidLine(l.id)}>{k('void')}</button>}</span>
          </div>
        ))}
      </div>
      {reservation.status !== 'cancelled' && (
        <div className="htl-folio-form">
          {extras.length > 0 && (
            <select value={charge.extraServiceId} onChange={(e) => pickExtra(e.target.value)} className="wide">
              <option value="">{k('fromCatalog')}</option>
              {extras.map((x) => <option key={x.id} value={x.id}>{x.name} · {m(x.price)}</option>)}
            </select>
          )}
          <input className="wide" placeholder={k('descriptionPh')} value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} />
          <select value={charge.kind} onChange={(e) => setCharge({ ...charge, kind: e.target.value })}>
            {HOTEL_FOLIO_LINE_KINDS.map((x) => <option key={x} value={x}>{k(`kinds.${x}`)}</option>)}
          </select>
          <input type="number" min={0.01} step="0.01" className="sm" title={k('qty')} value={charge.quantity} onChange={(e) => setCharge({ ...charge, quantity: e.target.value })} />
          <input type="number" step="0.01" className="sm" placeholder={k('price')} value={charge.unitPrice} onChange={(e) => setCharge({ ...charge, unitPrice: e.target.value })} />
          <DateInput value={charge.serviceDate} onChange={(v) => setCharge({ ...charge, serviceDate: v })} />
          {hasPartner && (
            <select value={charge.folio} onChange={(e) => setCharge({ ...charge, folio: e.target.value as HotelFolioKind })}>
              {folios.map((f) => <option key={f} value={f}>{k(`folios.${f}`)}</option>)}
            </select>
          )}
          <button className="btn btn-sm" disabled={busy} onClick={addCharge}><Ic d={HTL_ICON.plus} size={12} />{k('addCharge')}</button>
        </div>
      )}

      <div className="htl-folio-sec">{k('payments')}</div>
      <div className="htl-folio-lines">
        {!folio.payments.length && <div className="htl-sub">{k('noPayments')}</div>}
        {folio.payments.map((p) => (
          <div key={p.id} className="ln">
            <span className="d"><i>{p.date}</i> {t(`crm.hotels.reservations.paymentMethods.${p.method}`, { defaultValue: p.method })}{Number(p.amount) < 0 ? ` · ${k('refund')}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
            <span className="f">{hasPartner ? k(`folios.${p.folio || 'guest'}`) : ''}</span>
            <b className={Number(p.amount) < 0 ? 'neg' : ''}>{m(p.amount)}</b>
            <span><button type="button" className="x" title={k('removePay')} onClick={() => void removePay(p.id)}><Ic d={HTL_ICON.x} size={11} /></button></span>
          </div>
        ))}
      </div>
      <div className="htl-folio-form">
        <input type="number" min={0} step="0.01" className="sm" placeholder={k('amount')} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
        <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
          {METHODS.map((x) => <option key={x} value={x}>{t(`crm.hotels.reservations.paymentMethods.${x}`)}</option>)}
        </select>
        {hasPartner && (
          <select value={pay.folio} onChange={(e) => setPay({ ...pay, folio: e.target.value as HotelFolioKind })}>
            {folios.map((f) => <option key={f} value={f}>{k(`folios.${f}`)}</option>)}
          </select>
        )}
        <input className="wide" placeholder={k('payNotePh')} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
        <label className="hk-check inline"><input type="checkbox" checked={pay.refund} onChange={(e) => setPay({ ...pay, refund: e.target.checked })} /><span>{k('refund')}</span></label>
        <button className="btn btn-sm btn-primary" disabled={busy || !Number(pay.amount)} onClick={addPay}>{pay.refund ? k('addRefund') : k('addPayment')}</button>
        {s.folios[pay.folio].balance > 0.009 && !pay.refund && <button type="button" className="lnk" onClick={() => setPay({ ...pay, amount: String(s.folios[pay.folio].balance) })}>{k('payBalance', { amount: m(s.folios[pay.folio].balance) })}</button>}
      </div>

      <div className="htl-folio-acts">
        {folios.map((f) => (
          <button key={f} className="btn btn-sm" onClick={() => downloadReservationFolio(reservation.id, { lang, folio: f }).catch((e) => err(e, k('saveError')))}>
            <Ic d={HTL_ICON.download} size={12} />{k('pdf', { folio: k(`folios.${f}`) })}
          </button>
        ))}
        <button className="btn btn-sm" disabled={busy || !reservation.guestEmail} title={reservation.guestEmail ? undefined : t('crm.hotels.reservations.drawer.noEmailTitle')} onClick={email}>{k('email')}</button>
      </div>
    </div>
  );
};
