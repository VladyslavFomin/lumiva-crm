import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration } from '../../api/integrations';

type Props = { open: boolean; onClose: () => void; onCreated: () => void; };
type Step = 'guide' | 'form' | 'done';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

function generateToken(): string {
  const arr = new Uint8Array(27);
  crypto.getRandomValues(arr);
  return 'lmv_' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export const JiraConnectModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('guide');
  const [form, setForm] = useState({
    name: '',
    jiraUrl: '',
    email: '',
    apiToken: '',
    projectKey: '',
    inboundToken: generateToken(),
  });
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('guide');
    setForm({ name: '', jiraUrl: '', email: '', apiToken: '', projectKey: '', inboundToken: generateToken() });
    setCreatedId(null);
    setError(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    setError(null);
    if (!form.jiraUrl.trim() || !form.email.trim() || !form.apiToken.trim()) {
      setError(t('crm.integrationsHub.jira.errors.missing'));
      return;
    }
    setSaving(true);
    try {
      const conn = await createIntegration({
        name: form.name.trim() || `Jira — ${form.jiraUrl.replace('https://', '').split('.')[0]}`,
        kind: 'third_party_link',
        config: {
          catalogId: 'jira',
          jiraUrl: form.jiraUrl.trim(),
          accountEmail: form.email.trim(),
          jiraEmail: form.email.trim(),
          apiToken: form.apiToken.trim(),
          projectKey: form.projectKey.trim() || undefined,
          inboundToken: form.inboundToken.trim() || undefined,
        },
      });
      setCreatedId(conn.id);
      setStep('done');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.integrationsHub.jira.errors.create'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <BlurModal open={open} onClose={handleClose} size="sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <IntegrationBrandIcon catalogId="jira" label="Jira" size={36} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('crm.integrationsHub.jira.title')}</h2>
            <p className="text-xs text-slate-500">{t('crm.integrationsHub.jira.subtitle')}</p>
          </div>
        </div>

        {step === 'guide' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">{t('crm.integrationsHub.jira.guide.title')}</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>{t('crm.integrationsHub.jira.guide.step1')}</li>
                <li>{t('crm.integrationsHub.jira.guide.step2')}</li>
                <li>{t('crm.integrationsHub.jira.guide.step3')}</li>
                <li>{t('crm.integrationsHub.jira.guide.step4')}</li>
              </ol>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">{t('crm.common.cancel')}</button>
              <button type="button" onClick={() => setStep('form')} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90">{t('crm.integrationsHub.jira.guide.next')} →</button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-4">
            <div className="grid gap-3">
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.jira.form.jiraUrl')}</label>
                <input
                  type="url"
                  value={form.jiraUrl}
                  onChange={(e) => setForm((f) => ({ ...f, jiraUrl: e.target.value }))}
                  placeholder="https://company.atlassian.net"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.jira.form.email')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.jira.form.apiToken')}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.apiToken}
                  onChange={(e) => setForm((f) => ({ ...f, apiToken: e.target.value }))}
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-slate-400">{t('crm.integrationsHub.jira.form.apiTokenHint')}</p>
              </div>
              <div>
                <label className={labelCls}>
                  {t('crm.integrationsHub.jira.form.projectKey')} <span className="text-slate-400">{t('crm.common.optional')}</span>
                </label>
                <input
                  type="text"
                  value={form.projectKey}
                  onChange={(e) => setForm((f) => ({ ...f, projectKey: e.target.value.toUpperCase() }))}
                  placeholder="PROJ"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.jira.form.inboundToken')}</label>
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
                    className="shrink-0 rounded-xl border border-slate-200 px-3 text-[10px] text-slate-600 hover:bg-slate-50"
                  >
                    {t('crm.integrationsHub.jira.form.regenerate')}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">{t('crm.integrationsHub.jira.form.inboundTokenHint')}</p>
              </div>
              <div>
                <label className={labelCls}>{t('crm.integrationsHub.jira.form.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jira — My Project"
                  className={inputCls}
                />
              </div>
            </div>
            {error && <p className="text-[11px] text-rose-600">{error}</p>}
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
              <p className="font-semibold">{t('crm.integrationsHub.jira.done.title')}</p>
              {createdId && (
                <div>
                  <p className="mb-1 text-[10px] text-emerald-700">{t('crm.integrationsHub.jira.done.inboundUrl')}</p>
                  <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2 font-mono text-[10px] break-all select-all">
                    {`/v1/webhooks/jira/${createdId}?token=${form.inboundToken}`}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-emerald-700">{t('crm.integrationsHub.jira.done.hint')}</p>
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
