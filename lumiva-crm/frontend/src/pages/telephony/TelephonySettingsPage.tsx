// src/pages/telephony/TelephonySettingsPage.tsx
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { TelephonySubnav } from './TelephonySubnav';
import {
  fetchTelephonyStatus,
  fetchTelephonyConfig,
  saveTelephonyConfig,
  deleteTelephonyConfig,
  type TelephonyConfigDto,
} from '../../api/telephony';
import { createAiAddonCheckoutSession } from '../../api/client';
import { fetchSmsConfig, saveSmsConfig, deleteSmsConfig, type SmsConfigDto, type SmsProvider } from '../../api/sms';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './telephony-design.css';

interface SmsProviderDef {
  value: SmsProvider;
  label: string;
  logo: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
}

const SMS_PROVIDERS: SmsProviderDef[] = [
  {
    value: 'twilio', label: 'Twilio', logo: 'TW',
    fields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', label: 'Auth Token', placeholder: '••••••••••••••••••••••••••••••••', secret: true },
      { key: 'fromPhone', label: 'Номер отправителя', placeholder: '+19998887766' },
    ],
  },
  {
    value: 'smsc', label: 'SMSC.ru', logo: 'SC',
    fields: [
      { key: 'login', label: 'Логин', placeholder: 'my_login' },
      { key: 'password', label: 'Пароль', placeholder: '••••••••', secret: true },
      { key: 'sender', label: 'Имя отправителя (необязательно)', placeholder: 'MyBrand' },
    ],
  },
  {
    value: 'smsru', label: 'SMS.ru', logo: 'SR',
    fields: [
      { key: 'apiId', label: 'API ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', secret: true },
      { key: 'from', label: 'Имя отправителя (необязательно)', placeholder: 'MyBrand' },
    ],
  },
];

