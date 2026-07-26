import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingTemplates,
  createBookingTemplate,
  updateBookingTemplate,
  deleteBookingTemplate,
  type BookingNotificationTemplate,
  type BookingTemplateChannel,
  type BookingTemplateEvent,
} from '../../api/bookings';
import './bookings-design.css';

const EVENT_LABELS: Record<BookingTemplateEvent, string> = {
  reservation_created: 'Новая бронь получена',
  reservation_confirmed: 'Бронь подтверждена',
  reservation_rescheduled: 'Бронь перенесена',
  reservation_cancelled: 'Бронь отменена',
  reservation_reminder: 'Напоминание клиенту',
  reservation_no_show: 'Неявка клиента',
};
const CHANNEL_LABELS: Record<BookingTemplateChannel, string> = {
  email: 'Email',
  telegram: 'Telegram',
  internal: 'Внутреннее (CRM)',
};
const TOKENS = ['client_name', 'service', 'date', 'time', 'staff', 'location_address', 'booking_id', 'status'];

const NEW_TEMPLATE: Partial<BookingNotificationTemplate> = {
  name: 'Новый шаблон',
  event: 'reservation_created',
  channel: 'internal',
  subject: null,
  body: '',
  active: true,
};

export const BookingTemplatesPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [templates, setTemplates] = useState<BookingNotificationTemplate[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<BookingNotificationTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = (selectId?: string) => {
    setLoading(true);
    fetchBookingTemplates()
      .then((items) => {
        setTemplates(items);
        const target = selectId ? items.find((t) => t.id === selectId) : items[0];
        if (target) {
          setActiveId(target.id);
          setDraft(target);
        } else {
          setActiveId(null);
          setDraft({});
        }
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить шаблоны', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTemplate = (t: BookingNotificationTemplate) => {
    setActiveId(t.id);
    setDraft(t);
  };

  const startNew = () => {
    setActiveId(null);
    setDraft(NEW_TEMPLATE);
  };

  const save = async () => {
    if (!draft.name?.trim() || !draft.body?.trim()) return;
    setSaving(true);
    try {
      if (activeId) {
        const updated = await updateBookingTemplate(activeId, draft);
        load(updated.id);
      } else {
        const created = await createBookingTemplate(draft);
        load(created.id);
      }
    } catch (e: any) {
      showAlert(e.message || 'Не удалось сохранить шаблон', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteBookingTemplate(id);
      load();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось удалить шаблон', { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="templates" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{templates.length} ШАБЛОНОВ</div>
            <h1>Шаблоны сообщений</h1>
            <p className="sub">Тексты для Email, Telegram и внутренних уведомлений. Переменные подставляются при отправке.</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" onClick={startNew}>
              <Ic d={BK_ICON.plus} size={13} /> Новый шаблон
            </button>
          </div>
        </div>

        <div className="bk-cols" style={{ marginTop: 16, gridTemplateColumns: '280px 1fr' }}>
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Все шаблоны</div></div>
            <div className="bk-panel-body" style={{ padding: '4px 8px 8px' }}>
              {!loading && templates.length === 0 && (
                <div style={{ padding: 10, color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12 }}>Пока нет шаблонов</div>
              )}
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 8, cursor: 'pointer', background: activeId === t.id ? 'var(--bg-muted)' : 'transparent' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{EVENT_LABELS[t.event]}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); remove(t.id); }} style={{ background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer' }}>
                    <Ic d={BK_ICON.trash} size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bk-panel">
            <div className="bk-panel-head">
              <div className="t">{draft.name || 'Новый шаблон'}</div>
              <span className={draft.active ? 'bk-badge confirmed' : 'bk-badge no_show'}>{draft.active ? 'Активен' : 'Отключён'}</span>
            </div>
            <div className="bk-panel-body" style={{ padding: '16px 18px' }}>
              <div className="bk-field"><label>Название</label><input value={draft.name || ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="bk-field" style={{ flex: 1 }}>
                  <label>Событие</label>
                  <select value={draft.event || 'reservation_created'} onChange={(e) => setDraft((d) => ({ ...d, event: e.target.value as BookingTemplateEvent }))}>
                    {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="bk-field" style={{ flex: 1 }}>
                  <label>Канал</label>
                  <select value={draft.channel || 'internal'} onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as BookingTemplateChannel }))}>
                    {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              {draft.channel === 'email' && (
                <div className="bk-field"><label>Тема письма</label><input value={draft.subject || ''} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} /></div>
              )}
              <div className="bk-field">
                <label>Текст сообщения</label>
                <textarea rows={7} value={draft.body || ''} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} style={{ fontFamily: 'var(--ff-mono)', lineHeight: 1.6, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TOKENS.map((tk) => (
                  <span
                    key={tk}
                    onClick={() => setDraft((d) => ({ ...d, body: `${d.body || ''}{{${tk}}}` }))}
                    style={{ fontFamily: 'var(--ff-mono)', fontSize: 10.5, padding: '4px 9px', background: 'var(--bg-muted)', border: '1px solid var(--line-2)', borderRadius: 6, color: 'var(--fg-2)', cursor: 'pointer' }}
                  >
                    {`{{${tk}}}`}
                  </span>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: 12 }}>
                <input type="checkbox" checked={draft.active ?? true} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
                Активен
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
                <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
                  <Ic d={BK_ICON.check} size={13} /> Сохранить шаблон
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
