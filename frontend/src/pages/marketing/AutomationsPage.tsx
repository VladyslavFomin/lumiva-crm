import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingAutomations,
  createMarketingAutomation,
  updateMarketingAutomation,
  deleteMarketingAutomation,
  type MarketingAutomation,
} from '../../api/marketing';

export const AutomationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MarketingAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchMarketingAutomations()
      .then(setItems)
      .catch((e: any) => {
        console.error(e);
        setError(e?.message || t('crm.marketingAutomations.errors.load'));
      })
      .finally(() => setLoading(false));
  }, []);

  const onCreate = async () => {
    if (!name.trim()) {
      alert(t('crm.marketingAutomations.errors.requiredName'));
      return;
    }
    setCreating(true);
    try {
      const created = await createMarketingAutomation({
        name: name.trim(),
        type: 'n8n_webhook',
        webhookUrl: webhookUrl || undefined,
        isActive: true,
      });
      setItems((prev) => [created, ...prev]);
      setName('');
      setWebhookUrl('');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || t('crm.marketingAutomations.errors.create'));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (item: MarketingAutomation) => {
    const next = !item.isActive;
    try {
      const updated = await updateMarketingAutomation(item.id, {
        isActive: next,
      });
      setItems((prev) =>
        prev.map((it) => (it.id === updated.id ? updated : it)),
      );
    } catch (e: any) {
      console.error(e);
      alert(e?.message || t('crm.marketingAutomations.errors.update'));
    }
  };

  const remove = async (item: MarketingAutomation) => {
    if (!window.confirm(t('crm.marketingAutomations.confirmDelete', { name: item.name })))
      return;
    try {
      await deleteMarketingAutomation(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || t('crm.marketingAutomations.errors.delete'));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.marketingAutomations.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.marketingAutomations.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.marketingAutomations.subtitle')}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] md:gap-5">
          {/* Форма добавления */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              {t('crm.marketingAutomations.form.title')}
            </h2>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t('crm.marketingAutomations.form.name')}
              </label>
              <input
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('crm.marketingAutomations.form.namePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {t('crm.marketingAutomations.form.webhook')}
              </label>
              <input
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://n8n.lumiva.agency/webhook/..."
              />
            </div>

            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              className="mt-2 w-full px-4 py-2 rounded-2xl bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating
                ? t('crm.marketingAutomations.actions.creating')
                : t('crm.marketingAutomations.actions.create')}
            </button>

            <p className="mt-3 text-[10px] text-slate-500">
              {t('crm.marketingAutomations.form.note')}
            </p>
          </div>

          {/* Список сценариев */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  {t('crm.marketingAutomations.list.title')}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {t('crm.marketingAutomations.list.subtitle')}
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                {t('crm.marketingAutomations.list.total', {
                  count: items.length,
                })}
              </span>
            </div>

            {loading && (
              <div className="text-[11px] text-slate-400">
                {t('crm.marketingAutomations.loading')}
              </div>
            )}

            {error && (
              <div className="text-[11px] text-red-400 mb-2">{error}</div>
            )}

            {!loading && !items.length && (
              <div className="text-[11px] text-slate-500">
                {t('crm.marketingAutomations.list.empty')}
              </div>
            )}

            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="rounded-2xl border border-slate-800/90 bg-slate-900/70 px-3 py-2.5 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-50">
                        {it.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {it.type} ·{' '}
                        {it.lastStatus
                          ? t('crm.marketingAutomations.list.lastStatus', {
                              status: it.lastStatus,
                            })
                          : t('crm.marketingAutomations.list.statusUnknown')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(it)}
                        className={
                          'px-2 py-0.5 rounded-full text-[10px] border ' +
                          (it.isActive
                            ? 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10'
                            : 'border-slate-600 text-slate-400 bg-slate-800')
                        }
                        >
                        {it.isActive
                          ? t('crm.marketingAutomations.status.enabled')
                          : t('crm.marketingAutomations.status.disabled')}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(it)}
                        className="px-2 py-0.5 rounded-xl border border-rose-500/60 text-[10px] text-rose-300 hover:bg-rose-500/10"
                      >
                        {t('crm.marketingAutomations.actions.delete')}
                      </button>
                    </div>
                  </div>
                  {it.webhookUrl && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {it.webhookUrl}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};
