import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration } from '../../api/integrations';
import { useAlertModal } from '../../contexts/AlertModalContext';

type Props = { open: boolean; onClose: () => void; onCreated: () => void; };
type Step = 'guide' | 'form';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

export const OneCConnectModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [step, setStep] = useState<Step>('guide');
  const [form, setForm] = useState({ name: '', baseUrl: '', login: '', password: '', infobase: '', servicePath: '' });
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep('guide');
    setForm({ name: '', baseUrl: '', login: '', password: '', infobase: '', servicePath: '' });
  };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    if (!form.baseUrl.trim() || !form.login.trim() || !form.password.trim()) {
      showAlert(t('crm.integrationsHub.onec.errors.missing'), { variant: 'info' });
      return;
    }
    setSaving(true);
    try {
      await createIntegration({
        name: form.name.trim() || '1С:Предприятие',
        kind: 'third_party_link',
        config: {
          catalogId: '1c',
          baseUrl: form.baseUrl.trim(),
          login: form.login.trim(),
          password: form.password.trim(),
          infobase: form.infobase.trim() || undefined,
          servicePath: form.servicePath.trim() || undefined,
        },
      });
      reset();
      onCreated();
      onClose();
    } catch (e) {
      showAlert(e instanceof Error ? e.message : t('crm.integrationsHub.onec.errors.create'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <IntegrationBrandIcon catalogId="1c" label="1С" size={36} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('crm.integrationsHub.onec.title')}</h2>
            <p className="text-xs text-slate-500">{t('crm.integrationsHub.onec.subtitle')}</p>
          </div>
        </div>

        {step === 'guide' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-3">
              <p className="font-semibold text-slate-900">{t('crm.integrationsHub.onec.guide.title')}</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>{t('crm.integrationsHub.onec.guide.step1')}</li>
                <li>{t('crm.integrationsHub.onec.guide.step2')}</li>
                <li>{t('crm.integrationsHub.onec.guide.step3')}</li>
                <li>{t('crm.integrationsHub.onec.guide.step4')}</li>
                <li>{t('crm.integrationsHub.onec.guide.step5')}</li>
              </ol>
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800">{t('crm.integrationsHub.onec.guide.note')}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">{t('crm.common.cancel')}</button>
              <button type="button" onClick={() => setStep('form')} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90">{t('crm.integrationsHub.onec.guide.next')} →</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3">
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.onec.form.baseUrl')}</label>
                <input
                  type="url"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="http://192.168.1.1/accounting"
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-slate-400">{t('crm.integrationsHub.onec.form.baseUrlHint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('crm.integrationsHub.onec.form.login')}</label>
                  <input
                    type="text"
                    value={form.login}
                    onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
                    placeholder="Администратор"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('crm.integrationsHub.onec.form.password')}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    {t('crm.integrationsHub.onec.form.infobase')} <span className="text-slate-400">{t('crm.common.optional')}</span>
                  </label>
                  <input
                    type="text"
                    value={form.infobase}
                    onChange={(e) => setForm((f) => ({ ...f, infobase: e.target.value }))}
                    placeholder="crm"
                    className={inputCls}
                  />
                  <p className="mt-1 text-[10px] text-slate-400">{t('crm.integrationsHub.onec.form.infobaseHint')}</p>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('crm.integrationsHub.onec.form.servicePath')} <span className="text-slate-400">{t('crm.common.optional')}</span>
                  </label>
                  <input
                    type="text"
                    value={form.servicePath}
                    onChange={(e) => setForm((f) => ({ ...f, servicePath: e.target.value }))}
                    placeholder="crm"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.onec.form.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="1С — Бухгалтерия"
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
      </div>
    </BlurModal>
  );
};
