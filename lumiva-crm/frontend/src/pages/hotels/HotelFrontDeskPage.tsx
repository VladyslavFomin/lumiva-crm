import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  fetchFrontDeskToday,
  checkInReservation,
  checkOutReservation,
  fetchHotels,
  fetchRoomTypes,
  type HotelFrontDeskToday,
  type Hotel,
  type HotelRoomType,
} from '../../api/hotels';
import './hotels-design.css';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const HotelFrontDeskPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [date, setDate] = useState(todayIso());
  const [hotelId, setHotelId] = useState('');
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [data, setData] = useState<HotelFrontDeskToday | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const roomTypeById = useMemo(() => new Map(roomTypes.map((r) => [r.id, r])), [roomTypes]);

  const load = () => {
    fetchFrontDeskToday(date, hotelId || undefined)
      .then(setData)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить данные', { variant: 'error' }));
  };

  useEffect(() => {
    fetchHotels()
      .then((h) => {
        setHotels(h);
        return Promise.all(h.map((hotel) => fetchRoomTypes(hotel.id)));
      })
      .then((lists) => setRoomTypes(lists.flat()))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, hotelId]);

  const handleCheckIn = (id: string) => {
    setBusyId(id);
    checkInReservation(id)
      .then(() => load())
      .catch((e) => showAlert(e.message || 'Не удалось заселить', { variant: 'error' }))
      .finally(() => setBusyId(null));
  };

  const handleCheckOut = (id: string) => {
    setBusyId(id);
    checkOutReservation(id)
      .then(() => load())
      .catch((e) => showAlert(e.message || 'Не удалось выселить', { variant: 'error' }))
      .finally(() => setBusyId(null));
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="frontdesk" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{data?.inHouseCount ?? 0} ГОСТЕЙ В ОТЕЛЕ</div>
            <h1>Сегодня</h1>
            <p className="sub">Заезды и выезды на выбранную дату — быстрое заселение и выселение.</p>
          </div>
          <div className="htl-hero-r io-toolbar">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 9, fontSize: 12.5 }} />
            <select value={hotelId} onChange={(e) => setHotelId(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 9, fontSize: 12.5 }}>
              <option value="">Все отели</option>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 10 }}>
              Заезды ({data?.arrivals.length ?? 0})
            </div>
            <div className="bk-table-wrap">
              <table className="bk-table">
                <thead><tr><th>Гость</th><th>Номер</th><th>Ночей</th><th /></tr></thead>
                <tbody>
                  {(data?.arrivals ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{roomTypeById.get(r.roomTypeId)?.name || '—'}</td>
                      <td style={{ fontSize: 11.5 }}>{r.pax} pax</td>
                      <td>
                        <button className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => handleCheckIn(r.id)}>
                          <Ic d={HTL_ICON.check} size={12} />Заселить
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(data?.arrivals ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--fg-3)', padding: 20 }}>Нет заездов</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 10 }}>
              Выезды ({data?.departures.length ?? 0})
            </div>
            <div className="bk-table-wrap">
              <table className="bk-table">
                <thead><tr><th>Гость</th><th>Номер</th><th>Ночей</th><th /></tr></thead>
                <tbody>
                  {(data?.departures ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{roomTypeById.get(r.roomTypeId)?.name || '—'}</td>
                      <td style={{ fontSize: 11.5 }}>{r.pax} pax</td>
                      <td>
                        <button className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => handleCheckOut(r.id)}>
                          <Ic d={HTL_ICON.check} size={12} />Выселить
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(data?.departures ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--fg-3)', padding: 20 }}>Нет выездов</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
