// src/pages/telephony/TelephonySettingsPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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
  fields: { key: string; labelKey: string; placeholder: string; secret?: boolean }[];
}

const getSmsProviders = (t: TFunction): SmsProviderDef[] => [
  {
    value: 'twilio', label: 'Twilio', logo: 'TW',
    fields: [
      { key: 'accountSid', labelKey: 'crm.telephony.settings.providerFields.accountSid', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', labelKey: 'crm.telephony.settings.providerFields.authToken', placeholder: '••••••••••••••••••••••••••••••••', secret: true },
      { key: 'fromPhone', labelKey: 'crm.telephony.settings.providerFields.senderNumber', placeholder: '+19998887766' },
    ],
  },
  {
    value: 'smsc', label: 'SMSC.ru', logo: 'SC',
    fields: [
      { key: 'login', labelKey: 'crm.telephony.settings.providerFields.login', placeholder: 'my_login' },
      { key: 'password', labelKey: 'crm.telephony.settings.providerFields.password', placeholder: '••••••••', secret: true },
      { key: 'sender', labelKey: 'crm.telephony.settings.providerFields.senderNameOptional', placeholder: 'MyBrand' },
    ],
  },
  {
    value: 'smsru', label: 'SMS.ru', logo: 'SR',
    fields: [
      { key: 'apiId', labelKey: 'crm.telephony.settings.providerFields.apiId', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', secret: true },
      { key: 'from', labelKey: 'crm.telephony.settings.providerFields.fromOptional', placeholder: 'MyBrand' },
    ],
  },
];

export const TelephonySettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const SMS_PROVIDERS = React.useMemo(() => getSmsProviders(t), [t]);
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
    const ok = await showConfirm(t('crm.telephony.settings.voice.disconnectConfirmBody'), {
      title: t('crm.telephony.settings.voice.disconnectConfirmTitle'),
      confirmLabel: t('crm.telephony.settings.voice.disconnectConfirmBtn'),
      cancelLabel: t('crm.telephony.settings.voice.cancel'),
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
    const ok = await showConfirm(t('crm.telephony.settings.sms.disconnectConfirmBody'), {
      title: t('crm.telephony.settings.sms.disconnectConfirmTitle'),
      confirmLabel: t('crm.telephony.settings.sms.disconnectConfirmBtn'),
      cancelLabel: t('crm.telephony.settings.voice.cancel'),
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
      <PageHelpButton topic="telephonySettings" />
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.telephony.settings.kicker')}</div>
            <h1>{t('crm.telephony.settings.title')}</h1>
            <p className="sub">{t('crm.telephony.settings.subtitle')}</p>
          </div>
        </div>

        <TelephonySubnav active="settings" />

        {/* ── IP-телефония ────────────────────────────────────────────── */}
        <div className="ha-section">
          <div className="ha-section-head"><div><h3>{t('crm.telephony.settings.voice.title')}</h3><div className="sub">{t('crm.telephony.settings.voice.subtitle')}</div></div></div>

          {telLoading ? (
            <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{t('crm.telephony.settings.voice.loading')}</p>
          ) : !addonEnabled ? (
            <div className="provider-card">
              <div className="provider-logo">TW</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Twilio Voice</div>
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.telephony.settings.voice.addonPriceNote')}</div>
              </div>
              <div className="provider-status">
                <button className="btn btn-primary btn-sm" onClick={handleActivate} disabled={activating}>{activating ? t('crm.telephony.settings.voice.connectingBtn') : t('crm.telephony.settings.voice.connectBtn')}</button>
              </div>
            </div>
          ) : (
            <>
              {includedInPlan && (
                <p style={{ fontSize: 12, color: '#1f8a5e', marginBottom: 10 }}>{t('crm.telephony.settings.voice.planIncludedNote')}</p>
              )}
              <div className="provider-card">
                <div className="provider-logo">TW</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>Twilio Voice {telConfig?.voiceNumber ? `· ${telConfig.voiceNumber}` : ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                    {telConfig ? (telConfig.isEnabled ? t('crm.telephony.settings.voice.connectedActive') : t('crm.telephony.settings.voice.connectedDisabled')) : t('crm.telephony.settings.voice.notConfigured')}
                  </div>
                </div>
                <div className="provider-status">
                  {telConfig && <span className="bk-badge confirmed">{telConfig.isEnabled ? t('crm.telephony.settings.voice.statusActive') : t('crm.telephony.settings.voice.statusDisabled')}</span>}
                  {telConfig && <button className="btn btn-sm" style={{ color: '#9a1f31', borderColor: '#f0c8cf' }} onClick={handleDeleteTelephony}>{t('crm.telephony.settings.voice.disconnectBtn')}</button>}
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gap: 10, maxWidth: 480 }}>
                {telConfig?.accountSid && (
                  <p style={{ fontSize: 11.5, color: 'var(--fg-3)', background: 'var(--bg-muted)', borderRadius: 8, padding: '8px 10px' }}>
                    {t('crm.telephony.settings.voice.credentialsSavedHint')}
                  </p>
                )}
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.telephony.settings.voice.accountSidLabel')}
                  <input style={inputStyle} value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autoComplete="off" />
                </label>
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.telephony.settings.voice.authTokenLabel')}
                  <input type="password" style={inputStyle} value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="••••••••••••••••••••••••••••••••" autoComplete="off" />
                </label>
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.telephony.settings.voice.voiceNumberLabel')}
                  <input style={inputStyle} value={voiceNumber} onChange={(e) => setVoiceNumber(e.target.value)} placeholder="+19998887766" />
                </label>
                <label style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.telephony.settings.voice.forwardNumbersLabel')}
                  <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={forwardNumbersText} onChange={(e) => setForwardNumbersText(e.target.value)} placeholder={'+79991234567\n+79997654321'} />
                </label>
                <p style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                  {t('crm.telephony.settings.voice.forwardNumbersHint')}
                </p>

                <div className="tel-num-row" style={{ background: 'var(--bg-muted)', border: 'none' }}>
                  <span style={{ fontSize: 11.5 }}>{t('crm.telephony.settings.voice.recordingHint')}</span>
                </div>

                {telConfig?.inboundWebhookUrl && (
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>{t('crm.telephony.settings.voice.inboundTitle')}</p>
                    <p style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>
                      {t('crm.telephony.settings.voice.inboundHint')}
                    </p>
                    <code style={{ display: 'block', background: 'var(--bg-muted)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 11, wordBreak: 'break-all' }}>
                      {telConfig.inboundWebhookUrl}
                    </code>
                  </div>
                )}

                {telError && <p style={{ fontSize: 11.5, color: '#cc2f47' }}>{telError}</p>}
                {telSuccess && <p style={{ fontSize: 11.5, color: '#1f8a5e' }}>{t('crm.telephony.settings.voice.saveSuccess')}</p>}
                <div>
                  <button className="btn btn-primary" onClick={handleSaveTelephony} disabled={telSaving}>{telSaving ? t('crm.telephony.settings.voice.savingBtn') : t('crm.telephony.settings.voice.saveBtn')}</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── SMS-провайдер ────────────────────────────────────────────── */}
        <div className="ha-section">
          <div className="ha-section-head"><div><h3>{t('crm.telephony.settings.sms.title')}</h3><div className="sub">{t('crm.telephony.settings.sms.subtitle')}</div></div></div>

          {smsLoading ? (
            <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{t('crm.telephony.settings.sms.loading')}</p>
          ) : (
            <>
              {smsConfig && (
                <div className="provider-card">
                  <div className="provider-logo">{SMS_PROVIDERS.find((p) => p.value === smsConfig.provider)?.logo}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{SMS_PROVIDERS.find((p) => p.value === smsConfig.provider)?.label ?? smsConfig.provider}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                      {smsConfig.isEnabled ? t('crm.telephony.settings.sms.connectedActive') : t('crm.telephony.settings.sms.connectedDisabled')}
                      {smsConfig.senderName ? ` · ${t('crm.telephony.settings.sms.signatureSuffix', { name: smsConfig.senderName })}` : ''}
                    </div>
                  </div>
                  <div className="provider-status">
                    <span className="bk-badge confirmed">{smsConfig.isEnabled ? t('crm.telephony.settings.sms.statusActive') : t('crm.telephony.settings.sms.statusDisabled')}</span>
                    <button className="btn btn-sm" style={{ color: '#9a1f31', borderColor: '#f0c8cf' }} onClick={handleDeleteSms} disabled={smsDeleting}>{smsDeleting ? t('crm.telephony.settings.sms.disconnectingBtn') : t('crm.telephony.settings.sms.disconnectBtn')}</button>
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
                    {t('crm.telephony.settings.sms.credentialsSavedHint')}
                  </p>
                )}
                {smsProviderDef.fields.map((field) => (
                  <label key={field.key} style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                    {t(field.labelKey)}
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
                  {t('crm.telephony.settings.sms.globalSenderLabel')}
                  <input style={inputStyle} maxLength={64} value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Lumiva" />
                </label>

                <div className="provider-card" style={{ marginBottom: 0 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t('crm.telephony.settings.sms.activeToggleTitle')}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.telephony.settings.sms.activeToggleHint')}</div>
                  </div>
                  <div className="provider-status">
                    <div className={smsIsEnabled ? 'tel-switch on' : 'tel-switch'} onClick={() => setSmsIsEnabled(!smsIsEnabled)}><i /></div>
                  </div>
                </div>

                {smsConfig?.inboundWebhookUrl && smsConfig.provider === 'twilio' && (
                  <div>
                    <p style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>{t('crm.telephony.settings.sms.inboundTitle')}</p>
                    <p style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>
                      {t('crm.telephony.settings.sms.inboundHint')}
                    </p>
                    <code style={{ display: 'block', background: 'var(--bg-muted)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 11, wordBreak: 'break-all' }}>
                      {smsConfig.inboundWebhookUrl}
                    </code>
                  </div>
                )}

                {smsError && <p style={{ fontSize: 11.5, color: '#cc2f47' }}>{smsError}</p>}
                {smsSuccess && <p style={{ fontSize: 11.5, color: '#1f8a5e' }}>{t('crm.telephony.settings.sms.saveSuccess')}</p>}
                <div>
                  <button className="btn btn-primary" onClick={handleSaveSms} disabled={smsSaving}>{smsSaving ? t('crm.telephony.settings.sms.savingBtn') : t('crm.telephony.settings.sms.saveBtn')}</button>
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
