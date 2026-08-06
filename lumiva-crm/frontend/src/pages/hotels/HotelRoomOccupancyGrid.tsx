import React, { useEffect, useMemo, useState } from 'react';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  fetchRoomUnits,
  fetchReservations,
  type HotelRoomType,
  type HotelRoomUnit,
  type HotelReservation,
} from '../../api/hotels';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export const HotelRoomOccupancyGrid: React.FC<{ roomTypes: HotelRoomType[] }> = ({ roomTypes }) => {
  const { showAlert } = useAlertModal();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id || '');
  const [units, setUnits] = useState<HotelRoomUnit[]>([]);
  const [reservations, setReservations] = useState<HotelReservation[]>([]);

  useEffect(() => {
    if (roomTypes.length && !roomTypeId) setRoomTypeId(roomTypes[0].id);
  }, [roomTypes, roomTypeId]);

  useEffect(() => {
    if (!roomTypeId) return;
    Promise.all([
      fetchRoomUnits({ roomTypeId }).then((u) => u.filter((x) => x.active)),
      fetchReservations({ roomTypeId }),
    ])
      .then(([u, r]) => { setUnits(u); setReservations(r); })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить занятость номеров', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypeId]);

  const days = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [year, month]);

  // Half-open interval (checkIn <= date < checkOut), skipping cancelled — same convention as
  // HotelAvailabilityService's server-side overbooking check.
  const occupiedByUnit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of reservations) {
      if (!r.roomUnitId || r.status === 'cancelled') continue;
      if (!map.has(r.roomUnitId)) map.set(r.roomUnitId, new Set());
      const set = map.get(r.roomUnitId)!;
      for (let d = new Date(`${r.checkIn}T00:00:00Z`); d < new Date(`${r.checkOut}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        set.add(d.toISOString().slice(0, 10));
      }
    }
    return map;
  }, [reservations]);

  if (!roomTypes.length) {
    return <div style={{ padding: 24, color: 'var(--fg-3)', fontSize: 13 }}>Сначала добавьте тип номера.</div>;
  }

  return (
    <div>
      <div className="pcal-toolbar">
        <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
          {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div className="pcal-month-nav">
          <button onClick={() => setMonth((m) => Math.max(0, m - 1))}><Ic d={HTL_ICON.chev} size={14} sw={2} style={{ transform: 'rotate(90deg)' }} /></button>
          <div className="pcal-month-label">{MONTH_NAMES[month]} {year}</div>
          <button onClick={() => setMonth((m) => Math.min(11, m + 1))}><Ic d={HTL_ICON.chev} size={14} sw={2} style={{ transform: 'rotate(-90deg)' }} /></button>
        </div>
      </div>

      {units.length === 0 ? (
        <div style={{ padding: 24, color: 'var(--fg-3)', fontSize: 13 }}>
          У этого типа номера ещё нет добавленных номеров — добавьте их на странице отеля, вкладка «Номера».
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--surface-1)', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--line-2)' }}>Номер</th>
                {days.map((d) => (
                  <th key={d} style={{ padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid var(--line-2)', color: 'var(--fg-3)', fontWeight: 500, minWidth: 22 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const occupied = occupiedByUnit.get(u.id) || new Set<string>();
                return (
                  <tr key={u.id}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--surface-1)', padding: '4px 10px', fontWeight: 600, borderBottom: '1px solid var(--line-2)' }}>{u.label}</td>
                    {days.map((d) => {
                      const key = dateKey(year, month, d);
                      const isOccupied = occupied.has(key);
                      return (
                        <td key={d} style={{ padding: 2, borderBottom: '1px solid var(--line-2)' }}>
                          <div
                            title={`${u.label} · ${key} · ${isOccupied ? 'занято' : 'свободно'}`}
                            style={{
                              width: 18, height: 18, borderRadius: 4, margin: '0 auto',
                              background: isOccupied ? '#d64545' : '#2f9e5c',
                              opacity: isOccupied ? 0.85 : 0.35,
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pcal-legend" style={{ marginTop: 12 }}>
        <span><i style={{ background: '#2f9e5c', opacity: 0.35 }} />Свободно</span>
        <span><i style={{ background: '#d64545', opacity: 0.85 }} />Занято</span>
      </div>
    </div>
  );
};
