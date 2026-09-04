import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchWaitlist,
  createWaitlistEntry,
  offerWaitlistSlot,
  convertWaitlistEntry,
  removeWaitlistEntry,
  fetchBookingLocations,
  fetchBookingServices,
  fetchBookingStaff,
  type BookingWaitlistEntry,
  type WaitlistStatus,
  type BookingLocation,
  type BookingServiceItem,
  type BookingStaffProfile,
} from '../../api/bookings';
import './bookings-design.css';

type FilterKey = 'all' | 'waiting' | 'offer' | 'confirmed' | 'expired';
const FILTER_KEYS: FilterKey[] = ['all', 'waiting', 'offer', 'confirmed', 'expired'];

const AddModal: React.FC<{
  open: boolean;
  locations: BookingLocation[];
  services: BookingServiceItem[];
  staff: BookingStaffProfile[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, locations, services, staff, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [preferredStaffUserId, setPreferredStaffUserId] = useState('');
  const [preferredWindow, setPreferredWindow] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'vip'>('normal');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createWaitlistEntry({
        customerName: name.trim(),
        customerPhone: phone || undefined,
        locationId: locationId || undefined,
        serviceId: serviceId || undefined,
        preferredStaffUserId: preferredStaffUserId || undefined,
        preferredWindow: preferredWindow || undefined,
        priority,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.waitlist.addModal.error'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('crm.bookings.waitlist.addModal.title')}</h3>
        <div className="bk-field"><label>{t('crm.bookings.waitlist.addModal.clientLabel')}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="bk-field"><label>{t('crm.bookings.waitlist.addModal.phoneLabel')}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>{t('crm.bookings.waitlist.addModal.locationLabel')}</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">{t('crm.bookings.waitlist.addModal.locationAny')}</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>{t('crm.bookings.waitlist.addModal.serviceLabel')}</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">{t('crm.bookings.waitlist.addModal.serviceAny')}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="bk-field">
          <label>{t('crm.bookings.waitlist.addModal.staffLabel')}</label>
          <select value={preferredStaffUserId} onChange={(e) => setPreferredStaffUserId(e.target.value)}>
            <option value="">{t('crm.bookings.waitlist.addModal.staffAny')}</option>
            {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
          </select>
        </div>
        <div className="bk-field"><label>{t('crm.bookings.waitlist.addModal.windowLabel')}</label><input value={preferredWindow} onChange={(e) => setPreferredWindow(e.target.value)} placeholder={t('crm.bookings.waitlist.addModal.windowPlaceholder')} /></div>
        <div className="bk-field">
          <label>{t('crm.bookings.waitlist.addModal.priorityLabel')}</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
            <option value="normal">{t('crm.bookings.waitlist.priority.normal')}</option>
            <option value="high">{t('crm.bookings.waitlist.priority.high')}</option>
            <option value="vip">{t('crm.bookings.waitlist.priority.vip')}</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.waitlist.addModal.cancel')}</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
            <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.waitlist.addModal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

const OfferModal: React.FC<{
  entry: BookingWaitlistEntry | null;
  onClose: () => void;
  onDone: () => void;
}> = ({ entry, onClose, onDone }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [saving, setSaving] = useState(false);

  if (!entry) return null;

  const submit = async () => {
    if (!date || !time) return;
    setSaving(true);
    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + Number(duration) * 60_000);
    try {
      await offerWaitlistSlot(entry.id, { startAt: startAt.toISOString(), endAt: endAt.toISOString() });
      onDone();
      onClose();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.waitlist.offerModal.error'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('crm.bookings.waitlist.offerModal.title')}</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>{entry.customerName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="bk-field"><label>{t('crm.bookings.waitlist.offerModal.dateLabel')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.waitlist.offerModal.timeLabel')}</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.waitlist.offerModal.durationLabel')}</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.waitlist.offerModal.cancel')}</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}>
            <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.waitlist.offerModal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const BookingWaitlistPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertModal();
  const [entries, setEntries] = useState<BookingWaitlistEntry[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [offerEntry, setOfferEntry] = useState<BookingWaitlistEntry | null>(null);

  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const statusLabel = (s: WaitlistStatus) => t(`crm.bookings.waitlist.status.${s}`);

  const load = () => {
    setLoading(true);
    Promise.all([fetchWaitlist(), fetchBookingLocations(), fetchBookingServices(), fetchBookingStaff()])
      .then(([w, l, s, st]) => {
        setEntries(w);
        setLocations(l);
        setServices(s);
        setStaff(st);
      })
      .catch((e) => showAlert(e.message || t('crm.bookings.waitlist.error'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const convert = async (id: string) => {
    try {
      await convertWaitlistEntry(id);
      load();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.waitlist.errors.convert'), { variant: 'error' });
    }
  };

  const remove = async (id: string) => {
    try {
      await removeWaitlistEntry(id);
      load();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.waitlist.errors.remove'), { variant: 'error' });
    }
  };

  const filtered = entries.filter((e) => filter === 'all' || e.status === filter);
  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name || '—';
  const locationName = (id: string | null) => locations.find((l) => l.id === id)?.name || t('crm.bookings.waitlist.table.anyLocation');
  const staffName = (id: string | null) => (id ? staff.find((s) => s.staffUserId === id)?.staffUser?.fullName || '—' : t('crm.bookings.waitlist.table.anyStaff'));

  return (
    <MainLayout>
      <PageHelpButton topic="bookingWaitlist" />
      <div className="px-scope">
        <BookingsSubnav active="waitlist" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.waitlist.kicker', { count: entries.filter((e) => e.status === 'waiting').length })}</div>
            <h1>{t('crm.bookings.waitlist.title')}</h1>
            <p className="sub">{t('crm.bookings.waitlist.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              <Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.waitlist.addToList')}
            </button>
          </div>
        </div>

        <div className="bk-savedviews" style={{ marginTop: 16 }}>
          {FILTER_KEYS.map((f) => (
            <div key={f} className={`bk-sv-tab${f === filter ? ' active' : ''}`} onClick={() => setFilter(f)}>{t(`crm.bookings.waitlist.filters.${f}`)}</div>
          ))}
        </div>

        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th>{t('crm.bookings.waitlist.table.colClient')}</th>
                <th>{t('crm.bookings.waitlist.table.colService')}</th>
                <th>{t('crm.bookings.waitlist.table.colLocation')}</th>
                <th>{t('crm.bookings.waitlist.table.colPreferences')}</th>
                <th>{t('crm.bookings.waitlist.table.colStaff')}</th>
                <th>{t('crm.bookings.waitlist.table.colPriority')}</th>
                <th>{t('crm.bookings.waitlist.table.colStatus')}</th>
                <th>{t('crm.bookings.waitlist.table.colAdded')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.bookings.waitlist.table.empty')}</td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{e.customerName}</td>
                  <td>{serviceName(e.serviceId)}</td>
                  <td style={{ color: 'var(--fg-3)' }}>{locationName(e.locationId)}</td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{e.preferredWindow || '—'}</td>
                  <td style={{ color: 'var(--fg-3)' }}>{staffName(e.preferredStaffUserId)}</td>
                  <td>
                    {e.priority === 'vip' && <span className="bk-badge checked_in">{t('crm.bookings.waitlist.priority.vip')}</span>}
                    {e.priority === 'high' && <span className="bk-badge pending">{t('crm.bookings.waitlist.priority.high')}</span>}
                    {e.priority === 'normal' && <span style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{t('crm.bookings.waitlist.priority.normal')}</span>}
                  </td>
                  <td><span className={`bk-badge ${e.status === 'waiting' ? 'pending' : e.status === 'confirmed' ? 'confirmed' : e.status === 'offer' ? 'checked_in' : 'no_show'}`}>{statusLabel(e.status)}</span></td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{new Date(e.createdAt).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {e.status === 'waiting' && (
                      <button className="btn btn-sm" onClick={() => setOfferEntry(e)}>{t('crm.bookings.waitlist.table.offerSlot')}</button>
                    )}
                    {e.status === 'offer' && (
                      <button className="btn btn-primary btn-sm" onClick={() => convert(e.id)}>{t('crm.bookings.waitlist.table.createBooking')}</button>
                    )}
                    {e.status !== 'removed' && (
                      <button className="btn btn-sm" style={{ border: 0, color: '#cc2f47' }} onClick={() => remove(e.id)}>
                        <Ic d={BK_ICON.x} size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AddModal open={addOpen} locations={locations} services={services} staff={staff} onClose={() => setAddOpen(false)} onCreated={load} />
      <OfferModal entry={offerEntry} onClose={() => setOfferEntry(null)} onDone={load} />
    </MainLayout>
  );
};
