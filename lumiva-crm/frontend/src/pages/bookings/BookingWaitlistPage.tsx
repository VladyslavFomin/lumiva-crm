import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
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
  WAITLIST_STATUS_LABELS_RU,
  type BookingWaitlistEntry,
  type BookingLocation,
  type BookingServiceItem,
  type BookingStaffProfile,
} from '../../api/bookings';
import './bookings-design.css';

const FILTERS = ['Все', 'Ждёт', 'Предложен слот', 'Подтверждён', 'Истёк'];

const AddModal: React.FC<{
  open: boolean;
  locations: BookingLocation[];
  services: BookingServiceItem[];
  staff: BookingStaffProfile[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, locations, services, staff, onClose, onCreated }) => {
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
      showAlert(e.message || 'Не удалось добавить в лист ожидания', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Добавить в лист ожидания</h3>
        <div className="bk-field"><label>Клиент</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="bk-field"><label>Телефон</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>Локация</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Любая</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>Услуга</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Любая</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="bk-field">
          <label>Мастер</label>
          <select value={preferredStaffUserId} onChange={(e) => setPreferredStaffUserId(e.target.value)}>
            <option value="">Любой</option>
            {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
          </select>
        </div>
        <div className="bk-field"><label>Предпочтения по времени</label><input value={preferredWindow} onChange={(e) => setPreferredWindow(e.target.value)} placeholder="23–25 апр, после 15:00" /></div>
        <div className="bk-field">
          <label>Приоритет</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
            <option value="normal">Обычный</option>
            <option value="high">Высокий</option>
            <option value="vip">VIP</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
            <Ic d={BK_ICON.check} size={13} /> Добавить
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
      showAlert(e.message || 'Не удалось предложить слот', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Предложить слот</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>{entry.customerName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="bk-field"><label>Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="bk-field"><label>Время</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div className="bk-field"><label>Длительность (мин)</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}>
            <Ic d={BK_ICON.check} size={13} /> Отправить предложение
          </button>
        </div>
      </div>
    </div>
  );
};

export const BookingWaitlistPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [entries, setEntries] = useState<BookingWaitlistEntry[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [filter, setFilter] = useState('Все');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [offerEntry, setOfferEntry] = useState<BookingWaitlistEntry | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchWaitlist(), fetchBookingLocations(), fetchBookingServices(), fetchBookingStaff()])
      .then(([w, l, s, st]) => {
        setEntries(w);
        setLocations(l);
        setServices(s);
        setStaff(st);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить лист ожидания', { variant: 'error' }))
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
      showAlert(e.message || 'Не удалось создать бронь', { variant: 'error' });
    }
  };

  const remove = async (id: string) => {
    try {
      await removeWaitlistEntry(id);
      load();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось удалить запись', { variant: 'error' });
    }
  };

  const filtered = entries.filter((e) => filter === 'Все' || WAITLIST_STATUS_LABELS_RU[e.status] === filter);
  const serviceName = (id: string | null) => services.find((s) => s.id === id)?.name || '—';
  const locationName = (id: string | null) => locations.find((l) => l.id === id)?.name || 'Любая';
  const staffName = (id: string | null) => (id ? staff.find((s) => s.staffUserId === id)?.staffUser?.fullName || '—' : 'Любой');

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="waitlist" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{entries.filter((e) => e.status === 'waiting').length} ЖДУТ СЛОТА</div>
            <h1>Лист ожидания</h1>
            <p className="sub">Клиенты, для которых пока нет подходящего слота.</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              <Ic d={BK_ICON.plus} size={13} /> Добавить в лист
            </button>
          </div>
        </div>

        <div className="bk-savedviews" style={{ marginTop: 16 }}>
          {FILTERS.map((f) => (
            <div key={f} className={`bk-sv-tab${f === filter ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</div>
          ))}
        </div>

        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr><th>Клиент</th><th>Услуга</th><th>Локация</th><th>Предпочтения</th><th>Мастер</th><th>Приоритет</th><th>Статус</th><th>Добавлен</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Пусто</td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{e.customerName}</td>
                  <td>{serviceName(e.serviceId)}</td>
                  <td style={{ color: 'var(--fg-3)' }}>{locationName(e.locationId)}</td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{e.preferredWindow || '—'}</td>
                  <td style={{ color: 'var(--fg-3)' }}>{staffName(e.preferredStaffUserId)}</td>
                  <td>
                    {e.priority === 'vip' && <span className="bk-badge checked_in">VIP</span>}
                    {e.priority === 'high' && <span className="bk-badge pending">Высокий</span>}
                    {e.priority === 'normal' && <span style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>Обычный</span>}
                  </td>
                  <td><span className={`bk-badge ${e.status === 'waiting' ? 'pending' : e.status === 'confirmed' ? 'confirmed' : e.status === 'offer' ? 'checked_in' : 'no_show'}`}>{WAITLIST_STATUS_LABELS_RU[e.status]}</span></td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{new Date(e.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {e.status === 'waiting' && (
                      <button className="btn btn-sm" onClick={() => setOfferEntry(e)}>Предложить слот</button>
                    )}
                    {e.status === 'offer' && (
                      <button className="btn btn-primary btn-sm" onClick={() => convert(e.id)}>Создать бронь</button>
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
