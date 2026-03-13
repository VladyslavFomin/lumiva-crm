// src/pages/email/EmailAccountFormPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchEmailAccount, createEmailAccount, updateEmailAccount, type CreateEmailAccountDto } from '../../api/email';

export const EmailAccountFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateEmailAccountDto>({
    email: '',
    name: '',
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    smtpUsername: '',
    smtpPassword: '',
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    imapUsername: '',
    imapPassword: '',
    syncIncoming: true,
    syncOutgoing: true,
  });

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchEmailAccount(id)
        .then((account) => {
          setFormData({
            email: account.email,
            name: account.name || '',
            smtpHost: account.smtpHost || '',
            smtpPort: account.smtpPort || 465,
            smtpSecure: account.smtpSecure,
            smtpUsername: account.smtpUsername || '',
            smtpPassword: '', // Не загружаем пароль
            imapHost: account.imapHost || '',
            imapPort: account.imapPort || 993,
            imapSecure: account.imapSecure,
            imapUsername: account.imapUsername || '',
            imapPassword: '', // Не загружаем пароль
            syncIncoming: account.syncIncoming,
            syncOutgoing: account.syncOutgoing,
          });
        })
        .catch((e) => {
          setError(e.message || t('crm.email.form.errors.loadFailed'));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (id) {
        // При обновлении не отправляем пустые пароли
        const updateData: any = { ...formData };
        if (!updateData.smtpPassword || updateData.smtpPassword.trim() === '') {
          delete updateData.smtpPassword;
        }
        if (!updateData.imapPassword || updateData.imapPassword.trim() === '') {
          delete updateData.imapPassword;
        }
        await updateEmailAccount(id, updateData);
      } else {
        await createEmailAccount(formData);
      }
      navigate('/app/email');
    } catch (err: any) {
      setError(err.message || t('crm.email.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CreateEmailAccountDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">{t('crm.email.accounts.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {id ? t('crm.email.form.titleEdit') : t('crm.email.form.titleNew')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.email.form.subtitle')}
            </div>
          </div>
          <button
            onClick={() => navigate('/app/email')}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-50 transition-colors"
          >
            Отмена
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Основная информация */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            <h2 className="text-xs font-semibold text-slate-300 mb-3">{t('crm.email.form.sections.basic')}</h2>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.email')}</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder="Рабочий email"
              />
            </div>
          </div>

          {/* SMTP (отправка) */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            <h2 className="text-xs font-semibold text-slate-300 mb-3">{t('crm.email.form.sections.smtp')}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.smtpHost')}</label>
                <input
                  type="text"
                  required
                  value={formData.smtpHost}
                  onChange={(e) => handleChange('smtpHost', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder="smtp.titan.email"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">
                  {t('crm.email.form.fields.smtpPort')}
                  <span className="ml-2 text-slate-500 text-[10px]">
                    ({t('crm.email.form.hints.smtpPort')})
                  </span>
                </label>
                <input
                  type="number"
                  required
                  value={formData.smtpPort}
                  onChange={(e) => handleChange('smtpPort', parseInt(e.target.value) || 465)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder="465 или 587"
                />
                <div className="text-[10px] text-slate-500 mt-1">
                  {t('crm.email.form.hints.titanEmail')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.smtpSecure')}</label>
                <div className="text-[10px] text-slate-500">{t('crm.email.form.hints.secureRecommended')}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.smtpSecure}
                  onChange={(e) => handleChange('smtpSecure', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </label>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.smtpUser')}</label>
              <input
                type="text"
                required
                value={formData.smtpUsername}
                onChange={(e) => handleChange('smtpUsername', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.smtpPassword')}</label>
              <input
                type="password"
                required={!id}
                value={formData.smtpPassword}
                onChange={(e) => handleChange('smtpPassword', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder={id ? t('crm.email.form.hints.passwordLeaveEmpty') : t('crm.email.form.hints.passwordPlaceholder')}
              />
              {id && (
                <div className="text-[10px] text-slate-500 mt-1">{t('crm.email.form.hints.passwordLeaveEmpty')}</div>
              )}
            </div>
          </div>

          {/* IMAP (получение) - опционально */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            <h2 className="text-xs font-semibold text-slate-300 mb-3">{t('crm.email.form.sections.imap')}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.imapHost')}</label>
                <input
                  type="text"
                  value={formData.imapHost || ''}
                  onChange={(e) => handleChange('imapHost', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder="imap.gmail.com"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.imapPort')}</label>
                <input
                  type="number"
                  value={formData.imapPort || ''}
                  onChange={(e) => handleChange('imapPort', parseInt(e.target.value) || undefined)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder="993"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.imapSecure')}</label>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.imapSecure}
                  onChange={(e) => handleChange('imapSecure', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </label>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.imapUser')}</label>
              <input
                type="text"
                value={formData.imapUsername || ''}
                onChange={(e) => handleChange('imapUsername', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.email.form.fields.imapPassword')}</label>
              <input
                type="password"
                value={formData.imapPassword || ''}
                onChange={(e) => handleChange('imapPassword', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder={id ? t('crm.email.form.hints.passwordLeaveEmpty') : t('crm.email.form.hints.passwordPlaceholder')}
              />
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/email')}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-50 transition-colors"
            >
              {t('crm.email.form.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('crm.email.form.actions.saving') : id ? t('crm.email.form.actions.save') : t('crm.email.form.actions.create')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

