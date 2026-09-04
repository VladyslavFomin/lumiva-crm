// src/pages/marketing/EmailTemplateFormPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  previewEmailTemplate,
  previewStyledMail,
  type CreateEmailTemplateDto,
} from '../../api/email';
import { fetchCompanySettings } from '../../api/settings';
import {
  getEmailTemplatePreset,
  type EmailTemplatePresetContent,
} from '../../marketing/emailTemplatePresets';
import { useAlertModal } from '../../contexts/AlertModalContext';

const ACCENT = '#222222';

export const EmailTemplateFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const urlPresetAppliedRef = useRef(false);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const [isWrapperTemplate, setIsWrapperTemplate] = useState(false);

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
    useWrapper: true,
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
        useWrapper: true,
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
            useWrapper: template.useWrapper,
            meta: template.meta ?? undefined,
          });
        })
        .catch((e) => {
          setError(e.message || t('crm.emailTemplates.form.errors.loadFailed'));
        })
        .finally(() => {
          setLoading(false);
        });
      fetchCompanySettings()
        .then((settings) => setIsWrapperTemplate(settings.aiWrapperEmailTemplateId === id))
        .catch(() => setIsWrapperTemplate(false));
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
    showAlert(t('crm.emailTemplates.form.presetApplied'), { variant: 'success' });
  }, [id, presetParam, applyPresetContent, setSearchParams, showAlert, t]);

  useEffect(() => {
    if (error) {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error]);

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
      const preview = isWrapperTemplate
        ? await previewStyledMail({
            subject: t('crm.emailTemplates.list.wrapperPreviewSubject'),
            bodyHtml: `<p>${t('crm.emailTemplates.list.wrapperPreviewBody')}</p>`,
            headline: t('crm.emailTemplates.list.wrapperPreviewHeadline'),
          })
        : await previewEmailTemplate(id, previewData);
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.write(preview.htmlBody || preview.textBody || '');
      }
    } catch (err: any) {
      showAlert(`${t('crm.emailTemplates.form.errors.previewFailed')}: ${err.message}`, {
        variant: 'error',
      });
    }
  };

  const handleChange = (field: keyof CreateEmailTemplateDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Тело-фрагмент (без <html>/<head>/<body> и своей шапки) — дизайн компании подставляется
  // обёрткой при отправке (useWrapper: true, см. handleChange('htmlBody', ...) ниже).
  const defaultHtmlTemplate = `<p>${t('crm.emailTemplates.form.defaultTemplate.greeting')}</p>
<p>${t('crm.emailTemplates.form.defaultTemplate.body')}</p>
<p><strong>Email:</strong> {{lead.email}}</p>
<p><strong>${t('crm.emailTemplates.form.defaultTemplate.phoneLabel')}</strong> {{lead.phone}}</p>
<p><strong>${t('crm.emailTemplates.form.defaultTemplate.statusLabel')}</strong> {{lead.status}}</p>`;

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
      <PageHelpButton topic="marketingEmailTemplates" />
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
            <div
              ref={errorBannerRef}
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {error}
            </div>
          )}

          {isWrapperTemplate && (
            <div className="mt-4 rounded-xl border-2 px-3 py-2.5 text-xs leading-relaxed" style={{ borderColor: ACCENT, background: '#fafafa' }}>
              <span className="font-semibold" style={{ color: ACCENT }}>
                {t('crm.emailTemplates.list.wrapperBadge')}.
              </span>{' '}
              {t('crm.emailTemplates.list.wrapperHint')}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-5 shadow-sm md:px-8 md:py-6 space-y-4">
            <p className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-600">
              {t('crm.emailTemplates.form.constructorHint')}
            </p>
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
                      setFormData((prev) => ({ ...prev, htmlBody: defaultHtmlTemplate, useWrapper: true }));
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
                  {t('crm.emailTemplates.form.fields.useWrapper')}
                </label>
                <div className="text-[10px] text-zinc-500">{t('crm.emailTemplates.form.hints.useWrapper')}</div>
              </div>
              <input
                type="checkbox"
                checked={formData.useWrapper !== false}
                onChange={(e) => handleChange('useWrapper', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-300"
                style={{ accentColor: ACCENT }}
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
