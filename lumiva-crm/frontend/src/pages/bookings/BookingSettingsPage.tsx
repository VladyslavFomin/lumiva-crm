import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingProject,
  updateBookingProject,
  type BookingProject,
  type BookingBusinessType,
  type BookingConfirmationMode,
} from '../../api/bookings';
import { fetchApiTokens, createApiToken, deleteApiToken, type ApiTokenRecord } from '../../api/apiTokens';
import './bookings-design.css';

const TABS = ['Основное', 'Тип бизнеса', 'Подтверждение', 'Уведомления', 'Telegram', 'Коннектор', 'Роли и доступ'] as const;
type TabId = (typeof TABS)[number];

const BUSINESS_TYPES: Array<{ id: BookingBusinessType; name: string; desc: string; terms: string }> = [
  { id: 'salon', name: 'Салон красоты / услуги', desc: 'Мастера, кабинеты, индивидуальные записи по времени', terms: 'Мастер, Кабинет, Услуга' },
  { id: 'restaurant', name: 'Ресторан', desc: 'Столы, залы/зоны, вместимость гостей', terms: 'Стол, Зал, Гость' },
  { id: 'fitness', name: 'Pilates / Фитнес', desc: 'Групповые классы, вместимость, лист ожидания', terms: 'Зал, Класс, Участник' },
  { id: 'consultation', name: 'Консультации', desc: 'Без ресурсов — только специалист и время', terms: 'Специалист, Слот' },
  { id: 'rental', name: 'Аренда ресурсов', desc: 'Оборудование, площадки по количеству', terms: 'Ресурс, Единица' },
];

const CONFIRMATION_MODES: Array<{ id: BookingConfirmationMode; title: string; desc: string }> = [
  { id: 'auto', title: 'Автоматическое подтверждение', desc: 'Бронь подтверждается сразу, без участия ресепшн' },
  { id: 'manual', title: 'Ручное подтверждение', desc: 'Требуется подтверждение сотрудником' },
  { id: 'conditional', title: 'Условное подтверждение', desc: 'Авто для постоянных клиентов, вручную — для новых' },
];

const NOTIFICATION_EVENTS: Array<{ key: string; label: string }> = [
  { key: 'reservation_created', label: 'Новая бронь получена' },
  { key: 'pending_confirmation', label: 'Требует подтверждения' },
  { key: 'reservation_confirmed', label: 'Бронь подтверждена' },
  { key: 'reservation_rescheduled', label: 'Бронь перенесена' },
  { key: 'reservation_cancelled', label: 'Бронь отменена' },
  { key: 'reservation_reminder', label: 'Напоминание клиенту' },
  { key: 'reservation_no_show', label: 'Неявка клиента' },
];
const CHANNELS: Array<{ key: 'crm' | 'email' | 'telegram'; label: string }> = [
  { key: 'crm', label: 'CRM' },
  { key: 'email', label: 'Email' },
  { key: 'telegram', label: 'Telegram' },
];

const ROLE_DESCRIPTIONS = [
  { r: 'Owner', d: 'Полный доступ ко всем настройкам и данным' },
  { r: 'Manager', d: 'Управление услугами, ресурсами, расписанием' },
  { r: 'Sales / Support', d: 'Создание, подтверждение, перенос броней' },
  { r: 'Остальные роли', d: 'Видят только свои брони и доступность, если не выдано право «bookings»' },
];

const CONNECTOR_TOKEN_NAME = 'Booking Website Connector';

