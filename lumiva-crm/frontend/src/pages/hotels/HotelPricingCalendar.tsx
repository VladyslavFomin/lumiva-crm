import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  fetchDateOverrides,
  fetchMonthFillStats,
  upsertDateOverride,
  type HotelRoomType,
  type HotelRoomDateOverride,
  type HotelMonthFillStats,
} from '../../api/hotels';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

interface DayCell {
  day: number;
  key: string;
  weekend: boolean;
  price: number;
  blocked: boolean;
  discountPct: number;
}

export const HotelPricingCalendar: React.FC<{ roomTypes: HotelRoomType[] }> = ({ roomTypes }) => {
  const { t } = useTranslation();
  const monthNames = t('crm.hotels.calendarCommon.months', { returnObjects: true }) as string[];
  const dow = t('crm.hotels.calendarCommon.dow', { returnObjects: true }) as string[];
  const { showAlert } = useAlertModal();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id || '');
  const [overrides, setOverrides] = useState<HotelRoomDateOverride[]>([]);
  const [fill, setFill] = useState<HotelMonthFillStats | null>(null);
  const [editDay, setEditDay] = useState<(DayCell & { x: number; y: number }) | null>(null);

  useEffect(() => {
    if (roomTypes.length && !roomTypeId) setRoomTypeId(roomTypes[0].id);
  }, [roomTypes, roomTypeId]);

  const roomType = roomTypes.find((r) => r.id === roomTypeId) || null;

  useEffect(() => {
    if (!roomTypeId) return;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const from = dateKey(year, month, 1);
    const to = dateKey(year, month, daysInMonth);
    Promise.all([fetchDateOverrides(roomTypeId, from, to), fetchMonthFillStats(roomTypeId, year, month)])
      .then(([o, f]) => {
        setOverrides(o);
        setFill(f);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricingCalendar.loadError'), { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypeId, year, month]);

  const cells = useMemo<Array<DayCell | null>>(() => {
    if (!roomType) return [];
    const base = Number(roomType.basePrice) || 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const byDate = new Map(overrides.map((o) => [o.date, o]));
    const list: Array<DayCell | null> = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(year, month, d);
      const weekend = ((firstDow + d - 1) % 7) >= 5;
      const override = byDate.get(key);
      const price = override?.price != null ? Number(override.price) : weekend ? base + 18 : base;
      list.push({
        day: d,
        key,
        weekend,
        price,
        blocked: override?.blocked || false,
        discountPct: Number(override?.discountPct || 0),
      });
    }
    return list;
  }, [roomType, overrides, year, month]);

  const saveDay = (dto: { price?: string; blocked?: boolean; discountPct?: string; minNights?: number }) => {
    if (!editDay || !roomTypeId) return;
    upsertDateOverride(roomTypeId, editDay.key, dto)
      .then((row) => {
        setOverrides((prev) => {
          const next = prev.filter((o) => o.date !== row.date);
          next.push(row);
          return next;
        });
        setEditDay(null);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.pricingCalendar.saveError'), { variant: 'error' }));
  };

  if (!roomTypes.length) {
    return <div style={{ padding: 24, color: 'var(--fg-3)', fontSize: 13 }}>{t('crm.hotels.pricingCalendar.needRoomType')}</div>;
  }

  return (
    <div>
      <div className="pcal-toolbar">
        <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
          {roomTypes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <div className="pcal-month-nav">
          <button onClick={() => setMonth((m) => Math.max(0, m - 1))}><Ic d={HTL_ICON.chev} size={14} sw={2} style={{ transform: 'rotate(90deg)' }} /></button>
          <div className="pcal-month-label">{monthNames[month]} {year}</div>
          <button onClick={() => setMonth((m) => Math.min(11, m + 1))}><Ic d={HTL_ICON.chev} size={14} sw={2} style={{ transform: 'rotate(-90deg)' }} /></button>
        </div>
        <button className="btn btn-sm"><Ic d={HTL_ICON.copy} size={13} />{t('crm.hotels.pricingCalendar.copyToMonth')}</button>
      </div>

      <div className="pcal-grid">
        {dow.map((d) => <div key={d} className="pcal-dow">{d}</div>)}
        {cells.map((c, i) =>
          c ? (
            <div
              key={i}
              className={`pcal-day${c.weekend ? ' weekend' : ''}${c.blocked ? ' blocked' : ''}`}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setEditDay({ ...c, x: r.left, y: r.bottom + 6 });
              }}
            >
              {c.discountPct > 0 && <span className="ddiscount">-{c.discountPct}%</span>}
              <div className="dnum">{c.day}</div>
              <div className="dprice">{c.blocked ? '—' : `$${Math.round(c.price)}`}</div>
            </div>
          ) : (
            <div key={i} className="pcal-day empty" />
          ),
        )}
      </div>

      <div className="pcal-legend">
        <span><i style={{ background: '#fff' }} />{t('crm.hotels.pricingCalendar.legend.normal')}</span>
        <span><i style={{ background: 'var(--bg-muted)' }} />{t('crm.hotels.pricingCalendar.legend.weekend')}</span>
        <span><i style={{ background: '#fdecea' }} />{t('crm.hotels.pricingCalendar.legend.discount')}</span>
        <span><i style={{ background: 'repeating-linear-gradient(135deg,#f5f5f5,#f5f5f5 3px,#ededed 3px,#ededed 6px)' }} />{t('crm.hotels.pricingCalendar.legend.closed')}</span>
      </div>

      {fill && (
        <div className="htl-occ-strip">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--fg-3)' }}>{t('crm.hotels.pricingCalendar.fillStrip.titleFor', { name: roomType?.name, month: monthNames[month] })}</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontWeight: 600 }}>{t('crm.hotels.pricingCalendar.fillStrip.occupiedOf', { occupied: fill.occupied, total: fill.total })}</span>
            </div>
            <div className="htl-fill-bar"><div className="fill" style={{ width: `${fill.occupancyPct}%` }} /></div>
          </div>
          <div className="htl-fill-stats">
            <span>{t('crm.hotels.pricingCalendar.fillStrip.total')} <b>{fill.total}</b></span>
            <span>{t('crm.hotels.pricingCalendar.fillStrip.occupied')} <b>{fill.occupied}</b></span>
            <span>{t('crm.hotels.pricingCalendar.fillStrip.free')} <b>{fill.free}</b></span>
            <span>{t('crm.hotels.pricingCalendar.fillStrip.occupancy')} <b>{fill.occupancyPct}%</b></span>
          </div>
        </div>
      )}

      {editDay && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 190 }} onClick={() => setEditDay(null)} />
          <div
            className="pcal-editor"
            style={{
              left: Math.min(editDay.x, window.innerWidth - 320),
              top: Math.min(editDay.y, window.innerHeight - 260),
            }}
          >
            <h4>{editDay.day} {monthNames[month]} {year}</h4>
            <label>{t('crm.hotels.pricingCalendar.editor.priceLabel')}</label>
            <input id="htl-edit-price" defaultValue={Math.round(editDay.price)} />
            <div className="row2">
              <div><label>{t('crm.hotels.pricingCalendar.editor.discountLabel')}</label><input id="htl-edit-discount" defaultValue={editDay.discountPct} /></div>
              <div><label>{t('crm.hotels.pricingCalendar.editor.minNightsLabel')}</label><input id="htl-edit-min-nights" defaultValue={1} /></div>
            </div>
            <label>{t('crm.hotels.pricingCalendar.editor.availabilityLabel')}</label>
            <select id="htl-edit-blocked" defaultValue={editDay.blocked ? 'closed' : 'open'}>
              <option value="open">{t('crm.hotels.pricingCalendar.editor.open')}</option>
              <option value="closed">{t('crm.hotels.pricingCalendar.editor.closed')}</option>
            </select>
            <div className="pcal-editor-foot">
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setEditDay(null)}>{t('crm.hotels.pricingCalendar.editor.cancel')}</button>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
                onClick={() => {
                  const price = (document.getElementById('htl-edit-price') as HTMLInputElement)?.value;
                  const discountPct = (document.getElementById('htl-edit-discount') as HTMLInputElement)?.value;
                  const minNights = (document.getElementById('htl-edit-min-nights') as HTMLInputElement)?.value;
                  const blocked = (document.getElementById('htl-edit-blocked') as HTMLSelectElement)?.value === 'closed';
                  saveDay({ price, discountPct, minNights: Number(minNights) || 1, blocked });
                }}
              >
                {t('crm.hotels.pricingCalendar.editor.save')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
