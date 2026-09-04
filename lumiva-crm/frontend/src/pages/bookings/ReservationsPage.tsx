import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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
  type Reservation,
  type ReservationStatus,
  type BookingLocation,
  type BookingServiceItem,
  type BookingResourceItem,
  type BookingStaffProfile,
  type CustomerStats,
} from '../../api/bookings';
import './bookings-design.css';

type ViewKey = 'all' | 'today' | 'tomorrow' | 'week' | 'pending' | 'cancelled' | 'mine';
const VIEW_KEYS: ViewKey[] = ['all', 'today', 'tomorrow', 'week', 'pending', 'cancelled', 'mine'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toCsv(rows: Reservation[], t: TFunction, statusLabel: (s: ReservationStatus) => string): string {
  const header = [
    t('crm.bookings.list.csv.colId'),
    t('crm.bookings.list.csv.colDate'),
    t('crm.bookings.list.csv.colTime'),
    t('crm.bookings.list.csv.colClient'),
    t('crm.bookings.list.csv.colPhone'),
    t('crm.bookings.list.csv.colStatus'),
    t('crm.bookings.list.csv.colSource'),
  ];
  const lines = rows.map((r) => [
    r.id,
    new Date(r.startAt).toLocaleDateString('ru-RU'),
    new Date(r.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    r.customerName || '',
    r.customerPhone || '',
    statusLabel(r.status),
    r.source,
  ]);
  return [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

const ClientDrawer: React.FC<{ reservation: Reservation | null; onClose: () => void }> = ({ reservation, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';

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
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--fg-3)', textTransform: 'uppercase' }}>{t('crm.bookings.list.drawer.profileTitle')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer' }}><Ic d={BK_ICON.x} size={15} /></button>
        </div>
        <div className="bk-cust-card" style={{ border: 0, margin: 0, padding: 0 }}>
          <div className="bk-cust-ava">{initials}</div>
          <div>
            <div className="n">{reservation.customerName || t('crm.bookings.list.table.noName')}</div>
            <div className="c">{reservation.customerPhone}</div>
            {stats?.tags && stats.tags.length > 0 && (
              <div className="bk-cust-tags">{stats.tags.map((tg) => <span key={tg} className="bk-cust-tag">{tg}</span>)}</div>
            )}
          </div>
        </div>
        <div className="bk-cust-stat">
          <div><div className="v">{stats?.visits ?? '—'}</div><div className="l">{t('crm.bookings.list.drawer.visits')}</div></div>
          <div><div className="v">{stats ? `${stats.ltv} ₽` : '—'}</div><div className="l">{t('crm.bookings.list.drawer.ltv')}</div></div>
          <div><div className="v" style={{ fontSize: 11 }}>{stats?.lastVisit ? new Date(stats.lastVisit).toLocaleDateString(dateLocale) : '—'}</div><div className="l">{t('crm.bookings.list.drawer.lastVisit')}</div></div>
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line-3)' }}>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 8 }}>{t('crm.bookings.list.drawer.currentBookingTitle')}</div>
          <div className="bk-info-row"><span className="l">{t('crm.bookings.list.drawer.dateLabel')}</span><span className="v">{new Date(reservation.startAt).toLocaleString(dateLocale)}</span></div>
          <div className="bk-info-row"><span className="l">{t('crm.bookings.list.drawer.statusLabel')}</span><span className="v">{t(`crm.bookings.status.${reservation.status}`)}</span></div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 18 }} onClick={() => navigate(`/bookings/reservations/${reservation.id}`)}>
          {t('crm.bookings.list.drawer.openBooking')}
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
  const { t } = useTranslation();
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
      showAlert(t('crm.bookings.list.modal.requiredError'), { variant: 'error' });
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
      showAlert(e.message || t('crm.bookings.list.modal.createError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('crm.bookings.list.modal.title')}</h3>
        <div className="bk-field">
          <label>{t('crm.bookings.list.modal.clientLabel')}</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('crm.bookings.list.modal.clientPlaceholder')} />
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.list.modal.phoneLabel')}</label>
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t('crm.bookings.list.modal.phonePlaceholder')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>{t('crm.bookings.list.modal.locationLabel')}</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>{t('crm.bookings.list.modal.serviceLabel')}</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">{t('crm.bookings.list.modal.serviceNone')}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.list.modal.staffLabel')}</label>
          <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
            <option value="">{t('crm.bookings.list.modal.staffAny')}</option>
            {staff.filter((s) => s.availableForBooking).map((s) => (
              <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName || s.staffUserId}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>{t('crm.bookings.list.modal.dateLabel')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="bk-field">
            <label>{t('crm.bookings.list.modal.timeLabel')}</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.list.modal.cancel')}</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleCreate}>
            <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.list.modal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ReservationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewKey>('all');
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

  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const statusLabel = (s: ReservationStatus) => t(`crm.bookings.status.${s}`);
  const sourceLabel = (s: string) => (s === 'website' || s === 'phone' || s === 'walkin' || s === 'manual' || s === 'api' || s === 'telegram' ? t(`crm.bookings.source.${s}`) : s);

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
      .catch((e) => showAlert(e.message || t('crm.bookings.list.error'), { variant: 'error' }))
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
      if (view === 'today' && !isSameDay(start, now)) return false;
      if (view === 'tomorrow' && !isSameDay(start, tomorrow)) return false;
      if (view === 'week' && (start < now || start > weekEnd)) return false;
      if (view === 'pending' && r.status !== 'pending') return false;
      if (view === 'cancelled' && !r.status.startsWith('cancelled') && r.status !== 'rejected') return false;
      if (view === 'mine' && r.assignedUserId !== myStaffUserId) return false;
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
      showAlert(e.message || t('crm.bookings.list.bulkbar.confirmError'), { variant: 'error' });
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
      showAlert(e.message || t('crm.bookings.list.bulkbar.cancelError'), { variant: 'error' });
    } finally {
      setBulkLoading(false);
    }
  };

  const exportCsv = () => {
    const csv = toCsv(filtered, t, statusLabel);
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
      <PageHelpButton topic="reservations" />
      <div className="px-scope">
        <BookingsSubnav active="reservations" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.list.kicker', { count: reservations.length })}</div>
            <h1>{t('crm.bookings.list.title')}</h1>
            <p className="sub">{t('crm.bookings.list.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => navigate('/bookings/reservations/import')}>
              {t('crm.bookings.list.import')}
            </button>
            <button className="btn btn-sm" onClick={exportCsv} disabled={!filtered.length}>
              <Ic d={BK_ICON.more} size={13} /> {t('crm.bookings.list.export')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)} disabled={!locations.length}>
              <Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.list.newBooking')}
            </button>
          </div>
        </div>

        <div className="bk-savedviews" style={{ marginTop: 16 }}>
          {VIEW_KEYS.map((v) => (
            <div key={v} className={`bk-sv-tab${v === view ? ' active' : ''}`} onClick={() => setView(v)}>{t(`crm.bookings.list.views.${v}`)}</div>
          ))}
        </div>

        <div className="bk-filters">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-2)', borderRadius: 8, padding: '7px 12px', width: 200 }}>
            <Ic d={BK_ICON.search} size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.bookings.list.filters.searchPlaceholder')}
              style={{ border: 0, outline: 'none', fontSize: 12.5, width: '100%' }}
            />
          </div>
          <select className="bk-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">{t('crm.bookings.list.filters.locationAll')}</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="bk-select" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
            <option value="">{t('crm.bookings.list.filters.serviceAll')}</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="bk-select" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="">{t('crm.bookings.list.filters.staffAll')}</option>
            {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
          </select>
          <select className="bk-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('crm.bookings.list.filters.statusAll')}</option>
            {(['draft', 'pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled_by_customer', 'cancelled_by_business', 'rejected', 'no_show'] as ReservationStatus[]).map((k) => (
              <option key={k} value={k}>{statusLabel(k)}</option>
            ))}
          </select>
          <select className="bk-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">{t('crm.bookings.list.filters.sourceAll')}</option>
            <option value="website">{t('crm.bookings.source.website')}</option>
            <option value="phone">{t('crm.bookings.source.phone')}</option>
            <option value="walkin">{t('crm.bookings.source.walkin')}</option>
            <option value="manual">{t('crm.bookings.source.manual')}</option>
            <option value="api">{t('crm.bookings.source.api')}</option>
            <option value="telegram">{t('crm.bookings.source.telegram')}</option>
          </select>
        </div>

        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}></th>
                <th>{t('crm.bookings.list.table.colDate')}</th>
                <th>{t('crm.bookings.list.table.colClient')}</th>
                <th>{t('crm.bookings.list.table.colService')}</th>
                <th>{t('crm.bookings.list.table.colStaff')}</th>
                <th>{t('crm.bookings.list.table.colResource')}</th>
                <th>{t('crm.bookings.list.table.colStatus')}</th>
                <th>{t('crm.bookings.list.table.colPayment')}</th>
                <th>{t('crm.bookings.list.table.colSource')}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.bookings.list.table.empty')}</td></tr>
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
                    {new Date(r.startAt).toLocaleDateString(dateLocale)}{' '}
                    <span style={{ color: 'var(--fg-3)' }}>· {new Date(r.startAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="cust-cell" onClick={(e) => { e.stopPropagation(); setDrawerRes(r); }} style={{ cursor: 'pointer' }}>
                    <span className="n">{r.customerName || t('crm.bookings.list.table.noName')}</span>
                    <span className="s">{r.customerPhone || ''}</span>
                  </td>
                  <td>{serviceName(r.serviceId)}</td>
                  <td>{staffName(r.staffUserId)}</td>
                  <td>{resourceName(r.resourceId)}</td>
                  <td><span className={`bk-badge ${r.status}`}>{statusLabel(r.status)}</span></td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{r.paymentStatus === 'not_required' ? '—' : r.paymentStatus}</td>
                  <td><span className="src">{sourceLabel(r.source)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected.length > 0 && (
          <div className="bk-bulkbar">
            <div className="bk-bulkbar-count"><strong>{selected.length}</strong> {t('crm.bookings.list.bulkbar.selected')}</div>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-btn" disabled={bulkLoading} onClick={bulkConfirm}>
              <Ic d={BK_ICON.check} size={12} /> {t('crm.bookings.list.bulkbar.confirm')}
            </button>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-btn danger" disabled={bulkLoading} onClick={bulkCancel}>
              <Ic d={BK_ICON.x} size={12} /> {t('crm.bookings.list.bulkbar.cancel')}
            </button>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-close" onClick={() => setSelected([])} aria-label={t('crm.bookings.list.bulkbar.closeAria')}>×</button>
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
