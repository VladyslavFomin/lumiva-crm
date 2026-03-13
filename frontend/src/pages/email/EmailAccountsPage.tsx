// src/pages/email/EmailAccountsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchEmailAccounts, deleteEmailAccount, testSmtpConnection, type EmailAccount } from '../../api/email';

export const EmailAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
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
  };

  const handleCreate = () => navigate('/app/email/accounts/new');
  const handleEdit = (id: string) => navigate(`/app/email/accounts/${id}`);
  const handleDelete = async (id: string) => {
    if (!confirm(t('crm.email.accounts.deleteConfirm'))) return;
    try {
      await deleteEmailAccount(id);
      setAccounts(accounts.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.message || t('crm.email.accounts.errors.deleteFailed'));
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testSmtpConnection(id);
      if (result.success) {
        alert(t('crm.email.form.success.testSuccess'));
        loadAccounts();
      } else {
        alert(`${t('crm.email.form.errors.testFailed')}: ${result.error || result.message || t('crm.email.form.errors.unknown')}`);
        loadAccounts(); // Обновляем список, чтобы увидеть обновленный статус
      }
    } catch (err: any) {
      console.error('Ошибка тестирования SMTP:', err);
      alert(err.message || t('crm.email.form.errors.testFailed'));
      loadAccounts();
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">{t('crm.email.accounts.title')}</h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.email.accounts.subtitle')}
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
          >
            + {t('crm.email.accounts.create')}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Загрузка */}
        {loading && !error && (
          <div className="text-xs text-slate-400">{t('crm.email.accounts.loading')}</div>
        )}

        {/* Пустое состояние */}
        {!loading && !error && accounts.length === 0 && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-12 text-center">
            <div className="text-sm text-slate-400 mb-2">{t('crm.email.accounts.empty')}</div>
            <div className="text-xs text-slate-500 mb-4">
              {t('crm.email.accounts.emptyHint')}
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
            >
              {t('crm.email.accounts.createFirst')}
            </button>
          </div>
        )}

        {/* Список аккаунтов */}
        {!loading && !error && accounts.length > 0 && (
          <div className="grid gap-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 hover:border-slate-700 hover:bg-slate-900/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Заголовок и статус */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-slate-50 truncate">
                        {account.email}
                      </h3>
                      {account.name && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          ({account.name})
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium flex-shrink-0 ${
                          account.status === 'active'
                            ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                            : 'bg-red-950/50 text-red-400 border border-red-800/50'
                        }`}
                      >
                        {account.status === 'active' ? t('crm.email.accounts.statusActive') : t('crm.email.accounts.statusError')}
                      </span>
                    </div>

                    {/* Информация */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      {account.smtpHost && (
                        <div>
                          <span className="text-slate-500">SMTP:</span>{' '}
                          <span className="text-slate-300">{account.smtpHost}:{account.smtpPort}</span>
                        </div>
                      )}
                      {account.imapHost && (
                        <div>
                          <span className="text-slate-500">IMAP:</span>{' '}
                          <span className="text-slate-300">{account.imapHost}:{account.imapPort}</span>
                        </div>
                      )}
                    </div>

                    {/* Ошибка */}
                    {account.lastError && (
                      <div className="mt-2 text-[10px] text-red-400">
                        {t('crm.email.accounts.error')}: {account.lastError}
                      </div>
                    )}
                  </div>

                  {/* Действия */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTest(account.id)}
                      className="px-2 py-1 text-[10px] bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                      title={t('crm.email.accounts.test')}
                    >
                      {t('crm.email.accounts.test')}
                    </button>
                    <button
                      onClick={() => handleEdit(account.id)}
                      className="px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      {t('crm.email.accounts.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      {t('crm.email.accounts.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
