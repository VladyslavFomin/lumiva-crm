import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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
  const { t } = useTranslation();
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
      showAlert(err.message || t('crm.bookings.locations.modal.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? t('crm.bookings.locations.modal.titleEdit') : t('crm.bookings.locations.modal.titleNew')}</h3>
        <div className="bk-field">
          <label>{t('crm.bookings.locations.modal.nameLabel')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('crm.bookings.locations.modal.namePlaceholder')} />
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.locations.modal.addressLabel')}</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('crm.bookings.locations.modal.addressPlaceholder')} />
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.locations.modal.phoneLabel')}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.locations.modal.emailLabel')}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.locations.modal.timezoneLabel')}</label>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder={t('crm.bookings.locations.modal.timezonePlaceholder')} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.locations.modal.cancel')}</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
            <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.locations.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const BookingLocationsPage: React.FC = () => {
  const { t } = useTranslation();
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
      .catch((e) => showAlert(e.message || t('crm.bookings.locations.error'), { variant: 'error' }))
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
    const ok = await showConfirm(t('crm.bookings.locations.deleteConfirm.body', { name: location.name }), {
      title: t('crm.bookings.locations.deleteConfirm.title'),
      confirmLabel: t('crm.bookings.locations.deleteConfirm.confirmLabel'),
      cancelLabel: t('crm.bookings.locations.deleteConfirm.cancelLabel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBookingLocation(location.id);
      load();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.locations.deleteConfirm.error'), { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="bookingLocations" />
      <div className="px-scope">
        <BookingsSubnav active="locations" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.locations.kicker', { count: locations.length })}</div>
            <h1>{t('crm.bookings.locations.title')}</h1>
            <p className="sub">{t('crm.bookings.locations.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'create' })}>
              <Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.locations.newLocation')}
            </button>
          </div>
        </div>

        {!loading && locations.length > 0 && (
          <div className="bk-kpi-grid" style={{ margin: '16px 0' }}>
            <div className="bk-kpi"><div className="l">{t('crm.bookings.locations.kpis.todayReservations')}</div><div className="v">{totals.todayReservations}</div></div>
            <div className="bk-kpi"><div className="l">{t('crm.bookings.locations.kpis.avgOccupancy')}</div><div className="v">{totals.avgOccupancy}%</div></div>
            <div className="bk-kpi"><div className="l">{t('crm.bookings.locations.kpis.todayRevenue')}</div><div className="v">{totals.todayRevenue} ₽</div></div>
            <div className="bk-kpi"><div className="l">{t('crm.bookings.locations.kpis.busiest')}</div><div className="v" style={{ fontSize: 16 }}>{totals.busiest?.name || '—'}</div><div className="d">{totals.busiest ? t('crm.bookings.locations.kpis.busiestOccupancy', { pct: totals.busiest.occupancy }) : ''}</div></div>
          </div>
        )}

        <div className="bk-table-wrap" style={{ marginTop: 16 }}>
          <table className="bk-table">
            <thead>
              <tr>
                <th>{t('crm.bookings.locations.table.colName')}</th>
                <th>{t('crm.bookings.locations.table.colAddress')}</th>
                <th>{t('crm.bookings.locations.table.colStaff')}</th>
                <th>{t('crm.bookings.locations.table.colResources')}</th>
                <th>{t('crm.bookings.locations.table.colToday')}</th>
                <th>{t('crm.bookings.locations.table.colOccupancy')}</th>
                <th>{t('crm.bookings.locations.table.colRevenue')}</th>
                <th>{t('crm.bookings.locations.table.colStatus')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && locations.length === 0 && (
                <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.bookings.locations.table.empty')}</td></tr>
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
                    <td><span className="bk-badge confirmed">{l.status === 'active' ? t('crm.bookings.locations.table.statusActive') : l.status}</span></td>
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
