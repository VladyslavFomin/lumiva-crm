import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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
import { fetchVerticalSettings, updateVerticalSettings, type BookingVerticalSettings } from '../../api/bookingVerticals';
import { syncBookingProject } from './useBookingVertical';
import { BOOKING_NAV_BY_TYPE, bookingNavLabel } from './bookingNav';
import './bookings-design.css';
import './bookings-verticals.css';

type TabId = 'general' | 'businessType' | 'vertical' | 'confirmation' | 'notifications' | 'telegram' | 'connector' | 'roles';
const TAB_KEYS: TabId[] = ['general', 'businessType', 'vertical', 'confirmation', 'notifications', 'telegram', 'connector', 'roles'];

const BUSINESS_TYPE_KEYS: BookingBusinessType[] = ['salon', 'restaurant', 'fitness', 'consultation', 'rental'];
const CONFIRMATION_MODE_KEYS: BookingConfirmationMode[] = ['auto', 'manual', 'conditional'];
const NOTIFICATION_EVENT_KEYS = [
  'reservation_created',
  'pending_confirmation',
  'reservation_confirmed',
  'reservation_rescheduled',
  'reservation_cancelled',
  'reservation_reminder',
  'reservation_no_show',
];
const CHANNEL_KEYS: Array<'crm' | 'email' | 'telegram'> = ['crm', 'email', 'telegram'];
const ROLE_KEYS = ['owner', 'manager', 'salesSupport', 'other'];

const CONNECTOR_TOKEN_NAME = 'Booking Website Connector';

