import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchReservation,
  fetchReservationActivity,
  fetchBookingLocations,
  fetchBookingServices,
  fetchBookingStaff,
  fetchBookingResources,
  fetchCustomerStats,
  confirmReservation,
  cancelReservation,
  rejectReservation,
  checkInReservation,
  completeReservation,
  markReservationNoShow,
  updateReservation,
  RESERVATION_STATUS_LABELS_RU,
  type Reservation,
  type ReservationActivity,
  type BookingLocation,
  type BookingServiceItem,
  type BookingStaffProfile,
  type BookingResourceItem,
  type CustomerStats,
  type ReservationPaymentStatus,
} from '../../api/bookings';
import { fetchNotes, createNote, deleteNote, type Note } from '../../api/notes';
import './bookings-design.css';

const TABS = ['Обзор', 'Клиент', 'Данные брони', 'Активность', 'Заметки'] as const;
type TabId = (typeof TABS)[number];

const ACTIVITY_LABELS: Record<string, string> = {
  created: 'Бронь создана',
  status_changed: 'Статус изменён',
  rescheduled: 'Бронь перенесена',
  staff_changed: 'Мастер изменён',
  resource_changed: 'Ресурс изменён',
  notification_sent: 'Уведомление отправлено',
  note_added: 'Добавлена заметка',
};

const PAYMENT_STATUS_OPTIONS: Array<{ id: ReservationPaymentStatus; label: string }> = [
  { id: 'not_required', label: 'Не требуется' },
  { id: 'unpaid', label: 'Не оплачено' },
  { id: 'deposit_paid', label: 'Депозит оплачен' },
  { id: 'paid', label: 'Оплачено' },
  { id: 'partially_refunded', label: 'Частично возвращено' },
  { id: 'refunded', label: 'Возвращено' },
  { id: 'failed', label: 'Ошибка оплаты' },
];

const toLocalDateInput = (iso: string) => iso.slice(0, 10);
const toLocalTimeInput = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

