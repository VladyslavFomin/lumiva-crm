import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { createReservation, type BookingLocation } from '../../api/bookings';
import { suggestTables } from '../../api/bookingVerticals';
import { BkModal, errMsg, ymdLocal } from './verticalUi';
import { Ic, BK_ICON } from './BookingIcons';

/**
 * Бронь стола: гости + дата/время + длительность → сервер подбирает свободные столы под
 * компанию (по вместимости и конфликтам). Стол можно не выбирать — бронь «без стола»
 * попадёт в список «Ожидают посадки» на плане зала.
 */
export const RestaurantBookingModal: React.FC<{
  open: boolean;
  locations: BookingLocation[];
  defaultLocationId?: string;
  defaultTableId?: string;
  defaultStart?: Date;
  turnMinutes: number;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, locations, defaultLocationId, defaultTableId, defaultStart, turnMinutes, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [locationId, setLocationId] = useState('');
  const [guests, setGuests] = useState(2);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [duration, setDuration] = useState(turnMinutes);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [tableId, setTableId] = useState('');
  const [tables, setTables] = useState<Array<{ id: string; name: string; capacity: number | null; zoneName: string | null }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = defaultStart || new Date(Date.now() + 60 * 60_000);
    setLocationId(defaultLocationId || locations[0]?.id || '');
    setDate(ymdLocal(start));
    setTime(`${String(start.getHours()).padStart(2, '0')}:${String(Math.floor(start.getMinutes() / 15) * 15).padStart(2, '0')}`);
    setDuration(turnMinutes);
    setGuests(2);
    setName('');
    setPhone('');
    setEmail('');
    setComment('');
    setTableId(defaultTableId || '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const startAt = date && time ? new Date(`${date}T${time}:00`) : null;
  const endAt = startAt ? new Date(startAt.getTime() + duration * 60_000) : null;

  useEffect(() => {
    if (!open || !locationId || !startAt || !endAt || Number.isNaN(startAt.getTime())) return;
    setLoadingTables(true);
    suggestTables(locationId, startAt.toISOString(), endAt.toISOString(), guests)
      .then((rows) => {
        setTables(rows);
        if (tableId && !rows.some((r) => r.id === tableId) && tableId !== defaultTableId) setTableId('');
      })
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false));
  }, [open, locationId, date, time, duration, guests]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!locationId || !startAt || !endAt) return;
    if (!name.trim() && !phone.trim()) {
      showAlert(t('crm.bookings.v.rbook.needClient'), { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      await createReservation({
        locationId,
        resourceId: tableId || undefined,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        participants: guests,
        customerName: name.trim() || undefined,
        customerPhone: phone.trim() || undefined,
        customerEmail: email.trim() || undefined,
        source: 'manual',
        customFields: comment.trim() ? { comment: comment.trim() } : undefined,
      });
      showAlert(t('crm.bookings.v.rbook.created'), { variant: 'success' });
      onCreated();
      onClose();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const tableInList = tables.some((x) => x.id === tableId);

  return (
    <BkModal
      open={open}
      title={t('crm.bookings.v.rbook.title')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.v.common.cancel')}</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}>
            <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.v.rbook.submit')}
          </button>
        </>
      }
    >
      <div className="bk-row3">
        <div className="bk-field">
          <label>{t('crm.bookings.v.rbook.guests')}</label>
          <input type="number" min={1} max={100} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.v.rbook.date')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.v.rbook.time')}</label>
          <input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="bk-row2">
        <div className="bk-field">
          <label>{t('crm.bookings.v.rbook.duration')}</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[60, 90, 120, 150, 180, 240, 300].concat(turnMinutes).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>{t('crm.bookings.v.common.minutesShort', { count: m })}</option>
            ))}
          </select>
        </div>
        {locations.length > 1 ? (
          <div className="bk-field">
            <label>{t('crm.bookings.v.common.location')}</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        ) : <div />}
      </div>
      <div className="bk-field">
        <label>{t('crm.bookings.v.rbook.table')}</label>
        <select value={tableId} onChange={(e) => setTableId(e.target.value)}>
          <option value="">{t('crm.bookings.v.rbook.noTable')}</option>
          {defaultTableId && !tableInList && tableId === defaultTableId && <option value={defaultTableId}>{t('crm.bookings.v.rbook.selectedTableBusy')}</option>}
          {tables.map((tb) => (
            <option key={tb.id} value={tb.id}>
              {tb.name} · {t('crm.bookings.v.common.seats', { count: tb.capacity || 0 })}{tb.zoneName ? ` · ${tb.zoneName}` : ''}
            </option>
          ))}
        </select>
        <div className="bk-hint" style={{ marginTop: 4 }}>
          {loadingTables ? t('crm.bookings.v.common.loading') : t('crm.bookings.v.rbook.freeTables', { count: tables.length })}
        </div>
      </div>
      <div className="bk-row2">
        <div className="bk-field">
          <label>{t('crm.bookings.v.common.clientName')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.v.common.phone')}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="bk-field">
        <label>{t('crm.bookings.v.common.email')}</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="bk-field">
        <label>{t('crm.bookings.v.rbook.comment')}</label>
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('crm.bookings.v.rbook.commentPh')} />
      </div>
    </BkModal>
  );
};
