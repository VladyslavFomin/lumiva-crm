import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
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

const DAYS = [
  { key: 'mon', label: 'Понедельник' },
  { key: 'tue', label: 'Вторник' },
  { key: 'wed', label: 'Среда' },
  { key: 'thu', label: 'Четверг' },
  { key: 'fri', label: 'Пятница' },
  { key: 'sat', label: 'Суббота' },
  { key: 'sun', label: 'Воскресенье' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

/* ---------- Приём заявок + отпуска сотрудников ---------- */

const ClosurePanel: React.FC<{
  project: BookingProject | null;
  staffList: BookingStaffProfile[];
  onChanged: () => void;
}> = ({ project, staffList, onChanged }) => {
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
      showAlert(e.message || 'Не удалось изменить статус приёма заявок', { variant: 'error' });
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
      showAlert(e.message || 'Не удалось добавить отсутствие', { variant: 'error' });
    }
  };

  const removeVacation = async (sid: string, index: number) => {
    try {
      await removeStaffTimeOff(sid, index);
      onChanged();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось удалить запись', { variant: 'error' });
    }
  };

  return (
    <div className="bk-panel" style={{ marginBottom: 16, borderColor: paused ? '#f0c8cf' : undefined }}>
      <div className="bk-panel-head">
        <div className="t">Приём заявок на бронирование</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <span style={{ color: paused ? '#9a1f31' : '#175c3d', fontWeight: 600 }}>
            {paused ? 'Приостановлено' : 'Открыто для брони'}
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
            Приём новых заявок временно недоступен. Существующие брони не затронуты.
          </div>
        )}
        <button className="btn btn-sm" onClick={() => setVacationOpen(true)}>
          <Ic d={BK_ICON.users} size={12} /> Отпуск сотрудника
        </button>

        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: '16px 0 8px' }}>
          Отпуска и отсутствия сотрудников
        </div>
        {staffList.flatMap((s) => (s.timeOff || []).map((t, idx) => ({ s, t, idx }))).length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Нет запланированных отсутствий</div>
        )}
        {staffList.map((s) =>
          (s.timeOff || []).map((t, idx) => (
            <div key={`${s.staffUserId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-3)', fontSize: 12.5 }}>
              <span><strong style={{ fontWeight: 500 }}>{s.staffUser?.fullName}</strong> <span style={{ color: 'var(--fg-3)' }}>— {t.from} – {t.to}{t.reason ? ` · ${t.reason}` : ''}</span></span>
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
            <h3>Отпуск / отсутствие сотрудника</h3>
            <div className="bk-field">
              <label>Сотрудник</label>
              <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
                {staffList.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="bk-field"><label>С даты</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="bk-field"><label>По дату</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="bk-field"><label>Причина</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Отпуск" /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
              <button className="btn btn-sm" onClick={() => setVacationOpen(false)}>Отмена</button>
              <button className="btn btn-primary btn-sm" onClick={addVacation}><Ic d={BK_ICON.check} size={13} /> Сохранить</button>
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
  const [hover, setHover] = useState<{ x: number; y: number; row: string; hour: number; slot: StaffGridRow['slots'][number] } | null>(null);

  return (
    <div className="bk-panel" style={{ marginBottom: 16 }}>
      <div className="bk-panel-head">
        <div className="t">Кто свободен — {new Date(date).toLocaleDateString('ru-RU')}</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-3)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#c9ead6', display: 'inline-block' }} />свободен</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-3)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#f6c9d1', display: 'inline-block' }} />занят</span>
          <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }} />
        </div>
      </div>
      <div className="bk-panel-body" style={{ padding: '12px 18px 16px', overflowX: 'auto', position: 'relative' }}>
        {grid.length === 0 ? (
          <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>Нет доступных мастеров на эту дату</div>
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
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{hover.slot.customerName || 'Клиент'}</div>
                {hover.slot.serviceName && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 2 }}>{hover.slot.serviceName}</div>}
                {hover.slot.price && <div style={{ fontSize: 12.5, fontFamily: 'var(--ff-mono)', color: '#175c3d', marginTop: 6, fontWeight: 600 }}>{hover.slot.price} ₽</div>}
              </>
            ) : (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#175c3d' }}>Слот свободен</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>Нажмите, чтобы создать бронь</div>
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
      showAlert('Сначала добавьте локацию', { variant: 'error' });
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
      showAlert(e.message || 'Не удалось создать бронь', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, calc(100vw - 32px))' }}>
        <h3>Новая бронь</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>
          {target.staffName} · {new Date(date).toLocaleDateString('ru-RU')}, {target.hour}:00
        </div>
        <div className="bk-field"><label>Клиент</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Имя или телефон" /></div>
        <div className="bk-field"><label>Телефон</label><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>Локация</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
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
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
          <button className="btn btn-sm" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}>
            <Ic d={BK_ICON.check} size={13} /> Создать бронь
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Недельное расписание локации ---------- */

const LocationWeeklyHoursPanel: React.FC<{ locations: BookingLocation[]; onChanged: () => void }> = ({ locations, onChanged }) => {
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
      showAlert(e.message || 'Не удалось сохранить расписание', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!locations.length) return null;

  return (
    <div className="bk-panel" style={{ marginBottom: 16 }}>
      <div className="bk-panel-head">
        <div className="t">Недельное расписание — Локация</div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
        {DAYS.map((d, i) => {
          const enabled = !!hours[d.key]?.length;
          const period = hours[d.key]?.[0];
          return (
            <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '22px 130px 1fr', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: i < 6 ? '1px solid var(--line-3)' : 'none' }}>
              <input type="checkbox" checked={enabled} onChange={() => toggleDay(d.key)} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: enabled ? 'var(--ink)' : 'var(--fg-4)' }}>{d.label}</span>
              {enabled ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input value={period?.start || '09:00'} onChange={(e) => updatePeriod(d.key, 'start', e.target.value)} style={{ width: 70, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--ff-mono)' }} />
                  <span style={{ color: 'var(--fg-3)' }}>—</span>
                  <input value={period?.end || '20:00'} onChange={(e) => updatePeriod(d.key, 'end', e.target.value)} style={{ width: 70, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 11.5, fontFamily: 'var(--ff-mono)' }} />
                </div>
              ) : <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>Выходной</span>}
            </div>
          );
        })}
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={saving} onClick={save}>
          <Ic d={BK_ICON.check} size={13} /> Сохранить расписание
        </button>
      </div>
    </div>
  );
};

/* ---------- Особые даты ---------- */

const SpecialDatesPanel: React.FC<{ locations: BookingLocation[]; onChanged: () => void }> = ({ locations, onChanged }) => {
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
      showAlert(e.message || 'Не удалось добавить особую дату', { variant: 'error' });
    }
  };

  const remove = async (index: number) => {
    if (!selected) return;
    try {
      await removeLocationClosure(selected, index);
      onChanged();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось удалить запись', { variant: 'error' });
    }
  };

  if (!locations.length) return null;

  return (
    <div className="bk-panel">
      <div className="bk-panel-head">
        <div className="t">Особые даты</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ border: '1px solid var(--line-2)', borderRadius: 8, padding: '5px 8px', fontSize: 12 }}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => setAddOpen(true)}><Ic d={BK_ICON.plus} size={12} /> Добавить</button>
        </div>
      </div>
      <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
        {(!location || location.closures.length === 0) && (
          <div style={{ fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>Нет особых дат</div>
        )}
        {location?.closures.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < location.closures.length - 1 ? '1px solid var(--line-3)' : 'none', fontSize: 12.5 }}>
            <span style={{ fontWeight: 500 }}>{new Date(c.date).toLocaleDateString('ru-RU')}</span>
            <span style={{ color: 'var(--fg-3)', flex: 1, marginLeft: 12 }}>{c.reason || 'Закрыто'}</span>
            <button onClick={() => remove(i)} style={{ background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer' }}><Ic d={BK_ICON.x} size={12} /></button>
          </div>
        ))}
      </div>

      {addOpen && (
        <div className="px-scope">
          <div className="bk-modal-back" onClick={() => setAddOpen(false)} />
          <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(400px, calc(100vw - 32px))' }}>
            <h3>Закрыть день для брони</h3>
            <div className="bk-field"><label>Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="bk-field"><label>Причина</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например, санитарный день" /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
              <button className="btn btn-sm" onClick={() => setAddOpen(false)}>Отмена</button>
              <button className="btn btn-primary btn-sm" onClick={add}><Ic d={BK_ICON.check} size={13} /> Закрыть день</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Правила бронирования ---------- */

const BookingRulesPanel: React.FC<{ project: BookingProject | null; onChanged: () => void }> = ({ project, onChanged }) => {
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
      showAlert(e.message || 'Не удалось сохранить правила', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-panel">
      <div className="bk-panel-head"><div className="t">Правила бронирования</div></div>
      <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="bk-field"><label>Мин. уведомление (мин)</label><input type="number" value={draft.minNoticeMinutes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, minNoticeMinutes: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>Горизонт (дней)</label><input type="number" value={draft.maxAdvanceDays ?? ''} onChange={(e) => setDraft((d) => ({ ...d, maxAdvanceDays: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>Интервал слота (мин)</label><input type="number" value={draft.slotIntervalMinutes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, slotIntervalMinutes: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>Буфер (мин)</label><input type="number" value={draft.bufferMinutes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, bufferMinutes: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>Дедлайн отмены (ч)</label><input type="number" value={draft.cancellationDeadlineHours ?? ''} onChange={(e) => setDraft((d) => ({ ...d, cancellationDeadlineHours: Number(e.target.value) || 0 }))} /></div>
          <div className="bk-field"><label>Дедлайн переноса (ч)</label><input type="number" value={draft.rescheduleDeadlineHours ?? ''} onChange={(e) => setDraft((d) => ({ ...d, rescheduleDeadlineHours: Number(e.target.value) || 0 }))} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: 8 }}>
          <input type="checkbox" checked={draft.overbookingAllowed ?? false} onChange={(e) => setDraft((d) => ({ ...d, overbookingAllowed: e.target.checked }))} />
          Разрешить овербукинг (без проверки конфликтов)
        </label>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={save}>
          <Ic d={BK_ICON.check} size={13} /> Сохранить правила
        </button>
      </div>
    </div>
  );
};

/* ---------- Переназначить брони ---------- */

const ReassignModal: React.FC<{ open: boolean; staffList: BookingStaffProfile[]; onClose: () => void; onDone: () => void }> = ({ open, staffList, onClose, onDone }) => {
  const { showAlert } = useAlertModal();
  const [fromStaffUserId, setFromStaffUserId] = useState('');
  const [toStaffUserId, setToStaffUserId] = useState('');
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [result, setResult] = useState<number | null>(null);
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
      setResult(res.reassignedCount);
      onDone();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось переназначить брони', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={() => { onClose(); setResult(null); }} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Переназначить брони</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>Например, мастер заболел или уходит в отпуск</div>
        {result === null ? (
          <>
            <div className="bk-field">
              <label>От кого</label>
              <select value={fromStaffUserId} onChange={(e) => setFromStaffUserId(e.target.value)}>
                {staffList.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="bk-field"><label>С даты</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
              <div className="bk-field"><label>По дату</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            </div>
            <div className="bk-field">
              <label>Кому передать</label>
              <select value={toStaffUserId} onChange={(e) => setToStaffUserId(e.target.value)}>
                <option value="">Распределить автоматически</option>
                {staffList.filter((s) => s.staffUserId !== fromStaffUserId).map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
              <button className="btn btn-sm" onClick={onClose}>Отмена</button>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={submit}><Ic d={BK_ICON.check} size={13} /> Переназначить</button>
            </div>
          </>
        ) : (
          <div style={{ padding: 14, background: '#eaf4ee', borderRadius: 10, fontSize: 12.5, color: '#175c3d', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Ic d={BK_ICON.check} size={16} />
            <div>{result} {result === 1 ? 'бронь переназначена' : 'брони переназначены'}.</div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Slot Inspector ---------- */

const SlotInspectorModal: React.FC<{ open: boolean; staffList: BookingStaffProfile[]; onClose: () => void }> = ({ open, staffList, onClose }) => {
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
      showAlert(e.message || 'Не удалось проверить слот', { variant: 'error' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Slot Inspector</h3>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>Проверить, доступен ли слот и почему</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="bk-field">
            <label>Мастер</label>
            <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
              <option value="">Любой</option>
              {staffList.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName}</option>)}
            </select>
          </div>
          <div className="bk-field"><label>Длительность (мин)</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div className="bk-field"><label>Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="bk-field"><label>Время</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={checking} onClick={run}>Проверить слот</button>
        {result && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: result.ok ? '#eaf4ee' : '#fbecef', borderRadius: 10, fontSize: 12.5, color: result.ok ? '#175c3d' : '#9a1f31' }}>
            {result.ok ? 'Слот доступен' : result.reason}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- главная страница ---------- */

export const BookingAvailabilityPage: React.FC = () => {
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
      .catch((e) => showAlert(e.message || 'Не удалось загрузить расписание', { variant: 'error' }))
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
      showAlert(e.message || 'Не удалось изменить доступность', { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="availability" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />ИЕРАРХИЯ: ПРОЕКТ → ЛОКАЦИЯ → МАСТЕР → УСЛУГА</div>
            <h1>Расписание и доступность</h1>
            <p className="sub">Рабочие часы, отпуска, особые даты и правила бронирования{project ? ` для «${project.name}»` : ''}.</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => setReassignOpen(true)} disabled={!availableStaff.length}>
              <Ic d={BK_ICON.users} size={13} /> Переназначить брони
            </button>
            <button className="btn btn-sm" onClick={() => setInspectorOpen(true)}>
              <Ic d={BK_ICON.search} size={13} /> Slot Inspector
            </button>
          </div>
        </div>

        {!loading && (
          <div className="bk-panel" style={{ margin: '16px 0' }}>
            <div className="bk-panel-head"><div className="t">Доступность мастеров</div></div>
            <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
              {staffList.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>Нет активных сотрудников</div>}
              {staffList.map((s, i) => (
                <div key={s.staffUserId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < staffList.length - 1 ? '1px solid var(--line-3)' : 'none' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{s.staffUser?.fullName} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {s.staffUser?.role}</span></span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <span style={{ color: s.availableForBooking ? '#175c3d' : 'var(--fg-3)' }}>{s.availableForBooking ? 'Доступен' : 'Недоступен'}</span>
                    <input type="checkbox" checked={s.availableForBooking} onChange={() => toggleAvailable(s)} />
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
