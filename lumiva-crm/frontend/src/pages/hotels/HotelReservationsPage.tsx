import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { HousekeepingBadge } from './HotelDetailPage';
import {
  fetchReservations,
  createReservation,
  updateReservation,
  checkInReservation,
  checkOutReservation,
  addReservationPayment,
  removeReservationPayment,
  downloadReservationFolio,
  sendFolioEmail,
  fetchReservationPrice,
  fetchHotels,
  fetchRoomTypes,
  fetchAgencies,
  fetchRoomUnits,
  fetchOccupancyTypes,
  fetchMarkets,
  fetchMarketPrices,
  previewReservationsImport,
  applyReservationsImport,
  HOTEL_RESERVATION_STATUS_LABELS_RU,
  HOTEL_RESERVATION_PAID_LABELS_RU,
  type HotelReservation,
  type Hotel,
  type HotelRoomType,
  type HotelAgency,
  type HotelRoomUnit,
  type HotelRoomOccupancyType,
  type HotelMarket,
  type HotelRoomMarketPrice,
  type HotelReservationGuest,
  type HotelReservationImportPreview,
} from '../../api/hotels';
import './hotels-design.css';

function nights(checkIn: string, checkOut: string) {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

const STATUS_FILTERS: Array<[string, string]> = [
  ['all', 'Все'],
  ['confirmed', 'Подтверждены'],
  ['pending', 'Ожидают'],
  ['checked_in', 'Заселены'],
  ['checked_out', 'Выехали'],
  ['cancelled', 'Отменены'],
];

export const HotelReservationsPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [allRoomUnits, setAllRoomUnits] = useState<HotelRoomUnit[]>([]);
  const [agencies, setAgencies] = useState<HotelAgency[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [selected, setSelected] = useState<HotelReservation | null>(null);
  const [modalState, setModalState] = useState<'new' | HotelReservation | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [checkInUnits, setCheckInUnits] = useState<HotelRoomUnit[]>([]);
  const [checkInUnitId, setCheckInUnitId] = useState('');
  const [checkInOutBusy, setCheckInOutBusy] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);

  const hotelById = useMemo(() => new Map(hotels.map((h) => [h.id, h])), [hotels]);
  const roomTypeById = useMemo(() => new Map(roomTypes.map((r) => [r.id, r])), [roomTypes]);
  const agencyById = useMemo(() => new Map(agencies.map((a) => [a.id, a])), [agencies]);
  const roomUnitById = useMemo(() => new Map(allRoomUnits.map((u) => [u.id, u])), [allRoomUnits]);

  const load = () => {
    fetchReservations()
      .then(setReservations)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить брони', { variant: 'error' }));
  };

  useEffect(() => {
    load();
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
      .then((unitLists) => setAllRoomUnits(unitLists.flat()))
      .catch((e) => showAlert(e.message || 'Не удалось загрузить отели', { variant: 'error' }));
    fetchAgencies()
      .then(setAgencies)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить агентства', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCheckInUnitId('');
    if (selected && (selected.status === 'confirmed' || selected.status === 'pending')) {
      fetchRoomUnits({ roomTypeId: selected.roomTypeId }).then((units) => setCheckInUnits(units.filter((u) => u.active))).catch(() => setCheckInUnits([]));
    } else {
      setCheckInUnits([]);
    }
  }, [selected?.id, selected?.roomTypeId, selected?.status]);

  const handleCheckIn = () => {
    if (!selected) return;
    setCheckInOutBusy(true);
    checkInReservation(selected.id, checkInUnitId || undefined)
      .then((r) => { setSelected(r); load(); })
      .catch((e) => showAlert(e.message || 'Не удалось заселить', { variant: 'error' }))
      .finally(() => setCheckInOutBusy(false));
  };

  const handleCheckOut = () => {
    if (!selected) return;
    setCheckInOutBusy(true);
    checkOutReservation(selected.id)
      .then((r) => { setSelected(r); load(); })
      .catch((e) => showAlert(e.message || 'Не удалось выселить', { variant: 'error' }))
      .finally(() => setCheckInOutBusy(false));
  };

  const handleAddPayment = () => {
    if (!selected || !paymentAmount) return;
    setPaymentBusy(true);
    addReservationPayment(selected.id, { date: paymentDate, amount: paymentAmount, method: paymentMethod, note: paymentNote || undefined })
      .then((r) => { setSelected(r); load(); setPaymentAmount(''); setPaymentNote(''); })
      .catch((e) => showAlert(e.message || 'Не удалось добавить платёж', { variant: 'error' }))
      .finally(() => setPaymentBusy(false));
  };

  const handleSendFolioEmail = () => {
    if (!selected) return;
    setEmailBusy(true);
    sendFolioEmail(selected.id)
      .then(() => showAlert('Счёт отправлен на почту гостя', { variant: 'success' }))
      .catch((e) => showAlert(e.message || 'Не удалось отправить счёт', { variant: 'error' }))
      .finally(() => setEmailBusy(false));
  };

  const handleRemovePayment = (paymentId: string) => {
    if (!selected) return;
    removeReservationPayment(selected.id, paymentId)
      .then((r) => { setSelected(r); load(); })
      .catch((e) => showAlert(e.message || 'Не удалось удалить платёж', { variant: 'error' }));
  };

  const filtered = useMemo(
    () =>
      reservations.filter(
        (r) =>
          (filter === 'all' || r.status === filter) &&
          (agencyFilter === 'all' || r.agencyId === agencyFilter) &&
          r.guestName.toLowerCase().includes(q.toLowerCase()),
      ),
    [reservations, filter, agencyFilter, q],
  );

  const totals = useMemo(
    () =>
      filtered.reduce(
        (a, r) => ({
          rooms: a.rooms + Number(r.roomTotal),
          cost: a.cost + Number(r.costPerNight) * nights(r.checkIn, r.checkOut),
          disc: a.disc + (Number(r.roomTotal) - Number(r.total)),
        }),
        { rooms: 0, cost: 0, disc: 0 },
      ),
    [filtered],
  );

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="reservations" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{reservations.length} БРОНЕЙ · {agencies.length} КАНАЛОВ</div>
            <h1>Брони отелей</h1>
            <p className="sub">Все резервации по всем объектам: агентство/туроператор, рынок, полная финансовая раскладка по каждой брони.</p>
          </div>
          <div className="htl-hero-r io-toolbar">
            <button className="btn" onClick={() => setShowImport(true)}><Ic d={HTL_ICON.download} size={13} />Импорт из Excel</button>
            <button className="btn btn-primary" onClick={() => setModalState('new')}><Ic d={HTL_ICON.plus} size={14} />Новая бронь</button>
          </div>
        </div>

        <div className="htl-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="htl-kpi"><div className="l">Сумма броней (номер)</div><div className="v">${totals.rooms.toLocaleString()}</div></div>
          <div className="htl-kpi"><div className="l">Себестоимость (период)</div><div className="v">${totals.cost.toLocaleString()}</div></div>
          <div className="htl-kpi"><div className="l">Скидки предоставлены</div><div className="v">${Math.round(totals.disc).toLocaleString()}</div></div>
          <div className="htl-kpi"><div className="l">Маржа (оценка)</div><div className="v">${(totals.rooms - totals.disc - totals.cost).toLocaleString()}</div></div>
        </div>

        <div style={{ display: 'flex', gap: 10, margin: '16px 0', flexWrap: 'wrap' }}>
          <div className="bk-search" style={{ flex: 1, maxWidth: 280 }}>
            <Ic d={HTL_ICON.search} size={14} />
            <input placeholder="Гость…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 9, fontSize: 12.5 }}>
            <option value="all">Все агентства</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {STATUS_FILTERS.map(([k, l]) => (
              <div key={k} className={`bk-sv-tab${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{l}</div>
            ))}
          </div>
        </div>

        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th>Гость</th><th>Отель / номер</th><th>Агентство</th><th>Создана</th><th>Заезд — выезд</th><th>Ночей / PAX</th>
                <th>Себест./ночь</th><th>PP/ночь</th><th>Brutto/ночь</th><th>Скидка</th><th>Итого</th><th>Оплата</th><th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setSelected(r)}>
                  <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                  <td>
                    <div>{hotelById.get(r.hotelId)?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {roomTypeById.get(r.roomTypeId)?.name || '—'}
                      {r.roomUnitId && roomUnitById.get(r.roomUnitId) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, color: 'var(--ink)' }}>
                          · <HousekeepingBadge status={roomUnitById.get(r.roomUnitId)!.housekeepingStatus} />
                          {roomUnitById.get(r.roomUnitId)!.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><span className="agency-pill"><i />{r.agencyId ? agencyById.get(r.agencyId)?.name || '—' : '—'}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--fg-3)' }}>{new Date(r.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td style={{ fontSize: 12 }}>{r.checkIn} → {r.checkOut}</td>
                  <td style={{ fontSize: 11.5 }}>{nights(r.checkIn, r.checkOut)}н / {r.pax} pax</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>${r.costPerNight}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>${r.ppPerNight}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>${r.grossPerNight}</td>
                  <td style={{ fontSize: 11, color: Number(r.discountPct) ? '#cc2f47' : 'var(--fg-3)' }}>{Number(r.discountPct) ? `-${r.discountPct}%` : '—'}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontWeight: 700 }}>${Number(r.total).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ fontSize: 11, color: r.paidStatus === 'full' ? '#1f8a5e' : r.paidStatus === 'none' ? '#cc2f47' : 'var(--fg-3)' }}>{HOTEL_RESERVATION_PAID_LABELS_RU[r.paidStatus]}</td>
                  <td><span className={`bk-badge ${r.status === 'checked_out' ? '' : r.status === 'checked_in' ? 'confirmed' : r.status}`}>{HOTEL_RESERVATION_STATUS_LABELS_RU[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="px-scope">
          <div className="bk-drawer-back" onClick={() => setSelected(null)} />
          <div className="bk-drawer htl-res-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bk-drawer-head">
              <div>
                <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{selected.id.slice(0, 8)}</div>
                <h3>{selected.guestName}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setModalState(selected)} title="Изменить"><Ic d={HTL_ICON.pencil} size={16} /></button>
                <button onClick={() => setSelected(null)}><Ic d={HTL_ICON.x} size={16} /></button>
              </div>
            </div>
            <div className="bk-drawer-body">
              <div className="htl-info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="htl-info-item"><div className="l">Отель / тип номера</div><div className="v" style={{ fontSize: 12.5 }}>{hotelById.get(selected.hotelId)?.name}<br /><span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>{roomTypeById.get(selected.roomTypeId)?.name}</span></div></div>
                <div className="htl-info-item">
                  <div className="l">Номер</div>
                  <div className="v" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selected.roomUnitId && roomUnitById.get(selected.roomUnitId) ? (
                      <>
                        <HousekeepingBadge status={roomUnitById.get(selected.roomUnitId)!.housekeepingStatus} />
                        {roomUnitById.get(selected.roomUnitId)!.label}
                      </>
                    ) : (
                      <span style={{ color: 'var(--fg-3)' }}>не назначен</span>
                    )}
                  </div>
                </div>
                <div className="htl-info-item"><div className="l">Агентство</div><div className="v" style={{ fontSize: 12.5 }}>{selected.agencyId ? agencyById.get(selected.agencyId)?.name : '—'}</div></div>
                <div className="htl-info-item"><div className="l">Email гостя</div><div className="v" style={{ fontSize: 12.5 }}>{selected.guestEmail || '—'}</div></div>
                <div className="htl-info-item"><div className="l">Телефон гостя</div><div className="v" style={{ fontSize: 12.5 }}>{selected.guestPhone || '—'}</div></div>
                <div className="htl-info-item"><div className="l">Дата создания</div><div className="v" style={{ fontSize: 12.5 }}>{new Date(selected.createdAt).toLocaleDateString('ru-RU')}</div></div>
                <div className="htl-info-item"><div className="l">Рынок продаж</div><div className="v" style={{ fontSize: 12.5 }}>{selected.market || '—'}</div></div>
                <div className="htl-info-item"><div className="l">Заезд</div><div className="v" style={{ fontSize: 12.5 }}>{selected.checkIn}</div></div>
                <div className="htl-info-item"><div className="l">Выезд</div><div className="v" style={{ fontSize: 12.5 }}>{selected.checkOut}</div></div>
                <div className="htl-info-item"><div className="l">Ночей</div><div className="v" style={{ fontSize: 12.5 }}>{nights(selected.checkIn, selected.checkOut)}</div></div>
                <div className="htl-info-item"><div className="l">Гостей (PAX)</div><div className="v" style={{ fontSize: 12.5 }}>{selected.pax}</div></div>
              </div>

              {(selected.earlyCheckIn || selected.lateCheckOut) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {selected.earlyCheckIn && <span className="ppt-stop-badge" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>Раннее заселение</span>}
                  {selected.lateCheckOut && <span className="ppt-stop-badge" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>Позднее выселение</span>}
                </div>
              )}
              {selected.notes && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--fg-3)', whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
              )}

              {selected.guests.length > 0 && (
                <>
                  <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                    Гости ({selected.guests.length})
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.guests.map((g) => (
                      <div key={g.id} style={{ border: '1px solid var(--line-2)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5 }}>
                        <div style={{ fontWeight: 600 }}>{g.fullName || '—'}{g.age ? `, ${g.age} лет` : ''}</div>
                        <div style={{ color: 'var(--fg-3)', fontSize: 11.5, marginTop: 2 }}>
                          {g.citizenship && <span>{g.citizenship} · </span>}
                          {g.passportNumber && <span>паспорт {g.passportNumber}</span>}
                          {g.passportExpiry && <span> (до {g.passportExpiry})</span>}
                        </div>
                        {g.note && <div style={{ color: 'var(--fg-3)', fontSize: 11.5, marginTop: 2 }}>{g.note}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>Финансовая раскладка</div>
              <div className="htl-price-breakdown" style={{ marginTop: 8 }}>
                <div className="row"><span>Себестоимость / ночь</span><b>${selected.costPerNight}</b></div>
                <div className="row"><span>PP / ночь</span><b>${selected.ppPerNight}</b></div>
                <div className="row"><span>Brutto / ночь</span><b>${selected.grossPerNight}</b></div>
                <div className="row"><span>PP за весь период</span><b>${selected.ppTotal}</b></div>
                <div className="row"><span>Номер за весь период</span><b>${selected.roomTotal}</b></div>
                <div className="row"><span>Скидка</span><b style={{ color: Number(selected.discountPct) ? '#cc2f47' : 'inherit' }}>{Number(selected.discountPct) ? `-${selected.discountPct}%` : '—'}</b></div>
                <div className="row final" style={{ gridColumn: '1 / -1' }}><span>Итоговая стоимость</span><b>${Number(selected.total).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 13 }}>
                <span style={{ color: 'var(--fg-3)' }}>Статус оплаты</span>
                <select
                  style={{ padding: '6px 10px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}
                  value={selected.paidStatus}
                  onChange={(e) => {
                    const paidStatus = e.target.value as HotelReservation['paidStatus'];
                    updateReservation(selected.id, { paidStatus })
                      .then((r) => { setSelected(r); load(); })
                      .catch((err) => showAlert(err.message || 'Не удалось обновить статус оплаты', { variant: 'error' }));
                  }}
                >
                  {Object.entries(HOTEL_RESERVATION_PAID_LABELS_RU).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>

              {selected.depositAmount && Number(selected.depositAmount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--fg-3)' }}>Депозит</span>
                  <span style={{ fontWeight: 600 }}>${selected.depositAmount}</span>
                </div>
              )}

              <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>Платежи</div>
              <div style={{ marginTop: 8 }}>
                {selected.payments.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Платежей ещё нет</div>
                )}
                {selected.payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line-2)', fontSize: 12.5 }}>
                    <span>{p.date} · {p.method}{p.note ? ` · ${p.note}` : ''}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b>${p.amount}</b>
                      <button
                        type="button"
                        onClick={() => handleRemovePayment(p.id)}
                        title="Удалить платёж"
                        style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', display: 'flex' }}
                      >
                        <Ic d={HTL_ICON.x} size={12} />
                      </button>
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={{ width: 130, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12 }} />
                  <input placeholder="Сумма" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: 70, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12 }} />
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12 }}>
                    <option value="card">Карта</option>
                    <option value="cash">Наличные</option>
                    <option value="bank_transfer">Расчётный счёт</option>
                    <option value="other">Другое</option>
                  </select>
                  <input
                    placeholder="Реквизиты: последние 4 цифры карты, банк…"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    style={{ flex: 1, minWidth: 140, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12 }}
                  />
                  <button className="btn btn-sm" disabled={paymentBusy || !paymentAmount} onClick={handleAddPayment}>
                    <Ic d={HTL_ICON.plus} size={12} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => downloadReservationFolio(selected.id).catch((e) => showAlert(e.message || 'Не удалось скачать счёт', { variant: 'error' }))}
                >
                  <Ic d={HTL_ICON.download} size={14} />Скачать счёт
                </button>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  disabled={emailBusy || !selected.guestEmail}
                  title={selected.guestEmail ? undefined : 'У брони нет email гостя'}
                  onClick={handleSendFolioEmail}
                >
                  <Ic d={HTL_ICON.check} size={14} />Отправить на почту
                </button>
              </div>

              {(selected.checkedInAt || selected.checkedOutAt) && (
                <div className="htl-info-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
                  {selected.checkedInAt && (
                    <div className="htl-info-item"><div className="l">Заселён</div><div className="v" style={{ fontSize: 12.5 }}>{new Date(selected.checkedInAt).toLocaleString('ru-RU')}</div></div>
                  )}
                  {selected.checkedOutAt && (
                    <div className="htl-info-item"><div className="l">Выселен</div><div className="v" style={{ fontSize: 12.5 }}>{new Date(selected.checkedOutAt).toLocaleString('ru-RU')}</div></div>
                  )}
                </div>
              )}

              {(selected.status === 'confirmed' || selected.status === 'pending') && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  {checkInUnits.length > 0 && (
                    <select
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8 }}
                      value={checkInUnitId}
                      onChange={(e) => setCheckInUnitId(e.target.value)}
                    >
                      <option value="">Без номера</option>
                      {checkInUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                    </select>
                  )}
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={checkInOutBusy} onClick={handleCheckIn}>
                    <Ic d={HTL_ICON.check} size={14} />Заселить
                  </button>
                </div>
              )}
              {selected.status === 'checked_in' && (
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={checkInOutBusy} onClick={handleCheckOut}>
                  <Ic d={HTL_ICON.check} size={14} />Выселить
                </button>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <select
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8 }}
                  value={selected.status}
                  onChange={(e) => {
                    const status = e.target.value as HotelReservation['status'];
                    updateReservation(selected.id, { status })
                      .then((r) => {
                        setSelected(r);
                        load();
                      })
                      .catch((err) => showAlert(err.message || 'Не удалось обновить статус', { variant: 'error' }));
                  }}
                >
                  {Object.entries(HOTEL_RESERVATION_STATUS_LABELS_RU).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn"
                style={{ width: '100%', marginTop: 8, color: '#cc2f47' }}
                onClick={() => {
                  updateReservation(selected.id, { status: 'cancelled' })
                    .then((r) => {
                      setSelected(r);
                      load();
                    })
                    .catch((err) => showAlert(err.message || 'Не удалось отменить бронь', { variant: 'error' }));
                }}
              >
                Отменить бронь
              </button>
            </div>
          </div>
        </div>
      )}

      {modalState && (
        <ReservationModal
          hotels={hotels}
          roomTypes={roomTypes}
          agencies={agencies}
          initial={modalState === 'new' ? null : modalState}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setModalState(null)}
          onSaved={(r) => {
            setModalState(null);
            setSelected((prev) => (prev && prev.id === r.id ? r : prev));
            load();
          }}
        />
      )}

      {showImport && (
        <ImportModal
          hotels={hotels}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
    </MainLayout>
  );
};

const ReservationModal: React.FC<{
  hotels: Hotel[];
  roomTypes: HotelRoomType[];
  agencies: HotelAgency[];
  initial: HotelReservation | null;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
  onSaved: (r: HotelReservation) => void;
}> = ({ hotels, roomTypes, agencies, initial, saving, setSaving, onClose, onSaved }) => {
  const { showAlert } = useAlertModal();
  const [hotelId, setHotelId] = useState(initial?.hotelId || hotels[0]?.id || '');
  const [roomTypeId, setRoomTypeId] = useState(initial?.roomTypeId || '');
  const [agencyId, setAgencyId] = useState(initial?.agencyId || '');
  const [roomUnitId, setRoomUnitId] = useState(initial?.roomUnitId || '');
  const [occupancyTypeId, setOccupancyTypeId] = useState(initial?.occupancyTypeId || '');
  const [guestName, setGuestName] = useState(initial?.guestName || '');
  const [guestEmail, setGuestEmail] = useState(initial?.guestEmail || '');
  const [guestPhone, setGuestPhone] = useState(initial?.guestPhone || '');
  const [pax, setPax] = useState(initial ? String(initial.pax) : '2');
  const [market, setMarket] = useState(initial?.market || '');
  const [checkIn, setCheckIn] = useState(initial?.checkIn || '');
  const [checkOut, setCheckOut] = useState(initial?.checkOut || '');
  const [costPerNight, setCostPerNight] = useState(initial?.costPerNight || '0');
  const [ppPerNight, setPpPerNight] = useState(initial?.ppPerNight || '0');
  const [grossPerNight, setGrossPerNight] = useState(initial?.grossPerNight || '0');
  const [discountPct, setDiscountPct] = useState(initial?.discountPct || '0');
  const [depositAmount, setDepositAmount] = useState(initial?.depositAmount || '0');
  const [earlyCheckIn, setEarlyCheckIn] = useState(initial?.earlyCheckIn || false);
  const [lateCheckOut, setLateCheckOut] = useState(initial?.lateCheckOut || false);
  const [notes, setNotes] = useState(initial?.notes || '');
  const [guests, setGuests] = useState<HotelReservationGuest[]>(initial?.guests || []);

  const addGuestRow = () => setGuests((prev) => [...prev, { id: crypto.randomUUID(), fullName: '', citizenship: '', passportNumber: '', passportExpiry: '', age: '', note: null }]);
  const updateGuestRow = (id: string, patch: Partial<HotelReservationGuest>) =>
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const removeGuestRow = (id: string) => setGuests((prev) => prev.filter((g) => g.id !== id));

  const [occupancyTypes, setOccupancyTypes] = useState<HotelRoomOccupancyType[]>([]);
  const [roomUnits, setRoomUnits] = useState<HotelRoomUnit[]>([]);
  const [markets, setMarkets] = useState<HotelMarket[]>([]);
  const [marketPrices, setMarketPrices] = useState<HotelRoomMarketPrice[]>([]);
  const [roomTypeReservations, setRoomTypeReservations] = useState<HotelReservation[]>([]);
  const [priceWarning, setPriceWarning] = useState('');
  const pricesTouchedManually = React.useRef(false);

  const roomsForHotel = roomTypes.filter((r) => r.hotelId === hotelId);

  useEffect(() => {
    if (!hotelId) { setMarkets([]); return; }
    fetchMarkets(hotelId).then(setMarkets).catch(() => setMarkets([]));
  }, [hotelId]);

  useEffect(() => {
    if (!roomTypeId) { setOccupancyTypes([]); setRoomUnits([]); setMarketPrices([]); setRoomTypeReservations([]); return; }
    fetchOccupancyTypes(roomTypeId).then(setOccupancyTypes).catch(() => setOccupancyTypes([]));
    fetchRoomUnits({ roomTypeId }).then((units) => setRoomUnits(units.filter((u) => u.active))).catch(() => setRoomUnits([]));
    fetchMarketPrices(roomTypeId).then(setMarketPrices).catch(() => setMarketPrices([]));
    fetchReservations({ roomTypeId }).then(setRoomTypeReservations).catch(() => setRoomTypeReservations([]));
  }, [roomTypeId]);

  // Units already booked for an overlapping range on the picked dates — excludes this same
  // reservation's own existing booking when editing, mirrors HotelAvailabilityService's
  // excludeReservationId convention server-side.
  const occupiedUnitIds = useMemo(() => {
    const set = new Set<string>();
    if (!checkIn || !checkOut) return set;
    for (const r of roomTypeReservations) {
      if (!r.roomUnitId || r.status === 'cancelled') continue;
      if (initial && r.id === initial.id) continue;
      if (r.checkIn < checkOut && r.checkOut > checkIn) set.add(r.roomUnitId);
    }
    return set;
  }, [roomTypeReservations, checkIn, checkOut, initial]);

  useEffect(() => {
    setPriceWarning('');
    if (pricesTouchedManually.current) return;
    if (!roomTypeId || !occupancyTypeId || !checkIn || !checkOut) return;
    fetchReservationPrice(roomTypeId, occupancyTypeId, checkIn, checkOut)
      .then((r) => {
        if (r.pricePerNight === null) {
          setPriceWarning('Нет настроенного периода цен на эти даты («Цены и рынки») — введите цену вручную');
          return;
        }
        setPpPerNight(String(r.pricePerNight));
        // Brutto/ночь falls back to this occupancy-based price too — the market-price effect
        // below overrides it once a market with a configured flat price is picked.
        setGrossPerNight(String(r.pricePerNight));
        if (r.spansMultiplePeriods) {
          setPriceWarning('Бронь пересекает периоды цен — проверьте цену вручную');
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypeId, occupancyTypeId, checkIn, checkOut]);

  // Market's flat per-market price (independent pricing mechanism, deliberately not reconciled
  // with the occupancy-based one above) drives Brutto/ночь — the retail sell price for that
  // market — while occupancy+dates above drives PP/ночь.
  // fetchMarketPrices returns every historical price row, including orphaned ones left behind
  // by deleted markets that happen to share a code with a currently-valid one — filter to only
  // marketIds that still exist in `markets` before matching by code, or a stale $0 row can win.
  useEffect(() => {
    if (pricesTouchedManually.current) return;
    if (!market || !marketPrices.length || !markets.length) return;
    const validMarketIds = new Set(markets.map((m) => m.id));
    const match = marketPrices.find((mp) => mp.code === market && validMarketIds.has(mp.marketId));
    if (match) setGrossPerNight(match.price);
  }, [market, marketPrices, markets]);

  const handleSave = () => {
    if (!guestName.trim() || !hotelId || !roomTypeId || !checkIn || !checkOut) {
      showAlert('Заполните гостя, отель, номер и даты', { variant: 'error' });
      return;
    }
    setSaving(true);
    const dto = {
      hotelId,
      roomTypeId,
      agencyId: agencyId || null,
      roomUnitId: roomUnitId || null,
      occupancyTypeId: occupancyTypeId || null,
      guestName,
      guestEmail: guestEmail || null,
      guestPhone: guestPhone || null,
      pax: Number(pax) || 1,
      market: market || null,
      checkIn,
      checkOut,
      costPerNight,
      ppPerNight,
      grossPerNight,
      discountPct,
      depositAmount,
      earlyCheckIn,
      lateCheckOut,
      notes: notes || null,
      guests,
    };
    const req = initial ? updateReservation(initial.id, dto) : createReservation(dto);
    req
      .then((r) => onSaved(r))
      .catch((e) => showAlert(e.message || 'Не удалось сохранить бронь', { variant: 'error' }))
      .finally(() => setSaving(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>{initial ? 'Изменить бронь' : 'Новая бронь'}</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          <label>Гость</label>
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <div className="bk-row2">
            <div><label>Email гостя</label><input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} /></div>
            <div><label>Телефон гостя</label><input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} /></div>
          </div>
          <div className="bk-row2">
            <div>
              <label>Отель</label>
              <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); setRoomTypeId(''); setOccupancyTypeId(''); setRoomUnitId(''); }}>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label>Тип номера</label>
              <select value={roomTypeId} onChange={(e) => { setRoomTypeId(e.target.value); setOccupancyTypeId(''); setRoomUnitId(''); }}>
                <option value="">—</option>
                {roomsForHotel.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="bk-row2">
            <div>
              <label>Тип размещения</label>
              <select value={occupancyTypeId} onChange={(e) => setOccupancyTypeId(e.target.value)} disabled={!roomTypeId}>
                <option value="">—</option>
                {occupancyTypes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label>Номер</label>
              <select value={roomUnitId} onChange={(e) => setRoomUnitId(e.target.value)} disabled={!roomTypeId}>
                <option value="">Без номера</option>
                {roomUnits.map((u) => {
                  const occupied = occupiedUnitIds.has(u.id);
                  return (
                    <option key={u.id} value={u.id} disabled={occupied} style={{ color: occupied ? '#d64545' : '#2f9e5c' }}>
                      {u.label}{occupied ? ' — занят на эти даты' : ' — свободен'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="bk-row2">
            <div><label>Заезд</label><input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
            <div><label>Выезд</label><input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></div>
          </div>
          <div className="bk-row2">
            <div><label>Гостей (PAX)</label><input value={pax} onChange={(e) => setPax(e.target.value)} /></div>
            <div>
              <label>Агентство</label>
              <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
                <option value="">—</option>
                {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <label>Рынок продаж</label>
          <select value={market} onChange={(e) => setMarket(e.target.value)} disabled={!markets.length}>
            <option value="">—</option>
            {markets.map((m) => <option key={m.id} value={m.code}>{m.name} ({m.code})</option>)}
          </select>
          {!markets.length && hotelId && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>У отеля ещё не настроены рынки («Цены и рынки»)</div>
          )}
          {priceWarning && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: '#cc7a00' }}>{priceWarning}</div>
          )}
          <div className="bk-row2" style={{ marginTop: 8 }}>
            <div><label>Себестоимость/ночь</label><input value={costPerNight} onChange={(e) => setCostPerNight(e.target.value)} /></div>
            <div><label>PP/ночь</label><input value={ppPerNight} onChange={(e) => { pricesTouchedManually.current = true; setPpPerNight(e.target.value); }} /></div>
          </div>
          <div className="bk-row2">
            <div><label>Brutto/ночь</label><input value={grossPerNight} onChange={(e) => { pricesTouchedManually.current = true; setGrossPerNight(e.target.value); }} /></div>
            <div><label>Скидка, %</label><input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></div>
          </div>
          <label>Депозит</label>
          <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={earlyCheckIn} onChange={(e) => setEarlyCheckIn(e.target.checked)} />
              Раннее заселение
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={lateCheckOut} onChange={(e) => setLateCheckOut(e.target.checked)} />
              Позднее выселение
            </label>
          </div>
          <label style={{ marginTop: 8 }}>Примечания</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <label style={{ margin: 0 }}>Гости</label>
            <button type="button" className="btn btn-sm" onClick={addGuestRow}><Ic d={HTL_ICON.plus} size={12} />Добавить гостя</button>
          </div>
          {guests.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>Гости ещё не добавлены</div>
          )}
          {guests.map((g, gi) => (
            <div key={g.id} style={{ border: '1px solid var(--line-2)', borderRadius: 10, padding: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Гость {gi + 1}</span>
                <button
                  type="button"
                  onClick={() => removeGuestRow(g.id)}
                  title="Удалить гостя"
                  style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', display: 'flex' }}
                >
                  <Ic d={HTL_ICON.x} size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  placeholder="ФИО"
                  value={g.fullName}
                  onChange={(e) => updateGuestRow(g.id, { fullName: e.target.value })}
                  style={{ flex: 2, minWidth: 0, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
                <input
                  placeholder="Гражданство"
                  value={g.citizenship}
                  onChange={(e) => updateGuestRow(g.id, { citizenship: e.target.value })}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
                <input
                  placeholder="Возраст"
                  value={g.age}
                  onChange={(e) => updateGuestRow(g.id, { age: e.target.value })}
                  style={{ width: 70, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  placeholder="Паспорт №"
                  value={g.passportNumber}
                  onChange={(e) => updateGuestRow(g.id, { passportNumber: e.target.value })}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>Паспорт действителен до</label>
                  <input
                    type="date"
                    value={g.passportExpiry}
                    onChange={(e) => updateGuestRow(g.id, { passportExpiry: e.target.value })}
                    style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                  />
                </div>
                <input
                  placeholder="Примечание"
                  value={g.note || ''}
                  onChange={(e) => updateGuestRow(g.id, { note: e.target.value || null })}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            <Ic d={HTL_ICON.check} size={14} />{initial ? 'Сохранить' : 'Создать бронь'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ImportModal: React.FC<{ hotels: Hotel[]; onClose: () => void; onDone: () => void }> = ({ hotels, onClose, onDone }) => {
  const { showAlert } = useAlertModal();
  const [preview, setPreview] = useState<HotelReservationImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [defaultHotelId, setDefaultHotelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: Array<{ row: number; message: string }>; total: number } | null>(null);

  const handleFile = (file: File) => {
    setBusy(true);
    previewReservationsImport(file)
      .then((p) => {
        setPreview(p);
        setMapping(p.suggestedMapping);
      })
      .catch((e) => showAlert(e.message || 'Не удалось прочитать файл', { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const handleApply = () => {
    if (!preview) return;
    setBusy(true);
    applyReservationsImport({ importId: preview.importId, mapping, defaultHotelId: defaultHotelId || undefined })
      .then(setResult)
      .catch((e) => showAlert(e.message || 'Не удалось применить импорт', { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, calc(100vw - 32px))' }}>
        <div className="bk-modal-head">
          <h3>Импорт броней из Excel</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!preview && !result && (
            <div style={{ border: '1.5px dashed var(--line-2)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>
              <Ic d={HTL_ICON.download} size={22} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>Загрузите .xlsx или .csv</div>
              <div style={{ fontSize: 11.5 }}>Поддерживаются колонки: гость, отель, тип номера, агентство, даты, себестоимость, PP, brutto, скидка</div>
              <label className="btn btn-sm" style={{ marginTop: 14, display: 'inline-flex', cursor: 'pointer' }}>
                Выбрать файл
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
            </div>
          )}

          {preview && !result && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginBottom: 10 }}>
                Найдено {preview.totalRows} строк. Проверьте сопоставление колонок:
              </div>
              {preview.mappableFields.map((f) => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 140, fontSize: 12 }}>{f.label}</span>
                  <select
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 6 }}
                    value={mapping[f.key] || ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}
                  >
                    <option value="">—</option>
                    {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
              {hotels.length > 1 && (
                <>
                  <label>Отель по умолчанию (если не указан в файле)</label>
                  <select value={defaultHotelId} onChange={(e) => setDefaultHotelId(e.target.value)}>
                    <option value="">—</option>
                    {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </>
              )}
            </div>
          )}

          {result && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Создано <b>{result.created}</b> из {result.total} строк.</div>
              {result.errors.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, color: '#cc2f47' }}>
                  {result.errors.map((e, i) => <div key={i}>Строка {e.row}: {e.message}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{result ? 'Закрыть' : 'Отмена'}</button>
          {preview && !result && (
            <button className="btn btn-primary" disabled={busy} onClick={handleApply}>
              <Ic d={HTL_ICON.check} size={14} />Загрузить
            </button>
          )}
          {result && (
            <button className="btn btn-primary" onClick={onDone}>Готово</button>
          )}
        </div>
      </div>
    </div>
  );
};
