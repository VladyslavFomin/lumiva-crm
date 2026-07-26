import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingResources,
  createBookingResource,
  updateBookingResource,
  deleteBookingResource,
  fetchBookingLocations,
  fetchResourceStats,
  type BookingResourceItem,
  type BookingLocation,
  type ResourceStatsRow,
} from '../../api/bookings';
import './bookings-design.css';

type ModalState = { mode: 'create' } | { mode: 'edit'; resource: BookingResourceItem } | null;

const ResourceModal: React.FC<{
  state: ModalState;
  locations: BookingLocation[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ state, locations, onClose, onSaved }) => {
  const { showAlert } = useAlertModal();
  const editing = state?.mode === 'edit' ? state.resource : null;
  const [name, setName] = useState('');
  const [type, setType] = useState('room');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  // `state` flips from null -> create/edit on demand, long after `locations` has already
  // loaded (or not) — re-seed the form fresh every time the modal actually opens rather
  // than baking a snapshot into useState at the page's very first render.
  useEffect(() => {
    if (!state) return;
    setName(editing?.name || '');
    setType(editing?.type || 'room');
    setLocationId(editing?.locationId || locations[0]?.id || '');
    setQuantity(String(editing?.quantity ?? 1));
    setCapacity(String(editing?.capacity ?? ''));
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;

  const handleSave = async () => {
    if (!name.trim() || !locationId) return;
    setSaving(true);
    const dto = {
      name: name.trim(),
      type,
      locationId,
      quantity: Number(quantity) || 1,
      capacity: capacity ? Number(capacity) : null,
    };
    try {
      if (editing) await updateBookingResource(editing.id, dto);
      else await createBookingResource(dto);
      onSaved();
      onClose();
    } catch (err: any) {
      showAlert(err.message || 'Не удалось сохранить ресурс', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? 'Редактировать ресурс' : 'Новый ресурс'}</h3>
        <div className="bk-field">
          <label>Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Кабинет 1" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="room">Кабинет</option>
              <option value="table">Стол</option>
              <option value="hall">Зал</option>
              <option value="equipment">Оборудование</option>
              <option value="parking">Парковочное место</option>
            </select>
          </div>
          <div className="bk-field">
            <label>Локация</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>Количество (для пула ресурсов)</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="bk-field">
            <label>Вместимость</label>
            <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="—" />
          </div>
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

export const BookingResourcesPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [stats, setStats] = useState<ResourceStatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchBookingResources(), fetchBookingLocations(), fetchResourceStats()])
      .then(([res, locs, st]) => {
        setResources(res);
        setLocations(locs);
        setStats(st);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить ресурсы', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  const statsFor = (id: string) => stats.find((s) => s.id === id);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteBookingResource(id);
      load();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось удалить ресурс', { variant: 'error' });
    }
  };

  const locationName = (id: string) => locations.find((l) => l.id === id)?.name || '—';

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="resources" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{resources.length} РЕСУРСОВ</div>
            <h1>Кабинеты и ресурсы</h1>
            <p className="sub">Помещения и оборудование, нужные для оказания услуги — независимо от мастера.</p>
          </div>
          <div className="bk-hero-r">
            <button
              className="btn btn-primary btn-sm"
              disabled={!locations.length}
              onClick={() => setModal({ mode: 'create' })}
            >
              <Ic d={BK_ICON.plus} size={13} /> Новый ресурс
            </button>
          </div>
        </div>
        {!loading && !locations.length && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#fbf2dc', borderRadius: 10, fontSize: 12.5, color: '#7a4a09' }}>
            Сначала добавьте локацию — ресурс всегда привязан к локации.
          </div>
        )}

        <div className="bk-table-wrap" style={{ marginTop: 16 }}>
          <table className="bk-table">
            <thead>
              <tr><th>Название</th><th>Тип</th><th>Локация</th><th>Вместимость</th><th>Загрузка сегодня</th><th>Ближайшая запись</th><th>Статус</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && resources.length === 0 && (
                <tr><td colSpan={8} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Пока нет ресурсов</td></tr>
              )}
              {resources.map((r) => {
                const s = statsFor(r.id);
                return (
                  <tr key={r.id} className="clickable" onClick={() => setModal({ mode: 'edit', resource: r })}>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{r.name}</td>
                    <td style={{ color: 'var(--fg-3)' }}>{r.type}</td>
                    <td style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{locationName(r.locationId)}</td>
                    <td>{r.capacity ?? '—'}</td>
                    <td>
                      {s ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 70, height: 5, background: 'var(--bg-soft)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${s.utilizationToday}%`, height: '100%', background: 'var(--ink)', borderRadius: 3 }} /></div>
                          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{s.utilizationToday}%</span>
                        </div>
                      ) : <span style={{ color: 'var(--fg-4)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                      {s?.nextReservation ? `${s.nextReservation.customerName || 'Клиент'} — ${new Date(s.nextReservation.startAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}` : '—'}
                    </td>
                    <td><span className={r.active ? 'bk-badge confirmed' : 'bk-badge no_show'}>{r.active ? 'Активен' : 'Отключён'}</span></td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm" style={{ border: 0, color: '#cc2f47' }} onClick={() => handleDelete(r.id)}>
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
      <ResourceModal state={modal} locations={locations} onClose={() => setModal(null)} onSaved={load} />
    </MainLayout>
  );
};
