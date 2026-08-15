import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingLocations,
  createBookingLocation,
  updateBookingLocation,
  deleteBookingLocation,
  fetchLocationStats,
  type BookingLocation,
  type LocationStatsRow,
} from '../../api/bookings';
import './bookings-design.css';

type ModalState = { mode: 'create' } | { mode: 'edit'; location: BookingLocation } | null;

const LocationModal: React.FC<{
  state: ModalState;
  onClose: () => void;
  onSaved: () => void;
}> = ({ state, onClose, onSaved }) => {
  const { showAlert } = useAlertModal();
  const editing = state?.mode === 'edit' ? state.location : null;
  const [name, setName] = useState(editing?.name || '');
  const [address, setAddress] = useState(editing?.address || '');
  const [phone, setPhone] = useState(editing?.phone || '');
  const [email, setEmail] = useState(editing?.email || '');
  const [timezone, setTimezone] = useState(editing?.timezone || 'Europe/Moscow');
  const [saving, setSaving] = useState(false);

  if (!state) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateBookingLocation(editing.id, { name: name.trim(), address, phone, email, timezone });
      } else {
        await createBookingLocation({ name: name.trim(), address, phone, email, timezone });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showAlert(err.message || 'Не удалось сохранить локацию', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? 'Редактировать локацию' : 'Новая локация'}</h3>
        <div className="bk-field">
          <label>Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Студия на Тверской" />
        </div>
        <div className="bk-field">
          <label>Адрес</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул. Тверская, 12" />
        </div>
        <div className="bk-field">
          <label>Телефон</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="bk-field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="bk-field">
          <label>Часовой пояс</label>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Moscow" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
            <Ic d={BK_ICON.check} size={13} /> Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export const BookingLocationsPage: React.FC = () => {
  const { showAlert, showConfirm } = useAlertModal();
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [stats, setStats] = useState<LocationStatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchBookingLocations(), fetchLocationStats()])
      .then(([locs, s]) => {
        setLocations(locs);
        setStats(s);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить локации', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  const statsFor = (id: string) => stats.find((s) => s.id === id);
  const totals = {
    todayReservations: stats.reduce((sum, s) => sum + s.todayReservations, 0),
    todayRevenue: stats.reduce((sum, s) => sum + s.todayRevenue, 0),
    avgOccupancy: stats.length ? Math.round((stats.reduce((sum, s) => sum + s.occupancy, 0) / stats.length) * 10) / 10 : 0,
    busiest: stats.length ? [...stats].sort((a, b) => b.occupancy - a.occupancy)[0] : null,
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (location: BookingLocation) => {
    const ok = await showConfirm(`Удалить локацию «${location.name}»? Действие необратимо.`, {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBookingLocation(location.id);
      load();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось удалить локацию', { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="locations" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{locations.length} ЛОКАЦИЙ</div>
            <h1>Локации</h1>
            <p className="sub">Филиалы/студии — у каждой своё расписание, мастера и кабинеты.</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'create' })}>
              <Ic d={BK_ICON.plus} size={13} /> Новая локация
            </button>
          </div>
        </div>

        {!loading && locations.length > 0 && (
          <div className="bk-kpi-grid" style={{ margin: '16px 0' }}>
            <div className="bk-kpi"><div className="l">ВСЕГО БРОНЕЙ СЕГОДНЯ</div><div className="v">{totals.todayReservations}</div></div>
            <div className="bk-kpi"><div className="l">СРЕДНЯЯ ЗАГРУЗКА</div><div className="v">{totals.avgOccupancy}%</div></div>
            <div className="bk-kpi"><div className="l">ВЫРУЧКА СЕГОДНЯ</div><div className="v">{totals.todayRevenue} ₽</div></div>
            <div className="bk-kpi"><div className="l">САМАЯ ЗАГРУЖЕННАЯ</div><div className="v" style={{ fontSize: 16 }}>{totals.busiest?.name || '—'}</div><div className="d">{totals.busiest ? `${totals.busiest.occupancy}% загрузки` : ''}</div></div>
          </div>
        )}

        <div className="bk-table-wrap" style={{ marginTop: 16 }}>
          <table className="bk-table">
            <thead>
              <tr>
                <th>Локация</th>
                <th>Адрес</th>
                <th>Мастера</th>
                <th>Кабинеты</th>
                <th>Брони сегодня</th>
                <th>Загрузка</th>
                <th>Выручка</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && locations.length === 0 && (
                <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Пока нет локаций</td></tr>
              )}
              {locations.map((l) => {
                const s = statsFor(l.id);
                return (
                  <tr key={l.id} className="clickable" onClick={() => setModal({ mode: 'edit', location: l })}>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{l.name}</td>
                    <td style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{l.address || '—'}</td>
                    <td>{s?.staffCount ?? '—'}</td>
                    <td>{s?.resourceCount ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--ff-mono)' }}>{s?.todayReservations ?? '—'}</td>
                    <td>
                      {s ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 70, height: 5, background: 'var(--bg-soft)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${s.occupancy}%`, height: '100%', background: 'var(--ink)', borderRadius: 3 }} /></div>
                          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{s.occupancy}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--ff-mono)' }}>{s ? `${s.todayRevenue} ₽` : '—'}</td>
                    <td><span className="bk-badge confirmed">{l.status === 'active' ? 'Активна' : l.status}</span></td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right', color: 'var(--fg-3)' }}>
                      <button
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        onClick={() => handleDelete(l)}
                      >
                        <Ic d={BK_ICON.trash} size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <LocationModal state={modal} onClose={() => setModal(null)} onSaved={load} />
    </MainLayout>
  );
};
