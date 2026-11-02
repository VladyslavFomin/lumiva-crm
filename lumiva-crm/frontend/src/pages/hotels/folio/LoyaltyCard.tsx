import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { hotelErrorText } from '../ReservationLifecycle';
import { money } from '../partners/partnerUtils';
import '../loyalty/loyalty.css';
import { applyLoyaltyDiscount, cancelLoyaltyRedeem, enrollLoyaltyMember, fetchLoyaltyCard, redeemLoyaltyPoints, type LoyaltyCard as Card } from '../../../api/hotels';

/** Лояльность в счёте брони: уровень и баланс гостя, скидка участника, оплата баллами (с отменой), вступление */
export const LoyaltyCard: React.FC<{ reservationId: string; status: string; onChanged: () => void }> = ({ reservationId, status, onChanged }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.loyalty.card.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [c, setC] = useState<Card | null>(null);
  const [pts, setPts] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetchLoyaltyCard(reservationId).then(setC).catch(() => setC(null)), [reservationId]);
  useEffect(() => { void load(); }, [load]);
  if (!c?.program) return null;
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' });
  const after = () => { void load(); onChanged(); };
  const run = (p: Promise<unknown>, ok: string) => { setBusy(true); p.then(() => { showAlert(ok, { variant: 'success' }); setPts(''); after(); }).catch(err).finally(() => setBusy(false)); };
  const closed = ['cancelled', 'no_show'].includes(status);
  const m = c.member;
  const hc = c.hotelCurrency || c.program.currency;
  const per = m && m.points ? m.pointsValueHotel / m.points : 0;
  const nextLine = m?.next ? [m.next.minNights ? k('needNights', { n: Math.max(0, m.next.minNights - m.stats.nights) }) : '', m.next.minStays ? k('needStays', { n: Math.max(0, m.next.minStays - m.stats.stays) }) : ''].filter(Boolean).join(k('or')) : '';
  return (
    <div className="ly-card">
      <div className="ly-card-head">
        <span className="htl-folio-sec" style={{ margin: 0 }}>{c.program.name}</span>
        {m && <span className="mono htl-sub">№ {m.number}</span>}
      </div>
      {!m ? (
        <div className="ly-card-row">
          <span className="htl-sub">{c.canEnroll ? k('notMember') : k('noProfile')}</span>
          {c.canEnroll && c.profileId && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(enrollLoyaltyMember(c.program!.id, c.profileId!), k('enrolled'))}>{k('enroll')}</button>}
        </div>
      ) : (
        <>
          <div className="ly-card-stats">
            <div><span>{k('tier')}</span><b>{m.tier?.name || '—'}</b>{nextLine && <em>{k('toNext', { name: m.next!.name, need: nextLine })}</em>}</div>
            <div><span>{k('points')}</span><b>{m.points.toLocaleString(loc)}</b><em>≈ {money(m.pointsValueHotel, hc, loc)}{m.pendingPoints ? ` · ${k('pending', { n: m.pendingPoints.toLocaleString(loc) })}` : ''}</em></div>
          </div>
          {m.status === 'blocked' && <div className="htl-hint">{k('blocked')}</div>}
          {m.tier?.benefits?.length ? <div className="ly-benefits">{m.tier.benefits.map((b) => <span key={b}>{b}</span>)}</div> : null}
          {!closed && m.status === 'active' && (
            <div className="ly-card-actions">
              {(c.discountPct || 0) > 0 && !c.partner && (
                <button type="button" className="btn btn-sm" disabled={busy || c.discountApplied} onClick={() => run(applyLoyaltyDiscount(reservationId), k('discountDone'))}>
                  {c.discountApplied ? k('discountApplied', { pct: c.discountPct }) : k('discount', { pct: c.discountPct })}
                </button>
              )}
              {c.program.pointsEnabled && (c.maxRedeemPoints || 0) > 0 && !c.blackout && (
                <span className="ly-redeem">
                  <input type="number" min={1} max={c.maxRedeemPoints} value={pts} placeholder={k('redeemPh', { max: c.maxRedeemPoints })} onChange={(e) => setPts(e.target.value)} />
                  {Number(pts) > 0 && <em>= {money(Number(pts) * per, hc, loc)}</em>}
                  <button type="button" className="btn btn-sm btn-primary" disabled={busy || !(Number(pts) > 0)} onClick={() => run(redeemLoyaltyPoints(reservationId, Number(pts)), k('redeemed'))}>{k('redeem')}</button>
                  <button type="button" className="btn btn-sm" onClick={() => setPts(String(c.maxRedeemPoints))}>{k('max', { n: c.maxRedeemPoints })}</button>
                </span>
              )}
              {c.blackout && <span className="htl-hint">{k('blackout')}</span>}
            </div>
          )}
          {(c.redemptions || []).map((x) => (
            <div key={x.id} className="ly-card-row">
              <span className="htl-sub">{k('paidWith', { n: x.points.toLocaleString(loc) })}</span>
              <button type="button" className="btn btn-sm" onClick={async () => { if (await showConfirm(k('cancelBody'), { title: k('cancelTitle'), confirmLabel: k('cancel'), cancelLabel: t('crm.hotels.common.cancel'), danger: true })) run(cancelLoyaltyRedeem(x.id), k('cancelled')); }}>{k('cancel')}</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
};
