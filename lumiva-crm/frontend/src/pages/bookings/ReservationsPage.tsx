import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { getStoredUser } from '../../auth/session';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchReservations,
  createReservation,
  confirmReservation,
  cancelReservation,
  fetchBookingLocations,
  fetchBookingServices,
  fetchBookingResources,
  fetchBookingStaff,
  fetchCustomerStats,
  RESERVATION_STATUS_LABELS_RU,
  type Reservation,
  type BookingLocation,
  type BookingServiceItem,
  type BookingResourceItem,
  type BookingStaffProfile,
  type CustomerStats,
} from '../../api/bookings';
import './bookings-design.css';

const SAVED_VIEWS = ['Все', 'Сегодня', 'Завтра', 'Эта неделя', 'Ожидают подтв.', 'Отменённые', 'Мои брони'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toCsv(rows: Reservation[]): string {
  const header = ['ID', 'Дата', 'Время', 'Клиент', 'Телефон', 'Статус', 'Источник'];
  const lines = rows.map((r) => [
    r.id,
    new Date(r.startAt).toLocaleDateString('ru-RU'),
    new Date(r.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    r.customerName || '',
    r.customerPhone || '',
    RESERVATION_STATUS_LABELS_RU[r.status],
    r.source,
  ]);
  return [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

const ClientDrawer: React.FC<{ reservation: Reservation | null; onClose: () => void }> = ({ reservation, onClose }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<CustomerStats | null>(null);

  useEffect(() => {
    if (!reservation?.contactId) {
      setStats(null);
      return;
    }
    fetchCustomerStats(reservation.contactId).then(setStats).catch(() => setStats(null));
  }, [reservation?.contactId]);

  if (!reservation) return null;
  const initials = (reservation.customerName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('');

  return (
    <div className="px-scope">
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.3)', zIndex: 58 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 340, background: '#fff', borderLeft: '1px solid var(--line-2)', boxShadow: '-12px 0 32px rgba(0,0,0,0.08)', zIndex: 59, padding: 22, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--fg-3)', textTransform: 'uppercase' }}>Профиль клиента</div>
          <button onClick={onClose} style={{ background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer' }}><Ic d={BK_ICON.x} size={15} /></button>
        </div>
        <div className="bk-cust-card" style={{ border: 0, margin: 0, padding: 0 }}>
          <div className="bk-cust-ava">{initials}</div>
          <div>
            <div className="n">{reservation.customerName || 'Без имени'}</div>
            <div className="c">{reservation.customerPhone}</div>
            {stats?.tags && stats.tags.length > 0 && (
              <div className="bk-cust-tags">{stats.tags.map((t) => <span key={t} className="bk-cust-tag">{t}</span>)}</div>
            )}
          </div>
        </div>
        <div className="bk-cust-stat">
          <div><div className="v">{stats?.visits ?? '—'}</div><div className="l">визитов</div></div>
          <div><div className="v">{stats ? `${stats.ltv} ₽` : '—'}</div><div className="l">LTV</div></div>
          <div><div className="v" style={{ fontSize: 11 }}>{stats?.lastVisit ? new Date(stats.lastVisit).toLocaleDateString('ru-RU') : '—'}</div><div className="l">последний визит</div></div>
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line-3)' }}>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 8 }}>Текущая бронь</div>
          <div className="bk-info-row"><span className="l">Дата</span><span className="v">{new Date(reservation.startAt).toLocaleString('ru-RU')}</span></div>
          <div className="bk-info-row"><span className="l">Статус</span><span className="v">{RESERVATION_STATUS_LABELS_RU[reservation.status]}</span></div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 18 }} onClick={() => navigate(`/bookings/reservations/${reservation.id}`)}>
          Открыть бронь
        </button>
      </div>
    </div>
  );
};

const NewReservationModal: React.FC<{
  open: boolean;
  locations: BookingLocation[];
  services: BookingServiceItem[];
  staff: BookingStaffProfile[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, locations, services, staff, onClose, onCreated }) => {
  const { showAlert } = useAlertModal();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [staffUserId, setStaffUserId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLocationId(locations[0]?.id || '');
      setServiceId(services[0]?.id || '');
    }
  }, [open, locations, services]);

  if (!open) return null;

  const handleCreate = async () => {
    if (!locationId || !date || !time) {
      showAlert('Укажите локацию, дату и время', { variant: 'error' });
      return;
    }
    const service = services.find((s) => s.id === serviceId);
    const durationMinutes = service?.durationMinutes ?? 60;
    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    setSaving(true);
    try {
      await createReservation({
        locationId,
        serviceId: serviceId || undefined,
        staffUserId: staffUserId || undefined,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        source: 'manual',
      });
      onCreated();
      onClose();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось создать бронь', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Новая бронь</h3>
        <div className="bk-field">
          <label>Клиент</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Имя" />
        </div>
        <div className="bk-field">
          <label>Телефон</label>
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+7 900 000-00-00" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>Локация</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>Услуга</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Без услуги</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="bk-field">
          <label>Мастер</label>
          <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
            <option value="">Любой</option>
            {staff.filter((s) => s.availableForBooking).map((s) => (
              <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName || s.staffUserId}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="bk-field">
            <label>Время</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleCreate}>
            <Ic d={BK_ICON.check} size={13} /> Создать бронь
          </button>
        </div>
      </div>
    </div>
  );
};

export const ReservationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('Все');
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [drawerRes, setDrawerRes] = useState<Reservation | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const currentUserEmail = getStoredUser()?.email as string | undefined;
  const myStaffUserId = staff.find((s) => s.staffUser?.email?.toLowerCase() === currentUserEmail?.toLowerCase())?.staffUserId;

  const load = () => {
    setLoading(true);
    Promise.all([fetchReservations(), fetchBookingLocations(), fetchBookingServices(), fetchBookingResources(), fetchBookingStaff()])
      .then(([r, l, s, res, st]) => {
        setReservations(r);
        setLocations(l);
        setServices(s);
        setResources(res);
        setStaff(st);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить брони', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name || '—';
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name || '—';
  const staffName = (id: string | null) => staff.find((s) => s.staffUserId === id)?.staffUser?.fullName || '—';
  const resourceName = (id: string | null) => resources.find((r) => r.id === id)?.name || '—';

  const filtered = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    return reservations.filter((r) => {
      const start = new Date(r.startAt);
      if (view === 'Сегодня' && !isSameDay(start, now)) return false;
      if (view === 'Завтра' && !isSameDay(start, tomorrow)) return false;
      if (view === 'Эта неделя' && (start < now || start > weekEnd)) return false;
      if (view === 'Ожидают подтв.' && r.status !== 'pending') return false;
      if (view === 'Отменённые' && !r.status.startsWith('cancelled') && r.status !== 'rejected') return false;
      if (view === 'Мои брони' && r.assignedUserId !== myStaffUserId) return false;
      if (locationFilter && r.locationId !== locationFilter) return false;
      if (serviceFilter && r.serviceId !== serviceFilter) return false;
      if (staffFilter && r.staffUserId !== staffFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (sourceFilter && r.source !== sourceFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.customerName || ''} ${r.customerPhone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, view, search, locationFilter, serviceFilter, staffFilter, statusFilter, sourceFilter, myStaffUserId]);

  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulkConfirm = async () => {
    setBulkLoading(true);
    try {
      await Promise.all(selected.map((id) => confirmReservation(id)));
      setSelected([]);
      load();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось подтвердить брони', { variant: 'error' });
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkCancel = async () => {
    setBulkLoading(true);
    try {
      await Promise.all(selected.map((id) => cancelReservation(id)));
      setSelected([]);
      load();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось отменить брони', { variant: 'error' });
    } finally {
      setBulkLoading(false);
    }
  };

  const exportCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="reservations" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{reservations.length} БРОНИ</div>
            <h1>Брони</h1>
            <p className="sub">Все резервации — из виджета сайта, звонков и вручную созданные записи.</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => navigate('/bookings/reservations/import')}>
              Импорт
            </button>
            <button className="btn btn-sm" onClick={exportCsv} disabled={!filtered.length}>
              <Ic d={BK_ICON.more} size={13} /> Экспорт
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)} disabled={!locations.length}>
              <Ic d={BK_ICON.plus} size={13} /> Новая бронь
            </button>
          </div>
        </div>

        <div className="bk-savedviews" style={{ marginTop: 16 }}>
          {SAVED_VIEWS.map((v) => (
            <div key={v} className={`bk-sv-tab${v === view ? ' active' : ''}`} onClick={() => setView(v)}>{v}</div>
          ))}
        </div>

        <div className="bk-filters">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-2)', borderRadius: 8, padding: '7px 12px', width: 200 }}>
            <Ic d={BK_ICON.search} size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Клиент или телефон…"
              style={{ border: 0, outline: 'none', fontSize: 12.5, width: '100%' }}
            />
          </div>
          <select className="bk-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">Локация: все</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="bk-select" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
            <option value="">Услуга: все</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="bk-select" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="">Мастер: все</option>
            {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
          </select>
          <select className="bk-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Статус: все</option>
            {Object.entries(RESERVATION_STATUS_LABELS_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="bk-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">Источник: все</option>
            <option value="website">Сайт</option>
            <option value="phone">Телефон</option>
            <option value="walkin">Walk-in</option>
            <option value="manual">Вручную</option>
            <option value="api">API</option>
            <option value="telegram">Telegram</option>
          </select>
        </div>

        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}></th>
                <th>Дата / время</th><th>Клиент</th><th>Услуга</th><th>Мастер</th><th>Каб.</th><th>Статус</th><th>Оплата</th><th>Источник</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Нет броней по выбранному фильтру</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => navigate(`/bookings/reservations/${r.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span
                      onClick={() => toggleSelect(r.id)}
                      style={{ display: 'inline-flex', width: 16, height: 16, border: '1.5px solid var(--line-2)', borderRadius: 4, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: selected.includes(r.id) ? 'var(--ink)' : '#fff', borderColor: selected.includes(r.id) ? 'var(--ink)' : 'var(--line-2)' }}
                    >
                      {selected.includes(r.id) && <Ic d={BK_ICON.check} size={10} sw={2.5} />}
                    </span>
                  </td>
                  <td>
                    {new Date(r.startAt).toLocaleDateString('ru-RU')}{' '}
                    <span style={{ color: 'var(--fg-3)' }}>· {new Date(r.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="cust-cell" onClick={(e) => { e.stopPropagation(); setDrawerRes(r); }} style={{ cursor: 'pointer' }}>
                    <span className="n">{r.customerName || 'Без имени'}</span>
                    <span className="s">{r.customerPhone || ''}</span>
                  </td>
                  <td>{serviceName(r.serviceId)}</td>
                  <td>{staffName(r.staffUserId)}</td>
                  <td>{resourceName(r.resourceId)}</td>
                  <td><span className={`bk-badge ${r.status}`}>{RESERVATION_STATUS_LABELS_RU[r.status]}</span></td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{r.paymentStatus === 'not_required' ? '—' : r.paymentStatus}</td>
                  <td><span className="src">{r.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected.length > 0 && (
          <div className="bk-bulkbar">
            <div className="bk-bulkbar-count"><strong>{selected.length}</strong> ВЫБРАНО</div>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-btn" disabled={bulkLoading} onClick={bulkConfirm}>
              <Ic d={BK_ICON.check} size={12} /> Подтвердить
            </button>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-btn danger" disabled={bulkLoading} onClick={bulkCancel}>
              <Ic d={BK_ICON.x} size={12} /> Отменить
            </button>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-close" onClick={() => setSelected([])} aria-label="Снять выбор">×</button>
          </div>
        )}
      </div>
      <NewReservationModal
        open={modalOpen}
        locations={locations}
        services={services}
        staff={staff}
        onClose={() => setModalOpen(false)}
        onCreated={load}
      />
      <ClientDrawer reservation={drawerRes} onClose={() => setDrawerRes(null)} />
    </MainLayout>
  );
};
