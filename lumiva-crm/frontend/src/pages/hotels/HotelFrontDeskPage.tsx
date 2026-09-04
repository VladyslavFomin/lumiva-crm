import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { HousekeepingBadge } from './HotelDetailPage';
import {
  fetchFrontDeskToday,
  checkInReservation,
  checkOutReservation,
  fetchHotels,
  fetchRoomTypes,
  fetchRoomUnits,
  fetchReservations,
  type HotelFrontDeskToday,
  type Hotel,
  type HotelRoomType,
  type HotelRoomUnit,
  type HotelReservation,
} from '../../api/hotels';
import './hotels-design.css';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const HotelFrontDeskPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [date, setDate] = useState(todayIso());
  const [hotelId, setHotelId] = useState('');
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [roomUnits, setRoomUnits] = useState<HotelRoomUnit[]>([]);
  const [data, setData] = useState<HotelFrontDeskToday | null>(null);
  const [allReservations, setAllReservations] = useState<HotelReservation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkInUnitByReservation, setCheckInUnitByReservation] = useState<Record<string, string>>({});

  const roomTypeById = useMemo(() => new Map(roomTypes.map((r) => [r.id, r])), [roomTypes]);
  const roomUnitById = useMemo(() => new Map(roomUnits.map((u) => [u.id, u])), [roomUnits]);
  const activeUnitsByRoomType = useMemo(() => {
    const map = new Map<string, HotelRoomUnit[]>();
    for (const u of roomUnits) {
      if (!u.active) continue;
      if (!map.has(u.roomTypeId)) map.set(u.roomTypeId, []);
      map.get(u.roomTypeId)!.push(u);
    }
    return map;
  }, [roomUnits]);

  const load = () => {
    fetchFrontDeskToday(date, hotelId || undefined)
      .then(setData)
      .catch((e) => showAlert(e.message || t('crm.hotels.frontDesk.error'), { variant: 'error' }));
  };

  useEffect(() => {
    fetchHotels()
      .then((h) => {
        setHotels(h);
        return Promise.all(h.map((hotel) => fetchRoomTypes(hotel.id)));
      })
      .then((lists) => {
        const flat = lists.flat();
        setRoomTypes(flat);
        return Promise.all(flat.map((rt) => fetchRoomUnits({ roomTypeId: rt.id })));
      })
      .then((unitLists) => setRoomUnits(unitLists.flat()))
      .then(() => fetchReservations())
      .then(setAllReservations)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, hotelId]);

  const handleCheckIn = (id: string) => {
    setBusyId(id);
    checkInReservation(id, checkInUnitByReservation[id] || undefined)
      .then(() => load())
      .catch((e) => showAlert(e.message || t('crm.hotels.frontDesk.arrivals.checkInError'), { variant: 'error' }))
      .finally(() => setBusyId(null));
  };

  const occupiedUnitIdsFor = (r: HotelFrontDeskToday['arrivals'][number]) => {
    const set = new Set<string>();
    for (const other of allReservations) {
      if (!other.roomUnitId || other.status === 'cancelled' || other.id === r.id) continue;
      if (other.roomTypeId !== r.roomTypeId) continue;
      if (other.checkIn < r.checkOut && other.checkOut > r.checkIn) set.add(other.roomUnitId);
    }
    return set;
  };

  const roomCell = (r: { roomTypeId: string; roomUnitId: string | null }) => {
    const unit = r.roomUnitId ? roomUnitById.get(r.roomUnitId) : undefined;
    if (unit) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--ink)' }}>
          <HousekeepingBadge status={unit.housekeepingStatus} />
          {unit.label}
        </span>
      );
    }
    return (
      <span>
        {roomTypeById.get(r.roomTypeId)?.name || '—'}
        <span style={{ color: 'var(--fg-3)', marginLeft: 5 }}>{t('crm.hotels.frontDesk.unassigned')}</span>
      </span>
    );
  };

  const handleCheckOut = (id: string) => {
    setBusyId(id);
    checkOutReservation(id)
      .then(() => load())
      .catch((e) => showAlert(e.message || t('crm.hotels.frontDesk.departures.checkOutError'), { variant: 'error' }))
      .finally(() => setBusyId(null));
  };

  return (
    <MainLayout>
      <PageHelpButton topic="hotelFrontDesk" />
      <div className="px-scope">
        <HotelsSubnav active="frontdesk" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.frontDesk.kicker', { count: data?.inHouseCount ?? 0 })}</div>
            <h1>{t('crm.hotels.frontDesk.title')}</h1>
            <p className="sub">{t('crm.hotels.frontDesk.subtitle')}</p>
          </div>
          <div className="htl-hero-r io-toolbar">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 9, fontSize: 12.5 }} />
            <select value={hotelId} onChange={(e) => setHotelId(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 9, fontSize: 12.5 }}>
              <option value="">{t('crm.hotels.frontDesk.allHotels')}</option>
              {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 10 }}>
              {t('crm.hotels.frontDesk.arrivals.title', { count: data?.arrivals.length ?? 0 })}
            </div>
            <div className="bk-table-wrap">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th>{t('crm.hotels.frontDesk.arrivals.colGuest')}</th>
                    <th>{t('crm.hotels.frontDesk.arrivals.colRoom')}</th>
                    <th>{t('crm.hotels.frontDesk.arrivals.colNights')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data?.arrivals ?? []).map((r) => {
                    const units = activeUnitsByRoomType.get(r.roomTypeId) || [];
                    const selectedUnitId = checkInUnitByReservation[r.id] ?? r.roomUnitId ?? '';
                    const occupied = occupiedUnitIdsFor(r);
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                        <td style={{ fontSize: 11.5 }}>
                          {units.length > 0 ? (
                            <select
                              value={selectedUnitId}
                              onChange={(e) => setCheckInUnitByReservation((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              style={{ padding: '4px 6px', border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 11.5 }}
                            >
                              <option value="">{t('crm.hotels.frontDesk.arrivals.noRoomOption', { name: roomTypeById.get(r.roomTypeId)?.name || '—' })}</option>
                              {units.map((u) => {
                                const isOccupied = occupied.has(u.id);
                                return (
                                  <option key={u.id} value={u.id} disabled={isOccupied} style={{ color: isOccupied ? '#d64545' : '#2f9e5c' }}>
                                    {u.label}{isOccupied ? t('crm.hotels.frontDesk.arrivals.occupied') : t('crm.hotels.frontDesk.arrivals.free')}
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            roomCell(r)
                          )}
                        </td>
                        <td style={{ fontSize: 11.5 }}>{r.pax} pax</td>
                        <td>
                          <button className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => handleCheckIn(r.id)}>
                            <Ic d={HTL_ICON.check} size={12} />{t('crm.hotels.frontDesk.arrivals.checkIn')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {(data?.arrivals ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--fg-3)', padding: 20 }}>{t('crm.hotels.frontDesk.arrivals.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 10 }}>
              {t('crm.hotels.frontDesk.departures.title', { count: data?.departures.length ?? 0 })}
            </div>
            <div className="bk-table-wrap">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th>{t('crm.hotels.frontDesk.departures.colGuest')}</th>
                    <th>{t('crm.hotels.frontDesk.departures.colRoom')}</th>
                    <th>{t('crm.hotels.frontDesk.departures.colNights')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data?.departures ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                      <td style={{ fontSize: 11.5 }}>{roomCell(r)}</td>
                      <td style={{ fontSize: 11.5 }}>{r.pax} pax</td>
                      <td>
                        <button className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => handleCheckOut(r.id)}>
                          <Ic d={HTL_ICON.check} size={12} />{t('crm.hotels.frontDesk.departures.checkOut')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(data?.departures ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--fg-3)', padding: 20 }}>{t('crm.hotels.frontDesk.departures.empty')}</td></tr>
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
