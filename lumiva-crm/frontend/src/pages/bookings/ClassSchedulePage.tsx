import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingLocations,
  fetchBookingResources,
  fetchBookingServices,
  fetchBookingStaff,
  type BookingLocation,
  type BookingResourceItem,
  type BookingServiceItem,
  type BookingStaffProfile,
} from '../../api/bookings';
import {
  fetchClassSessions,
  fetchClassRoster,
  createClassSession,
  createClassSeries,
  updateClassSession,
  cancelClassSession,
  completeClassSession,
  enrollClass,
  cancelEnrollment,
  markEnrollment,
  removeClassWaitlist,
  type ClassRoster,
  type ClassSession,
} from '../../api/bookingVerticals';
import { useBookingVertical } from './useBookingVertical';
import { BkDrawer, BkModal, EmptyState, errMsg, fmtMoney, fmtTime, useDateLocale, ymdLocal, addDays, startOfWeek } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

const WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const LEVELS = ['all', 'beginner', 'intermediate', 'advanced'];

type FormState = {
  mode: 'one' | 'series' | 'edit';
  id?: string;
  serviceId: string;
  locationId: string;
  staffUserId: string;
  resourceId: string;
  date: string;
  time: string;
  duration: string;
  capacity: string;
  price: string;
  level: string;
  notes: string;
  days: string[];
  weeks: string;
  scope: 'one' | 'future';
  seriesId?: string | null;
};