const EditReservationModal: React.FC<{
  open: boolean;
  reservation: Reservation;
  locations: BookingLocation[];
  services: BookingServiceItem[];
  staff: BookingStaffProfile[];
  resources: BookingResourceItem[];
  onClose: () => void;
  onSaved: (updated: Reservation) => void;
}> = ({ open, reservation, locations, services, staff, resources, onClose, onSaved }) => {
  const { showAlert } = useAlertModal();
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffUserId, setStaffUserId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [participants, setParticipants] = useState('1');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [paymentStatus, setPaymentStatus] = useState<ReservationPaymentStatus>('not_required');
  const [saving, setSaving] = useState(false);

  // Модалка переоткрывается на каждой брони заново — переинициализируем поля из
  // актуальной брони именно в момент открытия, а не один раз при первом монтировании
  // (та же логика, что и в других формах модуля "Бронирования").
  useEffect(() => {
    if (!open) return;
    setLocationId(reservation.locationId);
    setServiceId(reservation.serviceId || '');
    setStaffUserId(reservation.staffUserId || '');
    setResourceId(reservation.resourceId || '');
    setDate(toLocalDateInput(reservation.startAt));
    setTime(toLocalTimeInput(reservation.startAt));
    setDurationMinutes(String(Math.round((new Date(reservation.endAt).getTime() - new Date(reservation.startAt).getTime()) / 60_000)));
    setParticipants(String(reservation.participants));
    setPrice(reservation.price || '');
    setCurrency(reservation.currency || 'RUB');
    setPaymentStatus(reservation.paymentStatus);
  }, [open, reservation]);

  if (!open) return null;

  const resourcesAtLocation = resources.filter((r) => r.locationId === locationId);

  const save = async () => {
    setSaving(true);
    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + (Number(durationMinutes) || 60) * 60_000);
    try {
      const updated = await updateReservation(reservation.id, {
        locationId,
        serviceId: serviceId || null,
        staffUserId: staffUserId || null,
        resourceId: resourceId || null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        participants: Number(participants) || 1,
        price: price.trim() ? price.trim() : null,
        currency,
        paymentStatus,
      } as Partial<Reservation>);
      onSaved(updated);
      onClose();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось сохранить изменения', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, calc(100vw - 32px))' }}>
        <h3>Редактировать бронь</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>Локация</label>
            <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setResourceId(''); }}>
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
          <div className="bk-field">
            <label>Мастер</label>
            <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
              <option value="">Не назначен</option>
              {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>Кабинет / ресурс</label>
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">Без ресурса</option>
              {resourcesAtLocation.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="bk-field"><label>Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="bk-field"><label>Время начала</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div className="bk-field"><label>Длительность (мин)</label><input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} /></div>
          <div className="bk-field"><label>Участников</label><input type="number" value={participants} onChange={(e) => setParticipants(e.target.value)} /></div>
          <div className="bk-field"><label>Цена</label><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Например, 3000" /></div>
          <div className="bk-field">
            <label>Валюта</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />
          </div>
          <div className="bk-field" style={{ gridColumn: '1 / -1' }}>
            <label>Статус оплаты</label>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as ReservationPaymentStatus)}>
              {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
            <Ic d={BK_ICON.check} size={13} /> Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export const ReservationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [activity, setActivity] = useState<ReservationActivity[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [tab, setTab] = useState<TabId>('Обзор');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchReservation(id),
      fetchReservationActivity(id),
      fetchBookingLocations(),
      fetchBookingServices(),
      fetchBookingStaff(),
      fetchBookingResources(),
    ])
      .then(([r, a, l, s, st, res]) => {
        setReservation(r);
        setActivity(a);
        setLocations(l);
        setServices(s);
        setStaff(st);
        setResources(res);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить бронь', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (reservation?.contactId) {
      fetchCustomerStats(reservation.contactId).then(setCustomerStats).catch(() => setCustomerStats(null));
    }
  }, [reservation?.contactId]);

  const loadNotes = () => {
    if (!id) return;
    setNotesLoading(true);
    fetchNotes({ entityType: 'reservation', entityId: id })
      .then((res) => setNotes(res.items))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false));
  };

  useEffect(() => {
    if (tab === 'Заметки') loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  const addNote = async () => {
    if (!id || !newNote.trim()) return;
    try {
      await createNote({ entityType: 'reservation', entityId: id, content: newNote.trim() });
      setNewNote('');
      loadNotes();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось добавить заметку', { variant: 'error' });
    }
  };

  const removeNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      loadNotes();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось удалить заметку', { variant: 'error' });
    }
  };

  const service = useMemo(() => services.find((s) => s.id === reservation?.serviceId), [services, reservation]);
  const location = useMemo(() => locations.find((l) => l.id === reservation?.locationId), [locations, reservation]);
  const staffProfile = useMemo(() => staff.find((s) => s.staffUserId === reservation?.staffUserId), [staff, reservation]);

  const runAction = async (fn: (id: string) => Promise<Reservation>) => {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await fn(id);
      setReservation(updated);
      load();
    } catch (e: any) {
      showAlert(e.message || 'Действие не выполнено', { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !reservation) {
    return (
      <MainLayout>
        <div className="px-scope" style={{ padding: 24, color: 'var(--fg-3)' }}>Загрузка…</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="bk-det-head">
          <div>
            <div className="idline">
              #{reservation.id.slice(0, 8)} · создана {new Date(reservation.createdAt).toLocaleString('ru-RU')} · источник: {reservation.source}
            </div>
            <h1>{reservation.customerName || 'Без имени'}{service ? ` — ${service.name}` : ''}</h1>
            <div className="sub">
              {new Date(reservation.startAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}
              {' – '}
              {new Date(reservation.endAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              {location ? ` · ${location.name}` : ''}
              {staffProfile ? ` · мастер ${staffProfile.staffUser?.fullName}` : ''}
            </div>
          </div>
          <div className="bk-det-actions">
            <span className={`bk-badge ${reservation.status}`} style={{ fontSize: 12, padding: '5px 12px' }}>
              {RESERVATION_STATUS_LABELS_RU[reservation.status]}
            </span>
            <button className="btn btn-sm" onClick={() => setEditOpen(true)}>
              <Ic d={BK_ICON.edit} size={13} /> Редактировать
            </button>
            {reservation.status === 'pending' && (
              <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={() => runAction(confirmReservation)}>
                <Ic d={BK_ICON.check} size={13} /> Подтвердить
              </button>
            )}
            {reservation.status === 'confirmed' && (
              <button className="btn btn-sm" disabled={actionLoading} onClick={() => runAction(checkInReservation)}>
                Отметить приход
              </button>
            )}
            {reservation.status === 'checked_in' && (
              <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={() => runAction(completeReservation)}>
                <Ic d={BK_ICON.check} size={13} /> Завершить
              </button>
            )}
            {['pending', 'confirmed'].includes(reservation.status) && (
              <>
                <button className="btn btn-sm" style={{ color: '#cc2f47', borderColor: '#f0c8cf' }} disabled={actionLoading} onClick={() => runAction(markReservationNoShow)}>
                  Неявка
                </button>
                <button className="btn btn-sm" style={{ color: '#cc2f47', borderColor: '#f0c8cf' }} disabled={actionLoading} onClick={() => runAction(cancelReservation)}>
                  <Ic d={BK_ICON.x} size={13} /> Отменить
                </button>
              </>
            )}
            {reservation.status === 'pending' && (
              <button className="btn btn-sm" style={{ color: '#cc2f47', borderColor: '#f0c8cf' }} disabled={actionLoading} onClick={() => runAction(rejectReservation)}>
                Отклонить
              </button>
            )}
          </div>
        </div>

        <div className="bk-tabs">
          {TABS.map((t) => (
            <div key={t} className={`bk-tab${t === tab ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>

        {tab === 'Обзор' && (
          <div className="bk-grid2">
            <div className="bk-panel">
              <div className="bk-panel-head"><div className="t">Детали брони</div></div>
              <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                <div className="bk-info-row"><span className="l">Услуга</span><span className="v">{service?.name || '—'}</span></div>
                <div className="bk-info-row"><span className="l">Длительность</span><span className="v">{service ? `${service.durationMinutes} минут` : '—'}</span></div>
                <div className="bk-info-row"><span className="l">Локация</span><span className="v">{location?.name || '—'}</span></div>
                <div className="bk-info-row"><span className="l">Мастер</span><span className="v">{staffProfile?.staffUser?.fullName || '—'}</span></div>
                <div className="bk-info-row"><span className="l">Участников</span><span className="v">{reservation.participants}</span></div>
                <div className="bk-info-row"><span className="l">Цена</span><span className="v">{reservation.price ? `${reservation.price} ${reservation.currency}` : '—'}</span></div>
                <div className="bk-info-row"><span className="l">Статус оплаты</span><span className="v">{reservation.paymentStatus}</span></div>
                <div className="bk-info-row"><span className="l">Источник</span><span className="v">{reservation.source}</span></div>
              </div>
            </div>

            <div>
              <div className="bk-panel" style={{ marginBottom: 16 }}>
                <div className="bk-panel-head"><div className="t">Клиент</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  <div className="bk-cust-card" style={{ border: 0, padding: 0, margin: 0 }}>
                    <div className="bk-cust-ava">{(reservation.customerName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                    <div>
                      <div className="n">{reservation.customerName || 'Без имени'}</div>
                      <div className="c">{reservation.customerPhone} {reservation.customerEmail ? `· ${reservation.customerEmail}` : ''}</div>
                    </div>
                  </div>
                </div>
              </div>

              {reservation.leadId && (
                <div className="bk-panel">
                  <div className="bk-panel-head">
                    <div className="t">Связанный лид</div>
                    <button className="link" onClick={() => navigate(`/leads/${reservation.leadId}`)}>Открыть →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'Клиент' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Профиль клиента</div></div>
            <div className="bk-panel-body" style={{ padding: 18 }}>
              <div className="bk-cust-card">
                <div className="bk-cust-ava">{(reservation.customerName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                <div>
                  <div className="n">{reservation.customerName || 'Без имени'}</div>
                  <div className="c">{reservation.customerPhone} {reservation.customerEmail ? `· ${reservation.customerEmail}` : ''}</div>
                  {customerStats?.tags && customerStats.tags.length > 0 && (
                    <div className="bk-cust-tags">{customerStats.tags.map((t) => <span key={t} className="bk-cust-tag">{t}</span>)}</div>
                  )}
                </div>
              </div>
              <div className="bk-cust-stat" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 0 }}>
                <div><div className="v">{customerStats?.visits ?? '—'}</div><div className="l">визитов</div></div>
                <div><div className="v">{customerStats?.cancellations ?? '—'}</div><div className="l">отмен</div></div>
                <div><div className="v">{customerStats?.noShows ?? '—'}</div><div className="l">неявок</div></div>
                <div><div className="v">{customerStats ? `${customerStats.ltv} ₽` : '—'}</div><div className="l">оборот</div></div>
              </div>
              {!reservation.contactId && (
                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>Контакт для этой брони не связан.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'Данные брони' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Данные из формы бронирования</div></div>
            <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
              {reservation.customFields && Object.keys(reservation.customFields).length > 0 ? (
                Object.entries(reservation.customFields).map(([k, v]) => (
                  <div className="bk-info-row" key={k}><span className="l">{k}</span><span className="v">{String(v)}</span></div>
                ))
              ) : (
                <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>Нет дополнительных данных</div>
              )}
            </div>
          </div>
        )}

        {tab === 'Активность' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Журнал активности</div></div>
            <div className="bk-panel-body" style={{ padding: 18 }}>
              <div className="bk-timeline">
                {activity.map((a) => (
                  <div key={a.id} className="bk-tl-item">
                    <div className="t">{ACTIVITY_LABELS[a.type] || a.type}</div>
                    {a.description && <div className="d">{a.description}</div>}
                    <div className="when">{new Date(a.createdAt).toLocaleString('ru-RU')}{a.user ? ` · ${a.user.fullName}` : ''}</div>
                  </div>
                ))}
                {activity.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>Пока нет событий</div>}
              </div>
            </div>
          </div>
        )}

        {tab === 'Заметки' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Внутренние заметки</div></div>
            <div className="bk-panel-body" style={{ padding: 18 }}>
              {notesLoading && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Загрузка…</div>}
              {!notesLoading && notes.length === 0 && (
                <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5, marginBottom: 12 }}>Пока нет заметок</div>
              )}
              {notes.map((n) => (
                <div key={n.id} className="bk-note">
                  <div className="hd"><b>{n.createdBy || 'Вы'}</b> · {new Date(n.createdAt).toLocaleString('ru-RU')}
                    <button onClick={() => removeNote(n.id)} style={{ float: 'right', background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer' }}>
                      <Ic d={BK_ICON.x} size={12} />
                    </button>
                  </div>
                  <div className="body">{n.content}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Добавить заметку…" style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
                <button className="btn btn-primary btn-sm" onClick={addNote}>Добавить</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <EditReservationModal
        open={editOpen}
        reservation={reservation}
        locations={locations}
        services={services}
        staff={staff}
        resources={resources}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setReservation(updated);
          load();
        }}
      />
    </MainLayout>
  );
};
