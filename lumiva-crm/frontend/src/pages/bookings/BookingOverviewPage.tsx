import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingProject,
  fetchReservations,
  fetchBookingServices,
  fetchBookingStaff,
  fetchBookingLocations,
  RESERVATION_STATUS_LABELS_RU,
  type BookingProject,
  type Reservation,
  type BookingServiceItem,
  type BookingStaffProfile,
  type BookingLocation,
} from '../../api/bookings';
import './bookings-design.css';

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export const BookingOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [project, setProject] = useState<BookingProject | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchBookingProject(), fetchReservations(), fetchBookingServices(), fetchBookingStaff(), fetchBookingLocations()])
      .then(([p, r, s, st, locs]) => {
        setProject(p);
        setReservations(r);
        setServices(s);
        setStaff(st);
        setLocations(locs);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить обзор', { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scopedReservations = useMemo(
    () => (locationFilter ? reservations.filter((r) => r.locationId === locationFilter) : reservations),
    [reservations, locationFilter],
  );

  const todayReservations = useMemo(
    () => scopedReservations.filter((r) => isToday(r.startAt)).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [scopedReservations],
  );
  const pendingCount = useMemo(() => scopedReservations.filter((r) => r.status === 'pending').length, [scopedReservations]);
  const staffAvailable = staff.filter((s) => s.availableForBooking).length;
  const cancelledLast7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60_000;
    const total = scopedReservations.filter((r) => new Date(r.createdAt).getTime() >= cutoff).length;
    const noShow = scopedReservations.filter((r) => new Date(r.createdAt).getTime() >= cutoff && r.status === 'no_show').length;
    return total ? Math.round((noShow / total) * 1000) / 10 : 0;
  }, [scopedReservations]);

  const DAY_MINUTES = 11 * 60;
  const staffLoadToday = useMemo(() => {
    const active = staff.filter((s) => s.availableForBooking);
    const rows = active.map((s) => {
      const minutes = todayReservations
        .filter((r) => r.staffUserId === s.staffUserId && ['confirmed', 'checked_in', 'in_progress', 'pending', 'completed'].includes(r.status))
        .reduce((sum, r) => sum + (new Date(r.endAt).getTime() - new Date(r.startAt).getTime()) / 60_000, 0);
      const count = todayReservations.filter((r) => r.staffUserId === s.staffUserId).length;
      return { name: s.staffUser?.fullName || s.staffUserId, pct: Math.min(100, Math.round((minutes / DAY_MINUTES) * 100)), count };
    });
    return rows.sort((a, b) => b.pct - a.pct);
  }, [staff, todayReservations]);
  const avgStaffLoad = staffLoadToday.length
    ? Math.round(staffLoadToday.reduce((sum, s) => sum + s.pct, 0) / staffLoadToday.length)
    : 0;

  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name || '—';

  const setupSteps = project
    ? [
        { label: 'Проект создан', done: true },
        { label: 'Услуга создана', done: services.length > 0 },
        { label: 'Мастер доступен для брони', done: staffAvailable > 0 },
        { label: 'Есть хотя бы одна бронь', done: reservations.length > 0 },
      ]
    : [];
  const setupDone = setupSteps.filter((s) => s.done).length;

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="overview" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />BOOKING{project ? ` · ${project.businessType.toUpperCase()}` : ''}</div>
            <h1>Обзор бронирований</h1>
            <p className="sub">{project ? `Проект «${project.name}»` : ''} · сегодня, {new Date().toLocaleDateString('ru-RU')}</p>
          </div>
          <div className="bk-hero-r">
            {setupDone < setupSteps.length && setupSteps.length > 0 && (
              <span className="bk-setup-chip progress"><Ic d={BK_ICON.warn} size={12} /> Настройка: {setupDone}/{setupSteps.length} шагов</span>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/bookings/reservations')}>
              <Ic d={BK_ICON.plus} size={13} /> Новая бронь
            </button>
          </div>
        </div>

        {locations.length > 1 && (
          <div className="bk-selectors">
            <select className="bk-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">Все локации</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        <div className="bk-kpi-grid" style={{ margin: '16px 0' }}>
          <div className="bk-kpi"><div className="l"><Ic d={BK_ICON.cal} size={12} />БРОНИ СЕГОДНЯ</div><div className="v">{todayReservations.length}</div></div>
          <div className="bk-kpi"><div className="l"><Ic d={BK_ICON.clock} size={12} />ОЖИДАЮТ ПОДТВ.</div><div className="v">{pendingCount}</div></div>
          <div className="bk-kpi"><div className="l"><Ic d={BK_ICON.users} size={12} />ЗАГРУЗКА МАСТЕРОВ</div><div className="v">{avgStaffLoad}%</div></div>
          <div className="bk-kpi"><div className="l"><Ic d={BK_ICON.x} size={12} />НЕЯВКИ (7 ДН.)</div><div className="v">{cancelledLast7d}%</div></div>
        </div>

        <div className="bk-cols">
          <div>
            <div className="bk-panel" style={{ marginBottom: 16 }}>
              <div className="bk-panel-head">
                <div className="t">Сегодня · хронология</div>
                <button className="link" onClick={() => navigate('/bookings/reservations')}>Открыть все →</button>
              </div>
              <div className="bk-panel-body">
                {!loading && todayReservations.length === 0 && (
                  <div style={{ padding: '14px 18px', color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>Сегодня броней нет</div>
                )}
                {todayReservations.map((r) => (
                  <div key={r.id} className="bk-today-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/reservations/${r.id}`)}>
                    <div className="time">{new Date(r.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="bk-today-main">
                      <div className="cust">{r.customerName || 'Без имени'}</div>
                      <div className="meta">{serviceName(r.serviceId)}</div>
                    </div>
                    <span className={`bk-badge ${r.status}`}>{RESERVATION_STATUS_LABELS_RU[r.status]}</span>
                  </div>
                ))}
              </div>
            </div>

            {pendingCount > 0 && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">Требует внимания</div></div>
                <div className="bk-panel-body">
                  <div className="bk-attn-row">
                    <div className="bk-attn-ic warn"><Ic d={BK_ICON.warn} size={14} /></div>
                    <div className="bk-attn-body">
                      <div className="t">Не подтверждено</div>
                      <div className="d">{pendingCount} {pendingCount === 1 ? 'бронь ожидает' : 'брони ожидают'} подтверждения</div>
                    </div>
                    <button className="bk-attn-action" onClick={() => navigate('/bookings/reservations')}>Открыть</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            {staffLoadToday.length > 0 && (
              <div className="bk-panel" style={{ marginBottom: 16 }}>
                <div className="bk-panel-head"><div className="t">Загрузка мастеров сегодня</div></div>
                <div className="bk-panel-body" style={{ padding: '8px 18px 14px' }}>
                  {staffLoadToday.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ fontWeight: 500 }}>{m.name}</span>
                          <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{m.count} {m.count === 1 ? 'запись' : 'записей'}</span>
                        </div>
                        <div style={{ height: 5, background: 'var(--bg-soft)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${m.pct}%`, height: '100%', background: 'var(--ink)', borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {setupSteps.length > 0 && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">Чек-лист настройки</div></div>
                <div className="bk-panel-body" style={{ padding: '8px 18px 14px' }}>
                  {setupSteps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12.5, color: s.done ? 'var(--ink)' : 'var(--fg-3)' }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, background: s.done ? 'var(--ink)' : '#fff', border: `1.5px solid ${s.done ? 'var(--ink)' : 'var(--line-2)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        {s.done && <Ic d={BK_ICON.check} size={10} sw={2.5} />}
                      </span>
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