export const BookingSettingsPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [tab, setTab] = useState<TabId>('Основное');
  const [project, setProject] = useState<BookingProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [connectorToken, setConnectorToken] = useState<ApiTokenRecord | null>(null);
  const [connectorLoading, setConnectorLoading] = useState(false);

  useEffect(() => {
    fetchBookingProject()
      .then(setProject)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить настройки', { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== 'Коннектор') return;
    setConnectorLoading(true);
    fetchApiTokens()
      .then((tokens) => setConnectorToken(tokens.find((t) => t.name === CONNECTOR_TOKEN_NAME) || null))
      .catch((e) => showAlert(e.message || 'Не удалось загрузить коннектор', { variant: 'error' }))
      .finally(() => setConnectorLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const patch = (fields: Partial<BookingProject>) => {
    if (!project) return;
    setProject({ ...project, ...fields });
  };

  const save = async (fields?: Partial<BookingProject>) => {
    if (!project) return;
    setSaving(true);
    try {
      const saved = await updateBookingProject(fields || project);
      setProject(saved);
    } catch (e: any) {
      showAlert(e.message || 'Не удалось сохранить настройки', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (eventKey: string, channel: 'crm' | 'email' | 'telegram') => {
    if (!project) return;
    const current = project.notificationChannels?.[eventKey] || { crm: false, email: false, telegram: false };
    const nextChannels = {
      ...project.notificationChannels,
      [eventKey]: { ...current, [channel]: !current[channel] },
    };
    patch({ notificationChannels: nextChannels });
  };

  const createConnector = async () => {
    setConnectorLoading(true);
    try {
      const created = await createApiToken({ name: CONNECTOR_TOKEN_NAME, description: 'Токен для приёма броней с внешнего сайта/виджета' });
      setConnectorToken(created);
    } catch (e: any) {
      showAlert(e.message || 'Не удалось создать токен коннектора', { variant: 'error' });
    } finally {
      setConnectorLoading(false);
    }
  };

  const regenerateConnector = async () => {
    if (!connectorToken) return;
    setConnectorLoading(true);
    try {
      await deleteApiToken(connectorToken.id);
      const created = await createApiToken({ name: CONNECTOR_TOKEN_NAME, description: 'Токен для приёма броней с внешнего сайта/виджета' });
      setConnectorToken(created);
    } catch (e: any) {
      showAlert(e.message || 'Не удалось обновить токен', { variant: 'error' });
    } finally {
      setConnectorLoading(false);
    }
  };

  const active = BUSINESS_TYPES.find((b) => b.id === project?.businessType);

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="settings" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{project ? project.name.toUpperCase() : ''}</div>
            <h1>Настройки бронирования</h1>
            <p className="sub">Общие параметры проекта, тип бизнеса, правила подтверждения и каналы уведомлений.</p>
          </div>
        </div>

        <div className="bk-tabs" style={{ marginTop: 16 }}>
          {TABS.map((t) => (
            <div key={t} className={`bk-tab${t === tab ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</div>
          ))}
        </div>

        {!loading && project && (
          <>
            {tab === 'Основное' && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">Общие параметры</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  <div className="bk-field"><label>Название проекта</label><input value={project.name} onChange={(e) => patch({ name: e.target.value })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="bk-field"><label>Часовой пояс</label><input value={project.timezone} onChange={(e) => patch({ timezone: e.target.value })} /></div>
                    <div className="bk-field"><label>Валюта</label><input value={project.currency} onChange={(e) => patch({ currency: e.target.value.toUpperCase().slice(0, 3) })} /></div>
                  </div>
                  <div className="bk-info-row"><span className="l">Тип бизнеса</span><span className="v">{active?.name}</span></div>
                  <div className="bk-info-row"><span className="l">Статус проекта</span><span className="v"><span className={project.status === 'active' ? 'bk-badge confirmed' : project.status === 'paused' ? 'bk-badge cancelled_by_business' : 'bk-badge pending'}>{project.status}</span></span></div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={() => save()}>
                    <Ic d={BK_ICON.check} size={13} /> Сохранить
                  </button>
                </div>
              </div>
            )}

            {tab === 'Тип бизнеса' && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">Выберите модель бронирования</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14, lineHeight: 1.5 }}>
                    Меняет терминологию и видимые разделы навигации — под капотом используется одна и та же модель данных.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {BUSINESS_TYPES.map((b) => (
                      <label key={b.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', border: `1px solid ${project.businessType === b.id ? 'var(--ink)' : 'var(--line-2)'}`, borderRadius: 10, cursor: 'pointer', background: project.businessType === b.id ? 'var(--bg-muted)' : '#fff' }}>
                        <input type="radio" name="biztype" checked={project.businessType === b.id} onChange={() => patch({ businessType: b.id })} style={{ marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 3 }}>{b.desc}</div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', color: 'var(--fg-4)', marginTop: 6, textTransform: 'uppercase' }}>Терминология: {b.terms}</div>
                        </div>
                        {project.businessType === b.id && <span className="bk-badge confirmed">Выбрано</span>}
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={() => save()}>
                    <Ic d={BK_ICON.check} size={13} /> Сохранить
                  </button>
                </div>
              </div>
            )}

            {tab === 'Подтверждение' && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">Правила подтверждения</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {CONFIRMATION_MODES.map((m) => (
                      <label key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--line-2)', borderRadius: 10, cursor: 'pointer', background: project.confirmationMode === m.id ? 'var(--bg-muted)' : '#fff' }}>
                        <input type="radio" name="confirm" checked={project.confirmationMode === m.id} onChange={() => patch({ confirmationMode: m.id })} style={{ marginTop: 2 }} />
                        <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>{m.title}</div><div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{m.desc}</div></div>
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={() => save()}>
                    <Ic d={BK_ICON.check} size={13} /> Сохранить
                  </button>
                </div>
              </div>
            )}

            {tab === 'Уведомления' && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">Каналы уведомлений по событиям</div></div>
                <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                  {NOTIFICATION_EVENTS.map((e, i) => {
                    const cfg = project.notificationChannels?.[e.key] || { crm: false, email: false, telegram: false };
                    return (
                      <div key={e.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < NOTIFICATION_EVENTS.length - 1 ? '1px solid var(--line-3)' : 'none' }}>
                        <span style={{ fontSize: 12.5 }}>{e.label}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {CHANNELS.map((c) => (
                            <span
                              key={c.key}
                              onClick={() => toggleChannel(e.key, c.key)}
                              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line-2)', cursor: 'pointer', background: cfg[c.key] ? 'var(--ink)' : '#fff', color: cfg[c.key] ? '#fff' : 'var(--fg-3)' }}
                            >
                              {c.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={() => save()}>
                    <Ic d={BK_ICON.check} size={13} /> Сохранить
                  </button>
                  <div style={{ marginTop: 12, fontSize: 11, color: 'var(--fg-4)' }}>
                    CRM-уведомления уже работают (внутренние алерты владельцу/менеджеру). Email/Telegram — только настройка каналов, реальная отправка по этим событиям пока не подключена.
                  </div>
                </div>
              </div>
            )}

            {tab === 'Telegram' && (
              <div className="bk-panel">
                <div className="bk-panel-head">
                  <div className="t">Telegram-уведомления</div>
                  <span className="bk-badge no_show">Не подключено</span>
                </div>
                <div className="bk-panel-body" style={{ padding: '14px 18px', fontSize: 12.5, color: 'var(--fg-3)' }}>
                  Подключение Telegram-бота для этого модуля ещё не реализовано. Когда появится реальная интеграция,
                  здесь будет статус бота, чат и тестовая отправка сообщений.
                </div>
              </div>
            )}

            {tab === 'Коннектор' && (
              <div className="bk-panel">
                <div className="bk-panel-head">
                  <div className="t">Внешний коннектор (виджет сайта)</div>
                  <span className={connectorToken ? 'bk-badge confirmed' : 'bk-badge no_show'}>{connectorToken ? 'Подключено' : 'Не подключено'}</span>
                </div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  {connectorLoading && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Загрузка…</div>}
                  {!connectorLoading && !connectorToken && (
                    <>
                      <p style={{ fontSize: 12.5, color: 'var(--fg-3)', marginBottom: 12 }}>
                        Создайте токен, чтобы принимать брони с внешнего сайта через <code>POST /public/bookings/ingest</code> с заголовком <code>X-Api-Token</code>.
                      </p>
                      <button className="btn btn-primary btn-sm" onClick={createConnector}>
                        <Ic d={BK_ICON.plus} size={13} /> Создать токен коннектора
                      </button>
                    </>
                  )}
                  {!connectorLoading && connectorToken && (
                    <>
                      <div className="bk-info-row"><span className="l">Токен</span><span className="v" style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{connectorToken.token}</span></div>
                      <div className="bk-info-row"><span className="l">Создан</span><span className="v">{new Date(connectorToken.createdAt).toLocaleString('ru-RU')}</span></div>
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-muted)', borderRadius: 10, fontSize: 11, fontFamily: 'var(--ff-mono)' }}>
                        X-Api-Token: {connectorToken.token}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button className="btn btn-sm" onClick={regenerateConnector}>Обновить ключ</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {tab === 'Роли и доступ' && (
              <div className="bk-panel">
                <div className="bk-panel-head">
                  <div className="t">Роли с доступом к Бронированиям</div>
                  <button className="link" onClick={() => window.open('/staff/permissions', '_self')}>Открыть матрицу прав →</button>
                </div>
                <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                  {ROLE_DESCRIPTIONS.map((r, i) => (
                    <div key={i} className="bk-info-row"><span className="l">{r.r}</span><span className="v" style={{ fontWeight: 400, color: 'var(--fg-3)' }}>{r.d}</span></div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};
