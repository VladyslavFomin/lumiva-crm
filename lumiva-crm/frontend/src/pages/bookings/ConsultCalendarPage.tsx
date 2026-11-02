import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingLocations,
  fetchBookingServices,
  fetchBookingStaff,
  fetchReservations,
  createReservation,
  confirmReservation,
  checkInReservation,
  completeReservation,
  markReservationNoShow,
  cancelReservation,
  fetchReservation,
  type BookingLocation,
  type BookingServiceItem,
  type BookingStaffProfile,
  type Reservation,
} from '../../api/bookings';
import { fetchFollowUps, fetchVerticalSettings } from '../../api/bookingVerticals';
import { useBookingVertical } from './useBookingVertical';
import { ConsultSessionPanel, ReservationOrdersPanel } from './verticalPanels';
import { BkDrawer, BkModal, EmptyState, errMsg, fmtDate, fmtTime, useDateLocale, ymdLocal, addDays, startOfWeek } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

const SLOT = 30; // мин
const DAY_START = 8 * 60;
const DAY_END = 21 * 60;
const ROW_H = 26;
const WD_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const CLOSED = ['cancelled_by_customer', 'cancelled_by_business', 'rejected'];

type NewForm = { staffUserId: string; serviceId: string; date: string; time: string; name: string; phone: string; email: string; format: 'offline' | 'online' | 'phone'; usePass: boolean };