export const BookingSettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertModal();
  const [tab, setTab] = useState<TabId>('general');
  const [project, setProject] = useState<BookingProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vs, setVs] = useState<BookingVerticalSettings | null>(null);
  const [savedType, setSavedType] = useState<BookingBusinessType | null>(null);
  const [connectorToken, setConnectorToken] = useState<ApiTokenRecord | null>(null);
  const [connectorLoading, setConnectorLoading] = useState(false);

  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';

  useEffect(() => {
    fetchBookingProject()
      .then((p) => {
        setProject(p);
        setSavedType(p.businessType);
        syncBookingProject(p);
      })
      .catch((e) => showAlert(e.message || t('crm.bookings.settings.error'), { variant: 'error' }))
      .finally(() => setLoading(false));
    fetchVerticalSettings().then(setVs).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== 'connector') return;
    setConnectorLoading(true);
    fetchApiTokens()
      .then((tokens) => setConnectorToken(tokens.find((tk) => tk.name === CONNECTOR_TOKEN_NAME) || null))
      .catch((e) => showAlert(e.message || t('crm.bookings.settings.connectorTab.loadError'), { variant: 'error' }))
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
      // verticalSettings сохраняются своей вкладкой (PATCH /bookings/vertical/settings) — не
      // отправляем здесь устаревший снимок, иначе «Основное» затирало бы «Параметры типа».
      const { verticalSettings: _vs, ...payload } = (fields || project) as BookingProject;
      const saved = await updateBookingProject(payload);
      setProject(saved);
      if (saved.businessType !== savedType) {
        setSavedType(saved.businessType);
        syncBookingProject(saved);
        showAlert(t('crm.bookings.v.settings.typeSwitched', { name: t(`crm.bookings.settings.businessTypes.${saved.businessType}.name`) }), { variant: 'success' });
      }
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.settings.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveVertical = async () => {
    if (!vs) return;
    setSaving(true);
    try {
      setVs(await updateVerticalSettings(vs));
      showAlert(t('crm.bookings.v.settings.saved'), { variant: 'success' });
    } catch (e: any) {
      showAlert(e.message || t('crm.bookings.settings.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };
  const vNum = (k: keyof BookingVerticalSettings) => (e: React.ChangeEvent<HTMLInputElement>) => vs && setVs({ ...vs, [k]: e.target.value === '' ? ('' as any) : Number(e.target.value) });

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
      showAlert(e.message || t('crm.bookings.settings.connectorTab.createError'), { variant: 'error' });
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
      showAlert(e.message || t('crm.bookings.settings.connectorTab.regenerateError'), { variant: 'error' });
    } finally {
      setConnectorLoading(false);
    }
  };

  const activeBusinessType = BUSINESS_TYPE_KEYS.includes(project?.businessType as BookingBusinessType) ? project?.businessType : undefined;
  const projectStatusLabel = project?.status === 'active' ? t('crm.bookings.settings.projectStatus.active') : project?.status === 'paused' ? t('crm.bookings.settings.projectStatus.paused') : project?.status;

  return (
    <MainLayout>
      <PageHelpButton topic="bookingSettings" />
      <div className="px-scope">
        <BookingsSubnav active="settings" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{project ? project.name.toUpperCase() : ''}</div>
            <h1>{t('crm.bookings.settings.title')}</h1>
            <p className="sub">{t('crm.bookings.settings.subtitle')}</p>
          </div>
        </div>

        <div data-tour="bset-tabs" className="bk-tabs" style={{ marginTop: 16 }}>
          {TAB_KEYS.map((k) => (
            <div key={k} className={`bk-tab${k === tab ? ' active' : ''}`} onClick={() => setTab(k)}>{t(`crm.bookings.settings.tabs.${k}`)}</div>
          ))}
        </div>

        {!loading && project && (
          <>
            {tab === 'general' && (
              <div data-tour="bset-general" className="bk-panel">
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.settings.general.title')}</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  <div className="bk-field"><label>{t('crm.bookings.settings.general.nameLabel')}</label><input value={project.name} onChange={(e) => patch({ name: e.target.value })} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="bk-field"><label>{t('crm.bookings.settings.general.timezoneLabel')}</label><input value={project.timezone} onChange={(e) => patch({ timezone: e.target.value })} /></div>
                    <div className="bk-field"><label>{t('crm.bookings.settings.general.currencyLabel')}</label><input value={project.currency} onChange={(e) => patch({ currency: e.target.value.toUpperCase().slice(0, 3) })} /></div>
                  </div>
                  <div className="bk-info-row"><span className="l">{t('crm.bookings.settings.general.businessTypeLabel')}</span><span className="v">{activeBusinessType ? t(`crm.bookings.settings.businessTypes.${activeBusinessType}.name`) : ''}</span></div>
                  <div className="bk-info-row"><span className="l">{t('crm.bookings.settings.general.statusLabel')}</span><span className="v"><span className={project.status === 'active' ? 'bk-badge confirmed' : project.status === 'paused' ? 'bk-badge cancelled_by_business' : 'bk-badge pending'}>{projectStatusLabel}</span></span></div>
                  <button data-tour="bset-save" className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={() => save()}>
                    <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.settings.general.save')}
                  </button>
                </div>
              </div>
            )}

            {tab === 'businessType' && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.settings.businessType.title')}</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14, lineHeight: 1.5 }}>
                    {t('crm.bookings.settings.businessType.hint')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {BUSINESS_TYPE_KEYS.map((bk) => (
                      <label key={bk} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', border: `1px solid ${project.businessType === bk ? 'var(--ink)' : 'var(--line-2)'}`, borderRadius: 10, cursor: 'pointer', background: project.businessType === bk ? 'var(--bg-muted)' : '#fff' }}>
                        <input type="radio" name="biztype" checked={project.businessType === bk} onChange={() => patch({ businessType: bk })} style={{ marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{t(`crm.bookings.settings.businessTypes.${bk}.name`)}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 3 }}>{t(`crm.bookings.settings.businessTypes.${bk}.desc`)}</div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', color: 'var(--fg-4)', marginTop: 6, textTransform: 'uppercase' }}>{t('crm.bookings.settings.businessType.termsPrefix')} {t(`crm.bookings.settings.businessTypes.${bk}.terms`)}</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                            {BOOKING_NAV_BY_TYPE[bk].filter((k) => !['overview', 'logs', 'roles', 'settings', 'analytics', 'locations'].includes(k)).map((k) => (
                              <span key={k} className="mn-tag">{bookingNavLabel(t, bk, k)}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>{t(`crm.bookings.v.settings.typeFeatures.${bk}`)}</div>
                        </div>
                        {project.businessType === bk && <span className="bk-badge confirmed">{t('crm.bookings.settings.businessType.selected')}</span>}
                      </label>
                    ))}
                  </div>
                  {project.businessType !== savedType && <div className="bk-hint" style={{ marginTop: 12, color: '#c08319' }}>{t('crm.bookings.v.settings.switchHint')}</div>}
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={() => save()}>
                    <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.settings.businessType.save')}
                  </button>
                </div>
              </div>
            )}

            {tab === 'vertical' && vs && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.settings.verticalTitle', { name: t(`crm.bookings.settings.businessTypes.${savedType || project.businessType}.name`) })}</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px', maxWidth: 640 }}>
                  {(savedType || project.businessType) === 'restaurant' && (
                    <>
                      <div className="bk-row3">
                        <div className="bk-field"><label>{t('crm.bookings.v.settings.turnMinutes')}</label><input type="number" min={15} max={720} value={vs.turnMinutes} onChange={vNum('turnMinutes')} /></div>
                        <div className="bk-field"><label>{t('crm.bookings.v.settings.serviceCharge')}</label><input type="number" min={0} max={50} value={vs.serviceChargePercent} onChange={vNum('serviceChargePercent')} /></div>
                        <div className="bk-field"><label>{t('crm.bookings.v.settings.autoRelease')}</label><input type="number" min={0} max={240} value={vs.autoReleaseMinutes} onChange={vNum('autoReleaseMinutes')} /></div>
                      </div>
                      <div className="bk-hint">{t('crm.bookings.v.settings.restaurantHint')}</div>
                    </>
                  )}
                  {(savedType || project.businessType) === 'fitness' && (
                    <>
                      <div className="bk-field"><label>{t('crm.bookings.v.settings.passChargeOn')}</label>
                        <div className="bk-seg">
                          <button className={vs.passChargeOn === 'attendance' ? 'on' : ''} onClick={() => setVs({ ...vs, passChargeOn: 'attendance' })}>{t('crm.bookings.v.settings.chargeAttendance')}</button>
                          <button className={vs.passChargeOn === 'booking' ? 'on' : ''} onClick={() => setVs({ ...vs, passChargeOn: 'booking' })}>{t('crm.bookings.v.settings.chargeBooking')}</button>
                        </div>
                      </div>
                      <div className="bk-row2">
                        <div className="bk-field"><label>{t('crm.bookings.v.settings.lateCancelHours')}</label><input type="number" min={0} max={168} value={vs.lateCancelHours} onChange={vNum('lateCancelHours')} /></div>
                        <div className="bk-field"><label>{t('crm.bookings.v.settings.defaultCapacity')}</label><input type="number" min={1} max={500} value={vs.defaultClassCapacity} onChange={vNum('defaultClassCapacity')} /></div>
                      </div>
                      <label className="bk-check"><input type="checkbox" checked={vs.noShowChargesVisit} onChange={(e) => setVs({ ...vs, noShowChargesVisit: e.target.checked })} /> {t('crm.bookings.v.settings.noShowCharges')}</label>
                      <div className="bk-hint">{t('crm.bookings.v.settings.fitnessHint')}</div>
                    </>
                  )}
                  {(savedType || project.businessType) === 'consultation' && (
                    <>
                      <div className="bk-field"><label>{t('crm.bookings.v.settings.defaultFormat')}</label>
                        <div className="bk-seg">
                          {(['offline', 'online', 'phone'] as const).map((f) => <button key={f} className={vs.defaultMeetingFormat === f ? 'on' : ''} onClick={() => setVs({ ...vs, defaultMeetingFormat: f })}>{t(`crm.bookings.v.panels.fmt.${f}`)}</button>)}
                        </div>
                      </div>
                      <div className="bk-field"><label>{t('crm.bookings.v.settings.meetingTemplate')}</label><input value={vs.meetingUrlTemplate} onChange={(e) => setVs({ ...vs, meetingUrlTemplate: e.target.value })} /></div>
                      <div className="bk-hint" style={{ marginBottom: 10 }}>{t('crm.bookings.v.settings.meetingTemplateHint')}</div>
                      <div className="bk-row2">
                        <div className="bk-field"><label>{t('crm.bookings.v.settings.followUpDays')}</label><input type="number" min={1} max={365} value={vs.followUpDays} onChange={vNum('followUpDays')} /></div>
                        <div className="bk-field"><label>{t('crm.bookings.v.settings.lateCancelHours')}</label><input type="number" min={0} max={168} value={vs.lateCancelHours} onChange={vNum('lateCancelHours')} /></div>
                      </div>
                      <div className="bk-field"><label>{t('crm.bookings.v.settings.passChargeOn')}</label>
                        <div className="bk-seg">
                          <button className={vs.passChargeOn === 'attendance' ? 'on' : ''} onClick={() => setVs({ ...vs, passChargeOn: 'attendance' })}>{t('crm.bookings.v.settings.chargeAttendance')}</button>
                          <button className={vs.passChargeOn === 'booking' ? 'on' : ''} onClick={() => setVs({ ...vs, passChargeOn: 'booking' })}>{t('crm.bookings.v.settings.chargeBooking')}</button>
                        </div>
                      </div>
                    </>
                  )}
                  {(savedType || project.businessType) === 'rental' && (
                    <>
                      <div className="bk-field"><label>{t('crm.bookings.v.settings.rentalUnit')}</label>
                        <div className="bk-seg">
                          <button className={vs.rentalUnit === 'hour' ? 'on' : ''} onClick={() => setVs({ ...vs, rentalUnit: 'hour' })}>{t('crm.bookings.v.settings.unitHour')}</button>
                          <button className={vs.rentalUnit === 'day' ? 'on' : ''} onClick={() => setVs({ ...vs, rentalUnit: 'day' })}>{t('crm.bookings.v.settings.unitDay')}</button>
                        </div>
                      </div>
                      <div className="bk-field"><label>{t('crm.bookings.v.settings.lateFeePercent')}</label><input type="number" min={0} max={1000} value={vs.lateFeePercent} onChange={vNum('lateFeePercent')} /></div>
                      <label className="bk-check"><input type="checkbox" checked={vs.requireDeposit} onChange={(e) => setVs({ ...vs, requireDeposit: e.target.checked })} /> {t('crm.bookings.v.settings.requireDeposit')}</label>
                      <div className="bk-hint">{t('crm.bookings.v.settings.rentalHint')}</div>
                    </>
                  )}
                  {(savedType || project.businessType) === 'salon' && (
                    <>
                      <div className="bk-field"><label>{t('crm.bookings.v.settings.passChargeOn')}</label>
                        <div className="bk-seg">
                          <button className={vs.passChargeOn === 'attendance' ? 'on' : ''} onClick={() => setVs({ ...vs, passChargeOn: 'attendance' })}>{t('crm.bookings.v.settings.chargeAttendance')}</button>
                          <button className={vs.passChargeOn === 'booking' ? 'on' : ''} onClick={() => setVs({ ...vs, passChargeOn: 'booking' })}>{t('crm.bookings.v.settings.chargeBooking')}</button>
                        </div>
                      </div>
                      <div className="bk-field"><label>{t('crm.bookings.v.settings.lateCancelHours')}</label><input type="number" min={0} max={168} value={vs.lateCancelHours} onChange={vNum('lateCancelHours')} /></div>
                      <div className="bk-hint">{t('crm.bookings.v.settings.salonHint')}</div>
                    </>
                  )}
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={saveVertical}>
                    <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.settings.general.save')}
                  </button>
                </div>
              </div>
            )}

            {tab === 'confirmation' && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.settings.confirmation.title')}</div></div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {CONFIRMATION_MODE_KEYS.map((mk) => (
                      <label key={mk} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--line-2)', borderRadius: 10, cursor: 'pointer', background: project.confirmationMode === mk ? 'var(--bg-muted)' : '#fff' }}>
                        <input type="radio" name="confirm" checked={project.confirmationMode === mk} onChange={() => patch({ confirmationMode: mk })} style={{ marginTop: 2 }} />
                        <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>{t(`crm.bookings.settings.confirmationModes.${mk}.title`)}</div><div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{t(`crm.bookings.settings.confirmationModes.${mk}.desc`)}</div></div>
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={() => save()}>
                    <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.settings.confirmation.save')}
                  </button>
                </div>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.settings.notifications.title')}</div></div>
                <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                  {NOTIFICATION_EVENT_KEYS.map((ek, i) => {
                    const cfg = project.notificationChannels?.[ek] || { crm: false, email: false, telegram: false };
                    return (
                      <div key={ek} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < NOTIFICATION_EVENT_KEYS.length - 1 ? '1px solid var(--line-3)' : 'none' }}>
                        <span style={{ fontSize: 12.5 }}>{t(`crm.bookings.settings.notificationEvents.${ek}`)}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {CHANNEL_KEYS.map((ck) => (
                            <span
                              key={ck}
                              onClick={() => toggleChannel(ek, ck)}
                              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line-2)', cursor: 'pointer', background: cfg[ck] ? 'var(--ink)' : '#fff', color: cfg[ck] ? '#fff' : 'var(--fg-3)' }}
                            >
                              {t(`crm.bookings.settings.channels.${ck}`)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving} onClick={() => save()}>
                    <Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.settings.notifications.save')}
                  </button>
                  <div style={{ marginTop: 12, fontSize: 11, color: 'var(--fg-4)' }}>
                    {t('crm.bookings.settings.notifications.footnote')}
                  </div>
                </div>
              </div>
            )}

            {tab === 'telegram' && (
              <div className="bk-panel">
                <div className="bk-panel-head">
                  <div className="t">{t('crm.bookings.settings.telegramTab.title')}</div>
                  <span className="bk-badge no_show">{t('crm.bookings.settings.telegramTab.notConnected')}</span>
                </div>
                <div className="bk-panel-body" style={{ padding: '14px 18px', fontSize: 12.5, color: 'var(--fg-3)' }}>
                  {t('crm.bookings.settings.telegramTab.body')}
                </div>
              </div>
            )}

            {tab === 'connector' && (
              <div className="bk-panel">
                <div className="bk-panel-head">
                  <div className="t">{t('crm.bookings.settings.connectorTab.title')}</div>
                  <span className={connectorToken ? 'bk-badge confirmed' : 'bk-badge no_show'}>{connectorToken ? t('crm.bookings.settings.connectorTab.connected') : t('crm.bookings.settings.connectorTab.notConnected')}</span>
                </div>
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  {connectorLoading && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('crm.bookings.settings.connectorTab.loading')}</div>}
                  {!connectorLoading && !connectorToken && (
                    <>
                      <p style={{ fontSize: 12.5, color: 'var(--fg-3)', marginBottom: 12 }}>
                        {t('crm.bookings.settings.connectorTab.intro', { endpoint: 'POST /public/bookings/ingest', header: 'X-Api-Token' })}
                      </p>
                      <button className="btn btn-primary btn-sm" onClick={createConnector}>
                        <Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.settings.connectorTab.createBtn')}
                      </button>
                    </>
                  )}
                  {!connectorLoading && connectorToken && (
                    <>
                      <div className="bk-info-row"><span className="l">{t('crm.bookings.settings.connectorTab.tokenLabel')}</span><span className="v" style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{connectorToken.token}</span></div>
                      <div className="bk-info-row"><span className="l">{t('crm.bookings.settings.connectorTab.createdLabel')}</span><span className="v">{new Date(connectorToken.createdAt).toLocaleString(dateLocale)}</span></div>
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-muted)', borderRadius: 10, fontSize: 11, fontFamily: 'var(--ff-mono)' }}>
                        X-Api-Token: {connectorToken.token}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button className="btn btn-sm" onClick={regenerateConnector}>{t('crm.bookings.settings.connectorTab.regenerate')}</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {tab === 'roles' && (
              <div className="bk-panel">
                <div className="bk-panel-head">
                  <div className="t">{t('crm.bookings.settings.rolesTab.title')}</div>
                  <button className="link" onClick={() => window.open('/staff/permissions', '_self')}>{t('crm.bookings.settings.rolesTab.openMatrix')}</button>
                </div>
                <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
                  {ROLE_KEYS.map((rk) => (
                    <div key={rk} className="bk-info-row"><span className="l">{t(`crm.bookings.settings.rolesTab.roles.${rk}.label`)}</span><span className="v" style={{ fontWeight: 400, color: 'var(--fg-3)' }}>{t(`crm.bookings.settings.rolesTab.roles.${rk}.desc`)}</span></div>
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
