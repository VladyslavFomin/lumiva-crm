import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { CrmShellModal } from '../../components/ui/CrmShellModal';
import {
  createUtmTemplate,
  fetchUtmTemplates,
  deleteUtmTemplate,
  updateUtmTemplate,
  type MarketingUtmTemplate,
} from '../../api/marketing';

const ACCENT = '#222222';
const borderSubtle = `${ACCENT}18`;

type ChannelPreset = 'google_search' | 'meta_ads' | 'yandex_direct' | 'email' | 'other';

interface UtmFormState {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  channel: ChannelPreset;
  nameForTemplate: string;
}

const defaultForm: UtmFormState = {
  baseUrl: 'https://lumiva.agency',
  source: 'google',
  medium: 'cpc',
  campaign: '',
  content: '',
  term: '',
  channel: 'google_search',
  nameForTemplate: '',
};

const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400';

export const UtmsPage: React.FC = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState<UtmFormState>(defaultForm);
  const [templates, setTemplates] = useState<MarketingUtmTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    variant?: 'info' | 'error';
  } | null>(null);
  const [pendingDeleteTpl, setPendingDeleteTpl] = useState<MarketingUtmTemplate | null>(null);
  /** Если задан — кнопка «Сохранить» обновляет этот шаблон, а не создаёт новый */
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUtmTemplates();
      setTemplates(data);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || t('crm.marketingUtms.errors.loadTemplates'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleChange = (field: keyof UtmFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const applyChannelPreset = (channel: ChannelPreset) => {
    setEditingTemplateId(null);
    const patch: Partial<UtmFormState> = { channel };

    if (channel === 'google_search') {
      patch.source = 'google';
      patch.medium = 'cpc';
    } else if (channel === 'meta_ads') {
      patch.source = 'facebook';
      patch.medium = 'paid_social';
    } else if (channel === 'yandex_direct') {
      patch.source = 'yandex';
      patch.medium = 'cpc';
    } else if (channel === 'email') {
      patch.source = 'email';
      patch.medium = 'email';
    } else {
      patch.source = '';
      patch.medium = '';
    }

    setForm((prev) => ({ ...prev, ...patch }));
  };

  const { generatedUrl, urlError } = useMemo(() => {
    if (!form.baseUrl?.trim()) return { generatedUrl: '', urlError: null as string | null };

    try {
      const url = new URL(
        form.baseUrl.trim(),
        form.baseUrl.trim().startsWith('http') ? undefined : 'https://dummy.host',
      );
      const params = url.searchParams;

      if (form.source) params.set('utm_source', form.source);
      if (form.medium) params.set('utm_medium', form.medium);
      if (form.campaign) params.set('utm_campaign', form.campaign);
      if (form.content) params.set('utm_content', form.content);
      if (form.term) params.set('utm_term', form.term);

      const full = url.toString();
      return { generatedUrl: full.replace('https://dummy.host', ''), urlError: null };
    } catch {
      return {
        generatedUrl: '',
        urlError: t('crm.marketingUtms.errors.invalidBaseUrl'),
      };
    }
  }, [form, t]);

  const templatePayload = useMemo(
    () => ({
      name: form.nameForTemplate.trim(),
      baseUrl: form.baseUrl.trim() || undefined,
      channelType: form.channel,
      utmSource: form.source || undefined,
      utmMedium: form.medium || undefined,
      utmCampaign: form.campaign || undefined,
      utmContent: form.content || undefined,
      utmTerm: form.term || undefined,
    }),
    [form],
  );

  const onSaveTemplate = async () => {
    if (!form.nameForTemplate.trim()) {
      setNotice({
        title: t('crm.common.modalNotice'),
        message: t('crm.marketingUtms.errors.nameRequired'),
        variant: 'info',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingTemplateId) {
        const updated = await updateUtmTemplate(editingTemplateId, templatePayload);
        setTemplates((prev) =>
          prev.map((x) => (x.id === updated.id ? updated : x)),
        );
        setNotice({
          title: t('crm.common.modalNotice'),
          message: t('crm.marketingUtms.success.updated'),
          variant: 'info',
        });
      } else {
        const created = await createUtmTemplate(templatePayload);
        setTemplates((prev) => [created, ...prev]);
        setEditingTemplateId(created.id);
        setNotice({
          title: t('crm.common.modalNotice'),
          message: t('crm.marketingUtms.success.created'),
          variant: 'info',
        });
      }
    } catch (e: any) {
      console.error(e);
      setNotice({
        title: t('crm.common.modalError'),
        message: e?.message || t('crm.marketingUtms.errors.saveTemplate'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const onSaveAsCopy = async () => {
    if (!form.nameForTemplate.trim()) {
      setNotice({
        title: t('crm.common.modalNotice'),
        message: t('crm.marketingUtms.errors.nameRequired'),
        variant: 'info',
      });
      return;
    }

    setSaving(true);
    try {
      const copyName = t('crm.marketingUtms.copyNameSuffix', {
        name: form.nameForTemplate.trim(),
      });
      const created = await createUtmTemplate({
        ...templatePayload,
        name: copyName,
      });
      setTemplates((prev) => [created, ...prev]);
      setEditingTemplateId(created.id);
      setForm((prev) => ({ ...prev, nameForTemplate: copyName }));
      setNotice({
        title: t('crm.common.modalNotice'),
        message: t('crm.marketingUtms.success.duplicated'),
        variant: 'info',
      });
    } catch (e: any) {
      console.error(e);
      setNotice({
        title: t('crm.common.modalError'),
        message: e?.message || t('crm.marketingUtms.errors.saveTemplate'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const onApplyTemplate = (tpl: MarketingUtmTemplate) => {
    setEditingTemplateId(tpl.id);
    setForm((prev) => ({
      ...prev,
      baseUrl: tpl.baseUrl || prev.baseUrl,
      channel: ((tpl.channelType as ChannelPreset) || prev.channel) as ChannelPreset,
      source: tpl.utmSource || '',
      medium: tpl.utmMedium || '',
      campaign: tpl.utmCampaign || '',
      content: tpl.utmContent || '',
      term: tpl.utmTerm || '',
      nameForTemplate: tpl.name,
    }));
  };

  const startNewLink = () => {
    setEditingTemplateId(null);
    setForm({ ...defaultForm });
  };

  const onDeleteTemplate = (tpl: MarketingUtmTemplate) => {
    setPendingDeleteTpl(tpl);
  };

  const confirmDeleteTemplate = async () => {
    const tpl = pendingDeleteTpl;
    if (!tpl) return;
    try {
      await deleteUtmTemplate(tpl.id);
      setTemplates((prev) => prev.filter((x) => x.id !== tpl.id));
      if (editingTemplateId === tpl.id) {
        setEditingTemplateId(null);
        setForm((f) => ({ ...f, nameForTemplate: '' }));
      }
      setPendingDeleteTpl(null);
    } catch (e: any) {
      console.error(e);
      setPendingDeleteTpl(null);
      setNotice({
        title: t('crm.common.modalError'),
        message: e?.message || t('crm.marketingUtms.errors.deleteTemplate'),
        variant: 'error',
      });
    }
  };

  const copyGeneratedUrl = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setNotice({
        title: t('crm.common.modalNotice'),
        message: t('crm.marketingUtms.errors.copyFailed'),
        variant: 'info',
      });
    }
  };

  const channelPill = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[11px] transition ${
      active
        ? 'font-medium text-white shadow-sm'
        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
    }`;

  return (
    <MainLayout>
      <div className="space-y-4 pb-8 md:space-y-6">
        <section
          className="rounded-2xl border bg-white px-5 py-5 shadow-sm md:px-7 md:py-6"
          style={{ borderColor: borderSubtle }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div
                className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500"
              >
                {t('crm.marketingUtms.kicker')}
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-neutral-900 md:text-xl">
                {t('crm.marketingUtms.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-neutral-600">
                {t('crm.marketingUtms.subtitle')}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadTemplates()}
                disabled={loading}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] text-neutral-700 transition hover:border-neutral-300 disabled:opacity-50"
              >
                {loading ? t('crm.marketingUtms.loading') : t('crm.marketingUtms.actions.refresh')}
              </button>
              <button
                type="button"
                onClick={startNewLink}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] text-neutral-700 transition hover:border-neutral-300"
              >
                {t('crm.marketingUtms.actions.newLink')}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-5">
          <div
            className="space-y-4 rounded-2xl border bg-white px-4 py-4 shadow-sm md:px-5 md:py-5"
            style={{ borderColor: borderSubtle }}
          >
            {editingTemplateId && (
              <div
                className="rounded-xl border px-3 py-2 text-[11px] text-neutral-700"
                style={{ borderColor: borderSubtle, background: `${ACCENT}06` }}
              >
                {t('crm.marketingUtms.editingHint')}
              </div>
            )}

            <div>
              <div className="mb-2 text-[11px] font-medium text-neutral-600">
                {t('crm.marketingUtms.fields.channel')}
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['google_search', t('crm.marketingUtms.channels.google_search')],
                    ['meta_ads', t('crm.marketingUtms.channels.meta_ads')],
                    ['yandex_direct', t('crm.marketingUtms.channels.yandex_direct')],
                    ['email', t('crm.marketingUtms.channels.email')],
                    ['other', t('crm.marketingUtms.channels.other')],
                  ] as [ChannelPreset, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyChannelPreset(key)}
                    className={channelPill(form.channel === key)}
                    style={
                      form.channel === key
                        ? { backgroundColor: ACCENT, borderColor: ACCENT }
                        : undefined
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-neutral-600">
                  {t('crm.marketingUtms.fields.baseUrl')}
                </label>
                <input
                  className={inputClass}
                  value={form.baseUrl}
                  onChange={(e) => handleChange('baseUrl', e.target.value)}
                  placeholder={t('crm.marketingUtms.placeholders.baseUrl')}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-neutral-600">
                    {t('crm.marketingUtms.fields.utm_source')}
                  </label>
                  <input
                    className={inputClass}
                    value={form.source}
                    onChange={(e) => handleChange('source', e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-neutral-600">
                    {t('crm.marketingUtms.fields.utm_medium')}
                  </label>
                  <input
                    className={inputClass}
                    value={form.medium}
                    onChange={(e) => handleChange('medium', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-neutral-600">
                  {t('crm.marketingUtms.fields.utm_campaign')}
                </label>
                <input
                  className={inputClass}
                  value={form.campaign}
                  onChange={(e) => handleChange('campaign', e.target.value)}
                  placeholder={t('crm.marketingUtms.placeholders.utm_campaign')}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-neutral-600">
                    {t('crm.marketingUtms.fields.utm_content')}
                  </label>
                  <input
                    className={inputClass}
                    value={form.content}
                    onChange={(e) => handleChange('content', e.target.value)}
                    placeholder={t('crm.marketingUtms.placeholders.utm_content')}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-neutral-600">
                    {t('crm.marketingUtms.fields.utm_term')}
                  </label>
                  <input
                    className={inputClass}
                    value={form.term}
                    onChange={(e) => handleChange('term', e.target.value)}
                    placeholder={t('crm.marketingUtms.placeholders.utm_term')}
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] text-neutral-600">
                    {t('crm.marketingUtms.fields.generatedUrl')}
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyGeneratedUrl()}
                    disabled={!generatedUrl}
                    className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-700 transition hover:border-neutral-300 disabled:opacity-40"
                  >
                    {copyDone
                      ? t('crm.marketingUtms.actions.copied')
                      : t('crm.marketingUtms.actions.copyUrl')}
                  </button>
                </div>
                <textarea
                  className={`${inputClass} h-24 resize-none font-mono text-[11px]`}
                  readOnly
                  value={urlError || generatedUrl}
                />
              </div>
            </div>

            <div
              className="mt-1 flex flex-col gap-3 border-t border-neutral-100 pt-4 md:flex-row md:items-end md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-[11px] text-neutral-600">
                  {t('crm.marketingUtms.fields.templateName')}
                </label>
                <input
                  className={inputClass}
                  value={form.nameForTemplate}
                  onChange={(e) => handleChange('nameForTemplate', e.target.value)}
                  placeholder={t('crm.marketingUtms.placeholders.templateName')}
                />
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
                {editingTemplateId ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void onSaveAsCopy()}
                      disabled={saving}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-[11px] font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-60 sm:w-auto"
                    >
                      {t('crm.marketingUtms.actions.saveAsCopy')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSaveTemplate()}
                      disabled={saving}
                      className="w-full rounded-xl px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {saving
                        ? t('crm.marketingUtms.actions.saving')
                        : t('crm.marketingUtms.actions.updateTemplate')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onSaveTemplate()}
                    disabled={saving}
                    className="w-full rounded-xl px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {saving
                      ? t('crm.marketingUtms.actions.saving')
                      : t('crm.marketingUtms.actions.saveTemplate')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border bg-white px-4 py-4 text-xs shadow-sm md:px-5 md:py-5"
            style={{ borderColor: borderSubtle }}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  {t('crm.marketingUtms.templates.title')}
                </h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {t('crm.marketingUtms.templates.subtitle')}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-neutral-500">
                {t('crm.marketingUtms.templates.total', {
                  count: templates.length,
                })}
              </span>
            </div>

            {error && <div className="mb-2 text-[11px] text-rose-600">{error}</div>}

            {loading && (
              <div className="text-[11px] text-neutral-500">{t('crm.marketingUtms.loading')}</div>
            )}

            {!loading && !templates.length && (
              <div className="text-[11px] text-neutral-500">{t('crm.marketingUtms.templates.empty')}</div>
            )}

            <div className="max-h-[min(420px,55vh)] space-y-2 overflow-y-auto pr-0.5">
              {templates.map((tpl) => {
                const isActive = editingTemplateId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 ${
                      isActive ? 'ring-1 ring-neutral-900/15' : ''
                    }`}
                    style={{
                      borderColor: isActive ? ACCENT : `${ACCENT}12`,
                      background: isActive ? `${ACCENT}05` : 'white',
                    }}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold text-neutral-900">{tpl.name}</span>
                        <span className="mt-0.5 block text-[10px] text-neutral-500">
                          {tpl.channelType || t('crm.marketingUtms.common.empty')} ·{' '}
                          {tpl.utmSource || t('crm.marketingUtms.common.empty')}/
                          {tpl.utmMedium || t('crm.marketingUtms.common.empty')}
                        </span>
                        {tpl.baseUrl && (
                          <div className="mt-1 truncate font-mono text-[10px] text-neutral-500">
                            {tpl.baseUrl}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onApplyTemplate(tpl)}
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-800 transition hover:border-neutral-400"
                        >
                          {t('crm.marketingUtms.actions.applyTemplate')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(tpl)}
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[10px] text-rose-600 transition hover:bg-rose-50"
                        >
                          {t('crm.marketingUtms.actions.deleteTemplate')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <CrmShellModal
        open={!!notice}
        title={notice?.title || ''}
        message={notice?.message || ''}
        variant={notice?.variant === 'error' ? 'error' : 'info'}
        onClose={() => setNotice(null)}
      />

      <CrmShellModal
        open={!!pendingDeleteTpl}
        title={t('crm.common.modalConfirm')}
        message={
          pendingDeleteTpl
            ? t('crm.marketingUtms.confirmDelete', { name: pendingDeleteTpl.name })
            : ''
        }
        cancelLabel={t('crm.common.cancel')}
        confirmLabel={t('crm.common.delete')}
        onClose={() => setPendingDeleteTpl(null)}
        onConfirm={() => void confirmDeleteTemplate()}
      />
    </MainLayout>
  );
};
