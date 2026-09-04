// src/pages/email/EmailAccountFormPage.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  fetchEmailAccount,
  createEmailAccount,
  updateEmailAccount,
  testSmtpConnection,
  patchEmailAccountIngestion,
  startEmailOAuthGoogle,
  startEmailOAuthMicrosoft,
  type EmailAccount,
  type CreateEmailAccountDto,
} from '../../api/email';
import { Ic, EM_ICON } from './EmailSettingsIcons';
import './email-settings-design.css';
import './email-account-new-design.css';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

type PresetKey = 'gmail' | 'outlook' | 'manual' | 'yandex' | 'mailru';

interface Preset {
  k: PresetKey;
  mark: string;
  cls?: string;
  oauth?: boolean;
  smtp?: [string, number, boolean];
  imap?: [string, number];
}

const PRESETS: Preset[] = [
  { k: 'gmail', mark: 'GM', cls: 'gmail', oauth: true },
  { k: 'outlook', mark: 'OL', cls: 'outlook', oauth: true },
  { k: 'manual', mark: 'SM', smtp: ['', 587, false], imap: ['', 993] },
  { k: 'yandex', mark: 'YA', smtp: ['smtp.yandex.ru', 465, true], imap: ['imap.yandex.ru', 993] },
  { k: 'mailru', mark: 'MR', smtp: ['smtp.mail.ru', 465, true], imap: ['imap.mail.ru', 993] },
];

function matchPreset(account: EmailAccount): PresetKey {
  if (account.oauthProvider === 'gmail') return 'gmail';
  if (account.oauthProvider === 'outlook') return 'outlook';
  const host = (account.smtpHost || '').toLowerCase();
  const found = PRESETS.find((p) => !p.oauth && p.smtp && p.smtp[0] && p.smtp[0] === host);
  return found ? found.k : 'manual';
}

function Sw({ on, set, disabled }: { on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" className={cx('em-sw', on && 'on')} onClick={() => set(!on)} disabled={disabled} aria-pressed={on}>
      <i />
    </button>
  );
}

function Opt({ t, s, on, set, disabled }: { t: string; s: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="em-opt">
      <div className="tx">
        <b>{t}</b>
        <span>{s}</span>
      </div>
      <Sw on={on} set={set} disabled={disabled} />
    </div>
  );
}

