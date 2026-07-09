import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration } from '../../api/integrations';
import { useAlertModal } from '../../contexts/AlertModalContext';

type Props = { open: boolean; onClose: () => void; onCreated: () => void; };

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o3-mini'];

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

export const OpenAiConnectModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [form, setForm] = useState({ name: '', apiKey: '', model: 'gpt-4o', baseUrl: '' });
  const [saving, setSaving] = useState(false);

  const reset = () => { setForm({ name: '', apiKey: '', model: 'gpt-4o', baseUrl: '' }); };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!form.apiKey.trim()) {
      showAlert(t('crm.integrationsHub.openai.errors.noKey'), { variant: 'info' });
      return;
    }
    setSaving(true);
    try {
      await createIntegration({
        name: form.name.trim() || 'OpenAI',
        kind: 'third_party_link',
        config: {
          catalogId: 'openai',
          apiToken: form.apiKey.trim(),
          model: form.model || undefined,
          webhookUrl: form.baseUrl.trim() || undefined,
        },
      });
      reset();
      onCreated();
      onClose();
    } catch (e) {
      showAlert(e instanceof Error ? e.message : t('crm.integrationsHub.openai.errors.create'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <IntegrationBrandIcon catalogId="openai" label="OpenAI" size={36} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('crm.integrationsHub.openai.title')}</h2>
            <p className="text-xs text-slate-500">{t('crm.integrationsHub.openai.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-1.5">
            <p className="font-semibold text-slate-900">{t('crm.integrationsHub.openai.guide.title')}</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>{t('crm.integrationsHub.openai.guide.step1')}</li>
              <li>{t('crm.integrationsHub.openai.guide.step2')}</li>
              <li>{t('crm.integrationsHub.openai.guide.step3')}</li>
            </ol>
          </div>

          <div>
            <label className={labelCls}>{t('crm.integrationsHub.openai.form.apiKey')}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder="sk-... or sk-proj-..."
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t('crm.integrationsHub.openai.form.model')}</label>
            <select value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className={inputCls}>
              {OPENAI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
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

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">{t('crm.common.cancel')}</button>
            <button type="button" disabled={saving} onClick={() => void handleCreate()} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {saving ? t('crm.salesIntegrations.common.creating') : t('crm.salesIntegrations.common.create')}
            </button>
          </div>
        </div>
      </div>
    </BlurModal>
  );
};
