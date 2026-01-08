import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  createUtmTemplate,
  fetchUtmTemplates,
  deleteUtmTemplate,
  type MarketingUtmTemplate,
} from '../../api/marketing';

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

export const UtmsPage: React.FC = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState<UtmFormState>(defaultForm);
  const [templates, setTemplates] = useState<MarketingUtmTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // загрузка сохранённых шаблонов
  useEffect(() => {
    setLoading(true);
    fetchUtmTemplates()
      .then(setTemplates)
      .catch((e: any) => {
        console.error(e);
        setError(e?.message || t('crm.marketingUtms.errors.loadTemplates'));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof UtmFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const applyChannelPreset = (channel: ChannelPreset) => {
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

  const generatedUrl = useMemo(() => {
    if (!form.baseUrl) return '';

    const url = new URL(form.baseUrl, form.baseUrl.startsWith('http') ? undefined : 'https://dummy.host');
    const params = url.searchParams;

    if (form.source) params.set('utm_source', form.source);
    if (form.medium) params.set('utm_medium', form.medium);
    if (form.campaign) params.set('utm_campaign', form.campaign);
    if (form.content) params.set('utm_content', form.content);
    if (form.term) params.set('utm_term', form.term);

    const full = url.toString();
    // убираем dummy.host, если юзер ввёл без протокола
    return full.replace('https://dummy.host', '');
  }, [form]);

  const onSaveTemplate = async () => {
    if (!form.nameForTemplate.trim()) {
      alert(t('crm.marketingUtms.errors.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const created = await createUtmTemplate({
        name: form.nameForTemplate.trim(),
        baseUrl: form.baseUrl || undefined,
        channelType: form.channel,
        utmSource: form.source || undefined,
        utmMedium: form.medium || undefined,
        utmCampaign: form.campaign || undefined,
        utmContent: form.content || undefined,
        utmTerm: form.term || undefined,
      });

      setTemplates((prev) => [created, ...prev]);
      setForm((prev) => ({ ...prev, nameForTemplate: '' }));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || t('crm.marketingUtms.errors.saveTemplate'));
    } finally {
      setSaving(false);
    }
  };

  const onApplyTemplate = (tpl: MarketingUtmTemplate) => {
    setForm((prev) => ({
      ...prev,
      baseUrl: tpl.baseUrl || prev.baseUrl,
      channel: (tpl.channelType as ChannelPreset) || prev.channel,
      source: tpl.utmSource || '',
      medium: tpl.utmMedium || '',
      campaign: tpl.utmCampaign || '',
      content: tpl.utmContent || '',
      term: tpl.utmTerm || '',
      nameForTemplate: tpl.name,
    }));
  };

  const onDeleteTemplate = async (tpl: MarketingUtmTemplate) => {
    if (
      !window.confirm(
        t('crm.marketingUtms.confirmDelete', { name: tpl.name }),
      )
    )
      return;

    try {
      await deleteUtmTemplate(tpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || t('crm.marketingUtms.errors.deleteTemplate'));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingUtms.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingUtms.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingUtms.subtitle')}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Левая колонка: форма */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 space-y-4">
            <div>
              <div className="text-[11px] text-slate-400 mb-1">
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
                    className={
                      'px-3 py-1.5 rounded-xl text-[11px] border transition ' +
                      (form.channel === key
                        ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                        : 'border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-sky-500/60 hover:text-sky-200')
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {t('crm.marketingUtms.fields.baseUrl')}
                </label>
                <input
                  className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={form.baseUrl}
                  onChange={(e) => handleChange('baseUrl', e.target.value)}
                  placeholder={t('crm.marketingUtms.placeholders.baseUrl')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingUtms.fields.utm_source')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={form.source}
                    onChange={(e) =>
                      handleChange('source', e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingUtms.fields.utm_medium')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={form.medium}
                    onChange={(e) =>
                      handleChange('medium', e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {t('crm.marketingUtms.fields.utm_campaign')}
                </label>
                <input
                  className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={form.campaign}
                  onChange={(e) =>
                    handleChange('campaign', e.target.value)
                  }
                  placeholder={t('crm.marketingUtms.placeholders.utm_campaign')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingUtms.fields.utm_content')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={form.content}
                    onChange={(e) =>
                      handleChange('content', e.target.value)
                    }
                    placeholder={t('crm.marketingUtms.placeholders.utm_content')}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    {t('crm.marketingUtms.fields.utm_term')}
                  </label>
                  <input
                    className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                    value={form.term}
                    onChange={(e) => handleChange('term', e.target.value)}
                    placeholder={t('crm.marketingUtms.placeholders.utm_term')}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[11px] text-slate-400 mb-1">
                  {t('crm.marketingUtms.fields.generatedUrl')}
                </label>
                <textarea
                  className="w-full h-20 rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-[11px] text-slate-100 outline-none"
                  readOnly
                  value={generatedUrl}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-slate-800/80 pt-3">
              <div className="flex-1">
                <label className="block text-[11px] text-slate-400 mb-1">
                  {t('crm.marketingUtms.fields.templateName')}
                </label>
                <input
                  className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                  value={form.nameForTemplate}
                  onChange={(e) =>
                    handleChange('nameForTemplate', e.target.value)
                  }
                  placeholder={t('crm.marketingUtms.placeholders.templateName')}
                />
              </div>
              <button
                type="button"
                onClick={onSaveTemplate}
                disabled={saving}
                className="md:w-auto w-full px-4 py-2 rounded-2xl bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving
                  ? t('crm.marketingUtms.actions.saving')
                  : t('crm.marketingUtms.actions.saveTemplate')}
              </button>
            </div>
          </div>

          {/* Правая колонка: список шаблонов */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  {t('crm.marketingUtms.templates.title')}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {t('crm.marketingUtms.templates.subtitle')}
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                {t('crm.marketingUtms.templates.total', {
                  count: templates.length,
                })}
              </span>
            </div>

            {loading && (
              <div className="text-[11px] text-slate-400">
                {t('crm.marketingUtms.loading')}
              </div>
            )}

            {error && (
              <div className="text-[11px] text-red-400 mb-2">{error}</div>
            )}

            {!loading && !templates.length && (
              <div className="text-[11px] text-slate-500">
                {t('crm.marketingUtms.templates.empty')}
              </div>
            )}

            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-2xl border border-slate-800/90 bg-slate-900/70 px-3 py-2.5 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-50">
                        {tpl.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {tpl.channelType || t('crm.marketingUtms.common.empty')} ·{' '}
                        {tpl.utmSource || t('crm.marketingUtms.common.empty')}/
                        {tpl.utmMedium || t('crm.marketingUtms.common.empty')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onApplyTemplate(tpl)}
                        className="px-2.5 py-1 rounded-xl border border-sky-500/60 text-[10px] text-sky-300 hover:bg-sky-500/10"
                      >
                        {t('crm.marketingUtms.actions.applyTemplate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTemplate(tpl)}
                        className="px-2.5 py-1 rounded-xl border border-rose-500/60 text-[10px] text-rose-300 hover:bg-rose-500/10"
                      >
                        {t('crm.marketingUtms.actions.deleteTemplate')}
                      </button>
                    </div>
                  </div>
                  {tpl.baseUrl && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {tpl.baseUrl}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};
