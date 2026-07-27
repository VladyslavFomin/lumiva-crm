import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  fetchReservations,
  createReservation,
  updateReservation,
  fetchHotels,
  fetchRoomTypes,
  fetchAgencies,
  previewReservationsImport,
  applyReservationsImport,
  HOTEL_RESERVATION_STATUS_LABELS_RU,
  HOTEL_RESERVATION_PAID_LABELS_RU,
  type HotelReservation,
  type Hotel,
  type HotelRoomType,
  type HotelAgency,
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
  const [agencies, setAgencies] = useState<HotelAgency[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [selected, setSelected] = useState<HotelReservation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);

  const hotelById = useMemo(() => new Map(hotels.map((h) => [h.id, h])), [hotels]);
  const roomTypeById = useMemo(() => new Map(roomTypes.map((r) => [r.id, r])), [roomTypes]);
  const agencyById = useMemo(() => new Map(agencies.map((a) => [a.id, a])), [agencies]);

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
      .then((lists) => setRoomTypes(lists.flat()))
      .catch((e) => showAlert(e.message || 'Не удалось загрузить отели', { variant: 'error' }));
    fetchAgencies()
      .then(setAgencies)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить агентства', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <button className="btn btn-primary" onClick={() => setShowNew(true)}><Ic d={HTL_ICON.plus} size={14} />Новая бронь</button>
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
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{roomTypeById.get(r.roomTypeId)?.name || '—'}</div>
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
          <div className="bk-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bk-drawer-head">
              <div>
                <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{selected.id.slice(0, 8)}</div>
                <h3>{selected.guestName}</h3>
              </div>
              <button onClick={() => setSelected(null)}><Ic d={HTL_ICON.x} size={16} /></button>
            </div>
            <div className="bk-drawer-body">
              <div className="htl-info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="htl-info-item"><div className="l">Отель / номер</div><div className="v" style={{ fontSize: 12.5 }}>{hotelById.get(selected.hotelId)?.name}<br /><span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>{roomTypeById.get(selected.roomTypeId)?.name}</span></div></div>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 13 }}>
                <span style={{ color: 'var(--fg-3)' }}>Статус оплаты</span>
                <span style={{ fontWeight: 600 }}>{HOTEL_RESERVATION_PAID_LABELS_RU[selected.paidStatus]}</span>
              </div>

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

      {showNew && (
        <NewReservationModal
          hotels={hotels}
          roomTypes={roomTypes}
          agencies={agencies}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
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

const NewReservationModal: React.FC<{
  hotels: Hotel[];
  roomTypes: HotelRoomType[];
  agencies: HotelAgency[];
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
  onCreated: () => void;
}> = ({ hotels, roomTypes, agencies, saving, setSaving, onClose, onCreated }) => {
  const { showAlert } = useAlertModal();
  const [hotelId, setHotelId] = useState(hotels[0]?.id || '');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [pax, setPax] = useState('2');
  const [market, setMarket] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [costPerNight, setCostPerNight] = useState('0');
  const [ppPerNight, setPpPerNight] = useState('0');
  const [grossPerNight, setGrossPerNight] = useState('0');
  const [discountPct, setDiscountPct] = useState('0');

  const roomsForHotel = roomTypes.filter((r) => r.hotelId === hotelId);

  const handleCreate = () => {
    if (!guestName.trim() || !hotelId || !roomTypeId || !checkIn || !checkOut) {
      showAlert('Заполните гостя, отель, номер и даты', { variant: 'error' });
      return;
    }
    setSaving(true);
    createReservation({
      hotelId,
      roomTypeId,
      agencyId: agencyId || null,
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
    })
      .then(() => onCreated())
      .catch((e) => showAlert(e.message || 'Не удалось создать бронь', { variant: 'error' }))
      .finally(() => setSaving(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>Новая бронь</h3>
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
              <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); setRoomTypeId(''); }}>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label>Тип номера</label>
              <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
                <option value="">—</option>
                {roomsForHotel.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
          <input placeholder="СНГ, Германия, Внутренний…" value={market} onChange={(e) => setMarket(e.target.value)} />
          <div className="bk-row2">
            <div><label>Себестоимость/ночь</label><input value={costPerNight} onChange={(e) => setCostPerNight(e.target.value)} /></div>
            <div><label>PP/ночь</label><input value={ppPerNight} onChange={(e) => setPpPerNight(e.target.value)} /></div>
          </div>
          <div className="bk-row2">
            <div><label>Brutto/ночь</label><input value={grossPerNight} onChange={(e) => setGrossPerNight(e.target.value)} /></div>
            <div><label>Скидка, %</label><input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></div>
          </div>
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleCreate}><Ic d={HTL_ICON.check} size={14} />Создать бронь</button>
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
