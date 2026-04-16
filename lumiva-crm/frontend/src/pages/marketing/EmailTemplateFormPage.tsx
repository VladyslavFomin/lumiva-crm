// src/pages/marketing/EmailTemplateFormPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  previewEmailTemplate,
  type CreateEmailTemplateDto,
} from '../../api/email';
import {
  EMAIL_TEMPLATE_PRESET_CONTENTS,
  getEmailTemplatePreset,
  type EmailTemplatePresetContent,
} from '../../marketing/emailTemplatePresets';
import { EmailTemplatePresetPreview } from '../../marketing/EmailTemplatePresetPreview';

const ACCENT = '#222222';

export const EmailTemplateFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const urlPresetAppliedRef = useRef(false);

  const [previewData] = useState<Record<string, any>>({
    lead: {
      name: 'Ivan Ivanov',
      email: 'ivan@example.com',
      phone: '+7 999 123-45-67',
      status: t('crm.leads.statusValues.new'),
    },
    contact: { fullName: 'Ivan Ivanov', email: 'ivan@example.com' },
    project: { name: 'Внедрение CRM', status: 'negotiation', amount: '120000', currency: 'EUR' },
    sale: { id: 'demo-sale-id', amount: '45000', currency: 'EUR', status: 'confirmed' },
    company: { name: 'ООО Пример' },
  });

  const [formData, setFormData] = useState<CreateEmailTemplateDto>({
    name: '',
    description: '',
    subject: '',
    htmlBody: '',
    textBody: '',
    isActive: true,
  });

  const applyPresetContent = useCallback(
    (p: EmailTemplatePresetContent) => {
      setFormData((prev) => ({
        ...prev,
        name: t(`crm.emailTemplates.presets.items.${p.id}.name`),
        description: t(`crm.emailTemplates.presets.items.${p.id}.description`),
        subject: p.subject,
        htmlBody: p.htmlBody,
        textBody: p.textBody,
      }));
    },
    [t],
  );

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
            meta: template.meta ?? undefined,
          });
        })
        .catch((e) => {
          setError(e.message || t('crm.emailTemplates.form.errors.loadFailed'));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id, t]);

  const presetParam = searchParams.get('preset');
  useEffect(() => {
    if (id || !presetParam || urlPresetAppliedRef.current) return;
    const p = getEmailTemplatePreset(presetParam);
    if (!p) return;
    urlPresetAppliedRef.current = true;
    applyPresetContent(p);
    setSearchParams({}, { replace: true });
  }, [id, presetParam, applyPresetContent, setSearchParams]);

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

  const handleImportPreset = (p: EmailTemplatePresetContent) => {
    const filled =
      formData.name.trim().length > 0 ||
      (formData.subject || '').trim().length > 0 ||
      (formData.htmlBody || '').trim().length > 40;
    if (filled && !window.confirm(t('crm.emailTemplates.form.presetReplaceConfirm'))) {
      return;
    }
    applyPresetContent(p);
  };

  const defaultHtmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${ACCENT}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
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
        <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-zinc-200 bg-white">
          <div className="text-sm text-zinc-500">{t('crm.emailTemplates.list.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-5 shadow-sm md:px-8 md:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                {id ? t('crm.emailTemplates.form.titleEdit') : t('crm.emailTemplates.form.titleNew')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-600">{t('crm.emailTemplates.form.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/marketing/email-templates')}
              className="self-start rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100"
            >
              {t('crm.emailTemplates.form.actions.cancel')}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-5 shadow-sm md:px-8 md:py-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t('crm.emailTemplates.form.presetLibraryTitle')}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {EMAIL_TEMPLATE_PRESET_CONTENTS.map((p) => (
              <div
                key={p.id}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md"
              >
                <div className="flex justify-center bg-zinc-100/90 px-2 pt-3 pb-1">
                  <EmailTemplatePresetPreview
                    html={p.htmlBody}
                    previewTitle={t(`crm.emailTemplates.presets.items.${p.id}.name`)}
                    visibleHeight={196}
                    scale={0.36}
                  />
                </div>
                <div className="flex flex-1 flex-col border-t border-zinc-100 px-3 py-3">
                  <span className="font-semibold text-zinc-900">
                    {t(`crm.emailTemplates.presets.items.${p.id}.name`)}
                  </span>
                  <span className="mt-1 block flex-1 text-[11px] leading-snug text-zinc-600">
                    {t(`crm.emailTemplates.presets.items.${p.id}.description`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleImportPreset(p)}
                    className="mt-3 w-full rounded-lg py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {t('crm.emailTemplates.form.presetApply')} →
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-600">
            {t('crm.emailTemplates.form.constructorHint')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-5 shadow-sm md:px-8 md:py-6 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-600">
                  {t('crm.emailTemplates.form.fields.name')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  placeholder={t('crm.emailTemplates.form.placeholders.name')}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-600">
                  {t('crm.emailTemplates.form.fields.description')}
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  placeholder={t('crm.emailTemplates.form.placeholders.description')}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-600">
                  {t('crm.emailTemplates.form.fields.subject')}
                </label>
                <input
                  type="text"
                  value={formData.subject || ''}
                  onChange={(e) => handleChange('subject', e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  placeholder={t('crm.emailTemplates.form.placeholders.subject')}
                />
                <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-zinc-500">
                  <p>
                    {t('crm.emailTemplates.form.hints.availableVariables')}: {'{{lead.name}}'}, {'{{lead.email}}'},{' '}
                    {'{{lead.phone}}'}, {'{{lead.status}}'}, {'{{contact.fullName}}'}, {'{{contact.email}}'},{' '}
                    {'{{project.name}}'}, {'{{project.status}}'}, {'{{project.amount}}'}, {'{{project.currency}}'},{' '}
                    {'{{sale.amount}}'}, {'{{sale.currency}}'}, {'{{sale.status}}'}, {'{{company.name}}'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-[11px] font-medium text-zinc-600">
                  {t('crm.emailTemplates.form.fields.htmlBody')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.htmlBody) {
                      handleChange('htmlBody', defaultHtmlTemplate);
                    }
                  }}
                  className="text-[10px] font-semibold hover:underline"
                  style={{ color: ACCENT }}
                >
                  {t('crm.emailTemplates.form.actions.useTemplate')}
                </button>
              </div>
              <textarea
                value={formData.htmlBody || ''}
                onChange={(e) => handleChange('htmlBody', e.target.value)}
                rows={15}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder-zinc-400 transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                placeholder={t('crm.emailTemplates.form.placeholders.htmlBody')}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-zinc-600">
                {t('crm.emailTemplates.form.fields.textBody')}
              </label>
              <textarea
                value={formData.textBody || ''}
                onChange={(e) => handleChange('textBody', e.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                placeholder={t('crm.emailTemplates.form.placeholders.textBody')}
              />
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-zinc-600">
                  {t('crm.emailTemplates.form.fields.isActive')}
                </label>
                <div className="text-[10px] text-zinc-500">{t('crm.emailTemplates.form.hints.activeAvailable')}</div>
              </div>
              <input
                type="checkbox"
                checked={formData.isActive !== false}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-300"
                style={{ accentColor: ACCENT }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {id && (
              <button
                type="button"
                onClick={handlePreview}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50"
              >
                {t('crm.emailTemplates.form.actions.preview')}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/app/marketing/email-templates')}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100"
            >
              {t('crm.emailTemplates.form.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? t('crm.emailTemplates.form.actions.saving') : t('crm.emailTemplates.form.actions.save')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};
