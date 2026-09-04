import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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

type TabId = 'overview' | 'client' | 'fields' | 'activity' | 'notes';
const TAB_KEYS: TabId[] = ['overview', 'client', 'fields', 'activity', 'notes'];

const ACTIVITY_TYPE_KEYS = ['created', 'status_changed', 'rescheduled', 'staff_changed', 'resource_changed', 'notification_sent', 'note_added'];

const PAYMENT_STATUS_KEYS: ReservationPaymentStatus[] = ['not_required', 'unpaid', 'deposit_paid', 'paid', 'partially_refunded', 'refunded', 'failed'];

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
  const { t } = useTranslation();
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
      showAlert(e.message || t('crm.bookings.detail.editModal.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, calc(100vw - 32px))' }}>
        <h3>{t('crm.bookings.detail.editModal.title')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>{t('crm.bookings.detail.editModal.locationLabel')}</label>
            <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setResourceId(''); }}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>{t('crm.bookings.detail.editModal.serviceLabel')}</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">{t('crm.bookings.detail.editModal.serviceNone')}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>{t('crm.bookings.detail.editModal.staffLabel')}</label>
            <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
              <option value="">{t('crm.bookings.detail.editModal.staffNone')}</option>
              {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>{t('crm.bookings.detail.editModal.resourceLabel')}</label>
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">{t('crm.bookings.detail.editModal.resourceNone')}</option>
              {resourcesAtLocation.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="bk-field"><label>{t('crm.bookings.detail.editModal.dateLabel')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.detail.editModal.startTimeLabel')}</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.detail.editModal.durationLabel')}</label><input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.detail.editModal.participantsLabel')}</label><input type="number" value={participants} onChange={(e) => setParticipants(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.detail.editModal.priceLabel')}</label><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('crm.bookings.detail.editModal.pricePlaceholder')} /></div>
          <div className="bk-field">
            <label>{t('crm.bookings.detail.editModal.currencyLabel')}</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />
          </div>
          <div className="bk-field" style={{ gridColumn: '1 / -1' }}>
            <label>{t('crm.bookings.detail.editModal.paymentStatusLabel')}</label>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as ReservationPaymentStatus)}>
              {PAYMENT_STATUS_KEYS.map((k) => <option key={k} value={k}>{t(`crm.bookings.detail.paymentStatusOptions.${k}`)}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.detail.editModal.cancel')}</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
            <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.detail.editModal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ReservationDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [activity, setActivity] = useState<ReservationActivity[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [tab, setTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');

  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const statusLabel = (s: Reservation['status']) => t(`crm.bookings.status.${s}`);
  const paymentStatusLabel = (s: ReservationPaymentStatus) => t(`crm.bookings.detail.paymentStatusOptions.${s}`);

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
      .catch((e) => showAlert(e.message || t('crm.bookings.detail.error'), { variant: 'error' }))
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
    if (tab === 'notes') loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  const addNote = async () => {
    if (!id || !newNote.trim()) return;
    try {
      await createNote({ entityType: 'reservation', entityId: id, content: newNote.trim() });
      setNewNote('');
      loadNotes();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.detail.notesTab.addError'), { variant: 'error' });
    }
  };

  const removeNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      loadNotes();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.detail.notesTab.deleteError'), { variant: 'error' });
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
      showAlert(e.message || t('crm.bookings.detail.actionError'), { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !reservation) {
    return (
      <MainLayout>
        <div className="px-scope" style={{ padding: 24, color: 'var(--fg-3)' }}>{t('crm.bookings.detail.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="reservationCard" />
      <div className="px-scope">
        <div className="bk-det-head">
          <div>
            <div className="idline">
              {t('crm.bookings.detail.idLine', {
                id: reservation.id.slice(0, 8),
                date: new Date(reservation.createdAt).toLocaleString(dateLocale),
                source: reservation.source,
              })}
            </div>
            <h1>{reservation.customerName || t('crm.bookings.detail.noName')}{service ? ` — ${service.name}` : ''}</h1>
            <div className="sub">
              {new Date(reservation.startAt).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })}
              {' – '}
              {new Date(reservation.endAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
              {location ? ` · ${location.name}` : ''}
              {staffProfile ? ` · ${t('crm.bookings.detail.staffPrefix', { name: staffProfile.staffUser?.fullName })}` : ''}
            </div>
          </div>
          <div className="bk-det-actions">
            <span className={`bk-badge ${reservation.status}`} style={{ fontSize: 12, padding: '5px 12px' }}>
              {statusLabel(reservation.status)}
            </span>
            <button className="btn btn-sm" onClick={() => setEditOpen(true)}>
              <Ic d={BK_ICON.edit} size={13} /> {t('crm.bookings.detail.edit')}
            </button>
            {reservation.status === 'pending' && (
              <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={() => runAction(confirmReservation)}>
                <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.detail.confirm')}
              </button>
            )}
            {reservation.status === 'confirmed' && (
              <button className="btn btn-sm" disabled={actionLoading} onClick={() => runAction(checkInReservation)}>
                {t('crm.bookings.detail.checkIn')}
              </button>
            )}
            {reservation.status === 'checked_in' && (
              <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={() => runAction(completeReservation)}>
                <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.detail.complete')}
              </button>
            )}
            {['pending', 'confirmed'].includes(reservation.status) && (
              <>
                <button className="btn btn-sm" style={{ color: '#cc2f47', borderColor: '#f0c8cf' }} disabled={actionLoading} onClick={() => runAction(markReservationNoShow)}>
                  {t('crm.bookings.detail.noShow')}
                </button>
                <button className="btn btn-sm" style={{ color: '#cc2f47', borderColor: '#f0c8cf' }} disabled={actionLoading} onClick={() => runAction(cancelReservation)}>
                  <Ic d={BK_ICON.x} size={13} /> {t('crm.bookings.detail.cancel')}
                </button>
              </>
            )}
            {reservation.status === 'pending' && (
              <button className="btn btn-sm" style={{ color: '#cc2f47', borderColor: '#f0c8cf' }} disabled={actionLoading} onClick={() => runAction(rejectReservation)}>
                {t('crm.bookings.detail.reject')}
              </button>
            )}
          </div>
        </div>

        <div className="bk-tabs">
          {TAB_KEYS.map((k) => (
            <div key={k} className={`bk-tab${k === tab ? ' active' : ''}`} onClick={() => setTab(k)}>{t(`crm.bookings.detail.tabs.${k}`)}</div>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="bk-grid2">
            <div className="bk-panel">
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.detail.overviewTab.detailsTitle')}</div></div>
              <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                <div className="bk-info-row"><span className="l">{t('crm.bookings.detail.overviewTab.service')}</span><span className="v">{service?.name || '—'}</span></div>
                <div className="bk-info-row"><span className="l">{t('crm.bookings.detail.overviewTab.duration')}</span><span className="v">{service ? t('crm.bookings.detail.overviewTab.durationValue', { count: service.durationMinutes }) : '—'}</span></div>
                <div className="bk-info-row"><span className="l">{t('crm.bookings.detail.overviewTab.location')}</span><span className="v">{location?.name || '—'}</span></div>
                <div className="bk-info-row"><span className="l">{t('crm.bookings.detail.overviewTab.staff')}</span><span className="v">{staffProfile?.staffUser?.fullName || '—'}</span></div>
                <div className="bk-info-row"><span className="l">{t('crm.bookings.detail.overviewTab.participants')}</span><span className="v">{reservation.participants}</span></div>
                <div className="bk-info-row"><span className="l">{t('crm.bookings.detail.overviewTab.price')}</span><span className="v">{reservation.price ? `${reservation.price} ${reservation.currency}` : '—'}</span></div>
                <div className="bk-info-row"><span className="l">{t('crm.bookings.detail.overviewTab.paymentStatus')}</span><span className="v">{paymentStatusLabel(reservation.paymentStatus)}</span></div>
                <div className="bk-info-row"><span className="l">{t('crm.bookings.detail.overviewTab.source')}</span><span className="v">{reservation.source}</span></div>
              </div>
            </div>

            <div>
              <div className="bk-panel" style={{ marginBottom: 16 }}>
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.detail.overviewTab.clientTitle')}</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  <div className="bk-cust-card" style={{ border: 0, padding: 0, margin: 0 }}>
                    <div className="bk-cust-ava">{(reservation.customerName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                    <div>
                      <div className="n">{reservation.customerName || t('crm.bookings.detail.noName')}</div>
                      <div className="c">{reservation.customerPhone} {reservation.customerEmail ? `· ${reservation.customerEmail}` : ''}</div>
                    </div>
                  </div>
                </div>
              </div>

              {reservation.leadId && (
                <div className="bk-panel">
                  <div className="bk-panel-head">
                    <div className="t">{t('crm.bookings.detail.overviewTab.linkedLeadTitle')}</div>
                    <button className="link" onClick={() => navigate(`/leads/${reservation.leadId}`)}>{t('crm.bookings.detail.overviewTab.openLead')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'client' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">{t('crm.bookings.detail.clientTab.profileTitle')}</div></div>
            <div className="bk-panel-body" style={{ padding: 18 }}>
              <div className="bk-cust-card">
                <div className="bk-cust-ava">{(reservation.customerName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                <div>
                  <div className="n">{reservation.customerName || t('crm.bookings.detail.noName')}</div>
                  <div className="c">{reservation.customerPhone} {reservation.customerEmail ? `· ${reservation.customerEmail}` : ''}</div>
                  {customerStats?.tags && customerStats.tags.length > 0 && (
                    <div className="bk-cust-tags">{customerStats.tags.map((tg) => <span key={tg} className="bk-cust-tag">{tg}</span>)}</div>
                  )}
                </div>
              </div>
              <div className="bk-cust-stat" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 0 }}>
                <div><div className="v">{customerStats?.visits ?? '—'}</div><div className="l">{t('crm.bookings.detail.clientTab.visits')}</div></div>
                <div><div className="v">{customerStats?.cancellations ?? '—'}</div><div className="l">{t('crm.bookings.detail.clientTab.cancellations')}</div></div>
                <div><div className="v">{customerStats?.noShows ?? '—'}</div><div className="l">{t('crm.bookings.detail.clientTab.noShows')}</div></div>
                <div><div className="v">{customerStats ? `${customerStats.ltv} ₽` : '—'}</div><div className="l">{t('crm.bookings.detail.clientTab.turnover')}</div></div>
              </div>
              {!reservation.contactId && (
                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.bookings.detail.clientTab.noContact')}</div>
              )}
            </div>
          </div>
        )}

        {tab === 'fields' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">{t('crm.bookings.detail.fieldsTab.title')}</div></div>
            <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
              {reservation.customFields && Object.keys(reservation.customFields).length > 0 ? (
                Object.entries(reservation.customFields).map(([k, v]) => (
                  <div className="bk-info-row" key={k}><span className="l">{k}</span><span className="v">{String(v)}</span></div>
                ))
              ) : (
                <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.detail.fieldsTab.empty')}</div>
              )}
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">{t('crm.bookings.detail.activityTab.title')}</div></div>
            <div className="bk-panel-body" style={{ padding: 18 }}>
              <div className="bk-timeline">
                {activity.map((a) => (
                  <div key={a.id} className="bk-tl-item">
                    <div className="t">{ACTIVITY_TYPE_KEYS.includes(a.type) ? t(`crm.bookings.detail.activityTab.types.${a.type}`) : a.type}</div>
                    {a.description && <div className="d">{a.description}</div>}
                    <div className="when">{new Date(a.createdAt).toLocaleString(dateLocale)}{a.user ? ` · ${a.user.fullName}` : ''}</div>
                  </div>
                ))}
                {activity.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.detail.activityTab.empty')}</div>}
              </div>
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">{t('crm.bookings.detail.notesTab.title')}</div></div>
            <div className="bk-panel-body" style={{ padding: 18 }}>
              {notesLoading && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('crm.bookings.detail.notesTab.loading')}</div>}
              {!notesLoading && notes.length === 0 && (
                <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5, marginBottom: 12 }}>{t('crm.bookings.detail.notesTab.empty')}</div>
              )}
              {notes.map((n) => (
                <div key={n.id} className="bk-note">
                  <div className="hd"><b>{n.createdBy || t('crm.bookings.detail.notesTab.you')}</b> · {new Date(n.createdAt).toLocaleString(dateLocale)}
                    <button onClick={() => removeNote(n.id)} style={{ float: 'right', background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer' }}>
                      <Ic d={BK_ICON.x} size={12} />
                    </button>
                  </div>
                  <div className="body">{n.content}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t('crm.bookings.detail.notesTab.addPlaceholder')} style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
                <button className="btn btn-primary btn-sm" onClick={addNote}>{t('crm.bookings.detail.notesTab.add')}</button>
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
