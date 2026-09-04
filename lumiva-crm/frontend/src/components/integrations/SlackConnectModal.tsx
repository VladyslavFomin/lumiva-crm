import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlurModal } from './BlurModal';
import { IntegrationBrandIcon } from '../../pages/automations/IntegrationBrandIcon';
import { createIntegration, startSlackOAuth } from '../../api/integrations';

type Props = { open: boolean; onClose: () => void; onCreated: () => void; };
type Tab = 'outbound' | 'inbound' | 'done';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

function generateToken(): string {
  const arr = new Uint8Array(27);
  crypto.getRandomValues(arr);
  return 'lmv_' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export const SlackConnectModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('outbound');
  const [form, setForm] = useState({
    name: '',
    webhookUrl: '',
    inboundToken: generateToken(),
    defaultLeadSource: 'slack',
  });
  const [saving, setSaving] = useState(false);
  const [inboundUrl, setInboundUrl] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSlackOAuth = async () => {
    setOauthBusy(true);
    setError(null);
    try {
      const { url } = await startSlackOAuth({ redirectPath: '/integrations-hub?tab=connections' });
      window.location.assign(url);
    } catch (e) {
      setOauthBusy(false);
      setError(e instanceof Error ? e.message : t('crm.integrationsHub.slack.oauth.startError'));
    }
  };

  const reset = () => {
    setForm({ name: '', webhookUrl: '', inboundToken: generateToken(), defaultLeadSource: 'slack' });
    setTab('outbound');
    setInboundUrl(null);
    setError(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    setError(null);
    setSaving(true);
    try {
      const conn = await createIntegration({
        name: form.name.trim() || 'Slack',
        kind: 'third_party_link',
        config: {
          catalogId: 'slack',
          webhookUrl: form.webhookUrl.trim() || undefined,
          inboundToken: form.inboundToken.trim() || undefined,
          defaultLeadSource: form.defaultLeadSource.trim() || 'slack',
        },
      });
      setInboundUrl(conn.zapierMakeInboundWebhookUrl ?? null);
      setTab('done');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.integrationsHub.slack.errors.create'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-full px-4 py-1.5 text-[11px] font-semibold transition ${tab === id ? 'bg-[#222222] text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );

  return (
    <BlurModal open={open} onClose={handleClose} size="sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <IntegrationBrandIcon catalogId="slack" label="Slack" size={36} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('crm.integrationsHub.slack.title')}</h2>
            <p className="text-xs text-slate-500">{t('crm.integrationsHub.slack.subtitle')}</p>
          </div>
        </div>

        {tab !== 'done' && (
          <div className="mb-4 flex gap-2">
            {tabBtn('outbound', t('crm.integrationsHub.slack.tabOutbound'))}
            {tabBtn('inbound', t('crm.integrationsHub.slack.tabInbound'))}
          </div>
        )}

        {error && <p className="mb-3 text-[11px] text-rose-600">{error}</p>}

        {tab === 'outbound' && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={oauthBusy}
              onClick={() => void handleSlackOAuth()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4A154B] px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {oauthBusy ? t('crm.integrationsHub.slack.oauth.busy') : t('crm.integrationsHub.slack.oauth.connect')}
            </button>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              {t('crm.integrationsHub.slack.oauth.or')}
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">{t('crm.integrationsHub.slack.outbound.guideTitle')}</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>{t('crm.integrationsHub.slack.outbound.step1')}</li>
                <li>{t('crm.integrationsHub.slack.outbound.step2')}</li>
                <li>{t('crm.integrationsHub.slack.outbound.step3')}</li>
              </ol>
            </div>
            <div>
              <label className={labelCls}>{t('crm.integrationsHub.slack.outbound.webhookUrl')}</label>
              <input
                type="url"
                value={form.webhookUrl}
                onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className={inputCls}
              />
              <p className="mt-1 text-[10px] text-slate-400">{t('crm.integrationsHub.slack.outbound.webhookHint')}</p>
            </div>
            <div>
              <label className={labelCls}>{t('crm.integrationsHub.slack.form.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Slack — #sales"
                className={inputCls}
              />
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">{t('crm.common.cancel')}</button>
              <button type="button" onClick={() => setTab('inbound')} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90">{t('crm.common.next')} →</button>
            </div>
          </div>
        )}

        {tab === 'inbound' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900">{t('crm.integrationsHub.slack.inbound.guideTitle')}</p>
              <p>{t('crm.integrationsHub.slack.inbound.guideDesc')}</p>
            </div>
            <div>
              <label className={labelCls}>{t('crm.integrationsHub.slack.inbound.token')}</label>
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
                  {t('crm.integrationsHub.slack.inbound.regenerate')}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('crm.integrationsHub.slack.inbound.defaultSource')}</label>
              <input
                type="text"
                value={form.defaultLeadSource}
                onChange={(e) => setForm((f) => ({ ...f, defaultLeadSource: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button type="button" onClick={() => setTab('outbound')} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">← {t('crm.common.back')}</button>
              <div className="flex gap-2">
                <button type="button" onClick={handleClose} className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">{t('crm.common.cancel')}</button>
                <button type="button" disabled={saving} onClick={() => void handleCreate()} className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {saving ? t('crm.salesIntegrations.common.creating') : t('crm.salesIntegrations.common.create')}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'done' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-2">
              <p className="font-semibold">{t('crm.integrationsHub.slack.done.title')}</p>
              {inboundUrl && (
                <div>
                  <p className="mb-1 text-[10px] text-emerald-700">{t('crm.integrationsHub.slack.done.inboundUrl')}</p>
                  <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2 font-mono text-[10px] break-all select-all">
                    {inboundUrl}?token={form.inboundToken}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-emerald-700">{t('crm.integrationsHub.slack.done.hint')}</p>
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
