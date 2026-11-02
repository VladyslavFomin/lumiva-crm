import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import type { BookingResourceItem } from '../../api/bookings';
import { createRental, quoteRental, type RentalQuote } from '../../api/bookingVerticals';
import { BkModal, errMsg, fmtMoney, useDateLocale, ymdLocal } from './verticalUi';
import { Ic, BK_ICON } from './BookingIcons';

const toLocalInput = (d: Date) => `${ymdLocal(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Новая аренда: ресурс + период + количество → сервер считает стоимость, залог и свободные единицы. */
export const RentalNewModal: React.FC<{
  open: boolean;
  resources: BookingResourceItem[];
  defaultResourceId?: string;
  defaultStart?: Date;
  rentalUnit: 'hour' | 'day';
  onClose: () => void;
  onCreated: (id: string) => void;
}> = ({ open, resources, defaultResourceId, defaultStart, rentalUnit, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const locale = useDateLocale();
  const [resourceId, setResourceId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [units, setUnits] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<RentalQuote | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = defaultStart || new Date(Math.ceil(Date.now() / 3600_000) * 3600_000);
    const e = new Date(s.getTime() + (rentalUnit === 'day' ? 24 : 2) * 3600_000);
    setResourceId(defaultResourceId || resources[0]?.id || '');
    setStart(toLocalInput(s));
    setEnd(toLocalInput(e));
    setUnits(1);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !resourceId || !start || !end) return;
    const id = window.setTimeout(() => {
      quoteRental({ resourceId, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), units })
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 250);
    return () => window.clearTimeout(id);
  }, [open, resourceId, start, end, units]);

  const submit = async () => {
    if (!name.trim() && !phone.trim()) {
      showAlert(t('crm.bookings.v.rental.needClient'), { variant: 'error' });
      return;
    }
    setBusy(true);
    try {
      const r = await createRental({ resourceId, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), units, customerName: name.trim() || undefined, customerPhone: phone.trim() || undefined, customerEmail: email.trim() || undefined, notes: notes.trim() || undefined });
      showAlert(t('crm.bookings.v.rental.created'), { variant: 'success' });
      onCreated(r.id);
      onClose();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const res = resources.find((r) => r.id === resourceId);
  return (
    <BkModal open={open} title={t('crm.bookings.v.rental.newTitle')} onClose={onClose}
      footer={<><button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy || !quote?.available} onClick={submit}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.v.rental.create')}</button></>}>
      <div className="bk-row2">
        <div className="bk-field"><label>{t('crm.bookings.v.rental.item')}</label>
          <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}{r.quantity > 1 ? ` · ${r.quantity} ${t('crm.bookings.v.rental.pcs')}` : ''}</option>)}
          </select>
        </div>
        <div className="bk-field"><label>{t('crm.bookings.v.rental.units')}</label><input type="number" min={1} max={res?.quantity || 1} value={units} onChange={(e) => setUnits(Math.max(1, Number(e.target.value) || 1))} /></div>
      </div>
      <div className="bk-row2">
        <div className="bk-field"><label>{t('crm.bookings.v.rental.from')}</label><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="bk-field"><label>{t('crm.bookings.v.rental.to')}</label><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      {quote && (
        <div className="bk-note">
          <div className="hd"><b>{t('crm.bookings.v.rental.quote')}</b><span>{quote.label} × {units}</span></div>
          <div className="body">
            <div className="bk-money" style={{ fontSize: 16, fontWeight: 600 }}>{fmtMoney(quote.total, quote.currency, locale)}</div>
            {quote.deposit > 0 && <div className="bk-hint">{t('crm.bookings.v.rental.depositN', { amount: fmtMoney(quote.deposit, quote.currency, locale) })}</div>}
            <div className="bk-hint" style={{ color: quote.available ? '#1f8a5e' : '#cc2f47' }}>{quote.available ? t('crm.bookings.v.rental.freeUnits', { free: quote.freeUnits, total: quote.quantity }) : quote.reason}</div>
            {quote.total === 0 && <div className="bk-hint" style={{ color: '#c08319' }}>{t('crm.bookings.v.rental.noTariff')}</div>}
          </div>
        </div>
      )}
      <div className="bk-row2">
        <div className="bk-field"><label>{t('crm.bookings.v.common.clientName')}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="bk-field"><label>{t('crm.bookings.v.common.phone')}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div className="bk-field"><label>{t('crm.bookings.v.common.email')}</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="bk-field"><label>{t('crm.bookings.v.rental.notes')}</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    </BkModal>
  );
};