export const ConsultCalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const locale = useDateLocale();
  const { terms } = useBookingVertical();
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [day, setDay] = useState(new Date());
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [staffId, setStaffId] = useState('');
  const [items, setItems] = useState<Reservation[]>([]);
  const [followUps, setFollowUps] = useState<Reservation[]>([]);
  const [open, setOpen] = useState<Reservation | null>(null);
  const [form, setForm] = useState<NewForm | null>(null);
  const [defaultFormat, setDefaultFormat] = useState<'offline' | 'online' | 'phone'>('offline');
  const [busy, setBusy] = useState(false);

  const specialists = useMemo(() => staff.filter((s) => s.availableForBooking), [staff]);
  const range = useMemo(() => {
    if (mode === 'day') {
      const a = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      return { from: a, to: addDays(a, 1), days: [a] };
    }
    const a = startOfWeek(day);
    return { from: a, to: addDays(a, 7), days: Array.from({ length: 7 }, (_, i) => addDays(a, i)) };
  }, [mode, day]);

  const load = () =>
    fetchReservations({ from: range.from.toISOString(), to: range.to.toISOString(), staffUserId: mode === 'week' && staffId ? staffId : undefined })
      .then((rows) => setItems(rows.filter((r) => !CLOSED.includes(r.status))))
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  useEffect(() => {
    fetchBookingStaff().then((s) => { setStaff(s); setStaffId((c) => c || s.find((x) => x.availableForBooking)?.staffUserId || ''); }).catch(() => undefined);
    fetchBookingServices().then(setServices).catch(() => undefined);
    fetchBookingLocations().then(setLocations).catch(() => undefined);
    fetchFollowUps(14).then(setFollowUps).catch(() => undefined);
    fetchVerticalSettings().then((s) => setDefaultFormat(s.defaultMeetingFormat)).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
  }, [range, staffId]); // eslint-disable-line react-hooks/exhaustive-deps

  // колонки: день → специалисты; неделя → дни выбранного специалиста
  const columns = mode === 'day'
    ? specialists.map((s) => ({ key: s.staffUserId, title: s.staffUser?.fullName || '—', sub: '', staffUserId: s.staffUserId, date: range.days[0] }))
    : range.days.map((d) => ({ key: ymdLocal(d), title: d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }), sub: '', staffUserId: staffId, date: d }));

  const rows = useMemo(() => {
    const out: number[] = [];
    for (let m = DAY_START; m < DAY_END; m += SLOT) out.push(m);
    return out;
  }, []);

  const isOff = (staffUserId: string, date: Date, minute: number) => {
    const prof = staff.find((s) => s.staffUserId === staffUserId);
    const wk = prof?.weeklyAvailability;
    if (!wk || !Object.keys(wk).length) return false;
    const periods = wk[WD_KEYS[date.getDay()]] || [];
    const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    if (prof?.timeOff?.some((o) => ymdLocal(date) >= o.from.slice(0, 10) && ymdLocal(date) <= o.to.slice(0, 10))) return true;
    return !periods.some((p) => minute >= hm(p.start) && minute + SLOT <= hm(p.end));
  };

  const eventsFor = (col: (typeof columns)[number]) =>
    items.filter((r) => r.staffUserId === col.staffUserId && ymdLocal(new Date(r.startAt)) === ymdLocal(col.date));

  const startNew = (staffUserId: string, date: Date, minute?: number, prefill?: Partial<NewForm>) => {
    const svc = services.find((s) => s.active && (!s.staffUserIds?.length || s.staffUserIds.includes(staffUserId))) || services[0];
    const m = minute ?? 10 * 60;
    setForm({
      staffUserId,
      serviceId: svc?.id || '',
      date: ymdLocal(date),
      time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      name: '',
      phone: '',
      email: '',
      format: defaultFormat,
      usePass: true,
      ...prefill,
    });
  };

  const submit = async () => {
    if (!form) return;
    const svc = services.find((s) => s.id === form.serviceId);
    if (!form.name.trim() && !form.phone.trim() && !form.email.trim()) {
      showAlert(t('crm.bookings.v.consult.needClient'), { variant: 'error' });
      return;
    }
    if (!locations.length) {
      showAlert(t('crm.bookings.v.consult.needLocation'), { variant: 'error' });
      return;
    }
    const start = new Date(`${form.date}T${form.time}:00`);
    const end = new Date(start.getTime() + (svc?.durationMinutes || 60) * 60_000);
    setBusy(true);
    try {
      const r = await createReservation({
        locationId: locations[0]?.id || '',
        serviceId: form.serviceId || undefined,
        staffUserId: form.staffUserId || undefined,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        customerName: form.name.trim() || undefined,
        customerPhone: form.phone.trim() || undefined,
        customerEmail: form.email.trim() || undefined,
        price: svc?.price,
        source: 'manual',
        meetingFormat: form.format,
        usePass: form.usePass,
      });
      setForm(null);
      showAlert(r.passId ? t('crm.bookings.v.consult.createdWithPass') : t('crm.bookings.v.consult.created'), { variant: 'success' });
      load();
      fetchFollowUps(14).then(setFollowUps).catch(() => undefined);
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const status = async (fn: (id: string) => Promise<Reservation>, ok: string) => {
    if (!open) return;
    setBusy(true);
    try {
      const r = await fn(open.id);
      setOpen(r);
      showAlert(ok, { variant: 'success' });
      load();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const svcName = (id: string | null) => services.find((s) => s.id === id)?.name || '';
  const staffName = (id: string | null) => staff.find((s) => s.staffUserId === id)?.staffUser?.fullName || '—';
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const title = mode === 'day' ? day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) : `${range.days[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${range.days[6].toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="calendar" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.v.consult.kicker')}</div>
            <h1>{t('crm.bookings.v.consult.title')}</h1>
            <p className="sub">{t('crm.bookings.v.consult.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" disabled={!specialists.length} onClick={() => startNew(mode === 'week' ? staffId : specialists[0]?.staffUserId || '', day)}>
              <Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.consult.newSession')}
            </button>
          </div>
        </div>

        <div className="fl-toolbar">
          <div className="bk-seg">
            <button className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>{t('crm.bookings.v.consult.day')}</button>
            <button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>{t('crm.bookings.v.consult.week')}</button>
          </div>
          <div className="bk-seg">
            <button onClick={() => setDay(addDays(day, mode === 'day' ? -1 : -7))}>←</button>
            <button onClick={() => setDay(new Date())}>{t('crm.bookings.v.common.today')}</button>
            <button onClick={() => setDay(addDays(day, mode === 'day' ? 1 : 7))}>→</button>
          </div>
          <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' }}>{title}</span>
          <div style={{ flex: 1 }} />
          {mode === 'week' && (
            <select className="bk-select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {specialists.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
            </select>
          )}
        </div>

        {!specialists.length ? (
          <div className="bk-panel"><EmptyState title={t('crm.bookings.v.consult.noSpecialists', { label: terms.staffPlural })} text={t('crm.bookings.v.consult.noSpecialistsText')} action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/bookings/availability')}>{t('crm.bookings.v.consult.toAvailability')}</button>} /></div>
        ) : (
          <div className="fl-layout">
            <div className="cc-wrap" style={{ maxHeight: '74vh' }}>
              <div className="cc-grid" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(150px, 1fr))` }}>
                <div className="cc-hd" />
                {columns.map((c) => <div key={c.key} className="cc-hd">{c.title}<div className="s">{t('crm.bookings.v.consult.sessionsN', { count: eventsFor(c).length })}</div></div>)}
                <div>
                  {rows.map((m) => <div key={m} className="cc-time" style={{ height: ROW_H }}>{m % 60 === 0 ? `${String(m / 60).padStart(2, '0')}:00` : ''}</div>)}
                </div>
                {columns.map((c) => (
                  <div key={c.key} className="cc-col">
                    {rows.map((m) => {
                      const off = isOff(c.staffUserId, c.date, m);
                      return <div key={m} className={`cc-slot${off ? ' off' : ''}`} style={{ height: ROW_H }} title={off ? t('crm.bookings.v.consult.offHours') : undefined} onClick={() => !off && startNew(c.staffUserId, c.date, m)} />;
                    })}
                    {ymdLocal(c.date) === ymdLocal(now) && nowMin >= DAY_START && nowMin <= DAY_END && <div className="cc-now" style={{ top: ((nowMin - DAY_START) / SLOT) * ROW_H }} />}
                    {eventsFor(c).map((r) => {
                      const s = new Date(r.startAt);
                      const e = new Date(r.endAt);
                      const top = ((s.getHours() * 60 + s.getMinutes() - DAY_START) / SLOT) * ROW_H;
                      const h = Math.max(ROW_H - 2, ((e.getTime() - s.getTime()) / 60000 / SLOT) * ROW_H - 2);
                      return (
                        <div key={r.id} className={`cc-ev${r.meetingFormat === 'online' ? ' online' : ''}${r.status === 'pending' ? ' pending' : ''}${r.status === 'completed' ? ' completed' : ''}`} style={{ top: Math.max(0, top), height: h }} onClick={() => fetchReservation(r.id).then(setOpen).catch(() => setOpen(r))}>
                          <div className="t">{fmtTime(r.startAt, locale)}–{fmtTime(r.endAt, locale)}{r.meetingFormat === 'online' ? ' · online' : r.meetingFormat === 'phone' ? ' · ☎' : ''}</div>
                          <div className="n">{r.customerName || r.customerPhone || '—'}</div>
                          {h > 40 && <div className="t">{svcName(r.serviceId)}</div>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="fl-side">
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.consult.followUps')}</div><span className="bk-hint">{followUps.length}</span></div>
                <div className="bk-panel-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {followUps.length === 0 && <div className="bk-hint" style={{ padding: '10px 18px' }}>{t('crm.bookings.v.consult.noFollowUps')}</div>}
                  {followUps.map((r) => (
                    <div key={r.id} className="dk-row">
                      <div>
                        <div className="n">{r.customerName || r.customerPhone || '—'}</div>
                        <div className="s">{t('crm.bookings.v.consult.dueOn', { date: fmtDate(r.followUpAt!, locale) })} · {staffName(r.staffUserId)}</div>
                      </div>
                      <button className="btn btn-sm" onClick={() => startNew(r.staffUserId || specialists[0]?.staffUserId || '', new Date(r.followUpAt!), undefined, { name: r.customerName || '', phone: r.customerPhone || '', email: r.customerEmail || '', serviceId: r.serviceId || '', format: r.meetingFormat || defaultFormat })}>{t('crm.bookings.v.consult.book')}</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <BkDrawer
        open={!!open}
        width={500}
        kicker={open ? `${fmtDate(open.startAt, locale, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(open.startAt, locale)}–${fmtTime(open.endAt, locale)}` : ''}
        title={open?.customerName || open?.customerPhone || '—'}
        onClose={() => setOpen(null)}
        footer={
          open && (
            <>
              {open.status === 'pending' && <button className="btn btn-sm" disabled={busy} onClick={() => status(confirmReservation, t('crm.bookings.v.consult.confirmed'))}>{t('crm.bookings.v.consult.confirm')}</button>}
              {(open.status === 'pending' || open.status === 'confirmed') && <button className="btn btn-sm" disabled={busy} onClick={() => status(checkInReservation, t('crm.bookings.v.consult.started'))}>{t('crm.bookings.v.consult.start')}</button>}
              {(open.status === 'checked_in' || open.status === 'in_progress' || open.status === 'confirmed') && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => status(completeReservation, t('crm.bookings.v.consult.completed'))}>{t('crm.bookings.v.consult.complete')}</button>}
              {(open.status === 'pending' || open.status === 'confirmed') && <button className="btn btn-sm" disabled={busy} onClick={() => status(markReservationNoShow, t('crm.bookings.v.consult.noShowDone'))}>{t('crm.bookings.v.consult.noShow')}</button>}
              {!['completed', 'no_show', ...CLOSED].includes(open.status) && <button className="btn btn-sm btn-danger" disabled={busy} onClick={async () => { if (await showConfirm(t('crm.bookings.v.consult.cancelConfirm'), { danger: true })) status(cancelReservation, t('crm.bookings.v.consult.cancelled')); }}>{t('crm.bookings.v.common.cancelAction')}</button>}
              <button className="btn btn-sm" onClick={() => navigate(`/bookings/reservations/${open.id}`)}>{t('crm.bookings.v.consult.openCard')}</button>
            </>
          )
        }
      >
        {open && (
          <>
            <div className="bk-info-row"><span className="l">{terms.service}</span><span className="v">{svcName(open.serviceId) || '—'}</span></div>
            <div className="bk-info-row"><span className="l">{terms.staff}</span><span className="v">{staffName(open.staffUserId)}</span></div>
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.common.status')}</span><span className="v"><span className={`bk-badge ${open.status}`}>{t(`crm.bookings.status.${open.status}`)}</span></span></div>
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.common.phone')}</span><span className="v">{open.customerPhone || '—'}</span></div>
            {open.passId && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.consult.package')}</span><span className="v">{open.passVisitCharged ? t('crm.bookings.v.consult.charged') : t('crm.bookings.v.consult.willCharge')}</span></div>}
            <div style={{ marginTop: 14 }}>
              <ConsultSessionPanel reservation={open} onChanged={(r) => { setOpen(r); load(); fetchFollowUps(14).then(setFollowUps).catch(() => undefined); }} onBookFollowUp={(date) => startNew(open.staffUserId || '', new Date(`${date}T10:00:00`), undefined, { name: open.customerName || '', phone: open.customerPhone || '', email: open.customerEmail || '', serviceId: open.serviceId || '', format: open.meetingFormat || defaultFormat })} />
            </div>
            <div style={{ marginTop: 12 }}><ReservationOrdersPanel reservation={open} /></div>
          </>
        )}
      </BkDrawer>

      <BkModal open={!!form} title={t('crm.bookings.v.consult.newSession')} onClose={() => setForm(null)}
        footer={<><button className="btn btn-sm" onClick={() => setForm(null)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={submit}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.v.consult.create')}</button></>}>
        {form && (
          <>
            <div className="bk-row2">
              <div className="bk-field"><label>{terms.staff}</label>
                <select value={form.staffUserId} onChange={(e) => setForm({ ...form, staffUserId: e.target.value })}>
                  {specialists.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
                </select>
              </div>
              <div className="bk-field"><label>{terms.service}</label>
                <select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
                  <option value="">—</option>
                  {services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes}′</option>)}
                </select>
              </div>
            </div>
            <div className="bk-row2">
              <div className="bk-field"><label>{t('crm.bookings.v.rbook.date')}</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.rbook.time')}</label><input type="time" step={900} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
            </div>
            <div className="bk-row2">
              <div className="bk-field"><label>{t('crm.bookings.v.common.clientName')}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.common.phone')}</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="bk-field"><label>{t('crm.bookings.v.common.email')}</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="bk-field"><label>{t('crm.bookings.v.panels.format')}</label>
              <div className="bk-seg">
                {(['offline', 'online', 'phone'] as const).map((f) => <button key={f} className={form.format === f ? 'on' : ''} onClick={() => setForm({ ...form, format: f })}>{t(`crm.bookings.v.panels.fmt.${f}`)}</button>)}
              </div>
              {form.format === 'online' && <div className="bk-hint" style={{ marginTop: 4 }}>{t('crm.bookings.v.consult.linkAuto')}</div>}
            </div>
            <label className="bk-check"><input type="checkbox" checked={form.usePass} onChange={(e) => setForm({ ...form, usePass: e.target.checked })} /> {t('crm.bookings.v.consult.usePackage')}</label>
          </>
        )}
      </BkModal>
    </MainLayout>
  );
};
