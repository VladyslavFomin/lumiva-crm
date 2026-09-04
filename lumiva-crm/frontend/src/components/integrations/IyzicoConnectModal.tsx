import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration } from '../../api/integrations';

type Props = { open: boolean; onClose: () => void; onCreated: () => void };

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

export const IyzicoConnectModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', apiKey: '', secretKey: '', sandbox: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setForm({ name: '', apiKey: '', secretKey: '', sandbox: true }); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    setError(null);
    if (!form.apiKey.trim() || !form.secretKey.trim()) {
      setError(t('crm.integrationsHub.iyzico.errors.missing'));
      return;
    }
    setSaving(true);
    try {
      await createIntegration({
        name: form.name.trim() || 'iyzico',
        kind: 'third_party_link',
        config: {
          catalogId: 'iyzico',
          apiKey: form.apiKey.trim(),
          apiToken: form.secretKey.trim(),
          sandbox: form.sandbox,
        },
      });
      reset();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.integrationsHub.iyzico.errors.create'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose} size="sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <IntegrationBrandIcon catalogId="iyzico" label="iyzico" size={36} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('crm.integrationsHub.iyzico.title')}</h2>
            <p className="text-xs text-slate-500">{t('crm.integrationsHub.iyzico.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600">
            {t('crm.integrationsHub.iyzico.guideHint')}
          </div>
          <div className="grid gap-3">
            <div>
              <label className={labelCls}>{t('crm.integrationsHub.iyzico.form.apiKey')}</label>
              <input
                type="text"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sandbox-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t('crm.integrationsHub.iyzico.form.secretKey')}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={form.secretKey}
                onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))}
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={form.sandbox}
                onChange={(e) => setForm((f) => ({ ...f, sandbox: e.target.checked }))}
              />
              {t('crm.integrationsHub.iyzico.form.sandbox')}
            </label>
            <div>
              <label className={labelCls}>
                {t('crm.integrationsHub.iyzico.form.name')} <span className="text-slate-400">{t('crm.common.optional')}</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="iyzico"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-[11px] text-rose-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">
            {t('crm.common.cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreate()}
            className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t('crm.salesIntegrations.common.creating') : t('crm.salesIntegrations.common.create')}
          </button>
        </div>
      </div>
    </BlurModal>
  );
};
