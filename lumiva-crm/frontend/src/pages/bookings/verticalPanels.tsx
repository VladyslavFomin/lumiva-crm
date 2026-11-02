import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import type { Reservation } from '../../api/bookings';
import {
  fetchOrders,
  createOrder,
  setReservationMeeting,
  saveReservationSession,
  issueRental,
  returnRental,
  extendRental,
  type BookingOrder,
} from '../../api/bookingVerticals';
import { BkModal, errMsg, fmtDate, fmtMoney, fmtTime, useDateLocale, ymdLocal } from './verticalUi';
import { Ic, BK_ICON } from './BookingIcons';

/* ---------- Счета брони ---------- */

export const ReservationOrdersPanel: React.FC<{ reservation: Reservation }> = ({ reservation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const locale = useDateLocale();
  const [orders, setOrders] = useState<BookingOrder[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchOrders({ reservationId: reservation.id }).then(setOrders).catch(() => setOrders([]));
  }, [reservation.id]);

  const open = async () => {
    setBusy(true);
    try {
      const o = await createOrder({ reservationId: reservation.id });
      navigate(`/bookings/orders/${o.id}`);
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const hasActive = (orders || []).some((o) => o.status === 'open' || o.status === 'billed');
  return (
    <div className="bk-panel">
      <div className="bk-panel-head">
        <div className="t">{t('crm.bookings.v.panels.ordersTitle')}</div>
        {!hasActive && <button className="btn btn-sm" disabled={busy} onClick={open}><Ic d={BK_ICON.plus} size={12} /> {t('crm.bookings.v.panels.openOrder')}</button>}
      </div>
      <div className="bk-panel-body">
        {orders && orders.length === 0 && <div className="bk-hint" style={{ padding: '10px 18px' }}>{t('crm.bookings.v.panels.noOrders')}</div>}
        {(orders || []).map((o) => (
          <div key={o.id} className="dk-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/orders/${o.id}`)}>
            <div>
              <div className="n">#{o.number} · {fmtMoney(o.total, o.currency, locale)}</div>
              <div className="s">{fmtDate(o.createdAt, locale)} {fmtTime(o.createdAt, locale)} · {t('crm.bookings.v.orders.itemsN', { count: o.itemsCount ?? 0 })}</div>
            </div>
            <span className={`bk-badge ord-${o.status}`}>{t(`crm.bookings.v.orders.status.${o.status}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- Консультация: формат, ссылка, протокол, повторная встреча ---------- */

export const ConsultSessionPanel: React.FC<{ reservation: Reservation; onChanged: (r: Reservation) => void; onBookFollowUp?: (date: string) => void }> = ({ reservation, onChanged, onBookFollowUp }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const locale = useDateLocale();
  const [summary, setSummary] = useState(reservation.sessionSummary || '');
  const [followUp, setFollowUp] = useState(reservation.followUpAt ? ymdLocal(new Date(reservation.followUpAt)) : '');
  const [customUrl, setCustomUrl] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSummary(reservation.sessionSummary || '');
    setFollowUp(reservation.followUpAt ? ymdLocal(new Date(reservation.followUpAt)) : '');
    setCustomUrl('');
  }, [reservation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<Reservation>, ok?: string) => {
    setBusy(true);
    try {
      onChanged(await fn());
      if (ok) showAlert(ok, { variant: 'success' });
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const format = reservation.meetingFormat || 'offline';
  const dirty = summary !== (reservation.sessionSummary || '') || followUp !== (reservation.followUpAt ? ymdLocal(new Date(reservation.followUpAt)) : '');

  return (
    <div className="bk-panel">
      <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.panels.sessionTitle')}</div></div>
      <div className="bk-panel-body" style={{ padding: '12px 18px' }}>
        <div className="bk-field">
          <label>{t('crm.bookings.v.panels.format')}</label>
          <div className="bk-seg">
            {(['offline', 'online', 'phone'] as const).map((f) => (
              <button key={f} className={format === f ? 'on' : ''} disabled={busy} onClick={() => f !== format && run(() => setReservationMeeting(reservation.id, { format: f }))}>{t(`crm.bookings.v.panels.fmt.${f}`)}</button>
            ))}
          </div>
        </div>
        {format === 'online' && (
          <div className="bk-field">
            <label>{t('crm.bookings.v.panels.meetingLink')}</label>
            {reservation.meetingUrl && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input readOnly value={reservation.meetingUrl} style={{ flex: 1 }} />
                <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(reservation.meetingUrl!); showAlert(t('crm.bookings.v.common.copied'), { variant: 'success' }); }}>{t('crm.bookings.v.common.copy')}</button>
                <a className="btn btn-sm" href={reservation.meetingUrl} target="_blank" rel="noreferrer">{t('crm.bookings.v.panels.join')}</a>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder={t('crm.bookings.v.panels.customLinkPh')} style={{ flex: 1 }} />
              <button className="btn btn-sm" disabled={busy || !customUrl.trim()} onClick={() => run(() => setReservationMeeting(reservation.id, { format: 'online', url: customUrl.trim() }), t('crm.bookings.v.panels.linkSaved'))}>{t('crm.bookings.v.common.save')}</button>
              <button className="btn btn-sm" disabled={busy} onClick={() => run(() => setReservationMeeting(reservation.id, { format: 'online', regenerate: true }), t('crm.bookings.v.panels.linkSaved'))}>{t('crm.bookings.v.panels.newLink')}</button>
            </div>
            <div className="bk-hint" style={{ marginTop: 4 }}>{t('crm.bookings.v.panels.linkHint')}</div>
          </div>
        )}
        <div className="bk-field">
          <label>{t('crm.bookings.v.panels.summary')}</label>
          <textarea rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t('crm.bookings.v.panels.summaryPh')} />
        </div>
        <div className="bk-row2">
          <div className="bk-field">
            <label>{t('crm.bookings.v.panels.followUp')}</label>
            <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </div>
          <div className="bk-field" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            {[7, 14, 30].map((d) => (
              <button key={d} className="btn btn-sm" onClick={() => setFollowUp(ymdLocal(new Date(new Date(reservation.startAt).getTime() + d * 86400_000)))}>+{d}{t('crm.bookings.v.panels.daysShort')}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => run(() => saveReservationSession(reservation.id, { sessionSummary: summary, followUpAt: followUp ? new Date(`${followUp}T12:00:00`).toISOString() : null }), t('crm.bookings.v.panels.sessionSaved'))}>
            <Ic d={BK_ICON.check} size={12} /> {t('crm.bookings.v.common.save')}
          </button>
          {onBookFollowUp && followUp && <button className="btn btn-sm" onClick={() => onBookFollowUp(followUp)}>{t('crm.bookings.v.panels.bookFollowUp', { date: fmtDate(`${followUp}T12:00:00`, locale) })}</button>}
        </div>
      </div>
    </div>
  );
};

/* ---------- Аренда: выдача / возврат / продление ---------- */

export const RentalPanel: React.FC<{ reservation: Reservation; currency: string; onChanged: () => void }> = ({ reservation, currency, onChanged }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const locale = useDateLocale();
  const [issueOpen, setIssueOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [cond, setCond] = useState('');
  const [deposit, setDeposit] = useState(reservation.depositAmount || '');
  const [depositCollected, setDepositCollected] = useState(true);
  const [damage, setDamage] = useState('');
  const [damageNote, setDamageNote] = useState('');
  const [depAction, setDepAction] = useState<'return' | 'withhold' | 'partial'>('return');
  const [withheld, setWithheld] = useState('');
  const [waive, setWaive] = useState(false);
  const [newEnd, setNewEnd] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      showAlert(ok, { variant: 'success' });
      setIssueOpen(false);
      setReturnOpen(false);
      setExtendOpen(false);
      onChanged();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const overdueMs = Date.now() - new Date(reservation.endAt).getTime();
  const isOut = !!reservation.issuedAt && !reservation.returnedAt;
  const closed = ['cancelled_by_customer', 'cancelled_by_business', 'rejected', 'no_show'].includes(reservation.status);

  return (
    <div className="bk-panel">
      <div className="bk-panel-head">
        <div className="t">{t('crm.bookings.v.panels.rentalTitle')}</div>
        <span className={`bk-badge ${reservation.returnedAt ? 'completed' : isOut ? (overdueMs > 0 ? 'cancelled_by_business' : 'in_progress') : 'pending'}`}>
          {reservation.returnedAt ? t('crm.bookings.v.rental.state.returned') : isOut ? (overdueMs > 0 ? t('crm.bookings.v.rental.state.overdue') : t('crm.bookings.v.rental.state.out')) : t('crm.bookings.v.rental.state.reserved')}
        </span>
      </div>
      <div className="bk-panel-body" style={{ padding: '10px 18px' }}>
        <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.units')}</span><span className="v">{reservation.units || 1}</span></div>
        <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.period')}</span><span className="v">{fmtDate(reservation.startAt, locale)} {fmtTime(reservation.startAt, locale)} → {fmtDate(reservation.endAt, locale)} {fmtTime(reservation.endAt, locale)}</span></div>
        <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.cost')}</span><span className="v bk-money">{fmtMoney(reservation.price, reservation.currency || currency, locale)}</span></div>
        <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.deposit')}</span><span className="v">{reservation.depositAmount ? `${fmtMoney(reservation.depositAmount, reservation.currency || currency, locale)} · ${t(`crm.bookings.v.rental.dep.${reservation.depositStatus || 'none'}`)}` : '—'}</span></div>
        {reservation.issuedAt && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.issuedAt')}</span><span className="v">{fmtDate(reservation.issuedAt, locale)} {fmtTime(reservation.issuedAt, locale)}</span></div>}
        {reservation.conditionOut && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.conditionOut')}</span><span className="v" style={{ maxWidth: 260 }}>{reservation.conditionOut}</span></div>}
        {reservation.returnedAt && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.returnedAt')}</span><span className="v">{fmtDate(reservation.returnedAt, locale)} {fmtTime(reservation.returnedAt, locale)}</span></div>}
        {reservation.conditionIn && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.conditionIn')}</span><span className="v" style={{ maxWidth: 260 }}>{reservation.conditionIn}</span></div>}
        {reservation.lateFee && Number(reservation.lateFee) > 0 && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.rental.lateFee')}</span><span className="v bk-money" style={{ color: '#cc2f47' }}>{fmtMoney(reservation.lateFee, reservation.currency || currency, locale)}</span></div>}
        {isOut && overdueMs > 0 && <div className="bk-hint" style={{ color: '#cc2f47', marginTop: 6 }}>{t('crm.bookings.v.rental.overdueBy', { hours: Math.ceil(overdueMs / 3600_000) })}</div>}
        {!closed && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {!reservation.issuedAt && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { setCond(''); setDeposit(reservation.depositAmount || ''); setDepositCollected(true); setIssueOpen(true); }}>{t('crm.bookings.v.rental.issue')}</button>}
            {isOut && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { setCond(''); setDamage(''); setDamageNote(''); setDepAction('return'); setWaive(false); setReturnOpen(true); }}>{t('crm.bookings.v.rental.accept')}</button>}
            {!reservation.returnedAt && <button className="btn btn-sm" disabled={busy} onClick={() => { const e = new Date(reservation.endAt); e.setDate(e.getDate() + 1); setNewEnd(`${ymdLocal(e)}T${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`); setExtendOpen(true); }}>{t('crm.bookings.v.rental.extend')}</button>}
          </div>
        )}
      </div>

      <BkModal open={issueOpen} title={t('crm.bookings.v.rental.issueTitle')} onClose={() => setIssueOpen(false)}
        footer={<><button className="btn btn-sm" onClick={() => setIssueOpen(false)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => issueRental(reservation.id, { conditionOut: cond, depositAmount: deposit, depositCollected }), t('crm.bookings.v.rental.issued'))}>{t('crm.bookings.v.rental.issue')}</button></>}>
        <div className="bk-field"><label>{t('crm.bookings.v.rental.conditionOut')}</label><textarea rows={3} value={cond} onChange={(e) => setCond(e.target.value)} placeholder={t('crm.bookings.v.rental.conditionPh')} /></div>
        <div className="bk-row2">
          <div className="bk-field"><label>{t('crm.bookings.v.rental.deposit')}</label><input type="number" min={0} step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
          <div className="bk-field" style={{ display: 'flex', alignItems: 'flex-end' }}><label className="bk-check"><input type="checkbox" checked={depositCollected} onChange={(e) => setDepositCollected(e.target.checked)} /> {t('crm.bookings.v.rental.depositCollected')}</label></div>
        </div>
      </BkModal>

      <BkModal open={returnOpen} title={t('crm.bookings.v.rental.returnTitle')} onClose={() => setReturnOpen(false)}
        footer={<><button className="btn btn-sm" onClick={() => setReturnOpen(false)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => returnRental(reservation.id, { conditionIn: cond, damageFee: damage, damageNote, deposit: depAction, withheldAmount: withheld, waiveLateFee: waive }), t('crm.bookings.v.rental.returned'))}>{t('crm.bookings.v.rental.accept')}</button></>}>
        {overdueMs > 15 * 60_000 && (
          <div className="bk-note"><div className="body" style={{ color: '#9a1f31' }}>{t('crm.bookings.v.rental.lateWarn', { hours: Math.ceil(overdueMs / 3600_000) })}</div>
            <label className="bk-check"><input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} /> {t('crm.bookings.v.rental.waive')}</label>
          </div>
        )}
        <div className="bk-field"><label>{t('crm.bookings.v.rental.conditionIn')}</label><textarea rows={3} value={cond} onChange={(e) => setCond(e.target.value)} placeholder={t('crm.bookings.v.rental.conditionPh')} /></div>
        <div className="bk-row2">
          <div className="bk-field"><label>{t('crm.bookings.v.rental.damageFee')}</label><input type="number" min={0} step="0.01" value={damage} onChange={(e) => setDamage(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.v.rental.damageNote')}</label><input value={damageNote} onChange={(e) => setDamageNote(e.target.value)} /></div>
        </div>
        {reservation.depositStatus === 'held' && (
          <div className="bk-field"><label>{t('crm.bookings.v.rental.depositFate', { amount: fmtMoney(reservation.depositAmount, reservation.currency || currency, locale) })}</label>
            <div className="bk-seg">
              {(['return', 'partial', 'withhold'] as const).map((a) => <button key={a} className={depAction === a ? 'on' : ''} onClick={() => setDepAction(a)}>{t(`crm.bookings.v.rental.depAct.${a}`)}</button>)}
            </div>
            {depAction === 'partial' && <input style={{ marginTop: 8 }} type="number" min={0} step="0.01" value={withheld} onChange={(e) => setWithheld(e.target.value)} placeholder={t('crm.bookings.v.rental.withheldPh')} />}
          </div>
        )}
        <div className="bk-hint">{t('crm.bookings.v.rental.returnHint')}</div>
      </BkModal>

      <BkModal open={extendOpen} title={t('crm.bookings.v.rental.extendTitle')} onClose={() => setExtendOpen(false)}
        footer={<><button className="btn btn-sm" onClick={() => setExtendOpen(false)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy || !newEnd} onClick={() => run(() => extendRental(reservation.id, new Date(newEnd).toISOString()), t('crm.bookings.v.rental.extended'))}>{t('crm.bookings.v.rental.extend')}</button></>}>
        <div className="bk-field"><label>{t('crm.bookings.v.rental.newEnd')}</label><input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} /></div>
        <div className="bk-hint">{t('crm.bookings.v.rental.extendHint')}</div>
      </BkModal>
    </div>
  );
};
