import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { money } from '../partners/partnerUtils';
import {
  cancelPayRequest,
  createPayRequest,
  fetchPayRequests,
  fetchPaySuggest,
  sendPayRequest,
  type HotelFolioKind,
  type HotelPayRequest,
  type HotelPaySuggest,
} from '../../../api/hotels';

/**
 * Онлайн-оплата в фолио брони: запросить предоплату / остаток ссылкой (письмо гостю, WhatsApp, копия ссылки),
 * статус ссылок; оплата приходит в платежи брони сама (способ «онлайн»).
 */
export const PayLinks: React.FC<{ reservationId: string; folios: HotelFolioKind[]; guestName: string; onPaid?: () => void }> = ({ reservationId, folios, guestName, onPaid }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.paylink.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [rows, setRows] = useState<HotelPayRequest[]>([]);
  const [sug, setSug] = useState<HotelPaySuggest | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'deposit' as 'deposit' | 'balance' | 'custom', amount: '', folio: 'guest' as HotelFolioKind, days: '7', sendEmail: true });
  const [busy, setBusy] = useState(false);
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
  const paidRef = useRef(onPaid);
  paidRef.current = onPaid;
  const rowsRef = useRef<HotelPayRequest[]>([]);
  const load = useCallback(() => {
    void fetchPayRequests(reservationId).then((list) => {
      // ссылка оплачена, пока открыт экран — обновить фолио
      if (rowsRef.current.some((p) => p.status === 'pending' && list.find((x) => x.id === p.id)?.status === 'paid')) paidRef.current?.();
      rowsRef.current = list;
      setRows(list);
    }).catch(() => setRows([]));
    void fetchPaySuggest(reservationId).then(setSug).catch(() => setSug(null));
  }, [reservationId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!rows.some((r) => r.status === 'pending')) return;
    const h = window.setInterval(load, 20_000);
    return () => window.clearInterval(h);
  }, [rows, load]);
  if (!sug) return null;
  const m = (n: number, cur = sug.currency) => money(n, cur, loc);
  const amountFor = (kind: string, folio: HotelFolioKind) => (kind === 'deposit' ? sug.depositLeft : sug.balance[folio]);
  const startOpen = () => {
    const kind = sug.depositLeft > 0 ? 'deposit' : 'balance';
    setForm({ kind, amount: String(amountFor(kind, 'guest')), folio: 'guest', days: '7', sendEmail: !!sug.guestEmail });
    setOpen(true);
  };
  const create = () => {
    setBusy(true);
    createPayRequest({ reservationId, amount: Number(form.amount.replace(',', '.')), folio: form.folio, kind: form.kind, expiresInDays: Number(form.days) || 7, sendEmail: form.sendEmail })
      .then((r) => {
        setOpen(false);
        if (r.sendError) showAlert(k('createdNotSent', { error: t(`crm.hotels.lifecycle.errors.${r.sendError.code}`, { defaultValue: r.sendError.message }) }), { variant: 'error' });
        else showAlert(form.sendEmail ? k('createdSent', { to: r.sentTo || '' }) : k('created'), { variant: 'success' });
        load();
      })
      .catch(err)
      .finally(() => setBusy(false));
  };
  const copy = (r: HotelPayRequest) => { void navigator.clipboard?.writeText(r.url).then(() => showAlert(k('copied'), { variant: 'success' })).catch(() => window.prompt(k('copy'), r.url)); };
  const whatsapp = (r: HotelPayRequest) => {
    const text = k('waText', { name: guestName, amount: m(r.amount, r.currency), url: r.url });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const cancel = async (r: HotelPayRequest) => {
    if (await showConfirm(k('cancelBody'), { title: k('cancelTitle'), confirmLabel: k('cancel'), cancelLabel: t('crm.hotels.common.cancel'), danger: true })) cancelPayRequest(r.id).then(load).catch(err);
  };
  const shown = rows.filter((r) => r.status !== 'cancelled');

  return (
    <div className="pl-box">
      <div className="pl-head">
        <div className="htl-folio-sec" style={{ margin: 0 }}>{k('title')}</div>
        {sug.depositAmount > 0 && <span className="htl-sub">{k('deposit', { amount: m(sug.depositAmount), left: m(sug.depositLeft) })}{sug.depositDueDate ? ` · ${k('due', { date: sug.depositDueDate })}` : ''}</span>}
        <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} disabled={!sug.provider || !sug.currencySupported} title={!sug.provider ? k('noProvider') : !sug.currencySupported ? k('noCurrency', { cur: sug.currency }) : undefined} onClick={startOpen}>
          <Ic d={HTL_ICON.plus} size={12} />{k('request')}
        </button>
      </div>
      {!sug.provider && <div className="htl-hint">{k('noProvider')}</div>}
      {open && (
        <div className="pl-form">
          <div className="htl-seg">
            {(['deposit', 'balance', 'custom'] as const).map((x) => (
              <button key={x} type="button" className={form.kind === x ? 'on' : ''} disabled={x === 'deposit' && !(sug.depositLeft > 0)}
                onClick={() => setForm({ ...form, kind: x, amount: x === 'custom' ? form.amount : String(amountFor(x, form.folio)) })}>{k(`kind.${x}`)}</button>
            ))}
          </div>
          <div className="pl-row">
            <label><span>{k('amount', { cur: sug.currency })}</span><input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, kind: 'custom', amount: e.target.value })} /></label>
            {folios.length > 1 && (
              <label><span>{k('folio')}</span>
                <select value={form.folio} onChange={(e) => { const f = e.target.value as HotelFolioKind; setForm({ ...form, folio: f, amount: form.kind === 'custom' ? form.amount : String(amountFor(form.kind, f)) }); }}>
                  {folios.map((f) => <option key={f} value={f}>{t(`crm.hotels.folio.folios.${f}`)}</option>)}
                </select>
              </label>
            )}
            <label><span>{k('days')}</span><input type="number" min={1} max={60} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></label>
          </div>
          <label className="hk-check inline"><input type="checkbox" checked={form.sendEmail} disabled={!sug.guestEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} /><span>{sug.guestEmail ? k('sendEmail', { to: sug.guestEmail }) : k('noEmail')}</span></label>
          <div className="pl-acts">
            <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>{t('crm.hotels.common.cancel')}</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy || !(Number(form.amount.replace(',', '.')) > 0)} onClick={create}>{k('create')}</button>
          </div>
        </div>
      )}
      {shown.map((r) => (
        <div key={r.id} className={`pl-ln s-${r.status}`}>
          <span className="pl-main">
            <b className="mono">{m(r.amount, r.currency)}</b>
            <span className="htl-sub">{k(`kind.${r.kind}`)}{folios.length > 1 ? ` · ${t(`crm.hotels.folio.folios.${r.folio}`)}` : ''}{r.origin === 'website' ? ` · ${k('fromWebsite')}` : ''}</span>
          </span>
          <span className={`ei-st pl-st s-${r.status}`}>{k(`status.${r.status}`)}</span>
          <span className="htl-sub pl-when">
            {r.status === 'paid' && r.paidAt ? k('paidAt', { at: new Date(r.paidAt).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
              : r.sentAt ? k('sentTo', { to: r.sentTo || '' }) : r.openedAt ? k('opened') : ''}
          </span>
          {r.status === 'pending' && (
            <span className="pl-btns">
              <button type="button" className="btn btn-sm" onClick={() => copy(r)}>{k('copy')}</button>
              <button type="button" className="btn btn-sm" onClick={() => whatsapp(r)}>WhatsApp</button>
              {sug.guestEmail && <button type="button" className="btn btn-sm" onClick={() => sendPayRequest(r.id).then((x) => { showAlert(k('sent', { to: x.sentTo }), { variant: 'success' }); load(); }).catch(err)}>{k('email')}</button>}
              <button type="button" className="btn btn-sm" onClick={() => void cancel(r)} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={11} /></button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
