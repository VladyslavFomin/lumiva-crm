import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from './partners/partnerUtils';
import { fetchReservationHistory, type HotelReservationHistoryEntry } from '../../api/hotels';

const ID_FIELDS = new Set(['roomUnitId', 'roomTypeId', 'agencyId', 'hotelId', 'contractId', 'blockId', 'occupancyTypeId']);

type Named = { id: string; name: string };

/** Список изменений брони (PMS-028): событие, кто, когда, поля «было → стало», причина */
export const ReservationHistoryList: React.FC<{
  entries: HotelReservationHistoryEntry[] | null;
  units: Array<{ id: string; label: string }>;
  roomTypes: Named[];
  agencies: Named[];
  lang: string;
}> = ({ entries, units, roomTypes, agencies, lang }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.rack.${key}`, o);
  if (!entries) return <div className="htl-rack-skel small">{Array.from({ length: 4 }, (_, i) => <div key={i} />)}</div>;
  if (!entries.length) return <div className="htl-empty" style={{ padding: 24 }}><h4>{k('history.empty')}</h4></div>;

  const value = (field: string, v: string | null) => {
    if (v === null) return '—';
    if (field === 'roomUnitId') return units.find((u) => u.id === v)?.label || k('history.otherRoom');
    if (field === 'roomTypeId') return roomTypes.find((x) => x.id === v)?.name || k('history.otherType');
    if (field === 'agencyId') return agencies.find((a) => a.id === v)?.name || k('history.linked');
    if (ID_FIELDS.has(field)) return k('history.linked');
    if (field === 'status') return t(`crm.hotels.reservations.status.${v}`, { defaultValue: v });
    if (field === 'paidStatus') return t(`crm.hotels.reservations.paidStatus.${v}`, { defaultValue: v });
    if (field === 'checkIn' || field === 'checkOut') return fmtDate(v, lang);
    if (field === 'optionUntil') return new Date(v).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (field === 'cancelReason') return t(`crm.hotels.lifecycle.cancelReasons.${v}`, { defaultValue: v });
    if (field === 'compReason') return t(`crm.hotels.lifecycle.compReasons.${v}`, { defaultValue: v });
    if (v === 'true') return k('history.yes');
    if (v === 'false') return k('history.no');
    return v;
  };
  // summary на сервере — русский текст для общего журнала; здесь переводим известные события
  const SUMMARY_KEYS: Record<string, string> = {
    'Бронь отеля создана': 'created',
    'Бронь отеля обновлена': 'updated',
    'Гость заселён': 'checkedIn',
    'Гость выселен': 'checkedOut',
    'Платёж удалён': 'paymentRemoved',
    'Бронь перенесена в шахматке': 'moved',
    'Гость переселён': 'relocated',
    'Номер обменян с другой бронью': 'swapped',
    'Бронь отменена': 'cancelled',
    'Гость не заехал (no-show)': 'noShow',
    'Опцион истёк — бронь снята': 'optionExpired',
  };
  const title = (e: HotelReservationHistoryEntry) => {
    const s = e.summary || '';
    if (SUMMARY_KEYS[s]) return k(`history.events.${SUMMARY_KEYS[s]}`);
    if (s.startsWith('Статус брони изменён')) return k('history.events.statusChanged');
    if (s.startsWith('Платёж добавлен')) return k('history.events.paymentAdded', { amount: s.split(':')[1]?.trim() || '' });
    if (s.startsWith('Возврат:')) return k('history.events.refund', { amount: s.split(':')[1]?.trim() || '' });
    if (s.startsWith('Счёт отправлен')) return k('history.events.folioSent');
    return s || k('history.events.updated');
  };

  return (
    <div className="htl-rack-history">
      {entries.map((e) => (
        <div key={e.id} className="it">
          <div className="hd">
            <b>{title(e)}</b>
            <span>{new Date(e.createdAt).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{e.actorName ? ` · ${e.actorName}` : ''}</span>
          </div>
          {e.changes.length > 0 && (
            <div className="ch">
              {e.changes.map((c, i) => (
                c.field === 'reason' ? (
                  <div key={i} className="reason">{k('history.reason')}: {c.newValue}</div>
                ) : (
                  <div key={i}>
                    <span className="f">{t(`crm.hotels.rack.history.fields.${c.field}`, { defaultValue: c.field })}</span>
                    <span className="old">{value(c.field, c.oldValue)}</span>
                    <span className="arr">→</span>
                    <span className="new">{value(c.field, c.newValue)}</span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/** Сворачиваемый блок истории для карточки брони; refreshKey — перечитать после изменений */
export const ReservationHistoryPanel: React.FC<{
  reservationId: string;
  refreshKey: string;
  units: Array<{ id: string; label: string }>;
  roomTypes: Named[];
  agencies: Named[];
  lang: string;
}> = ({ reservationId, refreshKey, units, roomTypes, agencies, lang }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HotelReservationHistoryEntry[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setEntries(null);
    fetchReservationHistory(reservationId).then(setEntries).catch(() => setEntries([]));
  }, [open, reservationId, refreshKey]);
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>
      <button type="button" className="htl-rack-hist-toggle" onClick={() => setOpen((v) => !v)}>
        <span className={`chev${open ? ' on' : ''}`}>›</span>{t('crm.hotels.rack.sheet.history')}
      </button>
      {open && <ReservationHistoryList entries={entries} units={units} roomTypes={roomTypes} agencies={agencies} lang={lang} />}
    </div>
  );
};