export const ClassSchedulePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const locale = useDateLocale();
  const { terms } = useBookingVertical();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [fService, setFService] = useState('');
  const [fStaff, setFStaff] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [enroll, setEnroll] = useState({ name: '', phone: '', email: '', usePass: true, waitlist: true });
  const [busy, setBusy] = useState(false);

  const from = weekStart;
  const to = addDays(weekStart, 7);

  const load = () =>
    fetchClassSessions({ from: from.toISOString(), to: to.toISOString(), serviceId: fService || undefined, staffUserId: fStaff || undefined, locationId: fLocation || undefined, includeCancelled: showCancelled })
      .then(setSessions)
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  useEffect(() => {
    load();
  }, [weekStart, fService, fStaff, fLocation, showCancelled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchBookingServices().then(setServices).catch(() => undefined);
    fetchBookingStaff().then(setStaff).catch(() => undefined);
    fetchBookingResources().then(setResources).catch(() => undefined);
    fetchBookingLocations().then(setLocations).catch(() => undefined);
  }, []);

  const svc = (id: string) => services.find((s) => s.id === id);
  const staffName = (id: string | null) => (id ? staff.find((s) => s.staffUserId === id)?.staffUser?.fullName || '—' : '—');
  const resName = (id: string | null) => (id ? resources.find((r) => r.id === id)?.name || '' : '');

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = (d: Date) => sessions.filter((s) => ymdLocal(new Date(s.startAt)) === ymdLocal(d)).sort((a, b) => a.startAt.localeCompare(b.startAt));

  const openCreate = (mode: 'one' | 'series', date?: Date) => {
    const s = services.find((x) => x.active) || services[0];
    const d = date || new Date();
    setForm({
      mode,
      serviceId: s?.id || '',
      locationId: locations[0]?.id || '',
      staffUserId: '',
      resourceId: '',
      date: ymdLocal(d),
      time: '19:00',
      duration: String(s?.durationMinutes || 60),
      capacity: String(s?.capacityMax || 10),
      price: '',
      level: 'all',
      notes: '',
      days: [WD[(d.getDay() + 6) % 7]],
      weeks: '8',
      scope: 'one',
    });
  };

  const openEdit = (s: ClassSession) => {
    const st = new Date(s.startAt);
    setForm({
      mode: 'edit',
      id: s.id,
      serviceId: s.serviceId,
      locationId: s.locationId,
      staffUserId: s.staffUserId || '',
      resourceId: s.resourceId || '',
      date: ymdLocal(st),
      time: `${String(st.getHours()).padStart(2, '0')}:${String(st.getMinutes()).padStart(2, '0')}`,
      duration: String(Math.round((new Date(s.endAt).getTime() - st.getTime()) / 60000)),
      capacity: String(s.capacity),
      price: s.price ?? '',
      level: s.level || 'all',
      notes: s.notes || '',
      days: [],
      weeks: '1',
      scope: 'one',
      seriesId: s.seriesId,
    });
  };

  const submitForm = async () => {
    if (!form) return;
    if (!form.serviceId || !form.locationId) {
      showAlert(t('crm.bookings.v.classes.needService'), { variant: 'error' });
      return;
    }
    const base = {
      serviceId: form.serviceId,
      locationId: form.locationId,
      staffUserId: form.staffUserId || null,
      resourceId: form.resourceId || null,
      durationMinutes: Number(form.duration) || 60,
      capacity: Number(form.capacity) || 1,
      price: form.price === '' ? null : form.price,
      level: form.level === 'all' ? null : form.level,
      notes: form.notes || null,
    };
    setBusy(true);
    try {
      if (form.mode === 'series') {
        if (!form.days.length) throw new Error(t('crm.bookings.v.classes.needDays'));
        const r = await createClassSeries({ ...base, days: form.days, time: form.time, fromDate: form.date, weeks: Number(form.weeks) || 4 });
        showAlert(t('crm.bookings.v.classes.seriesCreated', { count: r.created }), { variant: 'success' });
        if (r.skipped.length) showAlert(t('crm.bookings.v.classes.seriesSkipped', { count: r.skipped.length, list: r.skipped.slice(0, 5).map((x) => `${x.date}: ${x.reason}`).join('\n') }), { variant: 'info' });
      } else if (form.mode === 'one') {
        await createClassSession({ ...base, startAt: new Date(`${form.date}T${form.time}:00`).toISOString() });
        showAlert(t('crm.bookings.v.classes.created'), { variant: 'success' });
      } else if (form.id) {
        const r = await updateClassSession(form.id, { ...base, startAt: new Date(`${form.date}T${form.time}:00`).toISOString(), scope: form.scope });
        if (r.errors.length) showAlert(r.errors.join('\n'), { variant: 'error' });
        else showAlert(t('crm.bookings.v.classes.updated', { count: r.updated }), { variant: 'success' });
        if (roster?.session.id === form.id) openRoster(form.id);
      }
      setForm(null);
      load();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const openRoster = (id: string) =>
    fetchClassRoster(id)
      .then((r) => {
        setRoster(r);
        setEnroll({ name: '', phone: '', email: '', usePass: true, waitlist: true });
      })
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  const rosterAct = async (fn: () => Promise<unknown>, ok?: string) => {
    if (!roster) return;
    setBusy(true);
    try {
      await fn();
      if (ok) showAlert(ok, { variant: 'success' });
      await openRoster(roster.session.id);
      load();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const doEnroll = () => {
    if (!roster) return;
    if (!enroll.name.trim() && !enroll.phone.trim()) {
      showAlert(t('crm.bookings.v.classes.needClient'), { variant: 'error' });
      return;
    }
    rosterAct(async () => {
      const r = await enrollClass(roster.session.id, { customerName: enroll.name.trim() || undefined, customerPhone: enroll.phone.trim() || undefined, customerEmail: enroll.email.trim() || undefined, usePass: enroll.usePass, waitlistIfFull: enroll.waitlist });
      showAlert(r.waitlisted ? t('crm.bookings.v.classes.waitlisted') : t('crm.bookings.v.classes.enrolled'), { variant: 'success' });
    });
  };

  const cancelSessionAsk = async (s: ClassSession) => {
    const scope = s.seriesId && (await showConfirm(t('crm.bookings.v.classes.cancelSeriesAsk'), { confirmLabel: t('crm.bookings.v.classes.scopeFuture'), cancelLabel: t('crm.bookings.v.classes.scopeOne') })) ? 'future' : 'one';
    if (!(await showConfirm(t('crm.bookings.v.classes.cancelConfirm', { count: s.booked }), { danger: true }))) return;
    rosterAct(async () => {
      const r = await cancelClassSession(s.id, scope);
      showAlert(t('crm.bookings.v.classes.cancelled', { sessions: r.cancelledSessions, bookings: r.cancelledBookings }), { variant: 'success' });
    });
  };

  const S = roster?.session;
  const active = roster?.bookings.filter((b) => !['cancelled_by_customer', 'cancelled_by_business', 'rejected'].includes(b.status)) || [];
  const cancelled = roster?.bookings.filter((b) => ['cancelled_by_customer', 'cancelled_by_business', 'rejected'].includes(b.status)) || [];
  const isToday = (d: Date) => ymdLocal(d) === ymdLocal(new Date());
  const weekLabel = `${days[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="schedule" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.v.classes.kicker')}</div>
            <h1>{t('crm.bookings.v.classes.title')}</h1>
            <p className="sub">{t('crm.bookings.v.classes.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => openCreate('one')} disabled={!services.length}><Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.classes.addOne')}</button>
            <button className="btn btn-primary btn-sm" onClick={() => openCreate('series')} disabled={!services.length}><Ic d={BK_ICON.cal} size={13} /> {t('crm.bookings.v.classes.addSeries')}</button>
          </div>
        </div>

        <div className="fl-toolbar">
          <div className="bk-seg">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))}>←</button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))}>{t('crm.bookings.v.common.thisWeek')}</button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))}>→</button>
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{weekLabel}</span>
          <div style={{ flex: 1 }} />
          <select className="bk-select" value={fService} onChange={(e) => setFService(e.target.value)}>
            <option value="">{t('crm.bookings.v.classes.allServices', { label: terms.servicePlural })}</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="bk-select" value={fStaff} onChange={(e) => setFStaff(e.target.value)}>
            <option value="">{t('crm.bookings.v.classes.allStaff', { label: terms.staffPlural })}</option>
            {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
          </select>
          {locations.length > 1 && (
            <select className="bk-select" value={fLocation} onChange={(e) => setFLocation(e.target.value)}>
              <option value="">{t('crm.bookings.v.common.allLocations')}</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <span className={`bk-chip${showCancelled ? ' on' : ''}`} onClick={() => setShowCancelled((v) => !v)}>{t('crm.bookings.v.classes.showCancelled')}</span>
        </div>

        {!services.length ? (
          <div className="bk-panel"><EmptyState title={t('crm.bookings.v.classes.noServices', { label: terms.servicePlural })} text={t('crm.bookings.v.classes.noServicesText')} action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/bookings/services')}>{t('crm.bookings.v.classes.toServices', { label: terms.servicePlural })}</button>} /></div>
        ) : (
          <div className="sc-week">
            {days.map((d) => (
              <div key={d.toISOString()} className={`sc-day${isToday(d) ? ' today' : ''}`}>
                <div className="sc-day-h"><span className="d">{d.getDate()}</span><span className="w">{d.toLocaleDateString(locale, { weekday: 'short' })}</span></div>
                <div className="sc-day-b">
                  {byDay(d).map((s) => {
                    const sv = svc(s.serviceId);
                    const pct = s.capacity ? Math.min(100, (s.booked / s.capacity) * 100) : 0;
                    return (
                      <button key={s.id} className={`sc-class ${s.status}`} style={{ borderLeftColor: sv?.color || 'var(--ink)' }} onClick={() => openRoster(s.id)}>
                        <div className="tm">{fmtTime(s.startAt, locale)}–{fmtTime(s.endAt, locale)}</div>
                        <div className="nm">{sv?.name || '—'}</div>
                        <div className="mt">{staffName(s.staffUserId)}{s.resourceId ? ` · ${resName(s.resourceId)}` : ''}</div>
                        <div className="mt">{s.booked}/{s.capacity}{s.waitlist ? ` · ${t('crm.bookings.v.classes.wl', { count: s.waitlist })}` : ''}{s.level ? ` · ${t(`crm.bookings.v.classes.level.${s.level}`)}` : ''}</div>
                        <div className="sc-fill"><i className={pct >= 100 ? 'full' : pct >= 75 ? 'mid' : ''} style={{ width: `${pct}%` }} /></div>
                      </button>
                    );
                  })}
                  <button className="sc-add" onClick={() => openCreate('one', d)}>+ {t('crm.bookings.v.classes.addShort')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ростер занятия */}
      <BkDrawer
        open={!!roster}
        width={480}
        kicker={S ? `${new Date(S.startAt).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmtTime(S.startAt, locale)}` : ''}
        title={S ? svc(S.serviceId)?.name || '—' : ''}
        onClose={() => setRoster(null)}
        footer={
          S && S.status === 'scheduled' && (
            <>
              <button className="btn btn-sm" onClick={() => openEdit(S)}><Ic d={BK_ICON.edit} size={12} /> {t('crm.bookings.v.common.edit')}</button>
              <button className="btn btn-sm" disabled={busy} onClick={async () => { if (await showConfirm(t('crm.bookings.v.classes.completeConfirm'))) rosterAct(async () => { const r = await completeClassSession(S.id); showAlert(t('crm.bookings.v.classes.completed', { attended: r.attended, noShow: r.noShow }), { variant: 'success' }); }); }}>{t('crm.bookings.v.classes.complete')}</button>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => cancelSessionAsk(S)}>{t('crm.bookings.v.classes.cancelSession')}</button>
            </>
          )
        }
      >
        {S && roster && (
          <>
            <div className="bk-mini-kpis" style={{ margin: '0 0 12px', gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div className="bk-mini-kpi"><div className="l">{t('crm.bookings.v.classes.booked')}</div><div className="v">{S.booked}/{S.capacity}</div></div>
              <div className="bk-mini-kpi"><div className="l">{t('crm.bookings.v.classes.attended')}</div><div className="v good">{S.attended}</div></div>
              <div className="bk-mini-kpi"><div className="l">{t('crm.bookings.v.classes.waitlistLabel')}</div><div className="v">{roster.waitlist.length}</div></div>
            </div>
            <div className="bk-info-row"><span className="l">{terms.staff}</span><span className="v">{staffName(S.staffUserId)}</span></div>
            {S.resourceId && <div className="bk-info-row"><span className="l">{terms.resource}</span><span className="v">{resName(S.resourceId)}</span></div>}
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.classes.dropIn')}</span><span className="v">{fmtMoney(S.price ?? svc(S.serviceId)?.price ?? 0, svc(S.serviceId)?.currency, locale)}</span></div>
            {S.status !== 'scheduled' && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.common.status')}</span><span className="v">{t(`crm.bookings.v.classes.status.${S.status}`)}</span></div>}
            {S.notes && <div className="bk-note" style={{ marginTop: 10 }}><div className="body">{S.notes}</div></div>}

            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: '16px 0 4px' }}>{t('crm.bookings.v.classes.participants')}</div>
            {active.length === 0 && <div className="bk-hint">{t('crm.bookings.v.classes.noParticipants')}</div>}
            {active.map((b) => {
              const attended = b.status === 'checked_in' || b.status === 'in_progress' || b.status === 'completed';
              return (
                <div key={b.id} className="ro-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="n"><a style={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/reservations/${b.id}`)}>{b.customerName || b.customerPhone || '—'}</a>{b.participants > 1 ? ` ×${b.participants}` : ''}</div>
                    <div className="s">
                      {b.customerPhone || ''}
                      {b.pass ? ` · ${t('crm.bookings.v.classes.passShort', { number: b.pass.number, left: b.pass.visitsTotal != null ? Math.max(0, b.pass.visitsTotal - b.pass.visitsUsed) : '∞' })}` : ` · ${t('crm.bookings.v.classes.dropInShort')}`}
                      {b.paymentStatus === 'unpaid' ? ` · ${t('crm.bookings.v.classes.unpaid')}` : ''}
                    </div>
                  </div>
                  {S.status !== 'cancelled' && (
                    <div className="ro-acts">
                      <button className={attended ? 'on' : ''} disabled={busy} onClick={() => rosterAct(() => markEnrollment(b.id, attended ? 'reset' : 'attended'))}>{t('crm.bookings.v.classes.markAttended')}</button>
                      <button className={b.status === 'no_show' ? 'on' : ''} disabled={busy} onClick={() => rosterAct(() => markEnrollment(b.id, b.status === 'no_show' ? 'reset' : 'no_show'))}>{t('crm.bookings.v.classes.markNoShow')}</button>
                      {S.status === 'scheduled' && !attended && b.status !== 'no_show' && (
                        <button disabled={busy} onClick={async () => { if (await showConfirm(t('crm.bookings.v.classes.cancelEnrollConfirm'))) rosterAct(async () => { const r = await cancelEnrollment(b.id); if (r.promoted) showAlert(t('crm.bookings.v.classes.promoted', { name: r.promoted.customerName || '' }), { variant: 'success' }); }); }}>×</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {roster.waitlist.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: '16px 0 4px' }}>{t('crm.bookings.v.classes.waitlistLabel')}</div>
                {roster.waitlist.map((w, i) => (
                  <div key={w.id} className="ro-row">
                    <div><div className="n">{i + 1}. {w.customerName || w.customerPhone || '—'}</div><div className="s">{w.customerPhone || ''}{w.priority !== 'normal' ? ` · ${w.priority.toUpperCase()}` : ''}</div></div>
                    <div className="ro-acts"><button disabled={busy} onClick={() => rosterAct(() => removeClassWaitlist(w.id))}>×</button></div>
                  </div>
                ))}
              </>
            )}

            {cancelled.length > 0 && <div className="bk-hint" style={{ marginTop: 10 }}>{t('crm.bookings.v.classes.cancelledCount', { count: cancelled.length })}</div>}

            {S.status === 'scheduled' && new Date(S.endAt).getTime() > Date.now() && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-3)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('crm.bookings.v.classes.enrollTitle')}</div>
                <div className="bk-row2">
                  <div className="bk-field"><label>{t('crm.bookings.v.common.clientName')}</label><input value={enroll.name} onChange={(e) => setEnroll({ ...enroll, name: e.target.value })} /></div>
                  <div className="bk-field"><label>{t('crm.bookings.v.common.phone')}</label><input value={enroll.phone} onChange={(e) => setEnroll({ ...enroll, phone: e.target.value })} /></div>
                </div>
                <div className="bk-field"><label>{t('crm.bookings.v.common.email')}</label><input value={enroll.email} onChange={(e) => setEnroll({ ...enroll, email: e.target.value })} /></div>
                <label className="bk-check"><input type="checkbox" checked={enroll.usePass} onChange={(e) => setEnroll({ ...enroll, usePass: e.target.checked })} /> {t('crm.bookings.v.classes.usePass')}</label>
                <label className="bk-check"><input type="checkbox" checked={enroll.waitlist} onChange={(e) => setEnroll({ ...enroll, waitlist: e.target.checked })} /> {t('crm.bookings.v.classes.toWaitlistIfFull')}</label>
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={doEnroll}>{S.spotsLeft > 0 ? t('crm.bookings.v.classes.enroll') : t('crm.bookings.v.classes.enrollWaitlist')}</button>
              </div>
            )}
          </>
        )}
      </BkDrawer>

      {/* создание / изменение занятия */}
      <BkModal
        open={!!form}
        title={form?.mode === 'series' ? t('crm.bookings.v.classes.addSeries') : form?.mode === 'edit' ? t('crm.bookings.v.classes.editTitle') : t('crm.bookings.v.classes.addOne')}
        onClose={() => setForm(null)}
        footer={<><button className="btn btn-sm" onClick={() => setForm(null)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={submitForm}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.v.common.save')}</button></>}
      >
        {form && (
          <>
            <div className="bk-row2">
              <div className="bk-field"><label>{terms.service}</label>
                <select value={form.serviceId} disabled={form.mode === 'edit'} onChange={(e) => { const s = svc(e.target.value); setForm({ ...form, serviceId: e.target.value, duration: String(s?.durationMinutes || form.duration), capacity: String(s?.capacityMax || form.capacity) }); }}>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="bk-field"><label>{terms.staff}</label>
                <select value={form.staffUserId} onChange={(e) => setForm({ ...form, staffUserId: e.target.value })}>
                  <option value="">—</option>
                  {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
                </select>
              </div>
            </div>
            <div className="bk-row2">
              <div className="bk-field"><label>{terms.resource}</label>
                <select value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })}>
                  <option value="">—</option>
                  {resources.filter((r) => r.active && (!form.locationId || r.locationId === form.locationId)).map((r) => <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` · ${r.capacity}` : ''}</option>)}
                </select>
              </div>
              <div className="bk-field"><label>{t('crm.bookings.v.common.location')}</label>
                <select value={form.locationId} disabled={form.mode === 'edit'} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            {form.mode === 'series' && (
              <div className="bk-field"><label>{t('crm.bookings.v.classes.days')}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {WD.map((w) => {
                    const on = form.days.includes(w);
                    return <span key={w} className={`bk-chip${on ? ' on' : ''}`} onClick={() => setForm({ ...form, days: on ? form.days.filter((x) => x !== w) : [...form.days, w] })}>{t(`crm.bookings.v.common.wd.${w}`)}</span>;
                  })}
                </div>
              </div>
            )}
            <div className="bk-row3">
              <div className="bk-field"><label>{form.mode === 'series' ? t('crm.bookings.v.classes.fromDate') : t('crm.bookings.v.rbook.date')}</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.rbook.time')}</label><input type="time" step={300} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.classes.duration')}</label><input type="number" min={10} step={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
            </div>
            <div className="bk-row3">
              <div className="bk-field"><label>{t('crm.bookings.v.classes.capacity')}</label><input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.classes.price')}</label><input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={svc(form.serviceId)?.price || ''} /></div>
              {form.mode === 'series' ? (
                <div className="bk-field"><label>{t('crm.bookings.v.classes.weeks')}</label><input type="number" min={1} max={26} value={form.weeks} onChange={(e) => setForm({ ...form, weeks: e.target.value })} /></div>
              ) : (
                <div className="bk-field"><label>{t('crm.bookings.v.classes.levelLabel')}</label>
                  <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{LEVELS.map((l) => <option key={l} value={l}>{t(`crm.bookings.v.classes.level.${l}`)}</option>)}</select>
                </div>
              )}
            </div>
            {form.mode === 'series' && (
              <div className="bk-field"><label>{t('crm.bookings.v.classes.levelLabel')}</label>
                <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{LEVELS.map((l) => <option key={l} value={l}>{t(`crm.bookings.v.classes.level.${l}`)}</option>)}</select>
              </div>
            )}
            <div className="bk-field"><label>{t('crm.bookings.v.classes.notes')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            {form.mode === 'edit' && form.seriesId && (
              <div className="bk-field"><label>{t('crm.bookings.v.classes.applyTo')}</label>
                <div className="bk-seg">
                  <button className={form.scope === 'one' ? 'on' : ''} onClick={() => setForm({ ...form, scope: 'one' })}>{t('crm.bookings.v.classes.scopeOne')}</button>
                  <button className={form.scope === 'future' ? 'on' : ''} onClick={() => setForm({ ...form, scope: 'future' })}>{t('crm.bookings.v.classes.scopeFuture')}</button>
                </div>
              </div>
            )}
            {form.mode === 'series' && <div className="bk-hint">{t('crm.bookings.v.classes.seriesHint')}</div>}
          </>
        )}
      </BkModal>
    </MainLayout>
  );
};
