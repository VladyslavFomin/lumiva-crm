import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchHotels, fetchJourneyPreview, testJourney, type GuestJourneyPreview, type Hotel } from '../../api/hotels';

export const JOURNEY_TRIGGERS = ['hotel.guest_before_arrival', 'hotel.guest_arrival_day', 'hotel.guest_in_stay', 'hotel.guest_after_departure', 'hotel.deposit_due'];
const DEFAULT_DAYS: Record<string, number> = { 'hotel.guest_before_arrival': 3, 'hotel.guest_arrival_day': 0, 'hotel.guest_in_stay': 1, 'hotel.guest_after_departure': 1, 'hotel.deposit_due': 2 };

/**
 * Параметры триггера «путь гостя»: за/через сколько дней, во сколько по времени отеля, какие отели. Для сохранённой
 * автоматизации — прогноз «сегодня получат N броней» и «Проверить на брони» (отправить сейчас выбранной брони).
 */
export const GuestJourneyTriggerSettings: React.FC<{
  automationId?: string;
  triggerEvent: string;
  meta: Record<string, any> | null | undefined;
  onMeta: (patch: Record<string, unknown>) => void;
  isActive: boolean;
}> = ({ automationId, triggerEvent, meta, onMeta, isActive }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.automations.form.journey.${key}`, o);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [pv, setPv] = useState<GuestJourneyPreview | null>(null);
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  useEffect(() => { fetchHotels().then(setHotels).catch(() => setHotels([])); }, []);
  const load = () => { if (automationId) fetchJourneyPreview(automationId).then(setPv).catch(() => setPv(null)); };
  useEffect(load, [automationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = meta?.offsetDays ?? DEFAULT_DAYS[triggerEvent] ?? 1;
  const time = meta?.sendTime || '10:00';
  const sel: string[] = Array.isArray(meta?.hotelIds) ? meta!.hotelIds : [];
  const noDays = triggerEvent === 'hotel.guest_arrival_day';
  const run = (rid: string) => {
    if (!automationId) return;
    setTestMsg((m) => ({ ...m, [rid]: '…' }));
    testJourney(automationId, rid)
      .then((r) => setTestMsg((m) => ({ ...m, [rid]: r.status === 'success' ? k('testOk') : `${k('testFail')}: ${r.error || r.status}` })))
      .catch((e) => setTestMsg((m) => ({ ...m, [rid]: (e as Error).message })));
  };
  return (
    <>
      <div className="cfg-section-title">{k('section')}</div>
      <p className="cfg-field-help">{k(`hint.${triggerEvent.replace('.', '_')}`)}</p>
      <div className="cfg-row">
        {!noDays && (
          <div className="cfg-field">
            <label className="cfg-field-label">{k(`days.${triggerEvent.replace('.', '_')}`)}</label>
            <input type="number" className="cfg-input" min={triggerEvent === 'hotel.guest_in_stay' ? 1 : 0} max={365} value={days} onChange={(e) => onMeta({ offsetDays: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
        )}
        <div className="cfg-field">
          <label className="cfg-field-label">{k('time')}</label>
          <input type="time" className="cfg-input" value={time} max="23:30" onChange={(e) => onMeta({ sendTime: e.target.value })} />
        </div>
      </div>
      <p className="cfg-field-help">{k('timeHint')}</p>
      {hotels.length > 1 && (
        <div className="cfg-field">
          <label className="cfg-field-label">{k('hotels')}</label>
          <div className="cfg-chips">
            {hotels.map((h) => {
              const on = sel.includes(h.id);
              return <button key={h.id} type="button" className={on ? 'on' : ''} onClick={() => onMeta({ hotelIds: on ? sel.filter((x) => x !== h.id) : [...sel, h.id] })}>{h.name}</button>;
            })}
          </div>
          <p className="cfg-field-help">{sel.length ? k('hotelsSome', { count: sel.length }) : k('hotelsAll')}</p>
        </div>
      )}
      <div className="cfg-section-title">{k('previewTitle')}</div>
      {!automationId ? <p className="cfg-field-help">{k('saveFirst')}</p> : !pv ? <p className="cfg-field-help">…</p> : (
        <div className="cfg-journey-pv">
          <p className="cfg-field-help">{k('previewLine', { today: pv.today, time: pv.sendTime, sent: pv.sent })}</p>
          {!isActive && <p className="cfg-field-help">{k('inactiveHint')}</p>}
          {pv.sample.map((r) => (
            <div key={r.id} className="cfg-journey-row">
              <span><b>{r.guestName}</b> · {r.checkIn} – {r.checkOut}{hotels.length > 1 ? ` · ${r.hotel}` : ''}</span>
              <button type="button" className="cond-add-btn" disabled={!isActive} onClick={() => run(r.id)}>{k('test')}</button>
              {testMsg[r.id] && <em>{testMsg[r.id]}</em>}
            </div>
          ))}
          {!pv.sample.length && <p className="cfg-field-help">{k('noneToday')}</p>}
        </div>
      )}
    </>
  );
};