export const EmailAccountFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();

  const PRESET_META: Record<PresetKey, { title: string; desc: string }> = {
    gmail: { title: t('crm.email.form.presets.gmail.title'), desc: t('crm.email.form.presets.gmail.desc') },
    outlook: { title: t('crm.email.form.presets.outlook.title'), desc: t('crm.email.form.presets.outlook.desc') },
    manual: { title: t('crm.email.form.presets.manual.title'), desc: t('crm.email.form.presets.manual.desc') },
    yandex: { title: t('crm.email.form.presets.yandex.title'), desc: t('crm.email.form.presets.yandex.desc') },
    mailru: { title: t('crm.email.form.presets.mailru.title'), desc: t('crm.email.form.presets.mailru.desc') },
  };

  const [loading, setLoading] = useState<boolean>(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<EmailAccount | null>(null);

  const [prov, setProv] = useState<PresetKey>('manual');
  const [addr, setAddr] = useState('');
  const [name, setName] = useState('');

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showSmtpPw, setShowSmtpPw] = useState(false);

  const [imapOn, setImapOn] = useState(true);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapSecure, setImapSecure] = useState(true);
  const [syncFolder, setSyncFolder] = useState('INBOX');
  const [same, setSame] = useState(true);
  const [imapUsername, setImapUsername] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [showImapPw, setShowImapPw] = useState(false);
  const [leads, setLeads] = useState(true);

  const [oauthBusy, setOauthBusy] = useState<'gmail' | 'outlook' | null>(null);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<null | { ok: boolean; msg: string }>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchEmailAccount(id)
      .then((a) => {
        setAccount(a);
        setProv(matchPreset(a));
        setAddr(a.email);
        setName(a.name || '');
        setSmtpHost(a.smtpHost || '');
        setSmtpPort(a.smtpPort || 465);
        setSmtpSecure(a.smtpSecure);
        setSmtpUsername(a.smtpUsername || '');
        setImapOn(a.syncIncoming);
        setImapHost(a.imapHost || '');
        setImapPort(a.imapPort || 993);
        setImapSecure(a.imapSecure);
        setSyncFolder(a.syncFolder || 'INBOX');
        const sameCreds = !a.imapUsername || a.imapUsername === a.smtpUsername;
        setSame(sameCreds);
        setImapUsername(sameCreds ? '' : a.imapUsername || '');
        setLeads(a.meta?.leadIngestion?.autoCreateFromUnknown !== false);
      })
      .catch((e: any) => setError(e.message || t('crm.email.form.errors.loadAccount')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const p = PRESETS.find((x) => x.k === prov) || PRESETS[2];
  const pMeta = PRESET_META[p.k];
  const ready = !!addr && !!name;
  const isOAuthAccount = !!(id && account?.oauthProvider);
  const presets = isOAuthAccount || !id ? PRESETS : PRESETS.filter((x) => !x.oauth);

  const choosePreset = (k: PresetKey) => {
    setProv(k);
    setTested(null);
    const preset = PRESETS.find((x) => x.k === k);
    if (preset && !preset.oauth && preset.smtp) {
      setSmtpHost(preset.smtp[0]);
      setSmtpPort(preset.smtp[1]);
      setSmtpSecure(preset.smtp[2]);
      if (preset.imap) {
        setImapHost(preset.imap[0]);
        setImapPort(preset.imap[1]);
      }
    }
  };

  const connectGoogle = async () => {
    setOauthBusy('gmail');
    try {
      const { url } = await startEmailOAuthGoogle();
      window.location.href = url;
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.form.errors.connectGmail'), { variant: 'error' });
      setOauthBusy(null);
    }
  };

  const connectMicrosoft = async () => {
    setOauthBusy('outlook');
    try {
      const { url } = await startEmailOAuthMicrosoft();
      window.location.href = url;
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.form.errors.connectOutlook'), { variant: 'error' });
      setOauthBusy(null);
    }
  };

  const runTest = async () => {
    if (!id) return;
    setTesting(true);
    try {
      const res = await testSmtpConnection(id);
      setTested({
        ok: res.success,
        msg: res.success ? t('crm.email.form.test.successMsg') : res.error || t('crm.email.form.test.failedGeneric'),
      });
    } catch (e: any) {
      setTested({ ok: false, msg: e?.message || t('crm.email.form.test.error') });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const dto: CreateEmailAccountDto = {
        email: addr,
        name,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUsername,
        syncOutgoing: true,
        syncIncoming: imapOn,
        syncFolder: syncFolder || 'INBOX',
      };
      if (smtpPassword) dto.smtpPassword = smtpPassword;
      if (imapOn) {
        dto.imapHost = imapHost;
        dto.imapPort = imapPort;
        dto.imapSecure = imapSecure;
        dto.imapUsername = same ? smtpUsername : imapUsername;
        const imapPw = same ? smtpPassword : imapPassword;
        if (imapPw) dto.imapPassword = imapPw;
      }

      const saved = id ? await updateEmailAccount(id, dto) : await createEmailAccount(dto);
      await patchEmailAccountIngestion(saved.id, { autoCreateFromUnknown: leads }).catch(() => {});

      if (id) {
        setAccount(saved);
        setSmtpPassword('');
        setImapPassword('');
        showAlert(t('crm.email.form.success.savedEdit'), { variant: 'success' });
      } else {
        navigate(`/email/accounts/${saved.id}`, { replace: true });
        showAlert(t('crm.email.form.success.savedCreate'), { variant: 'success' });
      }
    } catch (err: any) {
      setError(err.message || t('crm.email.form.errors.saveAccount'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-text-tertiary">{t('crm.email.form.loading')}</div>
      </MainLayout>
    );
  }

  // ---------- OAuth-account edit view (no SMTP/IMAP fields to manage) ----------
  if (isOAuthAccount && account) {
    const providerLabel = account.oauthProvider === 'gmail' ? 'Google' : 'Microsoft';
    return (
      <MainLayout>
        <PageHelpButton topic="emailAccountForm" />
        <div className="px-scope">
          <div className="em-hero" style={{ marginBottom: 16 }}>
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('crm.email.form.oauthEdit.kicker')}
              </div>
              <h1>{account.name || account.email}</h1>
              <p className="sub">{t('crm.email.form.oauthEdit.connectedVia', { provider: providerLabel })}</p>
            </div>
            <div className="em-hero-r">
              <Link className="em-btn" to="/email">
                <Ic d={EM_ICON.back} size={14} />
                {t('crm.email.form.oauthEdit.backToAccounts')}
              </Link>
            </div>
          </div>

          {error && (
            <div className="na-bad" style={{ marginBottom: 14 }}>
              <Ic d={EM_ICON.warn} size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="na-split">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.user} size={14} />
                    {t('crm.email.form.oauthEdit.basicInfoTitle')}
                  </span>
                </div>
                <div className="em-panel-b">
                  <div className="em-grid2">
                    <div>
                      <span className="em-fl">{t('crm.email.form.oauthEdit.emailLabel')}</span>
                      <input className="em-in" value={account.email} disabled />
                      <div className="em-hint">{t('crm.email.form.oauthEdit.emailManagedBy', { provider: providerLabel })}</div>
                    </div>
                    <div>
                      <span className="em-fl">{t('crm.email.form.oauthEdit.nameLabel')}</span>
                      <input className="em-in" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('crm.email.form.oauthEdit.namePlaceholder')} />
                      <div className="em-hint">{t('crm.email.form.oauthEdit.nameHint')}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.bolt} size={14} />
                    {t('crm.email.form.oauthEdit.leadsTitle')}
                  </span>
                </div>
                <div className="em-panel-b">
                  <Opt
                    t={t('crm.email.form.oauthEdit.leadsOptTitle')}
                    s={t('crm.email.form.oauthEdit.leadsOptHint')}
                    on={leads}
                    set={setLeads}
                  />
                </div>
              </div>
            </div>

            <div className="na-side">
              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.shield} size={14} />
                    {t('crm.email.form.oauthEdit.oauthAccessTitle')}
                  </span>
                </div>
                <div className="em-panel-b na-sec">
                  <p>{t('crm.email.form.oauthEdit.oauthAccessP1', { provider: providerLabel })}</p>
                  <p>{t('crm.email.form.oauthEdit.oauthAccessP2')}</p>
                  <button
                    type="button"
                    className="em-btn"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 11 }}
                    disabled={oauthBusy !== null}
                    onClick={() => void (account.oauthProvider === 'gmail' ? connectGoogle() : connectMicrosoft())}
                  >
                    <Ic d={EM_ICON.refresh} size={13} />
                    {oauthBusy ? t('crm.email.form.oauthEdit.reconnectPending') : t('crm.email.form.oauthEdit.reconnect')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="na-bar">
            <span className="h">{t('crm.email.form.oauthEdit.footNote')}</span>
            <Link className="em-btn" to="/email">
              {t('crm.email.form.oauthEdit.cancel')}
            </Link>
            <button type="button" className="em-btn solid" disabled={saving} onClick={handleSubmit}>
              <Ic d={EM_ICON.check} size={14} />
              {saving ? t('crm.email.form.oauthEdit.savePending') : t('crm.email.form.oauthEdit.save')}
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ---------- Manual SMTP/IMAP create-or-edit wizard ----------
  return (
    <MainLayout>
      <PageHelpButton topic="emailAccountForm" />
      <div className="px-scope">
        <form onSubmit={handleSubmit}>
          <div className="em-hero" style={{ marginBottom: 16 }}>
            <div>
              <div className="kicker">
                <span className="dot" />
                {t('crm.email.form.wizard.emailKicker')} · {id ? t('crm.email.form.wizard.kickerEdit') : t('crm.email.form.wizard.kickerNew')}
              </div>
              <h1>{id ? t('crm.email.form.wizard.titleEdit') : t('crm.email.form.wizard.titleNew')}</h1>
              <p className="sub">{t('crm.email.form.wizard.subtitle')}</p>
            </div>
            <div className="em-hero-r">
              <Link className="em-btn" to="/email">
                <Ic d={EM_ICON.back} size={14} />
                {t('crm.email.form.wizard.backToAccounts')}
              </Link>
            </div>
          </div>

          {error && (
            <div className="na-bad" style={{ marginBottom: 14 }}>
              <Ic d={EM_ICON.warn} size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="na-split">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.bolt} size={14} />
                    {t('crm.email.form.wizard.step1Title')}
                  </span>
                  <span className="sp" />
                  <span className="em-sync">{t('crm.email.form.wizard.step1Of3')}</span>
                </div>
                <div className="em-panel-b">
                  <div className="na-prov">
                    {presets.map((x) => (
                      <button
                        key={x.k}
                        type="button"
                        className={cx('na-prov-card', prov === x.k && 'on')}
                        onClick={() => choosePreset(x.k)}
                      >
                        <span className={cx('em-mark', x.cls)}>{x.mark}</span>
                        <span className="tx">
                          <b>{PRESET_META[x.k].title}</b>
                          <i>{PRESET_META[x.k].desc}</i>
                        </span>
                        {prov === x.k && (
                          <span className="tick">
                            <Ic d={EM_ICON.check} size={11} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {p.oauth && (
                    <div className="em-info" style={{ margin: '13px 0 0' }}>
                      <Ic d={EM_ICON.shield} size={15} />
                      <span>
                        {t('crm.email.form.wizard.oauthHint', {
                          provider: pMeta.title,
                          oauthProvider: p.k === 'gmail' ? 'Google' : 'Microsoft',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.user} size={14} />
                    {t('crm.email.form.wizard.step2Title')}
                  </span>
                  <span className="sp" />
                  <span className="em-sync">{t('crm.email.form.wizard.step2Of3')}</span>
                </div>
                <div className="em-panel-b">
                  <div className="em-grid2">
                    <div>
                      <span className="em-fl">
                        {t('crm.email.form.wizard.emailLabel')} <em className="na-req">{t('crm.email.form.wizard.required')}</em>
                      </span>
                      <input
                        type="email"
                        required
                        className="em-in"
                        value={addr}
                        onChange={(e) => setAddr(e.target.value)}
                        placeholder={t('crm.email.form.wizard.emailPlaceholder')}
                      />
                    </div>
                    <div>
                      <span className="em-fl">
                        {t('crm.email.form.wizard.nameLabel')} <em className="na-req">{t('crm.email.form.wizard.required')}</em>
                      </span>
                      <input
                        type="text"
                        required
                        className="em-in"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('crm.email.form.wizard.namePlaceholder')}
                      />
                      <div className="em-hint">{t('crm.email.form.wizard.nameHint')}</div>
                    </div>
                  </div>
                </div>
              </div>

              {!p.oauth && (
                <div className="em-panel">
                  <div className="em-panel-h">
                    <span className="t">
                      <Ic d={EM_ICON.mail} size={14} />
                      {t('crm.email.form.wizard.smtpTitle')}
                    </span>
                    <span className="sp" />
                    <span className="em-sync">{t('crm.email.form.wizard.step3Of3')}</span>
                  </div>
                  <div className="em-panel-b">
                    <div className="em-grid3">
                      <div>
                        <span className="em-fl">
                          {t('crm.email.form.wizard.smtpHostLabel')} <em className="na-req">{t('crm.email.form.wizard.required')}</em>
                        </span>
                        <input
                          required
                          className="em-in mono"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder={t('crm.email.form.wizard.smtpHostPlaceholder')}
                        />
                      </div>
                      <div>
                        <span className="em-fl">{t('crm.email.form.wizard.portLabel')}</span>
                        <input
                          type="number"
                          className="em-in mono"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(parseInt(e.target.value, 10) || 465)}
                        />
                      </div>
                      <div>
                        <span className="em-fl">{t('crm.email.form.wizard.encryptionLabel')}</span>
                        <select
                          className="em-in"
                          value={smtpSecure ? 'ssl' : 'starttls'}
                          onChange={(e) => setSmtpSecure(e.target.value === 'ssl')}
                        >
                          <option value="ssl">{t('crm.email.form.wizard.encryptionSsl')}</option>
                          <option value="starttls">{t('crm.email.form.wizard.encryptionStarttls')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="em-hint">{t('crm.email.form.wizard.smtpHint')}</div>
                    <div className="em-grid2" style={{ marginTop: 12 }}>
                      <div>
                        <span className="em-fl">
                          {t('crm.email.form.wizard.smtpUserLabel')} <em className="na-req">{t('crm.email.form.wizard.required')}</em>
                        </span>
                        <input
                          required
                          className="em-in"
                          value={smtpUsername}
                          onChange={(e) => setSmtpUsername(e.target.value)}
                          placeholder={t('crm.email.form.wizard.smtpUserPlaceholder')}
                        />
                      </div>
                      <div>
                        <span className="em-fl">
                          {t('crm.email.form.wizard.smtpPasswordLabel')} {!id && <em className="na-req">{t('crm.email.form.wizard.required')}</em>}
                        </span>
                        <div className="na-pw">
                          <input
                            required={!id}
                            type={showSmtpPw ? 'text' : 'password'}
                            className="em-in mono"
                            value={smtpPassword}
                            onChange={(e) => setSmtpPassword(e.target.value)}
                            placeholder={id ? t('crm.email.form.wizard.smtpPasswordPlaceholderEdit') : t('crm.email.form.wizard.smtpPasswordPlaceholderNew')}
                          />
                          <button type="button" className="na-eye" onClick={() => setShowSmtpPw((v) => !v)}>
                            <Ic d={EM_ICON.eye} size={13} />
                          </button>
                        </div>
                        {id && <div className="em-hint">{t('crm.email.form.wizard.smtpPasswordEditHint')}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!p.oauth && (
                <div className="em-panel">
                  <div className="em-panel-h">
                    <span className="t">
                      <Ic d={EM_ICON.inbox} size={14} />
                      {t('crm.email.form.wizard.imapTitle')}
                    </span>
                    <span className="sp" />
                    <span className="em-sync">{t('crm.email.form.wizard.imapOptional')}</span>
                    <Sw on={imapOn} set={setImapOn} />
                  </div>
                  {imapOn ? (
                    <div className="em-panel-b">
                      <div className="em-grid3">
                        <div>
                          <span className="em-fl">{t('crm.email.form.wizard.imapHostLabel')}</span>
                          <input
                            className="em-in mono"
                            value={imapHost}
                            onChange={(e) => setImapHost(e.target.value)}
                            placeholder={t('crm.email.form.wizard.imapHostPlaceholder')}
                          />
                        </div>
                        <div>
                          <span className="em-fl">{t('crm.email.form.wizard.portLabel')}</span>
                          <input
                            type="number"
                            className="em-in mono"
                            value={imapPort}
                            onChange={(e) => setImapPort(parseInt(e.target.value, 10) || 993)}
                          />
                        </div>
                        <div>
                          <span className="em-fl">{t('crm.email.form.wizard.folderLabel')}</span>
                          <input className="em-in mono" value={syncFolder} onChange={(e) => setSyncFolder(e.target.value)} placeholder={t('crm.email.form.wizard.folderPlaceholder')} />
                        </div>
                      </div>
                      <div className="em-opt" style={{ marginTop: 6 }}>
                        <div className="tx">
                          <b>{t('crm.email.form.wizard.imapSecureTitle')}</b>
                          <span>{t('crm.email.form.wizard.imapSecureHint')}</span>
                        </div>
                        <Sw on={imapSecure} set={setImapSecure} />
                      </div>
                      <div className="em-opt">
                        <div className="tx">
                          <b>{t('crm.email.form.wizard.sameCredsTitle')}</b>
                          <span>{t('crm.email.form.wizard.sameCredsHint')}</span>
                        </div>
                        <Sw on={same} set={setSame} />
                      </div>
                      {!same && (
                        <div className="em-grid2" style={{ marginTop: 12 }}>
                          <div>
                            <span className="em-fl">{t('crm.email.form.wizard.imapUserLabel')}</span>
                            <input
                              className="em-in"
                              value={imapUsername}
                              onChange={(e) => setImapUsername(e.target.value)}
                              placeholder={t('crm.email.form.wizard.emailPlaceholder')}
                            />
                          </div>
                          <div>
                            <span className="em-fl">{t('crm.email.form.wizard.imapPasswordLabel')}</span>
                            <div className="na-pw">
                              <input
                                type={showImapPw ? 'text' : 'password'}
                                className="em-in mono"
                                value={imapPassword}
                                onChange={(e) => setImapPassword(e.target.value)}
                                placeholder={id ? t('crm.email.form.wizard.smtpPasswordPlaceholderEdit') : t('crm.email.form.wizard.smtpPasswordPlaceholderNew')}
                              />
                              <button type="button" className="na-eye" onClick={() => setShowImapPw((v) => !v)}>
                                <Ic d={EM_ICON.eye} size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="em-opt">
                        <div className="tx">
                          <b>{t('crm.email.form.wizard.imapLeadsOptTitle')}</b>
                          <span>{t('crm.email.form.wizard.imapLeadsOptHint')}</span>
                        </div>
                        <Sw on={leads} set={setLeads} />
                      </div>
                    </div>
                  ) : (
                    <div className="em-empty">
                      <b>{t('crm.email.form.wizard.sendOnlyTitle')}</b>
                      <p>{t('crm.email.form.wizard.sendOnlyHint')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="na-side">
              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.check} size={14} />
                    {t('crm.email.form.wizard.readinessTitle')}
                  </span>
                </div>
                <div className="em-panel-b">
                  <div className="na-steps">
                    <div className="na-step done">
                      <span className="b">
                        <Ic d={EM_ICON.check} size={11} />
                      </span>
                      <div>
                        <b>{t('crm.email.form.wizard.step1Done')}</b>
                        <i>{pMeta.title}</i>
                      </div>
                    </div>
                    <div className={cx('na-step', ready && 'done')}>
                      <span className="b">{ready ? <Ic d={EM_ICON.check} size={11} /> : '2'}</span>
                      <div>
                        <b>{t('crm.email.form.wizard.step2Label')}</b>
                        <i>{addr || t('crm.email.form.wizard.step2Empty')}</i>
                      </div>
                    </div>
                    <div className={cx('na-step', (p.oauth || (!!smtpHost && !!smtpUsername)) && 'done')}>
                      <span className="b">{p.oauth || (smtpHost && smtpUsername) ? <Ic d={EM_ICON.check} size={11} /> : '3'}</span>
                      <div>
                        <b>{p.oauth ? t('crm.email.form.wizard.step3OauthLabel') : t('crm.email.form.wizard.step3ManualLabel')}</b>
                        <i>
                          {p.oauth
                            ? t('crm.email.form.wizard.step3OauthValue')
                            : t('crm.email.form.wizard.step3ManualValue', {
                                smtpPort: smtpPort || '—',
                                imapStatus: imapOn ? imapPort || '—' : t('crm.email.form.wizard.imapDisabled'),
                              })}
                        </i>
                      </div>
                    </div>
                    <div className={cx('na-step', tested?.ok && 'done')}>
                      <span className="b">{tested?.ok ? <Ic d={EM_ICON.check} size={11} /> : '4'}</span>
                      <div>
                        <b>{t('crm.email.form.wizard.step4Label')}</b>
                        <i>{tested ? (tested.ok ? t('crm.email.form.wizard.step4Passed') : t('crm.email.form.wizard.step4Failed')) : t('crm.email.form.wizard.step4NotRun')}</i>
                      </div>
                    </div>
                  </div>
                  {!p.oauth &&
                    (id ? (
                      <button
                        type="button"
                        className="em-btn"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                        disabled={testing}
                        onClick={() => void runTest()}
                      >
                        <Ic d={EM_ICON.refresh} size={13} />
                        {testing ? t('crm.email.form.wizard.testBtnPending') : t('crm.email.form.wizard.testBtn')}
                      </button>
                    ) : (
                      <div className="em-hint" style={{ marginTop: 12 }}>
                        {t('crm.email.form.wizard.testAfterCreateHint')}
                      </div>
                    ))}
                  {tested && (
                    <div className={tested.ok ? 'na-ok' : 'na-bad'}>
                      <Ic d={tested.ok ? EM_ICON.check : EM_ICON.warn} size={14} />
                      <span>{tested.msg}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.shield} size={14} />
                    {t('crm.email.form.wizard.securityTitle')}
                  </span>
                </div>
                <div className="em-panel-b na-sec">
                  <p>{t('crm.email.form.wizard.securityP1')}</p>
                  <p>{t('crm.email.form.wizard.securityP2')}</p>
                  <p>{t('crm.email.form.wizard.securityP3')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="na-bar">
            <span className="h">
              {p.oauth ? t('crm.email.form.wizard.footOauthHint') : id ? t('crm.email.form.wizard.footEditHint') : t('crm.email.form.wizard.footNewHint')}
            </span>
            <Link className="em-btn" to="/email">
              {t('crm.email.form.wizard.cancel')}
            </Link>
            {p.oauth ? (
              <button
                type="button"
                className="em-btn solid"
                disabled={oauthBusy !== null}
                onClick={() => void (p.k === 'gmail' ? connectGoogle() : connectMicrosoft())}
              >
                <Ic d={EM_ICON.shield} size={14} />
                {oauthBusy ? t('crm.email.form.wizard.continuePending') : t('crm.email.form.wizard.continueWith', { provider: p.k === 'gmail' ? 'Google' : 'Microsoft' })}
              </button>
            ) : (
              <button type="submit" className="em-btn solid" disabled={!ready || saving}>
                <Ic d={EM_ICON.check} size={14} />
                {saving ? t('crm.email.form.wizard.savePending') : id ? t('crm.email.form.wizard.saveEdit') : t('crm.email.form.wizard.saveCreate')}
              </button>
            )}
          </div>
        </form>
      </div>
    </MainLayout>
  );
};
