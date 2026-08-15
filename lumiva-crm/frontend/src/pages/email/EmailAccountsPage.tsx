// src/pages/email/EmailAccountsPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailAccounts,
  deleteEmailAccount,
  testSmtpConnection,
  startEmailOAuthGoogle,
  startEmailOAuthMicrosoft,
  syncEmailMailboxNow,
  patchEmailAccountIngestion,
  patchEmailAccountSignature,
  type EmailAccount,
} from '../../api/email';
import { CrmShellModal } from '../../components/ui/CrmShellModal';
import { EmailRichEditor } from './EmailRichEditor';
import { useAlertModal } from '../../contexts/AlertModalContext';

export const EmailAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showConfirm } = useAlertModal();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    variant?: 'info' | 'error';
  } | null>(null);
  const [oauthBusy, setOauthBusy] = useState<'gmail' | 'outlook' | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [ingestionOpenId, setIngestionOpenId] = useState<string | null>(null);
  const [ingestionAuto, setIngestionAuto] = useState(true);
  const [ingestionDomains, setIngestionDomains] = useState('');
  const [ingestionSaving, setIngestionSaving] = useState(false);
  const [signatureOpenId, setSignatureOpenId] = useState<string | null>(null);
  const [signatureDraftHtml, setSignatureDraftHtml] = useState('');
  const [signatureSaving, setSignatureSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmailAccounts();
      setAccounts(data);
    } catch (e: any) {
      setError(e.message || t('crm.email.accounts.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (oauth === 'connected') {
      const provider = searchParams.get('provider');
      const label =
        provider === 'gmail'
          ? t('crm.email.accounts.oauthProviderGmail')
          : provider === 'outlook'
            ? t('crm.email.accounts.oauthProviderOutlook')
            : '';
      setNotice({
        title: t('crm.common.modalNotice'),
        message: label
          ? `${t('crm.email.accounts.oauthConnected')} (${label})`
          : t('crm.email.accounts.oauthConnected'),
        variant: 'info',
      });
      searchParams.delete('oauth');
      searchParams.delete('provider');
      setSearchParams(searchParams, { replace: true });
      void loadAccounts();
    } else if (oauth === 'error') {
      setNotice({
        title: t('crm.common.modalError'),
        message: `${t('crm.email.accounts.oauthError')}\n\n${t('crm.email.accounts.adminHintBody')}`,
        variant: 'error',
      });
      searchParams.delete('oauth');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, t, loadAccounts]);

  const openIngestion = (account: EmailAccount) => {
    const li = account.meta?.leadIngestion;
    setIngestionOpenId(account.id);
    setIngestionAuto(li?.autoCreateFromUnknown !== false);
    setIngestionDomains(Array.isArray(li?.skipDomains) ? li!.skipDomains!.join(', ') : '');
  };

  const toggleSignature = (account: EmailAccount) => {
    if (signatureOpenId === account.id) {
      setSignatureOpenId(null);
      return;
    }
    setSignatureOpenId(account.id);
    setSignatureDraftHtml(account.meta?.signatureHtml || '<p></p>');
  };

  const saveSignature = async (id: string) => {
    setSignatureSaving(true);
    try {
      await patchEmailAccountSignature(id, {
        signatureHtml: signatureDraftHtml?.replace(/<p><\/p>/g, '').trim() ? signatureDraftHtml : null,
      });
      setNotice({
        title: t('crm.common.modalNotice'),
        message: t('crm.email.accounts.signatureSaved'),
        variant: 'info',
      });
      await loadAccounts();
    } catch (e: any) {
      setNotice({
        title: t('crm.common.modalError'),
        message: e?.message || t('crm.email.accounts.signatureSaveError'),
        variant: 'error',
      });
    } finally {
      setSignatureSaving(false);
    }
  };

  const saveIngestion = async (accountId: string) => {
    setIngestionSaving(true);
    try {
      const skipDomains = ingestionDomains
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await patchEmailAccountIngestion(accountId, {
        autoCreateFromUnknown: ingestionAuto,
        skipDomains,
      });
      setNotice({
        title: t('crm.common.modalNotice'),
        message: t('crm.email.accounts.ingestionSaved'),
        variant: 'info',
      });
      await loadAccounts();
    } catch (e: any) {
      setNotice({
        title: t('crm.common.modalError'),
        message: e?.message || t('crm.email.accounts.ingestionSaveError'),
        variant: 'error',
      });
    } finally {
      setIngestionSaving(false);
    }
  };

  const handleCreate = () => navigate('/email/accounts/new');
  const handleEdit = (id: string) => navigate(`/email/accounts/${id}`);
  const handleDelete = async (id: string) => {
    const ok = await showConfirm(t('crm.email.accounts.deleteConfirm'), {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEmailAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setNotice({
        title: t('crm.common.modalError'),
        message: err.message || t('crm.email.accounts.errors.deleteFailed'),
        variant: 'error',
      });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testSmtpConnection(id);
      if (result.success) {
        setNotice({
          title: t('crm.common.modalNotice'),
          message: t('crm.email.form.success.testSuccess'),
          variant: 'info',
        });
        void loadAccounts();
      } else {
        setNotice({
          title: t('crm.common.modalError'),
          message: `${t('crm.email.form.errors.testFailed')}: ${result.error || result.message || t('crm.email.form.errors.unknown')}`,
          variant: 'error',
        });
        void loadAccounts();
      }
    } catch (err: any) {
      console.error('SMTP test error:', err);
      setNotice({
        title: t('crm.common.modalError'),
        message: err.message || t('crm.email.form.errors.testFailed'),
        variant: 'error',
      });
      void loadAccounts();
    }
  };

  const connectGoogle = async () => {
    setOauthBusy('gmail');
    try {
      const { url } = await startEmailOAuthGoogle();
      window.location.href = url;
    } catch (e: any) {
      const base = e?.message || t('crm.email.accounts.oauthError');
      const hint =
        typeof base === 'string' && base.includes('PUBLIC_API_URL')
          ? `${base}\n\n---\n${t('crm.email.accounts.adminHintBody')}`
          : base;
      setNotice({ title: t('crm.common.modalError'), message: hint, variant: 'error' });
      setOauthBusy(null);
    }
  };

  const connectMicrosoft = async () => {
    setOauthBusy('outlook');
    try {
      const { url } = await startEmailOAuthMicrosoft();
      window.location.href = url;
    } catch (e: any) {
      const base = e?.message || t('crm.email.accounts.oauthError');
      const hint =
        typeof base === 'string' && base.includes('PUBLIC_API_URL')
          ? `${base}\n\n---\n${t('crm.email.accounts.adminHintBody')}`
          : base;
      setNotice({ title: t('crm.common.modalError'), message: hint, variant: 'error' });
      setOauthBusy(null);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await syncEmailMailboxNow(id);
      await loadAccounts();
    } catch (e: any) {
      setNotice({
        title: t('crm.common.modalError'),
        message: e?.message || 'Sync failed',
        variant: 'error',
      });
    } finally {
      setSyncingId(null);
    }
  };

  const pillOutline =
    'rounded-full border border-slate-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-slate-800/35 hover:bg-slate-50';
  const pillGmail =
    'rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50';
  const pillOutlook =
    'rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50';
  const pillPrimary =
    'rounded-full border border-lumiva-accent bg-lumiva-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-lumiva-accent-soft';
  const pillSoftRose =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-2.5 py-1 text-[10px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] transition-colors';
  const pillSync =
    'rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-sky-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50';

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1100px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-lumiva-accent">{t('crm.email.accounts.title')}</h1>
            <p className="mt-1 max-w-xl text-[13px] leading-snug text-slate-500">{t('crm.email.accounts.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link to="/email/inbox" className={pillOutline}>
              {t('crm.email.accounts.openInbox')}
            </Link>
            <button type="button" onClick={() => void connectGoogle()} disabled={oauthBusy !== null} className={pillGmail}>
              {oauthBusy === 'gmail' ? t('crm.email.accounts.oauthWorking') : t('crm.email.accounts.connectGmail')}
            </button>
            <button type="button" onClick={() => void connectMicrosoft()} disabled={oauthBusy !== null} className={pillOutlook}>
              {oauthBusy === 'outlook' ? t('crm.email.accounts.oauthWorking') : t('crm.email.accounts.connectOutlook')}
            </button>
            <button type="button" onClick={handleCreate} className={pillPrimary}>
              + {t('crm.email.accounts.create')}
            </button>
          </div>
        </div>

        <p className="text-[12px] text-slate-500">{t('crm.email.accounts.oauthHint')}</p>

        <details className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
          <summary className="cursor-pointer select-none font-semibold text-slate-800 marker:text-slate-400">
            {t('crm.email.accounts.adminHintTitle')}
          </summary>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-600">{t('crm.email.accounts.adminHintBody')}</p>
          <Link to="/settings/api" className="mt-2 inline-block text-[11px] font-semibold text-slate-800 underline-offset-2 hover:underline">
            {t('crm.nav.settingsApi')} →
          </Link>
        </details>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-900">{error}</div>
        )}

        {loading && !error && <div className="text-sm text-slate-500">{t('crm.email.accounts.loading')}</div>}

        {!loading && !error && accounts.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mb-2 text-sm font-medium text-slate-800">{t('crm.email.accounts.empty')}</div>
            <div className="mb-6 text-xs text-slate-500">{t('crm.email.accounts.emptyHint')}</div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => void connectGoogle()} className={pillGmail}>
                {t('crm.email.accounts.connectGmail')}
              </button>
              <button type="button" onClick={() => void connectMicrosoft()} className={pillOutlook}>
                {t('crm.email.accounts.connectOutlook')}
              </button>
              <button type="button" onClick={handleCreate} className={pillPrimary}>
                {t('crm.email.accounts.createFirst')}
              </button>
            </div>
          </div>
        )}

        {!loading && !error && accounts.length > 0 && (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[15px] font-semibold text-lumiva-accent">{account.email}</h3>
                      {account.name && <span className="flex-shrink-0 text-xs text-slate-500">({account.name})</span>}
                      <span
                        className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          account.status === 'active'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border border-rose-200 bg-rose-50 text-rose-900'
                        }`}
                      >
                        {account.status === 'active' ? t('crm.email.accounts.statusActive') : t('crm.email.accounts.statusError')}
                      </span>
                      {account.hasOAuthTokens && account.oauthProvider === 'gmail' && (
                        <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-800">
                          {t('crm.email.accounts.oauthProviderGmail')}
                        </span>
                      )}
                      {account.hasOAuthTokens && account.oauthProvider === 'outlook' && (
                        <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-900">
                          {t('crm.email.accounts.oauthProviderOutlook')}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">
                      {account.smtpHost && (
                        <div>
                          <span className="text-slate-400">SMTP</span>{' '}
                          <span className="font-medium text-slate-800">
                            {account.smtpHost}:{account.smtpPort}
                          </span>
                        </div>
                      )}
                      {account.imapHost && (
                        <div>
                          <span className="text-slate-400">IMAP</span>{' '}
                          <span className="font-medium text-slate-800">
                            {account.imapHost}:{account.imapPort}
                          </span>
                        </div>
                      )}
                      {account.lastSyncAt && (
                        <div>
                          <span className="text-slate-400">{t('crm.email.accounts.lastSync')}</span>{' '}
                          <span className="font-medium text-slate-800">{new Date(account.lastSyncAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {account.lastError && (
                      <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50/80 px-2 py-1.5 text-[11px] text-rose-900">
                        {t('crm.email.accounts.error')}: {account.lastError}
                      </div>
                    )}

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => toggleSignature(account)}
                        className="text-[12px] font-semibold text-slate-800 transition hover:text-lumiva-accent"
                      >
                        {signatureOpenId === account.id ? '▼ ' : '▶ '}
                        {t('crm.email.accounts.signatureTitle')}
                      </button>
                      {signatureOpenId === account.id && (
                        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-[11px] text-slate-500">{t('crm.email.accounts.signatureHint')}</p>
                          <EmailRichEditor
                            key={`sig-${account.id}`}
                            variant="light"
                            content={signatureDraftHtml}
                            onChange={(html) => setSignatureDraftHtml(html)}
                            placeholder={t('crm.email.accounts.signatureHint')}
                          />
                          <button
                            type="button"
                            disabled={signatureSaving}
                            onClick={() => void saveSignature(account.id)}
                            className={pillPrimary + ' px-4 py-2 text-[11px] disabled:opacity-50'}
                          >
                            {signatureSaving ? '…' : t('crm.email.accounts.signatureSave')}
                          </button>
                        </div>
                      )}
                    </div>

                    {account.hasOAuthTokens && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (ingestionOpenId === account.id) setIngestionOpenId(null);
                            else openIngestion(account);
                          }}
                          className="text-[12px] font-semibold text-slate-800 transition hover:text-lumiva-accent"
                        >
                          {ingestionOpenId === account.id ? '▼ ' : '▶ '}
                          {t('crm.email.accounts.ingestionTitle')}
                        </button>
                        {ingestionOpenId === account.id && (
                          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-800">
                              <input
                                type="checkbox"
                                checked={ingestionAuto}
                                onChange={(e) => setIngestionAuto(e.target.checked)}
                                className="rounded border-slate-300 text-lumiva-accent"
                              />
                              {t('crm.email.accounts.autoCreate')}
                            </label>
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                {t('crm.email.accounts.skipDomains')}
                              </label>
                              <input
                                type="text"
                                value={ingestionDomains}
                                onChange={(e) => setIngestionDomains(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-slate-400"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={ingestionSaving}
                              onClick={() => void saveIngestion(account.id)}
                              className={pillPrimary + ' px-4 py-2 text-[11px] disabled:opacity-50'}
                            >
                              {ingestionSaving ? '…' : t('crm.email.accounts.saveIngestion')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                    {account.hasOAuthTokens && (
                      <button
                        type="button"
                        disabled={syncingId === account.id}
                        onClick={() => void handleSync(account.id)}
                        className={pillSync}
                      >
                        {syncingId === account.id ? '…' : t('crm.email.accounts.syncNow')}
                      </button>
                    )}
                    {account.smtpHost && (
                      <button
                        type="button"
                        onClick={() => void handleTest(account.id)}
                        className={pillOutline + ' px-2.5 py-1 text-[10px]'}
                        title={t('crm.email.accounts.test')}
                      >
                        {t('crm.email.accounts.test')}
                      </button>
                    )}
                    <button type="button" onClick={() => handleEdit(account.id)} className={pillPrimary + ' px-2.5 py-1 text-[10px]'}>
                      {t('crm.email.accounts.edit')}
                    </button>
                    <button type="button" onClick={() => void handleDelete(account.id)} className={pillSoftRose}>
                      {t('crm.email.accounts.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CrmShellModal
        open={!!notice}
        title={notice?.title || ''}
        message={notice?.message || ''}
        variant={notice?.variant === 'error' ? 'error' : 'info'}
        onClose={() => setNotice(null)}
      />
    </MainLayout>
  );
};
