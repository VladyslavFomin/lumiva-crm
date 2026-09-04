// src/pages/email/EmailAccountsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import {
  fetchEmailAccounts,
  deleteEmailAccount,
  testSmtpConnection,
  startEmailOAuthGoogle,
  startEmailOAuthMicrosoft,
  syncEmailMailboxNow,
  patchEmailAccountIngestion,
  patchEmailAccountSignature,
  updateEmailAccount,
  fetchEmailMessages,
  type EmailAccount,
  type EmailMessage,
} from '../../api/email';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { EmailRichEditor } from './EmailRichEditor';
import { Ic, EM_ICON } from './EmailSettingsIcons';
import './email-settings-design.css';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

type Pill = 'ok' | 'err' | 'idle';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Kpi({ l, v, sub, warn }: { l: string; v: React.ReactNode; sub?: string; warn?: boolean }) {
  return (
    <div className={cx('em-kpi', warn && 'warn')}>
      <div className="l">{l}</div>
      <div className="v">
        {v}
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={cx('em-sw', on && 'on')} onClick={onClick} disabled={disabled} aria-pressed={on}>
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
      <Switch on={on} onClick={() => set(!on)} disabled={disabled} />
    </div>
  );
}

// ---------- Connection sub-tab ----------

function ConnectionTab({
  account,
  onReconnect,
  onSaveIdentity,
  savingIdentity,
}: {
  account: EmailAccount;
  onReconnect: () => void;
  onSaveIdentity: (name: string) => Promise<void>;
  savingIdentity: boolean;
}) {
  const { t } = useTranslation();
  const oauth = account.oauthProvider === 'gmail' || account.oauthProvider === 'outlook';
  const [name, setName] = useState(account.name || '');

  useEffect(() => {
    setName(account.name || '');
  }, [account.id, account.name]);

  return (
    <div className="em-panel-b">
      {account.lastError && (
        <div className="em-err" style={{ marginBottom: 16 }}>
          <Ic d={EM_ICON.warn} size={15} />
          <div className="b">
            <div className="t">{t('crm.email.accounts.connection.syncStoppedTitle')}</div>
            <code>{t('crm.email.accounts.connection.errorPrefix', { error: account.lastError })}</code>
            <div className="hint">{t('crm.email.accounts.connection.retryHint')}</div>
          </div>
        </div>
      )}

      {oauth ? (
        <div className="em-fs">
          <div className="em-fs-t">
            <Ic d={EM_ICON.shield} size={14} />
            {t('crm.email.accounts.connection.oauthAccessTitle')}
            <span className="n">{t('crm.email.accounts.connection.connectedBadge')}</span>
          </div>
          <div className="em-info" style={{ marginBottom: 0 }}>
            <Ic d={EM_ICON.info} size={15} />
            <span>
              {t('crm.email.accounts.connection.connectedVia', {
                provider: account.oauthProvider === 'gmail' ? 'Google' : 'Microsoft',
              })}
            </span>
            <span className="em-info-sp" />
            <button type="button" className="em-btn sm" onClick={onReconnect}>
              {t('crm.email.accounts.connection.reconnect')}
            </button>
          </div>
        </div>
      ) : (
        <div className="em-fs">
          <div className="em-fs-t">
            <Ic d={EM_ICON.mail} size={14} />
            {t('crm.email.accounts.connection.smtpImapTitle')}
          </div>
          <div className="em-grid2">
            <div>
              <span className="em-fl">{t('crm.email.accounts.connection.smtpServer')}</span>
              <input className="em-in mono" disabled value={account.smtpHost ? `${account.smtpHost}:${account.smtpPort}` : '—'} />
            </div>
            <div>
              <span className="em-fl">{t('crm.email.accounts.connection.imapServer')}</span>
              <input className="em-in mono" disabled value={account.imapHost ? `${account.imapHost}:${account.imapPort}` : '—'} />
            </div>
          </div>
          <div className="em-row" style={{ marginTop: 11 }}>
            <Link to={`/email/accounts/${account.id}`} className="em-btn sm">
              <Ic d={EM_ICON.pen} size={12} />
              {t('crm.email.accounts.connection.editServerLink')}
            </Link>
          </div>
        </div>
      )}

      <div className="em-fs">
        <div className="em-fs-t">
          <Ic d={EM_ICON.user} size={14} />
          {t('crm.email.accounts.connection.senderTitle')}
        </div>
        <div className="em-grid2">
          <div>
            <span className="em-fl">{t('crm.email.accounts.connection.senderName')}</span>
            <input className="em-in" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <span className="em-fl">{t('crm.email.accounts.connection.senderAddress')}</span>
            <input className="em-in" disabled value={account.email} />
          </div>
        </div>
        {name !== (account.name || '') && (
          <div className="em-row" style={{ marginTop: 11 }}>
            <button type="button" className="em-btn sm solid" disabled={savingIdentity} onClick={() => void onSaveIdentity(name)}>
              {savingIdentity ? t('crm.email.accounts.connection.saveNameSaving') : t('crm.email.accounts.connection.saveName')}
            </button>
          </div>
        )}
      </div>

      <div className="em-fs">
        <div className="em-fs-t">
          <Ic d={EM_ICON.refresh} size={14} />
          {t('crm.email.accounts.connection.syncTitle')}
        </div>
        <div className="em-grid2">
          <div>
            <span className="em-fl">{t('crm.email.accounts.connection.checkFrequency')}</span>
            <input className="em-in mono" disabled value={t('crm.email.accounts.connection.checkFrequencyValue')} />
          </div>
          <div>
            <span className="em-fl">{t('crm.email.accounts.connection.lastSyncLabel')}</span>
            <input className="em-in mono" disabled value={fmtDate(account.lastSyncAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Signature sub-tab ----------

function SignatureTab({ account, onSaved }: { account: EmailAccount; onSaved: () => void }) {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [html, setHtml] = useState(account.meta?.signatureHtml || '<p></p>');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHtml(account.meta?.signatureHtml || '<p></p>');
  }, [account.id, account.meta?.signatureHtml]);

  const save = async () => {
    setSaving(true);
    try {
      const clean = html.replace(/<p><\/p>/g, '').trim() ? html : null;
      await patchEmailAccountSignature(account.id, { signatureHtml: clean });
      onSaved();
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.accounts.signature.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="em-panel-b">
      <div className="em-fs">
        <div className="em-fs-t">
          <Ic d={EM_ICON.pen} size={14} />
          {t('crm.email.accounts.signature.title')}
        </div>
        <EmailRichEditor variant="light" content={html} onChange={(v) => setHtml(v)} placeholder={t('crm.email.accounts.signature.editorPlaceholder')} />
        <div className="em-row" style={{ marginTop: 11 }}>
          <button type="button" className="em-btn sm solid" disabled={saving} onClick={() => void save()}>
            {saving ? t('crm.email.accounts.signature.savePending') : t('crm.email.accounts.signature.save')}
          </button>
        </div>
      </div>
      <div className="em-fs">
        <div className="em-fs-t">{t('crm.email.accounts.signature.previewTitle')}</div>
        <div className="em-sig-prev">
          <div className="h">{t('crm.email.accounts.signature.previewHint')}</div>
          <div className="b">
            <div className="rule" />
            <div
              dangerouslySetInnerHTML={{
                __html: html || `<span style="color:var(--fg-4)">${t('crm.email.accounts.signature.empty')}</span>`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Leads sub-tab ----------

function LeadsTab({ account, onSaved }: { account: EmailAccount; onSaved: () => void }) {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const li = account.meta?.leadIngestion;
  const [auto, setAuto] = useState(li?.autoCreateFromUnknown !== false);
  const [domains, setDomains] = useState(Array.isArray(li?.skipDomains) ? li!.skipDomains!.join(', ') : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const l = account.meta?.leadIngestion;
    setAuto(l?.autoCreateFromUnknown !== false);
    setDomains(Array.isArray(l?.skipDomains) ? l!.skipDomains!.join(', ') : '');
  }, [account.id, account.meta?.leadIngestion]);

  const save = async () => {
    setSaving(true);
    try {
      const skipDomains = domains
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await patchEmailAccountIngestion(account.id, { autoCreateFromUnknown: auto, skipDomains });
      onSaved();
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.accounts.leadsTab.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!(account.oauthProvider === 'gmail' || account.oauthProvider === 'outlook')) {
    return (
      <div className="em-panel-b">
        <div className="em-empty">
          <b>{t('crm.email.accounts.leadsTab.oauthOnlyTitle')}</b>
          <p>{t('crm.email.accounts.leadsTab.oauthOnlyHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="em-panel-b">
      <div className="em-fs">
        <div className="em-fs-t">
          <Ic d={EM_ICON.bolt} size={14} />
          {t('crm.email.accounts.leadsTab.title')}
        </div>
        <Opt
          t={t('crm.email.accounts.leadsTab.optTitle')}
          s={t('crm.email.accounts.leadsTab.optHint')}
          on={auto}
          set={setAuto}
        />
        <div style={{ marginTop: 11 }}>
          <span className="em-fl">{t('crm.email.accounts.leadsTab.skipLabel')}</span>
          <input className="em-in mono" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder={t('crm.email.accounts.leadsTab.skipPlaceholder')} />
          <div className="em-hint">{t('crm.email.accounts.leadsTab.skipHint')}</div>
        </div>
        <div className="em-row" style={{ marginTop: 14 }}>
          <button type="button" className="em-btn sm solid" disabled={saving} onClick={() => void save()}>
            {saving ? t('crm.email.accounts.leadsTab.savePending') : t('crm.email.accounts.leadsTab.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Diagnostics sub-tab ----------

function DiagTab({ account }: { account: EmailAccount }) {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [testing, setTesting] = useState(false);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const smtpTestable = !!account.smtpHost;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEmailMessages({ accountId: account.id, limit: 8 })
      .then((res) => {
        if (!cancelled) setMessages(res.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id, account.lastSyncAt]);

  const pillFor = (a: EmailAccount): [Pill, string] => {
    if (a.lastError) return ['err', t('crm.email.accounts.pill.error')];
    if (a.status === 'active') return ['ok', t('crm.email.accounts.pill.active')];
    return ['idle', t('crm.email.accounts.pill.paused')];
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const result = await testSmtpConnection(account.id);
      if (result.success) {
        showAlert(t('crm.email.accounts.diag.testSuccess'), { variant: 'success' });
      } else {
        showAlert(
          t('crm.email.accounts.diag.testErrorPrefix', { error: result.error || result.message || t('crm.email.accounts.diag.testErrorUnknown') }),
          { variant: 'error' },
        );
      }
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.accounts.diag.testErrorGeneric'), { variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const [pillCls, pillLbl] = pillFor(account);

  return (
    <div className="em-panel-b">
      <div className="em-fs">
        <div className="em-fs-t">
          <Ic d={EM_ICON.shield} size={14} />
          {t('crm.email.accounts.diag.connStateTitle')}
        </div>
        <div style={{ border: '1px solid var(--line-2)', borderRadius: 11, overflow: 'hidden' }}>
          <table className="em-tbl">
            <thead>
              <tr>
                <th>{t('crm.email.accounts.diag.checkCol')}</th>
                <th>{t('crm.email.accounts.diag.statusCol')}</th>
                <th>{t('crm.email.accounts.diag.detailsCol')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('crm.email.accounts.diag.syncRow')}</td>
                <td>
                  <span className={'em-pill ' + pillCls}>
                    <i />
                    {pillLbl}
                  </span>
                </td>
                <td>
                  <span className="m">{account.lastError || t('crm.email.accounts.diag.syncDetailsLast', { date: fmtDate(account.lastSyncAt) })}</span>
                </td>
              </tr>
              <tr>
                <td>{t('crm.email.accounts.diag.smtpRow')}</td>
                <td>
                  <span className="em-pill idle">
                    <i />
                    {smtpTestable ? t('crm.email.accounts.diag.manualCheck') : t('crm.email.accounts.diag.oauthLabel')}
                  </span>
                </td>
                <td>
                  <span className="m">{account.smtpHost ? `${account.smtpHost}:${account.smtpPort}` : t('crm.email.accounts.diag.viaOauth')}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="em-row" style={{ marginTop: 11 }}>
          {smtpTestable && (
            <button type="button" className="em-btn" disabled={testing} onClick={() => void runTest()}>
              <Ic d={EM_ICON.refresh} size={13} />
              {testing ? t('crm.email.accounts.diag.testBtnPending') : t('crm.email.accounts.diag.testBtn')}
            </button>
          )}
        </div>
      </div>
      <div className="em-fs">
        <div className="em-fs-t">{t('crm.email.accounts.diag.lastMessagesTitle')}</div>
        {loading ? (
          <div className="em-hint">{t('crm.email.accounts.diag.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="em-empty">
            <b>{t('crm.email.accounts.diag.noMessagesTitle')}</b>
            <p>{t('crm.email.accounts.diag.noMessagesHint')}</p>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--line-2)', borderRadius: 11, overflow: 'hidden' }}>
            <table className="em-tbl">
              <thead>
                <tr>
                  <th>{t('crm.email.accounts.diag.fromSubjectCol')}</th>
                  <th>{t('crm.email.accounts.diag.directionCol')}</th>
                  <th className="r">{t('crm.email.accounts.diag.whenCol')}</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.from}
                      <div className="m">{m.subject || t('crm.email.accounts.diag.noSubject')}</div>
                    </td>
                    <td>
                      <span className="m">{m.direction === 'incoming' ? t('crm.email.accounts.diag.incoming') : t('crm.email.accounts.diag.outgoing')}</span>
                    </td>
                    <td className="r">
                      <span className="m">{fmtDate(m.date)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Delivery log tab (top-level) ----------

function DeliveryLogTab() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEmailMessages({ direction: 'outgoing', limit: 40 })
      .then((res) => {
        if (!cancelled) {
          setMessages(res.items);
          setTotal(res.total);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="em-panel" style={{ marginTop: 14 }}>
      <div className="em-panel-h">
        <span className="t">
          <Ic d={EM_ICON.inbox} size={14} />
          {t('crm.email.accounts.delivery.title')}
        </span>
        <span className="sp" />
        <span className="em-sync">{t('crm.email.accounts.delivery.totalCount', { count: total })}</span>
      </div>
      <div className="em-panel-b">
        {loading ? (
          <div className="em-hint">{t('crm.email.accounts.delivery.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="em-empty">
            <b>{t('crm.email.accounts.delivery.emptyTitle')}</b>
            <p>{t('crm.email.accounts.delivery.emptyHint')}</p>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--line-2)', borderRadius: 11, overflow: 'hidden' }}>
            <table className="em-tbl">
              <thead>
                <tr>
                  <th>{t('crm.email.accounts.delivery.toCol')}</th>
                  <th>{t('crm.email.accounts.delivery.subjectCol')}</th>
                  <th className="r">{t('crm.email.accounts.delivery.sentCol')}</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td>{m.to?.join(', ') || '—'}</td>
                    <td>
                      <span className="m">{m.subject || t('crm.email.accounts.delivery.noSubject')}</span>
                    </td>
                    <td className="r">
                      <span className="m">{fmtDate(m.date)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Main page ----------

export const EmailAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sub, setSub] = useState<'conn' | 'sig' | 'leads' | 'diag'>('conn');
  const [topTab, setTopTab] = useState<'accounts' | 'delivery'>('accounts');

  const [oauthBusy, setOauthBusy] = useState<'gmail' | 'outlook' | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);

  const [sentWeek, setSentWeek] = useState<number | null>(null);
  const [leadsThisMonth, setLeadsThisMonth] = useState<number | null>(null);

  const pillFor = (a: EmailAccount): [Pill, string] => {
    if (a.lastError) return ['err', t('crm.email.accounts.pill.error')];
    if (a.status === 'active') return ['ok', t('crm.email.accounts.pill.active')];
    return ['idle', t('crm.email.accounts.pill.paused')];
  };

  const channelLabel = (a: EmailAccount): string => {
    if (a.oauthProvider === 'gmail') return t('crm.email.accounts.channelLabel.gmail');
    if (a.oauthProvider === 'outlook') return t('crm.email.accounts.channelLabel.outlook');
    return t('crm.email.accounts.channelLabel.smtpImap');
  };

  const markFor = (a: EmailAccount): { cls: string; text: string } => {
    if (a.oauthProvider === 'gmail') return { cls: 'gmail', text: 'GM' };
    if (a.oauthProvider === 'outlook') return { cls: 'outlook', text: 'OL' };
    const letters = (a.name || a.email).replace(/[^a-zA-Zа-яА-Я]/g, '').slice(0, 2).toUpperCase();
    return { cls: '', text: letters || 'SM' };
  };

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmailAccounts();
      setAccounts(data);
      setSelectedId((prev) => (prev && data.some((a) => a.id === prev) ? prev : data[0]?.id || null));
    } catch (e: any) {
      setError(e.message || t('crm.email.accounts.errors.loadAccounts'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    fetchEmailMessages({ direction: 'outgoing', dateFrom: sevenDaysAgo, limit: 1 })
      .then((res) => setSentWeek(res.total))
      .catch(() => setSentWeek(null));
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    fetchEmailMessages({ direction: 'incoming', hasLead: true, dateFrom: monthAgo, limit: 1 })
      .then((res) => setLeadsThisMonth(res.total))
      .catch(() => setLeadsThisMonth(null));
  }, [accounts.length]);

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (oauth === 'connected') {
      const provider = searchParams.get('provider');
      showAlert(
        provider
          ? t('crm.email.accounts.oauthNotice.connectedNamed', { provider: provider === 'gmail' ? 'Gmail' : 'Outlook' })
          : t('crm.email.accounts.oauthNotice.connectedGeneric'),
        { variant: 'success' },
      );
      searchParams.delete('oauth');
      searchParams.delete('provider');
      setSearchParams(searchParams, { replace: true });
      void loadAccounts();
    } else if (oauth === 'error') {
      showAlert(t('crm.email.accounts.oauthNotice.error'), { variant: 'error' });
      searchParams.delete('oauth');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const account = useMemo(() => accounts.find((a) => a.id === selectedId) || null, [accounts, selectedId]);
  const errCount = accounts.filter((a) => !!a.lastError).length;
  const activeCount = accounts.filter((a) => a.status === 'active').length;

  const connectGoogle = async () => {
    setOauthBusy('gmail');
    try {
      const { url } = await startEmailOAuthGoogle();
      window.location.href = url;
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.accounts.errors.connectGmail'), { variant: 'error' });
      setOauthBusy(null);
    }
  };

  const connectMicrosoft = async () => {
    setOauthBusy('outlook');
    try {
      const { url } = await startEmailOAuthMicrosoft();
      window.location.href = url;
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.accounts.errors.connectOutlook'), { variant: 'error' });
      setOauthBusy(null);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await syncEmailMailboxNow(id);
      await loadAccounts();
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.accounts.errors.sync'), { variant: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const targets = accounts.filter((a) => a.hasOAuthTokens);
      await Promise.allSettled(targets.map((a) => syncEmailMailboxNow(a.id)));
      await loadAccounts();
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm(t('crm.email.accounts.deleteConfirm.body'), {
      title: t('crm.email.accounts.deleteConfirm.title'),
      confirmLabel: t('crm.email.accounts.deleteConfirm.confirmLabel'),
      cancelLabel: t('crm.email.accounts.deleteConfirm.cancelLabel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEmailAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.accounts.errors.delete'), { variant: 'error' });
    }
  };

  const handleSaveIdentity = async (name: string) => {
    if (!account) return;
    setSavingIdentity(true);
    try {
      await updateEmailAccount(account.id, { name });
      await loadAccounts();
    } catch (e: any) {
      showAlert(e?.message || t('crm.email.accounts.errors.saveIdentity'), { variant: 'error' });
    } finally {
      setSavingIdentity(false);
    }
  };

  const reconnect = () => {
    if (!account) return;
    if (account.oauthProvider === 'gmail') void connectGoogle();
    else if (account.oauthProvider === 'outlook') void connectMicrosoft();
  };

  return (
    <MainLayout>
      <PageHelpButton topic="emailAccounts" />
      <div className="px-scope">
        <div className="em-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.email.accounts.hero.kicker')}
            </div>
            <h1>{t('crm.email.accounts.hero.title')}</h1>
            <p className="sub">{t('crm.email.accounts.hero.subtitle')}</p>
          </div>
          <div className="em-hero-r">
            <Link to="/email/inbox" className="em-btn">
              <Ic d={EM_ICON.inbox} size={14} />
              {t('crm.email.accounts.hero.inboxBtn')}
            </Link>
            <button type="button" className="em-btn" disabled={syncingAll || accounts.every((a) => !a.hasOAuthTokens)} onClick={() => void handleSyncAll()}>
              <Ic d={EM_ICON.refresh} size={14} />
              {syncingAll ? t('crm.email.accounts.hero.syncAllPending') : t('crm.email.accounts.hero.syncAll')}
            </button>
            <button type="button" className="em-btn solid" onClick={() => navigate('/email/accounts/new')}>
              <Ic d={EM_ICON.plus} size={14} />
              {t('crm.email.accounts.hero.createBtn')}
            </button>
          </div>
        </div>

        <div className="em-tabs">
          <button className={cx('em-tab', topTab === 'accounts' && 'active')} onClick={() => setTopTab('accounts')}>
            {t('crm.email.accounts.tabs.accounts')} <span className="n">{String(accounts.length).padStart(2, '0')}</span>
          </button>
          <Link to="/marketing/email-templates" className="em-tab">
            {t('crm.email.accounts.tabs.templates')}
          </Link>
          <Link to="/marketing/broadcasts" className="em-tab">
            {t('crm.email.accounts.tabs.broadcasts')}
          </Link>
          <button className={cx('em-tab', topTab === 'delivery' && 'active')} onClick={() => setTopTab('delivery')}>
            {t('crm.email.accounts.tabs.delivery')}
          </button>
        </div>

        <div className="em-kpis">
          <Kpi l={t('crm.email.accounts.kpis.connected')} v={activeCount} sub={t('crm.email.accounts.kpis.connectedSub', { total: accounts.length })} />
          <Kpi l={t('crm.email.accounts.kpis.sentWeek')} v={sentWeek ?? '—'} sub={t('crm.email.accounts.kpis.sentWeekSub')} />
          <Kpi l={t('crm.email.accounts.kpis.leads')} v={leadsThisMonth ?? '—'} sub={t('crm.email.accounts.kpis.leadsSub')} />
          <Kpi l={t('crm.email.accounts.kpis.errors')} v={errCount} sub={t('crm.email.accounts.kpis.errorsSub')} warn={errCount > 0} />
        </div>

        <div className="em-info">
          <Ic d={EM_ICON.info} size={15} />
          <span>{t('crm.email.accounts.infoBanner')}</span>
          <span className="em-info-sp" />
          <Link to="/integrations-hub">
            <span>{t('crm.email.accounts.integrationsLink')}</span>
            <Ic d={EM_ICON.ext} size={12} />
          </Link>
        </div>

        {error && (
          <div className="em-err" style={{ marginBottom: 14 }}>
            <Ic d={EM_ICON.warn} size={15} />
            <div className="b">
              <div className="t">{error}</div>
            </div>
          </div>
        )}

        {topTab === 'delivery' ? (
          <DeliveryLogTab />
        ) : loading ? (
          <div className="em-hint">{t('crm.email.accounts.loading')}</div>
        ) : accounts.length === 0 ? (
          <div className="em-panel">
            <div className="em-empty">
              <b>{t('crm.email.accounts.emptyState.title')}</b>
              <p>{t('crm.email.accounts.emptyState.hint')}</p>
            </div>
            <div className="em-panel-b">
              <div className="em-conn">
                <div className="em-conn-card">
                  <div className="h">
                    <span className="em-mark gmail">GM</span>
                    <b>{t('crm.email.accounts.connCards.gmail.title')}</b>
                  </div>
                  <p>{t('crm.email.accounts.connCards.gmail.desc')}</p>
                  <button type="button" className="em-btn sm" disabled={oauthBusy !== null} onClick={() => void connectGoogle()}>
                    {oauthBusy === 'gmail' ? t('crm.email.accounts.connCards.gmail.connecting') : t('crm.email.accounts.connCards.gmail.connect')}
                  </button>
                </div>
                <div className="em-conn-card">
                  <div className="h">
                    <span className="em-mark outlook">OL</span>
                    <b>{t('crm.email.accounts.connCards.outlook.title')}</b>
                  </div>
                  <p>{t('crm.email.accounts.connCards.outlook.desc')}</p>
                  <button type="button" className="em-btn sm" disabled={oauthBusy !== null} onClick={() => void connectMicrosoft()}>
                    {oauthBusy === 'outlook' ? t('crm.email.accounts.connCards.outlook.connecting') : t('crm.email.accounts.connCards.outlook.connect')}
                  </button>
                </div>
                <div className="em-conn-card">
                  <div className="h">
                    <span className="em-mark">SM</span>
                    <b>{t('crm.email.accounts.connCards.smtp.title')}</b>
                  </div>
                  <p>{t('crm.email.accounts.connCards.smtp.desc')}</p>
                  <button type="button" className="em-btn sm" onClick={() => navigate('/email/accounts/new')}>
                    {t('crm.email.accounts.connCards.smtp.configure')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="em-split">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.mail} size={14} />
                    {t('crm.email.accounts.panel.title')}
                  </span>
                  <span className="sp" />
                  <span className="em-sync">{t('crm.email.accounts.panel.activeOf', { active: activeCount, total: accounts.length })}</span>
                </div>
                <div>
                  {accounts.map((a) => {
                    const [pillCls, pillLbl] = pillFor(a);
                    const mark = markFor(a);
                    return (
                      <div key={a.id} className={cx('em-acc', selectedId === a.id && 'sel')} onClick={() => setSelectedId(a.id)}>
                        <span className={cx('em-mark', mark.cls)}>{mark.text}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="em-addr">{a.email}</div>
                          <div className="em-line2">
                            <span className={'em-pill ' + pillCls}>
                              <i />
                              {pillLbl}
                            </span>
                            <span className="em-chan">{channelLabel(a)}</span>
                            {a.name && <span className="em-name">{a.name}</span>}
                          </div>
                        </div>
                        <div className="em-r">
                          <span className="em-sync">
                            {t('crm.email.accounts.detail.lastSync')}: {fmtDate(a.lastSyncAt)}
                          </span>
                          <button
                            type="button"
                            className="em-ico"
                            title={t('crm.email.accounts.detail.delete')}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(a.id);
                            }}
                          >
                            <Ic d={EM_ICON.trash} size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="em-foot">
                  <span className="h">{t('crm.email.accounts.foot.autosave')}</span>
                  <button type="button" className="em-btn sm" onClick={() => navigate('/email/accounts/new')}>
                    <Ic d={EM_ICON.plus} size={12} />
                    {t('crm.email.accounts.foot.addSmtp')}
                  </button>
                </div>
              </div>

              <div className="em-panel">
                <div className="em-panel-h">
                  <span className="t">
                    <Ic d={EM_ICON.bolt} size={14} />
                    {t('crm.email.accounts.quickConnect')}
                  </span>
                </div>
                <div className="em-panel-b">
                  <div className="em-conn">
                    <div className="em-conn-card">
                      <div className="h">
                        <span className="em-mark gmail">GM</span>
                        <b>{t('crm.email.accounts.connCards.gmail.title')}</b>
                      </div>
                      <p>{t('crm.email.accounts.connCards.gmail.desc')}</p>
                      <button type="button" className="em-btn sm" disabled={oauthBusy !== null} onClick={() => void connectGoogle()}>
                        {oauthBusy === 'gmail' ? t('crm.email.accounts.connCards.gmail.connecting') : t('crm.email.accounts.connCards.gmail.connect')}
                      </button>
                    </div>
                    <div className="em-conn-card">
                      <div className="h">
                        <span className="em-mark outlook">OL</span>
                        <b>{t('crm.email.accounts.connCards.outlook.title')}</b>
                      </div>
                      <p>{t('crm.email.accounts.connCards.outlook.desc')}</p>
                      <button type="button" className="em-btn sm" disabled={oauthBusy !== null} onClick={() => void connectMicrosoft()}>
                        {oauthBusy === 'outlook' ? t('crm.email.accounts.connCards.outlook.connecting') : t('crm.email.accounts.connCards.outlook.connect')}
                      </button>
                    </div>
                    <div className="em-conn-card">
                      <div className="h">
                        <span className="em-mark">SM</span>
                        <b>{t('crm.email.accounts.connCards.smtp.title')}</b>
                      </div>
                      <p>{t('crm.email.accounts.connCards.smtp.desc')}</p>
                      <button type="button" className="em-btn sm" onClick={() => navigate('/email/accounts/new')}>
                        {t('crm.email.accounts.connCards.smtp.configure')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="em-panel">
              {!account ? (
                <div className="em-empty">
                  <b>{t('crm.email.accounts.detail.selectAccount.title')}</b>
                  <p>{t('crm.email.accounts.detail.selectAccount.hint')}</p>
                </div>
              ) : (
                <>
                  <div className="em-det-head">
                    <div className="em-det-top">
                      <span className={cx('em-mark', markFor(account).cls)}>{markFor(account).text}</span>
                      <div style={{ minWidth: 0 }}>
                        <h2>{account.email}</h2>
                        <div className="who">{account.name || channelLabel(account)}</div>
                      </div>
                      <div className="em-det-acts">
                        <span className={'em-pill ' + pillFor(account)[0]}>
                          <i />
                          {pillFor(account)[1]}
                        </span>
                        {account.hasOAuthTokens && (
                          <button type="button" className="em-btn sm" disabled={syncingId === account.id} onClick={() => void handleSync(account.id)}>
                            <Ic d={EM_ICON.refresh} size={12} />
                            {syncingId === account.id ? '…' : t('crm.email.accounts.detail.syncNow')}
                          </button>
                        )}
                        <button type="button" className="em-btn sm danger" onClick={() => void handleDelete(account.id)}>
                          <Ic d={EM_ICON.trash} size={12} />
                          {t('crm.email.accounts.detail.delete')}
                        </button>
                      </div>
                    </div>
                    <div className="em-det-meta">
                      <div>
                        <div className="l">{t('crm.email.accounts.detail.smtp')}</div>
                        <div className="v">{account.smtpHost ? `${account.smtpHost}:${account.smtpPort}` : 'OAuth'}</div>
                      </div>
                      <div>
                        <div className="l">{t('crm.email.accounts.detail.imap')}</div>
                        <div className="v">{account.imapHost ? `${account.imapHost}:${account.imapPort}` : 'OAuth'}</div>
                      </div>
                      <div>
                        <div className="l">{t('crm.email.accounts.detail.lastSync')}</div>
                        <div className="v">{fmtDate(account.lastSyncAt)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="em-sub">
                    {(
                      [
                        ['conn', t('crm.email.accounts.subTabs.conn')],
                        ['sig', t('crm.email.accounts.subTabs.sig')],
                        ['leads', t('crm.email.accounts.subTabs.leads')],
                        ['diag', t('crm.email.accounts.subTabs.diag')],
                      ] as const
                    ).map(([k, label]) => (
                      <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {sub === 'conn' && (
                    <ConnectionTab account={account} onReconnect={reconnect} onSaveIdentity={handleSaveIdentity} savingIdentity={savingIdentity} />
                  )}
                  {sub === 'sig' && <SignatureTab account={account} onSaved={loadAccounts} />}
                  {sub === 'leads' && <LeadsTab account={account} onSaved={loadAccounts} />}
                  {sub === 'diag' && <DiagTab account={account} />}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
