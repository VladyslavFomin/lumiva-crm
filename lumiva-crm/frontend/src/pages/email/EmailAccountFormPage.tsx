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
        <div className="text-center py-12 text-xs text-text-tertiary">{t('crm.email.accounts.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {id ? t('crm.email.form.titleEdit') : t('crm.email.form.titleNew')}
            </h1>
            <p className="page-subtitle">{t('crm.email.form.subtitle')}</p>
          </div>
          <button onClick={() => navigate('/app/email')} className="btn-ghost">
            {t('crm.email.form.actions.cancel')}
          </button>
        </div>

        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Основная информация */}
          <div className="card p-4 space-y-4">
            <h2 className="section-label">{t('crm.email.form.sections.basic')}</h2>

            <div className="form-group">
              <label className="form-label">{t('crm.email.form.fields.email')}</label>
              <input type="email" required value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="base-input" placeholder="user@example.com" />
            </div>

            <div className="form-group">
              <label className="form-label">{t('crm.email.form.fields.name')}</label>
              <input type="text" value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="base-input" placeholder="Рабочий email" />
            </div>
          </div>

          {/* SMTP */}
          <div className="card p-4 space-y-4">
            <h2 className="section-label">{t('crm.email.form.sections.smtp')}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">{t('crm.email.form.fields.smtpHost')}</label>
                <input type="text" required value={formData.smtpHost}
                  onChange={(e) => handleChange('smtpHost', e.target.value)}
                  className="base-input" placeholder="smtp.titan.email" />
              </div>
              <div className="form-group">
                <label className="form-label">
                  {t('crm.email.form.fields.smtpPort')}
                  <span className="ml-1.5 text-text-tertiary font-normal normal-case tracking-normal">
                    ({t('crm.email.form.hints.smtpPort')})
                  </span>
                </label>
                <input type="number" required value={formData.smtpPort}
                  onChange={(e) => handleChange('smtpPort', parseInt(e.target.value) || 465)}
                  className="base-input" placeholder="465 или 587" />
                <span className="form-hint">{t('crm.email.form.hints.titanEmail')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="form-label">{t('crm.email.form.fields.smtpSecure')}</div>
                <div className="form-hint">{t('crm.email.form.hints.secureRecommended')}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" checked={formData.smtpSecure}
                  onChange={(e) => handleChange('smtpSecure', e.target.checked)}
                  className="sr-only peer" />
                <div className="w-10 h-5 bg-border-strong peer-focus:outline-none rounded-full peer peer-checked:bg-status-success transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">{t('crm.email.form.fields.smtpUser')}</label>
              <input type="text" required value={formData.smtpUsername}
                onChange={(e) => handleChange('smtpUsername', e.target.value)}
                className="base-input" placeholder="user@example.com" />
            </div>

            <div className="form-group">
              <label className="form-label">{t('crm.email.form.fields.smtpPassword')}</label>
              <input type="password" required={!id} value={formData.smtpPassword}
                onChange={(e) => handleChange('smtpPassword', e.target.value)}
                className="base-input"
                placeholder={id ? t('crm.email.form.hints.passwordLeaveEmpty') : t('crm.email.form.hints.passwordPlaceholder')} />
              {id && <span className="form-hint">{t('crm.email.form.hints.passwordLeaveEmpty')}</span>}
            </div>
          </div>

          {/* IMAP */}
          <div className="card p-4 space-y-4">
            <h2 className="section-label">{t('crm.email.form.sections.imap')}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">{t('crm.email.form.fields.imapHost')}</label>
                <input type="text" value={formData.imapHost || ''}
                  onChange={(e) => handleChange('imapHost', e.target.value)}
                  className="base-input" placeholder="imap.gmail.com" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('crm.email.form.fields.imapPort')}</label>
                <input type="number" value={formData.imapPort || ''}
                  onChange={(e) => handleChange('imapPort', parseInt(e.target.value) || undefined)}
                  className="base-input" placeholder="993" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="form-label">{t('crm.email.form.fields.imapSecure')}</div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" checked={formData.imapSecure}
                  onChange={(e) => handleChange('imapSecure', e.target.checked)}
                  className="sr-only peer" />
                <div className="w-10 h-5 bg-border-strong peer-focus:outline-none rounded-full peer peer-checked:bg-status-success transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">{t('crm.email.form.fields.imapUser')}</label>
              <input type="text" value={formData.imapUsername || ''}
                onChange={(e) => handleChange('imapUsername', e.target.value)}
                className="base-input" placeholder="user@example.com" />
            </div>

            <div className="form-group">
              <label className="form-label">{t('crm.email.form.fields.imapPassword')}</label>
              <input type="password" value={formData.imapPassword || ''}
                onChange={(e) => handleChange('imapPassword', e.target.value)}
                className="base-input"
                placeholder={id ? t('crm.email.form.hints.passwordLeaveEmpty') : t('crm.email.form.hints.passwordPlaceholder')} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => navigate('/app/email')} className="btn-secondary">
              {t('crm.email.form.actions.cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('crm.email.form.actions.saving') : id ? t('crm.email.form.actions.save') : t('crm.email.form.actions.create')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