export const TelephonySettingsPage: React.FC = () => {
  const { showConfirm } = useAlertModal();
  // ─── Telephony (Twilio Voice) ─────────────────────────────────────────────
  const [addonEnabled, setAddonEnabled] = useState<boolean | null>(null);
  const [includedInPlan, setIncludedInPlan] = useState(false);
  const [activating, setActivating] = useState(false);
  const [telConfig, setTelConfig] = useState<TelephonyConfigDto | null>(null);
  const [telLoading, setTelLoading] = useState(true);
  const [telSaving, setTelSaving] = useState(false);
  const [telError, setTelError] = useState<string | null>(null);
  const [telSuccess, setTelSuccess] = useState(false);

  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [voiceNumber, setVoiceNumber] = useState('');
  const [forwardNumbersText, setForwardNumbersText] = useState('');
  const [telIsEnabled, setTelIsEnabled] = useState(true);

  // ─── SMS ────────────────────────────────────────────────────────────────────
  const [smsConfig, setSmsConfig] = useState<SmsConfigDto | null>(null);
  const [smsLoading, setSmsLoading] = useState(true);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsDeleting, setSmsDeleting] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsSuccess, setSmsSuccess] = useState(false);

  const [smsProvider, setSmsProvider] = useState<SmsProvider>('twilio');
  const [smsCredentials, setSmsCredentials] = useState<Record<string, string>>({});
  const [senderName, setSenderName] = useState('');
  const [smsIsEnabled, setSmsIsEnabled] = useState(true);

  useEffect(() => { void loadTelephony(); void loadSms(); }, []);

  const loadTelephony = async () => {
    setTelLoading(true);
    try {
      const status = await fetchTelephonyStatus();
      setAddonEnabled(status.enabled);
      setIncludedInPlan(status.includedInPlan);
      if (status.enabled) {
        const data = await fetchTelephonyConfig();
        setTelConfig(data);
        if (data) {
          setVoiceNumber(data.voiceNumber || '');
          setForwardNumbersText((data.forwardToNumbers || []).join('\n'));
          setTelIsEnabled(data.isEnabled);
        }
      }
    } catch (e: any) {
      setTelError(e.message);
    } finally {
      setTelLoading(false);
    }
  };

  const loadSms = async () => {
    setSmsLoading(true);
    try {
      const data = await fetchSmsConfig();
      setSmsConfig(data);
      if (data) {
        setSmsProvider(data.provider);
        setSenderName(data.senderName ?? '');
        setSmsIsEnabled(data.isEnabled);
      }
    } catch (e: any) {
      setSmsError(e.message);
    } finally {
      setSmsLoading(false);
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      const session = await createAiAddonCheckoutSession({
        kind: 'telephony_addon',
        successUrl: `${window.location.origin}/app/telephony/settings?activated=1`,
        cancelUrl: `${window.location.origin}/app/telephony/settings`,
      });
      if (session.url) window.location.href = session.url;
    } catch (e: any) {
      setTelError(e.message);
      setActivating(false);
    }
  };

  const handleSaveTelephony = async () => {
    setTelSaving(true);
    setTelError(null);
    setTelSuccess(false);
    try {
      await saveTelephonyConfig({
        accountSid: accountSid || undefined,
        authToken: authToken || undefined,
        voiceNumber: voiceNumber || undefined,
        forwardToNumbers: forwardNumbersText.split('\n').map((s) => s.trim()).filter(Boolean),
        isEnabled: telIsEnabled,
      });
      setTelSuccess(true);
      setAccountSid('');
      setAuthToken('');
      await loadTelephony();
    } catch (e: any) {
      setTelError(e?.message);
    } finally {
      setTelSaving(false);
    }
  };

  const handleDeleteTelephony = async () => {
    const ok = await showConfirm('Отключить телефонию? Звонки станут недоступны.', {
      title: 'Отключение',
      confirmLabel: 'Отключить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTelephonyConfig();
      setTelConfig(null);
      setAccountSid('');
      setAuthToken('');
    } catch (e: any) {
      setTelError(e.message);
    }
  };

  const handleSaveSms = async () => {
    setSmsSaving(true);
    setSmsError(null);
    setSmsSuccess(false);
    try {
      await saveSmsConfig({ provider: smsProvider, credentials: smsCredentials, senderName: senderName || undefined, isEnabled: smsIsEnabled });
      setSmsSuccess(true);
      setSmsCredentials({});
      await loadSms();
    } catch (e: any) {
      setSmsError(e?.response?.data?.message || e.message);
    } finally {
      setSmsSaving(false);
    }
  };

  const handleDeleteSms = async () => {
    const ok = await showConfirm('Удалить настройки SMS? Отправка сообщений станет недоступна.', {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setSmsDeleting(true);
    try {
      await deleteSmsConfig();
      setSmsConfig(null);
      setSmsCredentials({});
      setSmsSuccess(false);
    } catch (e: any) {
      setSmsError(e.message);
    } finally {
      setSmsDeleting(false);
    }
  };

  const smsProviderDef = SMS_PROVIDERS.find((p) => p.value === smsProvider)!;

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />ПРОВАЙДЕРЫ И НОМЕРА</div>
            <h1>Настройки телефонии и SMS</h1>
            <p className="sub">Подключите провайдера связи, номера и посмотрите статус записи разговоров.</p>
          </div>
        </div>

        <TelephonySubnav active="settings" />

        {/* ── IP-телефония ────────────────────────────────────────────── */}
        <div className="ha-section">
          <div className="ha-section-head"><div><h3>IP-телефония</h3><div className="sub">Twilio Voice — звонки прямо из CRM</div></div></div>

          {telLoading ? (
            <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Загрузка…</p>
          ) : !addonEnabled ? (
            <div className="provider-card">
              <div className="provider-logo">TW</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Twilio Voice</div>
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>Платное дополнение — +€14/мес поверх любого тарифа</div>
              </div>
              <div className="provider-status">
                <button className="btn btn-primary btn-sm" onClick={handleActivate} disabled={activating}>{activating ? 'Открываем оплату…' : 'Подключить'}</button>
              </div>
            </div>
          ) : (
            <>
              {includedInPlan && (
                <p style={{ fontSize: 12, color: '#1f8a5e', marginBottom: 10 }}>Включено бесплатно в ваш тариф Ultimate.</p>
              )}
              <div className="provider-card">
                <div className="provider-logo">TW</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>Twilio Voice {telConfig?.voiceNumber ? `· ${telConfig.voiceNumber}` : ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                    {telConfig ? (telConfig.isEnabled ? 'Подключено и активно' : 'Подключено, но отключено') : 'Не настроено'}
                  </div>
                </div>
                <div className="provider-status">
                  {telConfig && <span className="bk-badge confirmed">{telConfig.isEnabled ? 'Активен' : 'Отключён'}</span>}
                  {telConfig && <button className="btn btn-sm" style={{ color: '#9a1f31', borderColor: '#f0c8cf' }} onClick={handleDeleteTelephony}>Отключить</button>}
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gap: 10, maxWidth: 480 }}>
                {telConfig?.accountSid && (
                  <p style={{ fontSize: 11.5, color: 'var(--fg-3)', background: 'var(--bg-muted)', borderRadius: 8, padding: '8px 10px' }}>
                    Учётные данные уже сохранены. Заполните поля ниже только если хотите их обновить.
                  </p>
                )}
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>Account SID
                  <input style={inputStyle} value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autoComplete="off" />
                </label>
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>Auth Token
                  <input type="password" style={inputStyle} value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="••••••••••••••••••••••••••••••••" autoComplete="off" />
                </label>
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>Voice-номер (E.164)
                  <input style={inputStyle} value={voiceNumber} onChange={(e) => setVoiceNumber(e.target.value)} placeholder="+19998887766" />
                </label>
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>Номера сотрудников для звонков (по одному на строку)
                  <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={forwardNumbersText} onChange={(e) => setForwardNumbersText(e.target.value)} placeholder={'+79991234567\n+79997654321'} />
                </label>
                <p style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                  Первый номер — кому звонит Twilio при исходящем звонке из CRM. Все номера — куда звонит Twilio при входящем.
                </p>

                <div className="tel-num-row" style={{ background: 'var(--bg-muted)', border: 'none' }}>
                  <span style={{ fontSize: 11.5 }}>Запись звонков и транскрипция (Whisper) включены автоматически — хранение записей 3 года.</span>
                </div>

                {telConfig?.inboundWebhookUrl && (
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Приём входящих звонков</p>
                    <p style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>
                      Вставьте в консоли Twilio: номер телефона → раздел «Voice» → «A call comes in» → Webhook (HTTP POST).
                      Без этого шага исходящие звонки из CRM будут работать, а входящие на этот номер — нет.
                    </p>
                    <code style={{ display: 'block', background: 'var(--bg-muted)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 11, wordBreak: 'break-all' }}>
                      {telConfig.inboundWebhookUrl}
                    </code>
                  </div>
                )}

                {telError && <p style={{ fontSize: 11.5, color: '#cc2f47' }}>{telError}</p>}
                {telSuccess && <p style={{ fontSize: 11.5, color: '#1f8a5e' }}>Настройки сохранены</p>}
                <div>
                  <button className="btn btn-primary" onClick={handleSaveTelephony} disabled={telSaving}>{telSaving ? 'Сохраняем…' : 'Сохранить настройки телефонии'}</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── SMS-провайдер ────────────────────────────────────────────── */}
        <div className="ha-section">
          <div className="ha-section-head"><div><h3>SMS-провайдер</h3><div className="sub">Отправка и приём SMS</div></div></div>

          {smsLoading ? (
            <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Загрузка…</p>
          ) : (
            <>
              {smsConfig && (
                <div className="provider-card">
                  <div className="provider-logo">{SMS_PROVIDERS.find((p) => p.value === smsConfig.provider)?.logo}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{SMS_PROVIDERS.find((p) => p.value === smsConfig.provider)?.label ?? smsConfig.provider}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                      {smsConfig.isEnabled ? 'Подключено и активно' : 'Подключено, но отключено'}
                      {smsConfig.senderName ? ` · подпись «${smsConfig.senderName}»` : ''}
                    </div>
                  </div>
                  <div className="provider-status">
                    <span className="bk-badge confirmed">{smsConfig.isEnabled ? 'Активен' : 'Отключён'}</span>
                    <button className="btn btn-sm" style={{ color: '#9a1f31', borderColor: '#f0c8cf' }} onClick={handleDeleteSms} disabled={smsDeleting}>{smsDeleting ? 'Удаление…' : 'Отключить'}</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
                {SMS_PROVIDERS.map((p) => (
                  <button
                    key={p.value}
                    className="btn btn-sm"
                    style={smsProvider === p.value ? { borderColor: 'var(--ink)', background: 'var(--bg-soft)' } : undefined}
                    onClick={() => { setSmsProvider(p.value); setSmsCredentials({}); }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
                {smsConfig?.hasCredentials && (
                  <p style={{ fontSize: 11.5, color: 'var(--fg-3)', background: 'var(--bg-muted)', borderRadius: 8, padding: '8px 10px' }}>
                    Учётные данные уже сохранены. Заполните поля ниже только если хотите их обновить.
                  </p>
                )}
                {smsProviderDef.fields.map((field) => (
                  <label key={field.key} style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                    {field.label}
                    <input
                      type={field.secret ? 'password' : 'text'}
                      style={inputStyle}
                      placeholder={field.placeholder}
                      value={smsCredentials[field.key] ?? ''}
                      onChange={(e) => setSmsCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      autoComplete="off"
                    />
                  </label>
                ))}
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                  Глобальное имя отправителя (необязательно)
                  <input style={inputStyle} maxLength={64} value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Lumiva" />
                </label>

                <div className="provider-card" style={{ marginBottom: 0 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>SMS активны</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>Разрешить отправку SMS через этот провайдер</div>
                  </div>
                  <div className="provider-status">
                    <div className={smsIsEnabled ? 'tel-switch on' : 'tel-switch'} onClick={() => setSmsIsEnabled(!smsIsEnabled)}><i /></div>
                  </div>
                </div>

                {smsConfig?.inboundWebhookUrl && smsConfig.provider === 'twilio' && (
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Приём входящих SMS</p>
                    <p style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>
                      Вставьте в консоли Twilio: номер телефона → «A message comes in» → Webhook.
                    </p>
                    <code style={{ display: 'block', background: 'var(--bg-muted)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 11, wordBreak: 'break-all' }}>
                      {smsConfig.inboundWebhookUrl}
                    </code>
                  </div>
                )}

                {smsError && <p style={{ fontSize: 11.5, color: '#cc2f47' }}>{smsError}</p>}
                {smsSuccess && <p style={{ fontSize: 11.5, color: '#1f8a5e' }}>Настройки сохранены</p>}
                <div>
                  <button className="btn btn-primary" onClick={handleSaveSms} disabled={smsSaving}>{smsSaving ? 'Сохраняем…' : 'Сохранить настройки SMS'}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
  border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)',
};
