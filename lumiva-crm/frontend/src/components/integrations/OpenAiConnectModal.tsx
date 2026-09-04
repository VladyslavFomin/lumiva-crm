import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration } from '../../api/integrations';
import { LottieIcon } from '../LottieIcon';

type Props = { open: boolean; onClose: () => void; onCreated: () => void; };

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o3-mini'];
const ANTHROPIC_MODELS = ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'];

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

export const OpenAiConnectModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    apiKey: '',
    provider: 'openai' as 'openai' | 'anthropic',
    model: 'gpt-4o',
    baseUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setForm({ name: '', apiKey: '', provider: 'openai', model: 'gpt-4o', baseUrl: '' });
    setError(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const setProvider = (provider: 'openai' | 'anthropic') => {
    setForm((f) => ({
      ...f,
      provider,
      model: provider === 'anthropic' ? ANTHROPIC_MODELS[0] : OPENAI_MODELS[0],
    }));
  };

  const handleCreate = async () => {
    setError(null);
    if (!form.apiKey.trim()) {
      setError(t('crm.integrationsHub.openai.errors.noKey'));
      return;
    }
    setSaving(true);
    try {
      await createIntegration({
        name: form.name.trim() || (form.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'),
        kind: 'third_party_link',
        config: {
          catalogId: 'openai',
          apiToken: form.apiKey.trim(),
          provider: form.provider,
          model: form.model || undefined,
          webhookUrl: form.baseUrl.trim() || undefined,
        },
      });
      reset();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.integrationsHub.openai.errors.create'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose} size="lg">
      <div className="relative flex max-h-[min(88vh,820px)] w-full flex-col overflow-y-auto overscroll-contain sm:flex-row sm:overflow-visible">
        {saving && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/85 backdrop-blur-[1px]">
            <LottieIcon name="integration-connect" size={88} />
            <span className="text-[11px] font-medium text-slate-600">
              {t('crm.automations.panel.integrations.connectingInProgress')}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1 bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <IntegrationBrandIcon catalogId="openai" label="OpenAI" size={36} />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t('crm.integrationsHub.openai.title')}</h2>
              <p className="text-xs text-slate-500">{t('crm.integrationsHub.openai.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t('crm.integrationsHub.openai.form.provider')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProvider('openai')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    form.provider === 'openai'
                      ? 'border-[#222222] bg-[#222222] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  OpenAI
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('anthropic')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    form.provider === 'anthropic'
                      ? 'border-[#D97757] bg-[#D97757] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Anthropic (Claude)
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-900">
                {form.provider === 'anthropic'
                  ? t('crm.integrationsHub.openai.guide.titleAnthropic')
                  : t('crm.integrationsHub.openai.guide.title')}
              </p>
              <ol className="list-decimal list-inside space-y-1">
                {form.provider === 'anthropic' ? (
                  <>
                    <li>{t('crm.integrationsHub.openai.guide.anthropicStep1')}</li>
                    <li>{t('crm.integrationsHub.openai.guide.anthropicStep2')}</li>
                    <li>{t('crm.integrationsHub.openai.guide.anthropicStep3')}</li>
                  </>
                ) : (
                  <>
                    <li>{t('crm.integrationsHub.openai.guide.step1')}</li>
                    <li>{t('crm.integrationsHub.openai.guide.step2')}</li>
                    <li>{t('crm.integrationsHub.openai.guide.step3')}</li>
                  </>
                )}
              </ol>
            </div>

            <div>
              <label className={labelCls}>{t('crm.integrationsHub.openai.form.apiKey')}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={form.provider === 'anthropic' ? 'sk-ant-...' : 'sk-... or sk-proj-...'}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{t('crm.integrationsHub.openai.form.model')}</label>
              <select value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className={inputCls}>
                {(form.provider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>
                {t('crm.integrationsHub.openai.form.baseUrl')} <span className="text-slate-400">{t('crm.common.optional')}</span>
              </label>
              <input
                type="url"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://api.openai.com"
                className={inputCls}
              />
              <p className="mt-1 text-[10px] text-slate-400">{t('crm.integrationsHub.openai.form.baseUrlHint')}</p>
            </div>

            <div>
              <label className={labelCls}>{t('crm.integrationsHub.openai.form.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="OpenAI"
                className={inputCls}
              />
            </div>

            {error && <p className="text-[11px] text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">{t('crm.common.cancel')}</button>
              <button type="button" disabled={saving} onClick={() => void handleCreate()} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? t('crm.salesIntegrations.common.creating') : t('crm.salesIntegrations.common.create')}
              </button>
            </div>
          </div>
        </div>
        <div className="hidden w-[300px] shrink-0 flex-col items-center justify-center gap-3 border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100/80 p-8 text-center sm:flex sm:border-l">
          <LottieIcon name="data-extraction" size={210} />
          <div>
            <p className="text-xs font-semibold text-slate-800">{t('crm.integrationsHub.openai.sidePanel.title')}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('crm.integrationsHub.openai.sidePanel.body')}</p>
          </div>
        </div>
      </div>
    </BlurModal>
  );
};
