import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingServices,
  createBookingService,
  updateBookingService,
  deleteBookingService,
  fetchBookingStaff,
  type BookingServiceItem,
  type BookingStaffProfile,
} from '../../api/bookings';
import './bookings-design.css';

type ModalState = { mode: 'create' } | { mode: 'edit'; service: BookingServiceItem } | null;

const CAT_COLORS = ['#222222', '#3b6cb6', '#1f8a5e', '#c08319', '#5a45a8', '#cc2f47', '#888888', '#214b8a'];

const ServiceModal: React.FC<{ state: ModalState; staff: BookingStaffProfile[]; onClose: () => void; onSaved: () => void }> = ({
  state,
  staff,
  onClose,
  onSaved,
}) => {
  const { showAlert } = useAlertModal();
  const editing = state?.mode === 'edit' ? state.service : null;
  const [name, setName] = useState(editing?.name || '');
  const [category, setCategory] = useState(editing?.category || '');
  const [color, setColor] = useState(editing?.color || CAT_COLORS[1]);
  const [durationMinutes, setDurationMinutes] = useState(String(editing?.durationMinutes ?? 60));
  const [price, setPrice] = useState(editing?.price ?? '0');
  const [capacityMax, setCapacityMax] = useState(String(editing?.capacityMax ?? 1));
  const [minNoticeMinutes, setMinNoticeMinutes] = useState(String(editing?.minNoticeMinutes ?? ''));
  const [staffUserIds, setStaffUserIds] = useState<string[]>(editing?.staffUserIds || []);
  const [autoConfirm, setAutoConfirm] = useState(editing?.autoConfirm ?? true);
  const [saving, setSaving] = useState(false);

  if (!state) return null;

  const toggleStaff = (id: string) => setStaffUserIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const dto = {
      name: name.trim(),
      category: category.trim() || null,
      color,
      durationMinutes: Number(durationMinutes) || 60,
      price,
      capacityMax: Number(capacityMax) || 1,
      capacityMin: 1,
      minNoticeMinutes: minNoticeMinutes.trim() ? Number(minNoticeMinutes) : null,
      staffUserIds,
      autoConfirm,
    };
    try {
      if (editing) await updateBookingService(editing.id, dto);
      else await createBookingService(dto);
      onSaved();
      onClose();
    } catch (err: any) {
      showAlert(err.message || 'Не удалось сохранить услугу', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? 'Редактировать услугу' : 'Новая услуга'}</h3>
        <div className="bk-field">
          <label>Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Маникюр классический" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <div className="bk-field">
            <label>Категория</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ногтевой сервис" />
          </div>
          <div className="bk-field">
            <label>Цвет</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 36, padding: 2 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="bk-field">
            <label>Длительность (мин)</label>
            <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
          </div>
          <div className="bk-field">
            <label>Цена</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="bk-field">
            <label>Вместимость</label>
            <input type="number" value={capacityMax} onChange={(e) => setCapacityMax(e.target.value)} />
          </div>
        </div>
        <div className="bk-field">
          <label>Мин. уведомление (мин, необязательно — иначе как в проекте)</label>
          <input type="number" value={minNoticeMinutes} onChange={(e) => setMinNoticeMinutes(e.target.value)} placeholder="Например, 120" />
        </div>
        <div className="bk-field">
          <label>Доступные мастера</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {staff.map((s) => (
              <span
                key={s.staffUserId}
                onClick={() => toggleStaff(s.staffUserId)}
                style={{
                  fontSize: 11.5, padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${staffUserIds.includes(s.staffUserId) ? 'var(--ink)' : 'var(--line-2)'}`,
                  background: staffUserIds.includes(s.staffUserId) ? 'var(--ink)' : '#fff',
                  color: staffUserIds.includes(s.staffUserId) ? '#fff' : 'var(--fg-2)',
                }}
              >
                {s.staffUser?.fullName || s.staffUserId}
              </span>
            ))}
            {staff.length === 0 && <span style={{ fontSize: 11.5, color: 'var(--fg-4)', fontStyle: 'italic' }}>Нет сотрудников</span>}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} />
          Автоматическое подтверждение брони
        </label>
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

export const BookingServicesPage: React.FC = () => {
  const { showAlert, showConfirm } = useAlertModal();
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [category, setCategory] = useState('Все');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchBookingServices(), fetchBookingStaff()])
      .then(([s, st]) => {
        setServices(s);
        setStaff(st);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить услуги', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (service: BookingServiceItem) => {
    const ok = await showConfirm(`Удалить услугу «${service.name}»? Действие необратимо.`, {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBookingService(service.id);
      load();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось удалить услугу', { variant: 'error' });
    }
  };

  const categories = useMemo(() => {
    const set = new Set(services.map((s) => s.category).filter(Boolean) as string[]);
    return ['Все', ...set];
  }, [services]);

  const filtered = services.filter((s) => category === 'Все' || s.category === category);
  const staffNames = (ids: string[]) => ids.map((id) => staff.find((s) => s.staffUserId === id)?.staffUser?.fullName).filter(Boolean).join(', ') || '—';

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="services" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{services.length} УСЛУГ · {services.filter((s) => s.active).length} АКТИВНЫ</div>
            <h1>Услуги</h1>
            <p className="sub">Каталог услуг с длительностью, ценой и доступными мастерами.</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'create' })}>
              <Ic d={BK_ICON.plus} size={13} /> Новая услуга
            </button>
          </div>
        </div>

        <div className="bk-savedviews" style={{ marginTop: 16 }}>
          {categories.map((c) => (
            <div key={c} className={`bk-sv-tab${c === category ? ' active' : ''}`} onClick={() => setCategory(c)}>{c}</div>
          ))}
        </div>

        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th>Название</th><th>Категория</th><th>Длительность</th><th>Вместимость</th><th>Цена</th><th>Мастера</th><th>Статус</th><th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Пока нет услуг</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => setModal({ mode: 'edit', service: s })}>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color || 'var(--line-2)', marginRight: 8 }} />
                    {s.name}
                  </td>
                  <td style={{ color: 'var(--fg-3)' }}>{s.category || '—'}</td>
                  <td>
                    <Ic d={BK_ICON.clock} size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-2px', color: 'var(--fg-3)' } as any} />
                    {s.durationMinutes} мин
                  </td>
                  <td>
                    <Ic d={BK_ICON.users} size={12} style={{ display: 'inline', marginRight: 5, verticalAlign: '-2px', color: 'var(--fg-3)' } as any} />
                    {s.capacityMax} чел.
                  </td>
                  <td style={{ fontFamily: 'var(--ff-mono)' }}>{s.price} {s.currency}</td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{staffNames(s.staffUserIds)}</td>
                  <td><span className={s.active ? 'bk-badge confirmed' : 'bk-badge no_show'}>{s.active ? 'Активна' : 'Скрыта'}</span></td>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                    <button
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#9a1f31] hover:bg-[#fbecef] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      onClick={() => handleDelete(s)}
                    >
                      <Ic d={BK_ICON.trash} size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ServiceModal state={modal} staff={staff} onClose={() => setModal(null)} onSaved={load} />
    </MainLayout>
  );
};
