import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { hotelErrorText } from '../ReservationLifecycle';
import { precheckinLink, precheckinSend, type HotelReservation } from '../../../api/hotels';

/** Онлайн-регистрация в карточке брони: скопировать ссылку гостю / отправить письмо */
export const PrecheckinDrawerBox: React.FC<{ reservation: HotelReservation }> = ({ reservation }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.precheckin.${key}`, o);
  const { showAlert } = useAlertModal();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }); } finally { setBusy(false); }
  };
  return (
    <div className="pe-box grp-link" style={{ marginTop: 0, marginBottom: 12 }}>
      <span>{k('drawerHint')}</span>
      <span style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => {
          const l = await precheckinLink(reservation.id);
          try { await navigator.clipboard.writeText(l.url); showAlert(k('copied'), { variant: 'success' }); } catch { window.prompt(k('copyPrompt'), l.url); }
        })}>{k('copyLink')}</button>
        {reservation.guestEmail && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { const x = await precheckinSend(reservation.id); showAlert(k('sent', { email: x.sentTo }), { variant: 'success' }); })}>{k('send')}</button>}
      </span>
    </div>
  );
};
