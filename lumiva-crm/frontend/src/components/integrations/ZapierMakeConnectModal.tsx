import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration } from '../../api/integrations';
import { useAlertModal } from '../../contexts/AlertModalContext';

type Platform = 'zapier' | 'make';

type Props = {
  open: boolean;
  catalogId: string; // 'zapier' | 'make'
  onClose: () => void;
  onCreated: () => void;
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400 font-mono';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

function generateToken(): string {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return 'lmv_' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const ZapierMakeConnectModal: React.FC<Props> = ({
  open,
  catalogId,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const platform = (catalogId as Platform) === 'make' ? 'make' : 'zapier';
  const platformLabel = platform === 'make' ? 'Make' : 'Zapier';

  const [form, setForm] = useState({
    name: '',
    outboundWebhookUrl: '',
    inboundToken: generateToken(),
    defaultLeadSource: platform,
  });
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'outbound' | 'inbound' | 'done'>('outbound');

  const reset = () => {
    setForm({ name: '', outboundWebhookUrl: '', inboundToken: generateToken(), defaultLeadSource: platform });
    setStep('outbound');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createIntegration({
        name: form.name.trim() || `${platformLabel} — connection`,
        kind: 'third_party_link',
        config: {
          catalogId: platform,
          webhookUrl: form.outboundWebhookUrl.trim() || undefined,
          inboundToken: form.inboundToken.trim(),
          defaultLeadSource: form.defaultLeadSource.trim() || platform,
        },
      });
      setStep('done');
      onCreated();
    } catch (e) {
      showAlert(e instanceof Error ? e.message : t('crm.salesIntegrations.errors.create'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const webhookPlaceholder =
    platform === 'make'
      ? 'https://hook.eu1.make.com/...'
      : 'https://hooks.zapier.com/hooks/catch/...';

  return (
    <BlurModal open={open} onClose={handleClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <IntegrationBrandIcon catalogId={platform} label={platformLabel} size={36} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {t('crm.integrationsHub.zapierMake.title', { platform: platformLabel })}
            </h2>
            <p className="text-xs text-slate-500">
              {t('crm.integrationsHub.zapierMake.subtitle', { platform: platformLabel })}
            </p>
          </div>
        </div>

        {/* Step tabs */}
        <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
          {(['outbound', 'inbound'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                step === s
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'outbound'
                ? t('crm.integrationsHub.zapierMake.tabOutbound', { platform: platformLabel })
                : t('crm.integrationsHub.zapierMake.tabInbound', { platform: platformLabel })}
            </button>
          ))}
        </div>

        {step === 'outbound' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">
                {t('crm.integrationsHub.zapierMake.outboundTitle', { platform: platformLabel })}
              </p>
              <p className="leading-relaxed">
                {t('crm.integrationsHub.zapierMake.outboundDesc', { platform: platformLabel })}
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                {platform === 'make' ? (
                  <>
                    <li>{t('crm.integrationsHub.zapierMake.make.step1')}</li>
                    <li>{t('crm.integrationsHub.zapierMake.make.step2')}</li>
                    <li>{t('crm.integrationsHub.zapierMake.make.step3')}</li>
                  </>
                ) : (
                  <>
                    <li>{t('crm.integrationsHub.zapierMake.zapier.step1')}</li>
                    <li>{t('crm.integrationsHub.zapierMake.zapier.step2')}</li>
                    <li>{t('crm.integrationsHub.zapierMake.zapier.step3')}</li>
                  </>
                )}
              </ol>
            </div>

            <div>
              <label className={labelCls}>
                {t('crm.integrationsHub.zapierMake.form.name')}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={`${platformLabel} — основной`}
                className={inputCls + ' font-sans'}
              />
            </div>
            <div>
              <label className={labelCls}>
                {t('crm.integrationsHub.zapierMake.form.outboundUrl', { platform: platformLabel })}
                <span className="ml-1 text-slate-400">({t('crm.common.optional')})</span>
              </label>
              <input
                type="url"
                value={form.outboundWebhookUrl}
                onChange={(e) => setForm((f) => ({ ...f, outboundWebhookUrl: e.target.value }))}
                placeholder={webhookPlaceholder}
                className={inputCls}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                {t('crm.integrationsHub.zapierMake.form.outboundUrlHint', { platform: platformLabel })}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={handleClose}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">
                {t('crm.common.cancel')}
              </button>
              <button type="button" onClick={() => setStep('inbound')}
                className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90">
                {t('crm.common.next')} →
              </button>
            </div>
          </div>
        )}

        {step === 'inbound' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">
                {t('crm.integrationsHub.zapierMake.inboundTitle', { platform: platformLabel })}
              </p>
              <p className="leading-relaxed">
                {t('crm.integrationsHub.zapierMake.inboundDesc', { platform: platformLabel })}
              </p>
              <p className="text-slate-500 text-[10px]">
                {t('crm.integrationsHub.zapierMake.inboundFieldsHint')}
              </p>
            </div>

            <div>
              <label className={labelCls}>
                {t('crm.integrationsHub.zapierMake.form.inboundToken')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.inboundToken}
                  onChange={(e) => setForm((f) => ({ ...f, inboundToken: e.target.value }))}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, inboundToken: generateToken() }))}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] text-slate-700 hover:bg-slate-50"
                >
                  {t('crm.integrationsHub.zapierMake.form.regenerate')}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {t('crm.integrationsHub.zapierMake.form.inboundTokenHint')}
              </p>
            </div>
            <div>
              <label className={labelCls}>
                {t('crm.integrationsHub.zapierMake.form.leadSource')}
              </label>
              <input
                type="text"
                value={form.defaultLeadSource}
                onChange={(e) => setForm((f) => ({ ...f, defaultLeadSource: e.target.value }))}
                placeholder={platform}
                className={inputCls + ' font-sans'}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                {t('crm.integrationsHub.zapierMake.form.leadSourceHint')}
              </p>
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <button type="button" onClick={() => setStep('outbound')}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">
                ← {t('crm.common.back')}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={handleClose}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">
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
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-800 space-y-2">
              <p className="font-semibold">✓ {t('crm.integrationsHub.zapierMake.done.title')}</p>
              <p>{t('crm.integrationsHub.zapierMake.done.desc', { platform: platformLabel })}</p>
              <p className="text-[10px] text-emerald-700">
                {t('crm.integrationsHub.zapierMake.done.findUrl')}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                {t('crm.common.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </BlurModal>
  );
};
