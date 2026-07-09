import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration } from '../../api/integrations';
import { useAlertModal } from '../../contexts/AlertModalContext';
import type { SalesChannel } from '../../api/salesChannels';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  channels?: SalesChannel[];
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

export const ShopifyConnectModal: React.FC<Props> = ({ open, onClose, onCreated, channels = [] }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [form, setForm] = useState({ name: '', shopDomain: '', accessToken: '', channelId: '' });
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'guide' | 'form'>('guide');

  const reset = () => {
    setForm({ name: '', shopDomain: '', accessToken: '', channelId: '' });
    setStep('guide');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!form.shopDomain.trim() || !form.accessToken.trim()) {
      showAlert(t('crm.integrationsHub.shopify.errors.missing'), { variant: 'info' });
      return;
    }
    setSaving(true);
    try {
      await createIntegration({
        name: form.name.trim() || `Shopify — ${form.shopDomain.trim()}`,
        kind: 'shopify',
        channelId: form.channelId || undefined,
        config: {
          shopDomain: form.shopDomain.trim(),
          accessToken: form.accessToken.trim(),
        },
      });
      reset();
      onCreated();
      onClose();
    } catch (e) {
      showAlert(e instanceof Error ? e.message : t('crm.salesIntegrations.errors.create'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <IntegrationBrandIcon catalogId="shopify" label="Shopify" size={36} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {t('crm.integrationsHub.shopify.title')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('crm.integrationsHub.shopify.subtitle')}
            </p>
          </div>
        </div>

        {step === 'guide' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-3">
              <p className="font-semibold text-slate-900">{t('crm.integrationsHub.shopify.guide.title')}</p>
              <ol className="space-y-2 list-decimal list-inside">
                <li>{t('crm.integrationsHub.shopify.guide.step1')}</li>
                <li>{t('crm.integrationsHub.shopify.guide.step2')}</li>
                <li>{t('crm.integrationsHub.shopify.guide.step3')}</li>
                <li>{t('crm.integrationsHub.shopify.guide.step4')}</li>
              </ol>
              <p className="text-slate-500">{t('crm.integrationsHub.shopify.guide.permissions')}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                {t('crm.common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                {t('crm.integrationsHub.shopify.guide.next')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3">
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.shopify.form.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('crm.integrationsHub.shopify.form.namePlaceholder')}
                  className={inputCls}
                />
              </div>
              {channels.length > 0 && (
                <div>
                  <label className={labelCls}>{t('crm.salesIntegrations.new.channel')}</label>
                  <select
                    value={form.channelId}
                    onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">{t('crm.salesIntegrations.new.channelAuto')}</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.shopify.form.domain')}</label>
                <input
                  type="text"
                  value={form.shopDomain}
                  onChange={(e) => setForm((f) => ({ ...f, shopDomain: e.target.value }))}
                  placeholder="my-store.myshopify.com"
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  {t('crm.integrationsHub.shopify.form.domainHint')}
                </p>
              </div>
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.shopify.form.token')}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.accessToken}
                  onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                  placeholder="shpat_..."
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  {t('crm.integrationsHub.shopify.form.tokenHint')}
                </p>
              </div>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('guide')}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                ← {t('crm.integrationsHub.shopify.guide.back')}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {t('crm.common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleCreate()}
                  className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving
                    ? t('crm.salesIntegrations.common.creating')
                    : t('crm.salesIntegrations.common.create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BlurModal>
  );
};
