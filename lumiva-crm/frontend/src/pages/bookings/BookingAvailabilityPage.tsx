import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../components/ui';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingProject,
  updateBookingProject,
  fetchBookingLocations,
  updateBookingLocation,
  addLocationClosure,
  removeLocationClosure,
  fetchBookingStaff,
  updateBookingStaffProfile,
  addStaffTimeOff,
  removeStaffTimeOff,
  fetchStaffGrid,
  inspectBookingSlot,
  reassignStaffBookings,
  fetchBookingServices,
  createReservation,
  type BookingProject,
  type BookingLocation,
  type BookingServiceItem,
  type BookingStaffProfile,
  type BookingWeeklyHours,
  type StaffGridRow,
} from '../../api/bookings';
import './bookings-design.css';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const todayIso = () => new Date().toISOString().slice(0, 10);

/* ---------- Приём заявок + отпуска сотрудников ---------- */

const ClosurePanel: React.FC<{
  project: BookingProject | null;
  staffList: BookingStaffProfile[];
  onChanged: () => void;
}> = ({ project, staffList, onChanged }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [vacationOpen, setVacationOpen] = useState(false);
  const [staffUserId, setStaffUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [toggling, setToggling] = useState(false);

  // staffList loads asynchronously after this component already mounted with an empty
  // list — pick a default only once real data arrives, and only if nothing valid is
  // selected yet (a plain useState(staffList[0]?.id) would freeze on the initial '').
  useEffect(() => {
    if (staffList.length && !staffList.some((s) => s.staffUserId === staffUserId)) {
      setStaffUserId(staffList[0].staffUserId);
    }
  }, [staffList]); // eslint-disable-line react-hooks/exhaustive-deps

  const paused = project?.status === 'paused';

  const togglePaused = async () => {
    if (!project) return;
    setToggling(true);
    try {
      await updateBookingProject({ status: paused ? 'active' : 'paused' });
      onChanged();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.closurePanel.toggleError'), { variant: 'error' });
    } finally {
      setToggling(false);
    }
  };

  const addVacation = async () => {
    if (!staffUserId || !from || !to) return;
    try {
      await addStaffTimeOff(staffUserId, { from, to, reason: reason || null });
      setFrom('');
      setTo('');
      setReason('');
      setVacationOpen(false);
      onChanged();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.closurePanel.addError'), { variant: 'error' });
    }
  };

  const removeVacation = async (sid: string, index: number) => {
    try {
      await removeStaffTimeOff(sid, index);
      onChanged();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.closurePanel.removeError'), { variant: 'error' });
    }
  };

  return (
    <div className="bk-panel" style={{ marginBottom: 16, borderColor: paused ? '#f0c8cf' : undefined }}>
      <div className="bk-panel-head">
        <div className="t">{t('crm.bookings.availability.closurePanel.title')}</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <span style={{ color: paused ? '#9a1f31' : '#175c3d', fontWeight: 600 }}>
            {paused ? t('crm.bookings.availability.closurePanel.paused') : t('crm.bookings.availability.closurePanel.open')}
          </span>
          <span
            onClick={togglePaused}
            style={{
              position: 'relative', width: 38, height: 22, borderRadius: 12,
              background: paused ? '#cc2f47' : '#1f8a5e', transition: 'background .15s',
              opacity: toggling ? 0.6 : 1, cursor: 'pointer',
            }}
          >
            <span style={{ position: 'absolute', top: 2, left: paused ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </span>
        </label>
      </div>
      <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
        {paused && (
          <div style={{ padding: '10px 12px', background: '#fbecef', borderRadius: 10, fontSize: 11.5, color: '#9a1f31', marginBottom: 14 }}>
            {t('crm.bookings.availability.closurePanel.pausedNotice')}
          </div>
        )}
        <button className="btn btn-sm" onClick={() => setVacationOpen(true)}>
          <Ic d={BK_ICON.users} size={12} /> {t('crm.bookings.availability.closurePanel.vacationBtn')}
        </button>

        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: '16px 0 8px' }}>
          {t('crm.bookings.availability.closurePanel.vacationsTitle')}
        </div>
        {staffList.flatMap((s) => (s.timeOff || []).map((t2, idx) => ({ s, t: t2, idx }))).length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{t('crm.bookings.availability.closurePanel.vacationsEmpty')}</div>
        )}
        {staffList.map((s) =>
          (s.timeOff || []).map((to2, idx) => (
            <div key={`${s.staffUserId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-3)', fontSize: 12.5 }}>
              <span><strong style={{ fontWeight: 500 }}>{s.staffUser?.fullName}</strong> <span style={{ color: 'var(--fg-3)' }}>— {to2.from} – {to2.to}{to2.reason ? ` · ${to2.reason}` : ''}</span></span>
              <button onClick={() => removeVacation(s.staffUserId, idx)} style={{ background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer' }}>
                <Ic d={BK_ICON.x} size={12} />
              </button>
            </div>
          )),
        )}
      </div>

      {vacationOpen && (
        <div className="px-scope">
          <div className="bk-modal-back" onClick={() => setVacationOpen(false)} />
          <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, calc(100vw - 32px))' }}>
            <h3>{t('crm.bookings.availability.closurePanel.modal.title')}</h3>
            <div className="bk-field">
              <label>{t('crm.bookings.availability.closurePanel.modal.staffLabel')}</label>
              <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
                {staffList.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="bk-field"><label>{t('crm.bookings.availability.closurePanel.modal.fromLabel')}</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="bk-field"><label>{t('crm.bookings.availability.closurePanel.modal.toLabel')}</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="bk-field"><label>{t('crm.bookings.availability.closurePanel.modal.reasonLabel')}</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('crm.bookings.availability.closurePanel.modal.reasonPlaceholder')} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
              <button className="btn btn-sm" onClick={() => setVacationOpen(false)}>{t('crm.bookings.availability.closurePanel.modal.cancel')}</button>
              <button className="btn btn-primary btn-sm" onClick={addVacation}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.availability.closurePanel.modal.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Кто свободен ---------- */

const StaffFreeGrid: React.FC<{
  grid: StaffGridRow[];
  date: string;
  onDateChange: (d: string) => void;
  onSlotClick: (staffUserId: string, staffName: string, hour: number) => void;
}> = ({ grid, date, onDateChange, onSlotClick }) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const [hover, setHover] = useState<{ x: number; y: number; row: string; hour: number; slot: StaffGridRow['slots'][number] } | null>(null);

  return (
    <div className="bk-panel" style={{ marginBottom: 16 }}>
      <div className="bk-panel-head">
        <div className="t">{t('crm.bookings.availability.freeGrid.title', { date: new Date(date).toLocaleDateString(dateLocale) })}</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-3)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#c9ead6', display: 'inline-block' }} />{t('crm.bookings.availability.freeGrid.free')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-3)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#f6c9d1', display: 'inline-block' }} />{t('crm.bookings.availability.freeGrid.busy')}</span>
          <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />
        </div>
      </div>
      <div className="bk-panel-body" style={{ padding: '12px 18px 16px', overflowX: 'auto', position: 'relative' }}>
        {grid.length === 0 ? (
          <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.availability.freeGrid.empty')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `90px repeat(${grid[0].slots.length},1fr)`, gap: 4, minWidth: 640 }}>
            <span />
            {grid[0].slots.map((s) => <span key={s.hour} style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'var(--fg-3)', textAlign: 'center' }}>{s.hour}:00</span>)}
            {grid.map((row) => (
              <React.Fragment key={row.staffUserId}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', display: 'flex', alignItems: 'center' }}>{row.name}</span>
                {row.slots.map((slot) => (
                  <span
                    key={slot.hour}
                    onMouseEnter={(e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setHover({ x: r.left + r.width / 2, y: r.bottom + 6, row: row.name, hour: slot.hour, slot });
                    }}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      if (!slot.busy) onSlotClick(row.staffUserId, row.name, slot.hour);
                    }}
                    style={{ aspectRatio: '1/1', borderRadius: 5, background: slot.busy ? '#f6c9d1' : '#c9ead6', cursor: slot.busy ? 'default' : 'pointer' }}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
        {hover && (
          <div style={{ position: 'fixed', left: hover.x, top: hover.y, transform: 'translateX(-50%)', zIndex: 70, background: '#fff', border: '1px solid var(--line-2)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.14)', padding: '10px 12px', minWidth: 190, pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'var(--fg-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{hover.row} · {hover.hour}:00</div>
            {hover.slot.busy ? (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{hover.slot.customerName || t('crm.bookings.availability.freeGrid.unnamedClient')}</div>
                {hover.slot.serviceName && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2 }}>{hover.slot.serviceName}</div>}
                {hover.slot.price && <div style={{ fontSize: 12.5, fontFamily: 'var(--ff-mono)', color: '#175c3d', marginTop: 6, fontWeight: 600 }}>{hover.slot.price} ₽</div>}
              </>
            ) : (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#175c3d' }}>{t('crm.bookings.availability.freeGrid.slotFree')}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{t('crm.bookings.availability.freeGrid.slotFreeHint')}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Быстрая бронь по клику на свободный слот ---------- */

interface QuickBookTarget {
  staffUserId: string;
  staffName: string;
  hour: number;
}

const QuickBookModal: React.FC<{
  target: QuickBookTarget | null;
  date: string;
  locations: BookingLocation[];
  services: BookingServiceItem[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ target, date, locations, services, onClose, onCreated }) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert } = useAlertModal();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [saving, setSaving] = useState(false);

  // Модалка открывается по клику на слот — переинициализируем поля именно в этот
  // момент (та же причина, что и в других формах на этой странице: locations/
  // services могли ещё не подгрузиться в момент самого первого рендера страницы).
  useEffect(() => {
    if (!target) return;
    setCustomerName('');
    setCustomerPhone('');
    setLocationId(locations[0]?.id || '');
    setServiceId(services[0]?.id || '');
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return null;

  const service = services.find((s) => s.id === serviceId);
  const durationMinutes = service?.durationMinutes ?? 60;

  const submit = async () => {
    if (!locationId) {
      showAlert(t('crm.bookings.availability.quickBookModal.noLocationError'), { variant: 'error' });
      return;
    }
    setSaving(true);
    const startAt = new Date(`${date}T${String(target.hour).padStart(2, '0')}:00:00`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
    try {
      await createReservation({
        locationId,
        serviceId: serviceId || undefined,
        staffUserId: target.staffUserId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        source: 'manual',
      });
      onCreated();
      onClose();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.quickBookModal.error'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, calc(100vw - 32px))' }}>
        <h3>{t('crm.bookings.availability.quickBookModal.title')}</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>
          {target.staffName} · {new Date(date).toLocaleDateString(dateLocale)}, {target.hour}:00
        </div>
        <div className="bk-field"><label>{t('crm.bookings.availability.quickBookModal.clientLabel')}</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('crm.bookings.availability.quickBookModal.clientPlaceholder')} /></div>
        <div className="bk-field"><label>{t('crm.bookings.availability.quickBookModal.phoneLabel')}</label><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>{t('crm.bookings.availability.quickBookModal.locationLabel')}</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="bk-field">
            <label>{t('crm.bookings.availability.quickBookModal.serviceLabel')}</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">{t('crm.bookings.availability.quickBookModal.serviceNone')}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.availability.quickBookModal.cancel')}</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}>
            <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.availability.quickBookModal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Недельное расписание локации ---------- */

const LocationWeeklyHoursPanel: React.FC<{ locations: BookingLocation[]; onChanged: () => void }> = ({ locations, onChanged }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [selected, setSelected] = useState('');
  const location = locations.find((l) => l.id === selected);
  const [hours, setHours] = useState<BookingWeeklyHours>({});
  const [saving, setSaving] = useState(false);

  // Same async-load issue as ClosurePanel above: locations arrives after mount, so the
  // default must be picked once it's actually here, not baked into the initial useState.
  useEffect(() => {
    if (locations.length && !locations.some((l) => l.id === selected)) {
      setSelected(locations[0].id);
    }
  }, [locations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setHours(location?.workingHours || {});
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = (day: string) => {
    setHours((h) => {
      const next = { ...h };
      if (next[day]?.length) delete next[day];
      else next[day] = [{ start: '09:00', end: '20:00' }];
      return next;
    });
  };

  const updatePeriod = (day: string, field: 'start' | 'end', value: string) => {
    setHours((h) => ({ ...h, [day]: [{ ...(h[day]?.[0] || { start: '09:00', end: '20:00' }), [field]: value }] }));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateBookingLocation(selected, { workingHours: hours });
      onChanged();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.weeklyHours.error'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!locations.length) return null;

  return (
    <div className="bk-panel" style={{ marginBottom: 16 }}>
      <div className="bk-panel-head">
        <div className="t">{t('crm.bookings.availability.weeklyHours.title')}</div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
        {DAY_KEYS.map((dk, i) => {
          const enabled = !!hours[dk]?.length;
          const period = hours[dk]?.[0];
          const label = t(`crm.bookings.availability.days.${dk}`);
          return (
            <div key={dk} style={{ display: 'grid', gridTemplateColumns: '36px 130px 1fr', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: i < 6 ? '1px solid var(--line-3)' : 'none' }}>
              <Toggle checked={enabled} onChange={() => toggleDay(dk)} aria-label={label} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: enabled ? 'var(--ink)' : 'var(--fg-4)' }}>{label}</span>
              {enabled ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input value={period?.start || '09:00'} onChange={(e) => updatePeriod(dk, 'start', e.target.value)} style={{ width: 70, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--ff-mono)' }} />
                  <span style={{ color: 'var(--fg-3)' }}>—</span>
                  <input value={period?.end || '20:00'} onChange={(e) => updatePeriod(dk, 'end', e.target.value)} style={{ width: 70, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--ff-mono)' }} />
                </div>
              ) : <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{t('crm.bookings.availability.weeklyHours.dayOff')}</span>}
            </div>
          );
        })}
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={saving} onClick={save}>
          <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.availability.weeklyHours.save')}
        </button>
      </div>
    </div>
  );
};

/* ---------- Особые даты ---------- */

const SpecialDatesPanel: React.FC<{ locations: BookingLocation[]; onChanged: () => void }> = ({ locations, onChanged }) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert } = useAlertModal();
  const [selected, setSelected] = useState('');
  const location = locations.find((l) => l.id === selected);
  const [addOpen, setAddOpen] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (locations.length && !locations.some((l) => l.id === selected)) {
      setSelected(locations[0].id);
    }
  }, [locations]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!selected || !date) return;
    try {
      await addLocationClosure(selected, { date, reason: reason || undefined });
      setDate('');
      setReason('');
      setAddOpen(false);
      onChanged();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.specialDates.addError'), { variant: 'error' });
    }
  };

  const remove = async (index: number) => {
    if (!selected) return;
    try {
      await removeLocationClosure(selected, index);
      onChanged();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.specialDates.removeError'), { variant: 'error' });
    }
  };

  if (!locations.length) return null;

  return (
    <div className="bk-panel">
      <div className="bk-panel-head">
        <div className="t">{t('crm.bookings.availability.specialDates.title')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => setAddOpen(true)}><Ic d={BK_ICON.plus} size={12} /> {t('crm.bookings.availability.specialDates.add')}</button>
        </div>
      </div>
      <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
        {(!location || location.closures.length === 0) && (
          <div style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.bookings.availability.specialDates.empty')}</div>
        )}
        {location?.closures.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < location.closures.length - 1 ? '1px solid var(--line-3)' : 'none', fontSize: 12.5 }}>
            <span style={{ fontWeight: 500 }}>{new Date(c.date).toLocaleDateString(dateLocale)}</span>
            <span style={{ color: 'var(--fg-3)', flex: 1, marginLeft: 12 }}>{c.reason || t('crm.bookings.availability.specialDates.closedFallback')}</span>
            <button onClick={() => remove(i)} style={{ background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer' }}><Ic d={BK_ICON.x} size={12} /></button>
          </div>
        ))}
      </div>

      {addOpen && (
        <div className="px-scope">
          <div className="bk-modal-back" onClick={() => setAddOpen(false)} />
          <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(400px, calc(100vw - 32px))' }}>
            <h3>{t('crm.bookings.availability.specialDates.modal.title')}</h3>
            <div className="bk-field"><label>{t('crm.bookings.availability.specialDates.modal.dateLabel')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="bk-field"><label>{t('crm.bookings.availability.specialDates.modal.reasonLabel')}</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('crm.bookings.availability.specialDates.modal.reasonPlaceholder')} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
              <button className="btn btn-sm" onClick={() => setAddOpen(false)}>{t('crm.bookings.availability.specialDates.modal.cancel')}</button>
              <button className="btn btn-primary btn-sm" onClick={add}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.availability.specialDates.modal.submit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Правила бронирования ---------- */

const BookingRulesPanel: React.FC<{ project: BookingProject | null; onChanged: () => void }> = ({ project, onChanged }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [draft, setDraft] = useState<Partial<BookingProject>>(project || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(project || {}), [project]);

  if (!project) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateBookingProject(draft);
      onChanged();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.rules.error'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-panel">
      <div className="bk-panel-head"><div className="t">{t('crm.bookings.availability.rules.title')}</div></div>
      <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field"><label>{t('crm.bookings.availability.rules.minNotice')}</label><input type="number" value={draft.minNoticeMinutes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, minNoticeMinutes: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>{t('crm.bookings.availability.rules.horizon')}</label><input type="number" value={draft.maxAdvanceDays ?? ''} onChange={(e) => setDraft((d) => ({ ...d, maxAdvanceDays: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>{t('crm.bookings.availability.rules.slotInterval')}</label><input type="number" value={draft.slotIntervalMinutes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, slotIntervalMinutes: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>{t('crm.bookings.availability.rules.buffer')}</label><input type="number" value={draft.bufferMinutes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, bufferMinutes: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>{t('crm.bookings.availability.rules.cancelDeadline')}</label><input type="number" value={draft.cancellationDeadlineHours ?? ''} onChange={(e) => setDraft((d) => ({ ...d, cancellationDeadlineHours: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>{t('crm.bookings.availability.rules.rescheduleDeadline')}</label><input type="number" value={draft.rescheduleDeadlineHours ?? ''} onChange={(e) => setDraft((d) => ({ ...d, rescheduleDeadlineHours: Number(e.target.value) || 0 }))} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: 8, cursor: 'pointer' }}>
          <Toggle checked={draft.overbookingAllowed ?? false} onChange={() => setDraft((d) => ({ ...d, overbookingAllowed: !(d.overbookingAllowed ?? false) }))} />
          {t('crm.bookings.availability.rules.overbooking')}
        </label>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={save}>
          <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.availability.rules.save')}
        </button>
      </div>
    </div>
  );
};

/* ---------- Переназначить брони ---------- */

const ReassignModal: React.FC<{ open: boolean; staffList: BookingStaffProfile[]; onClose: () => void; onDone: () => void }> = ({ open, staffList, onClose, onDone }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [fromStaffUserId, setFromStaffUserId] = useState('');
  const [toStaffUserId, setToStaffUserId] = useState('');
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [result, setResult] = useState<{ reassignedCount: number; skippedCount: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (staffList.length && !staffList.some((s) => s.staffUserId === fromStaffUserId)) {
      setFromStaffUserId(staffList[0].staffUserId);
    }
  }, [staffList]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await reassignStaffBookings({
        fromStaffUserId,
        toStaffUserId: toStaffUserId || null,
        fromDate,
        toDate,
      });
      setResult(res);
      onDone();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.reassign.error'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={() => { onClose(); setResult(null); }} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('crm.bookings.availability.reassign.title')}</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>{t('crm.bookings.availability.reassign.hint')}</div>
        {result === null ? (
          <>
            <div className="bk-field">
              <label>{t('crm.bookings.availability.reassign.fromLabel')}</label>
              <select value={fromStaffUserId} onChange={(e) => setFromStaffUserId(e.target.value)}>
                {staffList.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="bk-field"><label>{t('crm.bookings.availability.reassign.fromDateLabel')}</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
              <div className="bk-field"><label>{t('crm.bookings.availability.reassign.toDateLabel')}</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            </div>
            <div className="bk-field">
              <label>{t('crm.bookings.availability.reassign.toLabel')}</label>
              <select value={toStaffUserId} onChange={(e) => setToStaffUserId(e.target.value)}>
                <option value="">{t('crm.bookings.availability.reassign.autoDistribute')}</option>
                {staffList.filter((s) => s.staffUserId !== fromStaffUserId).map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
              <button className="btn btn-sm" onClick={onClose}>{t('crm.bookings.availability.reassign.cancel')}</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.availability.reassign.submit')}</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: 14, background: '#eaf4ee', borderRadius: 10, fontSize: 12.5, color: '#175c3d', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Ic d={BK_ICON.check} size={16} />
              <div>{t(result.reassignedCount === 1 ? 'crm.bookings.availability.reassign.resultOne' : 'crm.bookings.availability.reassign.resultOther', { count: result.reassignedCount })}</div>
            </div>
            {result.skippedCount > 0 && (
              <div style={{ padding: 14, background: '#fbecef', borderRadius: 10, fontSize: 12.5, color: '#9a1f31' }}>
                {t('crm.bookings.availability.reassign.resultSkipped', { count: result.skippedCount })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Slot Inspector ---------- */

const SlotInspectorModal: React.FC<{ open: boolean; staffList: BookingStaffProfile[]; onClose: () => void }> = ({ open, staffList, onClose }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [staffUserId, setStaffUserId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('14:00');
  const [duration, setDuration] = useState('60');
  const [result, setResult] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  if (!open) return null;

  const run = async () => {
    setChecking(true);
    setResult(null);
    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + Number(duration) * 60_000);
    try {
      const res = await inspectBookingSlot({ staffUserId: staffUserId || undefined, startAt: startAt.toISOString(), endAt: endAt.toISOString() });
      setResult(res);
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.slotInspector.error'), { variant: 'error' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('crm.bookings.availability.slotInspector.title')}</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>{t('crm.bookings.availability.slotInspector.hint')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="bk-field">
            <label>{t('crm.bookings.availability.slotInspector.staffLabel')}</label>
            <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
              <option value="">{t('crm.bookings.availability.slotInspector.staffAny')}</option>
              {staffList.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
            </select>
          </div>
          <div className="bk-field"><label>{t('crm.bookings.availability.slotInspector.durationLabel')}</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.availability.slotInspector.dateLabel')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="bk-field"><label>{t('crm.bookings.availability.slotInspector.timeLabel')}</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={checking} onClick={run}>{t('crm.bookings.availability.slotInspector.submit')}</button>
        {result && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: result.ok ? '#eaf4ee' : '#fbecef', borderRadius: 10, fontSize: 12.5, color: result.ok ? '#175c3d' : '#9a1f31' }}>
            {result.ok ? t('crm.bookings.availability.slotInspector.ok') : result.reason}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- главная страница ---------- */

export const BookingAvailabilityPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [project, setProject] = useState<BookingProject | null>(null);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staffList, setStaffList] = useState<BookingStaffProfile[]>([]);
  const [grid, setGrid] = useState<StaffGridRow[]>([]);
  const [date, setDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [quickBook, setQuickBook] = useState<QuickBookTarget | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchBookingProject(), fetchBookingLocations(), fetchBookingStaff(), fetchBookingServices()])
      .then(([p, l, s, sv]) => {
        setProject(p);
        setLocations(l);
        setStaffList(s);
        setServices(sv);
      })
      .catch((e) => showAlert(e.message || t('crm.bookings.availability.error'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadGrid = () => {
    fetchStaffGrid(date).then(setGrid).catch(() => setGrid([]));
  };

  useEffect(() => {
    reloadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, staffList]);

  const availableStaff = useMemo(() => staffList.filter((s) => s.availableForBooking), [staffList]);

  const toggleAvailable = async (s: BookingStaffProfile) => {
    try {
      await updateBookingStaffProfile(s.staffUserId, { availableForBooking: !s.availableForBooking });
      load();
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.availability.staffAvailability.error'), { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="bookingAvailability" />
      <div className="px-scope">
        <BookingsSubnav active="availability" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.availability.kicker')}</div>
            <h1>{t('crm.bookings.availability.title')}</h1>
            <p className="sub">
              {t('crm.bookings.availability.subtitleBase')}
              {project ? t('crm.bookings.availability.subtitleProjectSuffix', { name: project.name }) : ''}.
            </p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => setReassignOpen(true)} disabled={!availableStaff.length}>
              <Ic d={BK_ICON.users} size={13} /> {t('crm.bookings.availability.reassignBtn')}
            </button>
            <button className="btn btn-sm" onClick={() => setInspectorOpen(true)}>
              <Ic d={BK_ICON.search} size={13} /> {t('crm.bookings.availability.slotInspectorBtn')}
            </button>
          </div>
        </div>

        {!loading && (
          <div className="bk-panel" style={{ margin: '16px 0' }}>
            <div className="bk-panel-head"><div className="t">{t('crm.bookings.availability.staffAvailability.title')}</div></div>
            <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
              {staffList.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.bookings.availability.staffAvailability.empty')}</div>}
              {staffList.map((s, i) => (
                <div key={s.staffUserId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < staffList.length - 1 ? '1px solid var(--line-3)' : 'none' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{s.staffUser?.fullName} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {s.staffUser?.role}</span></span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <span style={{ color: s.availableForBooking ? '#175c3d' : 'var(--fg-3)' }}>{s.availableForBooking ? t('crm.bookings.availability.staffAvailability.available') : t('crm.bookings.availability.staffAvailability.unavailable')}</span>
                    <Toggle checked={s.availableForBooking} onChange={() => toggleAvailable(s)} aria-label={t('crm.bookings.availability.staffAvailability.toggleAria', { name: s.staffUser?.fullName ?? '' })} />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bk-cols">
          <div>
            <ClosurePanel project={project} staffList={availableStaff} onChanged={load} />
            <StaffFreeGrid
              grid={grid}
              date={date}
              onDateChange={setDate}
              onSlotClick={(staffUserId, staffName, hour) => setQuickBook({ staffUserId, staffName, hour })}
            />
            <LocationWeeklyHoursPanel locations={locations} onChanged={load} />
            <SpecialDatesPanel locations={locations} onChanged={load} />
          </div>
          <div>
            <BookingRulesPanel project={project} onChanged={load} />
          </div>
        </div>
      </div>
      <ReassignModal open={reassignOpen} staffList={availableStaff} onClose={() => setReassignOpen(false)} onDone={load} />
      <SlotInspectorModal open={inspectorOpen} staffList={availableStaff} onClose={() => setInspectorOpen(false)} />
      <QuickBookModal
        target={quickBook}
        date={date}
        locations={locations}
        services={services}
        onClose={() => setQuickBook(null)}
        onCreated={reloadGrid}
      />
    </MainLayout>
  );
};
