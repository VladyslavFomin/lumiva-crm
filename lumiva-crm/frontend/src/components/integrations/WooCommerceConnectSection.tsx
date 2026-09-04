import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createIntegration } from '../../api/integrations';
import type { SalesChannel } from '../../api/salesChannels';

type NewWooFormState = {
  name: string;
  description: string;
  channelId: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
};

export type WooCommerceConnectSectionProps = {
  channels: SalesChannel[];
  onCreated: () => void;
  /** Used inside bottom sheet: no duplicate title / lighter chrome */
  variant?: 'default' | 'inSheet';
};

export const WooCommerceConnectSection: React.FC<WooCommerceConnectSectionProps> = ({
  channels,
  onCreated,
  variant = 'default',
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<NewWooFormState>({
    name: '',
    description: '',
    channelId: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!form.url.trim() || !form.consumerKey.trim() || !form.consumerSecret.trim()) {
      setError(t('crm.salesIntegrations.errors.createMissing'));
      return;
    }
    setCreating(true);
    try {
      await createIntegration({
        name:
          form.name.trim() ||
          t('crm.salesIntegrations.defaults.woocommerceName'),
        kind: 'woocommerce',
        channelId: form.channelId || undefined,
        description: form.description.trim() || undefined,
        config: {
          url: form.url.trim(),
          consumerKey: form.consumerKey.trim(),
          consumerSecret: form.consumerSecret.trim(),
        },
      });
      setForm({
        name: '',
        description: '',
        channelId: '',
        url: '',
        consumerKey: '',
        consumerSecret: '',
      });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.salesIntegrations.errors.create'));
    } finally {
      setCreating(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';
  const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

  const inSheet = variant === 'inSheet';
  const shell = inSheet
    ? 'space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5'
    : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4';

  return (
    <div className={shell}>
      {!inSheet ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t('crm.integrationsHub.wooSectionTitle')}
          </h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {t('crm.integrationsHub.wooSectionSubtitle')}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('crm.salesIntegrations.new.name')}</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('crm.salesIntegrations.new.namePlaceholder')}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('crm.salesIntegrations.new.channel')}</label>
          <select
            value={form.channelId}
            onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
            className={inputCls}
          >
            <option value="">{t('crm.salesIntegrations.new.channelAuto')}</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('crm.salesIntegrations.new.description')}</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t('crm.salesIntegrations.new.descriptionPlaceholder')}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('crm.salesIntegrations.new.url')}</label>
          <input
            type="text"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder={t('crm.salesIntegrations.new.urlPlaceholder')}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('crm.salesIntegrations.new.consumerKey')}</label>
          <input
            type="text"
            value={form.consumerKey}
            onChange={(e) => setForm((f) => ({ ...f, consumerKey: e.target.value }))}
            placeholder="ck_..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('crm.salesIntegrations.new.consumerSecret')}</label>
          <input
            type="password"
            autoComplete="new-password"
            value={form.consumerSecret}
            onChange={(e) => setForm((f) => ({ ...f, consumerSecret: e.target.value }))}
            placeholder="cs_..."
            className={inputCls}
          />
        </div>
      </div>

      {error && <p className="text-[11px] text-rose-600">{error}</p>}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={creating}
          onClick={() => void handleCreate()}
          className="rounded-full bg-[#222222] px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {creating ? t('crm.salesIntegrations.common.creating') : t('crm.salesIntegrations.common.create')}
        </button>
      </div>
    </div>
  );
};
