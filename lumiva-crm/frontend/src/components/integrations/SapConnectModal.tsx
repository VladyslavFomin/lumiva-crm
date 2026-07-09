import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration, type IntegrationConnectionDto } from '../../api/integrations';
import { useAlertModal } from '../../contexts/AlertModalContext';

type Props = { open: boolean; onClose: () => void; onCreated: () => void; };
type Step = 'guide' | 'form' | 'done';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

function generateToken(): string {
  const arr = new Uint8Array(27);
  crypto.getRandomValues(arr);
  return 'lmv_' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export const SapConnectModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [step, setStep] = useState<Step>('guide');
  const [form, setForm] = useState({ name: '', apiKey: generateToken(), sapApiUrl: '', defaultLeadSource: 'sap' });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<IntegrationConnectionDto | null>(null);

  const reset = () => {
    setStep('guide');
    setForm({ name: '', apiKey: generateToken(), sapApiUrl: '', defaultLeadSource: 'sap' });
    setCreated(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!form.apiKey.trim()) {
      showAlert(t('crm.integrationsHub.sap.errors.noKey'), { variant: 'info' });
      return;
    }
    setSaving(true);
    try {
      const conn = await createIntegration({
        name: form.name.trim() || 'SAP',
        kind: 'third_party_link',
        config: {
          catalogId: 'sap',
          apiKey: form.apiKey.trim(),
          webhookUrl: form.sapApiUrl.trim() || undefined,
          defaultLeadSource: form.defaultLeadSource.trim() || 'sap',
        },
      });
      setCreated(conn);
      setStep('done');
      onCreated();
    } catch (e) {
      showAlert(e instanceof Error ? e.message : t('crm.integrationsHub.sap.errors.create'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inboundUrl = created
    ? `${window.location.origin.replace(/:\d+$/, ':3000')}/v1/webhooks/sap/${created.id}`
    : null;

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <IntegrationBrandIcon catalogId="sap" label="SAP" size={36} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('crm.integrationsHub.sap.title')}</h2>
            <p className="text-xs text-slate-500">{t('crm.integrationsHub.sap.subtitle')}</p>
          </div>
        </div>

        {step === 'guide' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">{t('crm.integrationsHub.sap.guide.title')}</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>{t('crm.integrationsHub.sap.guide.step1')}</li>
                <li>{t('crm.integrationsHub.sap.guide.step2')}</li>
                <li>{t('crm.integrationsHub.sap.guide.step3')}</li>
                <li>{t('crm.integrationsHub.sap.guide.step4')}</li>
              </ol>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">{t('crm.common.cancel')}</button>
              <button type="button" onClick={() => setStep('form')} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90">{t('crm.integrationsHub.sap.guide.next')} →</button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-4">
            <div className="grid gap-3">
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.sap.form.apiKey')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, apiKey: generateToken() }))}
                    className="shrink-0 rounded-xl border border-slate-200 px-3 text-[10px] text-slate-600 hover:bg-slate-50"
                  >
                    {t('crm.integrationsHub.sap.form.regenerate')}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">{t('crm.integrationsHub.sap.form.apiKeyHint')}</p>
              </div>
              <div>
                <label className={labelCls}>
                  {t('crm.integrationsHub.sap.form.sapUrl')} <span className="text-slate-400">{t('crm.common.optional')}</span>
                </label>
                <input
                  type="url"
                  value={form.sapApiUrl}
                  onChange={(e) => setForm((f) => ({ ...f, sapApiUrl: e.target.value }))}
                  placeholder="https://sap.company.com/api"
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-slate-400">{t('crm.integrationsHub.sap.form.sapUrlHint')}</p>
              </div>
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.sap.form.defaultSource')}</label>
                <input
                  type="text"
                  value={form.defaultLeadSource}
                  onChange={(e) => setForm((f) => ({ ...f, defaultLeadSource: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.sap.form.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="SAP Business One"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button type="button" onClick={() => setStep('guide')} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">← {t('crm.common.back')}</button>
              <div className="flex gap-2">
                <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">{t('crm.common.cancel')}</button>
                <button type="button" disabled={saving} onClick={() => void handleCreate()} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {saving ? t('crm.salesIntegrations.common.creating') : t('crm.salesIntegrations.common.create')}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-3">
              <p className="font-semibold">{t('crm.integrationsHub.sap.done.title')}</p>
              <div>
                <p className="mb-1.5 text-[10px] text-emerald-700">{t('crm.integrationsHub.sap.done.inboundUrl')}</p>
                {inboundUrl && (
                  <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2 font-mono text-[10px] break-all select-all">{inboundUrl}</div>
                )}
              </div>
              <div>
                <p className="mb-1 text-[10px] text-emerald-700">{t('crm.integrationsHub.sap.done.tokenLabel')}</p>
                <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2 font-mono text-[10px] select-all">{form.apiKey}</div>
              </div>
              <p className="text-[10px] text-emerald-700">{t('crm.integrationsHub.sap.done.hint')}</p>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleClose} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90">{t('crm.common.close')}</button>
            </div>
          </div>
        )}
      </div>
    </BlurModal>
  );
};
