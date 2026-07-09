// src/pages/sales/SalesIntegrationNewPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchAdapters,
  fetchIntegrations,
  type IntegrationAdapterDto,
  type IntegrationKind,
  type CreateIntegrationPayload,
  createIntegration,
} from '../../api/integrations';
import { fetchSalesChannels, type SalesChannel } from '../../api/salesChannels';

export const SalesIntegrationNewPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [adapters, setAdapters] = useState<IntegrationAdapterDto[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<IntegrationKind | ''>('');
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState<string | ''>('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchAdapters(), fetchSalesChannels()])
      .then(([ad, ch]) => {
        if (!alive) return;
        setAdapters(ad);
        setChannels(ch.filter((c) => !c.isDeleted));
        if (ad.length && !kind) {
          setKind(ad[0].kind);
        }
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.salesIntegrationNew.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async () => {
    if (!kind) {
      setError(t('crm.salesIntegrationNew.errors.missingType'));
      return;
    }
    if (!name.trim()) {
      setError(t('crm.salesIntegrationNew.errors.missingName'));
      return;
    }

    if (kind === 'woocommerce') {
      if (!url.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
        setError(t('crm.salesIntegrationNew.errors.missingWoo'));
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const payload: CreateIntegrationPayload = {
        name: name.trim(),
        kind,
        description: description.trim() || undefined,
        channelId: channelId || undefined,
        config: {
          url: url.trim() || undefined,
          consumerKey: consumerKey.trim() || undefined,
          consumerSecret: consumerSecret.trim() || undefined,
        },
      };

      await createIntegration(payload);
      // после создания возвращаемся к списку
      navigate('/app/sales/integrations');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.salesIntegrationNew.errors.create'));
    } finally {
      setSaving(false);
    }
  };

  const selectedAdapter = adapters.find((a) => a.kind === kind);

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8 max-w-3xl">
        <section className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-text-tertiary mb-1">
              {t('crm.salesIntegrationNew.kicker')}
            </div>
            <h1 className="page-title">
              {t('crm.salesIntegrationNew.title')}
            </h1>
            <p className="text-xs text-text-tertiary mt-1 max-w-xl">
              {t('crm.salesIntegrationNew.subtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/app/sales/integrations')}
            className="btn-secondary btn-secondary-sm"
          >
            {t('crm.salesIntegrationNew.back')}
          </button>
        </section>

        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <section className="card p-4 md:p-5 space-y-4">
          {loading ? (
            <div className="text-[11px] text-text-tertiary">
              {t('crm.salesIntegrationNew.loading')}
            </div>
          ) : (
            <>
              {/* Тип интеграции */}
              <div className="space-y-1">
                <label className="form-label">
                  {t('crm.salesIntegrationNew.fields.type')}
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as IntegrationKind)}
                  className="base-input h-9 max-w-xs text-[12px] px-2.5"
                >
                  <option value="">
                    {t('crm.salesIntegrationNew.fields.typePlaceholder')}
                  </option>
                  {adapters.map((a) => (
                    <option key={a.kind} value={a.kind}>
                      {a.label}
                    </option>
                  ))}
                </select>
                {selectedAdapter && (
                  <p className="text-[11px] text-text-tertiary mt-1">
                    {selectedAdapter.description ??
                      t('crm.salesIntegrationNew.fields.typeFallback')}
                  </p>
                )}
              </div>

              {/* Название + канал */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="form-label">
                    {t('crm.salesIntegrationNew.fields.name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('crm.salesIntegrationNew.fields.namePlaceholder')}
                    className="base-input h-9 text-[12px] px-2.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="form-label">
                    {t('crm.salesIntegrationNew.fields.channel')}
                  </label>
                  <select
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    className="base-input h-9 text-[12px] px-2.5"
                  >
                    <option value="">
                      {t('crm.salesIntegrationNew.fields.channelPlaceholder')}
                    </option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Описание */}
              <div className="space-y-1">
                <label className="form-label">
                  {t('crm.salesIntegrationNew.fields.description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder={t(
                    'crm.salesIntegrationNew.fields.descriptionPlaceholder',
                  )}
                  className="base-input text-[12px] px-2.5 py-2 resize-none"
                />
              </div>

              {/* Блок настроек WooCommerce (MVP) */}
              {kind === 'woocommerce' && (
                <div className="border border-border-default rounded-2xl p-3.5 space-y-3 bg-surface-subtle">
                  <div className="section-label">
                    {t('crm.salesIntegrationNew.woocommerce.title')}
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="form-label">
                        {t('crm.salesIntegrationNew.woocommerce.url')}
                      </label>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://yourshop.com"
                        className="base-input h-9 text-[12px] px-2.5"
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="form-label">
                          {t('crm.salesIntegrationNew.woocommerce.consumerKey')}
                        </label>
                        <input
                          type="text"
                          value={consumerKey}
                          onChange={(e) => setConsumerKey(e.target.value)}
                          className="base-input h-9 text-[12px] px-2.5"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="form-label">
                          {t(
                            'crm.salesIntegrationNew.woocommerce.consumerSecret',
                          )}
                        </label>
                        <input
                          type="password"
                          value={consumerSecret}
                          onChange={(e) => setConsumerSecret(e.target.value)}
                          className="base-input h-9 text-[12px] px-2.5"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-text-tertiary">
                      {t('crm.salesIntegrationNew.woocommerce.hint')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="btn-primary disabled:opacity-60"
                >
                  {saving
                    ? t('crm.salesIntegrationNew.actions.saving')
                    : t('crm.salesIntegrationNew.actions.create')}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </MainLayout>
  );
};
