// src/pages/marketing/EmailTemplatesPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchEmailTemplates,
  deleteEmailTemplate,
  previewEmailTemplate,
  previewStyledMail,
  type EmailTemplate,
} from '../../api/email';
import { fetchCompanySettings } from '../../api/settings';
import { EMAIL_TEMPLATE_PRESET_CONTENTS } from '../../marketing/emailTemplatePresets';
import { EmailTemplatePresetPreview } from '../../marketing/EmailTemplatePresetPreview';
import { useAlertModal } from '../../contexts/AlertModalContext';

const ACCENT = '#222222';

/** Демо-данные для предпросмотра обычного шаблона (без реальной отправки). */
const PREVIEW_DEMO_DATA: Record<string, any> = {
  lead: { name: 'Иван Петров', email: 'ivan@example.com', phone: '+7 900 000-00-00', status: 'Новый' },
  contact: { fullName: 'Иван Петров', email: 'ivan@example.com' },
  project: { name: 'Внедрение CRM', status: 'Переговоры', amount: '120 000', currency: 'EUR' },
  sale: { amount: '45 000', currency: 'EUR', status: 'Подтверждена' },
  company: { name: 'ООО «Пример»' },
};

function openPreviewWindow(html: string) {
  const win = window.open('', '_blank');
  if (win) win.document.write(html);
}

export const EmailTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [wrapperTemplateId, setWrapperTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, settings] = await Promise.all([
        fetchEmailTemplates(),
        fetchCompanySettings().catch(() => null),
      ]);
      setTemplates(data);
      setWrapperTemplateId(settings?.aiWrapperEmailTemplateId ?? null);
    } catch (e: any) {
      setError(e.message || t('crm.emailTemplates.list.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewCard = async (template: EmailTemplate) => {
    try {
      if (template.id === wrapperTemplateId) {
        const preview = await previewStyledMail({
          subject: t('crm.emailTemplates.list.wrapperPreviewSubject'),
          bodyHtml: `<p>${t('crm.emailTemplates.list.wrapperPreviewBody')}</p>`,
          headline: t('crm.emailTemplates.list.wrapperPreviewHeadline'),
        });
        openPreviewWindow(preview.htmlBody || preview.textBody || '');
      } else {
        const preview = await previewEmailTemplate(template.id, PREVIEW_DEMO_DATA);
        openPreviewWindow(preview.htmlBody || preview.textBody || '');
      }
    } catch (err: any) {
      showAlert(err.message || t('crm.emailTemplates.list.errors.previewFailed'), {
        variant: 'error',
      });
    }
  };

  const handleCreateBlank = () => navigate('/app/marketing/email-templates/new');
  const handlePreset = (presetId: string) =>
    navigate(`/app/marketing/email-templates/new?preset=${encodeURIComponent(presetId)}`);
  const handleEdit = (id: string) => navigate(`/app/marketing/email-templates/${id}`);
  const handleDelete = async (id: string) => {
    const ok = await showConfirm(t('crm.emailTemplates.list.deleteConfirm'), {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEmailTemplate(id);
      setTemplates(templates.filter((x) => x.id !== id));
    } catch (err: any) {
      showAlert(err.message || t('crm.emailTemplates.list.errors.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[40vh] rounded-3xl border border-zinc-200 bg-white">
          <div className="text-sm text-zinc-500">{t('crm.emailTemplates.list.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHelpButton topic="marketingEmailTemplates" />
      <div className="space-y-8">
        <section
          className="rounded-3xl border border-zinc-200 bg-white px-5 py-6 md:px-8 md:py-8 shadow-sm"
          style={{ color: ACCENT }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                {t('crm.emailTemplates.list.title')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600">
                {t('crm.emailTemplates.list.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateBlank}
              className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: ACCENT }}
            >
              + {t('crm.emailTemplates.list.create')}
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white px-5 py-6 md:px-8 md:py-8 shadow-sm">
          <div className="mb-5 flex flex-col gap-1 border-b border-zinc-100 pb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {t('crm.emailTemplates.list.presetsTitle')}
            </h2>
            <p className="text-sm text-zinc-600">{t('crm.emailTemplates.list.presetsSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {EMAIL_TEMPLATE_PRESET_CONTENTS.map((p) => (
              <div
                key={p.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md"
              >
                <div className="flex justify-center bg-zinc-100/90 px-2 pt-3 pb-1">
                  <EmailTemplatePresetPreview
                    html={p.previewHtml}
                    previewTitle={t(`crm.emailTemplates.presets.items.${p.id}.name`)}
                    visibleHeight={200}
                    scale={0.36}
                  />
                </div>
                <div className="flex flex-1 flex-col border-t border-zinc-100 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {t(`crm.emailTemplates.presets.items.${p.id}.name`)}
                  </span>
                  <span className="mt-2 text-sm font-medium leading-snug text-zinc-900">
                    {t(`crm.emailTemplates.presets.items.${p.id}.description`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePreset(p.id)}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-lg px-2.5 py-2.5 text-[11px] font-semibold text-white transition hover:opacity-90"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {t('crm.emailTemplates.list.usePreset')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white px-5 py-6 md:px-8 md:py-8 shadow-sm">
          <h2 className="mb-5 border-b border-zinc-100 pb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t('crm.emailTemplates.list.myTemplatesTitle')}
          </h2>

          {templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-10 text-center">
              <p className="text-sm text-zinc-600">{t('crm.emailTemplates.list.empty')}</p>
              <button
                type="button"
                onClick={handleCreateBlank}
                className="mt-4 text-sm font-semibold underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-800"
                style={{ color: ACCENT }}
              >
                {t('crm.emailTemplates.list.createFirst')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...templates]
                .sort((a, b) =>
                  a.id === wrapperTemplateId ? -1 : b.id === wrapperTemplateId ? 1 : 0,
                )
                .map((template) => {
                  const isWrapper = template.id === wrapperTemplateId;
                  return (
                    <article
                      key={template.id}
                      className="flex flex-col rounded-2xl border p-5 shadow-sm transition"
                      style={
                        isWrapper
                          ? { borderColor: ACCENT, borderWidth: 2, background: '#fafafa' }
                          : { borderColor: '#e4e4e7' }
                      }
                    >
                      {isWrapper && (
                        <div
                          className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
                          style={{ backgroundColor: ACCENT }}
                        >
                          {t('crm.emailTemplates.list.wrapperBadge')}
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-semibold text-zinc-900">{template.name}</h3>
                          {isWrapper ? (
                            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                              {t('crm.emailTemplates.list.wrapperHint')}
                            </p>
                          ) : (
                            template.description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600">
                                {template.description}
                              </p>
                            )
                          )}
                        </div>
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: template.isActive ? '#22c55e' : '#a1a1aa',
                          }}
                          title={template.isActive ? 'active' : 'inactive'}
                        />
                      </div>
                      {template.subject && !isWrapper && (
                        <p className="mt-3 truncate text-[11px] text-zinc-500">
                          <span className="font-medium text-zinc-700">{t('crm.emailTemplates.list.subject')}:</span>{' '}
                          {template.subject}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(template.id)}
                          className="min-h-[40px] flex-1 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90"
                          style={{ backgroundColor: ACCENT }}
                        >
                          {t('crm.emailTemplates.list.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePreviewCard(template)}
                          className="min-h-[40px] rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                        >
                          {t('crm.emailTemplates.list.preview')}
                        </button>
                        {!isWrapper && (
                          <button
                            type="button"
                            onClick={() => handleDelete(template.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('crm.emailTemplates.list.delete')}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
};
