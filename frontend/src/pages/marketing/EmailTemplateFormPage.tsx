// src/pages/marketing/EmailTemplateFormPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  previewEmailTemplate,
  type CreateEmailTemplateDto,
} from '../../api/email';

export const EmailTemplateFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');
  const [previewData, setPreviewData] = useState<Record<string, any>>({
    lead: {
      name: 'Ivan Ivanov',
      email: 'ivan@example.com',
      phone: '+7 999 123-45-67',
      status: t('crm.leads.statusValues.new'),
    },
    contact: { fullName: 'Ivan Ivanov', email: 'ivan@example.com' },
  });

  const [formData, setFormData] = useState<CreateEmailTemplateDto>({
    name: '',
    description: '',
    subject: '',
    htmlBody: '',
    textBody: '',
    isActive: true,
  });

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchEmailTemplate(id)
        .then((template) => {
          setFormData({
            name: template.name,
            description: template.description || '',
            subject: template.subject || '',
            htmlBody: template.htmlBody || '',
            textBody: template.textBody || '',
            isActive: template.isActive,
            meta: template.meta,
          });
        })
        .catch((e) => {
          setError(e.message || t('crm.emailTemplates.form.errors.loadFailed'));
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
        await updateEmailTemplate(id, formData);
      } else {
        await createEmailTemplate(formData);
      }
      navigate('/app/marketing/email-templates');
    } catch (err: any) {
      setError(err.message || t('crm.emailTemplates.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!id) return;
    try {
      const preview = await previewEmailTemplate(id, previewData);
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.write(preview.htmlBody || preview.textBody || '');
      }
    } catch (err: any) {
      alert(`${t('crm.emailTemplates.form.errors.previewFailed')}: ${err.message}`);
    }
  };

  const handleChange = (field: keyof CreateEmailTemplateDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Starter HTML template.
  const defaultHtmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">{{lead.name}}</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>${t('crm.emailTemplates.form.defaultTemplate.greeting')}</p>
    <p>${t('crm.emailTemplates.form.defaultTemplate.body')}</p>
    <p><strong>Email:</strong> {{lead.email}}</p>
    <p><strong>${t('crm.emailTemplates.form.defaultTemplate.phoneLabel')}</strong> {{lead.phone}}</p>
    <p><strong>${t('crm.emailTemplates.form.defaultTemplate.statusLabel')}</strong> {{lead.status}}</p>
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">${t('crm.emailTemplates.form.defaultTemplate.signature')}</p>
    </div>
  </div>
</body>
</html>`;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-slate-400">{t('crm.emailTemplates.list.loading')}</div>
        </div>
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
              {id ? t('crm.emailTemplates.form.titleEdit') : t('crm.emailTemplates.form.titleNew')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.emailTemplates.form.subtitle')}
            </div>
          </div>
          <button
            onClick={() => navigate('/app/marketing/email-templates')}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-800/80 transition-colors"
          >
            {t('crm.emailTemplates.form.actions.cancel')}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            {/* Основная информация */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.emailTemplates.form.fields.name')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder={t('crm.emailTemplates.form.placeholders.name')}
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.emailTemplates.form.fields.description')}</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                  placeholder={t('crm.emailTemplates.form.placeholders.description')}
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.emailTemplates.form.fields.subject')}</label>
                <input
                  type="text"
                  value={formData.subject || ''}
                  onChange={(e) => handleChange('subject', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  placeholder={t('crm.emailTemplates.form.placeholders.subject')}
                />
                <div className="text-[10px] text-slate-500 mt-1">
                  {t('crm.emailTemplates.form.hints.availableVariables')}: {'{{lead.name}}'}, {'{{lead.email}}'}, {'{{lead.phone}}'}, {'{{lead.status}}'}, {'{{contact.fullName}}'}
                </div>
              </div>
            </div>

            {/* HTML содержимое */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] text-slate-400">{t('crm.emailTemplates.form.fields.htmlBody')}</label>
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.htmlBody) {
                      handleChange('htmlBody', defaultHtmlTemplate);
                    }
                  }}
                  className="text-[10px] text-lumiva-accent hover:text-lumiva-accent-soft"
                >
                  {t('crm.emailTemplates.form.actions.useTemplate')}
                </button>
              </div>
              <textarea
                value={formData.htmlBody || ''}
                onChange={(e) => handleChange('htmlBody', e.target.value)}
                rows={15}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none font-mono"
                placeholder={t('crm.emailTemplates.form.placeholders.htmlBody')}
              />
            </div>

            {/* Текстовая версия */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.emailTemplates.form.fields.textBody')}</label>
              <textarea
                value={formData.textBody || ''}
                onChange={(e) => handleChange('textBody', e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                placeholder={t('crm.emailTemplates.form.placeholders.textBody')}
              />
            </div>

            {/* Активен */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.emailTemplates.form.fields.isActive')}</label>
                <div className="text-[10px] text-slate-500">{t('crm.emailTemplates.form.hints.activeAvailable')}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/app/marketing/email-templates')}
              className="px-4 py-2 text-xs rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-800/80 transition-colors"
            >
              {t('crm.emailTemplates.form.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors disabled:opacity-50"
            >
              {saving ? t('crm.emailTemplates.form.actions.saving') : t('crm.emailTemplates.form.actions.save')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};




